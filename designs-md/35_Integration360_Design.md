---
cp360_type: design_document
component_id: 35
component_name: Integration360
zone: 2. Hub
plane: Foundation
priority: P1
technology: Vendor/BBH
custom_build: Medium
depends_on: [7, 30]
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

# Integration360

## What this component is

This catalogue. SEI gives all reporting to Splunk, so 360 reading the same tables directly is BBH's addition — defensible, and nobody has written down who owns which.

It sits in **Foundation**, in the **Evidence and observability** lane (Splunk · 360).

## What SEI specifies

**Nothing.** Neither SEI design document covers this component.

This catalogue. SEI gives all reporting to Splunk, so 360 reading the same tables directly is BBH's addition — defensible, and nobody has written down who owns which.

That is not a judgement on whether it is needed. It means no
design exists to build from, and writing one is BBH's to do and
SEI's to confirm.

## Where SEI's documents disagree about this

Each one is a decision to take before a model is written.

### C2 — Stage 2 as five tables, or as STG plus INT

- **The architecture says.** Five STG2_* tables, materialised as tables, full refresh daily or incremental.
- **The design documents say.** A STG view that stores nothing, plus an INT table kept seven days and partitioned.
- **Why it matters.** Not a naming difference. One stores Stage 2 and one does not, and the retention, the replay window and the reconciliation boundaries all follow from which it is.

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand. Correct the
model and every document that used it is corrected with it:
`node tools/export_design_model.mjs && python3 tools/gen_design_docs.py`
