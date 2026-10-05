---
cp360_type: design_document
component_id: 4
component_name: SWP Loaders
zone: 1. SEI
plane: Source
priority: P2
technology: Contract
custom_build: None
depends_on: [10, 11]
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

# SWP Loaders

## What this component is

The loader endpoints BBH submits to. Outbound, and neither document covers outbound at all.

It sits in **Ingress and Egress**, in the **Loader framework** lane (Python · outbound).

## What SEI specifies

**Nothing.** Neither SEI design document covers this component.

The loader endpoints BBH submits to. Outbound, and neither document covers outbound at all.

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
