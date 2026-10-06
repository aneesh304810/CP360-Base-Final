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
architecture_domain: OpenShift Platform
canonical_tier: not on the stage chain
control_entities: []
traceability_identifiers: []
supplement: CP360-GAP-DESIGN-SUPPLEMENT
---

# Persistent Storage

## What this component is

SEI needs one specific thing from storage and states it as an assumption: Landing, Archive and Quarantine must be shared across worker pods, or mapped tasks cannot reliably read or move files.

It sits in **OpenShift Platform**, in the **Operations** lane (OpenShift).

## What SEI specifies

**SEI covers the need and answers it differently.** SEI needs one specific thing from storage and states it as an assumption: Landing, Archive and Quarantine must be shared across worker pods, or mapped tasks cannot reliably read or move files.

### S3 — Landing Zone

Shared storage that Airflow scans for eligible files. Shared is load-bearing too — every worker pod has to see the same Landing, Archive and Quarantine folders.

- **Technology.** shared storage
- **Source.** ingest Glossary (p.25) · §2.1 (p.5)

## Still open with SEI

SEI's own ids, so they can be quoted straight back.

- **O1.** Confirm Landing Zone, Archive and Quarantine details.

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
