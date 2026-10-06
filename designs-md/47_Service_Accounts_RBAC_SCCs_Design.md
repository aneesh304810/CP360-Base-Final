---
cp360_type: design_document
component_id: 47
component_name: Service Accounts, RBAC, SCCs
zone: 4. OpenShift
plane: Platform
priority: P1
technology: Infra
custom_build: None
depends_on: [32]
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

# Service Accounts, RBAC, SCCs

## What this component is

Named, and narrowly: least privilege, and DML only on the Gold tables.

It sits in **OpenShift Platform**, in the **Operations** lane (OpenShift).

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

## Gaps and decisions that land here

From the consolidated gap supplement and the CP-Integration-Gateway
readiness review. These arrived after the SEI baseline and in several
places disagree with it; where they do, both readings are given and
neither is silently adopted.

### Gap register

| Gap | What is missing | Required disposition |
|---|---|---|
| `GAP-04` | OpenShift is named but not designed as a platform domain | Add runtime topology, deployment, secret, storage, scaling, CI/CD and operations contracts |

### Against what this design already says

#### New — Graceful degradation has four named behaviours

- **The supplement says.** Oracle unavailable: do not claim or advance durable state. Splunk or Integration360 unavailable: follow the buffering policy, never silently discard required evidence. SEI APIs unavailable: workflow state stays queryable, retry reuses the same correlation and idempotency keys. CP360 UI unavailable: durable state remains in Oracle and Airflow.
- **This design holds.** Nothing on partial failure of a dependency.
- **What it costs to leave open.** The third one is the sharp one: evidence silently discarded during a Splunk outage is indistinguishable afterwards from evidence that was never produced.
- **Decision.** `DEC-GAP-08`

#### New — HA and DR establish no numbers at all

- **The supplement says.** Seven items to finalise, and the supplement states plainly that no numerical RTO or RPO is established and that values require formal BBH approval.
- **This design holds.** Nothing on availability, failover or recovery objectives.
- **What it costs to leave open.** Production readiness has a named precondition that is not started. It is honest about being unstarted, which is better than a number nobody agreed.
- **Decision.** `DEC-GAP-09`

#### New — Starvation has a second cause: the gateway does not scale yet

- **The supplement says.** HorizontalPodAutoscaler comes 'after load behaviour is validated', and PodDisruptionBudget and NetworkPolicy are listed as required but not yet in place (GW-GAP-06, GW-RISK-06).
- **This design holds.** The shared-quota risk assumes the gateway itself keeps up and only the SEI quota is contended.
- **What it costs to leave open.** A bursty set-based pull, a loader window and interactive reads share a service with no autoscaling and no disruption budget. The queue forms before the quota is reached.
- **Decision.** `GW-GAP-06`

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand. Correct the
model and every document that used it is corrected with it:
`node tools/export_design_model.mjs && python3 tools/gen_design_docs.py`
