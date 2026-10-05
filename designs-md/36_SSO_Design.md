---
cp360_type: design_document
component_id: 36
component_name: SSO
zone: 2. Hub
plane: Foundation
priority: P3
technology: Infra
custom_build: None
depends_on: [2]
status: Not Started
owner: TBD
origin: SEI-BBH component tracker
sei_coverage: absent
gap_owner: BBH
in_scope: true
generated: true
sei_status: absent
generated: true
sei_status: absent
generated: true
sei_status: absent
---

# SSO

## What this component is

Sign-on for BBH's own tools. Out of scope for both.

It sits in **Foundation**, in the **Security and access** lane (OpenShift · Oracle).

## What SEI specifies

**Nothing.** Neither SEI design document covers this component.

Sign-on for BBH's own tools. Out of scope for both.

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
