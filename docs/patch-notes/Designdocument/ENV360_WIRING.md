# Environment 360 — deployment

## Order
1. SQL:  sql/39_environment360.sql on SILVER (6 tables + seeded checks/certs;
   topology nodes/links seed via INSERTs — copy positions from the mockup or
   start empty, the UI says so honestly).
2. Ingestion: ingestion/env_probe_runner.py. First runs:
     python -m ingestion.env_probe_runner --certs     # populate cert data
     python -m ingestion.env_probe_runner             # first pulse
3. API: api-app/routers_environment360.py → mount routers_environment360 in
   main.py, restart uvicorn from repo root. Smoke: /env/overview.
4. UI: ui-src/Environment360.jsx → ui/src/. Paste the 7 helpers from
   env360_api_additions.js into api.js and the 5 exports from
   env360_mockData_additions.js into mockData.js. Route: add
   ['environment','Environment 360','🖧'] to NAV_GROUPS (Admin) in
   AppShell.jsx, case 'environment' → <Environment360 t={t}/> in App, and
   an entry in navStatus.jsx MODULE_STATUS:
     environment: { state:'wip', pct:60, works:'certs · health · pulse',
                    next:'topology seed · alert routing' },

## Scheduled jobs (repo root, DSN + CP_CATALOG_ROOT set)
  hourly:   python -m ingestion.env_probe_runner            # the pulse
  daily:    python -m ingestion.env_probe_runner --certs    # deep cert scan
Or as an Airflow DAG with two tasks on the same schedule.

## Notes
- Probe kinds: DNS · TLS · HTTP · SQL · FS. The mockup's AIR/JOB/API checks
  are SQL/HTTP rows (see seeds H07/H09) — adding a check is an INSERT.
- TLS probes auto-upsert env_certificates from the live chain — the cert
  table is never hand-maintained.
- HTTP probes use verify=False (internal CA); the TLS check validates the
  chain separately, so trust checking is not lost.
- Alert routing (#cp-environments) is a follow-up: a small notifier reading
  env_check_results WHERE status != 'OK' — say the word.

## SEI Build-out inventory (added)
- sql/40_env_inventory.sql : env_inventory table + the provisioning tracker's
  rows (PBDW/IMDS/Pivotal/CRD/Client Portal/PORT) + DNS checks H20-H32 for
  every NEW SEI host. Run after sql/39. Re-runnable; to refresh from a new
  tracker version, update the MERGE values and re-run.
- /env/inventory endpoint (in the router) returns rows + latest SEI DNS results
- UI gains a 6th tab "SEI Build-out": platform cards, existing vs new hosts,
  sizing, status chips, and the DNS-proof pill (tracker claims vs pulse proves)
- api.js gains envInventory (already applied in app-shell/api.js);
  mockData needs the envInventory export from env360_mockData_additions.js

## SWP Topology mockup (added)
swp_topology_mockup.html — the Target Architecture slide as a LIVE, region-aware
topology: DEV/SIT/UAT/PROD switcher, every node bound to inventory hosts, IPs
from the latest DNS probe result, status badge per node, region-scoped health
check table beneath. Serves as the spec for extending the Topology tab with a
region dimension (env_nodes gains region + inv_id columns — follow-up SQL 41).
