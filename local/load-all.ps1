# =====================================================================
# load-all.ps1 - set env, run ingestion in order, print per-feature status.
# Tailored to: C:\SEI\bbhcatalog\CP360-Base-Final  (venv: C:\SEI\seiml)
# Usage: C:\SEI\seiml\Scripts\Activate.ps1 ; .\local\load-all.ps1
#
# CHANGED FROM YOUR COPY - three fixes and one addition, all called out
# where they happen:
#   1. $Root said "CC:\..." (doubled C). Every Test-Path then reported
#      [ -- ], Set-Location failed silently, and ingestion ran from
#      whatever directory the shell happened to be in.
#   2. The status probe parsed the DSN by hand and got user='oracle:'
#      password='/' out of oracle://@host:port/service. It could never
#      connect. It now uses the same parser the API uses.
#   3. Nothing checked that the ingestion package Python imports is the
#      one in $Root. With PYTHONPATH pointing at another checkout, it
#      may not be - so the script now prints which one it resolved.
#   4. Event 360's three steps and their row counts.
# =====================================================================

# ---- paths ----
$Root      = "C:\SEI\bbhcatalog\CP360-Base-Final"
$Artifacts = "$Root\sample-artifacts"

# A wrong root used to fail silently: Set-Location errored, the script
# carried on, and ingestion ran somewhere else entirely. Stop here instead.
if (-not (Test-Path $Root)) {
  Write-Error "Root not found: $Root  - fix `$Root at the top of this script"
  exit 1
}
Set-Location $Root
if (-not (Test-Path (Join-Path $Root "ingestion\run.py"))) {
  Write-Error "$Root does not contain ingestion\run.py - wrong folder?"
  exit 1
}

# ---- DATABASE (edit to your Oracle) ----
$env:CP_CATALOG_DB_DSN = "oracle://@dvlpbdb1.testbbh.com:2483/pbdwhdbt"
$env:CP_CATALOG_DB_DSN_VAR = "@dvlpbdb1.testbbh.com:2483/pbdwhdbt"
$env:SEI_ORACLE_SCHEMAS = "SEI_RAW,SEI_STAGE"
$env:CP_CATALOG_ROOT = $Artifacts
$env:CATALOG_DISABLE_SECURITY = "true"
$env:ORACLE_PROD_DSN = "oracle://PBDWAPP:dev_pass123#@dvlpbdb1.testbbh.com:2483/pbdwhdbt"
$env:ORACLE_PROD_SCHEMAS = "PBDWAPP"
$env:ORACLE_PLATFORM_ID = "PBDWAPP"

# ---- DATA-FEEDS (rich feed dictionary + reference list) ----
$env:CP_LEGACY_LINEAGE_XLSX = "$Artifacts\LEGACY_LINEAGE\legacy_lineage.xlsx"
$env:CP_LEGACY_SOURCES = "PBDW=$Artifacts\CP_LEGACY_DICT_XLSX\ADDVMapping.xlsx"
$env:DATA360_FEED_DICTIONARY_PATH = "$Artifacts\DATA-FEEDS\SWP_EOD_Data_Feeds.xlsx"
$env:REFERENCE_DATA_XLSX = "$Artifacts\DATA-FEEDS\SWP_EOD_Data_Feeds-Reference.xlsx"

# NOTE: this points at a DIFFERENT checkout from $Root. If that folder also
# contains an `ingestion` package, Python may import THAT one and your
# changes here will appear to do nothing. The check below prints which one
# actually won; if it is not under $Root, that is your answer.
$env:PYTHONPATH = "C:\SEI\bbhcatalog\Aneesh360catalog"

$env:CP_ENV_WORKBOOK="$Artifacts\INFRAINVENTORY\cp_env_infrastructure_v3.csv"
$env:CP_LEGACY_DICT_XLSX = "$Artifacts\CP_LEGACY_DICT_XLSX\ADDVMapping.xlsx"
$env:CP_LEGACY_LINEAGE_FROM_XLSX = 1

#--------------------------------Variance Configuration-----------------------------#
# ---- PBDW source warehouse (where the stage tables are profiled) ----------
$env:CP_VAR_PBDW_DSN = "A041327:bbhpass123@qclpbdb1.testbbh.com:2483/PBDWHDBQ"
$env:ORACLE_CLIENT_DIR="C:\instantclient_23_0"
# Actual schema owners: staging chain in PBDWSTG, final tables in PBDWAPP.
$env:CP_VAR_PBDW_SCHEMA_SRC = "PBDWSTG"
$env:CP_VAR_PBDW_SCHEMA_STG1 = "PBDWSTG"
$env:CP_VAR_PBDW_SCHEMA_STG2 = "PBDWSTG"
$env:CP_VAR_PBDW_SCHEMA_DWH = "PBDWAPP"

# ---- IMDS source warehouse ------------------------------------------------
$env:CP_VAR_IMDS_DSN = "imds_ro:CHANGE_ME@imds-host:1521/imdssvc"   # -- EDIT
$env:CP_VAR_IMDS_SCHEMA_SRC = "IMDS_SRC"                            # -- EDIT
$env:CP_VAR_IMDS_SCHEMA_STG1 = "IMDS_STG"                           # -- EDIT
$env:CP_VAR_IMDS_SCHEMA_STG2 = "IMDS_STG"                           # -- EDIT
$env:CP_VAR_IMDS_SCHEMA_DWH = "IMDS"                                # -- EDIT

# ---- FEED-CATALOG (simple feeds + rich loaders + business flows) ----
$env:INBOUND_FEEDS_XLSX = "$Artifacts\FEED-CATALOG\inbound_feeds_full.xlsx"
$env:OUTBOUND_FEEDS_XLSX = "$Artifacts\FEED-CATALOG\outbound_feeds_full.xlsx"
$env:LOADER_CATALOG_XLSX = "$Artifacts\FEED-CATALOG\loaders_full.xlsx"
$env:LOADER_WORKBOOK_XLSX = "$Artifacts\FEED-CATALOG\CP_Catalog_SEI_Loaders.xlsx"
$env:BUSINESS_FLOWS_XLSX = "$Artifacts\FEED-CATALOG\CP_Catalog_Business_Flows_v20_Compressed.xlsx"
$env:INTERFACE360_XLSX_PATH = "$Artifacts\INTERFACE-SYSTEM\interfaces.xlsx"

# ---- EVENT 360 -------------------------------------------------------------
# Three steps, three sources, kept apart on purpose:
#   event360            the CONTRACT      - what SEI says an event is
#   event_subscription  OUR decisions     - who consumes it (CSVs you maintain)
#   sdc_compute         the MEASURED bill - warehouse time per SDC view
# A folder may hold ONE workbook at a time; two are two different clients or
# periods and the connector refuses to guess. Point at the file when you have
# several.
$env:CP_EVENT360_XLSX    = "$Artifacts\EVENT-360"
$env:CP_EVENT_SUB_DIR    = "$Artifacts\EVENT-360"          # consumers.csv + subscriptions.csv
$env:CP_SDC_COMPUTE_XLSX = "$Artifacts\SDC-COMPUTE"
# $env:CP_SDC_COMPUTE_XLSX   = "D:\drops\SDC Client compute sizing reference.xlsx"
# $env:CP_SDC_COMPUTE_CLIENT = "CLIENT_A"   # only if the Summary sheet's name
#                                           # is not the code you want stored
# Gates are hard by default and that is the point: a load four rows short looks
# right on screen and quietly under-reports. 0/false/no downgrades a failure to
# a logged ERROR and writes the rows ANYWAY - for inspecting a workbook you know
# is mid-revision, not for getting past a gate.
# $env:CP_EVENT360_STRICT    = "0"
# $env:CP_SDC_COMPUTE_STRICT = "0"
# $env:CP_EVENT_SUB_STRICT   = "0"

# ---- optional supporting features (skip cleanly if file absent) ----
$env:API_SPEC_ROOT = "$Artifacts\API-SPEC"
$env:POSTMAN_ROOT = "$Artifacts\POSTMAN"
$env:DBT_MANIFEST_PATH = "$Artifacts\dbt-artifacts\manifest.json"
$env:DBT_DIALECT = "oracle"
$env:AIRFLOW_DSN = "file:///$($Artifacts -replace '\\','/')/airflow-sim/airflow_metadata.json"
$env:GLOSSARY_AUTHORED_PATH = "$Artifacts\GLOSSARY\business-glossary.md"
$env:PII_ATTRIBUTES_PATH = "$Artifacts\OVERLAY\PII_Attributes_List.xlsx"

# ---- which `ingestion` package will Python actually import? ----
# PYTHONPATH above points at another checkout. If the answer is not under
# $Root, that is why an edit here changes nothing.
Write-Host "`n=== Code that will run ===" -ForegroundColor Cyan
python -c "import ingestion, os; p=os.path.dirname(ingestion.__file__); print('  ingestion ->', p)" 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "  (could not import ingestion - is the venv active?)" -ForegroundColor Yellow }

# ---- show which input files actually exist ----
Write-Host "`n=== Input files ===" -ForegroundColor Cyan
$inputs = [ordered]@{
 "Feed dictionary (rich)"   = $env:DATA360_FEED_DICTIONARY_PATH
 "Reference list"           = $env:REFERENCE_DATA_XLSX
 "Inbound feeds (simple)"   = $env:INBOUND_FEEDS_XLSX
 "Outbound feeds (simple)"  = $env:OUTBOUND_FEEDS_XLSX
 "Loaders (simple)"         = $env:LOADER_CATALOG_XLSX
 "Loaders (rich 10-sheet)"  = $env:LOADER_WORKBOOK_XLSX
 "Business flows v20"       = $env:BUSINESS_FLOWS_XLSX
 "Swagger (API-SPEC)"       = $env:API_SPEC_ROOT
 "dbt manifest"             = $env:DBT_MANIFEST_PATH
 "Glossary"                 = $env:GLOSSARY_AUTHORED_PATH
 "PII attributes"           = $env:PII_ATTRIBUTES_PATH
}
foreach ($k in $inputs.Keys) {
 $exists = Test-Path $inputs[$k]
 $mark  = if ($exists) { "[OK ]" } else { "[ -- ]" }
 $color = if ($exists) { "Green" } else { "DarkGray" }
 Write-Host (" {0} {1}" -f $mark, $k) -ForegroundColor $color
}

# ---- Event 360 sources (reported separately) ----
# A missing one is not a broken setup: the three steps are independent, and
# "no subscriptions yet" is a real state the screens show honestly.
Write-Host "`n=== Event 360 sources ===" -ForegroundColor Cyan
@(
  @{ n = "event360 workbook";    p = $env:CP_EVENT360_XLSX;    f = "*.xlsx" },
  @{ n = "sdc_compute workbook"; p = $env:CP_SDC_COMPUTE_XLSX; f = "*.xlsx" },
  @{ n = "consumers.csv";        p = $env:CP_EVENT_SUB_DIR;    f = "consumers.csv" },
  @{ n = "subscriptions.csv";    p = $env:CP_EVENT_SUB_DIR;    f = "subscriptions.csv" }
) | ForEach-Object {
  # capture before the inner pipeline: $_ is rebound inside Where-Object
  $src  = $_
  $hits = @()
  if (Test-Path $src.p) {
    $hits = @(Get-ChildItem -Path $src.p -Filter $src.f -File -ErrorAction SilentlyContinue |
              Where-Object { $_.Name -notlike '~$*' })
  }
  if     ($hits.Count -eq 1) { Write-Host ("  [OK ]  {0,-22} {1}" -f $src.n, $hits[0].Name) -ForegroundColor Green }
  elseif ($hits.Count -gt 1) { Write-Host ("  [!!]   {0,-22} {1} files - name one with the *_XLSX var" -f $src.n, $hits.Count) -ForegroundColor Yellow }
  else                       { Write-Host ("  [ -- ] {0,-22} nothing in {1}" -f $src.n, $src.p) -ForegroundColor DarkGray }
}

# ---- run ingestion in dependency order ----
Write-Host "`n=== Running ingestion (full, ordered) ===" -ForegroundColor Cyan
python -m ingestion.run
if ($LASTEXITCODE -ne 0) {
 Write-Host "Ingestion returned a non-zero exit code; check the log above." -ForegroundColor Yellow
}

# ---- per-feature status (row counts via a tiny python probe) ----
Write-Host "`n=== Feature status (row counts) ===" -ForegroundColor Cyan
$probe = @'
import os, sys, oracledb
# Use the SAME parser the API uses. The hand-rolled split that used to be here
# turned "oracle://@host:port/service" into user="oracle:" password="/" and
# could never connect - a second copy of a rule that drifted from the first.
sys.path.insert(0, os.path.join(os.getcwd(), "api"))
try:
    from app.db import _parse_dsn
except Exception:
    def _parse_dsn(dsn):
        s = dsn[len("oracle://"):] if dsn.startswith("oracle://") else dsn
        if "@" in s:
            creds, host = s.split("@", 1)
            if ":" in creds:   u, p = creds.split(":", 1)
            elif "/" in creds: u, p = creds.split("/", 1)
            else:              u, p = creds, ""
            return u, p, host
        return None, None, s

user, pwd, host = _parse_dsn(os.environ["CP_CATALOG_DB_DSN"])
try:
    if user:
        c = oracledb.connect(user=user, password=pwd, dsn=host)
    else:
        c = oracledb.connect(dsn=host)          # external / wallet auth
except Exception as e:
    print("  (could not connect to Oracle:", str(e)[:120], ")")
    raise SystemExit
cur = c.cursor()

def count(label, sql):
    try:
        cur.execute(sql); n = cur.fetchone()[0]
        print(f"  {label:<44} {n}")
    except Exception as e:
        print(f"  {label:<44} (n/a: {str(e)[:40]})")

count("Data 360: feeds (feed_catalog)",        "SELECT COUNT(*) FROM feed_catalog")
count("Data 360: feed fields (columns)",       "SELECT COUNT(*) FROM columns")
count("Data 360: loaders rich (ldr_catalog)",  "SELECT COUNT(*) FROM ldr_catalog")
count("Data 360: loaders simple",              "SELECT COUNT(*) FROM loader_catalog")
count("Data 360/API 360: pipelines (bf)",      "SELECT COUNT(*) FROM bf_pipelines")
count("API 360: business flows (bf)",          "SELECT COUNT(*) FROM bf_api_flows")
count("API 360: endpoints (Swagger)",          "SELECT COUNT(*) FROM api_endpoints")
count("Interface 360 (bf)",                    "SELECT COUNT(*) FROM bf_interfaces")
count("Datapoint 360: data points",            "SELECT COUNT(*) FROM dp_registry")
count("Datapoint 360: reference rows",         "SELECT COUNT(*) FROM reference_data")
count("Compression marts",                     "SELECT COUNT(*) FROM bf_compression_plan")
count("Search index documents",                "SELECT COUNT(*) FROM search_index")
print()
count("Event 360: events (contract)",          "SELECT COUNT(*) FROM meta_event_definition")
count("Event 360: field rows",                 "SELECT COUNT(*) FROM meta_event_field")
count("Event 360: consumers",                  "SELECT COUNT(*) FROM ref_event_consumer")
count("Event 360: live subscriptions",
      "SELECT COUNT(*) FROM ctl_event_subscription WHERE status='ACTIVE'")
count("Event 360: compute periods",            "SELECT COUNT(*) FROM meta_sdc_compute_period")
count("Event 360: compute view-days",          "SELECT COUNT(*) FROM meta_sdc_compute_view")
print()
count("** GAP: unresolved flow datapoints",
      "SELECT COUNT(*) FROM bf_flow_datapoint_map WHERE resolved='N'")
count("** GAP: unresolved reference fields",
      "SELECT COUNT(*) FROM reference_data WHERE resolved='N'")
count("** GAP: pipelines w/o linked API flow",
      "SELECT COUNT(*) FROM bf_pipelines WHERE linked_api_flow_id IS NULL")
# Event 360's own gaps. The last one matters most: a compute extract covering
# part of the traffic makes every cost figure a floor, not a total.
count("** GAP: events nobody subscribes to",
      "SELECT COUNT(*) FROM meta_event_definition d WHERE NOT EXISTS "
      "(SELECT 1 FROM ctl_event_subscription s WHERE s.event_id=d.event_id "
      "AND s.status='ACTIVE')")
count("** GAP: subscriptions to unknown events",
      "SELECT COUNT(*) FROM ctl_event_subscription s WHERE NOT EXISTS "
      "(SELECT 1 FROM meta_event_definition d WHERE d.event_id=s.event_id)")
count("** GAP: compute periods under 97% coverage",
      "SELECT COUNT(*) FROM meta_sdc_compute_period WHERE view_coverage_pct < 97")
c.close()
'@
$probe | python -
Write-Host "`nDone. Start the API: uvicorn app.main:app --app-dir api --port 8000" -ForegroundColor Cyan
