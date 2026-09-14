# CP Catalog BBH — Run Guide (Complete Build)

Everything from the session is folded in, including the new **Interface 360 Explorer**
tab. Validated: 41 Python files, 16 React components, 22 SQL scripts, mockup balanced.

Your environment: code at C:\SEI\bbhcatalog\Fullcp360, venv at C:\SEI\seiml.

============================================================
## IMPORTANT — preserve your real data
============================================================
Extract this zip to a folder, but do NOT overwrite your real artifacts. Your real
workbooks live in sample-artifacts\DATA-FEEDS\ and sample-artifacts\FEED-CATALOG\.
The zip's sample-artifacts are placeholders. Either:
 (a) extract to a NEW folder and copy your real sample-artifacts into it, OR
 (b) extract over your existing folder but restore your real DATA-FEEDS and
     FEED-CATALOG afterward.

If your database is ALREADY loaded (your last run succeeded), you do NOT need to
re-run ingestion — skip to step 4 (API) and step 5 (UI). Only re-run ingestion if
you changed source data or the schema.

============================================================
## 1. Activate venv + confirm deps
============================================================
```powershell
C:\SEI\seiml\Scripts\Activate.ps1
python -c "import openpyxl, fastapi, uvicorn, oracledb, sqlglot; print('deps OK')"
```

============================================================
## 2. Create / update schema (idempotent, safe to re-run)
============================================================
```powershell
cd C:\SEI\bbhcatalog\Fullcp360
$dsn = "SILVER/yourpassword@yourhost:1521/YOURSERVICE"
Get-ChildItem sql\*.sql | Sort-Object Name | ForEach-Object {
  Write-Host "Running $($_.Name)..."; sqlplus -S $dsn "@$($_.FullName)"
}
```
(Includes the fixed sql/21 — trigger_event — sql/22 reference_data, sql/23 error_code widen.)

============================================================
## 3. Load data — ONE command (only if not already loaded)
============================================================
Edit local\load-all.ps1 -> set $env:CP_CATALOG_DB_DSN to your real DSN, then:
```powershell
.\local\load-all.ps1
```
Runs ingestion in dependency order and prints per-feature row counts + gap reports.

============================================================
## 4. Start the API
============================================================
Set the DSN in THIS shell (a fresh shell doesn't inherit load-all's vars):
```powershell
C:\SEI\seiml\Scripts\Activate.ps1
cd C:\SEI\bbhcatalog\Fullcp360
$env:CP_CATALOG_DB_DSN = "SILVER/yourpassword@yourhost:1521/YOURSERVICE"
uvicorn app.main:app --app-dir api --port 8000
```
On startup you should see six "mounted routers_*" lines. Then confirm real data:
```powershell
curl http://localhost:8000/diag
```
Expect: bf_pipelines ~444, dp_registry ~1513, reference_data ~197, search_index ~6570.
- ORA-01017 -> wrong password in the DSN
- ORA-12154 -> wrong host/service in the DSN

============================================================
## 5. Start the UI
============================================================
```powershell
cd C:\SEI\bbhcatalog\Fullcp360\ui
npm install
npm run dev          # http://localhost:5173
```
Open http://localhost:5173 (NOT the file:// mockup). The Vite proxy maps /api ->
http://localhost:8000, so keep the API running in its own window.

============================================================
## 6. Confirm you're on LIVE data (not the mock fallback)
============================================================
The UI silently falls back to mock data if the API is unreachable. To verify live:
 - /diag (step 4) shows real counts, AND
 - browser devtools Network tab on :5173 shows /api/... calls returning 200 with rows.
If counts look tiny/round (like exactly 3 feeds), the API/DSN/proxy is off, not the data.

============================================================
## Features (all present)
============================================================
- Home: SEI / Non-SEI project filter, KPIs
- API 360: real-time flows, Flow Builder (pick + order + produces/consumes)
- Data 360: Pipelines (Business/Technical toggle + v20 migration routing story),
  Inbound Feeds, Loaders, Compression (444->37), Lineage
- Datapoint 360: anchored to feed/loader inventory, Reference descriptions by
  category, Browse-by-Category
- Interface 360: Table, Matrix, Routing Paths, and NEW **Explorer** (progressive
  source->integration->target->detail drill-down)
- PII Explorer
- Search: full-text (Oracle Text) across all modules

============================================================
## If a specific screen looks wrong
============================================================
Tell me: which screen, what you see vs expect, and (if any) the red error in the
browser console / the API window. With /diag green, any remaining issue is a
component-level fix and I can target it precisely.
