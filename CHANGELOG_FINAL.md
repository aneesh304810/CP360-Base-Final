# CP Catalog BBH — Final Build Changelog

All fixes from this session, folded into one codebase. Validated: 41 Python files,
16 React components, 22 SQL scripts, mockup balanced.

## INGESTION / SQL FIXES (from the live runs)

1. **sql/21 — TRIGGER reserved word**
   `bf_api_flows.trigger` renamed to `trigger_event` (TRIGGER is Oracle-reserved and
   aborted the whole CREATE block, cascading to ORA-00942 on bf_pipelines + the view).

2. **feed_catalog_conn — columns schema**
   Feed fields now map to the REAL columns schema
   (platform_id, schema_name, object_name, column_name) instead of the assumed
   dataset_key/name. Fixed ORA-00904 "T"."NAME".

3. **loader_workbook_conn — columns schema**
   Loader attributes map to the real schema
   (platform_id=SWP, schema_name=LOADERS, object_name=loader_id, column_name=attr).

4. **datapoint_indexer — columns + api_fields scan**
   Reads column_name + computed dataset_key (was name/dataset_key/project_id);
   api_fields scan dropped project_id. This was the ROOT of the cascade — once fixed,
   dp_registry went 0 -> 1,513 data points.

5. **datapoint_indexer — PII scan**
   pii_field_matches read via matched_field_name + sensitivity_category
   (was column_name/pii_category). PII flags now attach to data points.

6. **search_index_builder — byte-safe truncation**
   Fields truncated by BYTES not chars before merge (a multibyte middot pushed
   subtitle to 1002 bytes > 1000). Fixed ORA-12899.

7. **search_index_builder — PII query + CLOB**
   pii_classifications read via pii_component + sensitivity_category; CLOB descr
   .read() to str before slicing.

8. **feed_dictionary_conn — hyperlink workbook**
   Loaded with read_only=False so cell.hyperlink is exposed; guarded the access.
   Fixed 'ReadOnlyCell has no attribute hyperlink'.

9. **reference_data_conn — category forward-fill**
   Blank category inherits the last non-blank one (handles section-header layout
   where category is named once atop a block).

10. **sql/07_api360 + sql/23 — error_code widened**
    api_endpoint_errors.error_code VARCHAR2(60) -> VARCHAR2(400). sql/23 is a guarded
    MODIFY for existing installs. Fixed ORA-12899 (124 > 60).

11. **search_index_builder — CTX_DDL graceful**
    Missing EXECUTE on CTX_DDL now logs a clear info note (index stays current via
    SYNC ON COMMIT) instead of a scary PLS-00201 stack trace.

## API FIXES

12. **main.py — routers mounted**
    All six routers (projects, data360, data360_pipelines, api360, interface360, pii)
    are now include_router()'d in a guarded loop. They existed but were never mounted,
    causing 404s on every /projects, /data360, /api360, /interface360, /pii call.

13. **db.py — DSN parser**
    _parse_dsn now accepts sqlplus-style user/pwd@host:port/service (what you use),
    plus oracle://, user:pwd@host, and host-only. Previously ONLY accepted oracle://,
    so the API couldn't connect and the UI silently fell back to MOCK data — the real
    reason screens looked wrong.

14. **main.py — /diag endpoint**
    GET /diag returns row counts per feature (datasets, columns, dp_registry,
    bf_pipelines, reference_data, search_index, ...) to prove the API sees real data.

15. **main.py + connector — trigger_event alias**
    API selects `trigger_event AS trigger` so the UI contract is unchanged.

16. **main.py — v20 routing columns**
    /bf/pipelines returns routing_pattern, compressed_routing, legacy_feed_routing.

## v20 BUSINESS FLOW (from the workbook work)

17. **business_flow_conn — v20 columns**
    Captures Routing_Pattern, Compressed_Routing, Compression_Action,
    Notes_Compression, Legacy_Feed_Routing (the migration routing story per pipeline).

18. **business_flow_conn — _v2 sheet folding**
    Compression_Plan_v2 + Compression_Summary_v2 fold into their base tables (parse
    now MERGES rows from multiple sheets mapping to one canonical key, was overwriting).

19. **business_flow_conn — Linked_API_Flow_ID coverage check**
    Reports pipelines with missing/unmatched Linked_API_Flow_ID (not assigned to a
    compression mart).

## REFERENCE DATA (new layer)

20. **reference_data — full layer**
    New sql/22 + reference_data_conn + /reference/* endpoints. Attaches authoritative
    descriptions to data points by category+field. Datapoint 360 gets per-datapoint
    reference descriptions AND a Browse-by-Category view.

## MOCKUP

21. **Interface 360 — Explorer tab (NEW)**
    Progressive drill-down: source system -> integration -> target -> detail, revealing
    one column at a time (no clutter). Multi-hop routes surfaced (e.g. via PBDW).

22. **Live/Demo data indicator + Data Health panel**
    Header chip shows LIVE vs DEMO (mock fallback); click for /diag-style row counts.

23. **v20 Migration Routing Story**
    Datapoint/pipeline detail shows Routing Pattern, Legacy Routing, Compressed Routing,
    Compression Action, Rationale.

## RUN ORDER (unchanged, handled by run.py)
```
projects, oracle, feed_dictionary, feed_catalog, loader_catalog, loader_workbook,
dbt, glossary, airflow, pii_classification, pii_match,
  -> datapoint_index                (builds dp_registry)
  -> business_flow, reference_data  (resolve vs dp_registry)
  -> search_index                   (indexes everything, last)
api360 runs where configured.
```

## QUICKSTART
```powershell
C:\SEI\seiml\Scripts\Activate.ps1
cd C:\SEI\bbhcatalog\Fullcp360
# 1. schema (idempotent)
Get-ChildItem sql\*.sql | Sort-Object Name | % { sqlplus -S <dsn> "@$($_.FullName)" }
# 2. set DSN + load
$env:CP_CATALOG_DB_DSN = "SILVER/pw@host:1521/SERVICE"
.\local\load-all.ps1
# 3. API (same shell / DSN set)
uvicorn app.main:app --app-dir api --port 8000
# 4. confirm real data
curl http://localhost:8000/diag
# 5. UI
cd ui ; npm install ; npm run dev   # http://localhost:5173
```

## VERIFY DATA IS LIVE (not mock)
- curl http://localhost:8000/diag  -> expect bf_pipelines 444, dp_registry ~1513,
  reference_data ~197, search_index ~6570.
- Open http://localhost:5173 (NOT the file:// mockup) with API running.
- Browser Network tab: /api/... calls return 200 with real rows.
