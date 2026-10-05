---
cp360_type: design_document
component_id: 42
component_name: Real-time Consumers
zone: 3. Consumers
plane: Consumers
priority: P2
technology: Contract
custom_build: None
depends_on: [12]
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

# Real-time Consumers

## What this component is

The real-time lane again. Neither document has a consumer that is not fed from a completed business date.

## What SEI specifies

**Nothing.** Neither SEI design document covers this component.

The real-time lane again. Neither document has a consumer that is not fed from a completed business date.

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
