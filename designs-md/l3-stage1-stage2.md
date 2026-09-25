---
id: l3-stages
title: Stage 1 RAW & Stage 2 Enriched
level: L3
icon: 🧱
color: #0e8f7e
bg: #dff2ef
order: 3
sub: detailed design - landing to tested dbt models
match: stage ?1|stage ?2|raw|enrich|dbt|landing|staging|transform
---

# Stage 1 RAW & Stage 2 Enriched


The two layers where the pipeline either stays auditable or quietly stops being auditable. Stage 1 is the evidence record; Stage 2 is the only place business meaning is allowed to enter. Everything below is design intent for engineering review, not yet approved.

- Layer contract
- Stage 1 · RAW
- LOAD_ID & idempotency
- Stage 2 · Enriched
- Corrections
- Worked model
- Open items

## What each layer is, and what it must never become

Most medallion failures come from a layer taking on a job that belongs to its neighbour. These rules are the ones worth defending in review.

| Layer | Is | Is not | Test of the rule |
|---|---|---|---|
| **Stage 1 RAW** · 7 tables | A byte-faithful record of what SEI sent, stamped with when and in what file. Append only. | Typed, cleaned, deduplicated, or joined. No rejects removed, no defaults applied. | You can reconstruct the original file from the table. If you can't, RAW is doing too much. |
| **Stage 2 Enriched** · 5 models | Typed, standardised, corrected, business-rule-validated, reusable across all consumers. | Consumer-shaped. No PBDW-specific column names, no Pivotal-specific filters, no report logic. | A second consumer can be added without changing a Stage 2 model. |
| **Gold** · 5 objects | Kimball dims and facts. Surrogate keys, SCD2 history, conformed grain. | Where corrections get resolved. That must already have happened. | Gold logic is dimensional mechanics only — no source-system knowledge. |

### Lineage map — 7 → 5 → 5

Note the naming break: RAW_CLIENT → STG2_INTERESTED_PARTY. The rename happens once, in Stage 2, and the mapping belongs in the config store (33) — not in a model comment.

## Stage 1 — RAW (SWP)

Python-managed, immutable, append only. Seven tables, one per source file. Its single obligation is that a replay from RAW produces the same result as the original run — which drives every decision below.

### Table specification

| Table | Feed type | Natural key (in Stage 2) | Volume shape | Partition |
|---|---|---|---|---|
| RAW_ACCOUNT | Full snapshot | ACCOUNT_ID | Flat, full daily | BUSINESS_DATE |
| RAW_CLIENT | Full snapshot | CLIENT_ID | Flat, full daily | BUSINESS_DATE |
| RAW_TAXLOT | Full snapshot | ACCOUNT_ID + LOT_ID | Largest feed | BUSINESS_DATE |
| RAW_TRANSACTION | Delta | TRANSACTION_ID | Spiky, event-driven | BUSINESS_DATE |
| RAW_POSITION | Delta | ACCOUNT_ID + SECURITY_ID | Moderate | BUSINESS_DATE |
| RAW_CORRECTED_TRANSACTION | Correction | TRANSACTION_ID + effective date | Small, irregular | BUSINESS_DATE (file date) |
| RAW_CORRECTED_POSITION | Correction | ACCOUNT_ID + SECURITY_ID + eff. date | Small, irregular | BUSINESS_DATE (file date) |

Natural keys are listed for Stage 2's benefit. RAW itself carries no key constraint — see below.

### Audit columns — all seven tables

| Column | Type | Semantics and why it exists |
|---|---|---|
| LOAD_ID | NUMBER(18) | Unique per file-load attempt. The replay handle and the join key for lineage. See next section. |
| BUSINESS_DATE | DATE | The date the data is about. Partition key. For corrections this is the file date, not the corrected event's date. |
| FILE_DATE | DATE | Date asserted by SEI in the filename or manifest. Divergence from BUSINESS_DATE is itself a G1 check. |
| FILE_NAME | VARCHAR2(260) | Exact delivered filename. Evidence, and the tie back to the landing zone. |
| ROW_NUM | NUMBER(12) | Ordinal position in the file. Makes a RAW row addressable to a physical line — essential for an audit query. |
| LOAD_TIMESTAMP | TIMESTAMP | When BBH loaded it. The "knew-at" axis. Do not use for ordering business events. |
| SOURCE_SYSTEM | VARCHAR2(30) | Constant 'SEI_SWP' today. Present so the second source doesn't require a schema change. |
| INGESTION_STATUS | VARCHAR2(20) | LOADED / QUARANTINED / SUPERSEDED. Not a DQ verdict — that lives in the DQ results store (28). |

### DDL pattern

```
-- one pattern, seven tables. Generated from the config store (33), not hand-written.
CREATE TABLE RAW_TRANSACTION (
  LOAD_ID           NUMBER(18)     NOT NULL,
  BUSINESS_DATE     DATE           NOT NULL,
  FILE_DATE         DATE,
  FILE_NAME         VARCHAR2(260)  NOT NULL,
  ROW_NUM           NUMBER(12)     NOT NULL,
  LOAD_TIMESTAMP    TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
  SOURCE_SYSTEM     VARCHAR2(30)   DEFAULT 'SEI_SWP'   NOT NULL,
  INGESTION_STATUS  VARCHAR2(20)   DEFAULT 'LOADED'    NOT NULL,
  -- business payload: all VARCHAR2, cast downstream
  TRANSACTION_ID    VARCHAR2(64),
  ACCOUNT_ID        VARCHAR2(64),
  TRADE_DATE        VARCHAR2(32),
  SETTLE_DATE       VARCHAR2(32),
  TRANSACTION_TYPE  VARCHAR2(64),
  QUANTITY          VARCHAR2(48),
  AMOUNT            VARCHAR2(48)
)
PARTITION BY RANGE (BUSINESS_DATE)
  INTERVAL (NUMTODSINTERVAL(1,'DAY'))
  (PARTITION P_INIT VALUES LESS THAN (DATE '2026-01-01'));

-- no primary key, no unique constraint, no NOT NULL on business columns.
-- duplicates are data to be observed, not errors to be prevented.
CREATE INDEX IX_RAW_TXN_LOAD ON RAW_TRANSACTION (LOAD_ID) LOCAL;
```

### Load mechanism — choose per feed, not once

| Mechanism | Use for | Strength | Cost |
|---|---|---|---|
| External table | Tax Lot, Account, Client — the large snapshots | One pass; G1 checks run as SQL over the file; no row shipping | File must be on a DB-visible mount; brittle on malformed rows |
| SQL*Loader direct path | Large deltas where the file can't be DB-mounted | Fast bulk insert, bad-file capture built in | External process to orchestrate and parse the log |
| cx_Oracle executemany | Corrections, small feeds | Full control, easy quarantine routing | Slowest per row; fine at correction volumes |

Component 13 exposes these behind one loader interface, selected by config per domain. Hardcoding one mechanism is the single most likely way this framework becomes seven scripts.

### Retention and partitioning

- **Interval partitioning by BUSINESS_DATE**, daily. Gives partition-wise replay, cheap purge by DROP PARTITION, and partition pruning for G2 profiling.
- **Retention is set by replay depth, not by disk.** If the business needs to replay 90 days, RAW holds 90 days minimum. Decide the replay window first, then size storage — the reverse produces a system that cannot honour its own recovery promise.
- **Compress partitions older than the active window** — ROW STORE COMPRESS ADVANCED on the snapshot tables, where repeated daily snapshots compress heavily.

## LOAD_ID and redelivery

The one identifier the whole recovery story hangs on. Get it wrong and replay, lineage and G4 all become approximations.

### Definition

One LOAD_ID per **file-load attempt** — not per batch, not per business date. A batch of seven files produces seven LOAD_IDs bound by a BATCH_ID in the config store. This is what lets one domain be replayed without touching the other six, which is the whole point of the per-domain fan-out in component 18.

### What LOAD_ID enables downstream

| Consumer | Use |
|---|---|
| Replay engine (21) | Replay scope is a LOAD_ID set, not a date. Re-run one domain, or one corrected file, without disturbing the rest of the batch. |
| G4 tie-out (26) | Compare Gold output against the row counts captured at ingest per LOAD_ID — a lookup, not a table rescan. This is what makes G4 affordable inside the window. |
| Audit & lineage (31) | Row-level lineage is the LOAD_ID + ROW_NUM pair carried forward into Stage 2. A Gold value traces to a physical line in a named file. |
| Quarantine (29) | Quarantined rows keep the LOAD_ID of the attempt that rejected them, so resubmission is traceable to the original. |

## Stage 2 — Enriched (dbt)

Five models, eight processing steps, one fixed order. The order is not stylistic: applying business rules before corrections validates data you're about to replace, and deduplicating after joins multiplies the work.

### The eight steps as a fixed CTE order

### Model specification

| Model | Sources | Grain | Materialization | Rationale |
|---|---|---|---|---|
| STG2_ACCOUNT | RAW_ACCOUNT | ACCOUNT_ID per business date | **Incremental**, insert by business date | Full snapshot in, current-state out. Gold builds SCD2 — Stage 2 must not. Keep the day's snapshot so SCD2 can be rebuilt without re-reading RAW. |
| STG2_INTERESTED_PARTY | RAW_CLIENT | CLIENT_ID per business date | **Incremental**, insert by business date | Same shape as account. Note the rename — mapping lives in config (33). |
| STG2_TAX_LOT | RAW_TAXLOT | ACCOUNT_ID + LOT_ID per business date | **Incremental**, insert by business date | Largest feed. Full refresh on a full snapshot is the worst combination available and should not ship. |
| STG2_TRANSACTIONS | RAW_TRANSACTION + RAW_CORRECTED_TRANSACTION | TRANSACTION_ID, versioned | **Incremental**, merge on key + version | Corrections reach back into prior dates. Needs a lookback window, not a single-date filter. |
| STG2_CP_HOLDINGS | RAW_POSITION + RAW_CORRECTED_POSITION | ACCOUNT_ID + SECURITY_ID + date, versioned | **Incremental**, merge on key + version | Same pattern as transactions. |

### Standard column set added by Stage 2

| Column | Purpose |
|---|---|
| SRC_LOAD_ID, SRC_ROW_NUM | Carried from RAW. Row-level lineage back to a physical line in a named file. |
| RECORD_VERSION | 1 for the original, incrementing per correction applied to the same natural key. |
| IS_CURRENT | Y for the version in force now. Gold consumes only current rows; audit reads all of them. |
| EFFECTIVE_FROM_TS / EFFECTIVE_TO_TS | The knew-at axis. With BUSINESS_DATE as the happened-at axis, this is what makes as-of restatement possible. |
| DQ_FLAGS | Business rule outcomes as a structured column. G3 tests assert against it; nothing is silently dropped. |
| DBT_UPDATED_AT | Model run timestamp. Operational, not business. |

## Correction integration — the hard part

SEI v5 says corrections are "Merge (Update Existing)". That works until someone asks what the position was on Tuesday morning. This section sets out both options honestly and states a recommendation.

### The two axes

| Option | Mechanism | Gains | Costs |
|---|---|---|---|
| **A · In-place merge** · SEI v5 position | Correction updates the Stage 2 row; Gold merges through. | Smallest tables. Simplest queries. Least build. | Prior state destroyed. No as-of restatement. Replay cannot restore what it overwrote. Lineage records that a value changed, not what it was. |
| **B · Versioned append** · recommended | Correction inserts a new version; prior row closed with EFFECTIVE_TO_TS and IS_CURRENT = N. | As-of restatement works. Replay is meaningful. Audit answerable. Corrections become observable — you can report on their volume and lag. | Larger tables. Every consumer query needs IS_CURRENT = 'Y' — mitigated by exposing a view. One custom dbt macro to write and maintain. |

### Correction resolution logic

```
-- macro: resolve_corrections(base_rel, corr_rel, natural_key, business_date_col)
-- used identically by STG2_TRANSACTIONS and STG2_CP_HOLDINGS

WITH unioned AS (
  SELECT t.*, 0 AS correction_seq, 'ORIGINAL' AS record_source FROM base t
  UNION ALL
  SELECT c.*, 1 AS correction_seq, 'CORRECTION'                  FROM corr c
),
versioned AS (
  SELECT u.*,
         ROW_NUMBER() OVER (
           PARTITION BY transaction_id, business_date
           ORDER BY correction_seq, load_timestamp, src_load_id
         ) AS record_version,
         LEAD(load_timestamp) OVER (
           PARTITION BY transaction_id, business_date
           ORDER BY correction_seq, load_timestamp, src_load_id
         ) AS effective_to_ts
  FROM unioned u
)
SELECT v.*,
       v.load_timestamp AS effective_from_ts,
       CASE WHEN v.effective_to_ts IS NULL THEN 'Y' ELSE 'N' END AS is_current
FROM versioned v
```

### Three cases this must handle

- **Correction arrives before its original.** Out-of-order delivery. The macro produces a correction with no base — the row must park with DQ_FLAGS = 'ORPHAN_CORRECTION' and be retried on a lookback window, not silently dropped. G3 asserts the orphan count is zero after the window.
- **Two corrections to the same record on the same day.** Ordering by correction_seq alone is insufficient — the tiebreak must be LOAD_TIMESTAMP then SRC_LOAD_ID, and it must be deterministic, or two replays produce two different answers.
- **Correction to a record outside the incremental window.** A correction landing today for a transaction from six weeks ago falls outside a seven-day lookback. Either the window is configurable per feed from the config store (33), or corrections beyond it route to a manual queue. Silence is the wrong answer.

## Worked model — STG2_TRANSACTIONS

The hardest of the five, because it carries corrections. The other four are simplifications of this shape.

```
-- models/stage2/stg2_transactions.sql
{{ config(
    materialized = 'incremental',
    unique_key   = ['transaction_id', 'business_date', 'record_version'],
    incremental_strategy = 'merge',
    partition_by = 'business_date',
    on_schema_change = 'fail'
) }}

{% set lookback = var('correction_lookback_days', 7) %}   -- sourced from config store 33

WITH src_txn AS (
    SELECT * FROM {{ source('raw_swp', 'RAW_TRANSACTION') }}
    WHERE ingestion_status IN ('LOADED')          -- SUPERSEDED loads excluded
    {% if is_incremental() %}
      AND business_date >= (SELECT MAX(business_date) - {{ lookback }} FROM {{ this }})
    {% endif %}
),
src_corr AS (
    SELECT * FROM {{ source('raw_swp', 'RAW_CORRECTED_TRANSACTION') }}
    WHERE ingestion_status IN ('LOADED')
    {% if is_incremental() %}
      AND business_date >= (SELECT MAX(business_date) - {{ lookback }} FROM {{ this }})
    {% endif %}
),

-- step 2 + 3: standardise then typecast. safe cast: bad values become NULL and are flagged,
-- never raised — a single malformed amount must not fail the whole model.
typed AS (
    SELECT
        {{ std_code('transaction_id') }}      AS transaction_id,
        {{ std_code('account_id') }}          AS account_id,
        {{ safe_date('trade_date') }}         AS trade_date,
        {{ safe_date('settle_date') }}        AS settle_date,
        {{ std_code('transaction_type') }}    AS transaction_type,
        {{ safe_number('quantity') }}         AS quantity,
        {{ safe_number('amount') }}           AS amount,
        business_date, load_id AS src_load_id, row_num AS src_row_num, load_timestamp
    FROM src_txn
),

-- step 4: deduplicate within a load, BEFORE any join
deduped AS (
    SELECT * FROM (
        SELECT t.*, ROW_NUMBER() OVER (
                 PARTITION BY transaction_id, business_date, src_load_id
                 ORDER BY src_row_num DESC) AS rn
        FROM typed t
    ) WHERE rn = 1
),

-- step 5: corrections. shared macro — identical logic in STG2_CP_HOLDINGS.
corrected AS (
    {{ resolve_corrections('deduped', 'corr_typed',
                           natural_key=['transaction_id','business_date']) }}
),

-- step 6: reference joins, after dedup and corrections
enriched AS (
    SELECT c.*, a.account_type, a.base_currency, s.asset_class
    FROM corrected c
    LEFT JOIN {{ ref('ref_account') }}  a ON c.account_id = a.account_id
    LEFT JOIN {{ ref('ref_security') }} s ON c.security_id = s.security_id
),

-- step 7 + 8: business rules as flags, then derived attributes.
-- rules FLAG, they do not FILTER. G3 asserts on the flags; dropping rows here
-- would make the G4 tie-out fail for a reason nobody can see.
flagged AS (
    SELECT e.*,
      CASE WHEN account_type IS NULL         THEN 'UNKNOWN_ACCOUNT;' END ||
      CASE WHEN settle_date < trade_date    THEN 'SETTLE_BEFORE_TRADE;' END ||
      CASE WHEN amount IS NULL               THEN 'AMOUNT_UNPARSEABLE;' END AS dq_flags,
      amount * NVL(fx.rate, 1)               AS amount_base_ccy
    FROM enriched e
    LEFT JOIN {{ ref('ref_fx_rate') }} fx
      ON e.currency = fx.currency AND e.business_date = fx.rate_date
)

SELECT * FROM flagged
```

### Accompanying schema.yml — G3 assertions

```
models:
  - name: stg2_transactions
    tests:
      - dbt_utils.unique_combination_of_columns:
          combination_of_columns: [transaction_id, business_date, record_version]
      - dbt_utils.expression_is_true:
          expression: "NOT (is_current = 'Y' AND effective_to_ts IS NOT NULL)"
    columns:
      - name: transaction_id
        tests: [not_null]
      - name: account_id
        tests:
          - not_null
          - relationships: { to: ref('stg2_account'), field: account_id }
      - name: amount
        tests:
          - not_null:
              config: { severity: "{{ var('sev_amount_null','error') }}" }   # from config 33
      - name: dq_flags
        tests:
          - accepted_values:
              values: ['ORPHAN_CORRECTION']
              config: { severity: warn }
```

Severity is parameterised, not literal. A threshold hardcoded in a dbt test cannot be read by Airflow, so the gate cannot branch on it — see plane 4.

## Open items on these two layers

Ordered by how much rework each one causes if it is answered late.

| # | Question | Owner | Consequence of deciding late |
|---|---|---|---|
| 1 | AD-2 Corrections: merge or versioned append | ARB | Rewrites both correction-carrying models, the Gold merge, replay, and the lineage claim. Decide first. |
| 2 | Replay depth — how many days must be replayable | Business + BBH ops | Sets RAW retention and partition compression. Cheap now, a storage migration later. |
| 3 | Correction lookback window per feed | SEI + BBH | Too short and corrections silently miss; too long and every incremental run scans weeks. |
| 4 | Does SEI emit a change indicator or row hash on snapshots | SEI | The single largest performance lever available. Without it, Tax Lot is processed in full every night. |
| 5 | Natural keys confirmed per domain | SEI | Dedup, corrections and SCD2 all key off these. Assumed above; must be confirmed, not inferred. |
| 6 | Late-arriving dimension policy — reject or inferred member | ARB | Changes the join behaviour in all fact-feeding models. |
| 7 | PII classification of Client and Account attributes | BBH security | Masking changes the RAW model. Retrofitting masking into an immutable layer is unpleasant. |
| 8 | Reference data ownership — security master, FX, hierarchy | BBH | Stage 2 lookups assume these exist and are current. None appear in either source deck. |
