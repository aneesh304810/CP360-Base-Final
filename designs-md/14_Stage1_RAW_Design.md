---
cp360_type: design_document
component_id: 14
component_name: Stage 1 RAW
zone: 2. Hub
plane: Processing
priority: P1
technology: Oracle DDL
custom_build: None
depends_on: [13]
status: Not Started
owner: TBD
architecture_decisions: [AD-8, AD-7, AD-10]
pipeline_tiers: [Stage1-Oracle]
last_updated: 2026-08-10
tags: [SEI-BBH, Integration-Hub, hub, processing, raw]
origin: SEI-BBH component tracker
sei_coverage: covered
gap_owner: BBH
in_scope: true
generated: true
sei_status: specified
architecture_domain: Processing
canonical_tier: Stage 1 - RAW
control_entities: [DATE_CONTROL, DQ_VALIDATION_FAILURE, RECON_RESULT]
traceability_identifiers: [LOAD_ID, BUSINESS_DATE, SRC_RECORD_ID]
supplement: CP360-GAP-DESIGN-SUPPLEMENT
---

# Stage 1 RAW

## What this component is

Bronze. Validated detail rows as delivered, tagged with the business date and lineage. The dbt document names three: account, client and transaction.

It sits in **Processing**, in the **dbt models** lane (dbt · Oracle).

## What SEI specifies

### T4 — RAW tables

Bronze. Validated detail rows as delivered, tagged with the business date and lineage. The dbt document names three: account, client and transaction.

- **Columns.** per-interface DDL · BUSINESS_DATE · SRC_RECORD_ID and lineage
- **Source.** ingest Glossary (p.25) · dbt §4.1 (p.10)

## The Oracle objects it touches

No foreign key is declared in either document. Every join below
is one a model runs, not a constraint the database enforces.

| Object | What it holds | Source |
|---|---|---|
| `RAW tables` | Bronze. Validated detail rows as delivered, tagged with the business date and lineage. The dbt document names three: account, client and transaction. | ingest Glossary (p.25) · dbt §4.1 (p.10) |

## Where SEI's documents disagree about this

Each one is a decision to take before a model is written.

### C1 — Three RAW tables, or seven

- **The architecture says.** RAW_ACCOUNT, RAW_CLIENT, RAW_TAXLOT, RAW_TRANSACTION, RAW_POSITION, RAW_CORRECTED_TRANSACTION, RAW_CORRECTED_POSITION.
- **The design documents say.** The dbt design document names three: account, client and transaction. Position, tax lot and the two correction tables do not appear in it at all.
- **Why it matters.** Four of the seven feeds have no transformation designed for them. If the architecture is right, the design document covers under half the inbound surface.

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
