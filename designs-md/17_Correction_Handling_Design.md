---
cp360_type: design_document
component_id: 17
component_name: Correction Handling
zone: 2. Hub
plane: Processing
priority: P1
technology: dbt
custom_build: High
depends_on: [15, 16, 21]
status: Not Started
owner: TBD
architecture_decisions: [AD-2, AD-8, AD-9]
pipeline_tiers: [Stage2-Oracle, Stage3-Exadata-Gold]
last_updated: 2026-08-10
tags: [SEI-BBH, Integration-Hub, hub, processing, bitemporal]
origin: SEI-BBH component tracker
sei_coverage: partial
gap_owner: SEI
in_scope: true
generated: true
sei_status: specified
architecture_domain: Processing
canonical_tier: Stage 2 - Enriched (INT)
control_entities: [DATE_CONTROL, DQ_VALIDATION_FAILURE, RECON_RESULT]
traceability_identifiers: [LOAD_ID, BUSINESS_DATE, SRC_RECORD_ID]
supplement: CP360-GAP-DESIGN-SUPPLEMENT
---

# Correction Handling

## What this component is

SEI gives it the rule it was missing: a closed interval is corrected by direct UPDATE, never by MERGE.

It sits in **Processing**, in the **dbt models** lane (dbt · Oracle).

## What SEI specifies

### S16 — DIM — built first

History by direct-compare MERGE into tables that already exist. The surrogate key comes from the Oracle sequence already in use. No DDL is issued against Gold.

- **Technology.** dbt MERGE
- **Source.** dbt §4.1 (p.10) · §6.4 (p.15)

## The Oracle objects it touches

No foreign key is declared in either document. Every join below
is one a model runs, not a constraint the database enforces.

| Object | What it holds | Source |
|---|---|---|
| `INT tables` | Silver persistence. Passing rows only, seven days, partitioned by business date. | dbt §4.1 (p.10) · Appendix A.3 (p.26) |
| `Gold DIM / FACT` | Already exist and already carry history from the current system. This programme changes only how they are populated. | dbt §6.4 (p.15) · §10.1 (p.23) |

## What happens when it goes wrong

| # | Scenario | What the design does | Source |
|---|---|---|---|
| X32 | A correction arrives and the row is still current | A normal MERGE, joined on the surrogate key rather than the natural key — a natural-key join matches both the closing and the opening row and fails. | dbt §6.4.1 (p.15) |
| X33 | A correction arrives and the interval is already closed | A direct UPDATE of that closed row only. Never a MERGE — it would reopen an interval that is settled. | dbt §6.4.1 (p.15) |
| X34 | Someone changes the shape of a Gold table | Refused. Every Gold model fails on a schema change, and the service account holds DML only — no create, alter or drop. | dbt §8.4 (p.21) |

## Where SEI's documents disagree about this

Each one is a decision to take before a model is written.

### C3 — Two Gold facts, or three

- **The architecture says.** FACT_TRANSACTIONS, FACT_CP_HOLDINGS and FACT_TAX_LOT, each with its own strategy — merge, merge and periodic snapshot.
- **The design documents say.** FACT_TRANSACTIONS only.
- **Why it matters.** Holdings and tax lot are the two the design document is silent on, and a periodic snapshot is a different pattern from a merge — it is not covered by the SCD2 and merge logic that is specified.

### C4 — Corrections as files, or as a rule

- **The architecture says.** Two correction files arrive daily and Stage 2 has a named step, correction file integration, that merges them.
- **The design documents say.** Correction is a MERGE-versus-UPDATE rule applied inside the dimension build. No correction file is described.
- **Why it matters.** The architecture has corrections entering as data; the design document has them as a write strategy. Both may be needed, but nobody has said how a correction file reaches the rule.

## Still open with SEI

SEI's own ids, so they can be quoted straight back.

- **D1.** Confirm the existing sequence name and ownership behind the Gold surrogate key.
- **D3.** Confirm the current history coverage of the existing dimensions.

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
