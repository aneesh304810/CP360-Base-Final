"""Variance 360 router — composition & stage-variance results + run trigger."""
from __future__ import annotations
import json
import logging

from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel
from .db import query

log = logging.getLogger("cp.api.variance360")
router = APIRouter(prefix="/variance", tags=["variance360"])


def _safe(sql, params=None):
    try:
        return query(sql, params or {})
    except Exception as e:                                     # noqa: BLE001
        log.warning("variance query failed: %s", str(e)[:160])
        return []


@router.get("/sources")
def sources():
    """Data sources present in legacy_lineage + mapping coverage per source."""
    rows = _safe("""
        SELECT NVL(data_source, 'PBDW') AS data_source,
               COUNT(DISTINCT dwh_target_table) AS tables,
               COUNT(*) AS fields,
               SUM(CASE WHEN LOWER(NVL(lineage_status,'x'))
                        IN ('mapped','exists') THEN 1 ELSE 0 END) AS mapped
        FROM legacy_lineage
        GROUP BY NVL(data_source, 'PBDW') ORDER BY 1""")
    return {"sources": rows}


@router.get("/runs")
def runs(data_source: str = "PBDW", limit: int = 20):
    rows = _safe("""
        SELECT run_id, run_type, scope, status, step,
               TO_CHAR(started_at, 'YYYY-MM-DD HH24:MI:SS') AS started_at,
               TO_CHAR(finished_at, 'YYYY-MM-DD HH24:MI:SS') AS finished_at,
               rows_scanned, cols_profiled, sql_hash, error_text
        FROM recon_runs WHERE data_source = :ds
        ORDER BY started_at DESC FETCH FIRST :n ROWS ONLY""",
        {"ds": data_source, "n": limit})
    return {"runs": rows}


@router.get("/run/{run_id}")
def run_status(run_id: str):
    rows = _safe("SELECT * FROM recon_runs WHERE run_id = :r", {"r": run_id})
    return rows[0] if rows else {"status": "UNKNOWN"}


@router.get("/summary")
def summary(data_source: str = "PBDW", run_id: str | None = None):
    """High-variance tables + function rollup for the latest (or given) run."""
    rid = run_id or _latest(data_source, "STAGE")
    tables = []
    if rid:
        tables = _safe("""
            SELECT table_name, functional_group, fields_total, fields_variant,
                   variance_score, worst_hop, breaks_src_stg1, breaks_stg1_stg2,
                   breaks_stg2_dwh, dominant_metric, status
            FROM recon_summary WHERE run_id = :r AND data_source = :ds
            ORDER BY variance_score DESC, table_name""",
            {"r": rid, "ds": data_source})
    if not tables:
        # no stage-variance run yet: list tables from the latest composition
        # run so the Column Composition tab is usable on its own
        rid = run_id or _latest(data_source, "COMPOSITION")
        if not rid:
            return {"run_id": None, "tables": [], "functions": []}
        tables = _safe("""
            SELECT table_name, MAX(stage) KEEP (DENSE_RANK LAST
                     ORDER BY DECODE(stage,'DWH',4,'STG2',3,'STG1',2,1))
                     AS best_stage,
                   COUNT(DISTINCT column_name) AS fields_total,
                   SUM(CASE WHEN risk IS NOT NULL THEN 1 ELSE 0 END)
                     AS fields_variant,
                   NULL AS variance_score, NULL AS worst_hop,
                   0 AS breaks_src_stg1, 0 AS breaks_stg1_stg2,
                   0 AS breaks_stg2_dwh, NULL AS dominant_metric,
                   CASE WHEN SUM(CASE WHEN risk IN ('CAST_UNSAFE',
                        'IDENTIFIER_LEADING_ZERO') THEN 1 ELSE 0 END) > 0
                        THEN 'AMBER' ELSE 'GREEN' END AS status
            FROM recon_dtype_profile
            WHERE run_id = :r AND data_source = :ds
            GROUP BY table_name ORDER BY table_name""",
            {"r": rid, "ds": data_source})
        for t in tables:
            t["functional_group"] = "Composition only (run stage variance "                                     "for scores)"
    fns = {}
    for t in tables:
        g = fns.setdefault(t.get("functional_group") or "Ungrouped",
                           {"fields_total": 0, "fields_variant": 0,
                            "tables": 0, "worst": "GREEN"})
        g["fields_total"] += t.get("fields_total") or 0
        g["fields_variant"] += t.get("fields_variant") or 0
        g["tables"] += 1
        order = {"GREEN": 0, "AMBER": 1, "RED": 2}
        if order.get(t.get("status"), 0) > order.get(g["worst"], 0):
            g["worst"] = t["status"]
    return {"run_id": rid, "tables": tables,
            "functions": [dict(name=k, **v) for k, v in fns.items()]}


@router.get("/composition")
def composition(table: str, data_source: str = "PBDW",
                stage: str = "STG1", run_id: str | None = None):
    """Column composition rows for one stage table (most dangerous first)."""
    rid = run_id or _latest(data_source, "COMPOSITION")
    if not rid:
        return {"run_id": None, "columns": []}
    # UI addresses chains by their DWH target table; composition rows are
    # stored under each stage's physical table name — translate via lineage.
    stage_col = {"SRC": "src_source_table", "STG1": "stg1_source_table",
                 "STG2": "stg2_source_table", "DWH": "dwh_target_table"}\
        .get(stage.upper(), "dwh_target_table")
    phys = _safe(f"""
        SELECT {stage_col} AS t FROM legacy_lineage
        WHERE UPPER(dwh_target_table) = UPPER(:t)
          AND {stage_col} IS NOT NULL
          AND LOWER(NVL(lineage_status,'x')) IN ('mapped','exists')
        GROUP BY {stage_col} ORDER BY COUNT(*) DESC
        FETCH FIRST 1 ROWS ONLY""", {"t": table})
    lookup = phys[0]["t"] if phys else table
    rows = _safe("""
        SELECT column_name, declared_type, inferred_type, conformance_pct,
               mean_val, stddev_val, median_val, min_val, max_val, value_census,
               total_rows, nonnull_rows, pct_decimal, pct_integer, pct_date,
               pct_bool, pct_blank, pct_bad, bad_rows, num_prec_max,
               num_scale_max, max_len, lead_zero_rows, date_mask, risk,
               verdict, samples_json, pii_suppressed
        FROM recon_dtype_profile
        WHERE run_id = :r AND data_source = :ds
          AND UPPER(table_name) = UPPER(:t) AND stage = :st
        ORDER BY CASE NVL(risk, 'zz')
                   WHEN 'CAST_UNSAFE' THEN 0
                   WHEN 'IDENTIFIER_LEADING_ZERO' THEN 1
                   WHEN 'TYPE_DRIFT' THEN 2 ELSE 3 END,
                 conformance_pct, column_name""",
        {"r": rid, "ds": data_source, "t": lookup, "st": stage})
    for r in rows:
        s = r.pop("samples_json", None)
        try:
            payload = json.loads(s.read() if hasattr(s, "read") else s) \
                if s else {}
            if isinstance(payload, list):          # legacy runs: bare samples
                payload = {"samples": payload, "fail_types": {}}
            r["samples"] = payload.get("samples", [])
            r["fail_types"] = payload.get("fail_types", {})
        except Exception:                                      # noqa: BLE001
            r["samples"], r["fail_types"] = [], {}
    return {"run_id": rid, "columns": rows}


@router.get("/field")
def field(lineage_id: str, run_id: str | None = None,
          data_source: str = "PBDW"):
    """All stage metrics for one field + its transform expressions."""
    rid = run_id or _latest(data_source, "STAGE")
    metrics = _safe("""
        SELECT stage, metric, COALESCE(TO_CHAR(value_num), value_str) AS val
        FROM recon_profile WHERE run_id = :r AND lineage_id = :l""",
        {"r": rid, "l": lineage_id})
    chain = _safe("""
        SELECT src_source_table, src_source_column, src_to_stg1_transform,
               stg1_source_table, stg1_source_column, stg1_to_stg2_transform,
               stg2_source_table, stg2_source_column, stg2_to_dwh_transform,
               dwh_target_table, dwh_target_column, functional_group
        FROM legacy_lineage WHERE lineage_id = :l""", {"l": lineage_id})
    return {"run_id": rid, "metrics": metrics,
            "chain": chain[0] if chain else None}


class GenerateReq(BaseModel):
    data_source: str = "PBDW"
    table: str | None = None       # None => all mapped tables
    analysis: str = "BOTH"         # BOTH | COMPOSITION | STAGE
    sample_rows: int = 0           # 0 => full scan


@router.post("/generate")
def generate(req: GenerateReq, bg: BackgroundTasks):
    """Kick off a profiling run in the background; UI polls /run/{id}."""
    import datetime as dt
    run_id = f"V{dt.datetime.now():%Y%m%d_%H%M%S}"
    try:
        from ingestion.variance_engine import run_profile
    except ImportError:                    # engine deployed next to the API
        from .variance_engine import run_profile      # type: ignore
    bg.add_task(run_profile, req.data_source, req.table,
                req.analysis, req.sample_rows, run_id)
    return {"run_id": run_id, "status": "RUNNING"}


@router.get("/coverage")
def coverage(data_source: str = "PBDW"):
    """Lineage status census + physical tables with no lineage."""
    census = _safe("""
        SELECT NVL(TRIM(lineage_status), '(blank)') AS status, COUNT(*) AS cnt
        FROM legacy_lineage WHERE NVL(data_source, 'PBDW') = :ds
        GROUP BY NVL(TRIM(lineage_status), '(blank)') ORDER BY cnt DESC""",
        {"ds": data_source})
    gaps = _safe("""
        SELECT t.table_name FROM all_tables t
        WHERE t.owner = 'PBDWAPP'
          AND t.table_name NOT LIKE 'AUDIT%' AND t.table_name NOT LIKE 'CFG%'
          AND t.table_name NOT LIKE 'TEMP%'  AND t.table_name NOT LIKE 'TMP%'
          AND t.table_name NOT LIKE 'RPT%'   AND t.table_name NOT LIKE '%_HIST'
          AND t.table_name NOT LIKE 'PBDW_ETL%'
          AND NOT EXISTS (SELECT 1 FROM legacy_lineage l
                          WHERE UPPER(l.dwh_target_table) = t.table_name)
        ORDER BY t.table_name""")
    return {"census": census, "gaps": [g["table_name"] for g in gaps]}


@router.get("/clob/tables")
def clob_tables(data_source: str = "PBDW"):
    """Tables that have CLOB inspection results — feeds the CLOB tab's
    table selector independently of variance-summary coverage."""
    rows = _safe("""
        SELECT DISTINCT table_name FROM recon_clob_profile
        WHERE data_source = :ds ORDER BY table_name""",
        {"ds": data_source})
    return {"tables": [r["table_name"] for r in rows]}


@router.get("/clob/columns")
def clob_columns(table: str, data_source: str = "PBDW"):
    """CLOB columns of a table with their latest inspection profile."""
    return {"columns": _safe("""
        SELECT p.column_name, p.blob_count, p.len_min, p.len_max, p.len_mode,
               p.len_uniform_pct, p.truncated_cnt, p.structure, p.spec_fields,
               p.spec_resolved, p.unmapped_regions, p.referenced_by_transform,
               p.run_id
        FROM recon_clob_profile p
        WHERE UPPER(p.table_name) = UPPER(:t) AND p.data_source = :ds
          AND p.run_id = (SELECT MAX(run_id) FROM recon_clob_profile
                          WHERE UPPER(table_name) = UPPER(:t)
                            AND data_source = :ds)
        ORDER BY p.column_name""", {"t": table, "ds": data_source})}


@router.get("/clob/profile")
def clob_profile(table: str, clob: str, data_source: str = "PBDW"):
    """Parsed-field profiles inside one CLOB (latest run)."""
    fields = _safe("""
        SELECT field_name, pos_start, pos_len, target_column, inferred_type,
               conformance_pct, nonnull_rows, total_rows, bad_rows,
               mean_val, stddev_val, date_mask, risk, verdict
        FROM recon_clob_fields
        WHERE UPPER(table_name) = UPPER(:t) AND UPPER(clob_column) = UPPER(:c)
          AND run_id = (SELECT MAX(run_id) FROM recon_clob_fields
                        WHERE UPPER(table_name) = UPPER(:t)
                          AND UPPER(clob_column) = UPPER(:c))
        ORDER BY pos_start""", {"t": table, "c": clob})
    return {"fields": fields}


@router.get("/clob/record")
def clob_record(table: str, clob: str, data_source: str = "PBDW"):
    """One sample record (first 400 chars) for the raw-record viewer.
    Suppressed if any parsed field of this CLOB maps to a PII column."""
    pii = _safe("""
        SELECT COUNT(*) AS n FROM recon_clob_fields f
        JOIN legacy_dictionary d
          ON UPPER(NVL(d.pb_field_mapping, d.field_code_norm))
             = UPPER(f.target_column)
        WHERE UPPER(f.table_name) = UPPER(:t)
          AND UPPER(f.clob_column) = UPPER(:c)
          AND UPPER(NVL(d.is_pii, 'N')) = 'Y'""",
        {"t": table, "c": clob})
    if pii and pii[0]["n"]:
        return {"record": None, "suppressed": True}
    # read via the source connection (lazy import keeps mounting safe)
    try:
        from ingestion.variance_engine import (_source_conn, _qual, _phys,
                                               _col_types)
        conn, own = _source_conn(data_source)
        cur = conn.cursor()
        qtab = _qual(data_source, "STG1", table)
        _col_types(cur, qtab)
        cur.execute(f'SELECT DBMS_LOB.SUBSTR("{clob.upper()}", 400, 1) '
                    f'FROM {_phys(qtab)} WHERE "{clob.upper()}" IS NOT NULL '
                    f'AND ROWNUM = 1')
        row = cur.fetchone()
        if own:
            conn.close()
        return {"record": row[0] if row else None, "suppressed": False}
    except Exception as e:                                  # noqa: BLE001
        return {"record": None, "suppressed": False, "error": str(e)[:200]}


@router.get("/column")
def column_metadata(table: str, column: str, data_source: str = "PBDW",
                    stage: str = "DWH"):
    """Full metadata for one column: physical dictionary + business
    dictionary + lineage chain/transforms + latest profile row."""
    # physical definition (Oracle dictionary on the catalog connection;
    # if stage tables live on another instance this reads the profile row's
    # declared_type instead)
    physical = _safe("""
        SELECT c.data_type, c.data_length, c.data_precision, c.data_scale,
               c.nullable, c.column_id, cc.comments
        FROM all_tab_columns c
        LEFT JOIN all_col_comments cc
          ON cc.owner = c.owner AND cc.table_name = c.table_name
         AND cc.column_name = c.column_name
        WHERE UPPER(c.table_name) = UPPER(:t)
          AND UPPER(c.column_name) = UPPER(:c)""",
        {"t": table, "c": column})

    # business dictionary (legacy_dictionary)
    business = _safe("""
        SELECT dict_key, source_system, field_code, business_term,
               business_function, master_name, data_type AS dict_data_type,
               max_length, num_precision, date_format, is_required,
               is_unique, short_desc, privacy_class, regulatory_class,
               operational_class, status, is_pii
        FROM legacy_dictionary
        WHERE UPPER(NVL(pb_field_mapping, field_code_norm)) = UPPER(:c)
        FETCH FIRST 3 ROWS ONLY""", {"c": column})

    # lineage chain + per-hop transforms for this column
    lineage = _safe("""
        SELECT lineage_id, functional_group, lineage_status,
               src_source_table, src_source_column,
               stg1_source_table, stg1_source_column,
               stg2_source_table, stg2_source_column,
               dwh_target_table, dwh_target_column,
               src_to_stg1_transform, stg1_to_stg2_transform,
               stg2_to_dwh_transform
        FROM legacy_lineage
        WHERE (UPPER(dwh_target_table) = UPPER(:t)
               AND UPPER(dwh_target_column) = UPPER(:c))
           OR (UPPER(stg2_source_table) = UPPER(:t)
               AND UPPER(stg2_source_column) = UPPER(:c))
           OR (UPPER(stg1_source_table) = UPPER(:t)
               AND UPPER(stg1_source_column) = UPPER(:c))""",
        {"t": table, "c": column})

    # latest profile row (composition metadata)
    profile = _safe("""
        SELECT run_id, stage, declared_type, inferred_type, conformance_pct,
               total_rows, nonnull_rows, pct_blank, pct_bad, bad_rows,
               num_prec_max, num_scale_max, max_len, lead_zero_rows,
               date_mask, risk, verdict, pii_suppressed
        FROM recon_dtype_profile
        WHERE UPPER(table_name) = UPPER(:t)
          AND UPPER(column_name) = UPPER(:c)
          AND data_source = :ds AND stage = :st
        ORDER BY run_id DESC FETCH FIRST 1 ROWS ONLY""",
        {"t": table, "c": column, "ds": data_source, "st": stage})

    return {"physical": physical[0] if physical else None,
            "business": business,
            "lineage": lineage,
            "profile": profile[0] if profile else None}


def _latest(data_source: str, kind: str):
    rows = _safe("""
        SELECT run_id FROM recon_runs
        WHERE data_source = :ds AND status = 'COMPLETE'
          AND run_type IN (:k, 'BOTH')
        ORDER BY started_at DESC FETCH FIRST 1 ROWS ONLY""",
        {"ds": data_source, "k": kind})
    return rows[0]["run_id"] if rows else None
