---
cp360_type: design_document
component_id: 32
component_name: Security & Access Control
zone: 2. Hub
plane: Foundation
priority: P1
technology: Infra
custom_build: Low
depends_on: [47, 48]
status: Not Started
owner: TBD
architecture_decisions: []
pipeline_tiers: [Stage1-Oracle, Stage2-Oracle, Stage3-Exadata-Gold, Consumer-Movement]
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, foundation, nydfs]
origin: SEI-BBH component tracker
sei_coverage: partial
gap_owner: SEI
in_scope: true
generated: true
sei_status: specified
architecture_domain: Foundation
canonical_tier: not on the stage chain
control_entities: [FILE_SCHEMA_CONFIG, FILE_REGISTRY, DATE_CONTROL, DQ_VALIDATION_FAILURE, RECON_RESULT]
traceability_identifiers: [PROJECT_ID, FILE_ID, LOAD_ID, BUSINESS_DATE, CORRELATION_ID]
supplement: CP360-GAP-DESIGN-SUPPLEMENT
---

# Security & Access Control

## What this component is

Credentials in OpenShift secrets, and the loader account holds only the DML it needs — no ALTER, DROP or CREATE.

It sits in **Foundation**, in the **Security and access** lane (OpenShift · Oracle).

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
| `GAP-05` | Foundation services are spread across many documents | Add a canonical control, metadata, evidence, audit, security, observability and lineage model |
| `GAP-09` | Identifiers are inconsistent across components | Add canonical traceability identifiers and propagation rules |
| `GAP-11` | Logical relationships among control and processing entities are not consolidated | Add logical ERDs |

### Against what this design already says

#### Conflict — Three different counts of reconciliation boundaries

- **The supplement says.** Seven boundaries, including Stage 2 to Stage 3 and publish to consumer acknowledgement.
- **This design holds.** The pack specifies three. The architect review recommends twelve under an event-primary posture.
- **What it costs to leave open.** Nobody can say whether reconciliation is complete, because complete is three, seven or twelve depending on which document is open.
- **Decision.** `none raised - worth one`

#### Closes a gap — The outbound submission registry now has a design

- **The supplement says.** WORKFLOW_DEFINITION to WORKFLOW_INSTANCE to LOADER_DELIVERY and API_CALL, each reporting STATUS_EVENT.
- **This design holds.** The loader loop screen says there is no outbound equivalent of FILE_REGISTRY, so a reject count has nothing to reconcile against and a batch that never comes back never ages out.
- **What it costs to leave open.** Closed, if the ERD is approved. LOADER_DELIVERY plus STATUS_EVENT is the registry that was missing.

#### Closes a gap — Stage 2 to Stage 3 movement has a pattern and a gate

- **The supplement says.** Database-link or direct-path movement preserving LOAD_ID and BUSINESS_DATE, with a reconciliation gate that authorises or holds the publish scope, and a replay boundary scoped by date and load.
- **This design holds.** The database picture has no movement component at all - Pre-Gold simply follows DIM and FACT with nothing in between.
- **What it costs to leave open.** Closed in design. Still needs DEC-GAP-04 to pick the mechanism.
- **Decision.** `DEC-GAP-04`

#### New — LOAD_ID is missing from every model we draw

- **The supplement says.** LOAD_ID is the identifier preserved from RAW through Stage 2, Stage 3, replay and publish evidence, and acceptance criterion 4 depends on it.
- **This design holds.** Stage 1 adds BUSINESS_DATE, SRC_RECORD_ID, FILE_REGISTRY_ID and LOAD_TS. Stage 2's standard columns add MICRO_BATCH_ID and DBT_INVOCATION_ID. Neither carries LOAD_ID.
- **What it costs to leave open.** Without it there is no single identifier for one load execution across four tiers, and the Stage 2 to Stage 3 reconciliation gate has nothing to key on. This is a hole in our own model, not in theirs.
- **Decision.** `SILVER-DEC-04`

#### New — Three foundation entities with no table anywhere

- **The supplement says.** Workflow metadata, API configuration and a schema registry are named as control and metadata entities.
- **This design holds.** The database model holds five control tables. None of these three is among them, and nothing else in the corpus defines them.
- **What it costs to leave open.** The outbound path is configuration-driven by design and has no configuration store. Schema registry ownership is DEC-GAP-07 and unassigned.
- **Decision.** `DEC-GAP-07`

#### New — Graceful degradation has four named behaviours

- **The supplement says.** Oracle unavailable: do not claim or advance durable state. Splunk or Integration360 unavailable: follow the buffering policy, never silently discard required evidence. SEI APIs unavailable: workflow state stays queryable, retry reuses the same correlation and idempotency keys. CP360 UI unavailable: durable state remains in Oracle and Airflow.
- **This design holds.** Nothing on partial failure of a dependency.
- **What it costs to leave open.** The third one is the sharp one: evidence silently discarded during a Splunk outage is indistinguishable afterwards from evidence that was never produced.
- **Decision.** `DEC-GAP-08`

#### Closes a gap — The correlation identifier now has an owner and a rule

- **The supplement says.** The gateway validates a trusted incoming correlation value or generates one, and propagates it to outbound calls, logs, metrics and traces.
- **This design holds.** Both the loader loop and the boundary screen ask for a correlation id minted at the gateway and carried through, and name it as not yet owned.
- **What it costs to leave open.** Closed. The gateway owns minting and propagation, which is the answer both screens were asking for.

#### New — Rotate anything that may have been exposed - including ours

- **The supplement says.** GW-RISK-02 requires rotation evidence and clean repository and pipeline scans for any credential that may previously have been exposed.
- **This design holds.** This repository carried a plaintext Oracle password in local/load-all.ps1 across more than one commit. The working tree no longer has it; the history still does, and nothing has been rotated.
- **What it costs to leave open.** The gateway review sets the standard and this repository does not meet it. Rotation and a history rewrite are both still open, and this has been flagged more than once.
- **Decision.** `GW-RISK-02`

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand. Correct the
model and every document that used it is corrected with it:
`node tools/export_design_model.mjs && python3 tools/gen_design_docs.py`
