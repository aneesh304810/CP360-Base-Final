---
cp360_type: design_document
component_id: 39
component_name: Pivotal Database
zone: 3. Consumers
plane: Consumers
priority: P2
technology: dbt
custom_build: Medium
depends_on: [15]
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

# Pivotal Database

## What this component is

Downstream of Gold, as above — and SEI's design has no notion of a consumer-specific shape at all.

It sits in **Processing**, in the **Warehouse and consumers** lane (BBH).

## What SEI specifies

**Nothing.** Neither SEI design document covers this component.

Downstream of Gold, as above — and SEI's design has no notion of a consumer-specific shape at all.

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
