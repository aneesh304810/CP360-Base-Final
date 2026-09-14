"""API 360 router — serves Swagger/Postman-ingested data (project-filtered).

Reads the api_* tables the Api360Connector populates. Each list endpoint
accepts a project_id filter. Missing-table errors degrade to [] so the API
never falls over if API 360 hasn't been ingested yet.
"""
from __future__ import annotations
from fastapi import APIRouter
from .db import query

router = APIRouter(prefix="/api360", tags=["api360"])


def _safe(sql: str, params: dict) -> list[dict]:
    try:
        return query(sql, params)
    except Exception:
        return []


def _project_clause(project_id: str | None, col: str = "project_id"):
    """Return (clause, params) honoring all/sei/non-sei/<id>."""
    if not project_id or project_id == "all":
        return "1=1", {}
    if project_id == "sei":
        return f"{col} = 'sei'", {}
    if project_id == "non-sei":
        return f"{col} <> 'sei'", {}
    return f"{col} = :pid", {"pid": project_id}


@router.get("/sources")
def sources(project_id: str | None = None):
    clause, params = _project_clause(project_id)
    return {"sources": _safe(f"""
        SELECT source_id, display_name, project_id, feature_group, kind,
               release_version, geography, regulatory_scope, spec_path,
               endpoint_count, last_ingested
        FROM api_sources WHERE {clause}
        ORDER BY project_id, feature_group, source_id""", params)}


@router.get("/sources/{source_id}")
def source_detail(source_id: str):
    rows = _safe("SELECT * FROM api_sources WHERE source_id = :s", {"s": source_id})
    if not rows:
        return {}
    src = rows[0]
    src["endpoints"] = _safe("""
        SELECT endpoint_key, method, path, operation_id, summary,
               function_point_id, full_endpoint_url, error_count, requires_auth
        FROM api_endpoints WHERE source_id = :s
        ORDER BY path, method""", {"s": source_id})
    return src


@router.get("/endpoints")
def endpoints(project_id: str | None = None, source_id: str | None = None,
              feature_group: str | None = None, limit: int = 500):
    clause, params = _project_clause(project_id)
    params["lim"] = limit
    if source_id:
        clause += " AND source_id = :sid"; params["sid"] = source_id
    if feature_group:
        clause += " AND feature_group = :fg"; params["fg"] = feature_group
    return {"endpoints": _safe(f"""
        SELECT endpoint_key, source_id, method, path, operation_id, summary,
               function_point_id, full_endpoint_url, sei_version, server_url,
               example_count, error_count, requires_auth, project_id, feature_group
        FROM api_endpoints WHERE {clause}
        ORDER BY feature_group, path FETCH FIRST :lim ROWS ONLY""", params)}


@router.get("/endpoint/{endpoint_key}")
def endpoint_detail(endpoint_key: str, operation_id: str | None = None,
                    method: str | None = None, path: str | None = None):
    """Resolve an endpoint by ANY of: exact endpoint_key, operation_id, or
    method+path. The BF flow steps carry operation_id / method / path but not
    the stored composite endpoint_key ('source:METHOD path'), so we match
    flexibly and fall back through strategies."""
    ep = None
    rows = _safe("SELECT * FROM api_endpoints WHERE endpoint_key = :k", {"k": endpoint_key})
    if rows:
        ep = rows[0]
    # try operation_id (the value the flow steps usually carry) — tolerate
    # trailing punctuation/whitespace and case differences seen in the specs
    if not ep:
        oid = (operation_id or endpoint_key or "").strip().rstrip(".")
        rows = _safe("""SELECT * FROM api_endpoints
            WHERE UPPER(RTRIM(operation_id, '. ')) = UPPER(:o)
            FETCH FIRST 1 ROWS ONLY""", {"o": oid})
        if rows:
            ep = rows[0]
    # try method + path (endpoint_key ends with 'METHOD path')
    if not ep and (method or path):
        rows = _safe("""SELECT * FROM api_endpoints
            WHERE UPPER(method) = UPPER(:m) AND path = :p
            FETCH FIRST 1 ROWS ONLY""", {"m": method or "", "p": path or ""})
        if rows:
            ep = rows[0]
    # try: endpoint_key contains the path, or key ends with 'METHOD path'
    if not ep:
        rows = _safe("""SELECT * FROM api_endpoints
            WHERE endpoint_key LIKE :like OR path = :ek
            FETCH FIRST 1 ROWS ONLY""",
            {"like": f"%{endpoint_key}", "ek": endpoint_key})
        if rows:
            ep = rows[0]
    if not ep:
        return {}
    ek = ep.get("endpoint_key")
    ep["fields"] = _safe("""
        SELECT field_name, data_type, required, max_length, format,
               example_value, description, is_pii, pii_category, pii_attribute
        FROM api_fields WHERE endpoint_key = :k ORDER BY field_name""",
        {"k": ek})
    ep["errors"] = _safe("""
        SELECT http_status, error_code, sequence_no, business_exception, error_details
        FROM api_endpoint_errors WHERE endpoint_key = :k
        ORDER BY sequence_no""", {"k": ek})
    return ep


@router.get("/fields")
def fields(endpoint_key: str | None = None, pii_only: bool = False, limit: int = 1000):
    clause, params = "1=1", {"lim": limit}
    if endpoint_key:
        clause += " AND endpoint_key = :k"; params["k"] = endpoint_key
    if pii_only:
        clause += " AND is_pii = 'Y'"
    return {"fields": _safe(f"""
        SELECT endpoint_key, field_name, data_type, required, is_pii,
               pii_category, pii_attribute
        FROM api_fields WHERE {clause}
        ORDER BY endpoint_key, field_name FETCH FIRST :lim ROWS ONLY""", params)}


@router.get("/flows")
def flows(project_id: str | None = None):
    clause, params = _project_clause(project_id)
    flow_rows = _safe(f"""
        SELECT flow_key, flow_name, project_id, description, step_count
        FROM api_flows WHERE {clause} ORDER BY flow_name""", params)
    # attach steps to each flow
    for f in flow_rows:
        f["steps"] = _safe("""
            SELECT step_order, endpoint_key, label, variable_passed
            FROM api_flow_steps WHERE flow_key = :fk ORDER BY step_order""",
            {"fk": f["flow_key"]})
    return {"flows": flow_rows}


@router.get("/dependencies")
def dependencies(project_id: str | None = None):
    # api_dependencies has no project_id; join endpoints to derive it
    if project_id and project_id not in ("all",):
        clause, params = _project_clause(project_id, col="e.project_id")
        rows = _safe(f"""
            SELECT d.from_endpoint, d.to_endpoint, d.dep_type, e.project_id,
                   e.method AS method_from
            FROM api_dependencies d
            LEFT JOIN api_endpoints e ON e.endpoint_key = d.from_endpoint
            WHERE {clause}""", params)
    else:
        rows = _safe("""
            SELECT d.from_endpoint, d.to_endpoint, d.dep_type, e.project_id,
                   e.method AS method_from
            FROM api_dependencies d
            LEFT JOIN api_endpoints e ON e.endpoint_key = d.from_endpoint""", {})
    return {"dependencies": rows}


@router.get("/stats")
def stats():
    src = _safe("""SELECT project_id, COUNT(*) c FROM api_sources
                   GROUP BY project_id""", {})
    counts = {r["project_id"]: r["c"] for r in src}
    total_ep = _safe("SELECT COUNT(*) c FROM api_endpoints", {})
    pii_fields = _safe("SELECT COUNT(*) c FROM api_fields WHERE is_pii='Y'", {})
    flows = _safe("SELECT COUNT(*) c FROM api_flows", {})
    return {
        "sources": sum(counts.values()),
        "endpoints": total_ep[0]["c"] if total_ep else 0,
        "pii_fields": pii_fields[0]["c"] if pii_fields else 0,
        "flows": flows[0]["c"] if flows else 0,
        "project_counts": {
            "all": sum(counts.values()),
            "sei": counts.get("sei", 0),
            "non-sei": sum(v for k, v in counts.items() if k != "sei"),
        },
    }


@router.get("/business-flows")
def business_flows(project_id: str | None = None, domain: str | None = None):
    """List generated/curated business flows (BA name overrides generated)."""
    clause, params = _project_clause(project_id)
    if domain:
        clause += " AND domain = :dom"; params["dom"] = domain
    rows = _safe(f"""
        SELECT flow_id,
               NVL(business_name, generated_name) AS display_name,
               generated_name, business_name, goal, persona, domain,
               project_id, origin, step_count, is_published
        FROM api_business_flows
        WHERE {clause} AND is_published = 'Y'
        ORDER BY domain, display_name""", params)
    return {"business_flows": rows}


@router.get("/business-flow/{flow_id}")
def business_flow_detail(flow_id: str):
    """One flow with its ordered steps + live endpoint metadata (sequence + graph)."""
    head = _safe("""SELECT flow_id,
               NVL(business_name, generated_name) AS display_name,
               generated_name, business_name, goal, persona, domain,
               project_id, origin, step_count, is_published
        FROM api_business_flows WHERE flow_id = :f""", {"f": flow_id})
    if not head:
        return {}
    flow = head[0]
    flow["steps"] = _safe("""
        SELECT s.step_order, s.endpoint_key, s.produces_entity, s.consumes_entity,
               s.note, e.method, e.path, e.operation_id, e.summary AS endpoint_summary,
               e.function_point_id, e.feature_group
        FROM api_business_flow_steps s
        LEFT JOIN api_endpoints e ON e.endpoint_key = s.endpoint_key
        WHERE s.flow_id = :f ORDER BY s.step_order""", {"f": flow_id})
    return flow


@router.get("/business-flow-stats")
def business_flow_stats():
    total = _safe("SELECT COUNT(*) c FROM api_business_flows WHERE is_published='Y'", {})
    curated = _safe("SELECT COUNT(*) c FROM api_business_flows WHERE business_name IS NOT NULL", {})
    by_domain = _safe("""SELECT domain, COUNT(*) c FROM api_business_flows
                         WHERE is_published='Y' GROUP BY domain ORDER BY c DESC""", {})
    return {
        "total": total[0]["c"] if total else 0,
        "curated": curated[0]["c"] if curated else 0,
        "by_domain": {r["domain"]: r["c"] for r in by_domain},
    }


# ===================================================================
# Flow builder — BA creates/edits flows by picking endpoints
# ===================================================================
from fastapi import Body
from .db import execute, execute_many
import re as _re
import time as _time


@router.get("/endpoint-picker")
def endpoint_picker(q: str | None = None, domain: str | None = None,
                    project_id: str | None = None, limit: int = 100):
    """Search/browse endpoints to add to a flow.
    q matches path/operation_id/summary; domain filters by feature_group."""
    clause, params = _project_clause(project_id)
    params["lim"] = limit
    if domain:
        clause += " AND feature_group = :dom"; params["dom"] = domain
    if q:
        clause += (" AND (UPPER(path) LIKE :q OR UPPER(operation_id) LIKE :q"
                   " OR UPPER(summary) LIKE :q)")
        params["q"] = f"%{q.upper()}%"
    rows = _safe(f"""
        SELECT endpoint_key, method, path, operation_id, summary,
               feature_group, project_id
        FROM api_endpoints WHERE {clause}
        ORDER BY feature_group, path FETCH FIRST :lim ROWS ONLY""", params)
    # attach produces/consumes from api_dependencies-derived columns if present
    return {"endpoints": rows}


@router.get("/domains")
def domains(project_id: str | None = None):
    clause, params = _project_clause(project_id)
    rows = _safe(f"""SELECT feature_group AS domain, COUNT(*) c
        FROM api_endpoints WHERE {clause} AND feature_group IS NOT NULL
        GROUP BY feature_group ORDER BY feature_group""", params)
    return {"domains": rows}


def _entity_maps():
    """Build produces/consumes maps from api_business_flow_steps (already derived)."""
    produces, consumes = {}, {}
    for r in _safe("""SELECT endpoint_key, produces_entity, consumes_entity
                      FROM api_business_flow_steps""", {}):
        ek = r["endpoint_key"]
        if r.get("produces_entity"):
            produces.setdefault(ek, set()).add(r["produces_entity"])
        if r.get("consumes_entity"):
            for c in str(r["consumes_entity"]).split(","):
                c = c.strip()
                if c:
                    consumes.setdefault(ek, set()).add(c)
    return produces, consumes


@router.post("/suggest-order")
def suggest_order(endpoint_keys: list[str] = Body(..., embed=True)):
    """Given a set of chosen endpoints, suggest an order (producers before
    consumers) and flag any entity consumed but not produced by the set."""
    produces, consumes = _entity_maps()
    producer_of = {}
    for ek in endpoint_keys:
        for ent in produces.get(ek, set()):
            producer_of.setdefault(ent, ek)
    # topological-ish: sort so an endpoint comes after the producers of what it needs
    ordered, placed = [], set()

    def place(ek, depth=0):
        if ek in placed or depth > 20:
            return
        for ent in consumes.get(ek, set()):
            prod = producer_of.get(ent)
            if prod and prod in endpoint_keys and prod != ek:
                place(prod, depth + 1)
        if ek not in placed:
            placed.add(ek); ordered.append(ek)

    # auth-like producers first
    for ek in sorted(endpoint_keys, key=lambda k: 0 if "access_token" in produces.get(k, set()) else 1):
        place(ek)
    # warnings: consumed entity with no producer in the set
    warnings = []
    for ek in endpoint_keys:
        for ent in consumes.get(ek, set()):
            if ent not in producer_of:
                warnings.append({"endpoint_key": ek, "missing_entity": ent})
    return {"ordered": ordered, "warnings": warnings}


@router.post("/business-flow")
def create_business_flow(payload: dict = Body(...)):
    """Create or replace a BA-authored business flow.
    payload: { flow_id?, business_name, goal?, persona?, domain?, project_id?,
               steps: [ {endpoint_key, note?}, ... ] }"""
    name = (payload.get("business_name") or "").strip()
    steps = payload.get("steps") or []
    if not name or not steps:
        return {"ok": False, "error": "business_name and at least one step required"}

    flow_id = payload.get("flow_id") or (
        "ba_" + _re.sub(r"[^a-zA-Z0-9]+", "_", name).lower()[:90] + "_" + str(int(_time.time()))[-6:])
    produces, consumes = _entity_maps()

    head_sql = """
        MERGE INTO api_business_flows t
        USING (SELECT :flow_id AS flow_id FROM dual) s ON (t.flow_id = s.flow_id)
        WHEN MATCHED THEN UPDATE SET business_name=:bn, goal=:goal, persona=:persona,
             domain=:domain, project_id=:pid, origin='curated',
             step_count=:sc, updated_at=SYSTIMESTAMP
        WHEN NOT MATCHED THEN INSERT
             (flow_id, generated_name, business_name, goal, persona, domain,
              project_id, origin, step_count, is_published)
             VALUES (:flow_id, :bn, :bn, :goal, :persona, :domain, :pid,
                     'curated', :sc, 'Y')"""
    head_params = {
        "flow_id": flow_id, "bn": name[:400],
        "goal": (payload.get("goal") or "")[:2000] or None,
        "persona": (payload.get("persona") or "")[:200] or None,
        "domain": (payload.get("domain") or "")[:120] or None,
        "pid": payload.get("project_id", "sei"), "sc": len(steps),
    }
    stmts = [(head_sql, head_params),
             ("DELETE FROM api_business_flow_steps WHERE flow_id = :f", {"f": flow_id})]
    step_sql = """INSERT INTO api_business_flow_steps
        (flow_id, step_order, endpoint_key, produces_entity, consumes_entity, note)
        VALUES (:flow_id, :step_order, :endpoint_key, :produces_entity,
                :consumes_entity, :note)"""
    for i, st in enumerate(steps, start=1):
        ek = st.get("endpoint_key")
        stmts.append((step_sql, {
            "flow_id": flow_id, "step_order": i, "endpoint_key": ek,
            "produces_entity": next(iter(produces.get(ek, set())), None),
            "consumes_entity": ", ".join(sorted(consumes.get(ek, set()))) or None,
            "note": (st.get("note") or "")[:2000] or None,
        }))
    try:
        execute(stmts)
        return {"ok": True, "flow_id": flow_id, "step_count": len(steps)}
    except Exception as e:
        return {"ok": False, "error": str(e)[:300]}


@router.patch("/business-flow/{flow_id}")
def update_business_flow_meta(flow_id: str, payload: dict = Body(...)):
    """BA edits a flow's name/goal/persona without touching steps."""
    sets, params = [], {"f": flow_id}
    for col, key in (("business_name", "business_name"), ("goal", "goal"),
                     ("persona", "persona"), ("is_published", "is_published")):
        if key in payload:
            sets.append(f"{col} = :{key}"); params[key] = payload[key]
    if not sets:
        return {"ok": False, "error": "no fields to update"}
    sql = (f"UPDATE api_business_flows SET {', '.join(sets)}, "
           f"updated_at=SYSTIMESTAMP WHERE flow_id = :f")
    try:
        execute([(sql, params)])
        return {"ok": True, "flow_id": flow_id}
    except Exception as e:
        return {"ok": False, "error": str(e)[:300]}


@router.delete("/business-flow/{flow_id}")
def delete_business_flow(flow_id: str):
    try:
        execute([
            ("DELETE FROM api_business_flow_steps WHERE flow_id = :f", {"f": flow_id}),
            ("DELETE FROM api_business_flows WHERE flow_id = :f", {"f": flow_id}),
        ])
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)[:300]}
