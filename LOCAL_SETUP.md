# CP Catalog BBH — Complete Local Setup Guide

Self-hosted data catalog for BBH Capital Partners. Five modules (Interface 360,
API 360, Data 360, Datapoint 360, PII Explorer) on Oracle + FastAPI + React.

This guide takes you from a fresh `C:\SEI\CPcatalog\` to a running catalog with
live BBH data. Windows / PowerShell assumed (matches your environment).

---

## 0. Prerequisites

| Need | Version | Check |
|------|---------|-------|
| Python | 3.11+ | `python --version` |
| Node.js | 18+ | `node --version` |
| Oracle client | 19c+ instant client OR full | `sqlplus -v` |
| Oracle DB access | a schema you can DDL into | login works |
| Git (optional) | any | `git --version` |

You also need network access to your Nexus (for air-gapped pip/npm) OR the wheels
pre-downloaded.

---

## 1. Lay down the code

Extract the full `cp-catalog-bbh.zip` to `C:\SEI\CPcatalog\`. You should have:
```
C:\SEI\CPcatalog\
  api\            FastAPI read/write API (app\main.py, app\routers_*, app\db.py)
  ingestion\      connectors + run.py orchestrator
  ui\             React/Vite front-end
  sql\            01..20 schema files (incl. search_index, loader_workbook, project_sources)
  sample-artifacts\   synthetic test data (safe to ingest first)
  local\          set-env.ps1 (you create/edit this — see step 4)
```

---

## 2. Python environment

```powershell
cd C:\SEI\CPcatalog
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip

# online:
pip install -r requirements.txt
# air-gapped (Nexus):
pip install -r requirements.txt --index-url https://nexus.bbh.com/repository/pypi/simple
```
Core deps: `fastapi uvicorn oracledb openpyxl pyyaml sqlglot python-dotenv`.

Verify oracledb connects (thin mode needs no client; thick needs instant client):
```powershell
python -c "import oracledb; print('oracledb', oracledb.__version__)"
```

---

## 3. UI dependencies

```powershell
cd C:\SEI\CPcatalog\ui
npm install         # or: npm install --registry https://nexus.bbh.com/repository/npm/
cd ..
```

---

## 4. Environment variables (the heart of setup)

Create `C:\SEI\CPcatalog\local\set-env.ps1`. **Dot-source it** each session:
`. .\local\set-env.ps1` (the leading dot matters).

```powershell
# ---- DATABASE (required) ----
$env:CP_CATALOG_DB_DSN   = "catalog_user/password@dbhost:1521/SERVICE"
# the schema you ran the SQL into; the API reads from here

# ---- PROJECT RESOLUTION ----
$env:SEI_ORACLE_SCHEMAS  = "SEI_RAW,SEI_STAGE"   # which schemas count as 'SEI' project

# ---- DATA 360: dbt (required for models/lineage/glossary) ----
$env:DBT_MANIFEST_PATH         = "C:\SEI\CPcatalog\sample-artifacts\dbt-artifacts\manifest.json"
$env:DBT_CATALOG_PATH          = "C:\SEI\CPcatalog\sample-artifacts\dbt-artifacts\catalog.json"  # optional
$env:DBT_DIALECT               = "oracle"        # sqlglot dialect for column lineage
$env:DBT_SEMANTIC_MANIFEST_PATH= ""              # set if your MetricFlow metrics are in a separate file
$env:GLOSSARY_AUTHORED_PATH    = "C:\SEI\CPcatalog\sample-artifacts\GLOSSARY\business-glossary.md"

# ---- DATA 360: Airflow (DAGs + run status) ----
$env:AIRFLOW_DSN         = "file:///C:/SEI/CPcatalog/sample-artifacts/airflow-sim/airflow_metadata.json"
# live: a Postgres DSN to the Airflow metastore. NOTE: Oracle can't be the live
# Airflow metastore; use the file export or Postgres.
$env:AIRFLOW_DAGS_FILTER = ""                    # optional substring filter

# ---- DATA 360: feed dictionary (SWP EOD feeds) ----
$env:DATA360_FEED_DICTIONARY_PATH = "C:\SEI\CPcatalog\sample-artifacts\DATA-FEEDS\SWP_EOD_Data_Feeds.xlsx"

# ---- DATA 360: pipeline builder (NEW) ----
$env:INBOUND_FEEDS_XLSX  = "C:\SEI\CPcatalog\sample-artifacts\FEED-CATALOG\inbound_feeds.xlsx"
$env:OUTBOUND_FEEDS_XLSX = "C:\SEI\CPcatalog\sample-artifacts\FEED-CATALOG\outbound_feeds.xlsx"
$env:LOADER_CATALOG_XLSX = "C:\SEI\CPcatalog\sample-artifacts\FEED-CATALOG\loaders.xlsx"

# ---- API 360 ----
$env:API_SPEC_ROOT       = "C:\SEI\CPcatalog\sample-artifacts\API-SPEC"
$env:POSTMAN_ROOT        = "C:\SEI\CPcatalog\sample-artifacts\POSTMAN"

# ---- INTERFACE 360 + PII ----
$env:CP_CATALOG_ROOT     = "C:\SEI\CPcatalog\sample-artifacts"   # interfaces.xlsx etc.
$env:PII_ATTRIBUTES_PATH = "C:\SEI\CPcatalog\sample-artifacts\OVERLAY\PII_Attributes_List.xlsx"

# ---- ORACLE harvest (optional; skips cleanly if unset) ----
# $env:ORACLE_PROD_DSN     = "prod_reader/pw@prodhost:1521/PRODSVC"
# $env:ORACLE_PROD_SCHEMAS = "PBDW,IMDW"
# $env:ORACLE_PLATFORM_ID  = "EXADATA"

# ---- DEV flags ----
$env:CATALOG_DISABLE_SECURITY = "true"   # no auth gate on write endpoints in dev
```

> Start with the **sample-artifacts paths** (above) to prove the stack end-to-end,
> then repoint each var at your real BBH files.

---

## 5. Create the schema (run SQL in order)

Connect as the user in `CP_CATALOG_DB_DSN`, then run **01 through 20 in order**:

```powershell
cd C:\SEI\CPcatalog
$dsn = "catalog_user/password@dbhost:1521/SERVICE"
Get-ChildItem sql\*.sql | Sort-Object Name | ForEach-Object {
  Write-Host "Running $($_.Name)..."
  sqlplus -S $dsn "@$($_.FullName)"
}
```
Or one at a time:
```
sqlplus catalog_user/pw@... @sql\01_schema.sql
...
sqlplus catalog_user/pw@... @sql\20_search_index.sql
```
The later scripts add: 17 datapoint direction (inbound/outbound), 18 loader workbook
(10-sheet SEI loaders), 19 project sources (project-as-parent), 20 search_index
(Oracle Text full-text — needs CTXAPP granted; if absent, search falls back to LIKE).

All DDL is **idempotent** (guarded against ORA-00955 "already exists"), so re-running
is safe. Confirm key tables:
```sql
SELECT table_name FROM user_tables
WHERE table_name IN ('DATASETS','COLUMNS','COLUMN_LINEAGE','RUNS',
 'API_ENDPOINTS','API_BUSINESS_FLOWS','INTERFACE360_SYSTEMS',
 'DP_REGISTRY','DP_OCCURRENCES','FEED_CATALOG','LDR_CATALOG','DATA_PIPELINES',
 'BUSINESS_GLOSSARY','PROJECT_SOURCES','SEARCH_INDEX')
ORDER BY table_name;
```
For full-text search, also confirm the Oracle Text index built:
```sql
SELECT index_name, status FROM user_indexes WHERE index_name='IX_SEARCH_BODY';
```

---

## 6. Run ingestion

From the **repo root**, venv active, env dot-sourced:
```powershell
cd C:\SEI\CPcatalog
. .\local\set-env.ps1
.\.venv\Scripts\Activate.ps1
python -m ingestion.run
```

The steps run in this order (each is idempotent):
```
projects → oracle → feed_dictionary → feed_catalog → loader_workbook →
dbt → glossary → airflow → interface360 → api360 →
pii_classification → pii_match → datapoint_index → search_index (LAST)
```
`datapoint_index` then `search_index` run last on purpose — they scan everything the
other steps loaded. `search_index` also syncs the Oracle Text index (CTX_DDL.SYNC_INDEX).

**Run a subset** (e.g. after changing only feeds):
```powershell
python -m ingestion.run feed_catalog loader_catalog datapoint_index
```

Sanity-check the load:
```sql
SELECT object_type, COUNT(*) FROM datasets GROUP BY object_type;   -- FEED/MODEL/DAG/INTERFACE
SELECT COUNT(*) FROM api_endpoints;
SELECT direction, COUNT(*) FROM feed_catalog GROUP BY direction;
SELECT COUNT(*) FROM ldr_catalog;
SELECT COUNT(*) FROM search_index;
SELECT dp_name_normalized, occurrence_count FROM dp_registry
  ORDER BY occurrence_count DESC FETCH FIRST 10 ROWS ONLY;
```

---

## 7. Start the API

In its own window (keep env vars set):
```powershell
cd C:\SEI\CPcatalog
. .\local\set-env.ps1
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --app-dir api --port 8000
# add --reload during development for auto-restart on code changes
```
Health check (does NOT touch the DB — confirms the process is up):
```powershell
curl http://localhost:8000/health
```
Spot-check real endpoints:
```
curl http://localhost:8000/api360/stats
curl "http://localhost:8000/data360/datapoints?q=account"
curl "http://localhost:8000/data360/feed-catalog?direction=inbound"
```

---

## 8. Start the UI

In a **second** window:
```powershell
cd C:\SEI\CPcatalog\ui
npm run dev
```
Open **http://localhost:5173**.

The UI proxies `/api` → `http://localhost:8000` with a rewrite that strips `/api`
(configured in `vite.config.js`). The header badge shows **LIVE** when it reaches the
API, **DEMO** when it falls back to in-browser mock data.

---

## 9. Verify each module in the UI

- **Interface 360** — the interface table populates (828 with real data)
- **API 360** — Sources list; click a source → endpoint drawer; Business Flow tab → runbooks + "+ New Flow" builder
- **Data 360** — Pipelines tab (drill into Airflow → feeds → dbt → SQL); Lineage Graph tab
- **Datapoint 360** — search a data point (e.g. account) → occurrences across modules
- **PII Explorer** — classifications + matches

---

## 10. Common issues (all seen before)

| Symptom | Cause | Fix |
|---------|-------|-----|
| `No module named ingestion` | not at repo root / venv off | `cd C:\SEI\CPcatalog`, activate venv, run `python -m ingestion.run` |
| `ORA-00942 table/view does not exist` | DSN user ≠ schema you ran SQL into | point `CP_CATALOG_DB_DSN` at the schema owner |
| `ORA-12899 value too large` | a wide text field | already CLOB in sql/07+13; re-run those |
| `charmap codec` on a spec/manifest | non-UTF8 read | connectors read UTF-8 already; pull latest files |
| Airflow `file:///C:/...` Invalid argument | leading slash before drive | use the `file:///C:/...` form OR a bare `C:\...` path |
| UI shows **DEMO** not LIVE | API not running, or proxy rewrite missing | start API on :8000; confirm `vite.config.js` rewrite strips `/api` |
| Postman flows = 0 | wrong filename / no deps metadata | files end `.postman.json`; need `Depends on:`+`var keys` |
| Datapoint registry empty | datapoint_index didn't run | it's LAST; run `python -m ingestion.run datapoint_index` after a full load |
| feeds not linking to pipelines | feed name has no domain keyword | add the keyword to the DOMAINS list in feed connectors |

---

## 11. Going from sample data to real BBH data

Repoint these vars at your real files, re-run ingestion:
- `DBT_MANIFEST_PATH` → your dbt target/manifest.json
- `AIRFLOW_DSN` → Postgres metastore OR a real metadata export
- `DATA360_FEED_DICTIONARY_PATH` → real SWP_EOD_Data_Feeds.xlsx
- `INBOUND_FEEDS_XLSX` / `OUTBOUND_FEEDS_XLSX` / `LOADER_CATALOG_XLSX` → real feed+loader Excel
- `API_SPEC_ROOT` / `POSTMAN_ROOT` → real Swagger + Postman collections
- `CP_CATALOG_ROOT` → folder with real interfaces.xlsx
- `PII_ATTRIBUTES_PATH` → real PII attribute list

Then before prod: set `CATALOG_DISABLE_SECURITY=false` and put auth in front of the
write endpoints (flow builder, pipeline builder).

---

## Quick reference — one-shot startup (after first setup)

```powershell
# Window 1 — API
cd C:\SEI\CPcatalog; . .\local\set-env.ps1; .\.venv\Scripts\Activate.ps1
uvicorn app.main:app --app-dir api --port 8000

# Window 2 — UI
cd C:\SEI\CPcatalog\ui; npm run dev

# To re-ingest after data changes (Window 1, stop API first or use a 3rd window)
python -m ingestion.run
```
