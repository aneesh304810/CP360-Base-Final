---
cp360_type: design_document
component_id: 35
component_name: Integration360
zone: 2. Hub
plane: Foundation
priority: P1
technology: Vendor/BBH
custom_build: Medium
depends_on: [7, 30]
status: Not Started
owner: TBD
origin: SEI-BBH component tracker
sei_coverage: absent
gap_owner: BBH
in_scope: true
generated: true
sei_status: absent
architecture_domain: Foundation
canonical_tier: not on the stage chain
control_entities: [FILE_SCHEMA_CONFIG, FILE_REGISTRY, DATE_CONTROL, DQ_VALIDATION_FAILURE, RECON_RESULT]
traceability_identifiers: [PROJECT_ID, FILE_ID, LOAD_ID, BUSINESS_DATE, CORRELATION_ID]
supplement: CP360-GAP-DESIGN-SUPPLEMENT
---

# Integration360

## What this component is

This catalogue. SEI gives all reporting to Splunk, so 360 reading the same tables directly is BBH's addition — defensible, and nobody has written down who owns which.

It sits in **Foundation**, in the **Evidence and observability** lane (Splunk · 360).

## What SEI specifies

**Nothing.** Neither SEI design document covers this component.

This catalogue. SEI gives all reporting to Splunk, so 360 reading the same tables directly is BBH's addition — defensible, and nobody has written down who owns which.

That is not a judgement on whether it is needed. It means no
design exists to build from, and writing one is BBH's to do and
SEI's to confirm.

## Where SEI's documents disagree about this

Each one is a decision to take before a model is written.

### C2 — Stage 2 as five tables, or as STG plus INT

- **The architecture says.** Five STG2_* tables, materialised as tables, full refresh daily or incremental.
- **The design documents say.** A STG view that stores nothing, plus an INT table kept seven days and partitioned.
- **Why it matters.** Not a naming difference. One stores Stage 2 and one does not, and the retention, the replay window and the reconciliation boundaries all follow from which it is.

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
