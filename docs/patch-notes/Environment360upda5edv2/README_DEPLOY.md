# Environment 360 — FULL CODEBASE (final)
Final IA: **Overview** (KPI cards + SSL summary card w/ drill-down + panels + NOC
network board + runner strip + feed) · **Certificates** (declared vs observed,
drift) · **Inventory** (CRUD + workbook up/download). No separate topology tabs.

## Contents
sql/43_env_infra.sql    inventory + hist + v_env_infra_tbd
sql/44_env_probe.sql    probe registry + results + v_env_probe_live
sql/45_env_ssl.sql      ssl_expiry + cert_not_after + v_env_ssl_status (alerts+DRIFT)
api/app/env_infra_loader.py    workbook parser (block env detection, SSL_Expiry-tolerant)
api/app/env_topology.py        topology JSON generator (+AUTO fallback for new systems)
api/app/env_probe_gen.py       probe provisioning (ARMED/WAITING, +AUTO)
api/app/env_probe_runner.py    runner lib: TCP floor + real TLS cert_check (notAfter)
api/app/routers_env_infra.py   /env-infra: rows/topology/tbd/probes/probes/live/export/import
api/app/env_probe_daemon.py    THE PULSE — plain Python loop, no Airflow needed:
                               nohup python env_probe_daemon.py --interval 300 &
airflow/dags/env360_probe_dag.py   optional: same pulse as a DAG when Airflow is ready
ui/src/Env360Home.jsx     FINAL page (this replaces the tab set; LIVE-first, DEMO fallback)
ui/src/EnvTopology.jsx    standalone board (optional; superseded by Env360Home)
mockups/env360_final_mockup.html   THE acceptance spec (offline, full behavior)
mockups/…                 earlier specs kept for reference

## Deploy
1) run sql 43,44,45 in SILVER
2) copy api/app/*.py; add "routers_env_infra" to the guarded router tuple in main.py
3) start the pulse: `nohup python api/app/env_probe_daemon.py --interval 300 &`
   (needs oracledb + CP_CATALOG_DB_DSN; network egress to probe targets —
    first cycle doubles as connectivity audit; DAG file optional for later)
4) ui: import Env360Home; route it as the Environment 360 page
   (Health checks / Pulse check remain served by the existing Environment360.jsx;
    the tab strip in Env360Home marks where they mount)
5) first load: curl -F "file=@cp_env_infrastructure.tsv" http://<api>/env-infra/import

## How persistence works in the UI
- Inventory Save/Delete/Add and workbook Upload all persist through
  POST /env-infra/import (full-sheet, diff+hist+probe-regen) — one write path,
  no extra endpoints. Download = GET /env-infra/export (xlsx/tsv).
- Board + KPI + SSL card + Certificates all read the same rows + probe results
  (GET /env-infra, /probes/live keyed by the board's data-probe ids).

## Acceptance (all proven in harness/tests this session)
[ ] import sheet -> {probes_regenerated:60, armed:16, waiting:44}
[ ] fill PBDW 1521 (Inventory or Excel) -> lane ?->i, probe ARMED <=1 cycle
[ ] add new Consumer row -> AUTO card + WAITING probe on board
[ ] ssl_expiry 6d -> red SSL summary card (click -> Certificates); renew -> amber
[ ] malformed sheet -> 422 / red banner, nothing changes
