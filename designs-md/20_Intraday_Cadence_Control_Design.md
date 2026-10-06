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

## Gaps and decisions that land here

From the consolidated gap supplement and the CP-Integration-Gateway
readiness review. These arrived after the SEI baseline and in several
places disagree with it; where they do, both readings are given and
neither is silently adopted.

### Gap register

| Gap | What is missing | Required disposition |
|---|---|---|
| `GAP-06` | DATE_CONTROL and file lifecycles lack one canonical state view | Add state machines, transition ownership, guards and recovery behaviour |

### Against what this design already says

#### Confirms the baseline — One guarded owner of PENDING to TRIGGER

- **The supplement says.** The missing-interface set is empty AND the atomic update affects exactly one row.
- **This design holds.** The same guard, drawn as the gate.

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand. Correct the
model and every document that used it is corrected with it:
`node tools/export_design_model.mjs && python3 tools/gen_design_docs.py`
