# CP 360 — full delivery (one zip, everything current)
Built 2026-08-05. Every file validated; JSX escape-free; zips content-hash
checked against validated sources.

## Contents
App.jsx                      wired: LineageHome + Environment360 (from your source)
APP_WIRING_PATCH.md          the App-level edits, documented
app-shell/
  AppShell.jsx               your source + Environment 360 nav entry (Admin)
                             CAUTION: your paste lost all backticks; restored.
                             Diff vs local: expect ONLY backticks + one nav line.
  api.js                     Aug-3 base + 7 env helpers appended
  navStatus.jsx              + environment MODULE_STATUS entry (amber badge)
lineage/
  ui-src/LineageHome.jsx     landing doors + scope/system badges + dictionary
                             deep-link translation + children-style SectionHeader
  ui-src/BizLineage.jsx      Business view drill
  ui-src/LegacyLineage.jsx   YOUR file with all 7 GUI patches applied
  patch docs (7)             change log only — already applied to the file above
  LINEAGE_WIRING.md / LINEAGE_DEPLOYMENT.md / lineage_final_mockup.html
environment360/
  sql/39_environment360.sql          6 tables + seeds (re-runnable)
  ingestion/env_probe_runner.py      pulse + cert scan (--certs)
  api-app/routers_environment360.py  7 endpoints
  ui-src/Environment360.jsx          5-tab UI
  ui-src/env360_api_additions.js     (already applied into app-shell/api.js)
  ui-src/env360_mockData_additions.js  PASTE into your mockData.js (5 exports)
  ENV360_WIRING.md / environment360_mockup.html

## Deploy order
0. run.py: add the missing comma between "impact_scan" and "legacy_dictionary"
   in STEPS, then: python -m ingestion.run legacy_dictionary
1. UI files -> ui/src/ (diff app-shell/* + App.jsx before overwrite if your
   local drifted): App.jsx, AppShell.jsx, api.js, navStatus.jsx,
   LineageHome.jsx, BizLineage.jsx, LegacyLineage.jsx, Environment360.jsx
2. mockData.js: paste the 5 exports from env360_mockData_additions.js
3. Environment 360 backend: run SQL 39 -> python -m ingestion.env_probe_runner
   --certs -> python -m ingestion.env_probe_runner -> mount router in main.py
4. Build + deploy UI. Retire the old Lineage.jsx wrapper once verified.

## Smoke
- Nav shows Environment 360 (Admin, amber dot); five tabs render
- Nav -> Lineage -> landing doors; 📖 -> estate rings; 🛠 -> your screen
  with popup defs + story band; search deep-link lands in Technical
- First pulse run streams DNS→TLS→HTTP→pods→ORA→FS→JOB→API

## Acceptance
Re-take the 3 lineage screenshots (table inline def · map · biz passport)
against lineage_final_mockup.html; send first real pulse findings.
