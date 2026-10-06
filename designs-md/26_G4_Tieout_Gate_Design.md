---
cp360_type: design_document
component_id: 26
component_name: G4 Tie-out / Control Totals
zone: 2. Hub
plane: Data Quality
priority: P1
technology: Airflow + SQL
custom_build: High
depends_on: [14, 16, 28]
status: Not Started
owner: TBD
architecture_decisions: [AD-9, AD-1, AD-2, AD-8]
pipeline_tiers: [Stage3-Exadata-Gold, Consumer-Movement]
last_updated: 2026-08-10
tags: [SEI-BBH, Integration-Hub, hub, data-quality, tie-out]
origin: SEI-BBH component tracker
sei_coverage: covered
gap_owner: BBH
in_scope: true
generated: true
sei_status: differs
architecture_domain: Processing
canonical_tier: not on the stage chain
control_entities: [DATE_CONTROL, DQ_VALIDATION_FAILURE, RECON_RESULT]
traceability_identifiers: [LOAD_ID, BUSINESS_DATE, SRC_RECORD_ID]
supplement: CP360-GAP-DESIGN-SUPPLEMENT
---

# G4 Tie-out / Control Totals

## What this component is

SEI reconciles, but not as a gate. The counts are computed and published AFTER the fact build and the verdict is derived in Splunk, so a mismatch alerts rather than blocks.

It sits in **Processing**, in the **Data quality and reconciliation** lane (dbt · Splunk).

## What SEI specifies

**SEI covers the need and answers it differently.** SEI reconciles, but not as a gate. The counts are computed and published AFTER the fact build and the verdict is derived in Splunk, so a mismatch alerts rather than blocks.

### S19 — Reconciliation

Counts at four boundaries for the business date, written to an immutable log and published. The pass or warning verdict is derived on the Splunk side, after the data is already in Gold.

- **Technology.** dbt
- **Source.** dbt §7.2 (p.18) · §7.2.1 (p.18)

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

## How this works, from the architecture supplement

### Layer contract

| Layer | Contract |
|---|---|
| Stage 1 RAW | Oracle persistence, source-faithful records, atomic file-level load, BUSINESS_DATE plus FILE_ID plus LOAD_ID and source lineage, no business transformation |
| STG | Non-persisted views, column standardization, source DQ verdict and reason codes; no failed record progresses to INT |
| Stage 2 INT | Persisted Oracle models, natural business key plus BUSINESS_DATE, PASS records only, cleansing, deduplication, conformance, mapping and enrichment, seven-day retention through controlled partition maintenance |
| Stage 3 Pre-Gold | Standalone Oracle Exadata tier, consumer-oriented transformations, dimensions, facts, aggregates and control-total preparation, DQ and reconciliation gates before publish |

### Stage 2 to Stage 3 movement

- Database-link or approved direct-path movement, preserving LOAD_ID, BUSINESS_DATE, source keys and reconciliation attributes
- Full reload may use the approved bulk movement mechanism; CDC or GoldenGate only for an approved intraday requirement
- Reconciliation PASS authorises the publish scope; FAIL holds the publish and preserves the replay scope
- Replay is scoped by approved business date and load lineage, and must not create duplicate active dimension rows or duplicate fact rows

### DQ categories

| Category | Detected at | Disposition |
|---|---|---|
| Source DQ | STG | Store the failure, exclude from INT, source correction or reload required |
| Transformation DQ | INT, DIM, FACT or Pre-Gold | Store the failure, exclude from the next layer, replay when resolvable |
| File DQ | Ingestion validation | Quarantine before the RAW commit |
| Contract DQ | File or API schema boundary | Reject or quarantine according to the interface contract |

### Corrections

- The original delivery and the corrected delivery are preserved as separate auditable states
- The corrected record links through business key, business date, load lineage and correction metadata
- Correction handling must not overwrite the evidence required to explain the original published state

## Open against this component

**4 unresolved conflicts and 8 other open items** — `GAP-01`, `GAP-02`, `GAP-12`, `R1`, `R2`, `R4`, `R5`, `R7`, `R9`, `R10`, `R12`, `R18`. Stated in full, with both readings and the decision each needs, in the gap supplement.

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand. Correct the
model and every document that used it is corrected with it:
`node tools/export_design_model.mjs && python3 tools/gen_design_docs.py`
