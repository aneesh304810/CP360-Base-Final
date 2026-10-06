---
cp360_type: design_document
component_id: 20
component_name: Intraday Cadence Control
zone: 2. Hub
plane: Orchestration
priority: P1
technology: Airflow
custom_build: Medium
depends_on: [12, 18]
status: Not Started
owner: TBD
architecture_decisions: [AD-2]
pipeline_tiers: [Stage1-Oracle, Stage2-Oracle]
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, orchestration]
origin: SEI-BBH component tracker
sei_coverage: absent
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

# Intraday Cadence Control

## What this component is

Directly contradicted rather than merely absent: SEI permits one non-COMPLETE business date at a time, enforced by a unique index. An intraday cadence does not fit that state machine.

It sits in **Orchestration**, in the **Business-date state machine** lane (Oracle).

## What SEI specifies

**Nothing.** Neither SEI design document covers this component.

Directly contradicted rather than merely absent: SEI permits one non-COMPLETE business date at a time, enforced by a unique index. An intraday cadence does not fit that state machine.

That is not a judgement on whether it is needed. It means no
design exists to build from, and writing one is BBH's to do and
SEI's to confirm.

## Where SEI's documents disagree about this

Each one is a decision to take before a model is written.

### C2 — Stage 2 as five tables, or as STG plus INT

- **The architecture says.** Five STG2_* tables, materialised as tables, full refresh daily or incremental.
- **The design documents say.** A STG view that stores nothing, plus an INT table kept seven days and partitioned.
- **Why it matters.** Not a naming difference. One stores Stage 2 and one does not, and the retention, the replay window and the reconciliation boundaries all follow from which it is.

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
