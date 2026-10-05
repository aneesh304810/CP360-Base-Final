---
cp360_type: design_document
component_id: 27
component_name: G5 Post-Publish Recon
zone: 2. Hub
plane: Data Quality
priority: P2
technology: Airflow + SQL
custom_build: Medium
depends_on: [16, 21]
status: Not Started
owner: TBD
architecture_decisions: [AD-1, AD-9]
pipeline_tiers: [Consumer-Movement]
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, data-quality]
origin: SEI-BBH component tracker
sei_coverage: covered
gap_owner: BBH
in_scope: true
generated: true
sei_status: specified
generated: true
sei_status: specified
generated: true
sei_status: specified
---

# G5 Post-Publish Recon

## What this component is

Counts at four boundaries for the business date, written to an immutable log and published. The pass or warning verdict is derived on the Splunk side, after the data is already in Gold.

It sits in **Processing**, in the **Data quality and reconciliation** lane (dbt · Splunk).

## What SEI specifies

### S19 — Reconciliation

Counts at four boundaries for the business date, written to an immutable log and published. The pass or warning verdict is derived on the Splunk side, after the data is already in Gold.

- **Technology.** dbt
- **Source.** dbt §7.2 (p.18) · §7.2.1 (p.18)

### T8 — RECON_RESULT

One immutable row per boundary per business date, replaced rather than updated. No status column — the verdict is derived in Splunk.

- **Columns.** RECON_ID (PK) · BUSINESS_DATE · BOUNDARY · LEFT_COUNT · RIGHT_COUNT · SOURCE_DQ_FILTERED_COUNT · HELD_COUNT · HELD_PCT · DIFFERENCE · DETECTED_TS
- **Source.** dbt §7.2.1 (p.18)

## The Oracle objects it touches

No foreign key is declared in either document. Every join below
is one a model runs, not a constraint the database enforces.

| Object | What it holds | Source |
|---|---|---|
| `RECON_RESULT` | One immutable row per boundary per business date, replaced rather than updated. No status column — the verdict is derived in Splunk. | dbt §7.2.1 (p.18) |
| `DQ_VALIDATION_FAILURE` | One store for both failure categories, carrying whether the row can replay itself and whether it is still open. | dbt §7.1 (p.17) |

## What happens when it goes wrong

| # | Scenario | What the design does | Source |
|---|---|---|---|
| X35 | Counts do not agree at a boundary | The difference is written to the immutable log and published. The pass or warning verdict is derived on the Splunk side, after the data is already in Gold — so it alerts rather than blocks. | dbt §7.2 (p.18) · §7.2.1 (p.18) |
| X36 | The held backlog is growing | Alerts on the ageing open rows, and the usual cause is a late dimension file. | dbt §7.2.1 (p.18) |
| X37 | DQ or reconciliation is rerun for a date | The DQ rows are upserted so their resolution status survives, the recon rows for that date are replaced, and both are republished. | dbt §8.1 (p.20) |

## Still open with SEI

SEI's own ids, so they can be quoted straight back.

- **D6.** Approve the Splunk event schema, masking and PII rules, dashboards and alert thresholds.

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand. Correct the
model and every document that used it is corrected with it:
`node tools/export_design_model.mjs && python3 tools/gen_design_docs.py`
