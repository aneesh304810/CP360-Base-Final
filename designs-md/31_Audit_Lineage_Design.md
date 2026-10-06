---
cp360_type: design_document
component_id: 31
component_name: Audit & Lineage
zone: 2. Hub
plane: Foundation
priority: P1
technology: Python + dbt
custom_build: Medium
depends_on: [14, 17]
status: Not Started
owner: TBD
architecture_decisions: [AD-2, AD-8]
pipeline_tiers: [Stage1-Oracle, Stage2-Oracle, Stage3-Exadata-Gold, Consumer-Movement]
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, foundation]
origin: SEI-BBH component tracker
sei_coverage: partial
gap_owner: SEI
in_scope: true
generated: true
sei_status: specified
architecture_domain: Foundation
canonical_tier: not on the stage chain
control_entities: [FILE_SCHEMA_CONFIG, FILE_REGISTRY, DATE_CONTROL, DQ_VALIDATION_FAILURE, RECON_RESULT]
traceability_identifiers: [PROJECT_ID, FILE_ID, LOAD_ID, BUSINESS_DATE, CORRELATION_ID]
supplement: CP360-GAP-DESIGN-SUPPLEMENT
---

# Audit & Lineage

## What this component is

Business date, run ids, the source record id and the failure category are correlated; the control tables are the ledger.

It sits in **Foundation**, in the **Errors, audit and lineage** lane (Python · dbt).

## What SEI specifies

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
| `FILE_REGISTRY` | The lifecycle record per logical interface and business date. It is what makes repeated discovery safe, and ARCHIVED on it is what completeness counts. | ingest Appendix B (p.19) · §6.2 (p.12) |
| `DATE_CONTROL` | The orchestration ledger, and the one object both documents write to. One row per business date, at most one row not COMPLETE at a time, enforced by a unique index on a CASE expression. | ingest Appendix E.1 (p.24) · §6.3 (p.13) · dbt Appendix A.2 (p.25) |

## How this works, from the architecture supplement

### Minimum common fields on every operational event

- timestamp, environment, component, project_id, business_date
- correlation_id, load_id, file_id, dag_run_id, workflow_id, step_id
- event_type, status, error_code, error_category, duration_ms, record_count
- Restricted business data and secrets are never emitted in operational logs

### Required event families

- file discovered, matched, duplicate skipped, validated, loaded, reconciled, quarantined, archived, archive failed
- completeness evaluated, missing interfaces identified, SLA breached, SLA recovered, transformation triggered
- dbt model started, completed, failed, tested
- DQ failure opened, resolved or closed; reconciliation passed or failed
- workflow and step state changed
- API or loader request accepted, rejected, retried, timed out or completed
- consumer publish started, completed or failed

### Security and access

- Enterprise SSO for authorised user access
- Role-based access to configuration, control, support and administrative actions
- Separate runtime service accounts for ingestion, transformation, publishing and operational support
- Credentials resolved from the approved secret store
- Encryption in transit and at rest to the hosting platform standard
- Audit of configuration changes, replay requests, manual state changes and security-sensitive operations
- Least privilege on Oracle schemas, Landing/Archive/Quarantine paths, OpenShift namespaces, APIs and monitoring data

## Open against this component

**1 unresolved conflict and 10 other open items** — `GAP-05`, `GAP-09`, `GAP-11`, `R4`, `R6`, `R7`, `R9`, `R11`, `R13`, `R24`, `R25`. Stated in full, with both readings and the decision each needs, in the gap supplement.

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand. Correct the
model and every document that used it is corrected with it:
`node tools/export_design_model.mjs && python3 tools/gen_design_docs.py`
