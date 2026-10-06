---
cp360_type: design_document
component_id: 52
component_name: Worker Pod Autoscaling
zone: 4. OpenShift
plane: Runtime
priority: P1
technology: Infra
custom_build: Low
depends_on: [18, 55]
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

# Worker Pod Autoscaling

## What this component is

Worker pods are how file-level concurrency scales, bounded by pools and Oracle connections.

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
