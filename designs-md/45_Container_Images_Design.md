---
cp360_type: design_document
component_id: 45
component_name: Container Images
zone: 4. OpenShift
plane: Platform
priority: P1
technology: Infra
custom_build: Medium
depends_on: [57]
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

# Container Images

## What this component is

Container images. Both documents assume OpenShift and neither specifies how images are built or versioned — only that rollback is redeploying the prior one.

## What SEI specifies

**Nothing.** Neither SEI design document covers this component.

Container images. Both documents assume OpenShift and neither specifies how images are built or versioned — only that rollback is redeploying the prior one.

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
