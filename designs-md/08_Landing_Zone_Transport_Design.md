---
cp360_type: design_document
component_id: 8
component_name: Landing Zone + Transport
zone: 2. Hub
plane: Ingress/Egress
priority: P1
technology: Infra
custom_build: Low
depends_on: [5]
status: Not Started
owner: TBD
architecture_decisions: [AD-8]
pipeline_tiers: [Stage1-Oracle]
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, ingress-egress]
origin: SEI-BBH component tracker
sei_coverage: covered
gap_owner: Joint
in_scope: true
generated: true
sei_status: specified
generated: true
sei_status: specified
generated: true
sei_status: specified
---

# Landing Zone + Transport

## What this component is

Copies COMPLETE SWP files from SFTP into the Landing Zone. The word complete is carrying weight: the design assumes a file only appears once it is whole, and if that is not true a readiness convention such as a final rename or a marker file has to be added.

It sits in **Ingress and Egress**, in the **Landing and transport** lane (SFTP · Momentum · shared storage).

## What SEI specifies

### S2 — Momentum

Copies COMPLETE SWP files from SFTP into the Landing Zone. The word complete is carrying weight: the design assumes a file only appears once it is whole, and if that is not true a readiness convention such as a final rename or a marker file has to be added.

- **Technology.** upstream process
- **Source.** ingest §3.1 (p.6) · §2.1 assumptions (p.5)

### S3 — Landing Zone

Shared storage that Airflow scans for eligible files. Shared is load-bearing too — every worker pod has to see the same Landing, Archive and Quarantine folders.

- **Technology.** shared storage
- **Source.** ingest Glossary (p.25) · §2.1 (p.5)

### S4 — Archive and Quarantine

Where a file goes after processing. Archive on success, Quarantine when validation fails before anything is written.

- **Technology.** shared storage
- **Source.** ingest Figure 1 (p.6) · §4.1 (p.7)

## What happens when it goes wrong

| # | Scenario | What the design does | Source |
|---|---|---|---|
| X12 | The archive move fails after a good load | ARCHIVE_FAILED. RAW is kept and is never deleted or reloaded — the move happens after the commit and cannot be part of the transaction. Only the move is retried. | ingest §7.3 (p.14) · Appendix D.3 (p.22) |

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
