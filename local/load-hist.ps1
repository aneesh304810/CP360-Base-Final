# =====================================================================
# load-hist.ps1 -- load ONLY the historical data migration sheets
#                 (HIST_MIGRATION_LANES, HIST_SOURCE_REGISTER,
#                  HIST_MAPPING_EVIDENCE, HIST_HEADER_DICTIONARY) from the
#                 SEI crosswalk workbook into cp_hist_* (sql/86).
#
#   C:\SEI\seiml\Scripts\Activate.ps1
#   .\local\load-hist.ps1            # load if the workbook changed
#   .\local\load-hist.ps1 -Force     # load even if the workbook is unchanged
#   .\local\load-hist.ps1 -Xlsx "D:\path\to\other.xlsx"
#
# Same rules as load-all.ps1: passwords come from local\secrets.ps1,
# PYTHONPATH is this repo, and the workbook path is the one load-all uses
# unless -Xlsx says otherwise. Nothing else is loaded by this script.
# =====================================================================
param(
  [switch]$Force,
  [string]$Xlsx
)
$ErrorActionPreference = "Stop"

$Root      = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Artifacts = Join-Path $Root "sample-artifacts"
$env:PYTHONPATH = $Root
Write-Host ">>> Repo root: $Root" -ForegroundColor Cyan

$Secrets = Join-Path $PSScriptRoot "secrets.ps1"
if (Test-Path $Secrets) {
  . $Secrets
  Write-Host ">>> Loaded credentials from local\secrets.ps1" -ForegroundColor Green
} elseif (-not $env:CP_CATALOG_DB_DSN) {
  throw "CP_CATALOG_DB_DSN is not set and local\secrets.ps1 is missing -- nothing to load into."
}

# The workbook: the same one load-all.ps1 names for the crosswalk, unless
# overridden. CP_HIST_MIGRATION_XLSX wins over CP_SEI_XLSX in the loader.
if ($Xlsx) {
  $env:CP_HIST_MIGRATION_XLSX = $Xlsx
} elseif (-not $env:CP_HIST_MIGRATION_XLSX -and -not $env:CP_SEI_XLSX) {
  $env:CP_SEI_XLSX = "$Artifacts\LEGACY_LINEAGE\STAR_IMDS_SEI_Lineage_Catalog_Verified-Final-With-Transformations.xlsx"
}
$Target = if ($env:CP_HIST_MIGRATION_XLSX) { $env:CP_HIST_MIGRATION_XLSX } else { $env:CP_SEI_XLSX }
if (-not (Test-Path $Target)) { throw "Workbook not found: $Target" }
Write-Host ">>> Workbook: $Target" -ForegroundColor Cyan

if ($Force) { $env:CP_HIST_MIGRATION_FORCE = "1"; Write-Host ">>> Force: reloading even if the workbook is unchanged" -ForegroundColor Yellow }
else        { Remove-Item Env:CP_HIST_MIGRATION_FORCE -ErrorAction SilentlyContinue }

Write-Host "`n=== Running ingestion step: hist_migration ===" -ForegroundColor Cyan
Set-Location $Root
python -m ingestion.run hist_migration
if ($LASTEXITCODE -ne 0) {
  Write-Host "hist_migration returned a non-zero exit code; check the log above." -ForegroundColor Yellow
  Write-Host "If it says ORA-00942, apply sql\86_hist_migration.sql first." -ForegroundColor Yellow
} else {
  Write-Host "`nDone. Open Data Analysis > Historical data migration (restart the API if the route is new)." -ForegroundColor Green
}
