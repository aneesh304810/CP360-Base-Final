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
generated: true
sei_status: absent
generated: true
sei_status: absent
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

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand. Correct the
model and every document that used it is corrected with it:
`node tools/export_design_model.mjs && python3 tools/gen_design_docs.py`
