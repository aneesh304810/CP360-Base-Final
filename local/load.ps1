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

# ---- source paths -----------------------------------------------------
# Set only what is not already set, so dot-sourcing local\set-env.ps1 first,
# or exporting a var in your shell or pipeline, still wins. A script that
# overwrites the value you just set is the kind that makes people stop
# trusting their own environment.
#
# $Root is this script's parent's parent: local\load.ps1 -> repo root. That
# keeps the defaults right whichever directory you invoke it from, which the
# connectors' own relative defaults do not.
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $env:CP_CATALOG_ROOT) { $env:CP_CATALOG_ROOT = Join-Path $Root "sample-artifacts" }
$Artifacts = $env:CP_CATALOG_ROOT

# Event 360 - three steps, three sources, kept apart on purpose:
#   event360            the CONTRACT      - what SEI says an event is
#   event_subscription  OUR decisions     - who consumes it (CSVs you maintain)
#   sdc_compute         the MEASURED bill - warehouse time per SDC view
if (-not $env:CP_EVENT360_XLSX)    { $env:CP_EVENT360_XLSX    = Join-Path $Artifacts "EVENT-360" }
if (-not $env:CP_EVENT_SUB_DIR)    { $env:CP_EVENT_SUB_DIR    = Join-Path $Artifacts "EVENT-360" }
if (-not $env:CP_SDC_COMPUTE_XLSX) { $env:CP_SDC_COMPUTE_XLSX = Join-Path $Artifacts "SDC-COMPUTE" }
# $env:CP_SDC_COMPUTE_CLIENT = "CLIENT_A"   # only when the Summary sheet's name
#                                           # is not the code you want stored

# env_infra, for the same reason
if (-not $env:CP_SAMPLE_ARTIFACTS) { $env:CP_SAMPLE_ARTIFACTS = $Artifacts }

# Gates are hard by default and that is the point: a load four rows short looks
# right on screen and quietly under-reports. 0/false/no downgrades a failure to
# a logged ERROR and writes the rows ANYWAY - for inspecting a workbook you know
# is mid-revision, not for getting past a gate.
# $env:CP_EVENT360_STRICT    = "0"
# $env:CP_SDC_COMPUTE_STRICT = "0"
# $env:CP_EVENT_SUB_STRICT   = "0"

if (-not $Step) {
  Write-Host "Usage: .\load.ps1 <step> [-File <path>]" -ForegroundColor Yellow
  Write-Host "  Event 360 steps: event360 | sdc_compute | event_subscription | event360_all"
  exit 1
}
Write-Host ("  root      {0}" -f $Root) -ForegroundColor DarkGray
if ($Step -like "event360*" -or $Step -eq "sdc_compute" -or $Step -eq "event_subscription") {
  Write-Host ("  event360  {0}" -f $env:CP_EVENT360_XLSX)    -ForegroundColor DarkGray
  Write-Host ("  sdc       {0}" -f $env:CP_SDC_COMPUTE_XLSX) -ForegroundColor DarkGray
  Write-Host ("  subs      {0}" -f $env:CP_EVENT_SUB_DIR)    -ForegroundColor DarkGray
}

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
    # -File here is a FOLDER holding consumers.csv and subscriptions.csv, not
    # a file. Say so rather than letting the connector fail further downstream
    # with a message about a missing CSV.
    if ($File) {
      if (-not (Test-Path $File -PathType Container)) {
        Write-Error "event_subscription takes a FOLDER (consumers.csv + subscriptions.csv), not a file: $File"
        exit 1
      }
      $env:CP_EVENT_SUB_DIR = $File
    }
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
