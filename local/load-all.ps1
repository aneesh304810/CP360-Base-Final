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
# view falls back to physical names like DIM_ACCOUNT.
#
# LEFT UNSET ON PURPOSE. The sheet is found by its headers, which is more
# reliable than a name somebody typed: set this to a sheet the workbook
# does not have and nothing is loaded. Set it only if auto-detect picks
# the wrong sheet, and check the log line it prints either way.
# $env:CP_LEGACY_TABLE_CATALOG_SHEET = "TABLE CATALOG"

# ---- SEI CROSSWALK ---------------------------------------------------
$env:CP_SEI_XLSX         = "$Artifacts\LEGACY_LINEAGE\STAR_IMDS_SEI_Lineage_Catalog_Verified-Final-With-Transformations.xlsx"
$env:CP_SEI_DATA_SOURCE  = "IMDS"
$env:CP_SEI_LINEAGE_MODE = "load"
# $env:CP_SEI_RELOAD     = "1"   # replace the lane instead of merging into it

# ---- ENVIRONMENT 360 -------------------------------------------------
$env:CP_ENV_WORKBOOK = "$Artifacts\INFRAINVENTORY\cp_env_infrastructure_v3.csv"

# ---- ADDVANTAGE UD FIELDS --------------------------------------------
# One folder holds every source: the DIM_ACCOUNT_UD extract csv, the UD
# metadata workbook, the TRP samples workbook, and the profiler's csvs
# (loose or in a profile\ sub-folder). Files are recognised by content, so
# names may vary between drops. NOT under sample-artifacts: these carry
# account numbers and names, and local-data\ is in .gitignore.
# Step `advantage_ud` (in the full run) loads them in dependency order and
# skips quietly when the folder is empty. Tables: sql\75, 76, 77.
$env:CP_ADDV_UD_DIR = Join-Path $Root "local-data\advantage-ud"
# $env:CP_ADDV_UD_CHUNK = "2000"   # extract rows per batch

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
$env:CP_VAR_PARALLEL         = "4"
# Variance is NOT part of `python -m ingestion.run`; run it separately.

# ---- optional supporting features (skip cleanly if absent) -----------
$env:API_SPEC_ROOT          = "$Artifacts\API-SPEC"
$env:POSTMAN_ROOT           = "$Artifacts\POSTMAN"
$env:DBT_MANIFEST_PATH      = "$Artifacts\dbt-artifacts\manifest.json"
$env:DBT_DIALECT            = "oracle"
$env:AIRFLOW_DSN            = "file:///$($Artifacts -replace '\\','/')/airflow-sim/airflow_metadata.json"
$env:GLOSSARY_AUTHORED_PATH = "$Artifacts\GLOSSARY\business-glossary.md"
$env:PII_ATTRIBUTES_PATH    = "$Artifacts\OVERLAY\PII_Attributes_List.xlsx"
$env:DBT_CATALOG_PATH       = "$Artifacts\dbt-artifacts\catalog.json"
$env:NON_SEI_SPEC_ROOT      = "$Artifacts\API-SPEC-NONSEI"
$env:AIRFLOW_DAGS_FILTER    = ""     # empty = every DAG

# ---- SIGN-IN AND ENTITLEMENT -----------------------------------------
# Read by the API, not by ingestion. Set here so one file describes the
# whole deployment. Full guide: docs\security\README.md
#
# OFF. No login screen, the full sidebar, every endpoint open -- how
# CP 360 has always run.
#
# It must be exactly "on". Not truthiness: "1", "true" and "yes" are NOT
# read as on, and the API says so at startup rather than pretending to be
# enabled.
$env:CP_SECURITY = "off"

# The identity every request is served as while CP_SECURITY is off. It
# shows in the audit trail and in /auth/me, flagged insecure.
$env:CP_SECURITY_OPEN_USER = "local.user"

# ---- Active Directory ------------------------------------------------
# CP 360 asks AD one question -- "are these credentials yours" -- and
# answers everything else itself. It never stores a password, and there
# is no password to put here: the bind uses what the person types.
#
# LEFT EMPTY ON PURPOSE. An empty CP_AD_HOST is how /security/health
# knows to report ad_configured: false. Filling it with a placeholder
# would make the health check claim a directory that is not there. Put
# your real domain controller in and it starts telling the truth.
$env:CP_AD_HOST    = ""                 # e.g. dc01.bbh.com
$env:CP_AD_PORT    = "636"              # 636 = LDAPS, 389 = plaintext
$env:CP_AD_USE_SSL = "1"                # 1 = LDAPS. See the warning below.
$env:CP_AD_DOMAIN  = ""                 # e.g. bbh.com -- bind is <account>@<domain>
$env:CP_AD_BASE_DN = ""                 # e.g. DC=bbh,DC=com -- optional,
                                        # only for display name and e-mail
$env:CP_AD_TIMEOUT = "8"                # seconds to connect

# CP_AD_USE_SSL=0 puts the password on the wire in clear text, so the
# login refuses to attempt it. This override exists for a lab and must
# not be set anywhere else. Deliberately left commented.
# $env:CP_AD_ALLOW_INSECURE = "1"

# ---- Sessions --------------------------------------------------------
# How long a sign-in lasts, and how long it may sit idle. The session is
# the cached answer from AD; a user disabled in CP 360 is stopped on
# their next click regardless, because status is re-read every request.
$env:CP_SESSION_HOURS        = "10"
$env:CP_SESSION_IDLE_MINUTES = "120"

# The session cookie is marked Secure, so a browser will not send it over
# plain HTTP. Uncomment only if you run the UI on http:// in dev.
# $env:CP_COOKIE_INSECURE = "1"

# ---- CORS ------------------------------------------------------------
# DELIBERATELY NOT SET. Leaving it unset means the API allows any origin,
# which is what it does today. Setting it RESTRICTS the API to exactly
# the origins listed -- for every request, whether or not CP_SECURITY is
# on -- so a browser opening the UI at any other address stops working.
#
# You need it only when the UI and API are on different origins AND
# CP_SECURITY=on: a browser will not send the session cookie
# cross-origin unless the API names the origin, and the spec forbids
# naming it alongside "*". The vite dev server proxies /api, so the
# normal laptop setup is already same-origin and needs nothing here.
# List every address the UI is opened at, comma-separated.
# $env:CP_CORS_ORIGINS = "http://localhost:5173"

# ---- Before switching CP_SECURITY to "on" ----------------------------
#   1. run sql\64_security.sql        (creates the tables, seeds modules)
#   2. seed the first administrator   (the INSERT at the foot of that file)
#   3. fill in CP_AD_HOST and CP_AD_DOMAIN above
# Miss any one and nobody can sign in. Check with:
#   curl http://localhost:8000/security/health

# ---- what this run is configured to do -------------------------------
Write-Host "`n=== Configuration ===" -ForegroundColor Cyan
# Greedy .* up to the LAST @, so a password containing an @ cannot end up
# on screen. Only the host and service are printed.
$dsnHost = if ($env:CP_CATALOG_DB_DSN -match '^.*@(.+)$') { $Matches[1] } else { "(unset)" }
Write-Host ("  {0,-26} {1}" -f "Catalog DB", $dsnHost)     # host only, never the password
Write-Host ("  {0,-26} {1}" -f "Artifacts", $Artifacts)
if ($env:CP_SECURITY -eq "on") {
  if ($env:CP_AD_HOST) {
    Write-Host ("  {0,-26} on - AD {1}" -f "Sign-in", $env:CP_AD_HOST) -ForegroundColor Green
  } else {
    Write-Host ("  {0,-26} on, but CP_AD_HOST is empty - NOBODY CAN SIGN IN" -f "Sign-in") -ForegroundColor Red
  }
} elseif ($env:CP_SECURITY -eq "off" -or -not $env:CP_SECURITY) {
  Write-Host ("  {0,-26} off - no login, every request has full rights" -f "Sign-in") -ForegroundColor Yellow
} else {
  Write-Host ("  {0,-26} CP_SECURITY='{1}' is not understood - treated as OFF" -f "Sign-in", $env:CP_SECURITY) -ForegroundColor Red
}

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
