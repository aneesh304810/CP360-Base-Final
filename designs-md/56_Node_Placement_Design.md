---
cp360_type: design_document
component_id: 56
component_name: Node Placement
zone: 4. OpenShift
plane: Runtime
priority: P2
technology: Infra
custom_build: None
depends_on: [12, 52]
status: Not Started
owner: TBD
origin: SEI-BBH component tracker
sei_coverage: unassessed
gap_owner: unassessed
in_scope: true
---

# Node Placement

## 1. Purpose & Scope

**Taints/affinity: batch burst vs always-on API**

Scope as recorded in the component tracker: Scheduling config..

**Custom build: None.** Nothing is built here. The deliverable is a contract, a configuration entry or a review, and treating it as build work is how it ends up unowned.

**Where it sits.** OpenShift · runtime. This plane carries the whole cost of the events substitution. Moving from about one DAG run a day to 288, each with per-domain dynamic task mapping, multiplies task instances by two to three orders of magnitude. Nothing in the SEI pack has costed the scheduler itself.

## 2. Context & Dependencies

- **Upstream** — depends on #12 API Gateway / Data Plane, #52 Worker Pod Autoscaling
- Technology: Infra
- Custom build: None — High means a design document is mandatory before code.
- Source of record: NEW

## 3. Design Decisions

No review finding against this component: the events-primary substitution does not change what it does. The design decisions that remain are build decisions. This plane carries the whole cost of the events substitution. Moving from about one DAG run a day to 288, each with per-domain dynamic task mapping, multiplies task instances by two to three orders of magnitude. Nothing in the SEI pack has costed the scheduler itself.

## 4. Detailed Design

**Deliverable.** Taints/affinity: batch burst vs always-on API

### Implementation — OpenShift · runtime

This plane carries the whole cost of the events substitution. Moving from about one DAG run a day to 288, each with per-domain dynamic task mapping, multiplies task instances by two to three orders of magnitude. Nothing in the SEI pack has costed the scheduler itself.

| Concern | How to build it |
| --- | --- |
| **Scheduler sizing** | Airflow's scheduler polls its metadata database continuously with SELECT FOR UPDATE. Size the scheduler and that database for the new task rate before build, not after the first slow morning. |
| **Metadata retention** | At roughly 300x the task volume, `task_instance` and `dag_run` become the largest tables in the estate within weeks. Set an aggressive retention and run the cleanup as a scheduled DAG. |
| **Worker autoscaling** | Scale on queued task count, not CPU. CPU is flat while pods wait on Oracle, so a CPU-based policy scales down exactly when the backlog is growing. |
| **Warm start** | Pod start time is now a budget line. A 40-second image pull inside a 300-second cadence is 13% of the cycle spent before any work begins. Pre-pull images to every node and keep a warm pool sized to the median micro-batch. |
| **Connection pooling** | Bound the pool per pod **and** the pod count per micro-batch. Dynamic task mapping spawns a pod per work item and each opens its own connections; an unbounded fan-out against a shared Oracle is how one pipeline takes down another team's service. |
| **Node placement** | Keep the listener off the nodes that absorb the batch fan-out. It is the one workload whose restart loses ordering position, so it should not be the one evicted when the batch spikes. |

## 5. Data Quality, Reconciliation & Lineage

No DQ or reconciliation obligation specific to this component. Two estate rules bind it: anything derived stores the input it was derived from — the threshold in force, the ruleset version, the counts — so a verdict can be reproduced months later; and an unknown value raises rather than being mapped to its nearest neighbour.

## 6. Performance & Scale

Sizing is unresolved because micro-batch cadence and volume are both unstated. Instrument the ratio of micro-batch duration to cadence interval and treat 0.7 as the ceiling — above it there is no recovery headroom left and a small latency regression becomes an unbounded backlog.

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

**Not assessed against the SEI pack.** No citation has been mapped for this component, which is a gap in the review rather than a statement that the pack covers it. Assessing it means one pass: find the section that governs it, record whether that section specifies it, partly touches it or is silent, and name who answers for the difference. That is a four-line entry in `ui/src/seiCitations.js` and it is what turns an assertion into something that can be put in front of SEI beside the page.

No citation recorded. Either this is BBH platform work the pack was never going to cover, or the mapping has not been written yet.

## 10. Gaps, Risks & What Is Missing

### What is missing

No review finding: the events-primary substitution does not change what this component does. What is missing is build detail rather than design. This plane carries the whole cost of the events substitution. Moving from about one DAG run a day to 288, each with per-domain dynamic task mapping, multiplies task instances by two to three orders of magnitude. Nothing in the SEI pack has costed the scheduler itself.

### Risk

No ranked bottleneck or unowned error path touches this component.

### Not specified — and what to do until it is

**Micro-batch cadence and the volume inside one.** Everything on this plane is sized from those two numbers and neither is stated. Five minutes is the file-discovery interval, not a confirmed event cadence.

  *Recommended default:* Do not size on an assumed cadence. Instrument the ratio of micro-batch duration to cadence interval and treat 0.7 as the ceiling — above it the system has no recovery headroom and a small latency regression becomes an unbounded backlog.

**Whether 288 scheduled DAG runs is the right shape at all.** A long-running consumer with an internal loop would avoid the scheduler multiplication entirely, at the cost of losing Airflow's retry and observability for the ingest leg.

  *Recommended default:* Prototype both before committing. The decision is cheap now and structural later. Our recommendation is a long-running consumer for intraday ingest and the existing DAG for the EOD transformation, meeting at the gate.

### Gap against the SEI pack

No absent-coverage citation recorded.

## 11. Recommendation

No component-specific change is recommended: the review found nothing wrong with what this component does. The recommendation below is about how it should be built.

**OpenShift · runtime.** Treat the intraday path and the EOD path as two runtimes that share a database, not one runtime that runs more often. Every problem on this plane comes from stretching a daily batch shape across a continuous workload.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **From the tracker.** Dedicated nodes for the real-time lane?
- **Micro-batch cadence and the volume inside one** — unanswered. Until it is: Do not size on an assumed cadence. Instrument the ratio of micro-batch duration to cadence interval and treat 0.7 as the ceiling — above it the system has no recovery headroom and a small latency regression becomes an unbounded backlog.
- **Whether 288 scheduled DAG runs is the right shape at all** — unanswered. Until it is: Prototype both before committing. The decision is cheap now and structural later. Our recommendation is a long-running consumer for intraday ingest and the existing DAG for the EOD transformation, meeting at the gate.

### Acceptance criteria

- The deliverable above exists and is reviewed.
