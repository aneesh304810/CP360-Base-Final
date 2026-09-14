# Delta only — changed since the 18:55 impacted zip. Nothing else moved.
# SQL: NO changes — do not re-run anything.

ui-src/Environment360.jsx                YOUR file, merged (from your Aug-11 zip):
                                         additions imported, old SEI Build-out tab ->
                                         new InventoryTab, SSL card + NetworkBoard in
                                         Overview. Straight replacement (diff first if
                                         you edited it after Aug 11).
ui-src/Environment360_additions.jsx      + DEMO chips ("○ DEMO" when API unreachable)
ui-src/env360_infra_api_additions.js     + full DEMO fallback: embedded sample rows,
                                         client topology, simulated pulse; demo
                                         Save/Delete mutate the in-memory store
ingestion/env_infra_ingest.py            refactored to your run.py contract:
                                         load(conn, path=None); register with:
                                           if step == "env_infra":
                                               if not _require_env("CP_CATALOG_DB_DSN"): return
                                               from .env_infra_ingest import load as load_env_infra
                                               load_env_infra(conn)
                                               return
load.ps1                                 driver (merge the env_infra case if you have one)
sample_artifacts/cp_env_infrastructure.csv   CSV variant (loader auto-detects delimiter;
                                         CP_SAMPLE_ARTIFACTS dir is searched tsv->csv->xlsx)

Apply: overwrite the 6 files, add run.py registration, redeploy UI. Done.
