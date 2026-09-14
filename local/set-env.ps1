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
  "SEI_ORACLE_SCHEMAS","ENVIRONMENT","CATALOG_DISABLE_SECURITY"
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
