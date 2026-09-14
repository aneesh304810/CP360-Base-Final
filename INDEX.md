# CP 360° — Package Index

Everything in this package. If you were looking for something and thought it was
missing, it's listed here.

## Start here
- **CP360_FINAL_BUILD.md** — what's in this build, how to run it
- **README.md**, **README_FINAL.md** — project overview
- **LOCAL_SETUP_BBH.md**, **RUN_GUIDE.md** — setup and run steps
- **ARCHITECTURE.md**, **docs/ARCHITECTURE.md** — system architecture

## App code
- **ui/src/** — React UI: LandingPage (CP 360° home), AppShell (nav + logo),
  Interface360, Api360, Data360, Datapoint360, PiiExplorer, Guardrails,
  Interdependency, LineageCanvas, and supporting components
- **api/app/** — FastAPI: main + routers (interface360, api360, data360,
  data360_pipelines, guardrails, interdependency, pii, search)
- **ingestion/** — connectors + run.py (+ guardrails_synth.py)

## SQL (sql/)
- 01..24 schema scripts (24 = quality_guardrails)
- **backfill_domains.sql** — fill empty feed/loader domains so grouping works
- **interdependency_data_quality.sql** — 6 diagnostics for the interdependency graph

## Sample data (sample-artifacts/)
- DATA-FEEDS, FEED-CATALOG, INTERFACE-SYSTEM, LOADER-WORKBOOK, OVERLAY (PII),
  POSTMAN, GLOSSARY, RUNBOOKS, dbt-artifacts, airflow-sim

## Deploy (deploy/, jenkins/, local/)
- Jenkinsfile(s), load-all.ps1, set-env.ps1, config

## Docs & prompts (docs/)
- enterprise-business-flow, feed-loader, api360, postman-generation prompts
- LOCAL_SETUP, ARCHITECTURE

## Feature changelogs
- BUILD_NOTES_INTERDEP_GUARDRAILS.md, CHANGELOG_FINAL.md, FEATURES_COMPLETE.md,
  GAPS_FIXED.md, UI_FEEDBACK_FIXES.md, BF_FIX.md
