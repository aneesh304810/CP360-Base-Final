---
cp360_type: design_document
component_id: 28
component_name: DQ Framework
zone: 2. Hub
plane: Data Quality
priority: P1
technology: Python
custom_build: High
depends_on: [33, 31]
status: Not Started
owner: TBD
architecture_decisions: [AD-9, AD-2, AD-5, AD-6]
pipeline_tiers: [Stage1-Oracle, Stage2-Oracle, Stage3-Exadata-Gold, Consumer-Movement]
last_updated: 2026-08-10
tags: [SEI-BBH, Integration-Hub, hub, data-quality, framework]
origin: SEI-BBH component tracker
sei_coverage: covered
gap_owner: BBH
in_scope: true
generated: true
sei_status: specified
architecture_domain: Processing
canonical_tier: not on the stage chain
control_entities: [DATE_CONTROL, DQ_VALIDATION_FAILURE, RECON_RESULT]
traceability_identifiers: [LOAD_ID, BUSINESS_DATE, SRC_RECORD_ID]
supplement: CP360-GAP-DESIGN-SUPPLEMENT
---

# DQ Framework

## What this component is

Every failing record is written to one store and held at the layer that caught it. A step after the fact build picks up the rows that can now resolve, loads them and marks them resolved.

It sits in **Processing**, in the **Data quality and reconciliation** lane (dbt · Splunk).

## What SEI specifies

### S18 — DQ capture and replay

Every failing record is written to one store and held at the layer that caught it. A step after the fact build picks up the rows that can now resolve, loads them and marks them resolved.

- **Technology.** dbt
- **Source.** dbt §7.1 (p.17) · Appendix A.1 (p.25)

### T7 — DQ_VALIDATION_FAILURE

One store for both failure categories, carrying whether the row can replay itself and whether it is still open.

- **Columns.** DQ_FAILURE_ID (PK) · DQ_CATEGORY (SOURCE_DQ | TRANSFORMATION_DQ) · BUSINESS_DATE · LAYER_NAME (STG | INT | DIM | FACT) · MODEL_NAME · BUSINESS_KEY · SRC_RECORD_ID · COLUMN_NAME · FAILURE_REASON · REPROCESS_ELIGIBLE · RESOLUTION_STATUS · RETRY_COUNT · RESOLVED_TS · DETECTED_TS
- **Source.** dbt §7.1 (p.17)

## The Oracle objects it touches

No foreign key is declared in either document. Every join below
is one a model runs, not a constraint the database enforces.

| Object | What it holds | Source |
|---|---|---|
| `INT tables` | Silver persistence. Passing rows only, seven days, partitioned by business date. | dbt §4.1 (p.10) · Appendix A.3 (p.26) |
| `DQ_VALIDATION_FAILURE` | One store for both failure categories, carrying whether the row can replay itself and whether it is still open. | dbt §7.1 (p.17) |

## What happens when it goes wrong

| # | Scenario | What the design does | Source |
|---|---|---|---|
| X24 | A key column is missing | The STG view marks the row FAIL with a reason code and INT never reads it. The row goes to the DQ store as OPEN. | dbt §6.3 (p.15) |
| X26 | A full-snapshot entity fails | The row stays OPEN until a corrected record arrives in a later full file, which replays it and marks it RESOLVED. This rests on account and client being full daily snapshots. | dbt §7.1 (p.17) · §8.2 assumption A1 (p.20) |
| X27 | A transaction fails | That date's records do not come round again, so it replays only on a corrected reload for the date, or when the missing dimension arrives. | dbt §7.1 (p.17) |
| X28 | A code has no active mapping row | Caught at INT as a transformation failure, owned by the transformation team rather than the source. Marked not auto-replayable: it stays OPEN until a code fix is deployed. | dbt §7 (p.17) |
| X29 | The same failure returns after a rerun | Expected, and the signal is that a code fix is needed rather than another rerun. | dbt §7 (p.17) |
| X30 | A transaction's dimension has not arrived | Never written to Gold with a placeholder key. Held in the DQ store as replayable and OPEN, re-derived from INT on a later day once the dimension exists, then marked RESOLVED. | dbt §7.1 (p.17) · Figure 5a (p.18) |
| X31 | A row is still OPEN at the retention edge | CLOSED and alerted at seven days, because the DQ store keeps lineage only and INT no longer holds the data to re-derive it. | dbt §7.1 (p.17) · §8.2 assumption A4 (p.20) |
| X36 | The held backlog is growing | Alerts on the ageing open rows, and the usual cause is a late dimension file. | dbt §7.2.1 (p.18) |
| X37 | DQ or reconciliation is rerun for a date | The DQ rows are upserted so their resolution status survives, the recon rows for that date are replaced, and both are republished. | dbt §8.1 (p.20) |

## Where SEI's documents disagree about this

Each one is a decision to take before a model is written.

### C5 — Where data quality runs

- **The architecture says.** A Data Quality Checks step after dbt Gold in the Airflow chain.
- **The design documents say.** A per-row pass or fail computed in the STG view, before anything is loaded, plus tests between every layer.
- **Why it matters.** Before or after publication is the whole question. The architecture's position puts the check after Gold is written, which is where reconciliation already sits and is already a known gap.

## Still open with SEI

SEI's own ids, so they can be quoted straight back.

- **D2.** Confirm all missing dimensions resolve inside the seven-day window, and approve the single-table DQ design, the replay policy and the retention-boundary alert.

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
