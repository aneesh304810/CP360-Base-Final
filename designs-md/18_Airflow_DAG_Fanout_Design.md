---
cp360_type: design_document
component_id: 18
component_name: Airflow DAG + Per-Domain Fan-out
zone: 2. Hub
plane: Orchestration
priority: P1
technology: Airflow
custom_build: High
depends_on: [9, 51, 52]
status: Not Started
owner: TBD
architecture_decisions: [AD-4, AD-5, AD-9, AD-1]
pipeline_tiers: [Stage1-Oracle, Stage2-Oracle, Stage3-Exadata-Gold, Consumer-Movement]
last_updated: 2026-08-10
tags: [SEI-BBH, Integration-Hub, hub, orchestration, airflow]
origin: SEI-BBH component tracker
sei_coverage: covered
gap_owner: BBH
in_scope: true
---

# Airflow DAG + Per-Domain Fan-out

## 1. Purpose & Scope

**DAG design: 7 parallel branches, join points, retries**

Scope as recorded in the component tracker: Dynamic task mapping over domain config. Not a hand-written static DAG..

**Custom build: High.** A design document is mandatory before code, and this one is that document. High means there is no vendor default to fall back on — every behaviour below is a decision somebody has to make and own.

**Where it sits.** Hub · orchestration. C.1's three-task DAG is careful and complete for one daily cycle. It assumes a discrete moment when everything has arrived, and events never produce one. Do not extend the daily DAG to run 288 times; separate the clocks.

**What breaks if this is wrong.** 5 components depend on it: #9 File Arrival Sensors, #20 Intraday Cadence Control, #22 Partial-Batch Policy, #51 Airflow Deployment, #52 Worker Pod Autoscaling.

## 2. Context & Dependencies

- **Upstream** — depends on #9 File Arrival Sensors, #51 Airflow Deployment, #52 Worker Pod Autoscaling
- **Downstream** — depended on by #9 File Arrival Sensors, #20 Intraday Cadence Control, #22 Partial-Batch Policy, #51 Airflow Deployment, #52 Worker Pod Autoscaling
- Technology: Airflow
- Custom build: High — High means a design document is mandatory before code.
- Source of record: SEI v5 + NEW

### The Orchestration plane

**What the pack has.** C.1 specifies the DAG well: three tasks, dynamic task mapping, a deterministic run id, a guarded PENDING to TRIGGER transition, and dim-before-fact with hold-and-replay. For one daily file cycle this is a complete and careful design.

**What it does not.** It assumes a discrete 'everything has arrived' moment. Events never produce one. There is no intraday cadence model, no intraday SLA, no gate that works without interfaces to count, no partial-view policy inside a micro-batch, and no poller for the return leg. Replay is worse than missing — it is specified in terms the event path cannot honour.

**Plane verdict:** 2 of 7 specified · 2 partly · 3 absent.

## 3. Design Decisions

**Review verdict: bottleneck.** Task volume multiplies by roughly 300× under intraday micro-batches with dynamic task mapping.

**Direction.** C.1's three-task DAG is sound for one daily run. Size the scheduler and its metadata database for 288, or replace scheduled runs with a long-running consumer.

## 4. Detailed Design

**Deliverable.** DAG design: 7 parallel branches, join points, retries

### Implementation — Hub · orchestration

C.1's three-task DAG is careful and complete for one daily cycle. It assumes a discrete moment when everything has arrived, and events never produce one. Do not extend the daily DAG to run 288 times; separate the clocks.

| Concern | How to build it |
| --- | --- |
| **Two runtimes** | A long-running consumer owns the intraday path. The existing DAG owns the EOD transformation. They meet at a gate that requires every micro-batch LOADED plus the marker received. |
| **The gate** | Marker-only gating lets the transformation run on short Stage 1, and STG_TO_INT still reconciles because it ties against a Stage 1 that is itself short. The gate must count micro-batches, not trust a signal. |
| **Conditional ordering** | Only serialise dim-before-fact when the micro-batch actually contains both domains. Paying the ordering cost 288 times for boxes holding one domain is waste. |
| **Bounded retry** | Maximum attempts per work item before quarantine. The replay engine has no limit today, so a permanently failing item retries for ever and consumes capacity every cycle. |
| **Partial-batch policy for views** | The existing policy covers partial file batches. Three of five views pulling successfully inside one micro-batch is the equivalent case and the more frequent one, and it is unowned. |

## 5. Data Quality, Reconciliation & Lineage

No DQ or reconciliation obligation specific to this component. Two estate rules bind it: anything derived stores the input it was derived from — the threshold in force, the ruleset version, the counts — so a verdict can be reproduced months later; and an unknown value raises rather than being mapped to its nearest neighbour.

## 6. Performance & Scale

### B3 · Airflow task volume multiplies by roughly 300× (high)

The scheduler polls its metadata database continuously and uses SELECT FOR UPDATE in its loop. Moving from about one DAG run a day to 288 intraday runs, each with per-domain dynamic task mapping, multiplies task_instance rows by two to three orders of magnitude. Nothing in the pack has costed the scheduler itself.

**What to do.** Size the scheduler and its database for the new task rate before build, set an aggressive metadata retention policy, and consider one long-running consumer rather than 288 scheduled DAG runs.
### B7 · Oracle session concurrency under intraday fan-out (medium)

Connection pooling was sized for a daily per-domain fan-out. Intraday micro-batches multiply concurrent sessions by the cadence, and Airflow dynamic task mapping spawns a worker pod per work item, each opening its own connections.

**What to do.** Bound the pool per pod and the pod count per micro-batch. An unbounded fan-out against a shared Oracle is how one pipeline takes down another team's service.

## 7. Error Handling, Failure & Replay

No unowned error path identified for this component. Two estate conventions still bind it: durable write first, then acknowledge — committing an offset or returning a 202 before the write lands loses data with no trace; and absence is a state to record rather than a gap to infer, which is where most of the silent failures in this estate come from.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

### Estate conventions this component inherits

- **Configuration, not code.** Thresholds, mappings, calendars and status vocabularies live in tables and are read at run time. An unknown value raises; it is never mapped to its nearest neighbour or defaulted silently.
- **Reproducible verdicts.** Anything derived stores the input it was derived from — the threshold in force, the ruleset version, the counts. A verdict that cannot be reproduced three months later cannot be defended.
- **Bound everything that fans out.** Pods per micro-batch, connections per pod, retries per work item, calls per poll window. Every unbounded fan-out in this design eventually lands on the same Oracle.
- **Write then acknowledge.** Durable write first, then commit the offset or return the 202. The reverse order loses data silently in both the event path and the callback path.
- **Absence is a state.** NOT_RUN, STATUS_UNRESOLVED and 'no partition count known' are values to record, not gaps to infer. Most of the silent failure modes in this estate come from treating an empty result as a healthy one.

## 9. SEI Source Coverage

**SEI pack coverage: covered** — specified in the SEI pack.
**Who answers for the gap: BBH** — BBH-owned — do not ask SEI.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | §C.1 | specifies this component | Deterministic transformation run id transform__<BUSINESS_DATE>, plus a scheduled reconciliation path that retries when STATUS='TRIGGER', TRANSFORMATION_DAG_RUN_ID IS NULL and no matching deterministic run exists. |

## 10. Gaps, Risks & What Is Missing

### What is missing

Task volume multiplies by roughly 300× under intraday micro-batches with dynamic task mapping.

### Risk

- **HIGH · performance (B3).** Airflow task volume multiplies by roughly 300×.
- **MEDIUM · performance (B7).** Oracle session concurrency under intraday fan-out.

### Not specified — and what to do until it is

**How transform__<BUSINESS_DATE> and restatement both hold.** The run already exists and succeeded, so Airflow refuses a second one, and C.1's reconciliation path fires only when no matching run exists — the opposite case. As written the run-id rule and the recovery procedure contradict each other.

  *Recommended default:* Restatement runs as a separate DAG with its own run id, which is how they coexist today. Say so explicitly in the document; the contradiction is only resolved by a convention nobody wrote down.

**Whether there is an intraday SLA at all.** The pack's only clock is the EOD cutoff. Without an intraday definition of 'behind', a micro-batch that failed at 11am is not late, only absent, and nothing escalates.

  *Recommended default:* Derive lateness from the stream's own rhythm — a rolling baseline of the inter-micro-batch interval — rather than waiting for a calendar nobody will write.

### Gap against the SEI pack

The pack specifies this component. The gap is not in the documentation.

## 11. Recommendation

C.1's three-task DAG is sound for one daily run. Size the scheduler and its metadata database for 288, or replace scheduled runs with a long-running consumer.

**Action.** B3. Consider a long-running consumer instead of 288 scheduled runs.

**Hub · orchestration.** Answer the run-id contradiction before anything else on this plane is built. Every recovery procedure in the pack depends on a mechanism that cannot currently execute.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **From the tracker.** Where do branches legitimately join?
- **How transform__<BUSINESS_DATE> and restatement both hold** — unanswered. Until it is: Restatement runs as a separate DAG with its own run id, which is how they coexist today. Say so explicitly in the document; the contradiction is only resolved by a convention nobody wrote down.
- **Whether there is an intraday SLA at all** — unanswered. Until it is: Derive lateness from the stream's own rhythm — a rolling baseline of the inter-micro-batch interval — rather than waiting for a calendar nobody will write.

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The bottleneck above has a measured figure at production volume, not an estimate.
