"""CP Catalog API — read-only FastAPI. Mounts module routers."""
from __future__ import annotations
import logging
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import query

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("cp.api")

app = FastAPI(title="CP Catalog API", version="1.0.0")

# PUT is allowed because /design/status/{id} writes. It is the only
# write in the catalogue, and until it existed the list was GET and POST
# only -- a PUT from another origin fails its CORS preflight and surfaces
# in the browser as a network error rather than a 405, which is the kind
# of thing found late and blamed on the network.
#
# CORS AND THE SESSION COOKIE. A browser will not send a cookie to another
# origin unless the response says allow_credentials, and the spec forbids
# allow_credentials together with "*". So: the open wildcard stays the
# default (a read-only catalogue served same-origin needs nothing else),
# and CP_CORS_ORIGINS names the UI's origin when the two are split across
# ports. Without it, sign-in appears to succeed and every later request
# arrives anonymous — the cookie was set and never sent back.
_origins = [o.strip() for o in
            (os.environ.get("CP_CORS_ORIGINS") or "").split(",") if o.strip()]
if _origins:
    app.add_middleware(CORSMiddleware, allow_origins=_origins,
                       allow_credentials=True,
                       allow_methods=["GET", "POST", "PUT"], allow_headers=["*"])
    log.info("CORS restricted to %s (credentials allowed)", _origins)
else:
    app.add_middleware(CORSMiddleware, allow_origins=["*"],
                       allow_methods=["GET", "POST", "PUT"], allow_headers=["*"])

# ---- mount module routers (each defines its own prefix) ----------------
# Guarded so a single import error doesn't take the whole API down; any that
# fail to import are logged and skipped.
for _mod in (
        # Core routers
        "routers_projects",
        "routers_data360",
        "routers_data360_pipelines",
        "routers_api360",
        "routers_api360_console",
        "routers_interface360",
        "routers_pii",
        "routers_interdependency",
        "routers_guardrails",
        "routers_impact",
        "routers_mapper",
        "routers_variance360",
        # Not present in this tree yet — the guarded loop below logs and
        # skips it. Bring api/app/routers_design_status.py across from the
        # working copy and it mounts with no further change.
        "routers_design_status",
        "routers_environment360",
        "routers_env_infra",
        "routers_event360",

        # Legacy routers
        "routers_legacy_lineage",
        "routers_legacy_graph",
        "routers_legacy_source",
        "routers_legacy_profile",
        "routers_legacy_matrix",
        "routers_reference_legacy",

        # Additional routers
        "routers_recon360",
        "routers_admin_datasources",

        # New catalog/security routers
        "routers_sei_crosswalk",
        "routers_business_catalog",
        "routers_security",
        ):
    try:
        _m = __import__(f"app.{_mod}", fromlist=["router"])
        app.include_router(_m.router)
        log.info("mounted %s", _mod)
    except Exception as e:  # noqa: BLE001
        log.warning("could not mount %s: %s", _mod, e)


# Posture on the startup banner. The per-request warning only appears once
# somebody loads a page; an operator starting the API deserves to read what
# it is doing before that.
try:
    from .security import describe as _sec_describe
    log.warning("SECURITY: %s", _sec_describe())
except Exception as e:  # noqa: BLE001
    log.warning("SECURITY: could not determine posture: %s", e)


# ---- synonym expansion -------------------------------------------------
# ON by default, because the module was written to be on and a catalogue
# that cannot find "ccy" is not doing its job. The kill switch exists
# because widening recall is a judgement, not a fact: "account" also
# pulls in "number", and if that turns out to be noise on real content
# somebody needs to stop it in one restart rather than wait for a release.
def _synonyms_on() -> bool:
    return (os.environ.get("CP_SEARCH_SYNONYMS") or "on").strip().lower() \
        not in ("off", "0", "false", "no")


def _build_ctx(words):
    """Oracle Text expression with synonym OR-groups, or the plain one."""
    try:
        from .search_synonyms import build_contains_expr
        return build_contains_expr(words)
    except Exception as e:                                    # noqa: BLE001
        # Never let the thesaurus take search down. A missing or broken
        # map degrades to the expression that worked before it existed.
        log.warning("synonym expansion unavailable, using plain terms: %s", e)
        return " & ".join(f"(stem({w}) | {w})" for w in words)


def _expand_like(q):
    try:
        from .search_synonyms import expand_for_like
        return expand_for_like(q)
    except Exception:                                         # noqa: BLE001
        return []


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/ready")
def ready():
    try:
        query("SELECT 1 AS one FROM dual")
        return {"status": "ready"}
    except Exception as e:
        return {"status": "degraded", "detail": str(e)[:200]}


@app.get("/diag")
def diag():
    """Row counts per feature — hit this to confirm the API sees real data.
    If numbers are >0 here but the UI looks empty, the issue is UI-side
    (mock fallback / wrong VITE_API_BASE), not the data."""
    checks = {
        "datasets": "SELECT COUNT(*) n FROM datasets",
        "datasets_FEED": "SELECT COUNT(*) n FROM datasets WHERE object_type='FEED'",
        "feed_catalog": "SELECT COUNT(*) n FROM feed_catalog",
        "feed_catalog_inbound": "SELECT COUNT(*) n FROM feed_catalog WHERE LOWER(direction)='inbound'",
        "loader_catalog": "SELECT COUNT(*) n FROM loader_catalog",
        "ldr_catalog": "SELECT COUNT(*) n FROM ldr_catalog",
        "columns": "SELECT COUNT(*) n FROM columns",
        "dp_registry": "SELECT COUNT(*) n FROM dp_registry",
        "bf_pipelines": "SELECT COUNT(*) n FROM bf_pipelines",
        "bf_api_flows": "SELECT COUNT(*) n FROM bf_api_flows",
        "bf_interfaces": "SELECT COUNT(*) n FROM bf_interfaces",
        "bf_compression_plan": "SELECT COUNT(*) n FROM bf_compression_plan",
        "reference_data": "SELECT COUNT(*) n FROM reference_data",
        "search_index": "SELECT COUNT(*) n FROM search_index",
        "guardrail_events": "SELECT COUNT(*) n FROM guardrail_events",
        "datasets_LOADER": "SELECT COUNT(*) n FROM datasets WHERE object_type='LOADER'",
        "api_endpoints": "SELECT COUNT(*) n FROM api_endpoints",
        "api_fields": "SELECT COUNT(*) n FROM api_fields",
        "api_endpoint_errors": "SELECT COUNT(*) n FROM api_endpoint_errors",
        "ldr_attributes": "SELECT COUNT(*) n FROM ldr_attributes",
        "ldr_exceptions": "SELECT COUNT(*) n FROM ldr_exceptions",
        "columns_with_desc": "SELECT COUNT(*) n FROM columns WHERE business_desc IS NOT NULL",
    }
    out = {}
    for name, sql in checks.items():
        try:
            r = query(sql)
            out[name] = r[0]["n"] if r else 0
        except Exception as e:
            out[name] = f"ERR: {str(e)[:80]}"
    return {"row_counts": out}


# ---- core Data 360 endpoints (accept project_id filter) ----------------
@app.get("/datasets")
def datasets(project_id: str | None = None, object_type: str | None = None,
             limit: int = 200):
    where, params = ["1=1"], {"lim": limit}
    if project_id:
        where.append("project_id = :pid"); params["pid"] = project_id
    if object_type:
        where.append("object_type = :ot"); params["ot"] = object_type.upper()
    return {"datasets": query(f"""
        SELECT platform_id, schema_name, object_name,
               platform_id||'.'||schema_name||'.'||object_name AS dataset_key,
               object_type, project_id, layer, feed_class, geography,
               NVL(business_desc, tech_desc) AS description, owner
        FROM datasets WHERE {' AND '.join(where)}
        FETCH FIRST :lim ROWS ONLY""", params)}


@app.get("/dataset/{key}")
def dataset(key: str):
    parts = key.split(".")
    if len(parts) < 3:
        return {}
    plat, sch, obj = parts[0], parts[1], ".".join(parts[2:])
    p = {"p": plat, "s": sch, "o": obj}
    rows = query("""SELECT platform_id, schema_name, object_name, object_type,
                           project_id, layer, feed_class, geography, regulatory_scope,
                           NVL(business_desc,tech_desc) AS description, owner
                    FROM datasets WHERE platform_id=:p AND schema_name=:s
                      AND object_name=:o""", p)
    if not rows:
        return {}
    ds = rows[0]
    ds["columns"] = query("""SELECT column_name, position_order, data_type,
                                    base_data_type, max_length, precision, scale,
                                    nullable, is_pk, is_pii, pii_category, pii_attribute
                             FROM columns WHERE platform_id=:p AND schema_name=:s
                               AND object_name=:o ORDER BY position_order""", p)
    ds["enumerations"] = query("""SELECT column_name, enum_value, enum_label
                                  FROM column_enumerations WHERE platform_id=:p
                                    AND schema_name=:s AND object_name=:o""", p)
    return ds


@app.get("/search")
def search(q: str = "", project_id: str | None = None, module: str | None = None,
           limit: int = 60):
    """Unified full-text search over the search_index table (one Oracle Text
    index, ix_search_body). A single ranked CONTAINS query across ALL artifacts
    — datasets, fields, feeds, loaders, attributes, canonical, APIs, datapoints,
    PII — with stemming + relevance SCORE. Falls back to LIKE if the text index
    isn't present (no CTXAPP). Each result carries module + nav for deep-linking.
    """
    if not q or not q.strip():
        return {"results": [], "query": q, "total": 0, "understood": None,
                "counts": {m: 0 for m in ("api", "data", "datapoint", "interface", "loader", "pii")}}
    raw_q = q.strip()

    # ---- query understanding: filter tokens + field-code detection ----
    import re as _re
    filters, terms = {}, []
    for tok in raw_q.split():
        m = _re.match(r"^(ds|master|is):(.+)$", tok, _re.I)
        if m:
            filters[m.group(1).lower()] = m.group(2).lower()
        else:
            terms.append(tok)
    q = " ".join(terms) if terms else raw_q
    code = code_norm = None
    if len(terms) == 1 and _re.match(r"^[A-Za-z]{1,3}[/._\-]\d+([/._\-][Ll]?\d+)?$", terms[0]):
        code = terms[0].upper()
        code_norm = _re.sub(r"_L(\d+)", r"_\1",
            _re.sub(r"_{2,}", "_", _re.sub(r"[\s/.\-]+", "_", code))).strip("_")
    understood = {"terms": terms, "filters": filters, "code": code, "code_norm": code_norm}

    def has_text_index():
        try:
            r = query("""SELECT COUNT(*) c FROM user_indexes
                         WHERE index_name = 'IX_SEARCH_BODY'""", {})
            return (r[0].get("c") or r[0].get("C") or 0) > 0
        except Exception:
            return False

    extra = []
    if project_id:
        extra.append("project_id = :pid")
    if module:
        extra.append("module = :mod")
    params = {"lim": limit}
    if project_id:
        params["pid"] = project_id
    if module:
        params["mod"] = module
    if filters.get("is") == "pii":
        extra.append("is_pii = 'Y'")
    if filters.get("master"):
        fm = {"ip": "interested", "sec": "security", "acc": "account",
              "mac": "master account"}.get(filters["master"], filters["master"])
        extra.append("LOWER(subtitle) LIKE :fmaster")
        params["fmaster"] = f"%{fm}%"
    if filters.get("ds"):
        extra.append("(LOWER(body_text) LIKE :fds OR LOWER(subtitle) LIKE :fds)")
        params["fds"] = f"%{filters['ds']}%"
    extra_sql = (" AND " + " AND ".join(extra)) if extra else ""

    rows = []
    if has_text_index():
        # SYNONYM EXPANSION. Users search for the word they know, not the
        # word the catalogue happens to use: "ccy" for currency, "customer"
        # for client, "money owed" for balance/accrual/payable. The map in
        # search_synonyms turns each query word into an OR-group and the
        # groups are ANDed, so recall widens without precision collapsing.
        #
        # This wiring existed in an earlier main.py and was LOST when
        # /search was rewritten to add the ds:/master:/is: filters and
        # field-code detection: the rewrite kept "(stem(w) | w)" and
        # dropped the call. Nothing failed, so nothing was reported -- a
        # search for "ccy" simply returned nothing and read as an empty
        # catalogue.
        import re as _re
        words = [w for w in _re.split(r"\s+", q) if _re.match(r"^[A-Za-z0-9_]+$", w)]
        if code_norm:
            # A field code has no synonyms and must not acquire any:
            # BI/2-1 is BI_2_1 and nothing else.
            ctx = f"(stem({code_norm}) | {code_norm})"
        elif words and _synonyms_on():
            ctx = _build_ctx(words)
        else:
            ctx = " & ".join(f"(stem({w}) | {w})" for w in words) if words else None
        if ctx:
            params["ctx"] = ctx
            try:
                rows = query(f"""
                    SELECT artifact_key, module, kind, name, subtitle, project_id,
                           is_pii, nav_module, nav_tab, nav_id, nav_extra,
                           SCORE(1) AS score
                    FROM search_index
                    WHERE CONTAINS(body_text, :ctx, 1) > 0{extra_sql}
                    ORDER BY SCORE(1) DESC
                    FETCH FIRST :lim ROWS ONLY""", params)
            except Exception:
                rows = []

    if not rows:
        # LIKE fallback (no text index, or CONTAINS failed). The synonyms
        # matter MORE here, not less: a deployment without Oracle Text has
        # no stemming either, so without help "balances" would not even
        # find "balance".
        params["q"] = f"%{(code_norm or q).lower()}%"
        params["q2"] = f"%{q.lower()}%"
        like = ["LOWER(name) LIKE :q", "LOWER(subtitle) LIKE :q",
                "LOWER(body_text) LIKE :q", "LOWER(name) LIKE :q2",
                "LOWER(subtitle) LIKE :q2", "LOWER(body_text) LIKE :q2"]
        if not code_norm and _synonyms_on():
            # Bounded at 12. Each term adds two more OR predicates, and an
            # unbounded expansion turns a one-word search into a scan with
            # fifty of them.
            for _i, _term in enumerate(_expand_like(q)[:12]):
                params[f"t{_i}"] = f"%{_term}%"
                like.append(f"LOWER(body_text) LIKE :t{_i}")
                like.append(f"LOWER(name) LIKE :t{_i}")
        try:
            rows = query(f"""
                SELECT artifact_key, module, kind, name, subtitle, project_id,
                       is_pii, nav_module, nav_tab, nav_id, nav_extra, 1 AS score
                FROM search_index
                WHERE ({' OR '.join(like)}){extra_sql}
                FETCH FIRST :lim ROWS ONLY""", params)
        except Exception:
            rows = []

    # shape nav + rank (exact-name first, then SCORE)
    for r in rows:
        r["nav"] = {"module": r.pop("nav_module", None), "tab": r.pop("nav_tab", None),
                    "id": r.pop("nav_id", None), "extra": r.pop("nav_extra", None)}

    def _rank(r):
        nm = (r.get("name") or "").lower()
        ql = q.lower()
        tier = 0 if nm == ql else (1 if nm.startswith(ql) else 2)
        return (tier, -float(r.get("score") or 0))
    rows.sort(key=_rank)

    mods = ("api", "data", "datapoint", "interface", "loader", "pii")
    return {"results": rows, "query": raw_q, "total": len(rows),
            "full_text": has_text_index(), "understood": understood,
            "counts": {m: sum(1 for x in rows if x.get("module") == m) for m in mods}}


@app.get("/search/diag")
def search_diag():
    """One-call diagnosis for 'search returns nothing'. Tells you whether the
    search_index table exists, how many rows it holds, whether the Oracle Text
    index is present, and a per-module row breakdown."""
    out = {"table_exists": False, "row_count": 0, "text_index": False,
           "by_module": {}}
    try:
        r = query("SELECT COUNT(*) AS n FROM search_index")
        out["table_exists"] = True
        out["row_count"] = r[0]["n"] if r else 0
    except Exception as e:
        out["error"] = str(e)
        return out
    try:
        r = query("""SELECT COUNT(*) AS n FROM user_indexes
                     WHERE index_name = 'IX_SEARCH_BODY'""")
        out["text_index"] = bool(r and (r[0]["n"] or 0) > 0)
    except Exception:
        pass
    try:
        for r in query("""SELECT module, COUNT(*) AS n FROM search_index
                          GROUP BY module"""):
            out["by_module"][r["module"]] = r["n"]
    except Exception:
        pass
    if out["row_count"] == 0:
        out["hint"] = ("search_index is EMPTY. Run sql/20_search_index.sql, then "
                       "the ingestion step: python -m ingestion.run search_index")
    out["synonyms"] = _synonyms_on()
    try:
        from .search_synonyms import SYNONYMS
        out["synonym_terms"] = len(SYNONYMS)
    except Exception:                                         # noqa: BLE001
        out["synonym_terms"], out["synonyms"] = 0, False
    return out


@app.get("/search/suggest")
def search_suggest(q: str = "", limit: int = 8):
    """Autocomplete for the search bar. Returns suggestions matching the typed
    text on name OR body_text (body_text is always populated, so suggestions
    never come back empty when names are sparse). Also powers 'did you mean'."""
    if not q or len(q.strip()) < 2:
        return {"suggestions": []}
    ql = q.strip().lower()
    try:
        rows = query("""
            SELECT name, module, kind, nav_module, nav_tab, nav_id,
                   CASE WHEN LOWER(name) LIKE :pfx THEN 0
                        WHEN LOWER(name) LIKE :any THEN 1
                        ELSE 2 END AS rnk
            FROM   search_index
            WHERE  (LOWER(name) LIKE :any OR LOWER(body_text) LIKE :any)
              AND  name IS NOT NULL
            ORDER  BY rnk, LENGTH(name)
            FETCH FIRST :lim ROWS ONLY""",
                     {"pfx": ql + "%", "any": "%" + ql + "%", "lim": limit * 3})
    except Exception:
        rows = []
    seen, out = set(), []
    for r in rows:
        nm = r.get("name")
        if not nm or nm.lower() in seen:
            continue
        seen.add(nm.lower())
        out.append({"name": nm, "module": r.get("module"), "kind": r.get("kind"),
                    "nav": {"module": r.get("nav_module"), "tab": r.get("nav_tab"),
                            "id": r.get("nav_id")}})
        if len(out) >= limit:
            break
    return {"suggestions": out}


# ============ Business Flow workbook (CP_Catalog_Business_Flows.xlsx) ============

@app.get("/bf/api-flows")
def bf_api_flows(project_id: str | None = None):
    """API business flows from the workbook (real-time orchestration).
    Resilient to the trigger/trigger_event column name (older installs may
    still have the reserved-word 'trigger' column)."""
    where = " WHERE project_id = :pid" if project_id else ""
    p = {"pid": project_id} if project_id else {}
    # figure out which column exists for the trigger event
    trig = '"TRIGGER"'
    try:
        col = query("""SELECT column_name FROM user_tab_columns
            WHERE table_name = 'BF_API_FLOWS'
              AND column_name IN ('TRIGGER_EVENT','TRIGGER')""", {})
        names = {(r.get("column_name") or "").upper() for r in col}
        trig = "trigger_event" if "TRIGGER_EVENT" in names else '"TRIGGER"'
    except Exception:
        pass
    try:
        return {"flows": query(f"""SELECT f.flow_id, f.flow_name, f.business_domain, f.goal,
                f.{trig} AS trigger, f.primary_entity, f.source_swagger, f.notes,
                (SELECT COUNT(*) FROM bf_api_flow_steps s WHERE s.flow_id = f.flow_id) AS step_count
                FROM bf_api_flows f{where} ORDER BY f.flow_id""", p)}
    except Exception:
        # last-resort: minimal columns that always exist
        return {"flows": query(f"""SELECT flow_id, flow_name, business_domain, goal,
                primary_entity, source_swagger, notes
                FROM bf_api_flows{where} ORDER BY flow_id""", p)}


@app.get("/bf/api-flow/{flow_id}")
def bf_api_flow(flow_id: str):
    head = query("SELECT * FROM bf_api_flows WHERE flow_id = :f", {"f": flow_id})
    steps = query("""SELECT step_order, method, path, operation_id,
            produces_entity, consumes_entity, note FROM bf_api_flow_steps
            WHERE flow_id = :f ORDER BY step_order""", {"f": flow_id})
    # data points this flow touches (from Flow_Datapoint_Map)
    datapoints = query("""SELECT datapoint_normalized, source_field, module,
            direction, resolved FROM bf_flow_datapoint_map
            WHERE flow_or_pipeline_id = :f ORDER BY datapoint_normalized""",
            {"f": flow_id})
    # batch-equivalent pipelines — the Data 360 pipelines linked to this API flow
    batch = query("""SELECT pipeline_id, pipeline_name, business_domain, schedule,
            sei_target_type, sei_target_id, routing_pattern
            FROM bf_pipelines WHERE linked_api_flow_id = :f
            ORDER BY pipeline_id FETCH FIRST 50 ROWS ONLY""", {"f": flow_id})
    # which compression mart these share
    mart = query("""SELECT dbt_gold_mart, number_of_pipelines, compression_ratio
            FROM bf_compression_plan WHERE api_flow_id = :f""", {"f": flow_id})
    return {"flow": head[0] if head else None, "steps": steps,
            "datapoints": datapoints, "batch_equivalent": batch,
            "compression_mart": mart[0] if mart else None}


@app.get("/bf/pipelines")
def bf_pipelines(project_id: str | None = None, domain: str | None = None,
                 archetype: str | None = None, direction: str | None = None,
                 limit: int = 500):
    cond, p = [], {"lim": limit}
    if project_id: cond.append("project_id = :pid"); p["pid"] = project_id
    if domain: cond.append("business_domain = :dom"); p["dom"] = domain
    if archetype: cond.append("archetype = :arch"); p["arch"] = archetype
    if direction: cond.append("direction = :dir"); p["dir"] = direction
    where = (" WHERE " + " AND ".join(cond)) if cond else ""
    try:
        return {"pipelines": query(f"""SELECT pipeline_id, pipeline_name, business_domain,
                archetype, direction, schedule, legacy_system, sei_target_type,
                sei_target_id, source_system, target_system, feed_routing, in_scope,
                owner, linked_api_flow_id, feed_type,
                routing_pattern, compressed_routing, legacy_feed_routing
                FROM bf_pipelines{where} ORDER BY pipeline_id
                FETCH FIRST :lim ROWS ONLY""", p)}
    except Exception:
        # older bf_pipelines without the v20 routing columns
        return {"pipelines": query(f"""SELECT pipeline_id, pipeline_name, business_domain,
                archetype, direction, schedule, legacy_system, sei_target_type,
                sei_target_id, source_system, target_system, feed_routing, in_scope,
                owner, linked_api_flow_id, feed_type
                FROM bf_pipelines{where} ORDER BY pipeline_id
                FETCH FIRST :lim ROWS ONLY""", p)}


@app.get("/bf/pipeline/{pipeline_id}")
def bf_pipeline(pipeline_id: str):
    head = query("SELECT * FROM bf_pipelines WHERE pipeline_id = :p", {"p": pipeline_id})
    stages = query("""SELECT stage, stage_order, member_type, member_id, member_name,
            system, note FROM bf_pipeline_stages WHERE pipeline_id = :p
            ORDER BY stage_order""", {"p": pipeline_id})
    return {"pipeline": head[0] if head else None, "stages": stages}


@app.get("/bf/interfaces")
def bf_interfaces(scope: str | None = None, target: str | None = None,
                  direction: str | None = None):
    cond, p = [], {}
    if scope: cond.append("scope = :sc"); p["sc"] = scope
    if target: cond.append("target_system = :tg"); p["tg"] = target
    if direction: cond.append("direction = :dir"); p["dir"] = direction
    where = (" WHERE " + " AND ".join(cond)) if cond else ""
    return {"interfaces": query(f"""SELECT interface_id, application, integration,
            description, legacy_system, sei_target_type, sei_target_id,
            migration_status, source_system, target_system, direction, feed_routing,
            schedule, frequency, extract_type, scope, owner, linked_pipeline_id
            FROM bf_interfaces{where} ORDER BY interface_id""", p)}


@app.get("/bf/datapoint-map")
def bf_datapoint_map(datapoint: str | None = None, resolved: str | None = None):
    """Flow<->datapoint links; resolved=N shows migration/naming gaps."""
    cond, p = [], {}
    if datapoint: cond.append("LOWER(datapoint_normalized) = :dp"); p["dp"] = datapoint.lower()
    if resolved: cond.append("resolved = :r"); p["r"] = resolved
    where = (" WHERE " + " AND ".join(cond)) if cond else ""
    return {"links": query(f"""SELECT flow_or_pipeline_id, module, datapoint_normalized,
            source_field, source_artifact, direction, note, resolved
            FROM bf_flow_datapoint_map{where}
            ORDER BY datapoint_normalized, flow_or_pipeline_id""", p)}


@app.get("/bf/compression")
def bf_compression():
    """The 444 -> 37 compression: marts + summary metrics."""
    plan = query("""SELECT dbt_gold_mart, api_flow_id, number_of_pipelines,
            sample_pipeline_ids, dag_pattern, compression_ratio, notes
            FROM bf_compression_plan ORDER BY number_of_pipelines DESC""", {})
    summary = query("SELECT metric, value FROM bf_compression_summary", {})
    return {"plan": plan, "summary": {r["metric"]: r["value"] for r in summary}}


# ============ Reference Data (SWP EOD Data Feeds Reference List) ============

@app.get("/reference/categories")
def reference_categories():
    """All reference categories with field counts."""
    return {"categories": query("""SELECT category, COUNT(*) AS field_count,
            SUM(CASE WHEN resolved='Y' THEN 1 ELSE 0 END) AS resolved_count
            FROM reference_data WHERE category IS NOT NULL
            GROUP BY category ORDER BY category""", {})}


@app.get("/reference/category/{category}")
def reference_category(category: str):
    """All reference fields in a category, in position order."""
    return {"category": category, "fields": query("""SELECT position_order, field_name,
            field_name_normalized, field_description, detail_description, resolved
            FROM reference_data WHERE category = :c
            ORDER BY position_order NULLS LAST, field_name""", {"c": category})}


@app.get("/reference/datapoint/{dp_normalized}")
def reference_for_datapoint(dp_normalized: str):
    """Reference description(s) for a data point — may span categories."""
    return {"datapoint": dp_normalized, "references": query("""SELECT category,
            position_order, field_name, field_description, detail_description
            FROM reference_data WHERE field_name_normalized = :d
            ORDER BY category""", {"d": dp_normalized.lower()})}


@app.get("/reference/unresolved")
def reference_unresolved():
    """Reference fields that didn't match a data point (catalog gaps)."""
    return {"unresolved": query("""SELECT category, field_name, field_name_normalized,
            field_description FROM reference_data WHERE resolved = 'N'
            ORDER BY category, field_name""", {})}
