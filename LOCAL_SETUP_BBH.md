# CP Catalog BBH — Local Setup (your environment)

Tailored to:
- Code:      C:\SEI\bbhcatalog\Fullcp360datacatalog
- venv:      C:\SEI\seiml   (already created, packages installed)
- Artifacts: C:\SEI\bbhcatalog\Fullcp360datacatalog\sample-artifacts
             ├── DATA-FEEDS\   (SWP EOD Data Feeds.xlsx, SWP EOD Data Feeds Reference.xlsx)
             └── FEED-CATALOG\ (inbound_feeds_full, outbound_feeds_full, loaders_full,
                                CP_Catalog_SEI_Loaders, CP_Catalog_Business_Flows_v20_Compressed)

================================================================
## 0. One-time: confirm packages in your venv
================================================================
```powershell
C:\SEI\seiml\Scripts\Activate.ps1
python -c "import openpyxl, fastapi, uvicorn, oracledb, sqlglot; print('core deps OK')"
```
If anything is missing:
```powershell
pip install -r C:\SEI\bbhcatalog\Fullcp360datacatalog\requirements.txt --break-system-packages
```
(UI also needs Node 18+ for the React dev server; the API works without it.)

================================================================
## 1. Lay down the code
================================================================
Extract cp-catalog-bbh.zip so the contents sit in:
```
C:\SEI\bbhcatalog\Fullcp360datacatalog\
  ├── sql\           01..24 schema scripts
  ├── ingestion\     connectors + run.py
  ├── api\           FastAPI app
  ├── ui\            React/Vite app
  ├── local\         set-env.ps1, load-all.ps1
  └── sample-artifacts\   (your DATA-FEEDS and FEED-CATALOG already here)
```

================================================================
## 2. Set the database DSN
================================================================
Edit local\set-env.ps1 (or set inline) so the API/ingestion reach your Oracle:
```powershell
$env:CP_CATALOG_DB_DSN = "catalog_user/password@dbhost:1521/SERVICE"
```

================================================================
## 3. Create the schema (run SQL 01..24 in order)
================================================================
```powershell
cd C:\SEI\bbhcatalog\Fullcp360datacatalog
$dsn = "catalog_user/password@dbhost:1521/SERVICE"
Get-ChildItem sql\*.sql | Sort-Object Name | ForEach-Object {
  Write-Host "Running $($_.Name)..."
  sqlplus -S $dsn "@$($_.FullName)"
}
```
All DDL is idempotent (guarded), so re-running is safe. 21 = business-flow tables,
22 = reference_data, 20 = Oracle Text search index (needs CTXAPP; falls back to LIKE if absent).

================================================================
## 4. Load everything — ONE command
================================================================
```powershell
C:\SEI\seiml\Scripts\Activate.ps1
cd C:\SEI\bbhcatalog\Fullcp360datacatalog
.\local\load-all.ps1
```
load-all.ps1 sets every env var to your exact paths, runs ingestion in the correct
dependency order, and prints a per-feature status (row counts + gaps) at the end.

Ingestion order (handled for you):
```
feed_dictionary, feed_catalog, loader_workbook, loader_catalog  (build feeds/loaders)
  -> datapoint_index            (build dp_registry from all the above)
  -> business_flow, reference_data  (resolve against dp_registry)
  -> search_index               (index everything, last)
api360 / dbt / airflow / glossary / pii run if their files are present, else skip cleanly.
```

================================================================
## 5. Start the API
================================================================
```powershell
C:\SEI\seiml\Scripts\Activate.ps1
cd C:\SEI\bbhcatalog\Fullcp360datacatalog
uvicorn app.main:app --app-dir api --port 8000
```
Verify: http://localhost:8000/health  and  http://localhost:8000/bf/compression

================================================================
## 6. Start the UI (optional — needs Node)
================================================================
```powershell
cd C:\SEI\bbhcatalog\Fullcp360datacatalog\ui
npm install
npm run dev      # http://localhost:5173
```

================================================================
## 7. Verify what loaded
================================================================
```sql
SELECT direction, COUNT(*) FROM feed_catalog GROUP BY direction;
SELECT COUNT(*) FROM ldr_catalog;            -- rich loaders
SELECT COUNT(*) FROM bf_pipelines;           -- ~444
SELECT routing_pattern, COUNT(*) FROM bf_pipelines GROUP BY routing_pattern;  -- v20
SELECT COUNT(*) FROM bf_flow_datapoint_map WHERE resolved='N';  -- datapoint gaps
SELECT category, COUNT(*) FROM reference_data GROUP BY category;
SELECT COUNT(*) FROM reference_data WHERE resolved='N';         -- reference gaps
```

================================================================
## 8. Features vs data files (what populates)
================================================================
HAVE FILES (populate fully):
  Data 360 feeds/loaders/pipelines/compression  <- DATA-FEEDS + FEED-CATALOG
  API 360 business flows                         <- CP_Catalog_Business_Flows_v20
  Datapoint 360 (points, reference, flow links)  <- feeds + reference + workbook
  Interface 360                                  <- workbook Interface_360 sheet
  Search                                          <- derived

NEED FILES (skip cleanly until provided):
  API 360 endpoint inventory  <- API-SPEC\*.yaml (Swagger)        [API_SPEC_ROOT]
  dbt lineage / column transforms <- dbt-artifacts\manifest.json  [DBT_MANIFEST_PATH]
  Airflow DAGs                 <- airflow-sim\*.json or Postgres   [AIRFLOW_DSN]
  Business glossary            <- GLOSSARY\business-glossary.md    [GLOSSARY_AUTHORED_PATH]
  PII Explorer                 <- OVERLAY\PII_Attributes_List.xlsx [PII_ATTRIBUTES_PATH]
