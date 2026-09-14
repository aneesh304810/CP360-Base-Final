# Impacted files ONLY — overwrite at these paths, nothing else changes
ui/src/Environment360.jsx
ui/src/Environment360_additions.jsx
ui/src/env360_infra_api_additions.js
api/app/env_infra_loader.py
api/app/routers_env_infra.py
api/app/env_probe_gen.py
api/app/env_probe_daemon.py
api/app/env_topology.py
ingestion/env_infra_ingest.py
sql/46_env_network.sql        (run once in SILVER, guarded/idempotent)

Apply: run SQL 46 -> overwrite files -> clear api/app + ingestion __pycache__
-> $env:CP_K8S_TOKEN_DEV=<token> -> .\load.ps1 env_infra -> restart uvicorn +
daemon -> hard refresh UI.
