# CP 360 — full codebase drop · Lineage + Environment 360
Two independent modules; deploy in any order. Nothing in one depends on the
other. Both follow the house conventions: FastAPI router + Oracle SILVER +
React inline-styled UI with DEMO→LIVE fallback, impacted-files-only.

## lineage/  (11 files)
New UI: ui-src/LineageHome.jsx (landing PBDW / IMDS·IN BUILD + Business/
Technical shell) · ui-src/BizLineage.jsx (pictorial drill: estate → group →
four-dot census with Variance 360 pills/dots → column page with proof spine,
FULL dictionary long_desc, whole 3-hop transformation).
Your LegacyLineage.jsx: NOT included, NOT replaced — six ordered patch docs
instead (spacing → DefModal → roomy → smart-width → lineage-first →
xform-story). Mount edit + verification: LINEAGE_WIRING.md /
LINEAGE_DEPLOYMENT.md. Acceptance spec: lineage_final_mockup.html.
Backend changes: NONE (every call already exists).

## environment360/  (8 files)
sql/39_environment360.sql — 6 tables + seeded checks/certs (INSERT-driven).
ingestion/env_probe_runner.py — pulse engine (DNS→TLS→HTTP→SQL→FS, TLS
auto-upserts env_certificates from the live chain). First runs:
    python -m ingestion.env_probe_runner --certs
    python -m ingestion.env_probe_runner
api-app/routers_environment360.py — 7 endpoints (overview, certs+scan,
health+30d strips, topology, pulse+run).
ui-src/Environment360.jsx — five tabs incl. animated topology + ▶ PULSE.
Paste env360_api_additions.js into api.js, env360_mockData_additions.js
exports into mockData.js. Full order + schedules: ENV360_WIRING.md.

## Shared AppShell touchpoints (one edit session)
NAV_GROUPS: lineage route now mounts <LineageHome t={t} focus={...}/> ·
add ['environment','Environment 360','🖧'] under Admin →
<Environment360 t={t}/>.
navStatus.jsx MODULE_STATUS: add
  environment: { state:'wip', pct:60, works:'certs · health · pulse',
                 next:'topology seed · alert routing' },
(lineage entry: update or remove once verified — absence = shipped).

## Still open (outside this drop)
- ingestion/run.py STEPS list: missing comma between "impact_scan" and
  "legacy_dictionary" — both steps silently skip every full run. One-char fix.
- Env 360 alert notifier to #cp-environments (small follow-up on request).
- Auto Mapper build awaits: Plaid spec ingested + target + model endpoint.
