"""
Search index builder — flattens EVERY catalog artifact into the unified
search_index table (one row per artifact), then syncs the Oracle Text index.

Runs LAST in ingestion (after all modules are loaded), like datapoint_index.
Each row carries: module, kind, name, body_text (name + description + synonyms,
the indexed column), subtitle (result context line), project, PII flag, and a
nav target (module/tab/id) so /search results deep-link to the actual page.

Body text gets the name repeated so exact-name matches rank highest under
Oracle Text SCORE(), plus the description and any domain/synonym tokens.
"""
from __future__ import annotations
import logging

log = logging.getLogger("cp.search_index")


def _body(name, *extra):
    """Build the indexed text: name (doubled for weight) + extras."""
    parts = [name or "", name or ""]
    parts.extend(str(e) for e in extra if e)
    return " ".join(parts)[:32000]


class SearchIndexBuilder:
    """Step name: search_index. Run after everything else."""

    def __init__(self, project_id=None):
        self.project_id = project_id

    @classmethod
    def from_env(cls, resolver=None):
        return cls()

    def parse(self):
        return {}

    def load(self, loader, _bundle=None):
        conn = loader.conn
        cur = conn.cursor()
        rows = []

        def q(sql):
            try:
                cur.execute(sql)
                cols = [d[0].lower() for d in cur.description]
                return [dict(zip(cols, r)) for r in cur.fetchall()]
            except Exception as e:
                log.warning("search_index: skip (%s): %s", sql[:40], e)
                return []

        # 1. datasets (feeds / models / interfaces / tables)
        for r in q("""SELECT platform_id, schema_name, object_name, object_type,
                      project_id, layer, NVL(business_desc, tech_desc) AS descr
                      FROM datasets"""):
            ot = (r["object_type"] or "").upper()
            module, tab = "data", "Pipelines"
            if ot == "FEED": tab = "Inbound Feeds"
            elif ot == "INTERFACE": module, tab = "interface", None
            descr = r["descr"]
            if descr is not None and not isinstance(descr, str):
                try: descr = descr.read()      # CLOB -> str
                except Exception: descr = str(descr)
            rows.append({
                "artifact_key": f"dataset:{r['platform_id']}.{r['schema_name']}.{r['object_name']}".lower()[:400],
                "module": module, "kind": "dataset" if ot not in ("FEED", "INTERFACE") else ot.lower(),
                "name": r["object_name"],
                "body_text": _body(r["object_name"], descr, r["layer"], ot),
                "subtitle": (descr or f"{ot} in {r['schema_name']}")[:1000],
                "project_id": r["project_id"], "is_pii": "N",
                "nav_module": module, "nav_tab": tab, "nav_id": r["object_name"][:400],
                "nav_extra": None,
            })

        # 2. columns / fields
        for r in q("""SELECT column_name AS name,
                      LOWER(platform_id||'.'||schema_name||'.'||object_name) AS dataset_key,
                      data_type, NVL(is_pii,'N') is_pii, business_desc
                      FROM columns WHERE column_name IS NOT NULL"""):
            bd = r["business_desc"]
            if bd is not None and not isinstance(bd, str):
                try: bd = bd.read()
                except Exception: bd = str(bd)
            rows.append({
                "artifact_key": f"field:{r['dataset_key']}.{r['name']}".lower()[:400],
                "module": "data", "kind": "field", "name": r["name"],
                "body_text": _body(r["name"], bd, r["data_type"]),
                "subtitle": f"field · {r['dataset_key']} · {r['data_type'] or ''}"[:1000],
                "project_id": None, "is_pii": r["is_pii"],
                "nav_module": "data", "nav_tab": "Inbound Feeds",
                "nav_id": r["dataset_key"][:400], "nav_extra": r["name"][:400],
            })

        # 3. feed_catalog
        for r in q("""SELECT feed_id, feed_name, direction, business_domain,
                      frequency, record_type, project_id FROM feed_catalog"""):
            outb = (r["direction"] or "") == "outbound"
            rows.append({
                "artifact_key": f"feed:{r['feed_id']}".lower()[:400],
                "module": "loader" if outb else "data", "kind": "feed", "name": r["feed_name"],
                "body_text": _body(r["feed_name"], r["business_domain"], r["record_type"], r["direction"]),
                "subtitle": f"{r['direction'] or 'inbound'} feed · {r['business_domain'] or ''}"[:1000],
                "project_id": r["project_id"], "is_pii": "N",
                "nav_module": "data", "nav_tab": "Loaders" if outb else "Inbound Feeds",
                "nav_id": (r["feed_id"] if outb else r["feed_name"])[:400], "nav_extra": None,
            })

        # 4. datapoints
        for r in q("""SELECT dp_name_normalized, dp_display_name, occurrence_count,
                      module_count, NVL(is_pii,'N') is_pii FROM dp_registry"""):
            rows.append({
                "artifact_key": f"datapoint:{r['dp_name_normalized']}"[:400],
                "module": "datapoint", "kind": "datapoint", "name": r["dp_display_name"] or r["dp_name_normalized"],
                "body_text": _body(r["dp_display_name"], r["dp_name_normalized"]),
                "subtitle": f"datapoint · {r['occurrence_count']} occurrences · {r['module_count']} modules"[:1000],
                "project_id": None, "is_pii": r["is_pii"],
                "nav_module": "datapoint", "nav_tab": None,
                "nav_id": r["dp_name_normalized"][:400], "nav_extra": None,
            })

        # 5. loaders
        for r in q("""SELECT loader_id, loader_name, business_domain, group_name,
                      version, purpose, project_id FROM ldr_catalog"""):
            rows.append({
                "artifact_key": f"loader:{r['loader_id']}".lower()[:400],
                "module": "loader", "kind": "loader", "name": r["loader_name"],
                "body_text": _body(r["loader_name"], r["purpose"], r["business_domain"], r["group_name"]),
                "subtitle": f"loader · {r['business_domain'] or ''}{' · v' + r['version'] if r['version'] else ''}"[:1000],
                "project_id": r["project_id"], "is_pii": "N",
                "nav_module": "data", "nav_tab": "Loaders", "nav_id": r["loader_id"][:400], "nav_extra": None,
            })

        # 6. loader attributes
        for r in q("""SELECT loader_id, attribute_name, data_type, optionality, description
                      FROM ldr_attributes"""):
            rows.append({
                "artifact_key": f"loader_attr:{r['loader_id']}.{r['attribute_name']}".lower()[:400],
                "module": "loader", "kind": "loader_attr", "name": r["attribute_name"],
                "body_text": _body(r["attribute_name"], r["description"], r["data_type"]),
                "subtitle": f"loader attribute · {r['loader_id']} · {r['optionality'] or ''}"[:1000],
                "project_id": None, "is_pii": "N",
                "nav_module": "data", "nav_tab": "Loaders", "nav_id": r["loader_id"][:400],
                "nav_extra": r["attribute_name"][:400],
            })

        # 7. loader canonical
        for r in q("""SELECT canonical_field, canonical_data_type, loader_id, physical_field
                      FROM ldr_canonical_map"""):
            rows.append({
                "artifact_key": f"canonical:{r['canonical_field']}.{r['loader_id']}".lower()[:400],
                "module": "loader", "kind": "canonical", "name": r["canonical_field"],
                "body_text": _body(r["canonical_field"], r["physical_field"], r["canonical_data_type"]),
                "subtitle": f"canonical field · {r['canonical_data_type'] or ''} · {r['loader_id']}"[:1000],
                "project_id": None, "is_pii": "N",
                "nav_module": "data", "nav_tab": "Loaders", "nav_id": r["loader_id"][:400], "nav_extra": None,
            })

        # 8. API endpoints
        for r in q("""SELECT method, path, operation_id, source_id, summary
                      FROM api_endpoints"""):
            nm = f"{r['method']} {r['path']}"
            rows.append({
                "artifact_key": f"api:{r['source_id']}.{r['method']}.{r['path']}".lower()[:400],
                "module": "api", "kind": "api", "name": nm,
                "body_text": _body(nm, r["operation_id"], r["summary"], r["path"]),
                "subtitle": f"{r['source_id']} · {r['summary'] or r['operation_id'] or ''}"[:1000],
                "project_id": None, "is_pii": "N",
                "nav_module": "api", "nav_tab": "Sources", "nav_id": (r["source_id"] or "")[:400],
                "nav_extra": nm[:400],
            })

        # 8b. API request/response FIELDS (business meaning of each field)
        for r in q("""SELECT endpoint_key, field_name, description, data_type,
                      NVL(is_pii,'N') is_pii FROM api_fields
                      WHERE description IS NOT NULL"""):
            rows.append({
                "artifact_key": f"apifield:{r['endpoint_key']}.{r['field_name']}".lower()[:400],
                "module": "api", "kind": "api_field", "name": r["field_name"],
                "body_text": _body(r["field_name"], r["description"], r["data_type"]),
                "subtitle": f"API field · {r['description'] or ''}"[:1000],
                "project_id": None, "is_pii": r["is_pii"],
                "nav_module": "api", "nav_tab": "Business Flow",
                "nav_id": (r["endpoint_key"] or "")[:400], "nav_extra": r["field_name"][:400],
            })

        # 8c. API endpoint ERRORS (business exceptions + descriptions)
        for r in q("""SELECT endpoint_key, error_code, business_exception, error_details
                      FROM api_endpoint_errors"""):
            desc = r["business_exception"] or r["error_details"]
            if not desc:
                continue
            rows.append({
                "artifact_key": f"apierr:{r['endpoint_key']}.{r['error_code']}".lower()[:400],
                "module": "api", "kind": "api_error", "name": r["error_code"],
                "body_text": _body(r["error_code"], r["business_exception"], r["error_details"]),
                "subtitle": f"API error · {desc}"[:1000],
                "project_id": None, "is_pii": "N",
                "nav_module": "api", "nav_tab": "Business Flow",
                "nav_id": (r["endpoint_key"] or "")[:400], "nav_extra": r["error_code"][:400],
            })

        # 8d. API business FLOWS (flow name + goal)
        for r in q("""SELECT flow_id, flow_name, business_domain, goal
                      FROM bf_api_flows"""):
            rows.append({
                "artifact_key": f"apiflow:{r['flow_id']}".lower()[:400],
                "module": "api", "kind": "flow", "name": r["flow_name"] or r["flow_id"],
                "body_text": _body(r["flow_name"], r["goal"], r["business_domain"]),
                "subtitle": f"business flow · {r['goal'] or r['business_domain'] or ''}"[:1000],
                "project_id": None, "is_pii": "N",
                "nav_module": "api", "nav_tab": "Business Flow", "nav_id": (r["flow_id"] or "")[:400],
            })

        # 8e. Data PIPELINES (name + domain + routing)
        for r in q("""SELECT pipeline_id, pipeline_name, business_domain, archetype
                      FROM bf_pipelines"""):
            rows.append({
                "artifact_key": f"pipeline:{r['pipeline_id']}".lower()[:400],
                "module": "data", "kind": "pipeline", "name": r["pipeline_name"] or r["pipeline_id"],
                "body_text": _body(r["pipeline_name"], r["business_domain"], r["archetype"]),
                "subtitle": f"pipeline · {r['business_domain'] or ''}"[:1000],
                "project_id": None, "is_pii": "N",
                "nav_module": "data", "nav_tab": "Pipelines", "nav_id": (r["pipeline_id"] or "")[:400],
            })

        # 9. PII attributes
        for r in q("""SELECT pii_attribute, pii_component, sensitivity_category
                      FROM pii_classifications"""):
            rows.append({
                "artifact_key": f"pii:{r['pii_attribute']}".lower()[:400],
                "module": "pii", "kind": "pii", "name": r["pii_attribute"],
                "body_text": _body(r["pii_attribute"], r["pii_component"], r["sensitivity_category"]),
                "subtitle": f"{r['sensitivity_category'] or 'PII'} · {r['pii_component'] or ''}"[:1000],
                "project_id": None, "is_pii": "Y",
                "nav_module": "pii", "nav_tab": None, "nav_id": (r["pii_attribute"] or "")[:400], "nav_extra": None,
            })

        # 10. LEGACY business definitions (AddVantage/CRD/STAR) -> route to Lineage.
        #     nav_module 'lineage'; nav_id carries the source system so the page
        #     opens the right badge; nav_extra carries the normalized field code
        #     so the field's business-def popup can open on arrival.
        for r in q("""SELECT source_system, field_code, field_code_norm, business_term,
                             business_function, master_name, short_desc, is_pii
                      FROM legacy_dictionary"""):
            rows.append({
                "artifact_key": (f"legacydef:{r['source_system']}.{r['field_code_norm']}"
                                 f".{(r['master_name'] or '').replace(' ', '_')}").lower()[:400],
                "module": "lineage", "kind": "legacy_def",
                "name": r["business_term"] or r["field_code"],
                "body_text": _body(r["business_term"], r["field_code"], r["field_code_norm"],
                                   r["business_function"], r["master_name"], r["short_desc"]),
                "subtitle": (f"{r['master_name'] or ''} · {r['business_function'] or ''}"
                             f" · {r['source_system']} · field {r['field_code']}")[:1000],
                "project_id": None, "is_pii": r["is_pii"] or "N",
                "nav_module": "lineage", "nav_tab": r["source_system"],
                "nav_id": (r["field_code_norm"] or "")[:400],
                "nav_extra": (r["field_code"] or "")[:400],
            })

        # merge all rows (byte-safe truncation for Oracle byte-length limits)
        def _btrunc(val, max_bytes):
            if not isinstance(val, str):
                return val
            b = val.encode("utf-8")
            if len(b) <= max_bytes:
                return val
            return b[:max_bytes].decode("utf-8", "ignore")

        limits = {"subtitle": 1000, "name": 400, "artifact_key": 400,
                  "nav_id": 400, "body_text": 4000}
        for row in rows:
            for k, mx in limits.items():
                if k in row:
                    row[k] = _btrunc(row[k], mx)
            loader._merge("search_index", ("artifact_key",), row)
        loader.commit()

        # sync + optimize the Oracle Text index (explicit, in addition to ON COMMIT).
        # Needs EXECUTE on CTX_DDL. If absent, the index still stays current via the
        # SYNC (ON COMMIT) parameter set at CREATE INDEX time — so this is optional.
        try:
            cur.execute("BEGIN CTX_DDL.SYNC_INDEX('IX_SEARCH_BODY'); END;")
            cur.execute("BEGIN CTX_DDL.OPTIMIZE_INDEX('IX_SEARCH_BODY', 'FULL'); END;")
            conn.commit()
            log.info("search_index: synced + optimized Oracle Text index")
        except Exception as e:
            msg = str(e)
            if "PLS-00201" in msg or "must be declared" in msg or "CTX_DDL" in msg:
                log.info("search_index: manual CTX optimize skipped (no EXECUTE on CTX_DDL); "
                         "index stays current via SYNC(ON COMMIT). To enable periodic "
                         "optimize, grant EXECUTE ON CTX_DDL to this schema.")
            else:
                log.warning("search_index: CTX sync/optimize skipped: %s", e)

        log.info("search_index: indexed %d artifacts", len(rows))
