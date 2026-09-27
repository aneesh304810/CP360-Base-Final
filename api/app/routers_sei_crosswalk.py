"""SEI crosswalk — the mapping, the verdicts, and the divergence.

SCOPE. Every endpoint here is NEW. None of the existing legacy-lineage
endpoints is touched, so a PBDW screen issues exactly the queries it issued
yesterday. A warehouse with no rows in SEI_VERIFY gets empty payloads from
these routes and the UI hides the crosswalk surface entirely — which is how
PBDW stays byte-identical until its own crosswalk is loaded.

THE LANE. legacy_lineage has no source_system column and does not need one.
legacy_source_file already carries it, and joins through src_file_key, so

    lane = (legacy_source_file.source_system, legacy_lineage.data_source)

resolves without widening a table PBDW depends on.

THE DENOMINATOR. Only lanes whose LEGACY_LANE.replacement_state is REPLACED
count toward cutover readiness. UAF is in the lineage and out of the
denominator — score it and it reads 100% NO_SOURCE on a lane nobody is
touching, which is the fastest way to have the whole report dismissed.
"""
from __future__ import annotations
import logging
from fastapi import APIRouter

from ._legacy_compat import _safe

log = logging.getLogger("cp.api.sei_crosswalk")
router = APIRouter(prefix="/sei-crosswalk", tags=["sei-crosswalk"])

_DS = "IMDS"

# The canonical field code, in SQL. Must agree byte for byte with
# ingestion.lane_lineage_conn._norm_code and _legacy_groups._CANON, because a
# PBDW contract field is an AddVantage code spelled BI/2-1 on one sheet and
# BI_2_L1 on another. A literal join matches nothing and says so silently.
def _canon(col):
    return (f"REGEXP_REPLACE(UPPER(TRIM('_' FROM "
            f"REGEXP_REPLACE({col}, '[[:space:]/.-]+', '_'))), '_L([0-9]+)', '_\\1')")



def _ds(v):
    return (v or _DS).upper()


# Verdicts that mean "a SEI datapoint was proposed", in the order the UI
# stacks them. NO_BASELINE and OUT_OF_SCOPE are deliberately last: they are
# not SEI findings and must never lead a summary.
VERDICT_ORDER = ["PROVEN_MATCH", "UNKNOWN", "DECODE_NEEDED", "PRECISION_RISK",
                 "TYPE_SHIFT", "NOT_COMPARABLE", "NO_SOURCE",
                 "NO_BASELINE", "OUT_OF_SCOPE"]


@router.get("/summary")
def summary(data_source: str | None = None):
    ds = _ds(data_source)
    rows = _safe("""
        SELECT match_verdict AS v, COUNT(*) AS n
        FROM   sei_verify WHERE data_source = :ds
        GROUP BY match_verdict""", {"ds": ds})
    by = {(r.get("v") or "UNKNOWN"): int(r.get("n") or 0) for r in rows}
    total = sum(by.values())
    scope = total - by.get("OUT_OF_SCOPE", 0) - by.get("NO_BASELINE", 0)

    mapped = _safe("""
        SELECT COUNT(*) AS n FROM sei_verify
        WHERE data_source = :ds AND NVL(sei_datapoint_count,0) > 0""", {"ds": ds})
    dual = _safe("SELECT COUNT(*) AS n FROM sei_dual_source WHERE data_source = :ds", {"ds": ds})
    exc = _safe("SELECT COUNT(*) AS n FROM sei_exception WHERE data_source = :ds", {"ds": ds})
    undecided = _safe("""
        SELECT COUNT(*) AS n FROM sei_disposition
        WHERE disposition = 'UNDECIDED'
          AND lane_id IN (SELECT lane_id FROM legacy_lane WHERE data_source = :ds)""",
        {"ds": ds})
    div = _safe("""
        SELECT COUNT(*) AS n FROM sei_verify
        WHERE data_source = :ds AND failed_checks IS NOT NULL
          AND (failed_checks LIKE '%COLLAPSE%' OR failed_checks LIKE '%DUAL_SOURCE%'
            OR failed_checks LIKE '%BYPASSES_CONTRACT%')""", {"ds": ds})

    def one(r):
        return int((r[0].get("n") if r else 0) or 0)

    return {
        "data_source": ds,
        "total_columns": total,
        "in_denominator": scope,
        "mapped": one(mapped),
        "proven": by.get("PROVEN_MATCH", 0),
        "no_source": by.get("NO_SOURCE", 0),
        "out_of_scope": by.get("OUT_OF_SCOPE", 0),
        "dual_source": one(dual),
        "divergent": one(div),
        "undecided_dispositions": one(undecided),
        "open_exceptions": one(exc),
        "verdicts": [{"verdict": v, "n": by[v]} for v in VERDICT_ORDER if v in by],
        # The ceiling. Stated once here rather than per row: with document
        # evidence on the target side no verdict can reach PROVEN_MATCH.
        "ceiling": _ceiling(ds),
    }


def _ceiling(ds):
    rows = _safe("""
        SELECT evidence_right AS e, COUNT(*) AS n FROM sei_verify
        WHERE data_source = :ds GROUP BY evidence_right""", {"ds": ds})
    by = {(r.get("e") or "NONE"): int(r.get("n") or 0) for r in rows}
    live = by.get("LIVE_DDL", 0)
    total = sum(by.values()) or 1
    if live == total:
        return {"blocked": False, "reason": "Target evidence is live DDL."}
    return {
        "blocked": True,
        "live_ddl": live, "of": total,
        "reason": ("Target types came from a data dictionary, not live DDL. "
                   "No row can reach PROVEN_MATCH until an ALL_TAB_COLUMNS "
                   "extract replaces it."),
    }


@router.get("/lane-systems")
def lane_systems(data_source: str | None = None):
    """Which source systems actually feed THIS warehouse.

    LineageHome's system badges come from /legacy-lineage/systems, which takes
    no data_source and so returns the same three for every warehouse. That is
    why IMDS — fed by STAR and UAF — offered AddVantage, and defaulted to it.

    legacy_source_file already carries source_system per warehouse, so the
    answer is a group-by. Added here rather than to routers_legacy_lineage.py,
    which _legacy_compat records as one of the files a stale edit has broken
    before.
    """
    ds = _ds(data_source)
    rows = _safe("""
        SELECT NVL(f.source_system,'UNKNOWN') AS source_system,
               COUNT(DISTINCT f.src_file)     AS feeds
        FROM   legacy_source_file f
        WHERE  f.data_source = :ds
        GROUP  BY NVL(f.source_system,'UNKNOWN')
        ORDER  BY 2 DESC""", {"ds": ds})
    return {"data_source": ds,
            "systems": [r for r in rows if (r.get("source_system") or "") != "UNKNOWN"]}


@router.get("/lanes")
def lanes(data_source: str | None = None):
    ds = _ds(data_source)
    regs = _safe("""
        SELECT lane_id, source_system, data_source, replacement_state,
               successor_system, contract_name, notes
        FROM   legacy_lane WHERE data_source = :ds ORDER BY lane_id""", {"ds": ds})
    counts = _safe("""
        SELECT lane_id, match_verdict AS v, COUNT(*) AS n
        FROM   sei_verify WHERE data_source = :ds
        GROUP BY lane_id, match_verdict""", {"ds": ds})
    by = {}
    for c in counts:
        by.setdefault(c.get("lane_id"), {})[c.get("v")] = int(c.get("n") or 0)
    for r in regs:
        v = by.get(r.get("lane_id"), {})
        r["verdicts"] = [{"verdict": k, "n": v[k]} for k in VERDICT_ORDER if k in v]
        r["columns"] = sum(v.values())
    return {"lanes": regs}


@router.get("/flow")
def flow(data_source: str | None = None):
    """Nodes and links for the mapping flow: SEI source -> contract feed ->
    warehouse table. Link weight is COUNT(DISTINCT target column), never row
    count — legacy_lineage's grain is (target column x source), so counting
    rows double-counts a fan-in."""
    ds = _ds(data_source)
    left = _safe("""
        SELECT NVL(m.sei_feed, 'no SEI source') AS src,
               NVL(v.contract_feed, 'unmapped')  AS mid,
               COUNT(DISTINCT v.dwh_target_table || '.' || v.dwh_target_column) AS n
        FROM   sei_verify v
        LEFT JOIN sei_source_map m
               ON m.data_source = v.data_source
              AND NVL(m.src_col_norm, m.src_source_column) = {CANON_CF}
        WHERE  v.data_source = :ds
          AND  v.lane_id IN (SELECT lane_id FROM legacy_lane
                             WHERE data_source = :ds AND replacement_state = 'REPLACED')
        GROUP BY NVL(m.sei_feed, 'no SEI source'), NVL(v.contract_feed, 'unmapped')
    """.replace("{CANON_CF}", _canon("v.contract_field")), {"ds": ds})
    right = _safe("""
        SELECT NVL(contract_feed, 'unmapped') AS mid, dwh_target_table AS tgt,
               COUNT(DISTINCT dwh_target_column) AS n
        FROM   sei_verify
        WHERE  data_source = :ds
          AND  lane_id IN (SELECT lane_id FROM legacy_lane
                           WHERE data_source = :ds AND replacement_state = 'REPLACED')
        GROUP BY NVL(contract_feed, 'unmapped'), dwh_target_table
    """, {"ds": ds})
    return {"left": left, "right": right}


@router.get("/columns")
def columns(data_source: str | None = None, verdict: str | None = None,
            lane: str | None = None, group: str | None = None,
            table: str | None = None, limit: int = 500):
    """The drill list. Every filter the dashboard can hand down."""
    ds = _ds(data_source)
    where = ["data_source = :ds"]
    p = {"ds": ds}
    if verdict:
        where.append("match_verdict = :v"); p["v"] = verdict.upper()
    if lane:
        where.append("lane_id = :l"); p["l"] = lane.upper()
    if group:
        where.append("functional_group = :g"); p["g"] = group
    if table:
        where.append("dwh_target_table = :t"); p["t"] = table
    rows = _safe(f"""
        SELECT lane_id, dwh_target_table, dwh_target_column, functional_group,
               contract_feed, contract_field, sei_datapoint_count, sei_datapoints,
               map_kind, match_verdict, failed_checks, blocks_cutover,
               verdict_reason, what_would_clear_it
        FROM   sei_verify WHERE {' AND '.join(where)}
        ORDER  BY dwh_target_table, dwh_target_column
        FETCH FIRST {int(limit)} ROWS ONLY""", p)
    return {"columns": rows, "count": len(rows)}


@router.get("/column")
def column(table: str, column: str, data_source: str | None = None):
    """One final column, everything known about it — the bottom of the drill.

    Returns every lane that writes it (that is the dual-source finding), the
    SEI datapoints proposed for its contract field, every OTHER contract field
    those same datapoints are proposed for (that is the collapse finding), and
    the disposition if it has no source.
    """
    ds = _ds(data_source)
    p = {"ds": ds, "t": table, "c": column}
    verdicts = _safe("""
        SELECT * FROM sei_verify
        WHERE data_source = :ds AND dwh_target_table = :t AND dwh_target_column = :c
        ORDER BY lane_id""", p)
    chain = _safe("""
        SELECT l.lane_id_resolved AS lane_id, l.* FROM (
          SELECT f.source_system AS lane_id_resolved, ll.*
          FROM   legacy_lineage ll
          LEFT JOIN legacy_source_file f
                 ON f.data_source = ll.data_source
                AND f.src_file_key = REGEXP_REPLACE(UPPER(TRIM(BOTH '_' FROM
                      REGEXP_REPLACE(ll.src_source_table,'[[:space:]/.-]+','_'))),'_{2,}','_')
          WHERE  ll.data_source = :ds AND ll.dwh_target_table = :t
            AND  ll.dwh_target_column = :c
        ) l""", p)
    contract = _safe("""
        SELECT c.* FROM legacy_src_column c
        WHERE  c.data_source = :ds
          AND  NVL(c.src_col_norm, c.src_source_column) IN (
                 SELECT {CANON_CF} FROM sei_verify
                 WHERE data_source = :ds AND dwh_target_table = :t
                   AND dwh_target_column = :c)""".replace(
        "{CANON_CF}", _canon("contract_field")), p)
    maps = _safe("""
        SELECT m.* FROM sei_source_map m
        WHERE  m.data_source = :ds
          AND  NVL(m.src_col_norm, m.src_source_column) IN (
                 SELECT {CANON_CF} FROM sei_verify
                 WHERE data_source = :ds AND dwh_target_table = :t
                   AND dwh_target_column = :c)
        ORDER BY m.composite_group NULLS FIRST, m.sei_datapoint""".replace(
        "{CANON_CF}", _canon("contract_field")), p)
    # Collapse: the same SEI datapoint standing in for other contract fields.
    collapse = _safe("""
        SELECT DISTINCT m2.sei_feed, m2.sei_datapoint, m2.src_source_column AS other_field
        FROM   sei_source_map m2
        WHERE  m2.data_source = :ds
          AND (m2.sei_feed, m2.sei_datapoint) IN (
                 SELECT m.sei_feed, m.sei_datapoint FROM sei_source_map m
                 WHERE m.data_source = :ds
                   AND NVL(m.src_col_norm, m.src_source_column) IN (
                     SELECT {CANON_CF} FROM sei_verify
                     WHERE data_source = :ds AND dwh_target_table = :t
                       AND dwh_target_column = :c))
        ORDER BY m2.sei_datapoint, m2.src_source_column""".replace(
        "{CANON_CF}", _canon("contract_field")), p)
    dual = _safe("""
        SELECT * FROM sei_dual_source
        WHERE data_source = :ds AND dwh_target_table = :t AND dwh_target_column = :c""", p)
    disp = _safe("""
        SELECT * FROM sei_disposition
        WHERE dwh_target_table = :t AND dwh_target_column = :c""",
        {"t": table, "c": column})
    return {"table": table, "column": column, "data_source": ds,
            "verdicts": verdicts, "chain": chain, "contract": contract,
            "maps": maps, "collapse": collapse, "dual_source": dual,
            "disposition": disp}


@router.get("/divergence")
def divergence(data_source: str | None = None):
    """The six shapes, with their counts, plus the named instances."""
    ds = _ds(data_source)

    def n(sql, extra=None):
        r = _safe(sql, {"ds": ds, **(extra or {})})
        return int((r[0].get("n") if r else 0) or 0)

    shapes = [
        {"key": "collapse", "label": "Collapse",
         "n": n("""SELECT COUNT(*) AS n FROM sei_verify
                   WHERE data_source = :ds AND failed_checks LIKE '%COLLAPSE%'"""),
         "owner": "SEI design team + BBH mapping"},
        {"key": "dual_source", "label": "Dual source",
         "n": n("SELECT COUNT(*) AS n FROM sei_dual_source WHERE data_source = :ds"),
         "owner": "IMDS data owner"},
        {"key": "bypass", "label": "Contract bypass",
         "n": n("""SELECT COUNT(*) AS n FROM sei_verify
                   WHERE data_source = :ds AND failed_checks LIKE '%BYPASSES_CONTRACT%'"""),
         "owner": "Architecture"},
        {"key": "decode", "label": "Decode gap",
         "n": n("""SELECT COUNT(*) AS n FROM sei_verify
                   WHERE data_source = :ds AND match_verdict = 'DECODE_NEEDED'"""),
         "owner": "SEI design team + STAR owner"},
        {"key": "feed_dependency", "label": "Feed dependency",
         "n": n("""SELECT COUNT(*) AS n FROM sei_verify
                   WHERE data_source = :ds AND failed_checks LIKE '%FEED_DEPENDENCY%'"""),
         "owner": "BBH mapping"},
        {"key": "no_source", "label": "No source",
         "n": n("""SELECT COUNT(*) AS n FROM sei_verify
                   WHERE data_source = :ds AND match_verdict = 'NO_SOURCE'"""),
         "owner": "IMDS data owner"},
    ]

    # Named collapse instances: one SEI datapoint, several contract fields.
    collapse = _safe("""
        SELECT sei_feed, sei_datapoint, COUNT(DISTINCT src_source_column) AS fields,
               LISTAGG(DISTINCT src_source_column, ' | ')
                 WITHIN GROUP (ORDER BY src_source_column) AS field_list
        FROM   sei_source_map
        WHERE  data_source = :ds AND sei_datapoint IS NOT NULL
        GROUP BY sei_feed, sei_datapoint
        HAVING COUNT(DISTINCT src_source_column) > 1
        ORDER BY fields DESC""", {"ds": ds})
    dual = _safe("""
        SELECT dwh_target_table, dwh_target_column, lanes, precedence_rule, owner
        FROM   sei_dual_source WHERE data_source = :ds
        ORDER  BY dwh_target_table, dwh_target_column""", {"ds": ds})
    return {"shapes": shapes, "collapse": collapse, "dual_source": dual}


@router.get("/readiness")
def readiness(data_source: str | None = None):
    ds = _ds(data_source)
    rows = _safe("""
        SELECT v.dwh_target_table, v.lane_id, v.match_verdict, COUNT(*) AS n,
               MAX(NVL(lz.replacement_state,'REPLACED')) AS replacement_state
        FROM   sei_verify v
        LEFT JOIN legacy_lane lz ON lz.lane_id = v.lane_id
        WHERE  v.data_source = :ds
        GROUP BY v.dwh_target_table, v.lane_id, v.match_verdict
        ORDER BY v.dwh_target_table""", {"ds": ds})
    tbl = {}
    for r in rows:
        t = tbl.setdefault(r["dwh_target_table"], {"table": r["dwh_target_table"],
                                                   "lanes": set(), "verdicts": {}, "columns": 0})
        t["lanes"].add(r.get("lane_id"))
        t["verdicts"][r.get("match_verdict")] = t["verdicts"].get(r.get("match_verdict"), 0) + int(r["n"] or 0)
        t["columns"] += int(r["n"] or 0)
    out = []
    for t in tbl.values():
        v = t["verdicts"]
        all_oos = set(v) == {"OUT_OF_SCOPE"}
        out.append({
            "table": t["table"], "lanes": sorted(x for x in t["lanes"] if x),
            "columns": t["columns"],
            "verdicts": [{"verdict": k, "n": v[k]} for k in VERDICT_ORDER if k in v],
            "gate": "OUT_OF_SCOPE" if all_oos else
                    ("READY" if v.get("PROVEN_MATCH", 0) == t["columns"] else "BLOCKED"),
        })
    return {"tables": sorted(out, key=lambda x: x["table"])}


@router.get("/exceptions")
def exceptions(data_source: str | None = None, limit: int = 200):
    ds = _ds(data_source)
    rows = _safe(f"""
        SELECT sheet_name, row_key, column_name, issue, why_unresolved,
               who_can_answer, suggested_question
        FROM   sei_exception WHERE data_source = :ds
        ORDER  BY who_can_answer, sheet_name
        FETCH FIRST {int(limit)} ROWS ONLY""", {"ds": ds})
    by = {}
    for r in rows:
        by.setdefault(r.get("who_can_answer") or "UNKNOWN", []).append(r)
    return {"exceptions": rows,
            "by_owner": [{"owner": k, "n": len(v)} for k, v in sorted(by.items())]}
