# CP Catalog — Local Deployment (laptop)

Run the whole stack on your laptop: Oracle (already done), ingestion from your
shared folder, the API, and the UI.

## Prerequisites

- **Oracle** with the schema created (you've done this) — note your connect string.
- **Python 3.11+** and **Node 18+** on your laptop.
- **Access to the shared folder** holding the artifacts (you have this).

## One-time setup

```bash
# macOS / Linux / WSL
./local/setup.sh

# Windows PowerShell
.\local\setup.ps1
```

This creates a Python venv (`.venv`), installs the API + ingestion requirements,
and runs `npm install` for the UI.

## Configure

```bash
cp local/.env.example local/.env      # Windows: copy local\.env.example local\.env
```

Edit `local/.env` and set two things:

1. **`CP_CATALOG_DB_DSN`** — your Oracle connect string:
   ```
   oracle://catalog_user:catalogpwd@localhost:1521/FREEPDB1
   ```

2. **`CP_CATALOG_ROOT`** — your shared folder. Use whatever form your laptop sees:
   | Your setup | Example value |
   |---|---|
   | Windows mapped drive | `Z:\CP-CATALOG` |
   | Windows UNC path | `\\qcwebfs.testbbh.com\fixed_income_quant_jupyter$\CP-CATALOG` |
   | macOS mounted share | `/Volumes/CP-CATALOG` |
   | Try it with bundled samples first | `./sample-artifacts` |

The per-artifact paths are derived from `CP_CATALOG_ROOT` automatically. The
folder is expected to contain:
```
<CP_CATALOG_ROOT>/
  INTERFACE-SYSTEM/interfaces.xlsx
  DATA-FEEDS/SWP_EOD_Data_Feeds.xlsx
  OVERLAY/PII_Attributes_List.xlsx
  dbt-artifacts/manifest.json        (optional)
```
If a file isn't there, that step **skips cleanly** — you can start with just the
ones you have.

## Local simulation of Airflow + dbt (no Postgres needed)

For a full end-to-end demo without standing up Airflow/Postgres, the bundle ships
a **simulated accounting platform**:

- `sample-artifacts/dbt-artifacts/manifest.json` — ~76 dbt models across 14
  accounting domains (positions, taxlots, transactions, cash, fees, NAV, GL,
  accruals, interest, dividends, corporate actions, settlements, custody,
  performance), full bronze→silver→gold medallion with real compiled SQL and
  cross-project lineage.
- `sample-artifacts/airflow-sim/airflow_metadata.json` — 15 complex DAGs, ~121
  task runs, Cosmos-named tasks mapping to the dbt models.

The Airflow connector reads this via a **file DSN**, using the same code path as
real Postgres — on OpenShift you swap one env var, no code change:
```
# LOCAL (.env):     AIRFLOW_DSN=file://./sample-artifacts/airflow-sim/airflow_metadata.json
# OPENSHIFT later:  AIRFLOW_DSN=postgresql://airflow:pwd@airflow-postgres:5432/airflow
```

## Load the catalog (ingestion)

```bash
./local/ingest.sh          # Windows: .\local\ingest.ps1
```

This reads each artifact from your shared folder, resolves project (SEI vs Non-SEI),
and upserts into Oracle. It's idempotent — re-run any time the artifacts change.
Optional sources (Oracle harvest, Airflow, dbt) only run if you set their env vars;
otherwise they log `skipping (not configured)` and move on.

Verify it loaded:
```sql
SELECT object_type, COUNT(*) FROM datasets GROUP BY object_type;
SELECT COUNT(*) FROM interface360_interfaces;
SELECT COUNT(*) FROM pii_classifications;
```

## Run the app

```bash
./local/start.sh           # Windows: .\local\start.ps1
```

- API → http://localhost:8000  (docs at http://localhost:8000/docs)
- UI  → http://localhost:5173

Open the UI; the badge should read **LIVE** (it flips from DEMO once the API
responds). If the API is down, the UI still works in DEMO mode on mock data.

## Daily use

After the one-time setup, the loop is just:
```bash
./local/ingest.sh    # when artifacts change
./local/start.sh     # to run the app
```

## Turn on the optional harvest sources

To also harvest your live dbt / Airflow / Oracle, uncomment and set in `local/.env`:
- **dbt:** `DBT_MANIFEST_PATH` (defaults to `<root>/dbt-artifacts/manifest.json`)
- **Oracle source:** `ORACLE_PROD_DSN` + `ORACLE_PROD_SCHEMAS`
- **Airflow:** `AIRFLOW_DSN` (Postgres) + optional `AIRFLOW_DAGS_FILTER`

Then re-run `ingest`. These power the Data 360 Transform/Orchestration planes and
column-level lineage.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `ORA-12541 no listener` | Oracle isn't running or wrong host/port in `CP_CATALOG_DB_DSN` |
| `ORA-01017 invalid credentials` | wrong user/password in the DSN |
| `DPY-6005 cannot connect` | check the service name (`FREEPDB1`, not `XE`/`CDB$ROOT`) |
| ingestion: `skipping (not configured)` | that source's env var isn't set — expected if you don't use it |
| UI badge stuck on DEMO | API not reachable on :8000 — check the API window for errors |
| `FileNotFoundError` on an xlsx | `CP_CATALOG_ROOT` path or the file name doesn't match |
| Windows UNC path not found | map it to a drive letter, or use the full `\\server\share\...` form |

## What runs where

```
  Oracle (your laptop)      ←─ ingestion reads shared folder, writes here
        ▲
        │ CP_CATALOG_DB_DSN
        │
  FastAPI :8000  ──────────→  reads Oracle, serves JSON
        ▲
        │ /api proxy (vite)
        │
  React UI :5173  ─────────→  your browser
```
