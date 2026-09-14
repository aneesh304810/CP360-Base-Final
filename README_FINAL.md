# CP Catalog BBH — Final Codebase

Full self-hosted data catalog for the SEI SWP migration.
Package: cp-catalog-bbh-FINAL.zip (187 files — 41 Python, 17 JSX, 22 SQL)

## STACK
- Backend: FastAPI (api/app), Oracle (oracledb thin), 22 SQL schema/ingestion files
- Frontend: React + Vite (ui/src)
- Ingestion: python -m ingestion.run [steps]

## RUN
1. DB: run sql/*.sql in order (idempotent, guarded).
2. Ingest:  python -m ingestion.run   (from repo root, venv active)
3. API:     uvicorn app.main:app --app-dir api --port 8000
4. UI:      cd ui && npm install && npm run dev   (-> :5173, proxies /api -> :8000)

Set DSN in the uvicorn shell:  $env:CP_CATALOG_DB_DSN="SILVER/pw@host:1521/SERVICE"

## FEATURES (all 6 modules)
- Home: SEI/Non-SEI filter + KPIs
- API 360: Sources, Business Flow (default), Flow Builder, produces/consumes,
  click-a-step Swagger detail (request/response fields + error codes),
  data points touched + batch equivalent per flow. Saved flows now persist AND
  refresh (merges bf_api_flows + api_business_flows).
- Data 360: Pipelines (Business/Technical), Inbound Feeds (fields + business
  meaning), Loaders (Attributes/Validations/Module Mapping/Canonical/Errors),
  Compression 444->37, Lineage Detail (Airflow + dbt Materialization/Tests/Meta +
  SQL + column graph + DQ rules) and interactive Canvas.
- Datapoint 360: Data Points + direction, Browse by Category, reference
  descriptions, interdependence (co-occurrence + impact), source filter dropdown.
- Interface 360: Table (+search), Matrix, Routing (chains: simple/multi-hop/legacy
  + search + migration gaps), Explorer drill-down. Source/Target dropdowns populate.
- Search: full-text, grouped by module, visible nav tab.

## KNOWN PENDING (1)
- Data 360 Pipeline Builder: the mockup has a "+ New Pipeline" builder
  (assemble batch stages). Backend endpoint exists (/data360/data-pipeline POST),
  but the builder UI is not yet built. API 360's Flow Builder is complete and now
  saves+refreshes correctly; the Pipeline Builder would mirror it.

## VALIDATION
- 41/41 Python files parse (ast.parse).
- 17/17 JSX files div-balanced (verified per function; CompressionView's diff-1 is a
  self-closing <div .../> progress bar, correctly balanced).
- Cannot run Vite/esbuild in the build sandbox — the live app compiles and runs
  (confirmed by screenshots). If npm run dev reports a syntax error, paste file:line.

## DIAGNOSTICS
- curl http://localhost:8000/diag  -> row counts per table (datasets_FEED,
  feed_catalog_inbound, ldr_catalog, loader_catalog, bf_*, search_index, etc.)
- curl http://localhost:8000/api360/business-flows  -> confirms saved flows persist
- curl http://localhost:8000/interface/facets  -> confirms source/target dropdowns

## DATA-DEPENDENT NOTES
- Swagger detail shows what's in api_fields / api_endpoint_errors per endpoint.
- Inbound feeds merge datasets(FEED) + feed_catalog(inbound).
- Loaders read ldr_catalog (rich workbook) first, loader_catalog fallback.
- Routing classification is heuristic (PBDW/warehouse = multi-hop, AddVantage =
  legacy); tune the regex in Interface360.jsx RoutingView if your naming differs.
