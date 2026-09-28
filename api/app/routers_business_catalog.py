"""What each warehouse table IS, in business words.

The Business view could only ever show DIM_ACCOUNT because nothing in the
catalogue said what a warehouse TABLE is for. LEGACY_DICTIONARY describes a
SOURCE FIELD; FUNCTIONAL_GROUP groups a LINEAGE ROW; the level in between
had no home. BUSINESS_CATALOG is that level, loaded from the TABLE CATALOG
sheet of the dictionary workbook by the legacy_dictionary step.

IT NEVER OWNS THE GROUPING. FUNCTIONAL_GROUP is the workbook's own answer
and wins wherever it has one; SUGGESTED_GROUP is read only where a table has
none, and /tables says which of the two answered per row so the UI can label
a fallback as a fallback.

/health exists because the failure this router is most likely to hit is not
an exception — it is an empty table, and an empty table looks exactly like a
working screen with old content on it. It reports whether the table exists,
how many rows it holds, and how much of the warehouse it covers, so "I ran
the load and nothing changed" has an answer that is not a guess.
"""
from __future__ import annotations
import logging
from fastapi import APIRouter

from ._legacy_compat import _safe

log = logging.getLogger("cp.api.business_catalog")
router = APIRouter(prefix="/business-catalog", tags=["business-catalog"])

_DS = "PBDW"
# NULL counts as belonging to the warehouse, the same rule
# /legacy-lineage/tables uses. Scoping two ways is what emptied the Business
# view once already.
_IN_DS = "(data_source = :ds OR data_source IS NULL)"


def _ds(v):
    return (v or _DS).upper()


def _one(sql, params):
    r = _safe(sql, params)
    try:
        return int((r[0].get("n") if r else 0) or 0)
    except Exception:                                         # noqa: BLE001
        return 0


def _exists(table):
    rows = _safe("SELECT column_name FROM user_tab_columns WHERE table_name = :t",
                 {"t": table.upper()})
    if not rows:
        rows = _safe("""SELECT DISTINCT column_name FROM all_tab_columns
                        WHERE table_name = :t""", {"t": table.upper()})
    return bool(rows)


@router.get("/health")
def health(data_source: str | None = None):
    """Did the load actually land? Answer in one call.

    Three states the UI and a person need to tell apart, which an empty
    payload cannot: the table is not there (sql/60 never ran), the table is
    there and empty (the sheet was not found, or the ingest did not reach
    it), and the table has rows but they do not match the warehouse's tables
    (a name mismatch, so every lookup misses).
    """
    ds = _ds(data_source)
    if not _exists("BUSINESS_CATALOG"):
        return {"data_source": ds, "ok": False, "table_exists": False, "rows": 0,
                "reason": "BUSINESS_CATALOG does not exist. Run "
                          "sql/60_business_catalog.sql — it creates the table, "
                          "and 61 and 62 do nothing without it."}

    rows = _one(f"SELECT COUNT(*) AS n FROM business_catalog WHERE {_IN_DS}", {"ds": ds})
    if not rows:
        return {"data_source": ds, "ok": False, "table_exists": True, "rows": 0,
                "reason": "BUSINESS_CATALOG is empty for this warehouse. Either "
                          "the TABLE CATALOG sheet was not found in the workbook "
                          "(the ingest logs 'table descriptions' when it is), or "
                          "sql/61 was run before sql/60 and every MERGE failed."}

    matched = _one(f"""
        SELECT COUNT(DISTINCT c.table_name) AS n
        FROM   business_catalog c
        WHERE  {_IN_DS}
          AND  c.table_name IN (SELECT DISTINCT UPPER(dwh_target_table)
                                FROM legacy_lineage
                                WHERE (data_source = :ds OR data_source IS NULL))""",
        {"ds": ds})
    in_lineage = _one("""
        SELECT COUNT(DISTINCT UPPER(dwh_target_table)) AS n FROM legacy_lineage
        WHERE (data_source = :ds OR data_source IS NULL)
          AND dwh_target_table IS NOT NULL""", {"ds": ds})
    reviewed = _one(f"""SELECT COUNT(*) AS n FROM business_catalog
                        WHERE {_IN_DS} AND UPPER(NVL(review_status,'DRAFT')) <> 'DRAFT'""",
                    {"ds": ds})
    low = _one(f"""SELECT COUNT(*) AS n FROM business_catalog
                   WHERE {_IN_DS} AND LOWER(NVL(confidence,'med')) = 'low'""",
               {"ds": ds})
    missing = _safe("""
        SELECT DISTINCT UPPER(l.dwh_target_table) AS table_name
        FROM   legacy_lineage l
        WHERE  (l.data_source = :ds OR l.data_source IS NULL)
          AND  l.dwh_target_table IS NOT NULL
          AND  UPPER(l.dwh_target_table) NOT IN (
                 SELECT table_name FROM business_catalog
                 WHERE (data_source = :ds OR data_source IS NULL))
        ORDER  BY 1 FETCH FIRST 25 ROWS ONLY""", {"ds": ds})

    ok = matched > 0
    return {
        "data_source": ds, "ok": ok, "table_exists": True,
        "rows": rows, "matched_to_lineage": matched,
        "tables_in_lineage": in_lineage,
        "coverage_pct": round((matched / in_lineage) * 100) if in_lineage else 0,
        "reviewed": reviewed, "draft": rows - reviewed, "low_confidence": low,
        "unmatched_sample": [r.get("table_name") for r in missing],
        "reason": None if ok else
                  (f"{rows} catalogue rows, but none of them names a table that "
                   f"appears in the lineage. The names do not line up — check "
                   f"the Table column in the sheet against "
                   f"LEGACY_LINEAGE.DWH_TARGET_TABLE."),
    }


@router.get("/tables")
def tables(data_source: str | None = None, group: str | None = None):
    """The catalogue, joined to what the lineage says about each table.

    GROUP_SOURCE is part of the contract, not a nicety: a screen that shows a
    fallback grouping without saying so is a screen that quietly disagrees
    with the workbook.
    """
    ds = _ds(data_source)
    if not _exists("BUSINESS_CATALOG"):
        return {"data_source": ds, "tables": [], "count": 0, "ok": False}

    where = ""
    params = {"ds": ds}
    if group:
        where = " AND NVL(g.functional_group, c.suggested_group) = :g "
        params["g"] = group

    rows = _safe(f"""
        WITH g AS (
            SELECT UPPER(dwh_target_table) AS table_name,
                   MAX(functional_group) AS functional_group,
                   COUNT(DISTINCT dwh_target_column) AS field_count
            FROM   legacy_lineage
            WHERE  (data_source = :ds OR data_source IS NULL)
              AND  dwh_target_table IS NOT NULL
            GROUP  BY UPPER(dwh_target_table))
        SELECT c.table_name, c.business_name, c.business_description, c.grain,
               c.suggested_group, g.functional_group,
               NVL(g.functional_group, c.suggested_group) AS group_name,
               CASE WHEN g.functional_group IS NOT NULL THEN 'workbook'
                    ELSE 'catalogue' END AS group_source,
               c.is_history, c.is_staging, c.confidence,
               NVL(c.review_status,'DRAFT') AS review_status, c.reviewed_by,
               NVL(g.field_count, 0) AS field_count
        FROM   business_catalog c
        LEFT   JOIN g ON g.table_name = c.table_name
        WHERE  (c.data_source = :ds OR c.data_source IS NULL) {where}
        ORDER  BY NVL(g.functional_group, c.suggested_group),
                  NVL(c.business_name, c.table_name)""", params)

    return {"data_source": ds, "tables": rows, "count": len(rows), "ok": bool(rows)}


@router.get("/table")
def table(table_name: str, data_source: str | None = None):
    """One table's business description, for the page header."""
    ds = _ds(data_source)
    if not _exists("BUSINESS_CATALOG"):
        return {"table_name": table_name, "found": False, "entry": None}
    rows = _safe("""
        SELECT table_name, business_name, business_description, grain,
               suggested_group, is_history, is_staging, confidence,
               NVL(review_status,'DRAFT') AS review_status, reviewed_by
        FROM   business_catalog
        WHERE  (data_source = :ds OR data_source IS NULL)
          AND  table_name = UPPER(TRIM(:t))
        FETCH  FIRST 1 ROWS ONLY""", {"ds": ds, "t": table_name})
    return {"table_name": table_name, "found": bool(rows),
            "entry": rows[0] if rows else None}


@router.get("/groups")
def groups(data_source: str | None = None):
    """Groups with a business count, for the landing screen.

    Counted from the workbook's FUNCTIONAL_GROUP where it has one, so the
    landing screen agrees with every other screen that groups by it.
    """
    ds = _ds(data_source)
    rows = _safe("""
        WITH t AS (
            SELECT UPPER(dwh_target_table) AS table_name,
                   MAX(functional_group) AS functional_group,
                   COUNT(DISTINCT dwh_target_column) AS field_count
            FROM   legacy_lineage
            WHERE  (data_source = :ds OR data_source IS NULL)
              AND  dwh_target_table IS NOT NULL
            GROUP  BY UPPER(dwh_target_table))
        SELECT NVL(t.functional_group, NVL(c.suggested_group, 'Ungrouped')) AS group_name,
               COUNT(DISTINCT t.table_name) AS table_count,
               SUM(t.field_count) AS field_count,
               SUM(CASE WHEN c.business_name IS NOT NULL THEN 1 ELSE 0 END) AS described,
               SUM(CASE WHEN NVL(c.is_staging,'N') = 'Y' THEN 1 ELSE 0 END) AS staging,
               SUM(CASE WHEN NVL(c.is_history,'N') = 'Y' THEN 1 ELSE 0 END) AS history
        FROM   t
        LEFT   JOIN business_catalog c
               ON c.table_name = t.table_name
              AND (c.data_source = :ds OR c.data_source IS NULL)
        GROUP  BY NVL(t.functional_group, NVL(c.suggested_group, 'Ungrouped'))
        ORDER  BY COUNT(DISTINCT t.table_name) DESC""", {"ds": ds})
    return {"data_source": ds, "groups": rows, "count": len(rows)}
