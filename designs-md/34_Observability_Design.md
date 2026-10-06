---
cp360_type: design_document
component_id: 34
component_name: Observability
zone: 2. Hub
plane: Foundation
priority: P2
technology: Infra
custom_build: Low
depends_on: [64]
status: Not Started
owner: TBD
architecture_decisions: []
pipeline_tiers: [Stage1-Oracle, Stage2-Oracle, Stage3-Exadata-Gold, Consumer-Movement]
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, foundation, splunk, cp360]
origin: SEI-BBH component tracker
sei_coverage: partial
gap_owner: Joint
in_scope: true
generated: true
sei_status: specified
architecture_domain: Foundation
canonical_tier: not on the stage chain
control_entities: [FILE_SCHEMA_CONFIG, FILE_REGISTRY, DATE_CONTROL, DQ_VALIDATION_FAILURE, RECON_RESULT]
traceability_identifiers: [PROJECT_ID, FILE_ID, LOAD_ID, BUSINESS_DATE, CORRELATION_ID]
supplement: CP360-GAP-DESIGN-SUPPLEMENT
---

# Observability

## What this component is

Owns all dashboards, counts, trending and alerting, for both documents. Oracle keeps the durable logs; Splunk reports from the events published to it and does the alert correlation.

It sits in **Foundation**, in the **Evidence and observability** lane (Splunk · 360).

## What SEI specifies

### S21 — Splunk

Owns all dashboards, counts, trending and alerting, for both documents. Oracle keeps the durable logs; Splunk reports from the events published to it and does the alert correlation.

- **Technology.** SEI/BBH
- **Source.** ingest §8.1 (p.15) · dbt §4.2 (p.10)

## The Oracle objects it touches

No foreign key is declared in either document. Every join below
is one a model runs, not a constraint the database enforces.

| Object | What it holds | Source |
|---|---|---|
| `DQ_VALIDATION_FAILURE` | One store for both failure categories, carrying whether the row can replay itself and whether it is still open. | dbt §7.1 (p.17) |
| `RECON_RESULT` | One immutable row per boundary per business date, replaced rather than updated. No status column — the verdict is derived in Splunk. | dbt §7.2.1 (p.18) |

## What happens when it goes wrong

| # | Scenario | What the design does | Source |
|---|---|---|---|
| X38 | Publishing to Splunk fails | The data is already durable in Oracle. The publish task is separate and retryable, and it is idempotent per date. | dbt §8.3 (p.21) |

## Still open with SEI

SEI's own ids, so they can be quoted straight back.

- **D6.** Approve the Splunk event schema, masking and PII rules, dashboards and alert thresholds.
- **O4.** Confirm Splunk integration, indexing, event format, alert ownership and routing.
- **O7.** Confirm the Splunk correlation key, severity, alert routing and recovery handling.

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
