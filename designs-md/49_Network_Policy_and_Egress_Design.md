---
cp360_type: design_document
component_id: 49
component_name: Network Policy & Egress
zone: 4. OpenShift
plane: Platform
priority: P1
technology: Infra
custom_build: None
depends_on: [8, 11]
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

# Network Policy & Egress

## What this component is

Network policy and egress. Neither document says what the pipeline is allowed to reach, which matters given it pulls from SFTP and pushes to Splunk.

## What SEI specifies

**Nothing.** Neither SEI design document covers this component.

Network policy and egress. Neither document says what the pipeline is allowed to reach, which matters given it pulls from SFTP and pushes to Splunk.

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
