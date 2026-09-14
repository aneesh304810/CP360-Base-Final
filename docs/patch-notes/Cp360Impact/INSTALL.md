# CP 360 — Impact Analysis + Auto Mapper drop

Impacted files only. Copy each file over the repo path (OVERWRITE where the
file exists), run the new SQL once, rebuild, hard-refresh (Ctrl+Shift+R).

| In drop | Copy to | Action |
|---|---|---|
| sql/25_impact_analysis.sql | sql/25_impact_analysis.sql | NEW — run once vs SILVER schema |
| ingestion/impact_scan_conn.py | ingestion/impact_scan_conn.py | NEW |
| ingestion/run.py | ingestion/run.py | OVERWRITE (adds `impact_scan` step; base = fixes-bundle version) |
| api-app/routers_impact.py | api/app/routers_impact.py | NEW |
| api-app/routers_mapper.py | api/app/routers_mapper.py | NEW |
| api-app/mapper_scoring.py | api/app/mapper_scoring.py | NEW |
| api-app/main.py | api/app/main.py | OVERWRITE (mounts the two routers; base = fixes-bundle version incl. legacy_lineage) |
| ui-src/ImpactAnalysis.jsx | ui/src/ImpactAnalysis.jsx | NEW |
| ui-src/AutoMapper.jsx | ui/src/AutoMapper.jsx | NEW |
| ui-src/App.jsx | ui/src/App.jsx | OVERWRITE (routes `impact`, `mapper`) |
| ui-src/AppShell.jsx | ui/src/AppShell.jsx | OVERWRITE (nav: Governance ▸ Impact Analysis, Utilities ▸ Auto Mapper) |
| ui-src/api.js | ui/src/api.js | OVERWRITE (impact*/mapper* methods; base = fixes-bundle version) |
| ui-src/mockData.js | ui/src/mockData.js | OVERWRITE (DEMO fallbacks so both pages work offline) |
| sample-artifacts/PLAID/plaid_core_exchange_fields.csv | sample-artifacts/PLAID/… | NEW — mapper demo input |

Prerequisite: your repo state = FINAL-ALL + cp360-fixes + legacy-lineage-v2
applied (this drop's OVERWRITE files were built on the fixes-bundle bases).

## Smoke test
1. `sqlplus … @sql/25_impact_analysis.sql`
2. `python -m ingestion.run` (or `--steps oracle,impact_scan`) — first run
   writes baseline snapshots only; findings appear from the second run on.
3. API: `curl :8000/impact/stats`, `curl :8000/mapper/targets`
4. UI: #impact and #mapper in the nav. With the API down, both pages render
   the demo data (Plaid → PBDW) via mockData — same DEMO→LIVE behavior as
   every other module.
5. Mapper demo: upload sample-artifacts/PLAID/plaid_core_exchange_fields.csv,
   target PBDW, Auto-map → review → Commit.

See INGESTION_GUIDE.md for ingest formats, DB connectivity and scheduling.
