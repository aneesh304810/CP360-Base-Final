"""
reference_legacy.py — Non-SEI (legacy) datapoint reference endpoints for Datapoint 360.

Mirrors the contract of /api/reference/datapoint (SEI side) but sources from
SILVER.LEGACY_DICTIONARY + SILVER.LEGACY_LINEAGE.

Endpoints:
  GET /api/reference/legacy-datapoint?system=ADDVANTAGE&q=acc&pii_only=false
  GET /api/reference/legacy-datapoint/{name}?system=ADDVANTAGE
  GET /api/reference/legacy-datapoint-summary?system=ADDVANTAGE

Integration:
  In app/main.py (or wherever routers are registered):
      from app.routers import reference_legacy
      app.include_router(reference_legacy.router, prefix="/api")

  ADJUST the `get_conn` import below to match the existing DB dependency used
  by the other routers (e.g. app.db, app.deps, app.database).
"""

from fastapi import APIRouter, Depends, HTTPException, Query

# --- ADJUST THIS IMPORT to your existing connection dependency -------------
# It must yield an oracledb / cx_Oracle connection, same as your other routers.
from app.db import get_conn  # noqa: F401
# ---------------------------------------------------------------------------

router = APIRouter(tags=["reference-legacy"])

VALID_SYSTEMS = {"ADDVANTAGE", "CRD", "STAR"}


def _validate_system(system: str) -> str:
    s = (system or "").strip().upper()
    if s not in VALID_SYSTEMS:
        raise HTTPException(status_code=400, detail=f"Unknown legacy system: {system}")
    return s


def _rows_to_dicts(cursor):
    cols = [c[0].lower() for c in cursor.description]
    out = []
    for row in cursor.fetchall():
        rec = {}
        for k, v in zip(cols, row):
            # Oracle CLOBs -> str
            if hasattr(v, "read"):
                v = v.read()
            rec[k] = v
        out.append(rec)
    return out


# ---------------------------------------------------------------------------
# LIST — one card per normalized field code (collapses dictionary duplicates)
# ---------------------------------------------------------------------------
LIST_SQL = """
SELECT
    d.field_code_norm                                        AS normalized,
    MAX(d.field_code)                                        AS datapoint,
    COUNT(DISTINCT l.dwh_target_table)                       AS module_count,
    COUNT(l.lineage_id)                                      AS occurrences,
    COUNT(DISTINCT d.dict_key)                               AS dict_entries,
    MAX(d.business_term)                                     AS business_term,
    MAX(d.data_type)                                         AS data_type,
    MAX(d.max_length)                                        AS max_length,
    MAX(CASE WHEN d.is_pii = 'Y' THEN 'Y' ELSE NULL END)     AS is_pii,
    MAX(d.privacy_class)                                     AS privacy_class,
    MAX(d.regulatory_class)                                  AS regulatory_class,
    MAX(CASE WHEN d.short_desc IS NOT NULL
              OR d.business_term IS NOT NULL THEN 'Y' END)   AS has_definition
FROM silver.legacy_dictionary d
LEFT JOIN silver.legacy_lineage l
       ON UPPER(l.dwh_target_column) = UPPER(d.field_code_norm)
WHERE UPPER(d.source_system) = :system
  AND (:q IS NULL OR UPPER(d.field_code_norm) LIKE '%' || UPPER(:q) || '%'
                  OR UPPER(d.business_term)   LIKE '%' || UPPER(:q) || '%')
GROUP BY d.field_code_norm
{pii_clause}
ORDER BY occurrences DESC, d.field_code_norm
FETCH FIRST :max_rows ROWS ONLY
"""


@router.get("/reference/legacy-datapoint")
def list_legacy_datapoints(
    system: str = Query(...),
    q: str | None = Query(default=None),
    pii_only: bool = Query(default=False),
    max_rows: int = Query(default=500, le=5000),
    conn=Depends(get_conn),
):
    sys_ = _validate_system(system)
    pii_clause = (
        "HAVING MAX(CASE WHEN d.is_pii = 'Y' THEN 'Y' ELSE NULL END) = 'Y'"
        if pii_only
        else ""
    )
    sql = LIST_SQL.format(pii_clause=pii_clause)
    cur = conn.cursor()
    try:
        cur.execute(sql, {"system": sys_, "q": q, "max_rows": max_rows})
        items = _rows_to_dicts(cur)
    finally:
        cur.close()
    return {"system": sys_, "count": len(items), "items": items}


# ---------------------------------------------------------------------------
# DETAIL — lineage-driven: every physical table/column carrying this field,
# dictionary LEFT-joined so undefined fields still render.
# ---------------------------------------------------------------------------
DETAIL_OCCURRENCES_SQL = """
SELECT
    l.dwh_target_table,
    l.dwh_target_column,
    l.dwh_type,
    l.dwh_length,
    l.dwh_precision,
    l.functional_group,
    l.table_type,
    l.lineage_status,
    l.stg2_source_table,
    l.stg2_source_column,
    l.stg1_source_table,
    l.stg1_source_column,
    l.src_source_table,
    l.src_source_column
FROM silver.legacy_lineage l
WHERE UPPER(l.dwh_target_column) = UPPER(:name)
ORDER BY l.dwh_target_table
"""

# Dictionary side pre-deduped: one row per (field_code_norm, master_name),
# newest UPDATED_AT wins. Multi-master entries are returned as a list so the
# UI can show them as sub-sections instead of duplicating field rows.
DETAIL_DEFINITIONS_SQL = """
SELECT master_name, asset_name, business_term, business_function,
       data_type, max_length, num_precision, date_format,
       is_required, is_unique, short_desc, long_desc,
       pb_field_mapping, privacy_class, regulatory_class,
       operational_class, status, is_pii, updated_at
FROM (
    SELECT d.*,
           ROW_NUMBER() OVER (
               PARTITION BY d.field_code_norm, NVL(d.master_name, '~')
               ORDER BY d.updated_at DESC NULLS LAST
           ) rn
    FROM silver.legacy_dictionary d
    WHERE UPPER(d.source_system) = :system
      AND UPPER(d.field_code_norm) = UPPER(:name)
)
WHERE rn = 1
ORDER BY master_name NULLS LAST
"""


@router.get("/reference/legacy-datapoint/{name}")
def legacy_datapoint_detail(
    name: str,
    system: str = Query(...),
    conn=Depends(get_conn),
):
    sys_ = _validate_system(system)
    cur = conn.cursor()
    try:
        cur.execute(DETAIL_OCCURRENCES_SQL, {"name": name})
        occurrences = _rows_to_dicts(cur)

        cur.execute(DETAIL_DEFINITIONS_SQL, {"system": sys_, "name": name})
        definitions = _rows_to_dicts(cur)
    finally:
        cur.close()

    if not occurrences and not definitions:
        raise HTTPException(status_code=404, detail=f"No legacy datapoint: {name}")

    return {
        "system": sys_,
        "normalized": name.lower(),
        "datapoint": name.upper(),
        "module_count": len({o["dwh_target_table"] for o in occurrences}),
        "occurrence_count": len(occurrences),
        "occurrences": occurrences,
        "definitions": definitions,
    }


# ---------------------------------------------------------------------------
# SUMMARY — powers the header cards on the Non-SEI tab (replaces the
# Inbound/Outbound feed cards that only make sense for SEI).
# ---------------------------------------------------------------------------
SUMMARY_SQL = """
SELECT
    (SELECT COUNT(DISTINCT field_code_norm)
       FROM silver.legacy_dictionary
      WHERE UPPER(source_system) = :system)                       AS distinct_fields,
    (SELECT COUNT(*)
       FROM silver.legacy_dictionary
      WHERE UPPER(source_system) = :system)                       AS dict_rows,
    (SELECT COUNT(DISTINCT field_code_norm)
       FROM silver.legacy_dictionary
      WHERE UPPER(source_system) = :system
        AND (short_desc IS NOT NULL OR business_term IS NOT NULL)) AS defined_fields,
    (SELECT COUNT(DISTINCT field_code_norm)
       FROM silver.legacy_dictionary
      WHERE UPPER(source_system) = :system AND is_pii = 'Y')      AS pii_fields,
    (SELECT COUNT(DISTINCT dwh_target_table)
       FROM silver.legacy_lineage)                                AS lineage_tables
FROM dual
"""


@router.get("/reference/legacy-datapoint-summary")
def legacy_datapoint_summary(system: str = Query(...), conn=Depends(get_conn)):
    sys_ = _validate_system(system)
    cur = conn.cursor()
    try:
        cur.execute(SUMMARY_SQL, {"system": sys_})
        row = _rows_to_dicts(cur)[0]
    finally:
        cur.close()
    return {"system": sys_, **row}
