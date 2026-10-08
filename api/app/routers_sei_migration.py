"""Data Analysis: SEI's merged source-file catalog, read as a migration.

    GET /sei-migration/overview            counts by file, group, rule, status, mandatory, system
    GET /sei-migration/fields              the catalog, filterable
    GET /sei-migration/field?id=           one row with its sources and targets: the lineage
    GET /sei-migration/sources             which BBH tables feed which load files
    GET /sei-migration/findings            what is still open, by kind
    GET /sei-migration/lookups             the config lists and crosswalk tables in use
    GET /sei-migration/ingest-status       what is loaded

Reads cp_sei_migration_* (sql/78). Every reading (rule class, mandatory
class, status class, the parsed sources and targets) was made at ingest by
ingestion.sei_migration_rules; nothing is re-derived here, so the screen,
the tests and the log agree. A warehouse without sql/78 gets empty shapes,
never a 500.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from .db import query

log = logging.getLogger("cp.api.sei_migration")
router = APIRouter(prefix="/sei-migration", tags=["sei-migration"])

RULE_ORDER = ["DIRECT", "CONSTANT", "SET_NULL", "LOOKUP", "CONDITIONAL", "CONCATENATE", "TRANSFORM", "DERIVED", "NOT_APPLICABLE", "NOT_MAPPED"]
STATUS_ORDER = ["COMPLETE", "OPEN", "BLOCKED", "NA", "UNSPECIFIED"]
MANDATORY_ORDER = ["ALWAYS", "CONDITIONAL", "OPTIONAL", "NOT_APPLICABLE", "UNKNOWN"]
SLIM = ("catalog_id, functional_group, source_object, seq, source_attribute, data_type, max_length, max_decimal, "
        "domicile, mandatory_class, mand_yes, mand_no, mand_na, rule_class, rule_side, status_class, status_detail, "
        "function_category, lookup_name, truncation_risk, report_out, null_mitigation, country_specific, "
        "has_validation, upstream_n, crosswalk_n, systems, emp_dsr_status, team_dsr_status")


def _safe(sql, params=None):
    try:
        return query(sql, params or {})
    except Exception as e:                                   # noqa: BLE001
        log.warning("sei_migration query failed: %s", e)
        return []


def _count(rows, key, order=None):
    c = {}
    for r in rows:
        k = r.get(key) or "UNSPECIFIED"
        c[k] = c.get(k, 0) + 1
    keys = [k for k in (order or []) if k in c] + sorted(k for k in c if k not in (order or []))
    return [{"key": k, "n": c[k]} for k in keys]


def _pct(n, d):
    return round(100.0 * n / d, 1) if d else 0.0


# --------------------------------------------------------------- overview
@router.get("/overview")
def overview():
    rows = _safe(f"SELECT {SLIM} FROM cp_sei_migration_field")
    total = len(rows)
    mapped = [r for r in rows if r.get("rule_class") not in ("NOT_MAPPED", None)]
    complete = [r for r in rows if r.get("status_class") == "COMPLETE"]
    by_file = {}
    for r in rows:
        f = by_file.setdefault(r.get("source_object") or "?", {
            "source_object": r.get("source_object") or "?", "functional_group": r.get("functional_group"),
            "fields": 0, "mandatory_always": 0, "conditional": 0, "mapped": 0, "complete": 0, "open": 0,
            "lookups": 0, "not_mapped": 0, "rules": {}})
        f["fields"] += 1
        f["mandatory_always"] += r.get("mandatory_class") == "ALWAYS"
        f["conditional"] += r.get("mandatory_class") == "CONDITIONAL"
        f["mapped"] += r.get("rule_class") not in ("NOT_MAPPED", None)
        f["not_mapped"] += r.get("rule_class") in ("NOT_MAPPED", None)
        f["complete"] += r.get("status_class") == "COMPLETE"
        f["open"] += r.get("status_class") in ("OPEN", "BLOCKED", "UNSPECIFIED")
        f["lookups"] += r.get("rule_class") == "LOOKUP"
        rc = r.get("rule_class") or "NOT_MAPPED"
        f["rules"][rc] = f["rules"].get(rc, 0) + 1
    files = sorted(by_file.values(), key=lambda f: (-f["fields"], f["source_object"]))
    for f in files:
        f["mapped_pct"] = _pct(f["mapped"], f["fields"])
        f["complete_pct"] = _pct(f["complete"], f["fields"])
    systems = _safe("""
        SELECT s.system_class, s.role, COUNT(DISTINCT s.catalog_id) AS fields, COUNT(DISTINCT s.source_table) AS tables_n
        FROM cp_sei_migration_source s GROUP BY s.system_class, s.role ORDER BY fields DESC""")
    targets = _safe("""
        SELECT target_kind, COUNT(DISTINCT catalog_id) AS fields, COUNT(DISTINCT target_object) AS objects
        FROM cp_sei_migration_target GROUP BY target_kind ORDER BY fields DESC""")
    return {
        "totals": {"fields": total, "files": len(by_file), "groups": len({r.get("functional_group") for r in rows}),
                   "mapped": len(mapped), "mapped_pct": _pct(len(mapped), total),
                   "complete": len(complete), "complete_pct": _pct(len(complete), total),
                   "mandatory_always": sum(1 for r in rows if r.get("mandatory_class") == "ALWAYS"),
                   "lookups": sum(1 for r in rows if r.get("rule_class") == "LOOKUP"),
                   "with_validation": sum(1 for r in rows if r.get("has_validation") == "Y"),
                   "country_specific": sum(1 for r in rows if r.get("country_specific") == "Y"),
                   "findings": len(_findings(rows))},
        "by_file": files,
        "by_group": _count(rows, "functional_group"),
        "by_rule": _count(rows, "rule_class", RULE_ORDER),
        "by_status": _count(rows, "status_class", STATUS_ORDER),
        "by_mandatory": _count(rows, "mandatory_class", MANDATORY_ORDER),
        "by_system": systems,
        "by_target": targets,
    }


# ----------------------------------------------------------------- fields
@router.get("/fields")
def fields(file: str | None = None, group: str | None = None, rule: str | None = None, status: str | None = None,
           mandatory: str | None = None, system: str | None = None, q: str | None = None, limit: int = 2000):
    where, params = [], {}
    if file:
        where.append("f.source_object = :f"); params["f"] = file
    if group:
        where.append("f.functional_group = :g"); params["g"] = group
    if rule:
        where.append("f.rule_class = :r"); params["r"] = rule.upper()
    if status:
        where.append("f.status_class = :s"); params["s"] = status.upper()
    if mandatory:
        where.append("f.mandatory_class = :m"); params["m"] = mandatory.upper()
    if system:
        where.append("EXISTS (SELECT 1 FROM cp_sei_migration_source x WHERE x.catalog_id = f.catalog_id AND x.system_class = :sy)")
        params["sy"] = system.upper()
    if q:
        where.append("(UPPER(f.source_attribute) LIKE :q OR UPPER(f.catalog_id) LIKE :q OR UPPER(f.rule_text) LIKE :q "
                     "OR UPPER(f.source_tables_text) LIKE :q)")
        params["q"] = f"%{q.strip().upper()}%"
    sql = f"SELECT {', '.join('f.' + c.strip() for c in SLIM.split(','))} FROM cp_sei_migration_field f"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY f.source_object, f.seq, f.source_attribute"
    rows = _safe(sql, params)
    return {"fields": rows[:max(1, min(limit, 5000))], "total": len(rows),
            "files": sorted({r.get("source_object") for r in rows if r.get("source_object")})}


@router.get("/files")
def files():
    return {"files": _safe("""
        SELECT source_object, MIN(functional_group) AS functional_group, COUNT(*) AS fields
        FROM cp_sei_migration_field GROUP BY source_object ORDER BY fields DESC, source_object""")}


# ------------------------------------------------------------------ field
@router.get("/field")
def field(id: str):
    cid = (id or "").strip()
    if not cid:
        raise HTTPException(400, "id is required")
    rows = _safe("SELECT * FROM cp_sei_migration_field WHERE catalog_id = :c", {"c": cid})
    if not rows:
        raise HTTPException(404, f"no catalog row {cid!r}")
    f = rows[0]
    sources = _safe("""SELECT source_table, source_field, system_class, role, how
                       FROM cp_sei_migration_source WHERE catalog_id = :c
                       ORDER BY role, system_class, source_table, source_field""", {"c": cid})
    targets = _safe("""SELECT target_kind, target_object, target_field, transformation
                       FROM cp_sei_migration_target WHERE catalog_id = :c
                       ORDER BY target_kind, target_object, target_field""", {"c": cid})
    # neighbours: the fields of the same load file, for stepping through
    sib = _safe("""SELECT catalog_id, seq, source_attribute FROM cp_sei_migration_field
                   WHERE source_object = :o ORDER BY seq, source_attribute""", {"o": f.get("source_object")})
    prev_id = next_id = None
    for i, s in enumerate(sib):
        if s.get("catalog_id") == cid:
            prev_id = sib[i - 1]["catalog_id"] if i > 0 else None
            next_id = sib[i + 1]["catalog_id"] if i + 1 < len(sib) else None
    return {"field": f, "sources": sources, "targets": targets, "prev": prev_id, "next": next_id,
            "findings": [x for x in _findings([f]) if x["catalog_id"] == cid]}


# ---------------------------------------------------------------- sources
@router.get("/sources")
def sources(file: str | None = None, system: str | None = None):
    where, params = [], {}
    if file:
        where.append("f.source_object = :f"); params["f"] = file
    if system:
        where.append("s.system_class = :sy"); params["sy"] = system.upper()
    sql = """
        SELECT s.system_class, s.role, s.source_table, f.source_object,
               COUNT(DISTINCT s.catalog_id) AS fields,
               COUNT(DISTINCT CASE WHEN s.source_field <> '-' THEN s.source_field END) AS columns_n
        FROM cp_sei_migration_source s JOIN cp_sei_migration_field f ON f.catalog_id = s.catalog_id"""
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " GROUP BY s.system_class, s.role, s.source_table, f.source_object ORDER BY fields DESC, s.source_table"
    rows = _safe(sql, params)
    tables, systems = {}, {}
    for r in rows:
        t = tables.setdefault(r["source_table"], {"source_table": r["source_table"], "system_class": r["system_class"],
                                                   "role": r["role"], "fields": 0, "columns_n": 0, "files": []})
        t["fields"] += r["fields"] or 0
        t["columns_n"] = max(t["columns_n"], r["columns_n"] or 0)
        t["files"].append({"source_object": r["source_object"], "fields": r["fields"]})
        s = systems.setdefault(r["system_class"], {"system_class": r["system_class"], "fields": 0, "tables": set(), "files": set()})
        s["fields"] += r["fields"] or 0
        s["tables"].add(r["source_table"]); s["files"].add(r["source_object"])
    sys_out = sorted(({"system_class": k, "fields": v["fields"], "tables": len(v["tables"]), "files": len(v["files"])}
                      for k, v in systems.items()), key=lambda x: -x["fields"])
    return {"systems": sys_out, "tables": sorted(tables.values(), key=lambda x: -x["fields"]), "cells": rows}


# --------------------------------------------------------------- findings
FINDING_KINDS = {
    "MANDATORY_UNMAPPED": "Required for every account type, no mapping rule written",
    "MANDATORY_OPEN": "Required for every account type, status not complete",
    "STATUS_OPEN": "Mapping written but status still open or blocked",
    "UNMAPPED": "No mapping rule and not marked not-applicable",
    "LOOKUP_NO_TABLE": "Rule needs a lookup but names no crosswalk or config list",
    "TRUNCATION": "The rule or note warns the value may be truncated",
    "REPORT_OUT": "The rule asks for exceptions to be reported out",
    "NULL_MITIGATION": "The rule falls back to another value when the source is null",
    "DSR_PENDING": "DSR tagging logic written, its status not complete",
    "COUNTRY_SPECIFIC": "Applies to one domicile only",
}
FINDING_ORDER = list(FINDING_KINDS)


def _findings(rows):
    out = []

    def add(r, kind, detail=""):
        out.append({"kind": kind, "catalog_id": r.get("catalog_id"), "source_object": r.get("source_object"),
                    "source_attribute": r.get("source_attribute"), "detail": detail})

    for r in rows:
        rc, mc, sc = r.get("rule_class") or "NOT_MAPPED", r.get("mandatory_class"), r.get("status_class")
        if mc == "ALWAYS" and rc == "NOT_MAPPED":
            add(r, "MANDATORY_UNMAPPED")
        elif mc == "ALWAYS" and sc != "COMPLETE" and rc != "NOT_APPLICABLE":
            add(r, "MANDATORY_OPEN", r.get("status_detail") or sc or "")
        elif rc == "NOT_MAPPED" and sc not in ("NA",):
            add(r, "UNMAPPED")
        elif sc in ("OPEN", "BLOCKED") and rc != "NOT_APPLICABLE":
            add(r, "STATUS_OPEN", r.get("status_detail") or "")
        if rc == "LOOKUP" and not (r.get("crosswalk_n") or 0) and not r.get("lookup_name"):
            add(r, "LOOKUP_NO_TABLE")
        if r.get("truncation_risk") == "Y":
            add(r, "TRUNCATION")
        if r.get("report_out") == "Y":
            add(r, "REPORT_OUT")
        if r.get("null_mitigation") == "Y":
            add(r, "NULL_MITIGATION")
        for side in ("emp", "team"):
            st = (r.get(f"{side}_dsr_status") or "").lower()
            if st and "complete" not in st and not st.startswith("n/a") and st != "na":
                add(r, "DSR_PENDING", f"{'Employee' if side == 'emp' else 'Team'} DSR: {r.get(f'{side}_dsr_status')}")
        if r.get("country_specific") == "Y":
            add(r, "COUNTRY_SPECIFIC", r.get("domicile") or "")
    return out


@router.get("/findings")
def findings(file: str | None = None, kind: str | None = None):
    sql = f"SELECT {SLIM} FROM cp_sei_migration_field"
    params = {}
    if file:
        sql += " WHERE source_object = :f"; params["f"] = file
    sql += " ORDER BY source_object, seq"
    rows = _findings(_safe(sql, params))
    if kind:
        rows = [r for r in rows if r["kind"] == kind.upper()]
    by_kind = _count(rows, "kind", FINDING_ORDER)
    for k in by_kind:
        k["label"] = FINDING_KINDS.get(k["key"], k["key"])
    return {"findings": rows, "by_kind": by_kind, "kinds": FINDING_KINDS}


# ---------------------------------------------------------------- lookups
@router.get("/lookups")
def lookups():
    cfg = _safe("""
        SELECT lookup_name AS name, COUNT(*) AS fields, MIN(source_object) AS first_file,
               COUNT(DISTINCT source_object) AS files
        FROM cp_sei_migration_field WHERE lookup_name IS NOT NULL
        GROUP BY lookup_name ORDER BY fields DESC, lookup_name""")
    xw = _safe("""
        SELECT s.source_table AS name, s.system_class, s.role, COUNT(DISTINCT s.catalog_id) AS fields,
               COUNT(DISTINCT f.source_object) AS files
        FROM cp_sei_migration_source s JOIN cp_sei_migration_field f ON f.catalog_id = s.catalog_id
        WHERE s.role IN ('CROSSWALK', 'CONFIG')
        GROUP BY s.source_table, s.system_class, s.role ORDER BY fields DESC, s.source_table""")
    return {"config_lists": cfg, "crosswalks": xw}


# ---------------------------------------------------------- ingest status
@router.get("/ingest-status")
def ingest_status():
    def n(sql):
        r = _safe(sql)
        return (r[0] or {}).get("n", 0) if r else 0
    last = _safe("SELECT MAX(updated_at) AS t, COUNT(DISTINCT source_workbook) AS workbooks FROM cp_sei_migration_field")
    return {"fields": n("SELECT COUNT(*) AS n FROM cp_sei_migration_field"),
            "sources": n("SELECT COUNT(*) AS n FROM cp_sei_migration_source"),
            "targets": n("SELECT COUNT(*) AS n FROM cp_sei_migration_target"),
            "workbooks": (last[0] or {}).get("workbooks", 0) if last else 0,
            "updated_at": str((last[0] or {}).get("t") or "") if last else ""}
