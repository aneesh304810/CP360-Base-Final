---
cp360_type: design_document
component_id: 18
component_name: Airflow DAG + Per-Domain Fan-out
zone: 2. Hub
plane: Orchestration
priority: P1
technology: Airflow
custom_build: High
depends_on: [9, 51, 52]
status: Not Started
owner: TBD
architecture_decisions: [AD-4, AD-5, AD-9, AD-1]
pipeline_tiers: [Stage1-Oracle, Stage2-Oracle, Stage3-Exadata-Gold, Consumer-Movement]
last_updated: 2026-08-10
tags: [SEI-BBH, Integration-Hub, hub, orchestration, airflow]
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

# Airflow DAG + Per-Domain Fan-out

## What this component is

SEI has two DAGs, not one, and no per-domain fan-out: parallelism comes from one mapped task per FILE, created at run time.

It sits in **Orchestration**, in the **Ingestion DAG** lane (Airflow 3.0).

## What SEI specifies

**SEI covers the need and answers it differently.** SEI has two DAGs, not one, and no per-domain fan-out: parallelism comes from one mapped task per FILE, created at run time.

### S5 — Ingestion DAG (one, metadata-driven)

ONE DAG for every inbound interface, not one per interface. It is driven by configuration rows, so a new interface is onboarded by adding a row rather than by writing a DAG.

- **Technology.** Airflow 3.0
- **Source.** ingest §5 (p.9)

### S13 — Transformation DAG

Re-checks completeness and TRIGGER status before doing any work — trust but verify — then builds the layers in order, each as a build task followed by its own test task.

- **Technology.** Airflow + dbt
- **Source.** dbt §5.2 (p.11) · Appendix A.1 (p.25)

## The Oracle objects it touches

No foreign key is declared in either document. Every join below
is one a model runs, not a constraint the database enforces.

| Object | What it holds | Source |
|---|---|---|
| `FILE_SCHEMA_CONFIG` | How an active interface is discovered, dated, validated and routed. File-level only — there is deliberately no column mapping table, because the RAW table DDL is the schema contract. | ingest Appendix A (p.18) · §6.1 (p.12) |
| `FILE_REGISTRY` | The lifecycle record per logical interface and business date. It is what makes repeated discovery safe, and ARCHIVED on it is what completeness counts. | ingest Appendix B (p.19) · §6.2 (p.12) |
| `DATE_CONTROL` | The orchestration ledger, and the one object both documents write to. One row per business date, at most one row not COMPLETE at a time, enforced by a unique index on a CASE expression. | ingest Appendix E.1 (p.24) · §6.3 (p.13) · dbt Appendix A.2 (p.25) |

## What happens when it goes wrong

| # | Scenario | What the design does | Source |
|---|---|---|---|
| X21 | A transformation task fails | The date stays TRIGGER, no next date is created and the pipeline is locked. Airflow alerts and the run restarts from the failed task; each layer's write is idempotent for the date. | dbt §8.1 (p.20) |
| X39 | A successful file has to be replaced | Approval first, then the reason, approver, operator and affected downstream scope are recorded. The registry row and the RAW rows are deleted through the controlled process, the corrected file is dropped in Landing, and a fresh lifecycle starts. The downstream rebuild for that date is coordinated separately. | ingest Appendix D.4 (p.23) |

## Still open with SEI

SEI's own ids, so they can be quoted straight back.

- **D5.** Confirm retention units, Oracle partitioning support, volumetrics and run-window targets.
- **O2.** Confirm batch SLA, peak timing, representative file sizes and the Oracle connection envelope.

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand. Correct the
model and every document that used it is corrected with it:
`node tools/export_design_model.mjs && python3 tools/gen_design_docs.py`
