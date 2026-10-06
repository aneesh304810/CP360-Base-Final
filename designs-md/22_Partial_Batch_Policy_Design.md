---
cp360_type: design_document
component_id: 22
component_name: Partial-Batch Policy
zone: 2. Hub
plane: Orchestration
priority: P1
technology: Airflow
custom_build: Medium
depends_on: [18, 23]
status: Not Started
owner: TBD
architecture_decisions: [AD-9]
pipeline_tiers: [Consumer-Movement]
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, orchestration]
origin: SEI-BBH component tracker
sei_coverage: partial
gap_owner: Joint
in_scope: true
generated: true
sei_status: absent
architecture_domain: Orchestration
canonical_tier: not on the stage chain
control_entities: [DATE_CONTROL, FILE_REGISTRY]
traceability_identifiers: [BUSINESS_DATE, DAG_RUN_ID]
supplement: CP360-GAP-DESIGN-SUPPLEMENT
---

# Partial-Batch Policy

## What this component is

SEI has no partial-set path: the transition fires only on an empty missing set. Running on what arrived would be a design change.

It sits in **Orchestration**, in the **Ingestion DAG** lane (Airflow 3.0).

## What SEI specifies

**Nothing.** Neither SEI design document covers this component.

SEI has no partial-set path: the transition fires only on an empty missing set. Running on what arrived would be a design change.

That is not a judgement on whether it is needed. It means no
design exists to build from, and writing one is BBH's to do and
SEI's to confirm.

## How this works, from the architecture supplement

### DATE_CONTROL transition ownership

| Transition | Owner | Guard |
|---|---|---|
| Create PENDING | Transformation completion process | Previous date completed and no conflicting active row |
| PENDING to TRIGGER | Ingestion completeness task | Missing-interface set is empty AND the atomic update affects one row |
| TRIGGER to COMPLETE | Transformation DAG | Required models, tests, DQ gates, reconciliation and publish succeed |
| TRIGGER retry | Authorised recovery procedure | Same business date and replay-safe processing |

### The two-DAG contract

- Run separate Ingestion and Transformation DAGs
- Use DATE_CONTROL as the durable business-date state machine
- Permit one guarded owner of the PENDING to TRIGGER transition
- Build dimensions before facts
- Advance to the next business date only after the complete transformation and publish boundary succeeds

## Open against this component

**2 other open items** — `GAP-06`, `R17`. Stated in full, with both readings and the decision each needs, in the gap supplement.

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand. Correct the
model and every document that used it is corrected with it:
`node tools/export_design_model.mjs && python3 tools/gen_design_docs.py`
