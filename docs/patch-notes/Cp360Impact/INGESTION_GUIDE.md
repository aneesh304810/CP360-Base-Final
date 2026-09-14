# Ingestion & Connectivity Guide — Impact Analysis + Auto Mapper

## 1. How drift detection connects to the database

There is deliberately NO new Oracle connection and NO new grants.

- The existing `oracle` ingestion step (OracleConnector) remains the only
  component that reads source dictionaries; it already harvests into the
  `columns` table using ORACLE_PROD_DSN / ORACLE_PROD_SCHEMAS.
- The new `impact_scan` step (runs right after `oracle` completes) copies the
  current `columns` state for the watched schemas into `schema_snapshot_cols`
  under a new snapshot_id, then diffs it against the PREVIOUS snapshot.
- Consequence: drift granularity == ingestion cadence. The first ever run
  writes a baseline only; findings start on run 2.
- The catalog DB connection itself is unchanged: CP_CATALOG_DB_DSN
  (oracle://user:pwd@host:port/service), python-oracledb thin mode.

Environment for the scan:

| Var | Meaning | Default |
|---|---|---|
| IMPACT_SCAN_SCHEMAS | CSV of schemas to watch, e.g. `IMD,PBDW` | ORACLE_PROD_SCHEMAS |
| IMPACT_FEED_DIR | Optional dir of representative feed files for header-spec drift | unset (skips) |

If you later want intra-day drift (between ingestions), schedule
`python -m ingestion.run --steps oracle,impact_scan` on its own cron —
no code change needed.

## 2. Feed-file spec drift — data format

Point IMPACT_FEED_DIR at a directory containing ONE representative file per
feed (e.g. yesterday's Bloomberg prices file). Only line 1 (the header) is
read. Delimiter auto-detected: `|` if present, else `,`. The observed header
is stored in `feed_file_specs`; any add/remove vs the stored spec raises a
FILE_SPEC finding (HIGH — positional loaders misalign), then the spec is
updated to the new header.

## 3. Severity model

score = kind (DROPPED/RETYPED/FILE_SPEC=3, WIDENED/NARROWED=2, NEW=1)
      + min(downstream feeds, 4)            ← consumers, from the blast walk
      + 2 if the column is PII (columns.is_pii)
HIGH ≥ 5, MED ≥ 3, else LOW. Every finding gets evidence_tag NYDFS-EV-nnnn;
ack/resolve status is `protect`ed in the MERGE, so re-scans never reopen a
resolved finding unless the change itself recurs (new finding hash).

## 4. Blast radius — where the chain comes from

column → mappings   column_lineage (transitive, depth ≤ 4)
       → tables     target side of those edges
       → feeds      feed_catalog.schema_ref LIKE %table%
       → systems    feed_catalog.target_system
       → owners     interface360_interfaces.update_owner for those systems
Every hop degrades to empty on missing data — the walk never fails a scan.
Richer results come free as you load more lineage (dbt step) and the
interface workbook.

## 5. Auto Mapper — ingest data format

CSV (header row required, column order free; extra `sample2`, `sample3`
columns allowed):

    field_name,type,description,sample
    account_number,STRING(17),Depository account number,0004471230
    current_balance,"DECIMAL(18,2)",Current balance,1450320.55

JSON alternative:

    [{"name":"account_number","type":"STRING(17)",
      "description":"Depository account number","samples":["0004471230"]}]

Accepted generic types: STRING(n), DECIMAL(p,s), INTEGER, NUMBER, DATE,
TIMESTAMP, BOOLEAN. Candidates come from the harvested `columns` table for
the chosen target schema — so the mapper "connects" to source systems only
through the catalog, never directly.

### Plaid example (included)

sample-artifacts/PLAID/plaid_core_exchange_fields.csv holds 18 Plaid
Core Exchange / FDX fields (accounts + transactions). Expected demo outcome
against a harvested PBDW: account_number, transaction_amount ≥90% auto-accept;
official_name, iso_currency_code, transaction_date land in 60–90% review;
routing_number and mask stay unmatched (PBDW keys differently) — which is the
correct, honest answer and a good talking point.

### Scoring & governance

confidence = 0.35·name + 0.20·type + 0.25·embed + 0.20·value
- name: token similarity with financial abbreviation expansion (acct→account,
  cd→code, dt→date, ccy→currency, …)
- type: family compatibility + length-fit (penalizes would-truncate)
- embed: sentence-transformers e5 IF `MAPPER_EMBEDDINGS=on` AND the package
  exists in Nexus; otherwise a silent lexical fallback. Set
  MAPPER_EMBED_MODEL to a local path for air-gapped use.
- value: sample shape (numeric/date/length) vs target type
Scores only rank. A human accepts every mapping; /mapper/commit writes the
audit trail (mapper_runs, mapper_results) and inserts accepted pairs into
column_lineage as source='auto_mapper' — visibly pending review, filterable,
and reversible by deleting edges with that source.

## 6. Scheduling

The existing ingestion CronJob (deploy/openshift/04-ingestion-cronjob.yaml)
needs no change — `impact_scan` is now part of the default STEPS. The UI
"Run scan now" button calls POST /impact/scan, which reuses the same scanner
in-process when the ingestion package is on the API container's PYTHONPATH
(true for the local/dev image), and otherwise returns a hint to use the CLI.
