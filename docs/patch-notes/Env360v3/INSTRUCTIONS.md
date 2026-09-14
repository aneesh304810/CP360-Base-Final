# Environment 360 update — impacted files only
13 files. Your Environment360.jsx, api.js, AppShell, routers_environment360,
and SQL 39 are NOT touched (SQL 40 is superseded — drop when convenient).

## Files -> where they go
sql/43_env_infra.sql            run in SILVER (inventory + hist + v_env_infra_tbd)
sql/44_env_probe.sql            run in SILVER (probe registry + results + v_env_probe_live)
sql/45_env_ssl.sql              run in SILVER (ssl_expiry + observed + v_env_ssl_status)
api-app/*.py (6)                -> api/app/
ingestion/env_infra_ingest.py   -> ingestion/
sample_artifacts/cp_env_infrastructure.tsv -> sample_artifacts/
ui-src/Environment360_additions.jsx        -> ui/src/
ui-src/env360_infra_api_additions.js       -> ui/src/

## Edits in YOUR files (5 small ones)
1. api/app/main.py — add "routers_env_infra" to the guarded router tuple.
2. ingestion/run.py — register the step:
     from ingestion import env_infra_ingest
     STEPS["env_infra"] = env_infra_ingest.run
3. ui/src/api.js — append the exports from env360_infra_api_additions.js and
     spread into api:   export const api = { ...existing, ...envInfraApi };
4. ui/src/Environment360.jsx —
     import { InventoryTab, SslSummaryCards, NetworkBoard } from "./Environment360_additions";
     tabs: add ["inventory", "Inventory"]
     render: {tab === "inventory" && <InventoryTab t={t} onChanged={refresh} />}
     Overview(): add <SslSummaryCards t={t} onDrill={() => setTab("certs")} />
                 in the KPI grid, and <NetworkBoard t={t} /> after the group grid.
5. (optional) load.ps1 — only if it doesn't dispatch by step name already.

## Environment variables (set once)
   CP_CATALOG_DB_DSN    = user/pwd@host:2483/service          (required — API, step, daemon)
   CP_SAMPLE_ARTIFACTS  = D:\cp360\sample_artifacts          (dir holding cp_env_infrastructure.csv/.tsv/.xlsx)
   CP_ENV_WORKBOOK      = D:\drops\sheet.xlsx                (optional — exact file, overrides the dir)
Resolution: --file > CP_ENV_WORKBOOK > CP_SAMPLE_ARTIFACTS > repo sample_artifacts/.
A load.ps1 is included (merge into yours if you already have one).

## Bring it alive (in order)
1. SQL 43, 44, 45.
2. Deploy API with the new files + tuple edit.
3. First ingest (either):   .\load.ps1 env_infra        (uses sample_artifacts)
   or  $env:CP_ENV_WORKBOOK="D:\drops\sheet.xlsx"; .\load.ps1 env_infra
   Expect: +40 rows · 68 probes regenerated · 16 ARMED / 52 WAITING.
4. Start the pulse:
     nohup python api/app/env_probe_daemon.py --interval 300 > env360_daemon.log 2>&1 &
   (needs CP_CATALOG_DB_DSN + network egress to targets; first cycle = connectivity audit)
5. Deploy UI. Verify: Inventory tab lists 10 rows/env from DB · edit a TBD
   port -> Save -> banner shows probes ARMED · board lane ? -> i, first real
   result within one cycle · SSL card appears when ssl_expiry dates are set.

## Ongoing operation
- Scripted loads: load.ps1 env_infra (diff + hist + probe regen, all-or-nothing)
- UI edits: Inventory ✎ Save = PUT /env-infra/row · 🗑 = DELETE (same hist+regen)
- Workbook round-trip: Inventory ⬇ exports the DB · edit in Excel · ⬆ imports
- Nothing is hardcoded anywhere: DB is the only source of truth.
