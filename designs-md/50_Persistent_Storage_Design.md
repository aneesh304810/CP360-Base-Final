---
cp360_type: design_document
component_id: 50
component_name: Persistent Storage
zone: 4. OpenShift
plane: Platform
priority: P2
technology: Infra
custom_build: None
depends_on: [8, 29]
status: Not Started
owner: TBD
origin: SEI-BBH component tracker
sei_coverage: unassessed
gap_owner: unassessed
in_scope: true
generated: true
sei_status: differs
generated: true
sei_status: differs
generated: true
sei_status: differs
---

# Persistent Storage

## What this component is

SEI needs one specific thing from storage and states it as an assumption: Landing, Archive and Quarantine must be shared across worker pods, or mapped tasks cannot reliably read or move files.

## What SEI specifies

**SEI covers the need and answers it differently.** SEI needs one specific thing from storage and states it as an assumption: Landing, Archive and Quarantine must be shared across worker pods, or mapped tasks cannot reliably read or move files.

### S3 — Landing Zone

Shared storage that Airflow scans for eligible files. Shared is load-bearing too — every worker pod has to see the same Landing, Archive and Quarantine folders.

- **Technology.** shared storage
- **Source.** ingest Glossary (p.25) · §2.1 (p.5)

## Still open with SEI

SEI's own ids, so they can be quoted straight back.

- **O1.** Confirm Landing Zone, Archive and Quarantine details.

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand. Correct the
model and every document that used it is corrected with it:
`node tools/export_design_model.mjs && python3 tools/gen_design_docs.py`
