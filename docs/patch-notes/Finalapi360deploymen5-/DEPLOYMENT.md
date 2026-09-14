# API 360 Console · Consolidation — FINAL DEPLOYMENT PACKAGE
One catalog (your Api360Connector tables) · one pipeline (the connector over
the artifacts tree) · two consumers (API 360 design-time, Console runtime)
· two flow doors (API 360 + New Flow = BA access; Admin composer = admin).

## Deploy in this order
1. SQL on SILVER (as A041327), both idempotent:
     sql/37_api360_consolidation.sql   (versions, bindings, drift, widths)
     sql/38_api360_admin_ux.sql        (system registry overlay, manifest)
   Leave the commented DROP block in 37 alone until step 6.
2. ingestion/ — deploy all six files; DELETE api_contract_ingest.py.
   api360_conn.py is YOUR connector + 3 grafts (CONNECTOR_DIFF.md is the
   50-line review; api360_conn.py.orig is your untouched original).
3. api/app/ — routers_api360_console.py (40 endpoints). Confirm the main.py
   mount tuple includes routers_api360_console (+ routers_recon360,
   routers_admin_datasources). Restart uvicorn FROM THE REPO ROOT.
4. ui/src/ — Api360Console.jsx, api.js, mockData.js. Vite hot-reloads.
5. Apply API360_PATCH_NOTES.md to YOUR files (bf/api-flows project filter,
   Api360.jsx Non-SEI fix). Then verify:
     /apicon/catalog/systems → sei · 197 sources
     upload a spec → lands in tree → v1 in api_spec_versions
     re-upload w/ breaking change → DRIFT + note → Acknowledge clears
     Collection Builder picker/typeahead from api_endpoints
     Flow Builder: compose → Test → sign-off → Publish → Guided tile;
       BA flow from API 360 appears docs-only; bindings make it runnable
     API 360 business-function detail renders identically
6. ONLY THEN uncomment + run the guarded DROP block in 37
   (api_contracts / api_systems / api_ingest_sources).
   NEVER drop api_flows / api_flow_steps.

## Scheduled jobs
  collections:  python -m ingestion.api_console_runner --tag daily --env SEI_QA --fail-nonzero
  drift scan:   python -m ingestion.api_catalog_ingest scan          (nightly)
  URL manifest: python -m ingestion.api_catalog_ingest manifest     (if used)
All run from the REPO ROOT with CP_CATALOG_DB_DSN + CP_CATALOG_ROOT set.

## Mockups (reference, not deployables)
  api360_merged_mockup.html   three-screen consolidation acceptance mockup
  flowbuilder_mockup.html     Flow Builder list + composer walkthrough
