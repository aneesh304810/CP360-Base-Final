# CP Catalog BBH — Final Build

Complete self-hosted data catalog for BBH Capital Partners. Five modules:
Interface 360, API 360, Data 360, Datapoint 360, PII Explorer — on OpenShift/Oracle.

## What's new in this final build

### Data 360 — Pipelines (mirrors API 360's pattern)
Data 360 now has two tabs:
- **Pipelines** — one pipeline per business domain (positions, cash, nav, taxlots,
  fees, ...). Each shows:
  - an inferred **schedule tag** (EOD / BOD / Intraday / Reference) from the DAG tags
  - **① Orchestration** — the Airflow DAG(s) with recent task-run status chips
  - **② Source** — the SWP EOD feeds (bronze layer) from the feeds spreadsheet
  - **③ Transform** — the dbt models bronze→silver→gold, click any for drill-down
  - **Model drill-down** — transformation SQL + column lineage for that model
  - end-to-end lineage arrows feed → bronze → silver → gold
- **Lineage Graph** — the original Data/Transform/Orchestration plane graph.

Pipelines are assembled from data already ingested:
- Airflow DAGs + runs (from the airflow connector)
- dbt models + transformations + lineage (from the dbt connector)
- SWP feeds (from the feed dictionary connector; now domain-tagged)

EOD/BOD inference: DAG tag `eod`→EOD, `intraday`→Intraday, `reference`/`ref_`→
Reference, `bod`/`morning`→BOD, else EOD. No spreadsheet column required.

### API 360 (from prior builds, included)
- Sources, endpoints, fields, errors (Swagger), business flows (Postman)
- Auto-generated business flows from Depends-on/produces metadata
- Flow Builder — BA picks endpoints, orders them, saves to Oracle
- Dependency graph

## New/changed files in this build
```
api/app/routers_data360_pipelines.py   NEW   pipeline assembly + drill-down
api/app/main.py                        mounts the pipelines router
ingestion/feed_dictionary_conn.py      feeds now tagged with business domain
ui/src/Data360.jsx                     Pipelines tab + drill-down components
ui/src/api.js                          pipeline client methods
ui/src/mockData.js                     pipeline demo data
```

## Install (delta on top of a working build)
1. Copy the changed files to the same relative paths.
2. No new SQL needed — pipelines reuse datasets/runs/transformations/lineage.
3. Re-run ingestion so feeds get the new domain tag:
   `python -m ingestion.run`
4. Restart API (new router) + refresh UI.
5. Open Data 360 → Pipelines tab.

## Verify
```
curl http://localhost:8000/data360/pipelines
curl http://localhost:8000/data360/pipelines/positions
curl http://localhost:8000/data360/pipelines/positions/model/sei_gld_positions_summary
```

## Honest notes
- Pipeline richness depends on ingested data: DAGs map to domains by name, models
  by name, feeds by inferred domain. Feeds whose names don't contain a known domain
  keyword won't auto-link — adjust the domain list in the feed connector if needed.
- Column lineage in drill-down needs the sqlglot-derived column_lineage rows; where
  absent, the model shows transform SQL but fewer column rows.
- The flow-builder write endpoints have no auth gate in dev mode — add auth before
  shared/prod use.
