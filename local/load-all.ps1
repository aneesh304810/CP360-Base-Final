# =====================================================================
# load-all.ps1 — set env, run ingestion in order, print per-feature status.
# Tailored to: C:\SEI\bbhcatalog\Fullcp360datacatalog  (venv: C:\SEI\seiml)
# Usage:  C:\SEI\seiml\Scripts\Activate.ps1 ; .\local\load-all.ps1
# =====================================================================

# ---- paths ----
$Root      = "C:\SEI\bbhcatalog\Fullcp360datacatalog"
$Artifacts = "$Root\sample-artifacts"

# ---- DATABASE (edit to your Oracle) ----
$env:CP_CATALOG_DB_DSN = "catalog_user/password@dbhost:1521/SERVICE"
$env:SEI_ORACLE_SCHEMAS = "SEI_RAW,SEI_STAGE"
$env:CP_CATALOG_ROOT    = $Artifacts
$env:CATALOG_DISABLE_SECURITY = "true"

# ---- DATA-FEEDS (rich feed dictionary + reference list) ----
$env:DATA360_FEED_DICTIONARY_PATH = "$Artifacts\DATA-FEEDS\SWP EOD Data Feeds.xlsx"
$env:REFERENCE_DATA_XLSX          = "$Artifacts\DATA-FEEDS\SWP EOD Data Feeds Reference.xlsx"

# ---- FEED-CATALOG (simple feeds + rich loaders + business flows) ----
$env:INBOUND_FEEDS_XLSX   = "$Artifacts\FEED-CATALOG\inbound_feeds_full.xlsx"
$env:OUTBOUND_FEEDS_XLSX  = "$Artifacts\FEED-CATALOG\outbound_feeds_full.xlsx"
$env:LOADER_CATALOG_XLSX  = "$Artifacts\FEED-CATALOG\loaders_full.xlsx"
$env:LOADER_WORKBOOK_XLSX = "$Artifacts\FEED-CATALOG\CP_Catalog_SEI_Loaders.xlsx"
$env:BUSINESS_FLOWS_XLSX  = "$Artifacts\FEED-CATALOG\CP_Catalog_Business_Flows_v20_Compressed 2.xlsx"

# ---- optional supporting features (skip cleanly if file absent) ----
$env:API_SPEC_ROOT        = "$Artifacts\API-SPEC"
$env:POSTMAN_ROOT         = "$Artifacts\POSTMAN"
$env:DBT_MANIFEST_PATH    = "$Artifacts\dbt-artifacts\manifest.json"
$env:DBT_DIALECT          = "oracle"
$env:AIRFLOW_DSN          = "file:///$($Artifacts -replace '\\','/')/airflow-sim/airflow_metadata.json"
$env:GLOSSARY_AUTHORED_PATH = "$Artifacts\GLOSSARY\business-glossary.md"
$env:PII_ATTRIBUTES_PATH  = "$Artifacts\OVERLAY\PII_Attributes_List.xlsx"

# ---- show which input files actually exist ----
Write-Host "`n=== Input files ===" -ForegroundColor Cyan
$inputs = @{
  "Feed dictionary (rich)"  = $env:DATA360_FEED_DICTIONARY_PATH
  "Reference list"          = $env:REFERENCE_DATA_XLSX
  "Inbound feeds (simple)"  = $env:INBOUND_FEEDS_XLSX
  "Outbound feeds (simple)" = $env:OUTBOUND_FEEDS_XLSX
  "Loaders (simple)"        = $env:LOADER_CATALOG_XLSX
  "Loaders (rich 10-sheet)" = $env:LOADER_WORKBOOK_XLSX
  "Business flows v20"      = $env:BUSINESS_FLOWS_XLSX
  "Swagger (API-SPEC)"      = $env:API_SPEC_ROOT
  "dbt manifest"            = $env:DBT_MANIFEST_PATH
  "Glossary"                = $env:GLOSSARY_AUTHORED_PATH
  "PII attributes"          = $env:PII_ATTRIBUTES_PATH
}
foreach ($k in $inputs.Keys) {
  $exists = Test-Path $inputs[$k]
  $mark = if ($exists) { "[OK ]" } else { "[ -- ]" }
  $color = if ($exists) { "Green" } else { "DarkGray" }
  Write-Host ("  {0} {1}" -f $mark, $k) -ForegroundColor $color
}

# ---- run ingestion in dependency order ----
Write-Host "`n=== Running ingestion (full, ordered) ===" -ForegroundColor Cyan
Set-Location $Root
python -m ingestion.run
if ($LASTEXITCODE -ne 0) {
  Write-Host "Ingestion returned a non-zero exit code; check the log above." -ForegroundColor Yellow
}

# ---- per-feature status (row counts via a tiny python probe) ----
Write-Host "`n=== Feature status (row counts) ===" -ForegroundColor Cyan
$probe = @'
import os, oracledb
dsn = os.environ["CP_CATALOG_DB_DSN"]
u, rest = dsn.split("/", 1); pw, conn_str = rest.split("@", 1)
try:
    c = oracledb.connect(user=u, password=pw, dsn=conn_str)
except Exception as e:
    print("  (could not connect to Oracle:", e, ")"); raise SystemExit
cur = c.cursor()
def count(label, sql):
    try:
        cur.execute(sql); n = cur.fetchone()[0]
        print(f"  {label:<42} {n}")
    except Exception as e:
        print(f"  {label:<42} (n/a: {str(e)[:40]})")
count("Data 360: feeds (feed_catalog)",        "SELECT COUNT(*) FROM feed_catalog")
count("Data 360: feed fields (columns)",        "SELECT COUNT(*) FROM columns")
count("Data 360: loaders rich (ldr_catalog)",   "SELECT COUNT(*) FROM ldr_catalog")
count("Data 360: loaders simple",               "SELECT COUNT(*) FROM loader_catalog")
count("Data 360/API 360: pipelines (bf)",       "SELECT COUNT(*) FROM bf_pipelines")
count("API 360: business flows (bf)",           "SELECT COUNT(*) FROM bf_api_flows")
count("API 360: endpoints (Swagger)",           "SELECT COUNT(*) FROM api_endpoints")
count("Interface 360 (bf)",                     "SELECT COUNT(*) FROM bf_interfaces")
count("Datapoint 360: data points",             "SELECT COUNT(*) FROM dp_registry")
count("Datapoint 360: reference rows",          "SELECT COUNT(*) FROM reference_data")
count("Compression marts",                      "SELECT COUNT(*) FROM bf_compression_plan")
count("Search index documents",                 "SELECT COUNT(*) FROM search_index")
print()
count("** GAP: unresolved flow datapoints",     "SELECT COUNT(*) FROM bf_flow_datapoint_map WHERE resolved='N'")
count("** GAP: unresolved reference fields",     "SELECT COUNT(*) FROM reference_data WHERE resolved='N'")
count("** GAP: pipelines w/o linked API flow",  "SELECT COUNT(*) FROM bf_pipelines WHERE linked_api_flow_id IS NULL")
c.close()
'@
$probe | python -
Write-Host "`nDone. Start the API:  uvicorn app.main:app --app-dir api --port 8000" -ForegroundColor Cyan
