# Variance 360 — FINAL build · deployment order

## 1. SQL (SILVER @ dvlpbdb1)
    sqlplus SILVER/...@pbdwhdbt @sql/31_variance360.sql     -- if not already run
    sqlplus SILVER/...@pbdwhdbt @sql/32_variance360_v2.sql  -- v2: stats + CLOB tables

## 2. Environment
    . .\load-variance-env.ps1        # includes CP_VAR_PARALLEL, CP_VAR_STATUS_OK

## 3. Backend
    copy ingestion/variance_engine.py   -> <repo>/ingestion/
    copy ingestion/clob_inspector.py    -> <repo>/ingestion/        (NEW)
    copy api-app/routers_variance360.py -> <repo>/api/app/
    # main.py mount loop must include "routers_variance360" (already done)
    restart uvicorn

## 4. UI
    copy ui-src/Variance360.jsx -> <repo>/ui/src/    (5-tab final)
    copy ui-src/api.js          -> <repo>/ui/src/    (adds varCoverage/varClob*)
    copy ui-src/mockData.js     -> <repo>/ui/src/    (adds matching mocks)
    npm run build

## 5. Run
    python -m ingestion.variance_ingest full --data-source PBDW
    python -m ingestion.clob_inspector --data-source PBDW --table STG1_FIS_ACCOUNT_FEE_BLOCKS

## New in this build
- Composition: mean/stddev/median/min/max per numeric-ish column (same scan)
- MIXED verdict -> REVIEW_MIXED (no more false CLEAN)
- fail_types: failing-minority census (what the fails DO conform to)
- CLOB Inspector: discovery, blob metadata, parse spec from
  stg1_to_stg2_transform, per-field census inside the CLOB, unmapped-region
  detection -> recon_clob_profile / recon_clob_fields
- Endpoints: /variance/coverage, /variance/clob/columns, /variance/clob/profile
- UI: five tabs (Tables / Composition / CLOB Inspector / Coverage / Runs)

## Completed in FINAL-COMPLETE build (matches spec mockup 1:1)
- outlier_cnt (>3 sigma), approx NDV, value_census: populated by the
  engine's per-table deviation second pass
- GRAIN detection: CLOB-explode chains (1 STG1 col -> 3+ STG2 cols) whose
  only break is CNT at STG1->STG2 are classified GRAIN, rendered as a grey
  GRAIN-delta chip instead of RED
- CLOB record-layout diagram + highlighted raw sample record in the UI
  (endpoint /variance/clob/record; PII-suppressed when parsed fields map
  to IS_PII='Y' dictionary entries)
- Coverage tab merges Exists + mapped into one Verified row

## Remaining known limit
- CLOB parser handles SUBSTR specs; PL/SQL-function fields are counted in
  spec_fields but profiled at STG2 only
