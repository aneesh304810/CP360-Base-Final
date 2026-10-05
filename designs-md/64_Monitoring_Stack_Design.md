---
cp360_type: design_document
component_id: 64
component_name: Monitoring Stack
zone: 4. OpenShift
plane: Operations
priority: P2
technology: Infra
custom_build: Low
depends_on: [34]
status: Not Started
owner: TBD
origin: SEI-BBH component tracker
sei_coverage: unassessed
gap_owner: unassessed
in_scope: true
generated: true
sei_status: differs
generated: true
sei_status: differs
generated: true
sei_status: differs
---

# Monitoring Stack

## What this component is

SEI gives every dashboard, trend and alert to Splunk. A separate monitoring stack is a second place for the same job.

## What SEI specifies

**SEI covers the need and answers it differently.** SEI gives every dashboard, trend and alert to Splunk. A separate monitoring stack is a second place for the same job.

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

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand. Correct the
model and every document that used it is corrected with it:
`node tools/export_design_model.mjs && python3 tools/gen_design_docs.py`
