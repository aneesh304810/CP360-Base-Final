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
