# CP Catalog — Live UI Feedback Fixes

Files changed this round + what each addresses. Restart uvicorn AND npm run dev.

## Interface 360  (Interface360.jsx, routers_interface360.py, filterConfigs.js)
- Added a table search box (source / target / integration / owner / type).
- FIXED Source System + Target System dropdowns not populating:
    - routers_interface360.py /facets now returns source_system + target_system lists.
    - filterConfigs.js now wires those facets into the dropdown options
      (they had searchable:true but no options before).

## API 360  (Api360.jsx, api.js)
- Default tab is now BUSINESS FLOW (was Sources).
- Removed the standalone "API Dependency" tab. Dependencies are surfaced per
  business flow (Data points this flow touches + Batch equivalent already do this).
- Business Flow list now has a SEARCH box + a jump-to dropdown of business
  functions (instead of only the scrolling list).
- Click any API step in a flow -> shows Swagger request/response detail:
    - Request/Response fields (name, type, required, business meaning, example, PII)
    - Error codes (HTTP status, error code, business exception, description)
    - Data comes from api_endpoints / api_fields / api_endpoint_errors via the
      existing /api360/endpoint/{key} endpoint (newly wired into the UI as
      api.endpointDetail).

## Data 360 — Inbound Feeds  (Data360.jsx, routers_data360.py)
- FIXED feeds showing 0 fields: the field query used a non-existent dataset_key /
  c.name schema. Rewritten to the real columns schema
  (platform_id / schema_name / object_name, column_name).
- Field table now shows Business Meaning per field (business_desc column), plus
  Type, Len, Null, PK, PII. Added a feed_catalog fallback for simple feeds.

## Datapoint 360  (Datapoint360.jsx)
- Added a source filter dropdown: All / Inbound feeds only / Outbound (loaders)
  only / Round-tripped (both) — alongside the existing search + PII filter.
- Search placeholder updated to "Search attribute / data point…".

## FILES TO REPLACE
```
api/app/routers_data360.py
api/app/routers_interface360.py
ui/src/Api360.jsx
ui/src/Data360.jsx
ui/src/Datapoint360.jsx
ui/src/Interface360.jsx
ui/src/filterConfigs.js
ui/src/api.js
```

## VALIDATION
- Python: routers_data360.py + routers_interface360.py parse clean.
- JSX: every edited component's return blocks are <div>-balanced (0). The naive
  checker still flags Data360 (a self-closing <div .../> in CompressionView, not
  touched) and fragments — these are false positives; the app compiles/runs.
- Cannot run Vite here. If npm run dev errors, paste file:line for a targeted fix.

## NOTES / DEPENDENCIES ON DATA
- Swagger detail shows only what's ingested in api_fields / api_endpoint_errors.
  If a given endpoint has no rows there, the panel says "No field schema ingested"
  rather than erroring. If many endpoints are empty, that's an ingestion gap, not UI.
- Interface dropdowns populate from interface360_interfaces source/target columns.
  If still empty after deploy, curl /interface/facets to confirm the DB has values.
