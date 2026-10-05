---
cp360_type: design_document
component_id: 56
component_name: Node Placement
zone: 4. OpenShift
plane: Runtime
priority: P2
technology: Infra
custom_build: None
depends_on: [12, 52]
status: Not Started
owner: TBD
origin: SEI-BBH component tracker
sei_coverage: unassessed
gap_owner: unassessed
in_scope: true
generated: true
sei_status: absent
generated: true
sei_status: absent
generated: true
sei_status: absent
---

# Node Placement

## What this component is

Node placement. Not mentioned, though the shared-storage assumption for Landing, Archive and Quarantine constrains it.

## What SEI specifies

**Nothing.** Neither SEI design document covers this component.

Node placement. Not mentioned, though the shared-storage assumption for Landing, Archive and Quarantine constrains it.

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
