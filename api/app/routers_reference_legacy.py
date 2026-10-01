"""Non-SEI (legacy) datapoint reference endpoints for Datapoint 360.

Mirrors the contract of /reference/datapoint (the SEI side) but sources
from LEGACY_DICTIONARY + LEGACY_LINEAGE.

    GET /reference/legacy-datapoint?system=ADDVANTAGE&q=acc&pii_only=false
    GET /reference/legacy-datapoint/{name}?system=ADDVANTAGE
    GET /reference/legacy-datapoint-summary?system=ADDVANTAGE

THIS ROUTER HAD NEVER LOADED. It shipped as an unadapted template -- its
own docstring still said "ADJUST the get_conn import to match the
existing DB dependency" -- and it imported `get_conn` from app.db, which
has never existed there (db.py exports get_pool, query, execute,
execute_many). So the guarded mount loop in main.py logged one WARNING
among twenty-seven INFO lines and skipped it, every start, in every copy
of this codebase. The three endpoints above have never answered a
request. The SQL was fine; only the wiring was not.

Adapted to the house pattern on four points:

  * `query()` instead of a connection dependency. It already returns
    list[dict] with lower-cased keys and reads CLOBs, which is exactly
    what the template's own _rows_to_dicts was reimplementing.
  * No `silver.` schema prefix. This was the only router that carried
    one; the API connects as the owning schema, and hard-coding it
    breaks any deployment that does not.
  * No `/api` prefix. The template's integration note says to mount with
    prefix="/api", but the UI's API_BASE is already "/api" and the vite
    proxy strips it, so the server paths must not carry it.
  * The optional `q` filter is composed in Python rather than bound as
    `:q IS NULL OR ...`. Oracle cannot always type an untyped NULL bind,
    and a filter that is absent should not be in the statement at all.
  * Plain parameter defaults instead of Query(...), matching the other
    twenty-six routers -- and leaving the functions callable, and so
    testable, outside a request.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from .db import query

log = logging.getLogger("cp.api.reference_legacy")
router = APIRouter(tags=["reference-legacy"])

VALID_SYSTEMS = {"ADDVANTAGE", "CRD", "STAR"}


def _validate_system(system: str) -> str:
    s = (system or "").strip().upper()
    if s not in VALID_SYSTEMS:
        raise HTTPException(400, f"Unknown legacy system: {system}. "
                                 f"Expected one of {', '.join(sorted(VALID_SYSTEMS))}.")
    return s


# ---------------------------------------------------------------------------
# LIST — one card per normalised field code (collapses dictionary duplicates)
# ---------------------------------------------------------------------------
@router.get("/reference/legacy-datapoint")
def list_legacy_datapoints(system: str, q: str | None = None,
                           pii_only: bool = False, max_rows: int = 500):
    sys_ = _validate_system(system)
    # Clamped here rather than declared with Query(le=...), so the function
    # is callable (and testable) outside a request. Every other router in
    # this app takes plain defaults for the same reason.
    params = {"system": sys_, "max_rows": max(1, min(int(max_rows or 500), 5000))}
    where = ["UPPER(d.source_system) = :system"]
    if q and q.strip():
        params["q"] = q.strip().upper()
        where.append("(UPPER(d.field_code_norm) LIKE '%' || :q || '%' "
                     " OR UPPER(d.business_term) LIKE '%' || :q || '%')")
    having = ("HAVING MAX(CASE WHEN d.is_pii = 'Y' THEN 'Y' END) = 'Y'"
              if pii_only else "")
    rows = query(f"""
        SELECT d.field_code_norm                        AS normalized,
               MAX(d.field_code)                        AS datapoint,
               COUNT(DISTINCT l.dwh_target_table)       AS module_count,
               COUNT(l.lineage_id)                      AS occurrences,
               COUNT(DISTINCT d.dict_key)               AS dict_entries,
               MAX(d.business_term)                     AS business_term,
               MAX(d.data_type)                         AS data_type,
               MAX(d.max_length)                        AS max_length,
               MAX(CASE WHEN d.is_pii = 'Y' THEN 'Y' END) AS is_pii,
               MAX(d.privacy_class)                     AS privacy_class,
               MAX(d.regulatory_class)                  AS regulatory_class,
               MAX(CASE WHEN d.short_desc IS NOT NULL
                          OR d.business_term IS NOT NULL THEN 'Y' END) AS has_definition
        FROM   legacy_dictionary d
        LEFT   JOIN legacy_lineage l
               ON UPPER(l.dwh_target_column) = UPPER(d.field_code_norm)
        WHERE  {' AND '.join(where)}
        GROUP  BY d.field_code_norm
        {having}
        ORDER  BY occurrences DESC, d.field_code_norm
        FETCH FIRST :max_rows ROWS ONLY""", params)
    return {"system": sys_, "count": len(rows), "items": rows}


# ---------------------------------------------------------------------------
# DETAIL — lineage-driven: every physical table/column carrying this field,
# with the dictionary LEFT-joined so an undefined field still renders.
# ---------------------------------------------------------------------------
_OCCURRENCES = """
    SELECT l.dwh_target_table, l.dwh_target_column, l.dwh_type, l.dwh_length,
           l.dwh_precision, l.functional_group, l.table_type, l.lineage_status,
           l.stg2_source_table, l.stg2_source_column,
           l.stg1_source_table, l.stg1_source_column,
           l.src_source_table,  l.src_source_column
    FROM   legacy_lineage l
    WHERE  UPPER(l.dwh_target_column) = UPPER(:name)
    ORDER  BY l.dwh_target_table"""

# Pre-deduped: one row per (field_code_norm, master_name), newest wins.
# A field defined under several masters comes back as a list so the UI can
# show them as sub-sections rather than repeating the field.
_DEFINITIONS = """
    SELECT master_name, asset_name, business_term, business_function,
           data_type, max_length, num_precision, date_format,
           is_required, is_unique, short_desc, long_desc,
           pb_field_mapping, privacy_class, regulatory_class,
           operational_class, status, is_pii, updated_at
    FROM (
      SELECT d.*,
             ROW_NUMBER() OVER (
               PARTITION BY d.field_code_norm, NVL(d.master_name, '~')
               ORDER BY d.updated_at DESC NULLS LAST) rn
      FROM   legacy_dictionary d
      WHERE  UPPER(d.source_system) = :system
        AND  UPPER(d.field_code_norm) = UPPER(:name))
    WHERE rn = 1
    ORDER BY master_name NULLS LAST"""


@router.get("/reference/legacy-datapoint/{name}")
def legacy_datapoint_detail(name: str, system: str):
    sys_ = _validate_system(system)
    occurrences = query(_OCCURRENCES, {"name": name})
    definitions = query(_DEFINITIONS, {"system": sys_, "name": name})
    if not occurrences and not definitions:
        raise HTTPException(404, f"No legacy datapoint: {name}")
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
# SUMMARY — the header cards on the Non-SEI tab, replacing the inbound /
# outbound feed cards that only mean something for SEI.
# ---------------------------------------------------------------------------
@router.get("/reference/legacy-datapoint-summary")
def legacy_datapoint_summary(system: str):
    sys_ = _validate_system(system)
    rows = query("""
        SELECT (SELECT COUNT(DISTINCT field_code_norm) FROM legacy_dictionary
                 WHERE UPPER(source_system) = :system)            AS distinct_fields,
               (SELECT COUNT(*) FROM legacy_dictionary
                 WHERE UPPER(source_system) = :system)            AS dict_rows,
               (SELECT COUNT(DISTINCT field_code_norm) FROM legacy_dictionary
                 WHERE UPPER(source_system) = :system
                   AND (short_desc IS NOT NULL
                        OR business_term IS NOT NULL))            AS defined_fields,
               (SELECT COUNT(DISTINCT field_code_norm) FROM legacy_dictionary
                 WHERE UPPER(source_system) = :system
                   AND is_pii = 'Y')                              AS pii_fields,
               (SELECT COUNT(DISTINCT dwh_target_table)
                  FROM legacy_lineage)                            AS lineage_tables
        FROM dual""", {"system": sys_})
    return {"system": sys_, **(rows[0] if rows else {})}
