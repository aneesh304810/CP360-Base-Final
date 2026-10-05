---
cp360_type: design_document
component_id: 12
component_name: API Gateway / Data Plane
zone: 2. Hub
plane: Ingress/Egress
priority: P2
technology: Vendor/Infra
custom_build: Low
depends_on: [3, 42]
status: Not Started
owner: TBD
architecture_decisions: [AD-1]
pipeline_tiers: [Stage3-Exadata-Gold, Consumer-Movement]
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, ingress-egress, api]
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

# API Gateway / Data Plane

## What this component is

The API lane, as above. Nothing in either document describes real-time access to this data.

It sits in **Ingress and Egress**, in the **API gateway and Apigee proxy** lane (vendor).

## What SEI specifies

**Nothing.** Neither SEI design document covers this component.

The API lane, as above. Nothing in either document describes real-time access to this data.

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
