"""Data 360 router — lineage + feed dictionary specifics (project-filtered)."""
from __future__ import annotations
import logging
from fastapi import APIRouter
from .db import query

log = logging.getLogger("cp.api.data360")


def _safe(sql, params=None):
    """query() that returns [] on any error instead of raising, so one bad
    table/column doesn't 500 the whole endpoint."""
    try:
        return query(sql, params or {})
    except Exception as e:  # noqa: BLE001
        log.warning("data360 query failed (returning []): %s", str(e)[:160])
        return []


router = APIRouter(prefix="/data360", tags=["data360"])


@router.get("/graph")
def graph(project_id: str | None = None, plane: str = "Data", limit: int = 300):
    """Plane-aware lineage graph.
    Data = TABLE/VIEW/FEED + their edges; Transform = also MODEL nodes;
    Orchestration = also DAG nodes and DAG->model edges."""
    type_sets = {
        "Data": "('TABLE','VIEW','FEED')",
        "Transform": "('TABLE','VIEW','FEED','MODEL')",
        "Orchestration": "('TABLE','VIEW','FEED','MODEL','DAG')",
    }
    types = type_sets.get(plane, type_sets["Data"])
    where, params = [f"object_type IN {types}"], {"lim": limit}
    if project_id:
        where.append("project_id = :pid"); params["pid"] = project_id
    nodes = query(f"""
        SELECT platform_id||'.'||schema_name||'.'||object_name AS id,
               object_name AS name, object_type AS type, layer, project_id
        FROM datasets WHERE {' AND '.join(where)}
        FETCH FIRST :lim ROWS ONLY""", params)
    node_ids = {n["id"] for n in nodes}
    edges = query("""SELECT from_key, to_key, from_type, to_type, project_id
                     FROM transform_lineage FETCH FIRST 1000 ROWS ONLY""", {})
    # keep only edges whose endpoints are in the visible node set
    edges = [e for e in edges
             if e["from_key"] in node_ids and e["to_key"] in node_ids]
    return {"nodes": nodes, "edges": edges, "plane": plane}


@router.get("/column-lineage")
def column_lineage(dataset_key: str | None = None, limit: int = 500):
    """Column-level edges with transform expressions. Filter by target dataset."""
    where, params = ["1=1"], {"lim": limit}
    if dataset_key:
        where.append("to_column LIKE :dk"); params["dk"] = dataset_key + ".%"
    rows = query(f"""SELECT from_column, to_column, transform_expr, model_key
                     FROM column_lineage WHERE {' AND '.join(where)}
                     FETCH FIRST :lim ROWS ONLY""", params)
    return {"column_edges": rows}


@router.get("/transformation/{dataset_key}")
def transformation(dataset_key: str):
    """The compiled SQL / transform for one model."""
    rows = query("""SELECT target_key, transform_type, dbt_model, project_id,
                           compiled_sql FROM transformations
                    WHERE target_key = :k""", {"k": dataset_key})
    return rows[0] if rows else {}


@router.get("/lineage")
def lineage(project_id: str | None = None, limit: int = 200):
    where, params = ["1=1"], {"lim": limit}
    if project_id:
        where.append("project_id = :pid"); params["pid"] = project_id
    edges = query(f"""SELECT from_key, to_key, from_type, to_type, project_id
                     FROM transform_lineage WHERE {' AND '.join(where)}
                     FETCH FIRST :lim ROWS ONLY""", params)
    return {"edges": edges}


@router.get("/feeds")
def feeds(feed_class: str | None = None, geography: str | None = None):
    where, params = ["object_type = 'FEED'"], {}
    if feed_class:
        where.append("feed_class = :fc"); params["fc"] = feed_class
    if geography:
        where.append("geography = :geo"); params["geo"] = geography
    return {"feeds": query(f"""
        SELECT platform_id, schema_name, object_name,
               platform_id||'.'||schema_name||'.'||object_name AS dataset_key,
               project_id, feed_class, geography, regulatory_scope,
               NVL(business_desc,tech_desc) AS description
        FROM datasets WHERE {' AND '.join(where)} ORDER BY object_name""", params)}


@router.get("/stats")
def stats(project_id: str | None = None):
    where, params = ["1=1"], {}
    if project_id:
        where.append("project_id = :pid"); params["pid"] = project_id
    rows = query(f"""SELECT object_type, COUNT(*) AS n FROM datasets
                    WHERE {' AND '.join(where)} GROUP BY object_type""", params)
    return {"by_type": {r["object_type"]: r["n"] for r in rows}}


# ===================================================================
# Business / Semantic glossary — terms mapped to columns, with trace-down
# ===================================================================
@router.get("/glossary")
def glossary(project_id: str | None = None, domain: str | None = None):
    where, params = ["1=1"], {}
    if domain:
        where.append("business_domain = :dom"); params["dom"] = domain
    rows = _safe(f"""
        SELECT term, label, definition, business_domain, owner,
               regulatory_scope, certified, metric_type, source
        FROM business_glossary WHERE {' AND '.join(where)}
        ORDER BY term""", params)
    return {"terms": rows}


@router.get("/glossary/{term}")
def glossary_term(term: str):
    """A term, its column mappings, and the trace DOWN through lineage to source."""
    head = _safe("SELECT * FROM business_glossary WHERE term = :t", {"t": term})
    if not head:
        return {}
    out = head[0]
    cols = _safe("""SELECT dataset_key, column_name, mapping_source
        FROM term_column_map WHERE term = :t""", {"t": term})
    out["columns"] = cols
    # trace down: for each mapped column, walk column_lineage upstream, and
    # table lineage upstream, to assemble the path to the source feed.
    trace = []
    for c in cols:
        ds = c["dataset_key"]; col = c["column_name"]
        # column lineage feeding this column
        col_edges = _safe("""SELECT from_column, to_column, transform_expr, model_key
            FROM column_lineage WHERE LOWER(to_column) = :c
            OR LOWER(model_key) LIKE :ds""",
            {"c": col.lower(), "ds": f"%{ds.split('.')[-1]}%"})
        # table lineage upstream of this dataset's model
        model = ds.split(".")[-1]
        tbl_edges = _safe("""SELECT from_key, to_key, from_type, to_type
            FROM transform_lineage WHERE LOWER(to_key) LIKE :m""",
            {"m": f"%{model}%"})
        trace.append({"dataset_key": ds, "column_name": col,
                      "column_lineage": col_edges, "table_lineage": tbl_edges})
    out["trace"] = trace
    return out


@router.get("/glossary-stats")
def glossary_stats():
    by_src = _safe("""SELECT source, COUNT(*) c FROM business_glossary
                      GROUP BY source""", {})
    reg = _safe("""SELECT COUNT(*) c FROM business_glossary
                   WHERE regulatory_scope IS NOT NULL""", {})
    cert = _safe("SELECT COUNT(*) c FROM business_glossary WHERE certified='Y'", {})
    total = _safe("SELECT COUNT(*) c FROM business_glossary", {})
    return {
        "total": total[0]["c"] if total else 0,
        "regulated": reg[0]["c"] if reg else 0,
        "certified": cert[0]["c"] if cert else 0,
        "by_source": {r["source"]: r["c"] for r in by_src},
    }


# ===================================================================
# Pipeline builder — feed/loader catalogs + BA-composed pipelines
# ===================================================================
from fastapi import Body as _Body
from .db import execute as _execute


@router.get("/feed-catalog")
def feed_catalog(direction: str | None = None, domain: str | None = None, q: str | None = None):
    where, params = ["1=1"], {}
    if direction:
        where.append("direction = :d"); params["d"] = direction
    if domain:
        where.append("business_domain = :dom"); params["dom"] = domain
    if q:
        where.append("UPPER(feed_name) LIKE :q"); params["q"] = f"%{q.upper()}%"
    rows = _safe(f"""SELECT feed_id, feed_name, direction, business_domain, frequency,
        format, record_type, source_system, target_system
        FROM feed_catalog WHERE {' AND '.join(where)}
        ORDER BY direction, business_domain, feed_name""", params)
    return {"feeds": rows}


@router.get("/loader-catalog")
def loader_catalog(domain: str | None = None, q: str | None = None):
    where, params = ["1=1"], {}
    if domain:
        where.append("business_domain = :dom"); params["dom"] = domain
    if q:
        where.append("UPPER(loader_name) LIKE :q"); params["q"] = f"%{q.upper()}%"
    wsql = ' AND '.join(where)
    # Primary: the rich loader workbook table (ldr_catalog) — this is where the
    # CP_Catalog_SEI_Loaders.xlsx loaders land.
    rows = _safe(f"""SELECT loader_id, loader_name, template_pattern AS template,
        purpose AS error_template, business_domain, group_name, file_format,
        version, direction FROM ldr_catalog WHERE {wsql}
        ORDER BY loader_name""", params)
    if not rows:
        # Fallback: the simple loader_catalog (loaders_full.xlsx)
        rows = _safe(f"""SELECT loader_id, loader_name, template, error_template,
            business_domain FROM loader_catalog WHERE {wsql}
            ORDER BY loader_name""", params)
    return {"loaders": rows}


@router.get("/data-pipelines")
def data_pipelines(project_id: str | None = None):
    rows = _safe("""SELECT * FROM v_data_pipeline_360
        WHERE is_published = 'Y' ORDER BY business_domain, pipeline_name""", {})
    return {"pipelines": rows}


@router.get("/data-pipeline/{pipeline_id}")
def data_pipeline_detail(pipeline_id: str):
    head = _safe("SELECT * FROM v_data_pipeline_360 WHERE pipeline_id = :p",
                 {"p": pipeline_id})
    if not head:
        return {}
    p = head[0]
    members = _safe("""SELECT m.stage, m.member_id, m.member_order, m.note,
               f.feed_name, f.direction, f.business_domain AS feed_domain,
               l.loader_name, l.template, l.error_template
        FROM pipeline_members m
        LEFT JOIN feed_catalog f ON f.feed_id = m.member_id AND f.direction = (
            CASE m.stage WHEN 'inbound_feed' THEN 'inbound'
                         WHEN 'outbound_feed' THEN 'outbound' END)
        LEFT JOIN loader_catalog l ON l.loader_id = m.member_id
        WHERE m.pipeline_id = :p ORDER BY m.stage, m.member_order""",
        {"p": pipeline_id})
    p["inbound_feeds"] = [m for m in members if m["stage"] == "inbound_feed"]
    p["loaders"] = [m for m in members if m["stage"] == "loader"]
    p["outbound_feeds"] = [m for m in members if m["stage"] == "outbound_feed"]
    return p


@router.post("/data-pipeline")
def create_data_pipeline(payload: dict = _Body(...)):
    """BA composes a pipeline: name + picked inbound feeds, loaders, outbound feeds."""
    name = (payload.get("pipeline_name") or "").strip()
    if not name:
        return {"ok": False, "error": "pipeline_name required"}
    import re as _re, time as _t
    pid = payload.get("pipeline_id") or (
        "pipe_" + _re.sub(r"[^a-zA-Z0-9]+", "_", name).lower()[:90] + "_" + str(int(_t.time()))[-5:])
    head_sql = """MERGE INTO data_pipelines t USING (SELECT :p AS pid FROM dual) s
        ON (t.pipeline_id = s.pid)
        WHEN MATCHED THEN UPDATE SET pipeline_name=:nm, business_domain=:dom,
             schedule=:sch, goal=:goal, owner=:own, origin='custom', updated_at=SYSTIMESTAMP
        WHEN NOT MATCHED THEN INSERT (pipeline_id, pipeline_name, business_domain,
             schedule, goal, owner, origin, project_id, is_published)
             VALUES (:p, :nm, :dom, :sch, :goal, :own, 'custom', :pid_proj, 'Y')"""
    stmts = [(head_sql, {"p": pid, "nm": name[:400],
        "dom": (payload.get("business_domain") or "")[:120] or None,
        "sch": (payload.get("schedule") or "EOD")[:40],
        "goal": (payload.get("goal") or "")[:2000] or None,
        "own": (payload.get("owner") or "")[:200] or None,
        "pid_proj": payload.get("project_id", "sei")}),
        ("DELETE FROM pipeline_members WHERE pipeline_id = :p", {"p": pid})]
    m_sql = """INSERT INTO pipeline_members (pipeline_id, stage, member_id, member_order, note)
               VALUES (:p, :stage, :mid, :ord, :note)"""
    for stage, key in (("inbound_feed", "inbound_feeds"), ("loader", "loaders"),
                       ("outbound_feed", "outbound_feeds")):
        for i, mid in enumerate(payload.get(key, []) or [], start=1):
            stmts.append((m_sql, {"p": pid, "stage": stage, "mid": mid, "ord": i, "note": None}))
    try:
        _execute(stmts)
        return {"ok": True, "pipeline_id": pid}
    except Exception as e:
        return {"ok": False, "error": str(e)[:300]}


# ===================================================================
# Datapoint 360 — the indexed registry
# ===================================================================
@router.get("/datapoints")
def datapoints(q: str | None = None, pii_only: bool = False,
               direction: str | None = None, limit: int = 200):
    """List data points. direction filters by inbound|outbound|both|other
    (Inbound = SWP EOD feeds, Outbound = loaders)."""
    where, params = ["1=1"], {"lim": limit}
    if q:
        where.append("dp_name_normalized LIKE :q"); params["q"] = f"%{q.lower()}%"
    if pii_only:
        where.append("is_pii = 'Y'")
    if direction == "inbound":
        where.append("in_inbound = 'Y'")
    elif direction == "outbound":
        where.append("in_outbound = 'Y'")
    elif direction == "both":
        where.append("in_inbound = 'Y' AND in_outbound = 'Y'")
    rows = _safe(f"""SELECT dp_name_normalized, dp_display_name, occurrence_count,
        module_count, is_pii, pii_attribute, pii_category, is_key,
        in_inbound, in_outbound, project_ids_csv
        FROM dp_registry WHERE {' AND '.join(where)}
        ORDER BY occurrence_count DESC FETCH FIRST :lim ROWS ONLY""", params)
    return {"datapoints": rows}


@router.get("/datapoint-groups")
def datapoint_groups():
    """Top-level browse counts: Inbound vs Outbound (SEI project)."""
    inbound = _safe("SELECT COUNT(*) c FROM dp_registry WHERE in_inbound='Y'", {})
    outbound = _safe("SELECT COUNT(*) c FROM dp_registry WHERE in_outbound='Y'", {})
    both = _safe("""SELECT COUNT(*) c FROM dp_registry
                    WHERE in_inbound='Y' AND in_outbound='Y'""", {})
    total = _safe("SELECT COUNT(*) c FROM dp_registry", {})
    return {
        "groups": [
            {"key": "inbound", "label": "Inbound Feeds", "project": "SEI",
             "source": "SWP EOD feeds", "count": inbound[0]["c"] if inbound else 0},
            {"key": "outbound", "label": "Outbound Feeds", "project": "SEI",
             "source": "Loaders", "count": outbound[0]["c"] if outbound else 0},
        ],
        "shared": both[0]["c"] if both else 0,
        "total": total[0]["c"] if total else 0,
    }


@router.get("/datapoint/{name}")
def datapoint_detail(name: str):
    head = _safe("SELECT * FROM dp_registry WHERE dp_name_normalized = :n",
                 {"n": name.lower()})
    if not head:
        return {}
    out = head[0]
    occ = _safe("""SELECT module, ref_key, ref_label, project_id, direction
        FROM dp_occurrences WHERE dp_name_normalized = :n ORDER BY direction, module""",
        {"n": name.lower()})
    out["occurrences"] = occ
    # group by direction for the parent browse (Inbound / Outbound / Other)
    out["by_direction"] = {
        "inbound": [o for o in occ if o.get("direction") == "inbound"],
        "outbound": [o for o in occ if o.get("direction") == "outbound"],
        "other": [o for o in occ if not o.get("direction")],
    }
    # ---- Interdependence: co-occurrence (data points sharing a feed/artifact) ----
    ref_keys = [o.get("ref_key") for o in occ if o.get("ref_key")]
    cooccur = []
    if ref_keys:
        # datasets (ref_key up to last dot) this datapoint appears in
        binds = {f"k{i}": rk for i, rk in enumerate(ref_keys[:20])}
        inlist = ",".join(f":k{i}" for i in range(len(binds)))
        cooccur = _safe(f"""
            SELECT o2.dp_name_normalized AS datapoint,
                   COUNT(DISTINCT o2.ref_key) AS shared_count
            FROM dp_occurrences o2
            WHERE o2.ref_key IN ({inlist})
              AND o2.dp_name_normalized <> :self
            GROUP BY o2.dp_name_normalized
            ORDER BY shared_count DESC
            FETCH FIRST 15 ROWS ONLY""",
            {**binds, "self": name.lower()})
    out["cooccurrence"] = cooccur
    # ---- Interdependence: impact (artifacts/marts that consume this data point) ----
    # every module+artifact where this datapoint is used = what depends on it.
    out["impact"] = [
        {"module": o.get("module"), "artifact": o.get("ref_label") or o.get("ref_key"),
         "direction": o.get("direction")}
        for o in occ
    ]
    return out


# ===================================================================
# Loaders (outbound BBH->SWP) — full workbook detail
# ===================================================================
@router.get("/loaders")
def loaders(domain: str | None = None, q: str | None = None, group: str | None = None):
    where, params = ["1=1"], {}
    if domain:
        where.append("LOWER(business_domain) LIKE :dom"); params["dom"] = f"%{domain.lower()}%"
    if group:
        where.append("group_name = :g"); params["g"] = group
    if q:
        where.append("UPPER(loader_name) LIKE :q"); params["q"] = f"%{q.upper()}%"
    rows = _safe(f"""SELECT loader_id, loader_name, group_name, purpose, business_domain,
        file_format, version, direction, attr_count, val_count, exc_count, canon_count
        FROM v_loader_360 WHERE {' AND '.join(where)}
        ORDER BY group_name, loader_name""", params)
    return {"loaders": rows}


@router.get("/loader/{loader_id}")
def loader_detail(loader_id: str):
    head = _safe("SELECT * FROM ldr_catalog WHERE loader_id = :l", {"l": loader_id})
    if not head:
        return {}
    out = head[0]
    out["format_structure"] = _safe("""SELECT component, required_for_ui, required_for_system, notes
        FROM ldr_format_structure WHERE loader_id = :l""", {"l": loader_id})
    out["attributes"] = _safe("""SELECT attribute_name, description, data_type, max_length,
        optionality, valid_values, notes, source_sheet
        FROM ldr_attributes WHERE loader_id = :l ORDER BY attribute_name""", {"l": loader_id})
    out["validations"] = _safe("""SELECT attribute_name, validation_rule, error_message
        FROM ldr_validations WHERE loader_id = :l ORDER BY seq""", {"l": loader_id})
    out["exceptions"] = _safe("""SELECT exception_type, description, resolution_path
        FROM ldr_exceptions WHERE loader_id = :l ORDER BY seq""", {"l": loader_id})
    mm = _safe("SELECT * FROM ldr_module_map WHERE loader_id = :l", {"l": loader_id})
    out["module_map"] = mm[0] if mm else None
    out["canonical_map"] = _safe("""SELECT canonical_field, canonical_category, canonical_data_type,
        physical_field, notes FROM ldr_canonical_map WHERE loader_id = :l ORDER BY seq""", {"l": loader_id})
    return out


@router.get("/loader-canonical")
def loader_canonical(canonical_field: str | None = None):
    """The CIFS canonical -> physical loader field mapping (semantic layer for loaders)."""
    where, params = ["1=1"], {}
    if canonical_field:
        where.append("UPPER(canonical_field) LIKE :c"); params["c"] = f"%{canonical_field.upper()}%"
    rows = _safe(f"""SELECT canonical_field, canonical_category, canonical_data_type,
        loader_id, physical_field, notes FROM ldr_canonical_map
        WHERE {' AND '.join(where)} ORDER BY canonical_field, loader_id""", params)
    return {"mappings": rows}


# ===================================================================
# Inbound Feed Catalog — SWP EOD feeds (from SWP_EOD_Data_Feeds.xlsx)
# ===================================================================
@router.get("/inbound-feeds")
def inbound_feeds(q: str | None = None, workstream: str | None = None):
    """All SWP EOD inbound feeds with workstream + field counts."""
    where = ["object_type = 'FEED'"]
    params = {}
    if q:
        where.append("UPPER(object_name) LIKE :q"); params["q"] = f"%{q.upper()}%"
    if workstream:
        where.append("tags = :ws"); params["ws"] = workstream
    rows = _safe(f"""
        SELECT d.platform_id, d.schema_name, d.object_name AS feed,
               d.tags AS workstream, d.feed_class, d.domain, d.business_desc,
               d.project_id,
               (SELECT COUNT(*) FROM columns c
                WHERE c.platform_id = d.platform_id
                  AND c.schema_name = d.schema_name
                  AND c.object_name = d.object_name) AS field_count
        FROM datasets d WHERE {' AND '.join(where)}
        ORDER BY d.tags, d.object_name""", params)
    # If the rich feed dictionary only produced a few FEED datasets, also include
    # simple inbound feeds from feed_catalog (inbound_feeds_full.xlsx) that aren't
    # already represented as datasets.
    have = {(r.get("feed") or "").upper() for r in rows}
    fc = _safe("""SELECT feed_id, feed_name, business_domain, direction
        FROM feed_catalog WHERE LOWER(direction) = 'inbound'
        OR direction IS NULL ORDER BY feed_name""", {})
    for f in fc:
        nm = (f.get("feed_name") or f.get("feed_id") or "")
        if nm.upper() in have:
            continue
        rows.append({"platform_id": "SWP", "schema_name": "FEEDS",
            "feed": nm, "workstream": f.get("business_domain"),
            "feed_class": None, "domain": f.get("business_domain"),
            "business_desc": None, "project_id": "sei",
            "field_count": _safe("""SELECT COUNT(*) c FROM columns
                WHERE UPPER(object_name) = :o""",
                {"o": (f.get("feed_id") or nm).upper()})})
    # flatten field_count that came back as a list
    for r in rows:
        if isinstance(r.get("field_count"), list):
            r["field_count"] = r["field_count"][0]["c"] if r["field_count"] else 0
    return {"feeds": rows}


@router.get("/inbound-feed-workstreams")
def inbound_feed_workstreams():
    """Workstream groups for the parent browse."""
    rows = _safe("""SELECT tags AS workstream, COUNT(*) c
        FROM datasets WHERE object_type='FEED' AND tags IS NOT NULL
        GROUP BY tags ORDER BY tags""", {})
    total = _safe("SELECT COUNT(*) c FROM datasets WHERE object_type='FEED'", {})
    return {"workstreams": rows, "total": total[0]["c"] if total else 0}


@router.get("/inbound-feed/{feed}")
def inbound_feed_detail(feed: str):
    """A feed's metadata + all fields (with PII flag + business meaning)."""
    head = _safe("""SELECT platform_id, schema_name, object_name AS feed, tags AS workstream,
        feed_class, domain, business_desc, project_id
        FROM datasets WHERE object_type='FEED' AND UPPER(object_name) = :f""",
        {"f": feed.upper()})
    if not head:
        # fall back to feed_catalog-based feed (simple inbound feeds)
        fc = _safe("""SELECT feed_id, feed_name AS feed, business_domain AS domain
            FROM feed_catalog WHERE UPPER(feed_name) = :f OR UPPER(feed_id) = :f""",
            {"f": feed.upper()})
        if not fc:
            return {}
        out = fc[0]
        out["fields"] = _safe("""SELECT column_name AS name, business_desc, data_type,
            max_length, nullable, is_pk, position_order,
            NVL(is_pii,'N') AS is_pii, pii_attribute
            FROM columns WHERE UPPER(object_name) = :o
            ORDER BY position_order""", {"o": (out.get("feed_id") or feed).upper()})
        return out
    out = head[0]
    # real columns schema: platform_id / schema_name / object_name (no dataset_key)
    out["fields"] = _safe("""SELECT column_name AS name,
        COALESCE(business_desc, tech_desc) AS business_desc, data_type,
        max_length, nullable, is_pk, position_order,
        NVL(is_pii, 'N') AS is_pii, pii_attribute, pii_category
        FROM columns
        WHERE platform_id = :p AND schema_name = :s AND object_name = :o
        ORDER BY position_order""",
        {"p": out["platform_id"], "s": out["schema_name"], "o": out["feed"]})
    return out
