---
cp360_type: design_document
component_id: 1
component_name: SWP Platform
zone: 1. SEI
plane: Source
priority: P1
technology: Contract
custom_build: None
depends_on: []
status: Not Started
owner: TBD
origin: SEI-BBH component tracker
sei_coverage: unassessed
gap_owner: unassessed
in_scope: true
generated: true
sei_status: specified
generated: true
sei_status: specified
generated: true
sei_status: specified
---

# SWP Platform

## What this component is

The files SEI produces for BBH, delivered to an SFTP location.

It sits in **Ingress and Egress**, in the **SEI-side source** lane (SEI).

## What SEI specifies

### S1 — SWP source files on SFTP

The files SEI produces for BBH, delivered to an SFTP location.

- **Technology.** SEI
- **Source.** ingest §3.1 (p.6) · Glossary (p.25)

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand. Correct the
model and every document that used it is corrected with it:
`node tools/export_design_model.mjs && python3 tools/gen_design_docs.py`
