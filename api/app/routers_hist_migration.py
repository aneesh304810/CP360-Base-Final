"""Data Analysis: the historical data migration sheets, read back.

    GET /hist-migration/summary      counts, the lanes, the artifacts, the latest batch and its rule checks
    GET /hist-migration/lanes        the registered lanes
    GET /hist-migration/artifacts    the source and reference artifacts
    GET /hist-migration/dictionary   the evidence table's column dictionary
    GET /hist-migration/evidence     the evidence, filtered and paged
    GET /hist-migration/row          every cell of one source row, in column order
    GET /hist-migration/batches      every load

Reads cp_hist_* (sql/86), written by ingestion/hist_migration_conn.py. The
evidence values are the analysts' mapping logic as they wrote it; the API
returns them whole, capped at 4000 characters per row on the list route
with a flag, and whole on the row route. A warehouse without sql/86 gets
empty shapes, never a 500.
"""
from __future__ import annotations

import json
import logging

from fastapi import APIRouter

from .db import query

log = logging.getLogger("cp.api.hist_migration")
router = APIRouter(prefix="/hist-migration", tags=["hist-migration"])
LIST_CAP = 4000


def _safe(sql, params=None):
    try:
        return query(sql, params or {})
    except Exception as e:                                   # noqa: BLE001
        log.warning("hist_migration query failed: %s", str(e)[:160])
        return []


def _clob(v):
    try:
        return v.read() if hasattr(v, "read") else (v if v is None else str(v))
    except Exception:                                        # noqa: BLE001
        return None


def _ts(v):
    return v.isoformat(sep=" ", timespec="minutes") if hasattr(v, "isoformat") else (str(v) if v else None)


def _batch(r):
    checks = []
    try:
        checks = json.loads(_clob(r.get("checks")) or "[]")
    except Exception:                                        # noqa: BLE001
        checks = []
    return {"batchId": r.get("batch_id"), "sourceFile": r.get("source_file"), "sourceHash": r.get("source_hash"),
            "lanes": r.get("lanes_n") or 0, "artifacts": r.get("artifacts_n") or 0, "evidence": r.get("evidence_n") or 0,
            "dictionary": r.get("dictionary_n") or 0, "skipped": r.get("skipped_n") or 0, "loadedAt": _ts(r.get("loaded_at")), "checks": checks}


@router.get("/summary")
def summary():
    def n(sql):
        r = _safe(sql)
        return int((r[0] or {}).get("n", 0) or 0) if r else 0
    # Why the tab is empty, when it is: the tables are not there (sql/86 not
    # applied), or they are there and nothing has been loaded.
    reason = None
    try:
        query("SELECT COUNT(*) AS n FROM cp_hist_ingest_batch")
    except Exception as e:                                   # noqa: BLE001
        reason = "no_table" if "ORA-00942" in str(e) else f"error: {str(e)[:120]}"
    latest = _safe("SELECT batch_id, source_file, source_hash, lanes_n, artifacts_n, evidence_n, dictionary_n, skipped_n, checks, loaded_at "
                   "FROM cp_hist_ingest_batch ORDER BY loaded_at DESC FETCH FIRST 1 ROWS ONLY")
    by = lambda col, lim=50: [{"key": r.get("k") or "(blank)", "n": int(r.get("n") or 0), "unresolved": int(r.get("u") or 0)}   # noqa: E731
                              for r in _safe(f"SELECT {col} AS k, COUNT(*) AS n, SUM(CASE WHEN lane_resolved = 'N' THEN 1 ELSE 0 END) AS u "
                                             f"FROM cp_hist_mapping_evidence GROUP BY {col} ORDER BY COUNT(*) DESC FETCH FIRST {lim} ROWS ONLY")]
    sheets = [{"workbook": r.get("w"), "sheet": r.get("s"), "n": int(r.get("n") or 0), "rows": int(r.get("r") or 0)}
              for r in _safe("SELECT source_mapping_workbook AS w, source_mapping_sheet AS s, COUNT(*) AS n, COUNT(DISTINCT source_mapping_row) AS r "
                             "FROM cp_hist_mapping_evidence GROUP BY source_mapping_workbook, source_mapping_sheet ORDER BY COUNT(*) DESC")]
    loaded = n("SELECT COUNT(*) AS n FROM cp_hist_mapping_evidence") > 0
    if reason is None and not loaded:
        reason = "no_rows"
    return {"loaded": loaded, "reason": None if loaded else reason,
            "totals": {"lanes": n("SELECT COUNT(*) AS n FROM cp_hist_migration_lane"),
                       "artifacts": n("SELECT COUNT(*) AS n FROM cp_hist_source_artifact"),
                       "evidence": n("SELECT COUNT(*) AS n FROM cp_hist_mapping_evidence"),
                       "dictionary": n("SELECT COUNT(*) AS n FROM cp_hist_header_dictionary"),
                       "sourceRows": n("SELECT COUNT(DISTINCT source_mapping_workbook || '|' || source_mapping_sheet || '|' || source_mapping_row) AS n FROM cp_hist_mapping_evidence"),
                       "unresolvedLanes": n("SELECT COUNT(*) AS n FROM cp_hist_mapping_evidence WHERE lane_resolved = 'N'")},
            "byLane": by("historical_migration_lane"), "byDomain": by("historical_migration_domain"),
            "bySourceSystem": by("historical_source_system"), "byCategory": by("evidence_category"),
            "byAttribute": by("evidence_attribute", 60), "bySheet": sheets,
            "latest": _batch(latest[0]) if latest else None}


@router.get("/lanes")
def lanes():
    return {"lanes": [{k: (v if k != "loaded_at" else _ts(v)) for k, v in r.items()} for r in _safe(
        "SELECT historical_lane_id, historical_source_system, target_system, migration_purpose, primary_mapping_evidence, reference_artifacts, "
        "data_domain, relationship_to_operational_lineage, status, batch_id, loaded_at FROM cp_hist_migration_lane ORDER BY historical_lane_id")]}


@router.get("/artifacts")
def artifacts():
    return {"artifacts": [{k: (v if k != "loaded_at" else _ts(v)) for k, v in r.items()} for r in _safe(
        "SELECT source_artifact, artifact_type, historical_migration_role, supported_lanes, cp_360_treatment, notes, artifact_class, batch_id, loaded_at "
        "FROM cp_hist_source_artifact ORDER BY artifact_class, source_artifact")]}


@router.get("/dictionary")
def dictionary():
    return {"columns": [dict(r) for r in _safe("SELECT meaningful_column_name, definition, source_or_derivation FROM cp_hist_header_dictionary ORDER BY meaningful_column_name")]}


@router.get("/evidence")
def evidence(lane: str = "", domain: str = "", system: str = "", workbook: str = "", sheet: str = "", category: str = "",
             attribute: str = "", q: str = "", unresolved: str = "", page: int = 1, size: int = 50):
    page, size = max(1, int(page or 1)), min(500, max(1, int(size or 50)))
    where, p = [], {}
    for col, val in (("historical_migration_lane", lane), ("historical_migration_domain", domain), ("historical_source_system", system),
                     ("source_mapping_workbook", workbook), ("source_mapping_sheet", sheet), ("evidence_category", category), ("evidence_attribute", attribute)):
        if val:
            where.append(f"{col} = :{col}")
            p[col] = val
    if unresolved in ("1", "true", "Y"):
        where.append("lane_resolved = 'N'")
    if q.strip():
        where.append("(UPPER(evidence_attribute) LIKE :q OR UPPER(original_source_column) LIKE :q OR UPPER(DBMS_LOB.SUBSTR(evidence_value, 4000, 1)) LIKE :q)")
        p["q"] = f"%{q.strip().upper()}%"
    w = (" WHERE " + " AND ".join(where)) if where else ""
    total = _safe(f"SELECT COUNT(*) AS n FROM cp_hist_mapping_evidence{w}", p)
    p2 = {**p, "off": (page - 1) * size, "lim": size}
    rows = _safe("SELECT source_mapping_workbook, source_mapping_sheet, source_mapping_row, original_source_column_number, historical_migration_domain, "
                 "historical_source_system, historical_migration_lane, mapping_evidence_type, migration_group, evidence_category, evidence_attribute, "
                 "evidence_value, evidence_length, original_source_column, reference_artifacts, lane_resolved "
                 f"FROM cp_hist_mapping_evidence{w} ORDER BY source_mapping_workbook, source_mapping_sheet, source_mapping_row, original_source_column_number "
                 "OFFSET :off ROWS FETCH NEXT :lim ROWS ONLY", p2)
    out = []
    for r in rows:
        v = _clob(r.get("evidence_value")) or ""
        d = dict(r)
        d["evidence_value"] = v[:LIST_CAP]
        d["truncated"] = len(v) > LIST_CAP
        out.append(d)
    return {"evidence": out, "total": int((total[0] or {}).get("n", 0) or 0) if total else 0, "page": page, "size": size}


@router.get("/row")
def row(workbook: str, sheet: str, row: int):
    rows = _safe("SELECT original_source_column_number, original_source_column, evidence_category, evidence_attribute, evidence_value, evidence_length, "
                 "historical_migration_domain, historical_source_system, historical_migration_lane, migration_group, reference_artifacts, lane_resolved "
                 "FROM cp_hist_mapping_evidence WHERE source_mapping_workbook = :w AND source_mapping_sheet = :s AND source_mapping_row = :r "
                 "ORDER BY original_source_column_number", {"w": workbook, "s": sheet, "r": row})
    cells = []
    for r in rows:
        d = dict(r)
        d["evidence_value"] = _clob(r.get("evidence_value")) or ""
        cells.append(d)
    head = cells[0] if cells else {}
    return {"workbook": workbook, "sheet": sheet, "row": row, "cells": cells,
            "lane": head.get("historical_migration_lane"), "domain": head.get("historical_migration_domain"),
            "system": head.get("historical_source_system"), "group": head.get("migration_group")}


@router.get("/batches")
def batches():
    return {"batches": [_batch(r) for r in _safe("SELECT batch_id, source_file, source_hash, lanes_n, artifacts_n, evidence_n, dictionary_n, skipped_n, checks, loaded_at "
                                                 "FROM cp_hist_ingest_batch ORDER BY loaded_at DESC")]}
