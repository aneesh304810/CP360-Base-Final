# load.ps1 — CP 360 ingestion driver (env_infra section; merge into yours if one exists)
# Usage:
#   .\load.ps1 env_infra
#   .\load.ps1 env_infra -File D:\drops\cp_env_infrastructure.xlsx
# Environment (set once, e.g. in your profile or pipeline):
#   $env:CP_CATALOG_DB_DSN    = "A041327/<pwd>@dvlpbdb1.testbbh.com:2483/pbdwhdbt"
#   $env:CP_SAMPLE_ARTIFACTS  = "D:\cp360\sample_artifacts"   # dir with cp_env_infrastructure.csv
#   $env:CP_ENV_WORKBOOK      = "D:\drops\sheet.xlsx"         # optional: exact file overrides dir
param([Parameter(Position=0)][string]$Step, [string]$File)
if (-not $env:CP_CATALOG_DB_DSN) { Write-Error "CP_CATALOG_DB_DSN not set"; exit 1 }
switch ($Step) {
  "env_infra" {
    if ($File) { python -m ingestion.run env_infra --file $File }
    else       { python -m ingestion.run env_infra }
  }
  default { python -m ingestion.run $Step }
}
exit $LASTEXITCODE
