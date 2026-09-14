# CP Catalog BBH — Architecture, Ingestion & Features

Self-hosted data catalog for Brown Brothers Harriman, Capital Partners. An
OpenMetadata-lite catalog on OpenShift + Oracle that harvests metadata from
Swagger, Postman, dbt, Airflow, Excel feed/loader sheets, and Oracle schemas,
then serves it through a FastAPI + React application.

This document covers the architecture, every ingestion process, and all features.
For step-by-step install see LOCAL_SETUP.md. The same content is browsable in-app
under the **System Design** tab.

---

## 1. Architecture

```
Source Artifacts
  Swagger/OpenAPI · Postman · dbt manifest · Airflow metadata
  Excel (feeds, loaders, interfaces, PII) · Oracle schemas
        |
        v
Ingestion Pipeline   (13 idempotent connectors; python -m ingestion.run)
        |
        v
Oracle Store
  datasets · columns · transform_lineage · column_lineage · runs
  api_sources/endpoints/fields/errors · api_business_flows
  feed_catalog · loader_catalog · data_pipelines · pipeline_members
  business_glossary · term_column_map · dp_registry · dp_occurrences
  interface360_* · pii_classifications · pii_field_matches
        |
        v
FastAPI   (read endpoints + write: flow builder, pipeline builder; /search)
        |
        v
React UI  (Vite; LIVE/DEMO fallback; global search; 5 modules + System Design)
```

Design principles:
- **Idempotent ingestion** — every connector upserts via `loader._merge(table, pk,
  values, protect=())`; re-running never duplicates and never overwrites BA-curated
  columns (those listed in `protect=`).
- **Project-aware** — `project_id` (SEI / Non-SEI) is first-class across all tables.
- **Air-gap friendly** — pip/npm from Nexus; no external calls at runtime.
- **Graceful degradation** — missing optional sources (Oracle harvest, Airflow)
  skip cleanly; the UI falls back to mock data when the API is unreachable.

---

## 2. Ingestion processes (13 steps, in run order)

The orchestrator runs these in order. Each reads a source and populates Oracle.
Pass step names as arguments to run a subset (e.g. `python -m ingestion.run dbt glossary`).

| # | Step | Reads | Populates |
|---|------|-------|-----------|
| 1 | projects | project config | projects, resolution rules |
| 2 | oracle | Oracle schemas (optional) | datasets(TABLE/VIEW), columns |
| 3 | feed_dictionary | SWP_EOD_Data_Feeds.xlsx | datasets(FEED), columns, enumerations |
| 4 | feed_catalog | inbound/outbound feeds xlsx (multi-sheet) | feed_catalog, columns |
| 5 | loader_catalog | loaders.xlsx | loader_catalog |
| 6 | dbt | manifest.json | datasets(MODEL), transformations, transform_lineage, column_lineage |
| 7 | glossary | dbt metrics/meta + authored md | business_glossary, term_column_map |
| 8 | airflow | Airflow metadata (file/Postgres) | datasets(DAG), runs, transform_lineage (DAG→model) |
| 9 | interface360 | interfaces.xlsx | interface360_systems, _routing_hops |
| 10 | api360 | Swagger + Postman collections | api_sources, api_endpoints, api_fields, api_endpoint_errors, api_business_flows |
| 11 | pii_classification | PII_Attributes_List.xlsx | pii_classifications (the dictionary) |
| 12 | pii_match | scans loaded columns | pii_field_matches |
| 13 | datapoint_index | scans ALL loaded data | dp_registry, dp_occurrences |

Notes on specific steps:

**feed_catalog (4)** — the master feed inventory. Multi-sheet Excel: Sheet 1 is the
index (Feed Name | Business Function | Domain | Frequency), and one sheet per feed
(sheet name = feed name) carries the field metadata (Field Name | Data Type |
Required | Business Meaning | PII flag). Ingested twice with INBOUND_FEEDS_XLSX
(direction=inbound) and OUTBOUND_FEEDS_XLSX (direction=outbound).

**loader_catalog (5)** — loader templates with schema definition + error template,
and the inbound/outbound feed mapping per loader (comma-separated feed lists).

**dbt (6)** — the transformation backbone. Compiled SQL (transformations), model→
model edges (transform_lineage), and sqlglot-derived column lineage (column_lineage).

**glossary (7)** — business/semantic layer. Derives terms from dbt MetricFlow
metrics + model/column meta.business_term + descriptions, then merges an authored
markdown file that fills gaps (notably regulatory_scope, which dbt rarely carries).

**datapoint_index (13)** — runs last. Scans columns, api_fields, interfaces, and PII
matches; normalizes names so account_id / accountId / ACCOUNT_ID collapse to one
registry entry; counts occurrences across modules.

---

## 3. Features by module

### Interface 360
System-to-system interface inventory (828 real interfaces). Routing hops, source/
target systems, PII flags. The System/Application lineage level.

### API 360
- **Sources** — ingested Swagger specs; click-through drawer with Function Point ID,
  request fields (PII-tagged), and documented error tables.
- **API Dependency** — endpoint dependency graph from Postman produces/consumes.
- **Business Flow** — auto-generated + curated runbooks (ordered API sequences with
  graph + metadata table), plus per-domain browse.
- **Flow Builder** — BA picks endpoints (search + browse by domain), orders manually
  or auto (producer-before-consumer), sees missing-prerequisite warnings, saves to
  Oracle. Auto-generation needs each endpoint to declare produces (`var keys`) and
  consumes (`Depends on`) with consistent entity names.

### Data 360
- **Pipelines** — one per business domain with EOD/BOD/Intraday schedule tag. Drill
  down: ① Airflow DAG + run status → ② SWP feeds (bronze) → ③ dbt models
  bronze/silver/gold → per-model transform SQL + column lineage.
- **Lineage Graph** — Data / Transform / Orchestration plane graphs.
- **Business Glossary** — terms (AUC, NAV, Cost Basis) mapped to physical columns,
  with trace-down through column/table lineage to source. (API live; UI tab pending.)
- **Pipeline Builder** — compose a pipeline from the master feed catalog: pick inbound
  feeds → loader(s) → outbound feeds → save. Feeds shareable across pipelines; domain
  + custom pipelines. (API live; UI builder pending.)

### Datapoint 360
The indexed registry: search a data point (e.g. account_id) and get every place it
appears across feeds, models, API fields, and interfaces, with occurrence/module
counts and PII flag. Backed by datapoint_index.

### PII Explorer
PII classifications (the dictionary) and matches across feeds and API fields.

### Global Search
One search box across datasets (tables/feeds/models/interfaces), fields/columns
(by name or business meaning), the feed catalog (inbound/outbound), and the
datapoint registry. Each result tagged with its kind. Oracle Text indexes accelerate
description search where CTXAPP is available; falls back to LIKE otherwise.

---

## 4. Lineage levels coverage

| Level | Status | Backed by |
|-------|--------|-----------|
| Table / Dataset | BUILT | transform_lineage |
| Column / Field | BUILT | column_lineage (sqlglot) |
| Pipeline / Job | BUILT | DAG + runs + DAG→model |
| System / Application | BUILT | Interface 360 |
| Business / Semantic | BUILT | business_glossary + term_column_map |
| Row / Record | NOT BUILT | needs runtime pipeline instrumentation (dbt post-hooks) |
| Cell / Value | NOT BUILT | forensic only; not justified |

---

## 5. Known limits / honest status

- **UI pending for**: Data 360 Business Glossary tab, Data 360 Pipeline Builder UI,
  Datapoint 360 screen wired to /datapoints (currently borrows PII data as stand-in).
  All three have working backends + APIs.
- **Auth**: write endpoints (flow builder, pipeline builder) have no auth gate in dev
  (CATALOG_DISABLE_SECURITY=true). Add auth before shared/prod use.
- **Airflow metastore**: cannot be Oracle for live status — use a file export or
  Postgres metastore.
- **Column lineage** depends on sqlglot parsing compiled SQL; complex SQL yields
  sparse column edges.
- **Auto-flow / glossary quality** depends on source richness (produces/consumes
  metadata; dbt descriptions/metrics).
- **Row-level lineage** is a pipeline-instrumentation effort, not a connector.

---

## 6. Where things live (repo map)

```
api/app/        main.py (/search, mounts routers), db.py (query/execute),
                routers_{interface360,api360,data360,data360_pipelines,pii,projects}.py
ingestion/      run.py (orchestrator), one connector per source,
                datapoint_indexer.py, glossary_conn.py, feed_catalog_conn.py,
                loader_catalog_conn.py
ui/src/         App.jsx, AppShell.jsx, GlobalSearch.jsx, SystemDesign.jsx,
                Interface360 / Api360 / Data360 / Datapoint360 / PiiExplorer .jsx,
                api.js (client + LIVE/DEMO), mockData.js
sql/            01..16 schema (idempotent, run in order)
sample-artifacts/  synthetic test data for every source
docs/           mockups + this documentation
LOCAL_SETUP.md  full setup guide
```
