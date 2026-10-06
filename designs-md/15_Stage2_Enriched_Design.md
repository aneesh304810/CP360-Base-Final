---
cp360_type: design_document
component_id: 15
component_name: Stage 2 Enriched (dbt)
zone: 2. Hub
plane: Processing
priority: P1
technology: dbt
custom_build: Medium
depends_on: [14, 17, 25]
status: Not Started
owner: TBD
architecture_decisions: [AD-2, AD-9, AD-1]
pipeline_tiers: [Stage2-Oracle]
last_updated: 2026-08-10
tags: [SEI-BBH, Integration-Hub, hub, processing, dbt]
origin: SEI-BBH component tracker
sei_coverage: partial
gap_owner: Joint
in_scope: true
generated: true
sei_status: specified
architecture_domain: Processing
canonical_tier: Stage 2 - Enriched (INT)
control_entities: [DATE_CONTROL, DQ_VALIDATION_FAILURE, RECON_RESULT]
traceability_identifiers: [LOAD_ID, BUSINESS_DATE, SRC_RECORD_ID]
supplement: CP360-GAP-DESIGN-SUPPLEMENT
---

# Stage 2 Enriched (dbt)

## What this component is

One tracker component, two SEI objects: STG is a view that stores nothing, INT is a table kept seven days.

It sits in **Processing**, in the **dbt models** lane (dbt · Oracle).

## What SEI specifies

### S14 — STG — view

Standardises the source columns and computes a pass or fail verdict per row. Stores nothing: it is recomputed on read.

- **Technology.** dbt view
- **Source.** dbt §4.1 (p.10) · §6.3 (p.15)

### S15 — INT — 7 days

Reads only the rows that passed, maps the code sets, keyed on the natural business key plus business date, partitioned, purged by partition drop after seven days.

- **Technology.** dbt incremental
- **Source.** dbt §4.1 (p.10) · §6.5 (p.15)

### T5 — INT tables

Silver persistence. Passing rows only, seven days, partitioned by business date.

- **Columns.** natural key + BUSINESS_DATE (unique) · mapped code sets
- **Source.** dbt §4.1 (p.10) · Appendix A.3 (p.26)

## The Oracle objects it touches

No foreign key is declared in either document. Every join below
is one a model runs, not a constraint the database enforces.

| Object | What it holds | Source |
|---|---|---|
| `RAW tables` | Bronze. Validated detail rows as delivered, tagged with the business date and lineage. The dbt document names three: account, client and transaction. | ingest Glossary (p.25) · dbt §4.1 (p.10) |
| `DQ_VALIDATION_FAILURE` | One store for both failure categories, carrying whether the row can replay itself and whether it is still open. | dbt §7.1 (p.17) |
| `INT tables` | Silver persistence. Passing rows only, seven days, partitioned by business date. | dbt §4.1 (p.10) · Appendix A.3 (p.26) |

## What happens when it goes wrong

| # | Scenario | What the design does | Source |
|---|---|---|---|
| X24 | A key column is missing | The STG view marks the row FAIL with a reason code and INT never reads it. The row goes to the DQ store as OPEN. | dbt §6.3 (p.15) |
| X25 | A code is not in the mapping table | Same path — FAIL at STG with its own reason code, excluded before any mapping is attempted. | dbt §6.3 (p.15) |
| X28 | A code has no active mapping row | Caught at INT as a transformation failure, owned by the transformation team rather than the source. Marked not auto-replayable: it stays OPEN until a code fix is deployed. | dbt §7 (p.17) |
| X31 | A row is still OPEN at the retention edge | CLOSED and alerted at seven days, because the DQ store keeps lineage only and INT no longer holds the data to re-derive it. | dbt §7.1 (p.17) · §8.2 assumption A4 (p.20) |

## Where SEI's documents disagree about this

Each one is a decision to take before a model is written.

### C2 — Stage 2 as five tables, or as STG plus INT

- **The architecture says.** Five STG2_* tables, materialised as tables, full refresh daily or incremental.
- **The design documents say.** A STG view that stores nothing, plus an INT table kept seven days and partitioned.
- **Why it matters.** Not a naming difference. One stores Stage 2 and one does not, and the retention, the replay window and the reconciliation boundaries all follow from which it is.

## Still open with SEI

SEI's own ids, so they can be quoted straight back.

- **D4.** Confirm no downstream consumer needs STG persisted.
- **D5.** Confirm retention units, Oracle partitioning support, volumetrics and run-window targets.

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
