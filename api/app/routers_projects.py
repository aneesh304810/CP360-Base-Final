"""Projects router — registry list, per-project stats, SEI vs Non-SEI rollups."""
from __future__ import annotations
from fastapi import APIRouter
from .db import query

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("")
def list_projects():
    projects = query("""SELECT project_id, display_name, category, vendor,
                               color_hex, is_active FROM projects ORDER BY category, display_name""")
    # attach lightweight counts
    counts = {r["project_id"]: r for r in query("""
        SELECT project_id, COUNT(*) AS dataset_count
        FROM datasets GROUP BY project_id""")}
    for p in projects:
        c = counts.get(p["project_id"], {})
        p["dataset_count"] = c.get("dataset_count", 0)
    return {"projects": projects}


@router.get("/categories")
def categories():
    rows = query("""
        SELECT p.category, COUNT(d.object_name) AS dataset_count
        FROM projects p LEFT JOIN datasets d ON d.project_id = p.project_id
        GROUP BY p.category""")
    out = {"SEI": 0, "Non-SEI": 0}
    for r in rows:
        if r["category"] in out:
            out[r["category"]] = r["dataset_count"]
    return {"categories": out}


@router.get("/{project_id}")
def get_project(project_id: str):
    rows = query("""SELECT project_id, display_name, category, vendor, description,
                           owner, color_hex, is_active FROM projects
                    WHERE project_id = :pid""", {"pid": project_id})
    return rows[0] if rows else {}


@router.get("/{project_id}/stats")
def project_stats(project_id: str):
    p = {"pid": project_id}
    ds = query("""SELECT object_type, COUNT(*) AS n FROM datasets
                  WHERE project_id=:pid GROUP BY object_type""", p)
    by_type = {r["object_type"]: r["n"] for r in ds}
    api_n = query("""SELECT COUNT(*) AS n FROM api_endpoints WHERE project_id=:pid""", p)
    pii_n = query("""SELECT COUNT(*) AS n FROM pii_field_matches WHERE project_id=:pid""", p)
    return {
        "project_id": project_id,
        "datasets_by_type": by_type,
        "api_endpoints": (api_n[0]["n"] if api_n else 0),
        "pii_matches": (pii_n[0]["n"] if pii_n else 0),
    }


# ===================================================================
# Project landing — project as the PARENT of all feeds/loaders/pipelines
# ===================================================================
from .db import query as _q


def _safe_q(sql, params=None):
    try:
        return _q(sql, params or {})
    except Exception:
        return []


@router.get("/landing")
def project_landing():
    """All projects with rolled-up counts — the parent browse page."""
    projects = _safe_q("""SELECT project_id, display_name, category, vendor,
        description, color_hex FROM projects WHERE is_active='Y'
        ORDER BY CASE category WHEN 'SEI' THEN 0 ELSE 1 END, display_name""")
    out = []
    for p in projects:
        pid = p["project_id"]
        def cnt(sql):
            r = _safe_q(sql, {"p": pid})
            return r[0]["c"] if r else 0
        inbound = cnt("""SELECT COUNT(*) c FROM datasets
            WHERE object_type='FEED' AND project_id=:p""")
        loaders = cnt("SELECT COUNT(*) c FROM ldr_catalog WHERE project_id=:p")
        models = cnt("""SELECT COUNT(*) c FROM datasets
            WHERE object_type='MODEL' AND project_id=:p""")
        apis = cnt("SELECT COUNT(*) c FROM api_sources WHERE project_id=:p")
        interfaces = cnt("""SELECT COUNT(*) c FROM datasets
            WHERE object_type='INTERFACE' AND project_id=:p""")
        sources = _safe_q("""SELECT source_key, source_label, connector, direction,
            structure_note, last_ingested FROM project_sources
            WHERE project_id=:p AND is_active='Y' ORDER BY source_key""", {"p": pid})
        out.append({**p, "counts": {
            "inbound_feeds": inbound, "loaders": loaders, "dbt_models": models,
            "apis": apis, "interfaces": interfaces},
            "sources": sources})
    return {"projects": out}


@router.get("/{project_id}/sources")
def project_sources(project_id: str):
    rows = _safe_q("""SELECT source_key, source_label, connector, path_env,
        direction, structure_note, is_active, last_ingested
        FROM project_sources WHERE project_id=:p ORDER BY source_key""",
        {"p": project_id})
    return {"project_id": project_id, "sources": rows}
