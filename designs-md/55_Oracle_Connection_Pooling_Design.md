---
cp360_type: design_document
component_id: 55
component_name: Oracle Connection Pooling
zone: 4. OpenShift
plane: Runtime
priority: P1
technology: Python + Infra
custom_build: Medium
depends_on: [13, 52]
status: Not Started
owner: TBD
origin: SEI-BBH component tracker
sei_coverage: absent
gap_owner: BBH
in_scope: true
generated: true
sei_status: specified
architecture_domain: OpenShift Platform
canonical_tier: not on the stage chain
control_entities: []
traceability_identifiers: []
supplement: CP360-GAP-DESIGN-SUPPLEMENT
---

# Oracle Connection Pooling

## What this component is

Pool size is sized against Oracle connection capacity, and the document says the number is a starting position to confirm.

It sits in **OpenShift Platform**, in the **Operations** lane (OpenShift).

## What SEI specifies

### S7 — Mapped file task (one per file)

Airflow creates one task per discovered file at run time, so files process independently and in parallel within the pool and Oracle connection limits. A file never waits for another interface.

- **Technology.** Dynamic Task Mapping
- **Source.** ingest §5 (p.9) · Appendix C.1 (p.21)

## The Oracle objects it touches

No foreign key is declared in either document. Every join below
is one a model runs, not a constraint the database enforces.

| Object | What it holds | Source |
|---|---|---|
| `FILE_REGISTRY` | The lifecycle record per logical interface and business date. It is what makes repeated discovery safe, and ARCHIVED on it is what completeness counts. | ingest Appendix B (p.19) · §6.2 (p.12) |
| `RAW tables` | Bronze. Validated detail rows as delivered, tagged with the business date and lineage. The dbt document names three: account, client and transaction. | ingest Glossary (p.25) · dbt §4.1 (p.10) |

## What happens when it goes wrong

| # | Scenario | What the design does | Source |
|---|---|---|---|
| X8 | The same file is discovered again | If the existing record is ARCHIVED it is skipped and logged as a duplicate; no second registry row is created. A unique key on the interface and business date enforces it. | ingest §5 (p.9) · Appendix B (p.19) |
| X9 | A record is stuck in RECEIVED, VALIDATED or LOADING | Investigated, never reset automatically. The Airflow task state, the worker logs, the file location and the Oracle outcome are checked first, and the same record is reused for recovery. | ingest Appendix D.5 (p.23) |

## Still open with SEI

SEI's own ids, so they can be quoted straight back.

- **O2.** Confirm batch SLA, peak timing, representative file sizes and the Oracle connection envelope.

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
