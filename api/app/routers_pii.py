"""PII router — classifications, matches, aggregations (project-filtered)."""
from __future__ import annotations
from fastapi import APIRouter
from .db import query

router = APIRouter(prefix="/pii", tags=["pii"])


@router.get("/classifications")
def classifications():
    return {"classifications": query("""
        SELECT pii_component_normalized, pii_component, pii_attribute,
               sensitivity_category, sensitivity_level
        FROM pii_classifications ORDER BY sensitivity_level DESC, pii_attribute""")}


@router.get("/matches")
def matches(project_id: str | None = None, module: str | None = None, limit: int = 200):
    where, params = ["1=1"], {"lim": limit}
    if project_id:
        where.append("project_id = :pid"); params["pid"] = project_id
    if module:
        where.append("module = :mod"); params["mod"] = module
    return {"matches": query(f"""
        SELECT match_id, module, ref_type, ref_key, parent_name, matched_field_name,
               pii_attribute, sensitivity_category, match_confidence, project_id
        FROM pii_field_matches WHERE {' AND '.join(where)}
        FETCH FIRST :lim ROWS ONLY""", params)}


@router.get("/by-module")
def by_module():
    return {"by_module": query("""
        SELECT module, COUNT(*) AS count FROM pii_field_matches GROUP BY module""")}


@router.get("/by-attribute")
def by_attribute():
    return {"by_attribute": query("""
        SELECT pii_attribute, sensitivity_category, COUNT(*) AS count
        FROM pii_field_matches GROUP BY pii_attribute, sensitivity_category
        ORDER BY count DESC""")}


@router.get("/by-project")
def by_project():
    return {"by_project": query("""
        SELECT p.category, m.project_id, m.sensitivity_category, COUNT(*) AS count
        FROM pii_field_matches m
        LEFT JOIN projects p ON p.project_id = m.project_id
        GROUP BY p.category, m.project_id, m.sensitivity_category
        ORDER BY count DESC""")}


@router.get("/stats")
def stats():
    attrs = query("SELECT COUNT(DISTINCT pii_attribute) AS n FROM pii_classifications")
    comps = query("SELECT COUNT(*) AS n FROM pii_classifications")
    fields = query("SELECT COUNT(*) AS n FROM pii_field_matches")
    sei = query("""SELECT COUNT(*) AS n FROM pii_field_matches WHERE project_id='sei'""")
    nonsei = query("""SELECT COUNT(*) AS n FROM pii_field_matches WHERE project_id<>'sei'""")
    return {
        "attributes": attrs[0]["n"] if attrs else 0,
        "components": comps[0]["n"] if comps else 0,
        "affected_fields": fields[0]["n"] if fields else 0,
        "sei": sei[0]["n"] if sei else 0,
        "non_sei": nonsei[0]["n"] if nonsei else 0,
    }
