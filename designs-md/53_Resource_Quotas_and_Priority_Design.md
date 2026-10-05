---
cp360_type: design_document
component_id: 53
component_name: Resource Quotas & Priority
zone: 4. OpenShift
plane: Runtime
priority: P2
technology: Infra
custom_build: None
depends_on: [52]
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

# Resource Quotas & Priority

## What this component is

Resource quotas and priority. The documents give a starting pool size and worker count and leave the cluster-level envelope open — see open decision O2.

## What SEI specifies

**Nothing.** Neither SEI design document covers this component.

Resource quotas and priority. The documents give a starting pool size and worker count and leave the cluster-level envelope open — see open decision O2.

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
