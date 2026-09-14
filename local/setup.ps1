# One-time setup for Windows (PowerShell). Run from repo root: .\local\setup.ps1
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
Write-Host ">>> Creating Python venv (.venv) ..."
python -m venv .venv
& .\.venv\Scripts\Activate.ps1
Write-Host ">>> Installing API + ingestion requirements ..."
python -m pip install --quiet --upgrade pip
pip install --quiet -r api\requirements.txt -r ingestion\requirements.txt
Write-Host ">>> Installing UI deps ..."
Push-Location ui; npm install; Pop-Location
Write-Host ">>> Setup complete. Next:"
Write-Host "    1) copy local\.env.example local\.env  and edit it"
Write-Host "    2) .\local\ingest.ps1"
Write-Host "    3) .\local\start.ps1"
