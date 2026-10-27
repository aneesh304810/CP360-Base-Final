"""Data Analysis: the historical data migration sheets, read back.

    GET /hist-migration/summary      counts, the lanes, the artifacts, the latest batch and its rule checks
    GET /hist-migration/lanes        the registered lanes
    GET /hist-migration/artifacts    the source and reference artifacts
    GET /hist-migration/dictionary   the evidence table's column dictionary
    GET /hist-migration/evidence     the evidence, filtered and paged
    GET /hist-migration/row          every cell of one source row, in column order
    GET /hist-migration/batches      every load
    GET /hist-migration/lineage          FINAL_HIST_MIGRATION_LINEAGE, filtered and paged (sql/87)
    GET /hist-migration/lineage/summary  totals, the statuses kept apart, the dat files, the manifest
    GET /hist-migration/lineage/record   one record end to end: lane, source objects with their decon
                                         meaning, the rules, the SEI target, the operational SEI input
                                         lineage it matches, the STAR contract field and the IMDS column
    GET /hist-migration/decon            the decon source dictionary
    GET /hist-migration/rules            the transformation rules, filtered and paged
    GET /hist-migration/qc               the TARGET_FIELD_QC controls

Reads cp_hist_* (sql/86), written by ingestion/hist_migration_conn.py. The
evidence values are the analysts' mapping logic as they wrote it; the API
returns them whole, capped at 4000 characters per row on the list route
with a flag, and whole on the row route. A warehouse without sql/86 gets
empty shapes, never a 500.
"""
from __future__ import annotations

import json
import logging
import re

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


# ------------------------------------------------ the lineage (sql/87)
def _canon(col):
    return (f"REGEXP_REPLACE(UPPER(TRIM('_' FROM REGEXP_REPLACE({col}, '[[:space:]/.-]+', '_'))), '_L([0-9]+)', '_\\1')")


LINEAGE_SLIM = ("lineage_id, catalog_id, functional_group, source_path, source_system, lane_id, source_object_field, decon_business_domain, "
                "decon_dictionary_status, rule_status, target_system, target_dat_file, target_field, target_key, target_data_type, target_max_length, "
                "mandatory, source_workbook, source_sheet, source_row, common_target_indicator, match_method, match_status, approval_status")


def _lineage_where(lane, group, file, status, decon, match, approval, q):
    where, p = [], {}
    for col, val in (("lane_id", lane), ("functional_group", group), ("target_dat_file", file), ("rule_status", status),
                     ("decon_dictionary_status", decon), ("match_status", match), ("approval_status", approval)):
        if val:
            where.append(f"{col} = :{col}")
            p[col] = val
    if q and q.strip():
        where.append("(UPPER(target_field) LIKE :q OR UPPER(source_object_field) LIKE :q OR UPPER(catalog_id) LIKE :q OR UPPER(lineage_id) LIKE :q)")
        p["q"] = f"%{q.strip().upper()}%"
    return (" WHERE " + " AND ".join(where)) if where else "", p


@router.get("/lineage")
def lineage(lane: str = "", group: str = "", file: str = "", status: str = "", decon: str = "", match: str = "", approval: str = "",
            q: str = "", page: int = 1, size: int = 100):
    page, size = max(1, int(page or 1)), min(1000, max(1, int(size or 100)))
    w, p = _lineage_where(lane, group, file, status, decon, match, approval, q)
    total = _safe(f"SELECT COUNT(*) AS n FROM cp_hist_lineage{w}", p)
    rows = _safe(f"SELECT {LINEAGE_SLIM} FROM cp_hist_lineage{w} ORDER BY target_dat_file, target_field, lane_id, lineage_id "
                 "OFFSET :off ROWS FETCH NEXT :lim ROWS ONLY", {**p, "off": (page - 1) * size, "lim": size})
    return {"lineage": [dict(r) for r in rows], "total": int((total[0] or {}).get("n", 0) or 0) if total else 0, "page": page, "size": size}


@router.get("/lineage/summary")
def lineage_summary():
    by = lambda col, lim=100: [{"key": r.get("k") or "(blank)", "n": int(r.get("n") or 0)}   # noqa: E731
                               for r in _safe(f"SELECT {col} AS k, COUNT(*) AS n FROM cp_hist_lineage GROUP BY {col} ORDER BY COUNT(*) DESC FETCH FIRST {lim} ROWS ONLY")]
    files = [{"file": r.get("f"), "fields": int(r.get("n") or 0), "rows": int(r.get("r") or 0), "lanes": int(r.get("l") or 0), "matched": int(r.get("m") or 0)}
             for r in _safe("SELECT target_dat_file AS f, COUNT(DISTINCT target_field) AS n, COUNT(*) AS r, COUNT(DISTINCT lane_id) AS l, "
                            "SUM(CASE WHEN match_status = 'MATCHED' THEN 1 ELSE 0 END) AS m FROM cp_hist_lineage GROUP BY target_dat_file ORDER BY target_dat_file")]
    shared = _safe("SELECT COUNT(*) AS n FROM (SELECT target_key FROM cp_hist_lineage GROUP BY target_key HAVING COUNT(DISTINCT lane_id) > 1)")
    n = lambda sql: int(((_safe(sql) or [{}])[0] or {}).get("n", 0) or 0)   # noqa: E731
    return {"totals": {"lineage": n("SELECT COUNT(*) AS n FROM cp_hist_lineage"), "targetFields": n("SELECT COUNT(DISTINCT target_key) AS n FROM cp_hist_lineage"),
                       "datFiles": n("SELECT COUNT(DISTINCT target_dat_file) AS n FROM cp_hist_lineage"), "rules": n("SELECT COUNT(*) AS n FROM cp_hist_rule"),
                       "decon": n("SELECT COUNT(*) AS n FROM cp_hist_decon_dictionary"), "qc": n("SELECT COUNT(*) AS n FROM cp_hist_target_qc"),
                       "sharedTargets": int(((shared or [{}])[0] or {}).get("n", 0) or 0),
                       "matched": n("SELECT COUNT(*) AS n FROM cp_hist_lineage WHERE match_status = 'MATCHED'"),
                       "unmatched": n("SELECT COUNT(*) AS n FROM cp_hist_lineage WHERE match_status = 'UNMATCHED'"),
                       "blankTarget": n("SELECT COUNT(*) AS n FROM cp_hist_lineage WHERE target_field IS NULL")},
            "byLane": by("lane_id"), "byGroup": by("functional_group"), "byRuleStatus": by("rule_status"), "byApproval": by("approval_status"),
            "byDecon": by("decon_dictionary_status"), "byMatch": by("match_status"), "byFile": files,
            "manifest": [dict(r) for r in _safe("SELECT manifest_key, manifest_value FROM cp_hist_manifest ORDER BY manifest_key")]}


def _tokens(text):
    """The technical objects named in a source-object-field cell: words
    that look like OBJECT or OBJECT.FIELD, upper-cased."""
    out = []
    for m in re.finditer(r"[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)?", str(text or "")):
        tok = m.group(0).upper()
        if len(tok) >= 4 and "_" in tok:
            out.append(tok)
    seen, uniq = set(), []
    for t in out:
        if t not in seen:
            seen.add(t)
            uniq.append(t)
    return uniq[:40]


@router.get("/lineage/record")
def lineage_record(id: str):
    rows = _safe("SELECT * FROM cp_hist_lineage WHERE lineage_id = :i", {"i": id})
    if not rows:
        return {"record": None}
    r = dict(rows[0])
    for c in ("transformation_rule", "validation_rule"):
        r[c] = _clob(r.get(c)) or ""
    r["loaded_at"] = _ts(r.get("loaded_at"))
    key, norm, file = r.get("target_key"), r.get("target_field_norm") or "", (r.get("target_dat_file") or "").upper()
    # the rules on this catalog id or target field
    rules = []
    for x in _safe("SELECT rule_id, catalog_id, functional_group, sei_target_file, sei_target_field, rule_source_column, rule_type, transformation_rule, "
                   "validation_rule, mapping_status, source_objects_fields, source_workbook, source_sheet, evidence_locator, approval_status "
                   "FROM cp_hist_rule WHERE (catalog_id = :c AND catalog_id IS NOT NULL) OR target_key = :k ORDER BY rule_id", {"c": r.get("catalog_id") or "-", "k": key}):
        d = dict(x)
        d["transformation_rule"], d["validation_rule"] = _clob(x.get("transformation_rule")) or "", _clob(x.get("validation_rule")) or ""
        rules.append(d)
    # the decon dictionary entries for the source objects this row names
    toks = _tokens(r.get("source_object_field")) + _tokens(r.get("source_dependencies"))
    objs = [t.split(".")[0] for t in toks]
    decon = []
    if objs:
        binds = {f"o{i}": o for i, o in enumerate(sorted(set(objs))[:30])}
        decon = [dict(x) for x in _safe("SELECT technical_object, source_prefix, business_meaning, source_type, business_domain, migration_function, definition_basis, basis_class, "
                                        f"dictionary_status, lineage_usage_count FROM cp_hist_decon_dictionary WHERE UPPER(technical_object) IN ({', '.join(':' + k for k in binds)}) ORDER BY technical_object", binds)]
    # the same SEI field reached from other lanes: separate rows, by design
    siblings = [dict(x) for x in _safe(f"SELECT {LINEAGE_SLIM} FROM cp_hist_lineage WHERE target_key = :k AND lineage_id <> :i ORDER BY lane_id, lineage_id", {"k": key, "i": id})]
    # the QC controls that name this field or file
    qc = [dict(x) for x in _safe("SELECT qc_id, control_name, applies_to, expected, actual, result, detail FROM cp_hist_target_qc "
                                 "WHERE UPPER(applies_to) LIKE :f OR UPPER(applies_to) LIKE :t OR UPPER(control_name) LIKE :t ORDER BY qc_id",
                                 {"f": f"%{file}%" if file else "-", "t": f"%{(r.get('target_field') or '-').upper()}%"})]
    # downstream: the operational SEI input lineage, the SEI datapoint to the STAR contract field, STAR to IMDS
    sei_in = [dict(x) for x in _safe("SELECT input_id, data_source, functional_group, sei_target_file, sei_field, published_type, published_length, mapping_status, "
                                     "upstream_object, upstream_field, evidence FROM sei_input_lineage WHERE sei_field_norm = :n AND (UPPER(sei_target_file) = :f OR :f = '-') "
                                     "ORDER BY sei_target_file", {"n": norm or "-", "f": file or "-"})]
    if not sei_in and norm:
        sei_in = [dict(x) for x in _safe("SELECT input_id, data_source, functional_group, sei_target_file, sei_field, published_type, published_length, mapping_status, "
                                         "upstream_object, upstream_field, evidence FROM sei_input_lineage WHERE sei_field_norm = :n ORDER BY sei_target_file", {"n": norm})]
    star = [dict(x) for x in _safe(f"SELECT map_id, lane_id, data_source, src_file_key, src_source_column, sei_feed, sei_entity, sei_datapoint, map_kind, evidence "
                                   f"FROM sei_source_map WHERE {_canon('sei_datapoint')} = :n ORDER BY data_source, src_file_key", {"n": norm or "-"})]
    imds = []
    seen = set()
    for m in star[:20]:
        if not m.get("src_source_column"):
            continue
        for x in _safe("SELECT l.lineage_id, l.src_source_table, l.src_source_column, l.src_type, l.src_length, l.src_to_stg1_transform, "
                       "l.stg1_source_table, l.stg1_source_column, l.stg1_type, l.stg1_to_stg2_transform, l.stg2_source_table, l.stg2_source_column, l.stg2_type, "
                       "l.stg2_to_dwh_transform, l.dwh_target_table, l.dwh_target_column, l.dwh_type, l.dwh_length, l.lineage_status, n.source_system "
                       "FROM legacy_lineage l LEFT JOIN legacy_lineage_lane n ON n.lineage_id = l.lineage_id "
                       f"WHERE {_canon('l.src_source_column')} = {_canon(':c')} AND (UPPER(l.src_source_table) LIKE :t OR :t = '%') FETCH FIRST 20 ROWS ONLY",
                       {"c": m["src_source_column"], "t": f"%{(m.get('src_file_key') or '').upper()}%" if m.get("src_file_key") else "%"}):
            if x["lineage_id"] in seen:
                continue
            seen.add(x["lineage_id"])
            d = dict(x)
            for c in ("src_to_stg1_transform", "stg1_to_stg2_transform", "stg2_to_dwh_transform"):
                d[c] = _clob(x.get(c)) or ""
            d["star_map"] = m["map_id"]
            imds.append(d)
    chain = {
        "lane": r.get("lane_id"), "sourceObjects": sorted(set(objs))[:30], "rule": rules[0]["rule_id"] if rules else None, "datFile": r.get("target_dat_file"),
        "targetField": r.get("target_field"), "targetKey": key, "seiInput": len(sei_in), "star": len(star), "imds": len(imds),
        "statuses": {"rule": r.get("rule_status"), "approval": r.get("approval_status"), "dictionary": r.get("decon_dictionary_status"), "match": r.get("match_status")},
    }
    return {"record": r, "rules": rules, "decon": decon, "siblings": siblings, "qc": qc, "seiInput": sei_in, "star": star, "imds": imds, "chain": chain}


@router.get("/decon")
def decon(q: str = "", status: str = "", basis: str = "", domain: str = ""):
    where, p = [], {}
    if status:
        where.append("dictionary_status = :s"); p["s"] = status
    if basis:
        where.append("basis_class = :b"); p["b"] = basis
    if domain:
        where.append("business_domain = :d"); p["d"] = domain
    if q.strip():
        where.append("(UPPER(technical_object) LIKE :q OR UPPER(business_meaning) LIKE :q)"); p["q"] = f"%{q.strip().upper()}%"
    w = (" WHERE " + " AND ".join(where)) if where else ""
    rows = _safe("SELECT technical_object, source_prefix, business_meaning, source_type, business_domain, migration_function, definition_basis, basis_class, "
                 f"dictionary_status, lineage_usage_count, example_target_fields FROM cp_hist_decon_dictionary{w} ORDER BY lineage_usage_count DESC NULLS LAST, technical_object FETCH FIRST 2000 ROWS ONLY", p)
    by = lambda col: [{"key": r.get("k") or "(blank)", "n": int(r.get("n") or 0)} for r in _safe(f"SELECT {col} AS k, COUNT(*) AS n FROM cp_hist_decon_dictionary GROUP BY {col} ORDER BY COUNT(*) DESC")]   # noqa: E731
    return {"objects": [dict(r) for r in rows], "byStatus": by("dictionary_status"), "byBasis": by("basis_class"), "byDomain": by("business_domain"), "byPrefix": by("source_prefix")}


@router.get("/rules")
def rules(q: str = "", file: str = "", rule_type: str = "", status: str = "", approval: str = "", page: int = 1, size: int = 100):
    page, size = max(1, int(page or 1)), min(1000, max(1, int(size or 100)))
    where, p = [], {}
    for col, val in (("sei_target_file", file), ("rule_type", rule_type), ("mapping_status", status), ("approval_status", approval)):
        if val:
            where.append(f"{col} = :{col}"); p[col] = val
    if q.strip():
        where.append("(UPPER(sei_target_field) LIKE :q OR UPPER(rule_id) LIKE :q OR UPPER(catalog_id) LIKE :q OR UPPER(DBMS_LOB.SUBSTR(transformation_rule, 4000, 1)) LIKE :q)")
        p["q"] = f"%{q.strip().upper()}%"
    w = (" WHERE " + " AND ".join(where)) if where else ""
    total = _safe(f"SELECT COUNT(*) AS n FROM cp_hist_rule{w}", p)
    out = []
    for x in _safe("SELECT rule_id, catalog_id, functional_group, sei_target_file, sei_target_field, target_key, rule_source_column, rule_type, transformation_rule, validation_rule, "
                   f"mapping_status, source_objects_fields, source_workbook, source_sheet, evidence_locator, approval_status FROM cp_hist_rule{w} "
                   "ORDER BY sei_target_file, sei_target_field, rule_id OFFSET :off ROWS FETCH NEXT :lim ROWS ONLY", {**p, "off": (page - 1) * size, "lim": size}):
        d = dict(x)
        d["transformation_rule"], d["validation_rule"] = _clob(x.get("transformation_rule")) or "", _clob(x.get("validation_rule")) or ""
        out.append(d)
    by = lambda col: [{"key": r.get("k") or "(blank)", "n": int(r.get("n") or 0)} for r in _safe(f"SELECT {col} AS k, COUNT(*) AS n FROM cp_hist_rule GROUP BY {col} ORDER BY COUNT(*) DESC")]   # noqa: E731
    return {"rules": out, "total": int((total[0] or {}).get("n", 0) or 0) if total else 0, "page": page, "size": size,
            "byType": by("rule_type"), "byStatus": by("mapping_status"), "byApproval": by("approval_status"), "byFile": by("sei_target_file")}


@router.get("/qc")
def qc():
    out = []
    for x in _safe("SELECT qc_id, control_name, applies_to, expected, actual, result, detail, row_json FROM cp_hist_target_qc ORDER BY qc_id"):
        d = dict(x)
        try:
            d["row"] = json.loads(_clob(x.get("row_json")) or "{}")
        except Exception:                                    # noqa: BLE001
            d["row"] = {}
        d.pop("row_json", None)
        out.append(d)
    return {"controls": out}


@router.get("/lineage/mapping")
def lineage_mapping(file: str = "", lane: str = "", q: str = "", limit: int = 500):
    """Column-level lineage mapping: every historical source column to its
    SEI target field with the transformation, then the operational hops the
    target field joins by name: the STAR contract field and the IMDS column.
    One row per historical mapping and operational path; a target with no
    operational match keeps its row with the right side empty."""
    limit = min(5000, max(1, int(limit or 500)))
    where, p = [], {}
    if file:
        where.append("l.target_dat_file = :f"); p["f"] = file
    if lane:
        where.append("l.lane_id = :l"); p["l"] = lane
    if q.strip():
        where.append("(UPPER(l.target_field) LIKE :q OR UPPER(l.source_object_field) LIKE :q)"); p["q"] = f"%{q.strip().upper()}%"
    w = (" WHERE " + " AND ".join(where)) if where else ""
    rows = _safe(f"""
        SELECT l.lineage_id, l.lane_id, l.source_system, l.source_object_field, l.transformation_rule, l.rule_status, l.approval_status,
               l.decon_dictionary_status, l.target_dat_file, l.target_field, l.target_data_type, l.target_max_length, l.match_status,
               m.map_id, m.src_file_key, m.src_source_column, m.map_kind,
               g.lineage_id AS legacy_id, g.src_source_table, g.stg1_source_table, g.stg1_source_column, g.stg2_source_table, g.stg2_source_column,
               g.dwh_target_table, g.dwh_target_column, g.dwh_type, g.lineage_status
        FROM   cp_hist_lineage l
        LEFT   JOIN sei_source_map m ON {_canon('m.sei_datapoint')} = l.target_field_norm
        LEFT   JOIN legacy_lineage g ON {_canon('g.src_source_column')} = {_canon('m.src_source_column')}
                                     AND (m.src_file_key IS NULL OR UPPER(g.src_source_table) LIKE '%' || UPPER(m.src_file_key) || '%')
        {w}
        ORDER BY l.target_dat_file, l.target_field, l.lane_id, l.lineage_id, g.dwh_target_table
        FETCH FIRST {limit} ROWS ONLY""", p)
    out = []
    for r in rows:
        d = dict(r)
        d["transformation_rule"] = (_clob(r.get("transformation_rule")) or "")[:600]
        out.append(d)
    files = [{"key": r.get("k"), "n": int(r.get("n") or 0)} for r in _safe("SELECT target_dat_file AS k, COUNT(*) AS n FROM cp_hist_lineage GROUP BY target_dat_file ORDER BY target_dat_file")]
    return {"mapping": out, "files": files, "limit": limit}
