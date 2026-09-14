# CP 360° — Final Build (consolidated)

Complete CP Catalog codebase for BBH Capital Partners, rebranded **CP 360°**, with every
feature from the recent build sessions. Built on the uploaded FINAL-6 base; additive.

## Branding
- **CP 360° logo** in the top nav (`AppShell.jsx`): a filled gradient circle with "CP", "360°"
  set above it, and a "CP 360°" wordmark with the degree symbol.
- **New home / overview page** (`LandingPage.jsx`): hero band ("The 360° view of Capital
  Partners' data estate"), then **module cards** (the six explorers, click to navigate), then
  a **KPI row**. Counts pull live from the API. (Projects and Migration sections removed per request.)

## Catalog features
- **Grouped collapsing sidebar** — Catalog / Governance / Architecture; auto-collapses on narrow
  viewport and on graph-heavy screens; manual toggle.
- **Quality Guardrails** (new screen + router + 7 synthetic events): attention list → what
  happened → root cause → the bad rows; engines labelled Validation / Monitoring / Transformation
  Tests / Orchestration.
- **Feed / Loader Interdependency** (new tab in Data 360): swimlane + hub views for both feeds and
  loaders; shared-key edges carry each key's business description + a match/mismatch check.
  - **Collapsible domain lanes** (+ Collapse-all / Expand-all)
  - **Edge bundling** — parallel edges converge into cables
  - **Hide within-domain edges** by default (toggle to show) — the biggest de-clutter
- **Domain grouping with collapse/expand** on Inbound Feeds and Loaders; domain grouping on API 360.
- The existing **technical pipeline view** (Airflow orchestration + dbt bronze→silver→gold models
  with model-click detail: materialization, transformation SQL, column lineage, quality rules) and
  the **3-plane Lineage Graph canvas** are intact and unchanged.

## Reliability fix
- **`api.js` no longer latches to demo/mock mode** on a single failed/slow call (this caused
  screens to go empty after navigating away and back). Each call retries the network; timeouts
  raised to 15s/20s. Fingerprint: grep `we do NOT permanently latch`.

## SQL you can run
- `sql/24_quality_guardrails.sql` — guardrail_events table (idempotent).
- `sql/interdependency_data_quality.sql` — 6 diagnostics: which key fields exist, naming variants
  that won't match, missing descriptions, description mismatches, domain coverage, edge density.
- `sql/backfill_domains.sql` — infers business domain from feed/loader names to fill empty
  domain/tags columns so grouping works (this is why feeds were all showing "Other/Unassigned").
  Run this, restart uvicorn, hard-refresh. Edit the CASE branches to match your real taxonomy.

## Run
1. Schema: apply `sql\*.sql` in order (now includes 24 + the diagnostic/backfill scripts).
2. `sqlplus ... @sql\backfill_domains.sql` to populate domains (SET DEFINE OFF is built in).
3. Ingest: `python -m ingestion.run` (or `python -m ingestion.run guardrails` for just the events).
4. API: `uvicorn app.main:app --app-dir api --port 8000`
5. UI: `cd ui && npm run dev` — **restart Vite + hard-refresh** so the new bundle loads.
6. Confirm with `curl localhost:8000/diag` (row counts) and the DEMO/LIVE badge.

## Validation performed
- All 44 Python files parse; all changed JSX balanced; api.js passes `node --check`; imports resolve.
- Structural validation only — Vite/uvicorn/Oracle can't run in the build sandbox, so runtime
  behavior (empty-data edge cases, layout, field-name mismatches vs your real data) still needs a
  live check. Watch `/diag` and the LIVE badge to distinguish "no data" from "broken backend".
