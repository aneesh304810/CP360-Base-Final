---
cp360_type: design_document
component_id: 13
component_name: Python Ingestion Framework
zone: 2. Hub
plane: Processing
priority: P1
technology: Python
custom_build: High
depends_on: [8, 14, 23]
status: Not Started
owner: TBD
architecture_decisions: [AD-7, AD-8, AD-9, AD-10]
pipeline_tiers: [Stage1-Oracle]
last_updated: 2026-08-10
tags: [SEI-BBH, Integration-Hub, hub, processing, ingestion]
origin: SEI-BBH component tracker
sei_coverage: covered
gap_owner: BBH
in_scope: true
generated: true
sei_status: specified
architecture_domain: Ingestion
canonical_tier: not on the stage chain
control_entities: [FILE_SCHEMA_CONFIG, FILE_REGISTRY, DATE_CONTROL]
traceability_identifiers: [FILE_ID, LOAD_ID, BUSINESS_DATE, DAG_RUN_ID]
supplement: CP360-GAP-DESIGN-SUPPLEMENT
---

# Python Ingestion Framework

## What this component is

ONE DAG for every inbound interface, not one per interface. It is driven by configuration rows, so a new interface is onboarded by adding a row rather than by writing a DAG.

It sits in **Ingestion**, in the **File-based ingestion** lane (SECONDARY · Airflow · Python).

## What SEI specifies

### S5 — Ingestion DAG (one, metadata-driven)

ONE DAG for every inbound interface, not one per interface. It is driven by configuration rows, so a new interface is onboarded by adding a row rather than by writing a DAG.

- **Technology.** Airflow 3.0
- **Source.** ingest §5 (p.9)

### S6 — Scheduled discovery

A scan on a schedule rather than a sensor waiting on each file. It reads the active configurations, scans the Landing Zone, matches each physical filename to exactly one logical interface and parses the business date out of the filename.

- **Technology.** Airflow · every 5 min
- **Source.** ingest §4.1 (p.7) · §9.1 (p.16) · Appendix C.1 (p.21)

### S7 — Mapped file task (one per file)

Airflow creates one task per discovered file at run time, so files process independently and in parallel within the pool and Oracle connection limits. A file never waits for another interface.

- **Technology.** Dynamic Task Mapping
- **Source.** ingest §5 (p.9) · Appendix C.1 (p.21)

### S8 — Python loader

Per file: claim the (interface, business date) pair in the registry, validate readability, header, trailer, zero-row policy and row counts, load the detail rows into the configured RAW table in ONE Oracle transaction, reconcile parsed against trailer against inserted counts, and commit only when they agree. Then move the file and record the outcome.

- **Technology.** worker pod
- **Source.** ingest §3.1 (p.6) · §4.1 (p.7) · §7.3 (p.14)

## The Oracle objects it touches

No foreign key is declared in either document. Every join below
is one a model runs, not a constraint the database enforces.

| Object | What it holds | Source |
|---|---|---|
| `FILE_SCHEMA_CONFIG` | How an active interface is discovered, dated, validated and routed. File-level only — there is deliberately no column mapping table, because the RAW table DDL is the schema contract. | ingest Appendix A (p.18) · §6.1 (p.12) |
| `FILE_REGISTRY` | The lifecycle record per logical interface and business date. It is what makes repeated discovery safe, and ARCHIVED on it is what completeness counts. | ingest Appendix B (p.19) · §6.2 (p.12) |
| `DATE_CONTROL` | The orchestration ledger, and the one object both documents write to. One row per business date, at most one row not COMPLETE at a time, enforced by a unique index on a CASE expression. | ingest Appendix E.1 (p.24) · §6.3 (p.13) · dbt Appendix A.2 (p.25) |
| `RAW tables` | Bronze. Validated detail rows as delivered, tagged with the business date and lineage. The dbt document names three: account, client and transaction. | ingest Glossary (p.25) · dbt §4.1 (p.10) |

## What happens when it goes wrong

| # | Scenario | What the design does | Source |
|---|---|---|---|
| X1 | Exactly one pattern matches | One work item is created, carrying the interface, the physical filename, the business date, the target RAW table and the parsing rules. | ingest Appendix C.3 (p.21) |
| X2 | No pattern matches | Not loaded and not moved. An unmatched-file event is emitted with the filename and path, and the approved exception-location policy applies — which is still open decision O1. | ingest Appendix C.3 (p.21) |
| X3 | More than one pattern matches | Treated as a configuration defect. No target table is chosen, nothing is processed, and it is logged and notified. | ingest Appendix C.3 (p.21) |
| X4 | The scan finds nothing | The run succeeds with zero mapped tasks. The completeness and SLA task still runs — which is the point, because yesterday's late file can complete the set without a new one arriving. | ingest §5.2 (p.10) |
| X8 | The same file is discovered again | If the existing record is ARCHIVED it is skipped and logged as a duplicate; no second registry row is created. A unique key on the interface and business date enforces it. | ingest §5 (p.9) · Appendix B (p.19) |
| X9 | A record is stuck in RECEIVED, VALIDATED or LOADING | Investigated, never reset automatically. The Airflow task state, the worker logs, the file location and the Oracle outcome are checked first, and the same record is reused for recovery. | ingest Appendix D.5 (p.23) |
| X5 | The business date will not parse | Rejected before any RAW write, with the parsing error recorded. The format mask must reject impossible dates even when the regex shape matches. | ingest Appendix D.6 (p.23) |
| X6 | Header or trailer fails | RECEIVED becomes QUARANTINED, the error is recorded and the file moves to Quarantine. Nothing is written to RAW. | ingest §4 (p.7) · Appendix B.2 (p.20) |
| X7 | A zero-row file arrives and is not allowed | QUARANTINED, same path. Whether zero rows are allowed is per interface configuration. | ingest §6.1 (p.12) |
| X10 | The RAW load or the count check fails | Rolled back. LOADING becomes FAILED with the error and the end timestamp. The insert and the count reconciliation are one Oracle transaction, and the commit happens only when the file count, the trailer count and the inserted count all agree. | ingest §4.1 (p.7) · §7.3 (p.14) |
| X11 | A FAILED file is rerun | The same registry id is reused and the retry count goes up. Any exceptional partial rows are removed through the approved process first, then the file reloads in one transaction. | ingest Appendix D.1 (p.22) |
| X12 | The archive move fails after a good load | ARCHIVE_FAILED. RAW is kept and is never deleted or reloaded — the move happens after the commit and cannot be part of the transaction. Only the move is retried. | ingest §7.3 (p.14) · Appendix D.3 (p.22) |
| X39 | A successful file has to be replaced | Approval first, then the reason, approver, operator and affected downstream scope are recorded. The registry row and the RAW rows are deleted through the controlled process, the corrected file is dropped in Landing, and a fresh lifecycle starts. The downstream rebuild for that date is coordinated separately. | ingest Appendix D.4 (p.23) |
| X40 | A quarantined file is corrected | The same registry id is reused, the retry count goes up, the status resets to RECEIVED and every validation runs again before any RAW write. | ingest Appendix D.2 (p.22) |

## Still open with SEI

SEI's own ids, so they can be quoted straight back.

- **O2.** Confirm batch SLA, peak timing, representative file sizes and the Oracle connection envelope.
- **O3.** Confirm the retention period and purge approach for RAW and FILE_REGISTRY.
- **O6.** Confirm expected-interface criteria and any holiday or month-end rules.

## How this works, from the architecture supplement

### What ingestion is responsible for

- Discover candidate files independently as they arrive
- Match each file to exactly one active interface configuration
- Derive BUSINESS_DATE using the configured naming contract
- Validate readability, structure, header, trailer, zero-row policy and counts
- Claim one logical file lifecycle record
- Load the configured Stage 1 RAW table atomically
- Reconcile counts, archive successful files and quarantine invalid files
- Evaluate daily completeness and the common file-set SLA after every run

### Lifecycle rules

- ARCHIVED is the successful state completeness evaluation counts
- FAILED and QUARANTINED reuse the existing lifecycle record during authorised retry
- ARCHIVE_FAILED retries the archive operation and does not reload committed RAW records
- Registry uniqueness prevents duplicate successful loading for the configured logical file and business date

## Open against this component

**1 unresolved conflict and 2 other open items** — `R3`, `R14`, `R16`. Stated in full, with both readings and the decision each needs, in the gap supplement.

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand. Correct the
model and every document that used it is corrected with it:
`node tools/export_design_model.mjs && python3 tools/gen_design_docs.py`
