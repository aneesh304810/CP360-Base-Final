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
    evidence = n("SELECT COUNT(*) AS n FROM cp_hist_mapping_evidence")
    lineage = n("SELECT COUNT(*) AS n FROM cp_hist_lineage")
    rules = n("SELECT COUNT(*) AS n FROM cp_hist_rule")
    # loaded: the v12 package carries the lineage and the rules and no
    # evidence sheet at all; any of the three means a batch is there
    loaded = (evidence + lineage + rules) > 0
    if reason is None and not loaded:
        reason = "no_rows"
    return {"loaded": loaded, "reason": None if loaded else reason,
            "totals": {"lanes": n("SELECT COUNT(*) AS n FROM cp_hist_migration_lane"),
                       "artifacts": n("SELECT COUNT(*) AS n FROM cp_hist_source_artifact"),
                       "evidence": evidence, "lineage": lineage, "rules": rules,
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


def _norm(f):
    """The same normalisation the loader applies to target_field_norm
    (hist_migration_conn.norm_field), so a SEI datapoint, a historical
    target field and a legacy source column compare in Python."""
    if not f:
        return ""
    c = re.sub(r"[\s/.\-]+", "_", str(f).strip())
    c = re.sub(r"_{2,}", "_", c).strip("_").upper()
    return re.sub(r"_L(\d+)", r"_\1", c)


LEGACY_COLS = ("l.lineage_id, l.src_source_table, l.src_source_column, l.src_type, l.src_length, l.src_to_stg1_transform, "
               "l.stg1_source_table, l.stg1_source_column, l.stg1_type, l.stg1_to_stg2_transform, l.stg2_source_table, l.stg2_source_column, l.stg2_type, "
               "l.stg2_to_dwh_transform, l.dwh_target_table, l.dwh_target_column, l.dwh_type, l.dwh_length, l.lineage_status, n.source_system")


def _maps():
    """Every SEI datapoint to STAR contract field, once, keyed by the
    normalised datapoint. One plain scan, cached by the db layer."""
    out = {}
    for m in _safe("SELECT map_id, lane_id, data_source, src_file_key, src_source_column, sei_feed, sei_entity, sei_datapoint, map_kind, evidence "
                   "FROM sei_source_map WHERE sei_datapoint IS NOT NULL ORDER BY data_source, src_file_key"):
        out.setdefault(_norm(m.get("sei_datapoint")), []).append(dict(m))
    return out


def _legacy_for(columns):
    """The legacy (STAR to IMDS) rows whose source column normalises to one
    of the given names: the distinct column names once, then the rows by
    their raw spelling in IN lists of 500, so the join never asks Oracle
    to normalise a column per candidate. Keyed by the normalised name."""
    want = {_norm(c) for c in columns if c}
    if not want:
        return {}
    raw = [x.get("src_source_column") for x in _safe("SELECT DISTINCT src_source_column FROM legacy_lineage WHERE src_source_column IS NOT NULL")]
    raw = sorted({c for c in raw if c and _norm(c) in want})
    out = {}
    for i in range(0, len(raw), 500):
        chunk = raw[i:i + 500]
        binds = {f"c{j}": c for j, c in enumerate(chunk)}
        rows = _safe(f"SELECT {LEGACY_COLS} FROM legacy_lineage l LEFT JOIN legacy_lineage_lane n ON n.lineage_id = l.lineage_id "
                     f"WHERE l.src_source_column IN ({', '.join(':' + k for k in binds)}) ORDER BY l.dwh_target_table, l.dwh_target_column", binds)
        for x in rows:
            d = dict(x)
            for c in ("src_to_stg1_transform", "stg1_to_stg2_transform", "stg2_to_dwh_transform"):
                d[c] = _clob(x.get(c)) or ""
            out.setdefault(_norm(d.get("src_source_column")), []).append(d)
    return out


def _legacy_matches(legacy, m):
    """The legacy rows for one map row: same normalised source column and,
    when the map names a feed key, that key inside the legacy source table."""
    key = (m.get("src_file_key") or "").upper()
    return [g for g in legacy.get(_norm(m.get("src_source_column")), []) if not key or key in (g.get("src_source_table") or "").upper()]


def _hist_paths(file="", lane="", q="", limit=500):
    """One row per historical mapping and operational path: the lineage
    row, the STAR contract field it joins by normalised name, and the
    legacy row that carries that field to IMDS; a target with no match
    keeps its row with the right side empty. Three plain queries and a
    join here, instead of one statement that normalised every legacy row
    per candidate and ran for minutes on a far database."""
    import time
    t0 = time.perf_counter()
    where, p = [], {}
    if file:
        where.append("target_dat_file = :target_dat_file"); p["target_dat_file"] = file
    if lane:
        where.append("lane_id = :lane_id"); p["lane_id"] = lane
    if q.strip():
        where.append("(UPPER(target_field) LIKE :q OR UPPER(source_object_field) LIKE :q)"); p["q"] = f"%{q.strip().upper()}%"
    w = (" WHERE " + " AND ".join(where)) if where else ""
    lin = _safe(f"SELECT lineage_id, lane_id, source_system, source_object_field, transformation_rule, rule_status, approval_status, decon_dictionary_status, "
                f"target_dat_file, target_field, target_field_norm, target_data_type, target_max_length, mandatory, match_status FROM cp_hist_lineage{w} "
                f"ORDER BY target_dat_file, target_field, lane_id, lineage_id FETCH FIRST {int(limit)} ROWS ONLY", p)
    maps = _maps() if lin else {}
    norms = {(r.get("target_field_norm") or _norm(r.get("target_field"))) for r in lin}
    hit = {n: ms for n, ms in maps.items() if n in norms}
    legacy = _legacy_for([m.get("src_source_column") for ms in hit.values() for m in ms]) if hit else {}
    blank_m = {"map_id": None, "src_file_key": None, "src_source_column": None, "map_kind": None}
    blank_g = {"legacy_id": None, "src_source_table": None, "stg1_source_table": None, "stg1_source_column": None, "stg2_source_table": None, "stg2_source_column": None,
               "dwh_target_table": None, "dwh_target_column": None, "dwh_type": None, "lineage_status": None}
    out = []
    for r in lin:
        base = {k: r.get(k) for k in ("lineage_id", "lane_id", "source_system", "source_object_field", "transformation_rule", "rule_status", "approval_status",
                                       "decon_dictionary_status", "target_dat_file", "target_field", "target_data_type", "target_max_length", "mandatory", "match_status")}
        ms = hit.get(r.get("target_field_norm") or _norm(r.get("target_field")), [])
        if not ms:
            out.append({**base, **blank_m, **blank_g})
            continue
        for m in ms:
            mm = {"map_id": m.get("map_id"), "src_file_key": m.get("src_file_key"), "src_source_column": m.get("src_source_column"), "map_kind": m.get("map_kind")}
            gs = _legacy_matches(legacy, m)
            if not gs:
                out.append({**base, **mm, **blank_g})
                continue
            for g in gs:
                out.append({**base, **mm, "legacy_id": g.get("lineage_id"), "src_source_table": g.get("src_source_table"), "stg1_source_table": g.get("stg1_source_table"),
                            "stg1_source_column": g.get("stg1_source_column"), "stg2_source_table": g.get("stg2_source_table"), "stg2_source_column": g.get("stg2_source_column"),
                            "dwh_target_table": g.get("dwh_target_table"), "dwh_target_column": g.get("dwh_target_column"), "dwh_type": g.get("dwh_type"), "lineage_status": g.get("lineage_status")})
    info = {"seconds": round(time.perf_counter() - t0, 2), "lineage_rows": len(lin), "maps": sum(len(v) for v in hit.values()), "legacy_rows": sum(len(v) for v in legacy.values())}
    return out, info


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
    star = _maps().get(norm, []) if norm else []
    legacy = _legacy_for([m.get("src_source_column") for m in star[:20]]) if star else {}
    imds = []
    seen = set()
    for m in star[:20]:
        if not m.get("src_source_column"):
            continue
        for x in _legacy_matches(legacy, m)[:20]:
            if x["lineage_id"] in seen:
                continue
            seen.add(x["lineage_id"])
            d = dict(x)
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
    rows, info = _hist_paths(file, lane, q, limit)
    out = []
    for r in rows[:limit]:
        d = dict(r)
        d["transformation_rule"] = (_clob(r.get("transformation_rule")) or "")[:600]
        out.append(d)
    files = [{"key": r.get("k"), "n": int(r.get("n") or 0)} for r in _safe("SELECT target_dat_file AS k, COUNT(*) AS n FROM cp_hist_lineage GROUP BY target_dat_file ORDER BY target_dat_file")]
    return {"mapping": out, "files": files, "limit": limit, "info": info, "truncated": len(rows) > limit}


@router.get("/canvas")
def canvas(file: str = "", lane: str = ""):
    """The historical lineage as the Source view draws a feed: the lanes'
    source columns on the left, the SEI dat files with their target fields
    in the middle with the transformation on every wire, and on the right
    the IMDS tables those fields reach today by exact normalised name. One
    payload the picture and the table both read."""
    rows, info = _hist_paths(file, lane, "", 4000)
    lanes: dict = {}
    targets: dict = {}
    sei_files: dict = {}
    seen_links = set()
    for r in rows:
        lid = r.get("lineage_id")
        lane_id = r.get("lane_id") or "UNCLASSIFIED"
        src = (r.get("source_object_field") or "").split("\n")[0].strip()
        tbl = r.get("target_dat_file") or "(no file)"
        col = r.get("target_field") or "(blank)"
        key = (lid, tbl, col)
        if key not in seen_links:
            seen_links.add(key)
            tg = targets.setdefault(tbl, {"table": tbl, "cols": []})
            link = {"col": col, "src": src, "lineage_id": lid, "lane": lane_id, "src_system": r.get("source_system"),
                    "type": r.get("target_data_type"), "length": r.get("target_max_length"), "mandatory": r.get("mandatory"),
                    "t1": (_clob(r.get("transformation_rule")) or ""), "status": "UNMAPPED" if not src else (r.get("rule_status") or ""),
                    "rule_status": r.get("rule_status"), "approval": r.get("approval_status"), "dictionary": r.get("decon_dictionary_status"),
                    "match": r.get("match_status"), "sei": {"has": False, "files": [], "fields": [], "source": None, "status": r.get("match_status")}}
            tg["cols"].append(link)
            ln = lanes.setdefault(lane_id, {"lane": lane_id, "n": 0, "x": 0, "cols": {}})
            if src:
                ln["cols"][src] = ln["cols"].get(src, 0) + 1
            ln["n"] += 1
            if link["t1"].strip():
                ln["x"] += 1
        link = next(c for c in targets[tbl]["cols"] if c["lineage_id"] == lid and c["col"] == col)
        if r.get("dwh_target_table") and r.get("dwh_target_column"):
            f = r["dwh_target_table"]
            if f not in link["sei"]["files"]:
                link["sei"]["files"].append(f)
            link["sei"]["fields"].append({"file": f, "field": r["dwh_target_column"]})
            link["sei"]["has"] = True
            link["sei"]["source"] = f"{r.get('src_file_key') or ''}.{r.get('src_source_column') or ''}".strip(".")
            sf = sei_files.setdefault(f, {"file": f, "n": 0, "fields": {}})
            sf["n"] += 1
            sf["fields"][r["dwh_target_column"]] = {"name": r["dwh_target_column"], "type": r.get("dwh_type"), "used_by": sf["fields"].get(r["dwh_target_column"], {}).get("used_by", 0) + 1}
        elif r.get("src_source_column"):
            link["sei"]["source"] = f"{r.get('src_file_key') or ''}.{r.get('src_source_column') or ''}".strip(".")
    return {"file": file, "lane": lane,
            "lanes": [{"lane": v["lane"], "n": v["n"], "x": v["x"], "cols": [{"name": k, "n": n} for k, n in sorted(v["cols"].items(), key=lambda kv: -kv[1])]} for v in lanes.values()],
            "targets": list(targets.values()),
            "sei_files": [{"file": v["file"], "n": v["n"], "fields": list(v["fields"].values())} for v in sei_files.values()],
            "files": [{"key": r.get("k"), "n": int(r.get("n") or 0)} for r in _safe("SELECT target_dat_file AS k, COUNT(*) AS n FROM cp_hist_lineage GROUP BY target_dat_file ORDER BY target_dat_file")],
            "truncated": info["lineage_rows"] >= 4000, "info": info}
