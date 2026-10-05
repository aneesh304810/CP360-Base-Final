---
cp360_type: design_document
component_id: 51
component_name: Airflow Deployment
zone: 4. OpenShift
plane: Runtime
priority: P1
technology: Infra + Airflow
custom_build: Medium
depends_on: [18]
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

# Airflow Deployment

## What this component is

A starting configuration is given: schedule every five minutes, catchup off, one active run, pool 8 to 10, one or two retries.

## What SEI specifies

### S5 — Ingestion DAG (one, metadata-driven)

ONE DAG for every inbound interface, not one per interface. It is driven by configuration rows, so a new interface is onboarded by adding a row rather than by writing a DAG.

- **Technology.** Airflow 3.0
- **Source.** ingest §5 (p.9)

## The Oracle objects it touches

No foreign key is declared in either document. Every join below
is one a model runs, not a constraint the database enforces.

| Object | What it holds | Source |
|---|---|---|
| `FILE_SCHEMA_CONFIG` | How an active interface is discovered, dated, validated and routed. File-level only — there is deliberately no column mapping table, because the RAW table DDL is the schema contract. | ingest Appendix A (p.18) · §6.1 (p.12) |
| `FILE_REGISTRY` | The lifecycle record per logical interface and business date. It is what makes repeated discovery safe, and ARCHIVED on it is what completeness counts. | ingest Appendix B (p.19) · §6.2 (p.12) |
| `DATE_CONTROL` | The orchestration ledger, and the one object both documents write to. One row per business date, at most one row not COMPLETE at a time, enforced by a unique index on a CASE expression. | ingest Appendix E.1 (p.24) · §6.3 (p.13) · dbt Appendix A.2 (p.25) |

## Still open with SEI

SEI's own ids, so they can be quoted straight back.

- **O2.** Confirm batch SLA, peak timing, representative file sizes and the Oracle connection envelope.

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand. Correct the
model and every document that used it is corrected with it:
`node tools/export_design_model.mjs && python3 tools/gen_design_docs.py`
