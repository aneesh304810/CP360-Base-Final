---
cp360_type: design_document
component_id: 61
component_name: Blue-Green / Canary (API lane)
zone: 4. OpenShift
plane: Deployment
priority: P3
technology: Infra
custom_build: None
depends_on: [12]
status: Not Started
owner: TBD
origin: SEI-BBH component tracker
sei_coverage: unassessed
gap_owner: unassessed
in_scope: true
generated: true
sei_status: absent
architecture_domain: OpenShift Platform
canonical_tier: not on the stage chain
control_entities: []
traceability_identifiers: []
supplement: CP360-GAP-DESIGN-SUPPLEMENT
---

# Blue-Green / Canary (API lane)

## What this component is

Blue-green and canary for the API lane, which neither document has.

It sits in **OpenShift Platform**, in the **Operations** lane (OpenShift).

## What SEI specifies

**Nothing.** Neither SEI design document covers this component.

Blue-green and canary for the API lane, which neither document has.

That is not a judgement on whether it is needed. It means no
design exists to build from, and writing one is BBH's to do and
SEI's to confirm.

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
