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
