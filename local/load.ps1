# load.ps1 — CP 360 ingestion driver (env_infra section; merge into yours if one exists)
# Usage:
#   .\load.ps1 env_infra
#   .\load.ps1 env_infra -File D:\drops\cp_env_infrastructure.xlsx
# Environment (set once, e.g. in your profile or pipeline):
#   $env:CP_CATALOG_DB_DSN    = "A041327/<pwd>@dvlpbdb1.testbbh.com:2483/pbdwhdbt"
#   $env:CP_SAMPLE_ARTIFACTS  = "D:\cp360\sample_artifacts"   # dir with cp_env_infrastructure.csv
#   $env:CP_ENV_WORKBOOK      = "D:\drops\sheet.xlsx"         # optional: exact file overrides dir
# Event 360:
#   .\load.ps1 event360_all                       # all three, stops on first failure
#   .\load.ps1 sdc_compute -File "D:\drops\SDC Client compute sizing reference.xlsx"
param([Parameter(Position=0)][string]$Step, [string]$File)
if (-not $env:CP_CATALOG_DB_DSN) { Write-Error "CP_CATALOG_DB_DSN not set"; exit 1 }
switch ($Step) {
  "env_infra" {
    if ($File) { python -m ingestion.run env_infra --file $File }
    else       { python -m ingestion.run env_infra }
  }
  # Event 360's three steps take their source by ENV VAR, not by a --file
  # flag, so -File is mapped here rather than passed through to a parser that
  # would reject it.
  "event360" {
    if ($File) { $env:CP_EVENT360_XLSX = $File }
    python -m ingestion.run event360
  }
  "sdc_compute" {
    if ($File) { $env:CP_SDC_COMPUTE_XLSX = $File }
    python -m ingestion.run sdc_compute
  }
  "event_subscription" {
    if ($File) { $env:CP_EVENT_SUB_DIR = $File }   # a FOLDER: the two CSVs
    python -m ingestion.run event_subscription
  }
  "event360_all" {
    foreach ($s in @("event360","sdc_compute","event_subscription")) {
      Write-Host ">>> $s" -ForegroundColor Cyan
      python -m ingestion.run $s
      if ($LASTEXITCODE -ne 0) {
        # Stop on the first failure. The steps are independent, but a half-run
        # that reports success is how a screen ends up quietly under-reporting.
        Write-Error "$s failed (exit $LASTEXITCODE) - stopping"
        exit $LASTEXITCODE
      }
    }
  }
  default { python -m ingestion.run $Step }
}
exit $LASTEXITCODE
