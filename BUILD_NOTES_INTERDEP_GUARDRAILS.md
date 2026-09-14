# CP Catalog BBH — Build Notes (Sidebar Nav + Guardrails + Interdependency)

This build adds the features designed in the mockup sessions on top of the
uploaded FINAL-6 codebase. Everything is additive; existing screens are unchanged
except for the two grouping enhancements noted below.

## 1. Navigation — grouped collapsing sidebar
`ui/src/AppShell.jsx` (rewritten, same props)
- Flat top-nav replaced with a grouped left sidebar: **Catalog** (Interface/API/Data/Datapoint 360),
  **Governance** (PII Explorer, Quality Guardrails), **Architecture** (System Design); Home standalone.
- Viewport auto-collapse to a 52px icon rail below 1200px; per-screen auto-collapse on Data 360
  (graph-heavy). Manual «/» toggle overrides until the next resize across the breakpoint.
- New `FullscreenPanel` export for dense canvas/graph panels (Esc or button to exit).

## 2. Quality Guardrails (new screen)
- `sql/24_quality_guardrails.sql` — `guardrail_events` table (idempotent, guarded DDL).
- `ingestion/guardrails_synth.py` — 7 synthetic events (6 failed, 1 warning) across the four
  engines, each with the failure → root-cause → bad-data chain, tied to real pipelines.
- Wired into `ingestion/run.py` as the `guardrails` step (before `search_index`).
- `api/app/routers_guardrails.py` — `/guardrails/stats|attention|event/{id}|event/{id}/bad-data`.
- `ui/src/Guardrails.jsx` — attention list → what happened → root cause → the bad rows.
- Engine labels are generic: Validation / Monitoring / Transformation Tests / Orchestration.
- Nav item added under Governance; route added in `App.jsx`.
- **Data is synthetic by design.** Replace `guardrails_synth.py` with real GE/Soda/Airflow/dbt
  connectors when ready; the event shape already matches what those engines emit.

## 3. Feed / Loader Interdependency (new tab in Data 360)
- `api/app/routers_interdependency.py` — `/data360/feed-graph` and `/data360/loader-graph`.
  Computes shared-key edges from the `columns` table (KEY_PATTERNS allowlist: account_number,
  portfolio_id, client_id, form_id, position_id, asset_id, …), cross-domain, carrying each key's
  **business description** on the edge, with a match/mismatch validation (do both feeds describe
  the key the same way?). Feeds come from `datasets(object_type='FEED')`; **loaders come from
  `columns(schema_name='LOADERS')` joined to `ldr_catalog`/`loader_catalog` for the domain**
  (loaders aren't registered as datasets rows — this was handled explicitly).
- `ui/src/Interdependency.jsx` — Swimlane flow (domain lanes, cross-lane shared-key arrows) with a
  business-story inspector on selection, plus a **Hub view toggle** (each key a hub, feeds radiate
  clustered by domain). Domain filter chips, full-screen. Works for both feeds and loaders via the
  `InterdependencyTab` toggle in `Data360.jsx`.

## 4. Domain grouping
- Inbound Feeds already grouped by domain (unchanged).
- **Loaders** list now grouped by `business_domain` with headers (`Data360.jsx`).
- **API 360** business functions now grouped by domain with headers (`Api360.jsx`).

## 5. Plumbing
- `api/app/main.py` — mounts the two new routers, widens CORS to allow POST (guardrails/flow save),
  adds `guardrail_events` and `datasets_LOADER` counts to `/diag`.

## Run
1. Apply schema: `Get-ChildItem sql\*.sql | Sort-Object Name | ForEach-Object { sqlplus -S $dsn "@$($_.FullName)" }`
   (now 01..24 — includes guardrails).
2. Ingest: `python -m ingestion.run` (or just `python -m ingestion.run guardrails` to add events to an existing DB).
3. API: `uvicorn app.main:app --app-dir api --port 8000`
4. UI: `cd ui && npm run dev`
5. Confirm data: `curl http://localhost:8000/diag` — look for `guardrail_events` > 0.

## Validation performed (and its limits)
- All 44 Python files parse (`ast.parse`).
- All changed JSX files: brackets/braces/parens balanced; block tags balanced; imports resolve.
- `api.js` passes `node --check`; all 6 new client methods map exactly to backend routes.
- Guardrails synth verified to produce 7 events.
- **Not runtime-tested** — Vite/uvicorn/Oracle can't run in the build sandbox. Structural
  correctness is verified; runtime issues (empty-data edge cases, layout, field-name mismatches
  against your real data) can only surface on deploy. The known loader-source pitfall was caught
  and fixed; watch `/diag` and the DEMO/LIVE badge to distinguish "no data" from "broken backend".

## Interdependency: honest caveat
Edges are derived automatically from shared key fields; the match/mismatch signal uses the fields'
business descriptions. Edge *quality* depends on consistent key naming across feeds/loaders — expect
to tune `KEY_PATTERNS` (and possibly add alias mapping like ACCT_NBR→account_number) after the first
run against real data.
