# =====================================================================
# load-all.ps1 -- set every environment variable CP 360 reads, run the
#                ingestion steps in dependency order, then report what
#                actually landed.
#
#   C:\SEI\seiml\Scripts\Activate.ps1
#   .\local\load-all.ps1
#
# PASSWORDS ARE NOT IN THIS FILE. They live in local\secrets.ps1, which
# is in .gitignore. Copy local\secrets.ps1.example to local\secrets.ps1
# and fill it in once; this script dot-sources it below and stops with
# instructions if it is missing.
#
# EVERY VARIABLE HERE IS ONE THE CODE ACTUALLY READS. Ones that are
# commented out are real and optional. Two that used to be set here --
# CATALOG_DISABLE_SECURITY and CORS_ORIGINS -- were read by nothing at
# all and have been removed rather than left looking live.
# =====================================================================

$ErrorActionPreference = "Stop"

# ---- paths -----------------------------------------------------------
# Derived from this script's own location: local\ is one level under the
# repo root. A hard-coded path breaks the moment the folder is renamed or
# cloned somewhere else, and the failure is a confusing one -- ingestion
# runs against the wrong tree rather than refusing.
$Root      = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Artifacts = Join-Path $Root "sample-artifacts"
Write-Host ">>> Repo root: $Root" -ForegroundColor Cyan

# PYTHONPATH must point at THIS repo, or `python -m ingestion.run` can
# import a different checkout's ingestion package and load with code you
# are not looking at.
$env:PYTHONPATH = $Root

# ---- secrets ---------------------------------------------------------
$Secrets = Join-Path $PSScriptRoot "secrets.ps1"
if (Test-Path $Secrets) {
  . $Secrets
  Write-Host ">>> Loaded credentials from local\secrets.ps1" -ForegroundColor Green
} else {
  Write-Host ""
  Write-Host "!!! local\secrets.ps1 not found." -ForegroundColor Red
  Write-Host "    copy local\secrets.ps1.example local\secrets.ps1" -ForegroundColor Yellow
  Write-Host "    then edit it and put your Oracle passwords in." -ForegroundColor Yellow
  Write-Host "    (It is in .gitignore, so it stays on this machine.)" -ForegroundColor Yellow
  Write-Host ""
  if (-not $env:CP_CATALOG_DB_DSN) {
    throw "CP_CATALOG_DB_DSN is not set and local\secrets.ps1 is missing -- nothing to load into."
  }
  Write-Host ">>> Using CP_CATALOG_DB_DSN already set in this shell." -ForegroundColor Yellow
}

# ---- database --------------------------------------------------------
# CP_CATALOG_DB_DSN, ORACLE_PROD_DSN, CP_VAR_*_DSN come from secrets.ps1.
$env:SEI_ORACLE_SCHEMAS  = "SEI_RAW,SEI_STAGE"
$env:CP_CATALOG_ROOT     = $Artifacts
$env:ORACLE_PROD_SCHEMAS = "PBDWAPP"
$env:ORACLE_PLATFORM_ID  = "PBDWAPP"
$env:ORACLE_CLIENT_DIR   = "C:\instantclient_23_0"

# ---- DATA-FEEDS (rich feed dictionary + reference list) --------------
$env:DATA360_FEED_DICTIONARY_PATH = "$Artifacts\DATA-FEEDS\SWP_EOD_Data_Feeds.xlsx"
$env:REFERENCE_DATA_XLSX          = "$Artifacts\DATA-FEEDS\SWP_EOD_Data_Feeds-Reference.xlsx"

# ---- FEED-CATALOG (simple feeds + rich loaders + business flows) -----
$env:INBOUND_FEEDS_XLSX   = "$Artifacts\FEED-CATALOG\inbound_feeds_full.xlsx"
$env:OUTBOUND_FEEDS_XLSX  = "$Artifacts\FEED-CATALOG\outbound_feeds_full.xlsx"
$env:LOADER_CATALOG_XLSX  = "$Artifacts\FEED-CATALOG\loaders_full.xlsx"
$env:LOADER_WORKBOOK_XLSX = "$Artifacts\FEED-CATALOG\CP_Catalog_SEI_Loaders.xlsx"
$env:BUSINESS_FLOWS_XLSX  = "$Artifacts\FEED-CATALOG\CP_Catalog_Business_Flows_v20_Compressed.xlsx"
$env:INTERFACE360_XLSX_PATH = "$Artifacts\INTERFACE-SYSTEM\interfaces.xlsx"

# ---- LEGACY LINEAGE + DICTIONARY -------------------------------------
$env:CP_LEGACY_LINEAGE_XLSX      = "$Artifacts\LEGACY_LINEAGE\legacy_lineage.xlsx"
$env:CP_LEGACY_LINEAGE_FROM_XLSX = 1
$env:CP_LEGACY_SOURCES           = "PBDW=$Artifacts\CP_LEGACY_DICT_XLSX\ADDVMapping.xlsx"
$env:CP_LEGACY_DICT_XLSX         = "$Artifacts\CP_LEGACY_DICT_XLSX\ADDVMapping.xlsx"
# Sheet names are auto-detected. Name one only when the workbook has two
# that could both be it and you want to be sure which is read.
# $env:CP_LEGACY_LINEAGE_SHEET      = "lineage"
# $env:CP_LEGACY_LINEAGE_SHEET_RICH = "lineage_rich"
# $env:CP_LEGACY_DICT_SHEET         = "dictionary"
# $env:CP_LEGACY_DEPENDENCY_SHEET   = "dependencies"
# $env:CP_LEGACY_PROOF_SHEET        = "proof"
# $env:CP_LEGACY_SOURCE_FILE_SHEET  = "CP_SOURCE_FILE"
# $env:CP_LEGACY_DICT_SYSTEM        = "ADDVANTAGE"
# $env:CP_LEGACY_DATA_SOURCE        = "PBDW"

# TABLE CATALOG: what each warehouse TABLE is, in business words. This is
# what the Lineage Business view reads for its headings -- without it the
# view falls back to physical names like DIM_ACCOUNT. Auto-detected in
# the dictionary workbook; name the sheet only to override.
# $env:CP_LEGACY_TABLE_CATALOG_SHEET = "TABLE CATALOG"

# ---- SEI CROSSWALK ---------------------------------------------------
$env:CP_SEI_XLSX         = "$Artifacts\LEGACY_LINEAGE\STAR_IMDS_SEI_Lineage_Catalog_Verified-Final-With-Transformations.xlsx"
$env:CP_SEI_DATA_SOURCE  = "IMDS"
$env:CP_SEI_LINEAGE_MODE = "load"
# $env:CP_SEI_RELOAD     = "1"   # replace the lane instead of merging into it

# ---- ENVIRONMENT 360 -------------------------------------------------
$env:CP_ENV_WORKBOOK = "$Artifacts\INFRAINVENTORY\cp_env_infrastructure_v3.csv"

# ---- EVENT 360 -------------------------------------------------------
# Three steps, three sources, kept apart on purpose:
#   event360           the CONTRACT      -- what SEI says an event is
#   event_subscription OUR decisions     -- who consumes it (CSVs you keep)
#   sdc_compute        the MEASURED bill -- warehouse time per SDC view
# A folder may hold ONE workbook at a time; two are two different clients
# or periods and the connector refuses to guess. Name the file when you
# have several.
$env:CP_EVENT360_XLSX    = "$Artifacts\EVENT-360\CP360_SEI_Event_360_Complete_Event_Catalog_v1.1_With_Marker_Events.xlsx"
$env:CP_EVENT_SUB_DIR    = "$Artifacts\EVENT-360"   # consumers.csv + subscriptions.csv
$env:CP_SDC_COMPUTE_XLSX = "$Artifacts\SDC-COMPUTE"

# v1.1 declares a System event whose payload is 3 wide, where every other
# type is 4. The arithmetic gate is told, rather than loosened.
$env:CP_EVENT360_PAYLOAD_BY_TYPE = "System=3"

# Micro-batch markers (1000 / 1001) are read from the marker sheet of the
# same workbook. The sheet is found by name -- micro_batch_markers,
# batch_markers and a couple of spellings besides -- so there is nothing
# to set. Markers listed in Event_Catalog as well are demoted, not
# counted twice.

# $env:CP_SDC_COMPUTE_CLIENT = "CLIENT_A"  # only when the Summary sheet's
#                                          # name is not the code to store
#
# Gates are hard by default and that is the point: a load four rows short
# looks right on screen and quietly under-reports. 0/false/no downgrades
# a failure to a logged ERROR and writes the rows ANYWAY -- for inspecting
# a workbook you know is mid-revision, not for getting past a gate.
# $env:CP_EVENT360_STRICT    = "0"
# $env:CP_SDC_COMPUTE_STRICT = "0"
# $env:CP_EVENT_SUB_STRICT   = "0"

# ---- VARIANCE 360 ----------------------------------------------------
# DSNs come from secrets.ps1. Schema owners are not secret.
# Staging chain lives in PBDWSTG, the final tables in PBDWAPP.
$env:CP_VAR_PBDW_SCHEMA_SRC  = "PBDWSTG"
$env:CP_VAR_PBDW_SCHEMA_STG1 = "PBDWSTG"
$env:CP_VAR_PBDW_SCHEMA_STG2 = "PBDWSTG"
$env:CP_VAR_PBDW_SCHEMA_DWH  = "PBDWAPP"
$env:CP_VAR_IMDS_SCHEMA_SRC  = "IMDS_SRC"    # -- EDIT
$env:CP_VAR_IMDS_SCHEMA_STG1 = "IMDS_STG"    # -- EDIT
$env:CP_VAR_IMDS_SCHEMA_STG2 = "IMDS_STG"    # -- EDIT
$env:CP_VAR_IMDS_SCHEMA_DWH  = "IMDS"        # -- EDIT
# $env:CP_VAR_PARALLEL   = "4"
# Variance is NOT part of `python -m ingestion.run`; run it separately.

# ---- optional supporting features (skip cleanly if absent) -----------
$env:API_SPEC_ROOT          = "$Artifacts\API-SPEC"
$env:POSTMAN_ROOT           = "$Artifacts\POSTMAN"
$env:DBT_MANIFEST_PATH      = "$Artifacts\dbt-artifacts\manifest.json"
$env:DBT_DIALECT            = "oracle"
$env:AIRFLOW_DSN            = "file:///$($Artifacts -replace '\\','/')/airflow-sim/airflow_metadata.json"
$env:GLOSSARY_AUTHORED_PATH = "$Artifacts\GLOSSARY\business-glossary.md"
$env:PII_ATTRIBUTES_PATH    = "$Artifacts\OVERLAY\PII_Attributes_List.xlsx"
# $env:DBT_CATALOG_PATH     = "$Artifacts\dbt-artifacts\catalog.json"
# $env:NON_SEI_SPEC_ROOT    = "$Artifacts\API-SPEC-NONSEI"
# $env:AIRFLOW_DAGS_FILTER  = ""

# ---- SIGN-IN AND ENTITLEMENT -----------------------------------------
# OFF. No login screen, the full sidebar, every endpoint open -- how CP 360
# has always run. See docs\security\README.md before changing it.
#
# It must be exactly "on". Not truthiness: "1", "true" and "yes" are NOT
# read as on, and the API says so at startup rather than pretending to be
# enabled. This variable is read by the API, not by ingestion -- it is set
# here so one file describes the whole deployment.
$env:CP_SECURITY = "off"

# Before switching to "on", all three or nobody can sign in:
#   1. run sql\64_security.sql          (creates the tables, seeds modules)
#   2. seed the first administrator     (the INSERT at the foot of that file)
#   3. fill in the directory below
# $env:CP_AD_HOST    = "dc01.bbh.com"
# $env:CP_AD_PORT    = "636"
# $env:CP_AD_USE_SSL = "1"          # 0 needs CP_AD_ALLOW_INSECURE=1 -- labs only
# $env:CP_AD_DOMAIN  = "bbh.com"    # bind is <account>@<domain>
# $env:CP_AD_BASE_DN = "DC=bbh,DC=com"   # optional: display name + e-mail
# $env:CP_AD_TIMEOUT = "8"
#
# $env:CP_SESSION_HOURS        = "10"
# $env:CP_SESSION_IDLE_MINUTES = "120"
# $env:CP_COOKIE_INSECURE      = "1"   # UI on plain HTTP in dev
#
# Only when the UI and API are on different origins AND CP_SECURITY=on.
# The vite dev server proxies /api, so it is already same-origin.
# $env:CP_CORS_ORIGINS = "http://localhost:5173"

# ---- show which input files actually exist ---------------------------
Write-Host "`n=== Input files ===" -ForegroundColor Cyan
$inputs = [ordered]@{
  "Feed dictionary (rich)"   = $env:DATA360_FEED_DICTIONARY_PATH
  "Reference list"           = $env:REFERENCE_DATA_XLSX
  "Inbound feeds (simple)"   = $env:INBOUND_FEEDS_XLSX
  "Outbound feeds (simple)"  = $env:OUTBOUND_FEEDS_XLSX
  "Loaders (simple)"         = $env:LOADER_CATALOG_XLSX
  "Loaders (rich 10-sheet)"  = $env:LOADER_WORKBOOK_XLSX
  "Business flows v20"       = $env:BUSINESS_FLOWS_XLSX
  "Interfaces"               = $env:INTERFACE360_XLSX_PATH
  "Legacy lineage"           = $env:CP_LEGACY_LINEAGE_XLSX
  "Legacy dictionary"        = $env:CP_LEGACY_DICT_XLSX
  "SEI crosswalk"            = $env:CP_SEI_XLSX
  "Event 360 catalog"        = $env:CP_EVENT360_XLSX
  "Event consumers.csv"      = (Join-Path $env:CP_EVENT_SUB_DIR "consumers.csv")
  "Event subscriptions.csv"  = (Join-Path $env:CP_EVENT_SUB_DIR "subscriptions.csv")
  "SDC compute"              = $env:CP_SDC_COMPUTE_XLSX
  "Environment inventory"    = $env:CP_ENV_WORKBOOK
  "Swagger (API-SPEC)"       = $env:API_SPEC_ROOT
  "dbt manifest"             = $env:DBT_MANIFEST_PATH
  "Glossary"                 = $env:GLOSSARY_AUTHORED_PATH
  "PII attributes"           = $env:PII_ATTRIBUTES_PATH
}
foreach ($k in $inputs.Keys) {
  $exists = $inputs[$k] -and (Test-Path $inputs[$k])
  $mark   = if ($exists) { "[OK]" } else { "[--]" }
  $color  = if ($exists) { "Green" } else { "DarkGray" }
  Write-Host ("  {0} {1}" -f $mark, $k) -ForegroundColor $color
}

# ---- run ingestion in dependency order -------------------------------
Write-Host "`n=== Running ingestion (full, ordered) ===" -ForegroundColor Cyan
Set-Location $Root
python -m ingestion.run
if ($LASTEXITCODE -ne 0) {
  Write-Host "Ingestion returned a non-zero exit code; check the log above." -ForegroundColor Yellow
}

# ---- what actually landed --------------------------------------------
# A file, not an inline here-string: the terminator has to sit at column 0
# and every leading space survives into the Python, so one stray indent
# used to break the whole status block after a load that worked.
Write-Host "`n=== Feature status (row counts) ===" -ForegroundColor Cyan
python tools\catalog_status.py

Write-Host "`nDone. Start the API and UI:  .\local\start.ps1" -ForegroundColor Cyan
Write-Host "Or the API alone:  uvicorn app.main:app --app-dir api --port 8000" -ForegroundColor DarkGray
