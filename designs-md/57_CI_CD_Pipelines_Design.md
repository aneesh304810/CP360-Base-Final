---
cp360_type: design_document
component_id: 57
component_name: CI/CD Pipelines
zone: 4. OpenShift
plane: Deployment
priority: P1
technology: CI/CD
custom_build: Medium
depends_on: [45, 46]
status: Not Started
owner: TBD
origin: SEI-BBH component tracker
sei_coverage: unassessed
gap_owner: unassessed
in_scope: true
generated: true
sei_status: specified
architecture_domain: OpenShift Platform
canonical_tier: not on the stage chain
control_entities: []
traceability_identifiers: []
supplement: CP360-GAP-DESIGN-SUPPLEMENT
---

# CI/CD Pipelines

## What this component is

Git-versioned models and DAGs; the pipeline compiles and runs unit and DQ tests before promotion.

It sits in **OpenShift Platform**, in the **Operations** lane (OpenShift).

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

## How this works, from the architecture supplement

### Runtime domains

| Domain | Workloads |
|---|---|
| Orchestration | Airflow scheduler, webserver, triggerer and workers |
| Transformation | dbt task containers launched by Airflow |
| Integration services | API and workflow services |
| CP360 services | FastAPI backend and React UI where deployed on the same platform |
| Platform operations | Logging, metrics, health probes, secret integration and deployment controls |

### Deployment requirements

- Separate configuration from container images
- Immutable, versioned images from the approved internal registry
- Liveness and readiness probes for long-running services
- Defined CPU and memory requests and limits
- Horizontal scaling only for stateless or concurrency-safe services
- Shared storage mounted only where the file-processing contract requires it
- Database schema migration and application deployment versioned and controlled
- Airflow and application logs preserved in the approved evidence platform

### Graceful degradation

- Oracle unavailable: processing does not claim or advance durable state
- Splunk or Integration360 unavailable: core transaction behaviour follows the approved buffering or failure policy and never silently discards required evidence
- SEI APIs unavailable: workflow state remains queryable and safe retry reuses the same correlation and idempotency identifiers
- CP360 UI unavailable: durable ingestion and orchestration state remains in Oracle and Airflow

### CI/CD gates

- Source control to build and unit test
- Dependency and image scan
- Schema and contract tests
- Deploy to OpenShift
- Smoke and connectivity tests
- Controlled environment promotion

## Open against this component

**4 other open items** — `GAP-04`, `R13`, `R15`, `R22`. Stated in full, with both readings and the decision each needs, in the gap supplement.

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand. Correct the
model and every document that used it is corrected with it:
`node tools/export_design_model.mjs && python3 tools/gen_design_docs.py`
