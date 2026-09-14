# CP Catalog — 5 Mockup Gaps Now Built

All 5 remaining mockup features are now in the React UI + API. Files to replace below.

## 1. Datapoint 360 — Interdependence (co-occurrence + impact)
- api/app/routers_data360.py — /data360/datapoint/{name} now returns:
    - cooccurrence: data points that share a feed/artifact with this one
    - impact: artifacts/modules that depend on this data point
- ui/src/Datapoint360.jsx — two new sections in the datapoint detail:
    - "Interdependence — co-occurrence" (chips: datapoint + shared count)
    - "Interdependence — impact" (table: module badge + artifact + direction)

## 2. API 360 — flow -> datapoints + batch-equivalent
- api/app/main.py — /bf/api-flow/{flow_id} now returns:
    - datapoints: the data points the flow touches (Flow_Datapoint_Map)
    - batch_equivalent: Data 360 pipelines linked via linked_api_flow_id
    - compression_mart: the gold mart they compress into
- ui/src/Api360.jsx — flow detail now shows:
    - "Data points this flow touches -> Datapoint 360" (chips, gap-flagged)
    - "Batch equivalent" table (pipeline, domain, schedule, target, routing)

## 3. Data 360 — Data quality rules
- api/app/routers_data360_pipelines.py — /data360/pipelines/{id}/model/{model}
  now returns quality_rules derived from column metadata:
    - not_null on required columns, unique + not_null on keys/ids,
      accepted_values where reference data exists, PII gates on sensitive cols
- ui/src/Data360.jsx — ModelDetail now shows a "Data quality rules
  (dbt tests + Soda/GE gates)" table with column/test/gate/severity.

## 4. Interface 360 — Multi-hop routing
- ui/src/Interface360.jsx — the Explorer detail card now renders a
  "Multi-hop route" chain (e.g. SEI SWP -> PBDW -> Client Portal) when the
  routing names an intermediate warehouse, plus the Routing field.

## 5. Data 360 — Lineage Canvas (from prior step)
- ui/src/LineageCanvas.jsx (NEW) + ui/src/Data360.jsx Detail<->Canvas toggle.

## FILES TO REPLACE
```
api/app/main.py
api/app/routers_data360.py
api/app/routers_data360_pipelines.py
ui/src/Datapoint360.jsx
ui/src/Api360.jsx
ui/src/Data360.jsx
ui/src/Interface360.jsx
ui/src/LineageCanvas.jsx      (NEW)
```
Or use cp-catalog-bbh-FINAL.zip (everything folded in).

## AFTER REPLACING
Restart API (uvicorn) and UI (npm run dev). No schema/ingestion changes needed —
all new data is derived from tables you already loaded.

## VALIDATION NOTE
All files pass Python ast.parse (backend) and JSX structural checks (paren/bracket
balanced; the only "imbalances" flagged are literal parentheses inside display text
like "(dbt tests + Soda/GE gates)", which are valid JSX text, not code). The real
confirmation is Vite compiling on `npm run dev` — if any syntax slips through, the
terminal will show the exact line and I'll fix it immediately.
