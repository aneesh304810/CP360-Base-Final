# ENVIRONMENT 360 — FINAL CODEBASE (all changes, one apply)
End state: 4 tabs — Overview (gradient KPIs + rules-TBD card + cluster board with
zoom/fit/full-screen) · Health checks (live, inventory-synced, sparklines) ·
Certificates (horizon timeline, dual-source register, unmonitored-443) ·
Inventory. Per-host workbook format preserved in DB + download. Pulse, old
Topology, and Network tabs removed.

## SQL (run once each, guarded/idempotent)
sql/46_env_network.sql        cols + env_rule + v_env_rulebase (run_ts fix in)
sql/47_env_infra_host.sql     per-host child table

## Overwrite
ui/src/Environment360.jsx             4-tab shell
ui/src/Environment360_additions.jsx   NetworkBoard v2 (auto-router + zoom/fit/
                                      full-screen toolbar, Ctrl+wheel, Esc) +
                                      HealthTab + CertsTab + InventoryTab +
                                      SslSummaryCards + RulesTbdCard
ui/src/env360_infra_api_additions.js  envInfraRules etc (DEMO->LIVE)
api/app/env_infra_loader.py           3 formats (per-host/explicit/legacy),
                                      host_rows kept, per-host export
api/app/routers_env_infra.py          + /env-infra/rules · /env-infra/hosts ·
                                      export = per-host CSV
api/app/env_probe_gen.py              K8S probes (int ports) + PK dedupe guard
api/app/env_probe_daemon.py           k8s_check + cert_check
api/app/env_topology.py               hub-mediated lanes + 6 new NODE_MAP systems
ingestion/env_infra_ingest.py         cols UPDATE + rules MERGE + env_infra_host

## Data
sample_artifacts/cp_env_infrastructure_v4_perhost.csv   THE ingest file
  (111 host rows -> 64 systems; also v3 explicit-env variant included)

## Clean bring-alive
1. stop daemon · run sql/46 then sql/47
2. overwrite all files above · clear api\app + ingestion __pycache__
3. optional clean slate: DELETE env_probe_result, env_probe, env_rule, env_infra
   (keep env_infra_hist for audit) · COMMIT
4. $env:CP_K8S_TOKEN_DEV=<view-SA token>  (prod API URL: env_probe_gen K8S_API)
5. .\load.ps1 env_infra -file sample_artifacts\cp_env_infrastructure_v4_perhost.csv
   expect: 64 added (clean) or 0 changed (merge) · 111 host rows · 92 probes
6. restart uvicorn + daemon · hard refresh
7. verify: SELECT COUNT(*) FROM env_infra_host;  -> 111
   board shows Momentum/Ping/SaaS placed · full-screen + zoom on Overview ·
   Health groups by zone · Certs lists route 6d / portal 5d + unmonitored-443
