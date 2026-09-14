# Start API (8000) and UI (5173) in separate windows.
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
Get-Content local\.env | Where-Object { $_ -match '^\s*[^#].*=' } | ForEach-Object {
  $k,$v = $_ -split '=',2
  [Environment]::SetEnvironmentVariable($k.Trim(), $v.Trim(), "Process")
}
$root = (Get-Location).Path
Write-Host ">>> Starting API on http://localhost:8000 ..."
Start-Process powershell -ArgumentList "-NoExit","-Command","cd '$root'; .\.venv\Scripts\Activate.ps1; uvicorn app.main:app --app-dir api --host 0.0.0.0 --port 8000"
Write-Host ">>> Starting UI on http://localhost:5173 ..."
Start-Process powershell -ArgumentList "-NoExit","-Command","cd '$root\ui'; npm run dev"
Write-Host ">>> Open http://localhost:5173 — badge should read LIVE."
