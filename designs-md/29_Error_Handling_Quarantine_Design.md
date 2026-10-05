---
cp360_type: design_document
component_id: 29
component_name: Error Handling & Quarantine
zone: 2. Hub
plane: Foundation
priority: P1
technology: Python
custom_build: High
depends_on: [23, 50]
status: Not Started
owner: TBD
architecture_decisions: [AD-2, AD-8]
pipeline_tiers: [Stage1-Oracle, Stage2-Oracle]
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, foundation]
origin: SEI-BBH component tracker
sei_coverage: covered
gap_owner: BBH
in_scope: true
generated: true
sei_status: differs
generated: true
sei_status: differs
generated: true
sei_status: differs
---

# Error Handling & Quarantine

## What this component is

Two different quarantines. SEI quarantines FILES before load, and for failed ROWS keeps lineage only — no payload copy — on the assumption that anything held resolves inside seven days.

It sits in **Foundation**, in the **Errors, audit and lineage** lane (Python · dbt).

## What SEI specifies

**SEI covers the need and answers it differently.** Two different quarantines. SEI quarantines FILES before load, and for failed ROWS keeps lineage only — no payload copy — on the assumption that anything held resolves inside seven days.

### S4 — Archive and Quarantine

Where a file goes after processing. Archive on success, Quarantine when validation fails before anything is written.

- **Technology.** shared storage
- **Source.** ingest Figure 1 (p.6) · §4.1 (p.7)

### T7 — DQ_VALIDATION_FAILURE

One store for both failure categories, carrying whether the row can replay itself and whether it is still open.

- **Columns.** DQ_FAILURE_ID (PK) · DQ_CATEGORY (SOURCE_DQ | TRANSFORMATION_DQ) · BUSINESS_DATE · LAYER_NAME (STG | INT | DIM | FACT) · MODEL_NAME · BUSINESS_KEY · SRC_RECORD_ID · COLUMN_NAME · FAILURE_REASON · REPROCESS_ELIGIBLE · RESOLUTION_STATUS · RETRY_COUNT · RESOLVED_TS · DETECTED_TS
- **Source.** dbt §7.1 (p.17)

## The Oracle objects it touches

No foreign key is declared in either document. Every join below
is one a model runs, not a constraint the database enforces.

| Object | What it holds | Source |
|---|---|---|
| `DQ_VALIDATION_FAILURE` | One store for both failure categories, carrying whether the row can replay itself and whether it is still open. | dbt §7.1 (p.17) |

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
