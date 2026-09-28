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
import re
from fastapi import APIRouter

from pydantic import BaseModel

from ._legacy_compat import _safe, _norm_code
from .db import execute as _execute

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

    LineageHome's badges came from /legacy-lineage/systems, which takes no
    data_source and returns the same three everywhere — which is why IMDS
    offered AddVantage and defaulted to it.

    FOUR SIGNALS, UNIONED, not a fallback chain. Each one can be silently
    absent for a system that genuinely feeds the warehouse, and the first two
    versions of this endpoint each trusted one of them alone:

      A. the declared lane. SEI_VERIFY carries LANE_ID on every row and
         LEGACY_LANE maps a lane to its source system, so UAF_IMDS -> UAF
         with no inference. But VERIFY only lists columns someone verified;
         a lane that is entirely out of SEI scope may have no rows there at
         all, and UAF is exactly that lane.

      B. the feed key. LEGACY_LINEAGE joined to LEGACY_SOURCE_FILE through
         the normalised source-table name. This carries column counts for
         warehouses with no crosswalk loaded (PBDW), but it only survives if
         a message is named identically in LANE_LINEAGE and in its feed
         sheet. A UAF message named two ways lands in the unattributed
         bucket, and STAR resolving fine made that miss invisible.

      C. the feed register itself. A feed row loaded for this warehouse and
         tagged with a source system means that system feeds it, whatever
         the lineage rows are called. No column count, but presence is the
         question the badge row asks.

      D. the lane register on its own, for a warehouse whose lanes are
         declared before any feed or verify row has arrived.

    A system appears if ANY signal finds it; its column count is the largest
    any signal can prove. SEI is excluded throughout: it is the scope, not
    one of the incumbent systems the badges select between.

    `resolved` distinguishes "asked and the answer is none" from "could not
    ask". An empty list is never permission to show everything.
    """
    ds = _ds(data_source)
    found: dict[str, int] = {}
    unresolved = 0
    total = 0
    routes: list[str] = []

    def take(rows, route, count_unattributed=False):
        nonlocal unresolved, total
        hit = False
        for r in rows:
            sysname = (r.get("source_system") or "?").strip().upper()
            n = int(r.get("columns_") or 0)
            if count_unattributed:
                total += n
            if sysname in ("", "?"):
                if count_unattributed:
                    unresolved += n
                continue
            if sysname == "SEI":
                continue
            found[sysname] = max(found.get(sysname, 0), n)
            hit = True
        if hit:
            routes.append(route)

    # A. the lane the workbook declared
    take(_safe("""
        SELECT n.source_system AS source_system,
               COUNT(DISTINCT v.dwh_target_table || '.' || v.dwh_target_column) AS columns_
        FROM   sei_verify v
        JOIN   legacy_lane n ON n.lane_id = v.lane_id
        WHERE  v.data_source = :ds
          AND  n.source_system IS NOT NULL
        GROUP  BY n.source_system""", {"ds": ds}), "lane_register")

    # B. the feed key round trip — the only route that counts lineage columns
    take(_safe("""
        SELECT NVL(f.source_system, '?') AS source_system,
               COUNT(DISTINCT l.dwh_target_table || '.' || l.dwh_target_column) AS columns_
        FROM   legacy_lineage l
        LEFT JOIN legacy_source_file f
               ON f.data_source  = l.data_source
              AND f.src_file_key = REGEXP_REPLACE(UPPER(TRIM('_' FROM
                    REGEXP_REPLACE(l.src_source_table,'[[:space:]/.-]+','_'))),'_{2,}','_')
        WHERE  l.data_source = :ds
        GROUP  BY NVL(f.source_system, '?')""", {"ds": ds}),
        "feed_key", count_unattributed=True)

    # C. the feed register — presence without a count
    take(_safe("""
        SELECT source_system AS source_system, 0 AS columns_
        FROM   legacy_source_file
        WHERE  data_source = :ds AND source_system IS NOT NULL
        GROUP  BY source_system""", {"ds": ds}), "feed_register")

    # D. the lane register itself, for a warehouse whose lanes are declared
    #    but whose feeds and verify rows are both still to come
    take(_safe("""
        SELECT source_system AS source_system, 0 AS columns_
        FROM   legacy_lane
        WHERE  data_source = :ds AND source_system IS NOT NULL""",
        {"ds": ds}), "lane_declared")

    systems = [{"source_system": k, "columns_": v}
               for k, v in sorted(found.items(), key=lambda kv: (-kv[1], kv[0]))]
    return {
        "data_source": ds,
        "systems": systems,
        "route": "+".join(routes) or "none",
        "unresolved_columns": unresolved,
        "total_columns": total,
        "resolved": bool(systems),
        "hint": ("no lane could be attributed to a source system; check "
                 "LANE_REGISTER.SOURCE_SYSTEM and legacy_source_file"
                 if total and not systems else None),
    }


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
    rows double-counts a fan-in.

    THE VERDICT TRAVELS WITH THE LINK. A flow diagram that draws every ribbon
    the same colour says only that mappings exist, which nobody doubted. The
    left links are grouped by verdict as well, so the ribbon into a contract
    feed splits into a proven band, an unknown band and a no-source band —
    and "no SEI source" stops being one node among several and becomes the
    width of the problem.

    Bypass links come back separately because they are not part of the
    three-column topology: they skip the contract feed entirely, so they
    cannot be laid out between column one and column two. Drawn as a dashed
    arc over the middle, which is what makes them findable.
    """
    ds = _ds(data_source)
    scoped = ("v.lane_id IN (SELECT lane_id FROM legacy_lane "
              "WHERE data_source = :ds AND replacement_state = 'REPLACED')")
    left = _safe("""
        SELECT NVL(m.sei_feed, 'no SEI source') AS src,
               NVL(v.contract_feed, 'unmapped')  AS mid,
               NVL(v.match_verdict, 'UNKNOWN')   AS verdict,
               COUNT(DISTINCT v.dwh_target_table || '.' || v.dwh_target_column) AS n
        FROM   sei_verify v
        LEFT JOIN sei_source_map m
               ON m.data_source = v.data_source
              AND NVL(m.src_col_norm, m.src_source_column) = {CANON_CF}
        WHERE  v.data_source = :ds
          AND  {SCOPED}
        GROUP BY NVL(m.sei_feed, 'no SEI source'), NVL(v.contract_feed, 'unmapped'),
                 NVL(v.match_verdict, 'UNKNOWN')
    """.replace("{CANON_CF}", _canon("v.contract_field")).replace("{SCOPED}", scoped),
        {"ds": ds})
    right = _safe("""
        SELECT NVL(v.contract_feed, 'unmapped') AS mid, v.dwh_target_table AS tgt,
               COUNT(DISTINCT v.dwh_target_column) AS n
        FROM   sei_verify v
        WHERE  v.data_source = :ds
          AND  {SCOPED}
        GROUP BY NVL(v.contract_feed, 'unmapped'), v.dwh_target_table
    """.replace("{SCOPED}", scoped), {"ds": ds})

    # The contract bypass: SEI proposed straight into the warehouse column.
    # FAILED_CHECKS is pipe-separated, so the test is a substring one.
    bypass = _safe("""
        SELECT NVL(m.sei_feed, 'SEI') AS src, v.dwh_target_table AS tgt,
               COUNT(DISTINCT v.dwh_target_table || '.' || v.dwh_target_column) AS n
        FROM   sei_verify v
        LEFT JOIN sei_source_map m
               ON m.data_source = v.data_source
              AND NVL(m.src_col_norm, m.src_source_column) = {CANON_CF}
        WHERE  v.data_source = :ds
          AND  {SCOPED}
          AND  INSTR(NVL(v.failed_checks, ' '), 'BYPASSES_CONTRACT') > 0
        GROUP BY NVL(m.sei_feed, 'SEI'), v.dwh_target_table
    """.replace("{CANON_CF}", _canon("v.contract_field")).replace("{SCOPED}", scoped),
        {"ds": ds})
    return {"left": left, "right": right, "bypass": bypass}


@router.get("/evidence")
def evidence(data_source: str | None = None):
    """Why nothing is proven — read off the data rather than asserted.

    A PROVEN_MATCH needs schema evidence on BOTH sides, and the summary's
    single ceiling line only ever looked at one of them. This returns each
    side separately, because they are cleared by different people holding
    different artefacts: an ALL_TAB_COLUMNS extract from the warehouse DBA, a
    copybook from the feed owner, a typed interface spec from SEI. Told as
    one number, the work looks like one task; it is four, and they can run in
    parallel.

    Every figure here is a count from these tables. Nothing is prose about
    the general case.
    """
    ds = _ds(data_source)
    STRONG = "('LIVE_DDL','COPYBOOK','FEED_WORKBOOK')"

    def one(sql, params=None):
        # Bind :ds ONLY where the statement actually references it. Oracle
        # rejects a bind the SQL does not use (ORA-01036), _safe swallows the
        # failure and returns [], and the row would read zero rather than
        # error — so the code-set and identifier rows, whose tables carry no
        # data_source at all, would silently report nothing loaded.
        p = dict(params or {})
        if ":ds" in sql:
            p["ds"] = ds
        r = _safe(sql, p)
        return int((r[0] or {}).get("n") or 0) if r else 0

    def row(key, label, have_n, of_n, unit, detail, clears):
        of_n, have_n = int(of_n or 0), int(have_n or 0)
        return {"key": key, "label": label, "have": have_n, "of": of_n,
                "pct": round((have_n / of_n) * 100) if of_n else 0,
                "unit": unit, "detail": detail, "clears": clears,
                "state": ("ok" if of_n and have_n == of_n
                          else "partial" if have_n else "none")}

    # 1. the warehouse target side
    tgt_of = one("SELECT COUNT(*) AS n FROM sei_verify WHERE data_source = :ds")
    tgt_ok = one(f"""SELECT COUNT(*) AS n FROM sei_verify
                     WHERE data_source = :ds AND evidence_right IN {STRONG}""")
    kinds = _safe("""SELECT DISTINCT evidence_right AS e FROM sei_verify
                     WHERE data_source = :ds AND evidence_right IS NOT NULL""",
                  {"ds": ds})
    tgt_kinds = sorted({(r.get("e") or "").upper() for r in kinds} - {""})

    # 2. the contract field side
    cf_of = one("SELECT COUNT(*) AS n FROM legacy_src_column WHERE data_source = :ds")
    cf_ok = one(f"""SELECT COUNT(*) AS n FROM legacy_src_column
                    WHERE data_source = :ds AND evidence IN {STRONG}""")
    cf_typed = one("""SELECT COUNT(*) AS n FROM legacy_src_column
                      WHERE data_source = :ds AND src_type IS NOT NULL
                        AND UPPER(src_type) <> 'UNKNOWN'""")

    # 3. the SEI datapoint side
    sei_of = one("SELECT COUNT(*) AS n FROM sei_source_map WHERE data_source = :ds")
    sei_typed = one("""SELECT COUNT(*) AS n FROM sei_source_map
                       WHERE data_source = :ds AND sei_type IS NOT NULL
                         AND UPPER(sei_type) <> 'UNKNOWN'""")
    sei_feeds = one("""SELECT COUNT(DISTINCT sei_feed) AS n FROM sei_source_map
                       WHERE data_source = :ds AND sei_feed IS NOT NULL""")

    # 4. code sets. SEI_CODE_SET has no data_source: it is global reference
    #    data, so scoping it by warehouse would return nothing.
    cs_domains = one("""SELECT COUNT(DISTINCT code_set_name) AS n
                        FROM sei_code_set WHERE code_set_name IS NOT NULL""")
    cs_values = one("""SELECT COUNT(*) AS n FROM sei_code_set
                       WHERE code_value IS NOT NULL""")
    cs_mapped = one("""SELECT COUNT(*) AS n FROM sei_code_set
                       WHERE code_value IS NOT NULL AND maps_to_code IS NOT NULL""")
    cs_needed = one("""SELECT COUNT(DISTINCT code_set_name) AS n
                       FROM legacy_src_column
                       WHERE data_source = :ds AND code_set_name IS NOT NULL""")

    # 5. identifier crosswalk
    id_of = one("SELECT COUNT(*) AS n FROM sei_identifier_xwalk")
    id_ok = one("""SELECT COUNT(*) AS n FROM sei_identifier_xwalk
                   WHERE resolution_rule IS NOT NULL
                     AND authoritative_side IS NOT NULL""")

    rows = [
        row("target", "Warehouse target", tgt_ok, tgt_of, "columns",
            ((f"Target types come from "
              f"{', '.join(k.replace('_', ' ').lower() for k in tgt_kinds)}.")
             if tgt_kinds else "No evidence is recorded on the target side.")
            + (" A dictionary describes the schema; it is not the schema, so "
               "no row can be called proven while it is the source."
               if "DOCUMENT" in tgt_kinds else ""),
            "One ALL_TAB_COLUMNS extract for the warehouse. It lifts the "
            "ceiling for every mapped column at once."),
        row("contract", "Contract field", cf_ok, cf_of, "fields",
            f"{cf_typed} of {cf_of} contract fields carry a type at all."
            + (" Where no layout was supplied the type is inferred from the "
               "target column it feeds — the single assumption the whole "
               "check rests on." if cf_ok < cf_of else ""),
            "The feed's copybook or interface specification, from the team "
            "that produces it."),
        row("sei", "SEI datapoint", sei_typed, sei_of, "datapoints",
            f"{sei_feeds} SEI feeds are mapped."
            + (" The feed workbook names datapoints and omits their type, "
               "length and scale, so the left-hand side of every comparison "
               "is empty." if sei_of and not sei_typed else ""),
            "A typed interface specification from SEI. A name on its own "
            "cannot be compared to anything."),
        row("codeset", "Code sets", cs_mapped, cs_values or cs_needed, "values",
            f"{cs_domains} domains named, {cs_values} member values loaded, "
            f"{cs_mapped} with an incumbent equivalent. {cs_needed} distinct "
            f"code sets are referenced by contract fields in this warehouse."
            + (" Domain names without member values decode nothing."
               if cs_domains and not cs_values else ""),
            "Both sides' member values, and an explicit decision for every "
            "value with no equivalent."),
        row("identifier", "Identifier crosswalk", id_ok, id_of, "entities",
            f"{id_of} entities crosswalked, {id_ok} carrying both a "
            "resolution rule and an authoritative side. An identifier that "
            "can be matched several ways is undecided until precedence is "
            "written down.",
            "A precedence rule per entity, naming which identifier wins and "
            "in what context."),
    ]
    short = [r for r in rows if r["state"] != "ok"]
    return {"data_source": ds, "rows": rows,
            "blocked": len(short), "of": len(rows),
            "headline": (f"Both sides of a match need schema evidence. "
                         f"{len(short)} of {len(rows)} are short."
                         if short else "Every side has schema evidence.")}


@router.get("/waffle")
def waffle(data_source: str | None = None, limit_tables: int = 40):
    """Every final column as one cell, grouped by warehouse table, in column
    order.

    The verdict spread says 29 columns have no source. The waffle says WHERE
    they are — and an unbroken run through the middle of one table is a
    different finding from 29 scattered misses. It is one coherent gap with
    one owner, and only the arrangement shows it.

    Column order is the table's own, so a run is real adjacency rather than
    an artefact of sorting by verdict.
    """
    ds = _ds(data_source)
    rows = _safe("""
        SELECT v.dwh_target_table AS tbl, v.dwh_target_column AS col,
               NVL(v.match_verdict, 'UNKNOWN') AS verdict,
               NVL(n.source_system, '?') AS lane
        FROM   sei_verify v
        LEFT   JOIN legacy_lane n ON n.lane_id = v.lane_id
        WHERE  v.data_source = :ds
        ORDER  BY v.dwh_target_table, NVL(n.source_system, '?'),
                  v.dwh_target_column""", {"ds": ds})
    # Grouped by (table, lane), not by table. A table written by two lanes is
    # two rows of cells, because that is the finding: the same table half
    # replaced and half not reads very differently from one solid block.
    out: list[dict] = []
    seen: dict[tuple, dict] = {}
    for r in rows:
        tbl = r.get("tbl") or "(unnamed)"
        lane = r.get("lane") or "?"
        t = seen.get((tbl, lane))
        if t is None:
            t = {"table": tbl, "lane": lane, "cells": []}
            seen[(tbl, lane)] = t
            out.append(t)
        t["cells"].append({"c": r.get("col"), "v": r.get("verdict")})
    out.sort(key=lambda x: -len(x["cells"]))
    return {"data_source": ds, "tables": out[:limit_tables],
            "table_count": len(out),
            "cells": sum(len(t["cells"]) for t in out)}


@router.get("/columns")
def columns(data_source: str | None = None, verdict: str | None = None,
            lane: str | None = None, group: str | None = None,
            table: str | None = None, feed: str | None = None,
            sei_feed: str | None = None, limit: int = 500):
    """The drill list. Every filter the dashboard can hand down.

    `feed` and `sei_feed` exist so a click on the ribbon diagram lands on
    exactly the columns that ribbon is made of. Without them a selection
    could only ever drill by verdict, which is a different and much coarser
    set: "the 29 columns with no SEI source" against "the 20 of them that
    land in STARACCT".

    `sei_feed` is not a column on SEI_VERIFY — it lives on SEI_SOURCE_MAP,
    reached through the canonicalised contract field, and the sentinel
    'no SEI source' means the absence of a map row rather than a value. So
    it is an EXISTS test, negated for the sentinel. That negation is the
    whole reason the widest ribbon on the diagram is clickable at all.
    """
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
    if feed:
        # 'unmapped' is the flow diagram's label for a null contract feed
        if feed.lower() == "unmapped":
            where.append("contract_feed IS NULL")
        else:
            where.append("contract_feed = :f"); p["f"] = feed
    if sei_feed:
        exists = f"""EXISTS (
            SELECT 1 FROM sei_source_map m
            WHERE  m.data_source = sei_verify.data_source
              AND  NVL(m.src_col_norm, {_canon('m.src_source_column')})
                 = {_canon('sei_verify.contract_field')}
              {{FEED}})"""
        if sei_feed == "no SEI source":
            where.append("NOT " + exists.replace("{FEED}", ""))
        else:
            where.append(exists.replace("{FEED}", "AND m.sei_feed = :sf"))
            p["sf"] = sei_feed
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
            "disposition": disp,
            # The logic, beside the shape. A column can pass every format
            # check and still compute a different number.
            "transformation": _safe("""
                SELECT x.legacy_transformation_id, x.sei_transformation_id,
                       x.transformation_equivalence, x.transformation_approval,
                       x.transformation_evidence, x.sei_source_objects,
                       x.sei_source_fields, x.dwh_nullable, x.dwh_pk_flag,
                       lg.transformation_logic AS legacy_logic,
                       lg.transformation_type  AS legacy_kind,
                       lg.null_handling        AS legacy_null_handling,
                       se.transformation_logic AS sei_logic,
                       se.transformation_type  AS sei_kind,
                       se.status               AS sei_status
                FROM   legacy_lineage_xform x
                LEFT   JOIN sei_transformation lg
                       ON lg.transformation_id = x.legacy_transformation_id
                LEFT   JOIN sei_transformation se
                       ON se.transformation_id = x.sei_transformation_id
                WHERE  x.data_source = :ds
                  AND  x.dwh_target_table = :t AND x.dwh_target_column = :c""",
                {"ds": ds, "t": table, "c": column}),
            "compare": _safe("""
                SELECT comparison_id, equivalence, evidence_completeness,
                       approval_status, review_note, imds_logic, sei_logic,
                       sei_source_objects, sei_source_fields
                FROM   sei_transformation_compare
                WHERE  data_source = :ds AND target_object = :t
                  AND  target_attribute = :c""",
                {"ds": ds, "t": table, "c": column}),
            # The published STAR layout for the contract field, if one
            # arrived. This is what lifts a row off ASSUMED evidence.
            "star_layout": _safe(f"""
                SELECT s.feed_family, s.field_name, s.published_type,
                       s.published_length, s.published_format, s.description,
                       s.evidence_status, s.source_document
                FROM   star_layout_field s
                WHERE  s.data_source = :ds
                  AND  s.field_norm IN (
                        SELECT {_canon('v.contract_field')} FROM sei_verify v
                        WHERE v.data_source = :ds
                          AND v.dwh_target_table = :t
                          AND v.dwh_target_column = :c)""",
                {"ds": ds, "t": table, "c": column})}


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


@router.get("/lane-scope")
def lane_scope(system: str, data_source: str | None = None):
    """What belongs to ONE lane: its source files and its warehouse tables.

    This is what makes the STAR/UAF badge do something. Before it, selecting
    a system changed the spine's first two labels and nothing else — the file
    list, the table list and every count stayed whole-warehouse, so STAR and
    UAF showed the same 137 files and switching between them looked broken
    because it was.

    Two routes, best first, and the second is why the first exists:

      1. LEGACY_LINEAGE_LANE, written from LANE_LINEAGE.LANE_ID at ingest.
         Exact, because the workbook declared it.
      2. the feed-key round trip, for a warehouse loaded before sql/55. It
         normalises SRC_SOURCE_TABLE and joins LEGACY_SOURCE_FILE, which
         holds for STAR and breaks for UAF whenever the same message is
         named two ways.

    `resolved` is the contract with the UI: false means this question could
    not be answered for this lane, and the caller must show the unfiltered
    view rather than an empty one. Filtering a screen down to nothing on the
    strength of a join that failed is worse than not filtering at all.
    """
    ds = _ds(data_source)
    sysname = (system or "").strip().upper()
    if not sysname:
        return {"data_source": ds, "source_system": None, "resolved": False,
                "route": "none", "src_tables": [], "target_tables": [],
                "columns": 0, "hint": "no system given"}

    route = "lineage_lane"
    rows = _safe("""
        SELECT src_source_table, dwh_target_table,
               COUNT(DISTINCT dwh_target_table || '.' || dwh_target_column) AS columns_
        FROM   legacy_lineage_lane
        WHERE  data_source = :ds AND UPPER(source_system) = :sys
        GROUP  BY src_source_table, dwh_target_table""",
        {"ds": ds, "sys": sysname})

    if not rows:
        route = "feed_key"
        rows = _safe("""
            SELECT l.src_source_table, l.dwh_target_table,
                   COUNT(DISTINCT l.dwh_target_table || '.' || l.dwh_target_column) AS columns_
            FROM   legacy_lineage l
            JOIN   legacy_source_file f
                   ON f.data_source  = l.data_source
                  AND f.src_file_key = REGEXP_REPLACE(UPPER(TRIM('_' FROM
                        REGEXP_REPLACE(l.src_source_table,'[[:space:]/.-]+','_'))),'_{2,}','_')
            WHERE  l.data_source = :ds AND UPPER(f.source_system) = :sys
            GROUP  BY l.src_source_table, l.dwh_target_table""",
            {"ds": ds, "sys": sysname})

    src = sorted({(r.get("src_source_table") or "") for r in rows} - {""})
    tgt = sorted({(r.get("dwh_target_table") or "") for r in rows} - {""})
    cols = sum(int(r.get("columns_") or 0) for r in rows)
    return {
        "data_source": ds,
        "source_system": sysname,
        "resolved": bool(src or tgt),
        "route": route if (src or tgt) else "none",
        "src_tables": src,
        "target_tables": tgt,
        "columns": cols,
        "hint": (f"no lineage row could be attributed to {sysname}; run "
                 f"sql/55_lineage_lane.sql and re-ingest so LANE_ID is recorded"
                 if not (src or tgt) else None),
    }


@router.get("/transformations")
def transformations(data_source: str | None = None, limit: int = 200):
    """Does the SEI rule COMPUTE the same value the legacy rule computes?

    A different question from every other endpoint here, and a later one. A
    column can pass the format check completely — same type, same length,
    same scale, both sides from live DDL — and still be wrong, because the
    legacy rule sums at lot grain and the proposed rule sums at position
    grain. That is a wrong number rather than a missing one, and none of the
    nine verdicts can say it: they compare shapes.

    TWO AXES, KEPT APART ON PURPOSE. Equivalence is a finding about the
    logic; approval is a finding about who has looked at it. An EXACT_TEXT
    match that is still DRAFT_REVIEW_REQUIRED is not ready to ship, and a
    single "transformation status" column would have said it was.
    """
    ds = _ds(data_source)
    equiv = _safe("""
        SELECT NVL(equivalence,'(not classified)') AS equivalence, COUNT(*) AS n
        FROM   sei_transformation_compare WHERE data_source = :ds
        GROUP  BY equivalence ORDER BY 2 DESC""", {"ds": ds})
    appr = _safe("""
        SELECT NVL(approval_status,'(none)') AS approval_status, COUNT(*) AS n
        FROM   sei_transformation_compare WHERE data_source = :ds
        GROUP  BY approval_status ORDER BY 2 DESC""", {"ds": ds})
    layers = _safe("""
        SELECT NVL(transformation_layer,'(none)') AS layer,
               NVL(transformation_type,'(none)')  AS kind, COUNT(*) AS n
        FROM   sei_transformation WHERE data_source = :ds
        GROUP  BY transformation_layer, transformation_type ORDER BY 3 DESC""",
        {"ds": ds})
    rows = _safe(f"""
        SELECT comparison_id, target_object, target_attribute, target_type,
               legacy_transformation_id, sei_transformation_id,
               equivalence, evidence_completeness, approval_status,
               review_note, sei_source_objects, sei_source_fields
        FROM   sei_transformation_compare WHERE data_source = :ds
        ORDER  BY CASE NVL(equivalence,'ZZ')
                    WHEN 'NO_SEI_SOURCE' THEN 1
                    WHEN 'REQUIRES_BUSINESS_DECISION' THEN 2
                    WHEN 'LEGACY_LOGIC_NOT_DOCUMENTED' THEN 3
                    WHEN 'SEI_SOURCE_IDENTIFIED_LOGIC_INCOMPLETE' THEN 4
                    WHEN 'UNVERIFIED_COMPARISON' THEN 5
                    WHEN 'EXACT_TEXT' THEN 6 ELSE 7 END,
                 target_object, target_attribute
        FETCH FIRST {int(limit)} ROWS ONLY""", {"ds": ds})

    def one(sql):
        r = _safe(sql, {"ds": ds})
        return int((r[0] or {}).get("n") or 0) if r else 0

    total = one("SELECT COUNT(*) AS n FROM sei_transformation_compare WHERE data_source = :ds")
    approved = one("""SELECT COUNT(*) AS n FROM sei_transformation_compare
                      WHERE data_source = :ds
                        AND UPPER(NVL(approval_status,'')) LIKE 'APPROVED%'""")
    exact = one("""SELECT COUNT(*) AS n FROM sei_transformation_compare
                   WHERE data_source = :ds AND equivalence = 'EXACT_TEXT'""")
    nosrc = one("""SELECT COUNT(*) AS n FROM sei_transformation_compare
                   WHERE data_source = :ds AND equivalence = 'NO_SEI_SOURCE'""")
    return {"data_source": ds, "total": total, "approved": approved,
            "exact_text": exact, "no_sei_source": nosrc,
            "equivalence": equiv, "approval": appr, "layers": layers,
            "rows": rows,
            "headline": (f"{approved} of {total} transformations approved."
                         if total else "No transformation comparison loaded.")}


@router.get("/controls")
def controls(data_source: str | None = None):
    """_MANIFEST, FINAL_VERIFICATION and TRANSFORMATION_SUMMARY — the
    workbook's own account of what it does and does not establish.

    Worth surfacing rather than recomputing: these are the author's stated
    limitations, and a screen that silently recomputes past them presents
    inferences as findings.
    """
    ds = _ds(data_source)
    rows = _safe("""
        SELECT source_sheet, control_name, result, status, detail, seq
        FROM   sei_control WHERE data_source = :ds
        ORDER  BY source_sheet, seq""", {"ds": ds})
    out: dict[str, list] = {}
    for r in rows:
        out.setdefault(r.get("source_sheet") or "?", []).append(r)
    blocked = [r for r in rows
               if str(r.get("status") or "").upper() in ("BLOCKED", "PARTIAL", "DRAFT")]
    return {"data_source": ds, "sheets": out, "count": len(rows),
            "blocked": blocked[:20], "blocked_count": len(blocked)}


@router.get("/feed-names")
def feed_names(data_source: str | None = None):
    """Feed code -> what the feed actually is.

    Three screens list feeds by an eight-character code with an identical
    heading above each — "STAR outbound dataset" three times, over
    PEDDIFI1, TBMEIFI7 and ACDDIFI1. Only someone who already knows the
    estate can tell those apart, which makes the screen useless to exactly
    the people it was built for.

    Resolution order, strongest first:

      1. FEED_ALIAS.BUSINESS_NAME — the register, seeded from the delivery
         folder the feeds are published from.
      2. LEGACY_SOURCE_FILE.DATASET, but only when it is a name rather than
         a classification. "STAR outbound dataset" repeated across every
         feed is a category, and showing it as a name is what produced the
         three identical headings.
      3. nothing — the caller shows the code alone, which is honest.

    `unnamed` lists the loaded feeds with no name at all, so the gap is a
    number on a screen rather than something you notice by squinting at a
    list. `orphans` is the reverse: names registered for a feed that never
    arrived, which usually means the workbook is missing a feed the
    business publishes.
    """
    ds = _ds(data_source)
    # A dataset value shared by several feeds is a classification, not a
    # name. Two is enough to establish that: one feed legitimately has one
    # dataset, and the same string over two feeds names neither.
    generic = {
        (r.get("dataset") or "").strip().upper()
        for r in _safe("""
            SELECT dataset, COUNT(*) AS n FROM legacy_source_file
            WHERE data_source = :ds AND dataset IS NOT NULL
            GROUP BY dataset HAVING COUNT(*) > 1""", {"ds": ds})
    } - {""}

    rows = _safe("""
        SELECT f.src_file, f.src_file_key, f.dataset, f.source_system,
               a.business_name, a.source AS name_source, a.notes
        FROM   legacy_source_file f
        LEFT   JOIN feed_alias a
               ON a.data_source = f.data_source AND a.feed_key = f.src_file_key
        WHERE  f.data_source = :ds
        ORDER  BY f.src_file""", {"ds": ds})

    out, unnamed = [], []
    for r in rows:
        code = r.get("src_file")
        ds_val = (r.get("dataset") or "").strip()
        name = r.get("business_name")
        src = r.get("name_source")
        if not name and ds_val and ds_val.upper() not in generic:
            name, src = ds_val, "DATASET"
        if not name:
            unnamed.append(code)
        out.append({"code": code, "key": r.get("src_file_key"),
                    "name": name, "name_source": src,
                    "source_system": r.get("source_system"),
                    "notes": r.get("notes")})

    orphans = _safe("""
        SELECT a.feed_code, a.business_name, a.notes
        FROM   feed_alias a
        LEFT   JOIN legacy_source_file f
               ON f.data_source = a.data_source AND f.src_file_key = a.feed_key
        WHERE  a.data_source = :ds AND f.src_file IS NULL""", {"ds": ds})

    return {"data_source": ds, "feeds": out, "count": len(out),
            "unnamed": unnamed, "unnamed_count": len(unnamed),
            "orphans": orphans,
            "generic_datasets": sorted(generic)}


@router.get("/field-definition")
def field_definition(code: str, data_source: str | None = None,
                     src_table: str | None = None):
    """What a source column MEANS — from whichever dictionary has it.

    The screens said "No dictionary entry — this source column is not an
    AddVantage field code. The dictionary covers the AddVantage master
    workbook only." That was true when AddVantage was the only incumbent.
    On a STAR column it is both wrong and unhelpful: it names a system
    that has nothing to do with the lane, and it tells the reader to wait
    for a workbook that has in fact already arrived.

    Four dictionaries are loaded now and the message knew about one:

      legacy_dictionary    AddVantage, CRD and STAR master definitions
      star_layout_field    434 published STAR fields, with descriptions
      sei_input_lineage    950 SEI catalogue fields, with definitions
      uaf_field_schema     197 UAF fields, with published attributes

    All four are searched on the canonical code, strongest first, and the
    answer says which one answered. `searched` lists every source tried
    with whether it holds anything at all for this warehouse, so "not
    found" can be told apart from "that dictionary is not loaded" — the
    two need completely different actions and the old message conflated
    them.
    """
    ds = _ds(data_source)
    norm = _norm_code(code or "")
    if not norm:
        return {"code": code, "definition": None, "source": None, "searched": []}

    found = None

    rows = _safe("""
        SELECT source_system, field_code, master_name, business_term,
               business_function, short_desc, long_desc, is_pii, is_required
        FROM   legacy_dictionary WHERE field_code_norm = :c
        ORDER  BY source_system FETCH FIRST 1 ROWS ONLY""", {"c": norm})
    if rows:
        r = rows[0]
        found = {"source": "legacy_dictionary",
                 "source_label": f"{r.get('source_system')} dictionary",
                 "term": r.get("business_term") or r.get("field_code"),
                 "description": r.get("long_desc") or r.get("short_desc"),
                 "master": r.get("master_name"),
                 "function": r.get("business_function"),
                 "is_pii": r.get("is_pii"), "is_required": r.get("is_required")}

    if not found:
        rows = _safe("""
            SELECT feed_family, field_name, published_type, published_length,
                   published_format, description, evidence_status, source_document
            FROM   star_layout_field
            WHERE  data_source = :ds AND field_norm = :c
            ORDER  BY feed_family FETCH FIRST 1 ROWS ONLY""",
            {"ds": ds, "c": norm})
        if rows:
            r = rows[0]
            found = {"source": "star_layout_field",
                     "source_label": f"STAR published layout · {r.get('feed_family')}",
                     "term": r.get("field_name"),
                     "description": r.get("description"),
                     "type": r.get("published_type"),
                     "length": r.get("published_length"),
                     "format": r.get("published_format"),
                     "evidence": r.get("evidence_status"),
                     "source_doc": r.get("source_document")}

    if not found:
        rows = _safe("""
            SELECT sei_target_file, sei_field, published_type, published_length,
                   field_definition, validation_rule, record_scope
            FROM   sei_input_lineage
            WHERE  data_source = :ds AND sei_field_norm = :c
            ORDER  BY sei_target_file FETCH FIRST 1 ROWS ONLY""",
            {"ds": ds, "c": norm})
        if rows:
            r = rows[0]
            found = {"source": "sei_input_lineage",
                     "source_label": f"SEI input catalogue · {r.get('sei_target_file')}",
                     "term": r.get("sei_field"),
                     "description": r.get("field_definition"),
                     "type": r.get("published_type"),
                     "length": r.get("published_length"),
                     "validation": r.get("validation_rule"),
                     "scope": r.get("record_scope"),
                     # An inbound field is not thereby on the outbound
                     # interface. Saying so here stops the definition being
                     # read as availability.
                     "caveat": "SEI's INBOUND catalogue. A field loaded into "
                               "SEI is not thereby exposed on the outbound "
                               "interface the contract needs."}

    if not found:
        rows = _safe("""
            SELECT uaf_feed, record_type, source_field, published_type,
                   published_length, imds_target, transformation
            FROM   uaf_field_schema
            WHERE  data_source = :ds AND source_field_norm = :c
            ORDER  BY uaf_feed FETCH FIRST 1 ROWS ONLY""",
            {"ds": ds, "c": norm})
        if rows:
            r = rows[0]
            found = {"source": "uaf_field_schema",
                     "source_label": f"UAF layout · {r.get('uaf_feed')}"
                                     f" · {r.get('record_type')}",
                     "term": r.get("source_field"),
                     "description": r.get("imds_target"),
                     "type": r.get("published_type"),
                     "length": r.get("published_length"),
                     "rule": r.get("transformation")}

    if not found:
        rows = _safe("""
            SELECT src_source_column, src_type, src_length, src_description,
                   unit_of_measure, currency_basis, code_set_name
            FROM   legacy_src_column
            WHERE  data_source = :ds AND src_col_norm = :c
            FETCH FIRST 1 ROWS ONLY""", {"ds": ds, "c": norm})
        if rows and (rows[0].get("src_description") or rows[0].get("src_type")):
            r = rows[0]
            found = {"source": "legacy_src_column",
                     "source_label": "contract field metadata",
                     "term": r.get("src_source_column"),
                     "description": r.get("src_description"),
                     "type": r.get("src_type"), "length": r.get("src_length"),
                     "unit": r.get("unit_of_measure"),
                     "currency": r.get("currency_basis"),
                     "code_set": r.get("code_set_name")}

    def loaded(sql, params=None):
        r = _safe(sql, {"ds": ds, **(params or {})})
        return int((r[0] or {}).get("n") or 0) if r else 0

    searched = [
        {"source": "legacy_dictionary", "label": "AddVantage / CRD / STAR master",
         "rows": loaded("SELECT COUNT(*) AS n FROM legacy_dictionary")},
        {"source": "star_layout_field", "label": "STAR published layouts",
         "rows": loaded("SELECT COUNT(*) AS n FROM star_layout_field WHERE data_source = :ds")},
        {"source": "sei_input_lineage", "label": "SEI input catalogue",
         "rows": loaded("SELECT COUNT(*) AS n FROM sei_input_lineage WHERE data_source = :ds")},
        {"source": "uaf_field_schema", "label": "UAF layouts",
         "rows": loaded("SELECT COUNT(*) AS n FROM uaf_field_schema WHERE data_source = :ds")},
        {"source": "legacy_src_column", "label": "contract field metadata",
         "rows": loaded("SELECT COUNT(*) AS n FROM legacy_src_column WHERE data_source = :ds")},
    ]
    return {"code": code, "code_norm": norm, "data_source": ds,
            "definition": found, "source": (found or {}).get("source"),
            "searched": searched,
            "empty_sources": [x["label"] for x in searched if not x["rows"]]}


@router.get("/column-chain")
def column_chain(table: str, column: str, data_source: str | None = None):
    """The whole chain for one warehouse column, both eras, with the rule
    on every hop.

    WHERE THE TRANSFORMATION RULES BELONG. They were nowhere: the column
    graph drew SOURCE -> LANDING -> CONFORMED -> WAREHOUSE as four boxes
    and three arrows, and the arrows were blank. The expression that turns
    one box into the next is the only thing on that picture that can be
    wrong in an interesting way, and it was the one thing not drawn.

    So the hop carries its rule. Three hops, three expressions, straight
    off LEGACY_LINEAGE where they have been all along.

    The SEI side is a SECOND TRACK UNDER THE SAME CHAIN rather than a
    separate screen, because the question is a comparison and a comparison
    needs both halves in one eye-span. It lands at the contract field, not
    at the warehouse column: SEI replaces the front of the chain and the
    existing pipeline carries it from there, and drawing it as a parallel
    line to the warehouse would assert an architecture nobody proposed.
    """
    ds = _ds(data_source)
    legacy = _safe("""
        SELECT l.src_source_table, l.src_source_column, l.src_type, l.src_length,
               l.src_to_stg1_transform,
               l.stg1_source_table, l.stg1_source_column, l.stg1_type,
               l.stg1_to_stg2_transform,
               l.stg2_source_table, l.stg2_source_column, l.stg2_type,
               l.stg2_to_dwh_transform,
               l.dwh_target_table, l.dwh_target_column, l.dwh_type,
               l.dwh_length, l.dwh_precision, l.lineage_status,
               n.source_system
        FROM   legacy_lineage l
        LEFT   JOIN legacy_lineage_lane n ON n.lineage_id = l.lineage_id
        WHERE  l.data_source = :ds AND l.dwh_target_table = :t
          AND  l.dwh_target_column = :c""", {"ds": ds, "t": table, "c": column})

    sei = _safe(f"""
        SELECT m.sei_feed, m.sei_entity, m.sei_datapoint, m.sei_type,
               m.sei_length, m.sei_scale, m.map_kind, m.composite_group,
               m.composite_role, m.map_rule, m.join_key, m.depends_on_feed,
               m.evidence, m.open_question,
               v.contract_feed, v.contract_field, v.match_verdict,
               v.failed_checks
        FROM   sei_verify v
        LEFT   JOIN sei_source_map m
               ON m.data_source = v.data_source
              AND NVL(m.src_col_norm, {_canon('m.src_source_column')})
                = {_canon('v.contract_field')}
        WHERE  v.data_source = :ds AND v.dwh_target_table = :t
          AND  v.dwh_target_column = :c""", {"ds": ds, "t": table, "c": column})

    xform = _safe("""
        SELECT x.legacy_transformation_id, x.sei_transformation_id,
               x.transformation_equivalence, x.transformation_approval,
               x.sei_equivalent_transformation, x.sei_source_objects,
               x.sei_source_fields, x.transformation_evidence,
               lg.transformation_logic AS legacy_logic,
               lg.transformation_type  AS legacy_kind,
               lg.null_handling        AS legacy_null_handling,
               lg.conditional_logic    AS legacy_conditional,
               se.transformation_logic AS sei_logic,
               se.transformation_type  AS sei_kind,
               se.null_handling        AS sei_null_handling,
               se.status               AS sei_status
        FROM   legacy_lineage_xform x
        LEFT   JOIN sei_transformation lg ON lg.transformation_id = x.legacy_transformation_id
        LEFT   JOIN sei_transformation se ON se.transformation_id = x.sei_transformation_id
        WHERE  x.data_source = :ds AND x.dwh_target_table = :t
          AND  x.dwh_target_column = :c""", {"ds": ds, "t": table, "c": column})

    cmp_ = _safe("""
        SELECT comparison_id, equivalence, evidence_completeness,
               approval_status, review_note, imds_logic, sei_logic,
               sei_source_objects, sei_source_fields
        FROM   sei_transformation_compare
        WHERE  data_source = :ds AND target_object = :t AND target_attribute = :c""",
        {"ds": ds, "t": table, "c": column})

    review = _safe("""
        SELECT verdict, rationale, reviewer,
               TO_CHAR(reviewed_at, 'YYYY-MM-DD HH24:MI') AS reviewed_at,
               workbook_status
        FROM   sei_xform_review
        WHERE  data_source = :ds AND dwh_target_table = :t
          AND  dwh_target_column = :c""", {"ds": ds, "t": table, "c": column})

    return {"data_source": ds, "table": table, "column": column,
            "legacy": legacy, "sei": sei, "xform": xform,
            "compare": cmp_, "review": (review or [None])[0]}


class XformReviewIn(BaseModel):
    data_source: str | None = None
    table: str
    column: str
    verdict: str
    rationale: str | None = None
    reviewer: str | None = None
    comparison_id: str | None = None


@router.post("/xform-review")
def save_xform_review(body: XformReviewIn):
    """Record whether the proposed SEI transformation is correct.

    NOT WRITTEN BACK INTO THE WORKBOOK'S APPROVAL_STATUS, which is an
    input: the loader upserts on COMPARISON_ID and the next ingest would
    erase the decision. The review sits beside it and the API reports
    both, so a reviewer who disagrees with the document produces a visible
    disagreement rather than a silent overwrite.

    A rationale is required for anything but AGREES. A rejection nobody
    can act on is worse than no rejection, because it stops the row and
    names no way forward.
    """
    verdict = (body.verdict or "").strip().upper()
    if verdict not in ("AGREES", "DIFFERS", "CANNOT_TELL", "NEEDS_BUSINESS"):
        return {"ok": False, "error": f"unknown verdict {body.verdict!r}"}
    rationale = (body.rationale or "").strip()
    if verdict != "AGREES" and len(rationale) < 3:
        return {"ok": False,
                "error": "a rationale is required for anything but AGREES — "
                         "a rejection nobody can act on stops the row and "
                         "names no way forward"}
    ds = _ds(body.data_source)
    rid = f"{ds}:{body.table}:{body.column}"
    reviewer = (body.reviewer or "").strip() or "unattributed"

    merge = """
        MERGE INTO sei_xform_review r
        USING (SELECT :rid AS rid FROM dual) x ON (r.review_id = x.rid)
        WHEN MATCHED THEN UPDATE SET
             verdict = :v, rationale = :ra, reviewer = :who,
             reviewed_at = SYSTIMESTAMP, updated_at = SYSTIMESTAMP,
             comparison_id = NVL(:cid, r.comparison_id)
        WHEN NOT MATCHED THEN INSERT
             (review_id, data_source, dwh_target_table, dwh_target_column,
              comparison_id, verdict, rationale, reviewer, workbook_status)
             VALUES (:rid, :ds, :t, :c, :cid, :v, :ra, :who,
               (SELECT MAX(approval_status) FROM sei_transformation_compare
                WHERE data_source = :ds AND target_object = :t
                  AND target_attribute = :c))"""
    # the history, because a decision that changed is worth more than the
    # decision that stands
    logsql = """
        INSERT INTO sei_xform_review_log
          (log_id, review_id, data_source, verdict, rationale, reviewer)
        VALUES (:rid || ':' || TO_CHAR(SYSTIMESTAMP,'YYYYMMDDHH24MISSFF3'),
                :rid, :ds, :v, :ra, :who)"""
    p = {"rid": rid, "ds": ds, "t": body.table, "c": body.column,
         "cid": body.comparison_id, "v": verdict,
         "ra": rationale or None, "who": reviewer}
    plog = {"rid": rid, "ds": ds, "v": verdict, "ra": rationale or None,
            "who": reviewer}
    try:
        # One transaction for both, via the house helper: a merge that
        # lands without its log row would leave a decision with no record
        # of who changed what.
        _execute([(merge, p), (logsql, plog)])
    except Exception as e:                                      # noqa: BLE001
        log.warning("xform review save failed: %s", e)
        return {"ok": False, "error": str(e)[:300]}
    return {"ok": True, "review_id": rid, "verdict": verdict,
            "reviewer": reviewer}


@router.get("/xform-reviews")
def xform_reviews(data_source: str | None = None):
    """Every review, and where a reviewer and the workbook disagree."""
    ds = _ds(data_source)
    by = _safe("""
        SELECT verdict, COUNT(*) AS n FROM sei_xform_review
        WHERE data_source = :ds GROUP BY verdict ORDER BY 2 DESC""", {"ds": ds})
    rows = _safe("""
        SELECT r.dwh_target_table, r.dwh_target_column, r.verdict, r.reviewer,
               r.rationale, TO_CHAR(r.reviewed_at,'YYYY-MM-DD HH24:MI') AS reviewed_at,
               c.approval_status, c.equivalence
        FROM   sei_xform_review r
        LEFT   JOIN sei_transformation_compare c
               ON c.data_source = r.data_source
              AND c.target_object = r.dwh_target_table
              AND c.target_attribute = r.dwh_target_column
        WHERE  r.data_source = :ds
        ORDER  BY r.reviewed_at DESC FETCH FIRST 200 ROWS ONLY""", {"ds": ds})
    disagree = [r for r in rows
                if (r.get("verdict") == "AGREES")
                != str(r.get("approval_status") or "").upper().startswith("APPROVED")]
    return {"data_source": ds, "by_verdict": by, "rows": rows,
            "count": len(rows), "disagreements": disagree,
            "disagreement_count": len(disagree)}


@router.get("/resolve-tokens")
def resolve_tokens(tokens: str, data_source: str | None = None):
    """Turn the identifiers inside a transformation rule back into fields.

    THE NUMERIC SUFFIX IS AN ORDINAL. `Base_Market_Value_10` is field 10
    of the STAR layout, and STAR_LAYOUT_DETAIL carries both ORDINAL and
    FIELD_NAME — so the token is resolvable, and an expression stops being
    an opaque string and becomes navigable.

    THREE CONFIDENCES, AND THE DIFFERENCE MATTERS. When the name matches a
    published field AND that field's ordinal equals the suffix, the
    resolution is confirmed by two independent facts and can be trusted.
    Name alone is likely. Ordinal alone is a guess worth showing and not
    worth relying on — field 10 of the wrong feed is still field 10. The
    UI renders the three differently rather than presenting all of them as
    "resolved", because a confident wrong answer about which field an
    expression reads is worse than no answer.

    `tokens` is comma-separated; the caller sends what its parser found.
    """
    ds = _ds(data_source)
    want = [t.strip() for t in (tokens or "").split(",") if t.strip()][:200]
    if not want:
        return {"data_source": ds, "tokens": [], "resolved": 0}

    rows = _safe("""
        SELECT feed_family, ordinal, field_name, field_norm, published_type,
               published_length, description
        FROM   star_layout_field WHERE data_source = :ds""", {"ds": ds})
    by_norm: dict[str, list] = {}
    by_ord: dict[int, list] = {}
    for r in rows:
        n = (r.get("field_norm") or "").upper()
        if n:
            by_norm.setdefault(n, []).append(r)
        try:
            by_ord.setdefault(int(str(r.get("ordinal")).strip()), []).append(r)
        except (TypeError, ValueError):
            pass

    out = []
    for raw in want:
        m = re.match(r"^(.*?)_(\d{1,4})$", raw)
        base, ordv = (m.group(1), int(m.group(2))) if m else (raw, None)
        cand_n = by_norm.get(_norm_code(base), [])
        cand_o = by_ord.get(ordv, []) if ordv is not None else []
        hit, conf = None, "none"
        both = [r for r in cand_n
                if str(r.get("ordinal")).strip() == str(ordv)] if ordv is not None else []
        if both:
            hit, conf = both[0], "name+ordinal"
        elif cand_n:
            hit, conf = cand_n[0], "name"
        elif cand_o:
            hit, conf = cand_o[0], "ordinal"
        out.append({
            "token": raw, "base": base, "ordinal": ordv, "confidence": conf,
            "field": ({"feed_family": hit.get("feed_family"),
                       "ordinal": hit.get("ordinal"),
                       "field_name": hit.get("field_name"),
                       "type": hit.get("published_type"),
                       "length": hit.get("published_length"),
                       "description": hit.get("description")} if hit else None),
            # a name matching several feeds is itself worth knowing: the
            # expression does not say which feed it reads from
            "ambiguous": len(cand_n) > 1 and conf in ("name", "name+ordinal"),
            "candidates": len(cand_n),
        })
    return {"data_source": ds, "tokens": out,
            "resolved": sum(1 for t in out if t["confidence"] != "none"),
            "confirmed": sum(1 for t in out if t["confidence"] == "name+ordinal"),
            "layout_rows": len(rows)}


@router.get("/catalog")
def catalog(data_source: str | None = None, limit: int = 200):
    """Does the proposed OUTBOUND datapoint appear in SEI's own INBOUND catalog?

    This is a separate signal from the format verdict, deliberately. A field
    loaded into SEI is not thereby exposed on the outbound interface the
    contract needs — the workbook is explicit about that — so a name match
    here is evidence, never proof.

    It is nonetheless the cheapest finding available: a datapoint absent from
    SEI's own catalog may not exist at all, which is worth knowing long before
    anyone compares its type to anything.
    """
    ds = _ds(data_source)
    by = _safe("""
        SELECT NVL(verify_result,'UNKNOWN') AS verify_result, COUNT(*) AS n
        FROM   sei_catalog_verify WHERE data_source = :ds
        GROUP  BY NVL(verify_result,'UNKNOWN') ORDER BY 2 DESC""", {"ds": ds})
    absent = _safe(f"""
        SELECT target_feed, target_field, mapped_sei_datapoint, verify_result, notes
        FROM   sei_catalog_verify
        WHERE  data_source = :ds
          AND (NVL(match_count,0) = 0 OR UPPER(NVL(verify_result,'')) LIKE '%ABSENT%'
               OR UPPER(NVL(verify_result,'')) LIKE '%NOT%FOUND%')
        ORDER  BY target_feed, target_field
        FETCH FIRST {int(limit)} ROWS ONLY""", {"ds": ds})
    ambiguous = _safe("""
        SELECT COUNT(*) AS n FROM sei_catalog_verify
        WHERE data_source = :ds AND NVL(match_count,0) > 1""", {"ds": ds})
    inbound = _safe("""
        SELECT COUNT(*) AS n FROM sei_input_lineage WHERE data_source = :ds""", {"ds": ds})
    total = _safe("""
        SELECT COUNT(*) AS n FROM sei_catalog_verify WHERE data_source = :ds""", {"ds": ds})

    def one(r):
        return int((r[0].get("n") if r else 0) or 0)

    return {"data_source": ds,
            "checked": one(total),
            "inbound_fields": one(inbound),
            "absent_count": len(absent),
            "ambiguous_count": one(ambiguous),
            "by_result": by,
            "absent": absent,
            "caveat": ("A name match between the inbound catalog and a proposed "
                       "outbound datapoint is evidence, not proof: an inbound field "
                       "is not thereby exposed on the outbound interface.")}


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
