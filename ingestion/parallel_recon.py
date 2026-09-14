"""
parallel_recon.py — Recon 360 engine: reconcile two same-schema Oracle
databases (System of Record vs Under Test) during prod parallel.

Passes (depth-controlled):
  SCHEMA   common-table census, column presence, datatype/nullability drift
  AGG      per-column dtype-aware aggregates (CNT/NULLS/SUM/MIN/MAX/HASHSUM)
           compared with tolerance rules
  ROWHASH  PK + STANDARD_HASH streamed from both sides in PK order, merged;
           missing/extra/mismatch counted; column-level diff on sample PKs,
           values masked when the column is PII-flagged in the dictionary

Works whether the two sides are the same instance or different instances:
comparison is two-cursor streaming, memory-bounded.

CLI:
  python -m ingestion.parallel_recon --side-a ADDVANTAGE_PROD \
         --side-b SWP_ADDV_MIRROR [--tables T1,T2] [--depth ROWHASH]
"""
from __future__ import annotations

import argparse
import datetime as dt
import logging
from collections import defaultdict

from ingestion.datasource_registry import connect_source
from ingestion.variance_engine import _catalog

log = logging.getLogger("cp.recon360")
logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(levelname)s %(message)s")

SAMPLE_BREAKS = 50
CHUNK = 5000


# ---------------------------------------------------------------------------
# config
# ---------------------------------------------------------------------------
def load_config(ccur):
    cfg = {"ignore": set(), "num_tol": {}, "date_only": defaultdict(set),
           "pk_override": {}, "skip": set()}
    try:
        ccur.execute("""SELECT scope, rule_type, column_name, rule_value
                        FROM recon_pr_config""")
    except Exception:                                       # noqa: BLE001
        return cfg
    for scope, rt, col, val in ccur.fetchall():
        scope = (scope or "GLOBAL").upper()
        if rt == "IGNORE_COLS":
            for c in (val or "").split(","):
                if c.strip():
                    cfg["ignore"].add((scope, c.strip().upper()))
        elif rt == "NUM_TOL":
            cfg["num_tol"][(scope, (col or "").upper())] = float(val or 0)
        elif rt == "DATE_ONLY":
            cfg["date_only"][scope].add((col or "").upper())
        elif rt == "PK_COLS":
            cfg["pk_override"][scope] = [c.strip().upper()
                                         for c in (val or "").split(",")]
        elif rt == "SKIP_TABLE":
            cfg["skip"].add(scope)
    return cfg


def _ignored(cfg, table, col):
    return (("GLOBAL", col) in cfg["ignore"]
            or (table, col) in cfg["ignore"])


# ---------------------------------------------------------------------------
# schema pass
# ---------------------------------------------------------------------------
def _cols(cur, schema, table=None):
    q = """SELECT table_name, column_name, data_type,
                  data_precision, data_scale, data_length, nullable
           FROM all_tab_columns WHERE owner = :o"""
    binds = {"o": schema}
    if table:
        q += " AND table_name = :t"
        binds["t"] = table
    cur.execute(q + " ORDER BY table_name, column_id", binds)
    out = defaultdict(dict)
    for t, c, dty, prec, scale, dlen, nul in cur.fetchall():
        d = (f"{dty}({prec},{scale})" if prec is not None
             else f"{dty}({dlen})" if dty in ("VARCHAR2", "CHAR", "RAW")
             else dty)
        out[t][c] = (dty, d, nul)
    return out


def schema_pass(ca, cb, schema_a, schema_b, ccur, cconn, run_id, scope):
    a, b = _cols(ca, schema_a), _cols(cb, schema_b)
    tabs_a, tabs_b = set(a), set(b)
    if scope:
        tabs_a &= scope
        tabs_b &= scope
    drift = []
    for t in sorted(tabs_a - tabs_b):
        drift.append((t, "B_MISSING_TABLE", None,
                      f"{len(a[t])} cols", "table absent", "FIX_FIRST"))
    for t in sorted(tabs_b - tabs_a):
        drift.append((t, "A_MISSING_TABLE", None, "table absent",
                      f"{len(b[t])} cols", "DRIFT"))
    common = sorted(tabs_a & tabs_b)
    for t in common:
        ac, bc = a[t], b[t]
        for c in sorted(set(ac) - set(bc)):
            drift.append((t, "B_MISSING_COL", c, ac[c][1],
                          "column absent", "DRIFT"))
        for c in sorted(set(bc) - set(ac)):
            drift.append((t, "A_MISSING_COL", c, "column absent",
                          bc[c][1], "DRIFT"))
        for c in sorted(set(ac) & set(bc)):
            if ac[c][1] != bc[c][1]:
                sev = ("FIX_FIRST" if ac[c][0] == bc[c][0] == "NUMBER"
                       else "DRIFT")
                drift.append((t, "TYPE_DRIFT", c, ac[c][1], bc[c][1], sev))
            elif ac[c][2] != bc[c][2]:
                drift.append((t, "NULLABILITY", c,
                              f"NULLABLE={ac[c][2]}", f"NULLABLE={bc[c][2]}",
                              "DRIFT"))
    for row in drift:
        ccur.execute("""INSERT INTO recon_pr_schema
            (run_id, table_name, drift_type, column_name, a_def, b_def,
             severity) VALUES (:1, :2, :3, :4, :5, :6, :7)""",
            [run_id, *row])
    cconn.commit()
    log.info("schema pass: %d common tables · %d drifts", len(common),
             len(drift))
    return common, a, b


# ---------------------------------------------------------------------------
# aggregate pass
# ---------------------------------------------------------------------------
_NUM = ("NUMBER", "FLOAT", "BINARY_FLOAT", "BINARY_DOUBLE")


def _agg_exprs(table, cols, cfg):
    items, man = ["COUNT(*) AS M0"], [("*", "CNT")]
    for c, (dty, _d, _n) in cols.items():
        if _ignored(cfg, table, c) or "LOB" in dty or dty.startswith("LONG"):
            continue
        qc = f'"{c}"'
        items.append(f"SUM(CASE WHEN {qc} IS NULL THEN 1 ELSE 0 END) "
                     f"AS M{len(man)}")
        man.append((c, "NULLS"))
        if dty in _NUM:
            items.append(f"SUM({qc}) AS M{len(man)}")
            man.append((c, "SUM"))
        elif dty in ("DATE", "TIMESTAMP", "TIMESTAMP(6)"):
            items.append(f"TO_CHAR(MIN({qc}),'YYYYMMDDHH24MISS') "
                         f"AS M{len(man)}")
            man.append((c, "MIN"))
            items.append(f"TO_CHAR(MAX({qc}),'YYYYMMDDHH24MISS') "
                         f"AS M{len(man)}")
            man.append((c, "MAX"))
        else:
            items.append(f"SUM(ORA_HASH({qc})) AS M{len(man)}")
            man.append((c, "HASHSUM"))
    return items, man


def _run_aggs(cur, qtab, items, man):
    out = {}
    for i in range(0, len(items), 150):
        sub, subman = items[i:i + 150], man[i:i + 150]
        try:
            cur.execute("SELECT " + ", ".join(sub) + f" FROM {qtab}")
            for (col, m), v in zip(subman, cur.fetchone()):
                out[(col, m)] = v
        except Exception as e:                              # noqa: BLE001
            log.warning("agg batch failed %s: %s — per column", qtab,
                        str(e)[:80])
            for expr, (col, m) in zip(sub, subman):
                try:
                    cur.execute(f"SELECT {expr} FROM {qtab}")
                    out[(col, m)] = cur.fetchone()[0]
                except Exception:                           # noqa: BLE001
                    out[(col, m)] = None
    return out


def agg_pass(ca, cb, qa, qb, table, cols, cfg):
    items, man = _agg_exprs(table, cols, cfg)
    ra, rb = _run_aggs(ca, qa, items, man), _run_aggs(cb, qb, items, man)
    cnt_a = ra.get(("*", "CNT")) or 0
    cnt_b = rb.get(("*", "CNT")) or 0
    breaks = []
    for key in man[1:]:
        va, vb = ra.get(key), rb.get(key)
        if va is None and vb is None:
            continue
        col, m = key
        if m == "SUM":
            tol = cfg["num_tol"].get((table, col),
                                     cfg["num_tol"].get(("GLOBAL", col), 0))
            if (va or 0) != (vb or 0) and abs((va or 0) - (vb or 0)) > tol:
                breaks.append(f"SUM({col}) ΔA-B={float((va or 0) - (vb or 0)):,.2f}")
        elif va != vb:
            breaks.append(f"{m}({col}) A={va} B={vb}")
    return cnt_a, cnt_b, breaks, len(man) - 1


# ---------------------------------------------------------------------------
# row-hash pass (streaming merge over two PK-ordered cursors)
# ---------------------------------------------------------------------------
def _pk_cols(cur, schema, table, cfg):
    if table in cfg["pk_override"]:
        return cfg["pk_override"][table]
    cur.execute("""SELECT cc.column_name
                   FROM all_constraints c
                   JOIN all_cons_columns cc
                     ON cc.owner = c.owner
                    AND cc.constraint_name = c.constraint_name
                   WHERE c.owner = :o AND c.table_name = :t
                     AND c.constraint_type = 'P'
                   ORDER BY cc.position""", {"o": schema, "t": table})
    return [r[0] for r in cur.fetchall()]


def _hash_sql(qtab, pk, cols, table, cfg):
    parts = []
    for c, (dty, _d, _n) in sorted(cols.items()):
        if c in pk or _ignored(cfg, table, c) or "LOB" in dty \
                or dty.startswith("LONG"):
            continue
        qc = f'"{c}"'
        if dty in ("DATE",) or dty.startswith("TIMESTAMP"):
            fmt = ("'YYYYMMDD'" if c in cfg["date_only"].get(table, set())
                   or c in cfg["date_only"].get("GLOBAL", set())
                   else "'YYYYMMDDHH24MISS'")
            parts.append(f"TO_CHAR({qc},{fmt})")
        elif dty in _NUM:
            parts.append(f"TO_CHAR({qc})")
        else:
            parts.append(qc)
    concat = " || '|' || ".join(f"NVL({p},'~')" for p in parts) or "'x'"
    pksel = ", ".join(f'"{c}"' for c in pk)
    pkcat = " || '·' || ".join(f'NVL(TO_CHAR("{c}"),\'~\')' for c in pk)
    return (f"SELECT {pkcat} AS PKV, "
            f"STANDARD_HASH({concat}, 'MD5') AS RH, {pksel} "
            f"FROM {qtab} ORDER BY {pksel}")


def rowhash_pass(ca, cb, qa, qb, table, pk, cols, cfg):
    sqa = _hash_sql(qa, pk, cols, table, cfg)
    sqb = _hash_sql(qb, pk, cols, table, cfg)
    ca.arraysize = cb.arraysize = CHUNK
    ca.execute(sqa)
    cb.execute(sqb)
    missing_b = extra_b = mismatch = 0
    samples = {"MISSING_B": [], "EXTRA_B": [], "MISMATCH": []}

    def nxt(cur):
        r = cur.fetchone()
        return (r[0], r[1]) if r else None
    a, b = nxt(ca), nxt(cb)
    while a or b:
        if b is None or (a and a[0] < b[0]):
            missing_b += 1
            if len(samples["MISSING_B"]) < SAMPLE_BREAKS:
                samples["MISSING_B"].append(a[0])
            a = nxt(ca)
        elif a is None or (b and b[0] < a[0]):
            extra_b += 1
            if len(samples["EXTRA_B"]) < SAMPLE_BREAKS:
                samples["EXTRA_B"].append(b[0])
            b = nxt(cb)
        else:
            if a[1] != b[1]:
                mismatch += 1
                if len(samples["MISMATCH"]) < SAMPLE_BREAKS:
                    samples["MISMATCH"].append(a[0])
            a, b = nxt(ca), nxt(cb)
    return missing_b, extra_b, mismatch, samples


# ---------------------------------------------------------------------------
# column diff on sample PKs (PII-masked)
# ---------------------------------------------------------------------------
def _pii_cols(ccur, table):
    try:
        ccur.execute("""SELECT UPPER(NVL(pb_field_mapping, field_code_norm))
                        FROM legacy_dictionary
                        WHERE UPPER(NVL(is_pii,'N')) = 'Y'""")
        return {r[0] for r in ccur.fetchall()}
    except Exception:                                       # noqa: BLE001
        return set()


def _mask(v):
    s = "" if v is None else str(v)
    return "".join("A" if ch.isalpha() else "9" if ch.isdigit() else ch
                   for ch in s)


def col_diff(ca, cb, qa, qb, table, pk, cols, cfg, pks, pii):
    out = []
    keep = [c for c in sorted(cols) if c not in pk
            and not _ignored(cfg, table, c)
            and "LOB" not in cols[c][0] and not cols[c][0].startswith("LONG")]
    sel = ", ".join(f'"{c}"' for c in keep)
    where = " AND ".join(
        f'NVL(TO_CHAR("{c}"),\'~\') = :p{i}' for i, c in enumerate(pk))
    for pkv in pks:
        binds = {f"p{i}": v for i, v in enumerate(pkv.split("·"))}
        try:
            ca.execute(f"SELECT {sel} FROM {qa} WHERE {where}", binds)
            rowa = ca.fetchone()
            cb.execute(f"SELECT {sel} FROM {qb} WHERE {where}", binds)
            rowb = cb.fetchone()
        except Exception:                                   # noqa: BLE001
            continue
        if not rowa or not rowb:
            continue
        diffs, avals, bvals = [], [], []
        for c, va, vb in zip(keep, rowa, rowb):
            if str(va) != str(vb):
                diffs.append(c)
                m = c in pii
                avals.append(f"{c}={_mask(va) if m else va}")
                bvals.append(f"{c}={_mask(vb) if m else vb}")
        if diffs:
            out.append((pkv, ",".join(diffs)[:1000],
                        " · ".join(avals)[:2000],
                        " · ".join(bvals)[:2000]))
    return out


# ---------------------------------------------------------------------------
# orchestrator
# ---------------------------------------------------------------------------
def run(side_a, side_b, tables=None, depth="ROWHASH", run_id=None):
    run_id = run_id or f"PR{dt.datetime.now():%Y%m%d_%H%M%S}"
    cconn = _catalog()
    ccur = cconn.cursor()
    conn_a, src_a = connect_source(side_a)
    conn_b, src_b = connect_source(side_b)
    schema_a = (src_a.get("schemas") or "").split(",")[0].strip().upper()
    schema_b = (src_b.get("schemas") or "").split(",")[0].strip().upper()
    ca, cb = conn_a.cursor(), conn_b.cursor()
    scope = ({t.strip().upper() for t in tables} if tables else None)
    ccur.execute("""INSERT INTO recon_pr_runs
        (run_id, side_a, side_b, schema_a, schema_b, scope_desc, depth,
         status, step, tables_total, tables_done)
        VALUES (:1, :2, :3, :4, :5, :6, :7, 'RUNNING', 'schema pass', 0, 0)""",
        [run_id, side_a, side_b, schema_a, schema_b,
         ",".join(sorted(scope)) if scope else "ALL", depth])
    cconn.commit()
    cfg = load_config(ccur)
    pii = _pii_cols(ccur, None)
    try:
        common, a_cols, _b = schema_pass(ca, cb, schema_a, schema_b,
                                         ccur, cconn, run_id, scope)
        common = [t for t in common if t not in cfg["skip"]]
        ccur.execute("""UPDATE recon_pr_runs SET tables_total = :n
                        WHERE run_id = :r""",
                     {"n": len(common), "r": run_id})
        cconn.commit()
        greens = 0
        for i, t in enumerate(common, 1):
            ccur.execute("""UPDATE recon_pr_runs
                SET step = :s, tables_done = :d WHERE run_id = :r""",
                {"s": f"{t} ({i}/{len(common)})", "d": i - 1, "r": run_id})
            cconn.commit()
            qa, qb = f'"{schema_a}"."{t}"', f'"{schema_b}"."{t}"'
            cols = a_cols[t]
            cnt_a = cnt_b = None
            metric_breaks, ncols = [], 0
            missing_b = extra_b = mismatch = 0
            pk, note = [], None
            if depth in ("AGG", "ROWHASH"):
                cnt_a, cnt_b, metric_breaks, ncols = agg_pass(
                    ca, cb, qa, qb, t, cols, cfg)
            if depth == "ROWHASH":
                pk = _pk_cols(ca, schema_a, t, cfg)
                if pk:
                    try:
                        missing_b, extra_b, mismatch, smp = rowhash_pass(
                            ca, cb, qa, qb, t, pk, cols, cfg)
                        for btype, pks in (("MISSING_B", smp["MISSING_B"]),
                                           ("EXTRA_B", smp["EXTRA_B"])):
                            for pkv in pks:
                                ccur.execute("""INSERT INTO recon_pr_break
                                    (run_id, table_name, break_type,
                                     pk_value) VALUES (:1,:2,:3,:4)""",
                                    [run_id, t, btype, pkv[:400]])
                        for pkv, dcols, av, bv in col_diff(
                                ca, cb, qa, qb, t, pk, cols, cfg,
                                smp["MISMATCH"], pii):
                            ccur.execute("""INSERT INTO recon_pr_break
                                (run_id, table_name, break_type, pk_value,
                                 cols_differ, a_values, b_values)
                                VALUES (:1,:2,'MISMATCH',:3,:4,:5,:6)""",
                                [run_id, t, pkv[:400], dcols, av, bv])
                    except Exception as e:                  # noqa: BLE001
                        note = f"rowhash failed: {str(e)[:200]}"
                        log.warning("%s %s", t, note)
                else:
                    note = "no PK — aggregate compare only"
            broke = (bool(metric_breaks) or missing_b or extra_b or mismatch
                     or (cnt_a is not None and cnt_a != cnt_b))
            status = "RED" if broke else "GREEN"
            if status == "GREEN":
                greens += 1
            ccur.execute("""INSERT INTO recon_pr_table
                (run_id, table_name, pk_cols, cnt_a, cnt_b, cols_compared,
                 metric_breaks, missing_b, extra_b, mismatch, status, note)
                VALUES (:1,:2,:3,:4,:5,:6,:7,:8,:9,:10,:11,:12)""",
                [run_id, t, ",".join(pk)[:400] or None, cnt_a, cnt_b,
                 ncols, " · ".join(metric_breaks)[:2000] or None,
                 missing_b, extra_b, mismatch, status, note])
            cconn.commit()
            log.info("%s: %s%s", t, status,
                     f" ({', '.join(metric_breaks[:3])})"
                     if metric_breaks else "")
        rate = round(100 * greens / len(common), 2) if common else 100
        ccur.execute("""UPDATE recon_pr_runs SET status = 'COMPLETE',
            step = 'done', tables_done = tables_total, match_rate = :m,
            finished_at = SYSTIMESTAMP WHERE run_id = :r""",
            {"m": rate, "r": run_id})
        cconn.commit()
        log.info("run %s COMPLETE · match rate %.1f%%", run_id, rate)
    except Exception as e:                                  # noqa: BLE001
        log.exception("recon run failed")
        ccur.execute("""UPDATE recon_pr_runs SET status = 'FAILED',
            error_text = :e, finished_at = SYSTIMESTAMP
            WHERE run_id = :r""", {"e": str(e)[:2000], "r": run_id})
        cconn.commit()
    finally:
        conn_a.close()
        conn_b.close()
    return run_id


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--side-a", required=True)
    p.add_argument("--side-b", required=True)
    p.add_argument("--tables")
    p.add_argument("--depth", default="ROWHASH",
                   choices=["SCHEMA", "AGG", "ROWHASH"])
    a = p.parse_args()
    rid = run(a.side_a, a.side_b,
              a.tables.split(",") if a.tables else None, a.depth)
    print(f"run {rid}")
