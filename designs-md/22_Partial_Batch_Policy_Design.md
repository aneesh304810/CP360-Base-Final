---
cp360_type: design_document
component_id: 22
component_name: Partial-Batch Policy
zone: 2. Hub
plane: Orchestration
priority: P1
technology: Airflow
custom_build: Medium
depends_on: [18, 23]
status: Not Started
owner: TBD
architecture_decisions: [AD-9]
pipeline_tiers: [Consumer-Movement]
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, orchestration]
origin: SEI-BBH component tracker
sei_coverage: partial
gap_owner: Joint
in_scope: true
---

# Partial-Batch Policy

## 1. Purpose & Scope

**Policy + implementation: halt-all vs per-domain proceed**

Scope as recorded in the component tracker: Custom branching + trigger rules. Publish-completeness marker per domain..

**Custom build: Medium.** Configuration and glue over an existing capability. The risk is not writing it; it is that the configuration lives in code rather than in the metadata store, where it cannot be changed without a release.

**Where it sits.** Hub · orchestration. C.1's three-task DAG is careful and complete for one daily cycle. It assumes a discrete moment when everything has arrived, and events never produce one. Do not extend the daily DAG to run 288 times; separate the clocks.

## 2. Context & Dependencies

- **Upstream** — depends on #18 Airflow DAG + Per-Domain Fan-out, #23 G1 File / Structural Gate
- Technology: Airflow
- Custom build: Medium — High means a design document is mandatory before code.
- Source of record: NEW

### The Orchestration plane

**What the pack has.** C.1 specifies the DAG well: three tasks, dynamic task mapping, a deterministic run id, a guarded PENDING to TRIGGER transition, and dim-before-fact with hold-and-replay. For one daily file cycle this is a complete and careful design.

**What it does not.** It assumes a discrete 'everything has arrived' moment. Events never produce one. There is no intraday cadence model, no intraday SLA, no gate that works without interfaces to count, no partial-view policy inside a micro-batch, and no poller for the return leg. Replay is worse than missing — it is specified in terms the event path cannot honour.

**Plane verdict:** 2 of 7 specified · 2 partly · 3 absent.

## 3. Design Decisions

**Review verdict: gap.** Sets policy for partial file batches. Silent on partial view failure inside a micro-batch, which is the equivalent case and the more frequent one.

**Direction.** Safe default is roll back whole; useful default is not. Somebody has to choose, and the choice belongs in this component.

## 4. Detailed Design

**Deliverable.** Policy + implementation: halt-all vs per-domain proceed

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

No ranked bottleneck touches this component. The estate rule still binds it: bound anything that fans out — pods per micro-batch, connections per pod, retries per work item, calls per poll window. Every unbounded fan-out in this design eventually lands on the same Oracle.

## 7. Error Handling, Failure & Replay

### E6 · Partial micro-batch failure across views (high)

If three of five views pull successfully and the fourth times out, is the micro-batch FAILED and rolled back whole, or PARTIAL and advanced? Component 22 sets a partial-batch policy for files and says nothing about views inside a box.

**Who owns it today.** Unowned. The safe default is roll back whole; the useful default is not, and somebody has to choose.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

### Estate conventions this component inherits

- **Configuration, not code.** Thresholds, mappings, calendars and status vocabularies live in tables and are read at run time. An unknown value raises; it is never mapped to its nearest neighbour or defaulted silently.
- **Reproducible verdicts.** Anything derived stores the input it was derived from — the threshold in force, the ruleset version, the counts. A verdict that cannot be reproduced three months later cannot be defended.
- **Bound everything that fans out.** Pods per micro-batch, connections per pod, retries per work item, calls per poll window. Every unbounded fan-out in this design eventually lands on the same Oracle.
- **Write then acknowledge.** Durable write first, then commit the offset or return the 202. The reverse order loses data silently in both the event path and the callback path.
- **Absence is a state.** NOT_RUN, STATUS_UNRESOLVED and 'no partition count known' are values to record, not gaps to infer. Most of the silent failure modes in this estate come from treating an empty result as a healthy one.

## 9. SEI Source Coverage

**SEI pack coverage: partial** — partly specified — named, not sufficient.
**Who answers for the gap: Joint** — needs both sides.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | §C.4 | touches it, does not specify it | Discovery guardrails and partial-batch behaviour for files. Silent on partial view failure inside a micro-batch, which is the equivalent case and the more frequent one. |

## 10. Gaps, Risks & What Is Missing

### What is missing

Sets policy for partial file batches. Silent on partial view failure inside a micro-batch, which is the equivalent case and the more frequent one.

### Risk

- **HIGH · error path (E6).** Partial micro-batch failure across views.

### Not specified — and what to do until it is

**How transform__<BUSINESS_DATE> and restatement both hold.** The run already exists and succeeded, so Airflow refuses a second one, and C.1's reconciliation path fires only when no matching run exists — the opposite case. As written the run-id rule and the recovery procedure contradict each other.

  *Recommended default:* Restatement runs as a separate DAG with its own run id, which is how they coexist today. Say so explicitly in the document; the contradiction is only resolved by a convention nobody wrote down.

**Whether there is an intraday SLA at all.** The pack's only clock is the EOD cutoff. Without an intraday definition of 'behind', a micro-batch that failed at 11am is not late, only absent, and nothing escalates.

  *Recommended default:* Derive lateness from the stream's own rhythm — a rolling baseline of the inter-micro-batch interval — rather than waiting for a calendar nobody will write.

### Gap against the SEI pack

No absent-coverage citation recorded.

## 11. Recommendation

Safe default is roll back whole; useful default is not. Somebody has to choose, and the choice belongs in this component.

**Action.** E6.

**Hub · orchestration.** Answer the run-id contradiction before anything else on this plane is built. Every recovery procedure in the pack depends on a mechanism that cannot currently execute.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For both sides.** The policy covers partial file batches. What is the policy when three of five views pull successfully inside one micro-batch and the fourth times out?
- **From the tracker.** Can consumers tolerate a partial business date? (AD-5)
- **How transform__<BUSINESS_DATE> and restatement both hold** — unanswered. Until it is: Restatement runs as a separate DAG with its own run id, which is how they coexist today. Say so explicitly in the document; the contradiction is only resolved by a convention nobody wrote down.
- **Whether there is an intraday SLA at all** — unanswered. Until it is: Derive lateness from the stream's own rhythm — a rolling baseline of the inter-micro-batch interval — rather than waiting for a calendar nobody will write.

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
- Each unowned error path above has a named owner and a disposition in `ERROR_CATALOG`.
