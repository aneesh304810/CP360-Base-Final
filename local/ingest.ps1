# Load the catalog from the shared folder (or sample-artifacts).
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
# load .env into the process environment
Get-Content local\.env | Where-Object { $_ -match '^\s*[^#].*=' } | ForEach-Object {
  $k,$v = $_ -split '=',2
  # expand ${CP_CATALOG_ROOT} references
  $v = $v -replace '\$\{CP_CATALOG_ROOT\}', $env:CP_CATALOG_ROOT
  [Environment]::SetEnvironmentVariable($k.Trim(), $v.Trim(), "Process")
}
if (-not $env:INTERFACE360_XLSX_PATH) { $env:INTERFACE360_XLSX_PATH = Join-Path $env:CP_CATALOG_ROOT "INTERFACE-SYSTEM\interfaces.xlsx" }
if (-not $env:DATA360_FEED_DICTIONARY_PATH) { $env:DATA360_FEED_DICTIONARY_PATH = Join-Path $env:CP_CATALOG_ROOT "DATA-FEEDS\SWP_EOD_Data_Feeds.xlsx" }
if (-not $env:PII_ATTRIBUTES_PATH) { $env:PII_ATTRIBUTES_PATH = Join-Path $env:CP_CATALOG_ROOT "OVERLAY\PII_Attributes_List.xlsx" }
& .\.venv\Scripts\Activate.ps1
Write-Host ">>> Ingesting from: $env:CP_CATALOG_ROOT"
python -m ingestion.run
