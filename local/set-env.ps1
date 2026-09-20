# =====================================================================
# CP Catalog — set local dev environment variables (PowerShell)
# Usage:  . .\local\set-env.ps1      (note the leading dot + space —
#         this "dot-sources" the script so the vars persist in your shell)
# =====================================================================

# --- repo root: the folder that contains ingestion\, api\, sample-artifacts\
# Auto-detect from this script's location (local\ is one level under root).
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Write-Host ">>> Repo root: $Root" -ForegroundColor Cyan

# --- 1. Oracle catalog DB ---------------------------------------------
# EDIT these to match the user/password/host/service you created the schema in.
$env:CP_CATALOG_DB_DSN = "oracle://catalog_user:catalogpwd@localhost:1521/FREEPDB1"

# --- 2. Artifact root (bundled sample-artifacts for local dev) ---------
$env:CP_CATALOG_ROOT = Join-Path $Root "sample-artifacts"

# --- 3. Per-artifact paths (derived from the root) --------------------
$env:INTERFACE360_XLSX_PATH       = Join-Path $env:CP_CATALOG_ROOT "INTERFACE-SYSTEM\interfaces.xlsx"
$env:DATA360_FEED_DICTIONARY_PATH = Join-Path $env:CP_CATALOG_ROOT "DATA-FEEDS\SWP_EOD_Data_Feeds.xlsx"
$env:PII_ATTRIBUTES_PATH          = Join-Path $env:CP_CATALOG_ROOT "OVERLAY\PII_Attributes_List.xlsx"
$env:API_SPEC_ROOT                = Join-Path $env:CP_CATALOG_ROOT "API-SPEC"
$env:POSTMAN_ROOT                 = Join-Path $env:CP_CATALOG_ROOT "POSTMAN"

# --- Business Flow workbook (CP_Catalog_Business_Flows.xlsx, 9 sheets) -----
# Ingested by the business_flow step (runs after datapoint_index). Resolves
# Flow_Datapoint_Map against dp_registry; populates bf_* tables + compression.
$env:BUSINESS_FLOWS_XLSX          = Join-Path $env:CP_CATALOG_ROOT "BUSINESS-FLOWS\CP_Catalog_Business_Flows.xlsx"

# --- Reference Data (SWP EOD Data Feeds Reference List) --------------------
# Flat field-reference catalog (Category | Position | Field Name | Field
# Description | Detail Description). Enriches Datapoint 360 by category+field.
# Ingested by the reference_data step (after datapoint_index).
$env:REFERENCE_DATA_XLSX          = Join-Path $env:CP_CATALOG_ROOT "REFERENCE\SWP_EOD_Data_Feeds_Reference_List.xlsx"

# --- Event 360 -------------------------------------------------------------
# Three steps, three sources, kept apart on purpose:
#   event360           the CONTRACT       — what SEI says an event is
#   event_subscription OUR decisions      — who consumes it (CSV you maintain)
#   sdc_compute        the MEASURED bill  — warehouse time per SDC view
# All three default to these same paths, so you can leave every one of these
# unset and the commands still work from the repo root. They are set here so
# the load runs the same from any working directory.
$env:CP_EVENT360_XLSX     = Join-Path $env:CP_CATALOG_ROOT "EVENT-360"
$env:CP_EVENT_SUB_DIR     = Join-Path $env:CP_CATALOG_ROOT "EVENT-360"
$env:CP_SDC_COMPUTE_XLSX  = Join-Path $env:CP_CATALOG_ROOT "SDC-COMPUTE"

# The folder may hold ONE workbook at a time — two are two different clients or
# periods, and guessing between them is worse than refusing. Point at the file
# directly when you have several:
# $env:CP_SDC_COMPUTE_XLSX = "D:\drops\SDC Client compute sizing reference.xlsx"
# $env:CP_SDC_COMPUTE_CLIENT = "CLIENT_A"   # only if the Summary sheet's name
#                                           # is not the code you want stored

# Gates are hard by default and that is the point: a load that is four rows
# short looks right on screen and quietly under-reports. 0/false/no downgrades
# a failure to a logged ERROR and writes the rows ANYWAY — for inspecting a
# workbook you know is mid-revision, not for getting past a gate.
# $env:CP_EVENT360_STRICT     = "0"
# $env:CP_SDC_COMPUTE_STRICT  = "0"
# $env:CP_EVENT_SUB_STRICT    = "0"

# --- 4. dbt (simulated manifest) --------------------------------------
$env:DBT_MANIFEST_PATH = Join-Path $env:CP_CATALOG_ROOT "dbt-artifacts\manifest.json"
$env:DBT_DIALECT       = "oracle"

# --- 5. Airflow (simulated metadata FILE — note file:/// + forward slashes)
$AirflowJson = (Join-Path $env:CP_CATALOG_ROOT "airflow-sim\airflow_metadata.json") -replace '\\','/'
$env:AIRFLOW_DSN = "file:///$AirflowJson"

# --- 6. Project resolution --------------------------------------------
$env:SEI_ORACLE_SCHEMAS = "SEI_RAW,SEI_STAGE"

# --- 7. Runtime flags -------------------------------------------------
$env:ENVIRONMENT             = "dev"
$env:CATALOG_DISABLE_SECURITY = "true"
$env:CORS_ORIGINS            = "http://localhost:5173"

# --- Optional sources (leave unset locally; ingestion skips them) -----
# $env:ORACLE_PROD_DSN     = "oracle://reader:pwd@oraprod:1521/PROD"
# $env:ORACLE_PROD_SCHEMAS = "PBDW,IMDW,RISK,SEI_RAW,SEI_STAGE"

# --- Show what was set -------------------------------------------------
Write-Host ">>> Environment set:" -ForegroundColor Green
@(
  "CP_CATALOG_DB_DSN","CP_CATALOG_ROOT","INTERFACE360_XLSX_PATH",
  "DATA360_FEED_DICTIONARY_PATH","PII_ATTRIBUTES_PATH","API_SPEC_ROOT",
  "POSTMAN_ROOT","DBT_MANIFEST_PATH","DBT_DIALECT","AIRFLOW_DSN",
  "SEI_ORACLE_SCHEMAS","ENVIRONMENT","CATALOG_DISABLE_SECURITY",
  "CP_EVENT360_XLSX","CP_EVENT_SUB_DIR","CP_SDC_COMPUTE_XLSX"
) | ForEach-Object {
  $val = [Environment]::GetEnvironmentVariable($_, "Process")
  "{0,-30} = {1}" -f $_, $val
}

# --- Sanity: confirm the artifact files actually exist ----------------
Write-Host ">>> File check:" -ForegroundColor Green
@(
  $env:INTERFACE360_XLSX_PATH, $env:DATA360_FEED_DICTIONARY_PATH,
  $env:PII_ATTRIBUTES_PATH, $env:DBT_MANIFEST_PATH,
  (Join-Path $env:CP_CATALOG_ROOT "airflow-sim\airflow_metadata.json")
) | ForEach-Object {
  if (Test-Path $_) { Write-Host "  [OK]      $_" -ForegroundColor Green }
  else              { Write-Host "  [MISSING] $_" -ForegroundColor Red }
}

# --- Event 360 drop folders -------------------------------------------
# Reported separately because a missing one is not a broken setup: the steps
# are independent, and "no subscriptions yet" is a real state the screens
# show honestly rather than an error.
Write-Host ">>> Event 360 sources:" -ForegroundColor Green
@(
  @{ n = "event360 workbook";    p = $env:CP_EVENT360_XLSX;    f = "*.xlsx" },
  @{ n = "sdc_compute workbook"; p = $env:CP_SDC_COMPUTE_XLSX; f = "*.xlsx" },
  @{ n = "consumers.csv";        p = $env:CP_EVENT_SUB_DIR;    f = "consumers.csv" },
  @{ n = "subscriptions.csv";    p = $env:CP_EVENT_SUB_DIR;    f = "subscriptions.csv" }
) | ForEach-Object {
  # Capture the item before the inner pipeline: $_ is rebound inside
  # Where-Object, and relying on it being restored afterwards is the kind of
  # thing that works until it does not.
  $src  = $_
  $hits = @()
  if (Test-Path $src.p) {
    $hits = @(Get-ChildItem -Path $src.p -Filter $src.f -File -ErrorAction SilentlyContinue |
              Where-Object { $_.Name -notlike '~$*' })
  }
  if ($hits.Count -eq 1) {
    Write-Host ("  [OK]      {0,-22} {1}" -f $src.n, $hits[0].Name) -ForegroundColor Green
  } elseif ($hits.Count -gt 1) {
    Write-Host ("  [AMBIG]   {0,-22} {1} files - name one with the *_XLSX var" -f $src.n, $hits.Count) -ForegroundColor Yellow
  } else {
    Write-Host ("  [none]    {0,-22} nothing in {1}" -f $src.n, $src.p) -ForegroundColor DarkGray
  }
}
