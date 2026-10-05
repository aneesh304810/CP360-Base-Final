---
cp360_type: design_document
component_id: 59
component_name: dbt Release & Rollback
zone: 4. OpenShift
plane: Deployment
priority: P1
technology: dbt + CI/CD
custom_build: High
depends_on: [15, 16, 21]
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

# dbt Release & Rollback

## What this component is

Rollback is redeploying the prior image, and it is safe only because Gold writes are idempotent merges with no DDL.

## What SEI specifies

### S13 — Transformation DAG

Re-checks completeness and TRIGGER status before doing any work — trust but verify — then builds the layers in order, each as a build task followed by its own test task.

- **Technology.** Airflow + dbt
- **Source.** dbt §5.2 (p.11) · Appendix A.1 (p.25)

## The Oracle objects it touches

No foreign key is declared in either document. Every join below
is one a model runs, not a constraint the database enforces.

| Object | What it holds | Source |
|---|---|---|
| `DATE_CONTROL` | The orchestration ledger, and the one object both documents write to. One row per business date, at most one row not COMPLETE at a time, enforced by a unique index on a CASE expression. | ingest Appendix E.1 (p.24) · §6.3 (p.13) · dbt Appendix A.2 (p.25) |

## What happens when it goes wrong

| # | Scenario | What the design does | Source |
|---|---|---|---|
| X21 | A transformation task fails | The date stays TRIGGER, no next date is created and the pipeline is locked. Airflow alerts and the run restarts from the failed task; each layer's write is idempotent for the date. | dbt §8.1 (p.20) |
| X39 | A successful file has to be replaced | Approval first, then the reason, approver, operator and affected downstream scope are recorded. The registry row and the RAW rows are deleted through the controlled process, the corrected file is dropped in Landing, and a fresh lifecycle starts. The downstream rebuild for that date is coordinated separately. | ingest Appendix D.4 (p.23) |

## Still open with SEI

SEI's own ids, so they can be quoted straight back.

- **D5.** Confirm retention units, Oracle partitioning support, volumetrics and run-window targets.

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand. Correct the
model and every document that used it is corrected with it:
`node tools/export_design_model.mjs && python3 tools/gen_design_docs.py`
