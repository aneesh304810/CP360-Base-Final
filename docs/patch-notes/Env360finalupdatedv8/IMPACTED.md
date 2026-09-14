# ENVIRONMENT 360 — FINAL BUILD (v5 workload-grained)
11 impacted files + SQL. Everything else in your repo untouched.
Pre-flight verified: every file feature-checked before this seal.

## Files -> destinations
ui/src/        Environment360.jsx · Environment360_additions.jsx ·
               env360_infra_api_additions.js
api/app/       env_infra_loader.py · env_probe_gen.py · env_probe_daemon.py ·
               env_topology.py · routers_env_infra.py
ingestion/     env_infra_ingest.py
SILVER         sql/46_env_network.sql · sql/48_env_workload.sql
               (47 superseded — skip; 48 drops its table)

## CLEAN INGESTION (recover from any half-applied state)
0. Stop the probe daemon. Overwrite the 9 code files. Run SQL 46 then 48.
1. Clear bytecode (stale pycache caused repeated failures today):
   Remove-Item -Recurse -Force api\app\__pycache__, ingestion\__pycache__ -ErrorAction SilentlyContinue
2. LANDING CHECKS — do not skip; every failure today was a stale copy:
   Select-String -Path ui\src\Environment360.jsx        -Pattern "RulesTbdCard"     # must hit
   Select-String -Path ui\src\Environment360.jsx        -Pattern "envPulse"         # must NOT hit
   Select-String -Path api\app\env_topology.py          -Pattern "hub-piv"          # must hit
   Select-String -Path api\app\env_probe_gen.py         -Pattern "setdefault"       # must hit
   Select-String -Path ingestion\env_infra_ingest.py    -Pattern "env_workload"     # must hit
3. Wipe (children -> parents; KEEP env_infra_hist = audit trail):
   DELETE FROM env_probe_result;   -- optional: keep for latency/cert history
   DELETE FROM env_probe;
   DELETE FROM env_rule;
   DELETE FROM env_workload;
   DELETE FROM env_infra;
   COMMIT;
4. Environment (in BOTH the loader shell and the daemon shell):
   $env:CP_CATALOG_DB_DSN = "user/pwd@host:1521/service"
   $env:CP_K8S_TOKEN_DEV  = "<view-SA token>"
5. One ingest of the v5 workbook (loader auto-detects the header):
   .\load.ps1 env_infra -file <path>\cp_env_infrastructure_v5.csv
   Expect: systems ADDED · workload rows inserted · column-shifted rows
   repaired: N · probes regenerated (AIRFLOW + K8S:deployment/job + TLS +
   TCP; NetworkRange documented-not-probed) · no PK violation possible.
6. Verify in SQL before starting services:
   SELECT env, COUNT(*) FROM env_infra GROUP BY env;
   SELECT COUNT(*) FROM env_workload;
   SELECT kind, state, COUNT(*) FROM env_probe GROUP BY kind, state;
7. Restart uvicorn · start daemon (python api\app\env_probe_daemon.py) ·
   hard refresh (Ctrl+Shift+R).
8. Verify UI: Overview = KPIs + rules-TBD card + animated cluster board
   (zoom / ⤢ full screen; hub expands to real workloads) · Health checks
   live per-workload incl Airflow components · Certificates horizon +
   unmonitored-443 · Inventory ✎ opens the enterprise modal w/ workload grid.

Re-runs of step 5 are idempotent (0 added · 0 changed). The uploaded file is
the COMPLETE truth — partial sheets delete what they omit.
Known open item: routers_environment360 absent from main.py tuple ->
/env/overview 404s harmlessly (panels show demo) until re-added.
