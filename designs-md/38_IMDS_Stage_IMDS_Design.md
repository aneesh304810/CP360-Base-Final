---
cp360_type: design_document
component_id: 38
component_name: IMDS Stage -> IMDS
zone: 3. Consumers
plane: Consumers
priority: P2
technology: Oracle DDL + dbt
custom_build: Medium
depends_on: [15]
status: Not Started
owner: TBD
origin: SEI-BBH component tracker
sei_coverage: unassessed
gap_owner: unassessed
in_scope: true
---

# IMDS Stage -> IMDS

## 1. Purpose & Scope

**Staging DB + load design from Stage 2**

Scope as recorded in the component tracker: New staging schema + load models..

**Custom build: Medium.** Configuration and glue over an existing capability. The risk is not writing it; it is that the configuration lives in code rather than in the metadata store, where it cannot be changed without a release.

**Where it sits.** Zone 3 · Gold consumers. These read Gold; they do not participate in the pipeline. The build work is a **published consumer contract** per consumer. And there is a decision here that has already been made implicitly and never communicated: adopting events means Gold changes during the day.

## 2. Context & Dependencies

- **Upstream** — depends on #15 Stage 2 Enriched (dbt)
- Technology: Oracle DDL + dbt
- Custom build: Medium — High means a design document is mandatory before code.
- Source of record: SEI v5 only
- **After publication.** It reads Gold and does not participate in the gate.

## 3. Design Decisions

No review finding against this component: the events-primary substitution does not change what it does. The design decisions that remain are build decisions. These read Gold; they do not participate in the pipeline. The build work is a **published consumer contract** per consumer. And there is a decision here that has already been made implicitly and never communicated: adopting events means Gold changes during the day.

## 4. Detailed Design

**Deliverable.** Staging DB + load design from Stage 2

### Implementation — Zone 3 · Gold consumers

These read Gold; they do not participate in the pipeline. The build work is a **published consumer contract** per consumer. And there is a decision here that has already been made implicitly and never communicated: adopting events means Gold changes during the day.

| Concern | How to build it |
| --- | --- |
| **Freshness contract** | State per consumer whether it reads an EOD-stable Gold or a Gold that moves intraday. Under the file model this question did not exist, because Gold changed once a night. |
| **Read grain and interface** | Direct table read, a view, or an extract. A view is the only one of the three that lets the physical model change without a consumer release. |
| **Publication signal** | How a consumer knows a business date is complete and safe to read. `DATE_CONTROL` reaching COMPLETE is the natural signal, and nothing currently publishes it outward. |
| **Access** | A read-only role per consumer with SELECT on the Gold objects only. A12 grants the loader DML and describes no consumer grant at all. |
| **Backward compatibility** | Gold runs `on_schema_change='fail'`, so a column addition is already a controlled event. Say which consumers must be notified and with what lead time. |

## 5. Data Quality, Reconciliation & Lineage

No DQ or reconciliation obligation specific to this component. Two estate rules bind it: anything derived stores the input it was derived from — the threshold in force, the ruleset version, the counts — so a verdict can be reproduced months later; and an unknown value raises rather than being mapped to its nearest neighbour.

## 6. Performance & Scale

No ranked bottleneck touches this component. The estate rule still binds it: bound anything that fans out — pods per micro-batch, connections per pod, retries per work item, calls per poll window. Every unbounded fan-out in this design eventually lands on the same Oracle.

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

No review finding: the events-primary substitution does not change what this component does. What is missing is build detail rather than design. These read Gold; they do not participate in the pipeline. The build work is a **published consumer contract** per consumer. And there is a decision here that has already been made implicitly and never communicated: adopting events means Gold changes during the day.

### Risk

No ranked bottleneck or unowned error path touches this component.

### Not specified — and what to do until it is

**Whether consumers expect Gold to be stable during the business day.** This is the important one. Intraday event ingestion means DIM and FACT can change between two reads on the same day. A consumer that reconciles a report at 11am and again at 4pm will get two answers and will report it as a defect.

  *Recommended default:* Decide explicitly and publish it. If consumers need stability, Gold needs a published snapshot per business date and the intraday writes land somewhere they do not read. That is an architectural change, not a configuration one, and it is far cheaper to decide now.

**Which consumers are in scope for phase 1.** PBDW, IMDS and Pivotal are named as Final Gold consumers; BI, real-time consumers and existing BBH systems are listed without scope.

  *Recommended default:* Scope them explicitly. A consumer discovered late is a schema commitment made late.

### Gap against the SEI pack

No absent-coverage citation recorded.

## 11. Recommendation

No component-specific change is recommended: the review found nothing wrong with what this component does. The recommendation below is about how it should be built.

**Zone 3 · Gold consumers.** Publish a one-page contract per consumer covering freshness, grain, interface, access and notification. The intraday-stability question should be answered before any of them are written, because it changes what the contract can promise.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **From the tracker.** Missing from BBH deck - confirm it exists
- **Whether consumers expect Gold to be stable during the business day** — unanswered. Until it is: Decide explicitly and publish it. If consumers need stability, Gold needs a published snapshot per business date and the intraday writes land somewhere they do not read. That is an architectural change, not a configuration one, and it is far cheaper to decide now.
- **Which consumers are in scope for phase 1** — unanswered. Until it is: Scope them explicitly. A consumer discovered late is a schema commitment made late.

### Acceptance criteria

- The deliverable above exists and is reviewed.
