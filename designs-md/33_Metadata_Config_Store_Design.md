---
cp360_type: design_document
component_id: 33
component_name: Metadata & Configuration Store
zone: 2. Hub
plane: Foundation
priority: P1
technology: Oracle DDL + Python
custom_build: High
depends_on: [6, 28]
status: Not Started
owner: TBD
architecture_decisions: [AD-6, AD-9, AD-2]
pipeline_tiers: [Stage1-Oracle, Stage2-Oracle, Stage3-Exadata-Gold, Consumer-Movement]
last_updated: 2026-08-10
tags: [SEI-BBH, Integration-Hub, hub, foundation, config]
origin: SEI-BBH component tracker
sei_coverage: partial
gap_owner: Joint
in_scope: true
generated: true
sei_status: specified
generated: true
sei_status: specified
generated: true
sei_status: specified
---

# Metadata & Configuration Store

## What this component is

How an active interface is discovered, dated, validated and routed. File-level only — there is deliberately no column mapping table, because the RAW table DDL is the schema contract.

It sits in **Foundation**, in the **Control and metadata** lane (Oracle).

## What SEI specifies

### T1 — FILE_SCHEMA_CONFIG

How an active interface is discovered, dated, validated and routed. File-level only — there is deliberately no column mapping table, because the RAW table DDL is the schema contract.

- **Columns.** FILE_NAME (PK) · FILE_NAME_PATTERN · TARGET_RAW_TABLE · DELIMITER · HAS_HEADER · HAS_TRAILER · ALLOW_ZERO_ROWS · DELIVERY_FREQUENCY · DATE_EXTRACTION_REGEX · DATE_EXTRACTION_GROUP · DATE_FORMAT_MASK · IS_ACTIVE · audit
- **Source.** ingest Appendix A (p.18) · §6.1 (p.12)

### T2 — FILE_REGISTRY

The lifecycle record per logical interface and business date. It is what makes repeated discovery safe, and ARCHIVED on it is what completeness counts.

- **Columns.** FILE_REGISTRY_ID (PK) · FILE_NAME + BUSINESS_DATE (unique) · SRC_FILE_NAME · FILE_PATH · ARCHIVE_PATH · STATUS · FILE_ROW_COUNT · TRAILER_ROW_COUNT · RAW_ROW_COUNT · RECEIVED/VALIDATED/LOAD_START/LOAD_END/ARCHIVE_TS · RETRY_COUNT · ERROR_CODE · ERROR_DETAIL
- **Source.** ingest Appendix B (p.19) · §6.2 (p.12)

### T3 — DATE_CONTROL

The orchestration ledger, and the one object both documents write to. One row per business date, at most one row not COMPLETE at a time, enforced by a unique index on a CASE expression.

- **Columns.** BUSINESS_DATE (PK) · STATUS · SLA_CUTOFF_TS · CREATED_TS · TRIGGER_TS · COMPLETE_TS · INGESTION_DAG_RUN_ID · TRANSFORMATION_DAG_RUN_ID
- **Source.** ingest Appendix E.1 (p.24) · §6.3 (p.13) · dbt Appendix A.2 (p.25)

## The Oracle objects it touches

No foreign key is declared in either document. Every join below
is one a model runs, not a constraint the database enforces.

| Object | What it holds | Source |
|---|---|---|
| `FILE_SCHEMA_CONFIG` | How an active interface is discovered, dated, validated and routed. File-level only — there is deliberately no column mapping table, because the RAW table DDL is the schema contract. | ingest Appendix A (p.18) · §6.1 (p.12) |
| `FILE_REGISTRY` | The lifecycle record per logical interface and business date. It is what makes repeated discovery safe, and ARCHIVED on it is what completeness counts. | ingest Appendix B (p.19) · §6.2 (p.12) |
| `DATE_CONTROL` | The orchestration ledger, and the one object both documents write to. One row per business date, at most one row not COMPLETE at a time, enforced by a unique index on a CASE expression. | ingest Appendix E.1 (p.24) · §6.3 (p.13) · dbt Appendix A.2 (p.25) |

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand. Correct the
model and every document that used it is corrected with it:
`node tools/export_design_model.mjs && python3 tools/gen_design_docs.py`
