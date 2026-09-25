---
cp360_type: design_document
component_id: 116
component_name: Consumer Lag Monitor
zone: 2. Hub
plane: Event Ingestion
priority: P1
technology: Python · Splunk
custom_build: Low
depends_on: []
status: Not Started
owner: TBD
origin: events-primary architect review
sei_coverage: absent
gap_owner: Joint
in_scope: true
---

# Consumer Lag Monitor

## 1. Purpose & Scope

**Per-partition lag from broker enqueue metadata**

Component 34 Observability predates events and has no lag concept.

This component does not exist in the SEI design pack and has no entry in the original 65-component tracker. It is required by one substituted assumption: **SDC events are the primary ingestion path**, with everything from Stage 1 onward exactly as the pack specifies it.

**Custom build: Low.** Largely platform or vendor capability. The design work is the contract around it — what it guarantees, what it does not, and who is called when it stops.

**Where it sits.** Hub · event ingestion. The chain between SEI publishing and Stage 1 holding rows. None of it exists in any document, all of it is BBH-owned, and it is the path that carries the daily load. Build it as one deployable unit with one owner, not as six components discovered separately.

## 2. Context & Dependencies

- **No recorded dependency either way.** Either it is genuinely standalone, or the tracker's depends_on column was never filled for it — worth confirming, because an unrecorded dependency is the one that surfaces during integration testing.
- Technology: Python · Splunk
- Custom build: Low — High means a design document is mandatory before code.
- Source of record: Architect review — events-primary
- **Before the gate.** Its output is counted by the completeness gate, so a silent failure here makes the business date close on incomplete data.

## 3. Design Decisions

No prior design decisions exist — this component has never been specified.

**Direction.** Lateness on a continuous stream comes from the stream's own rhythm. No expectation table needed if the cadence is stable.

## 4. Detailed Design

**Deliverable.** Per-partition lag from broker enqueue metadata

**Technology.** Python · Splunk

### Implementation — Hub · event ingestion

The chain between SEI publishing and Stage 1 holding rows. None of it exists in any document, all of it is BBH-owned, and it is the path that carries the daily load. Build it as one deployable unit with one owner, not as six components discovered separately.

| Concern | How to build it |
| --- | --- |
| **Process shape** | A long-running consumer, not a scheduled job. Ordering position lives in the consumer's offset, and a process that exits and restarts 288 times a day re-establishes that position 288 times. |
| **Commit discipline** | Durable write, then offset commit. One commit per micro-batch, array insert rather than row-by-row. This is the first wall every event pipeline hits and it arrives early. |
| **Back-pressure** | When the puller falls behind, staging keeps accepting and the pull queue grows. Bound the queue and shed to the next cycle rather than letting one slow view stall the box behind it. |
| **Idempotency** | Two layers, because they catch different things. Offset uniqueness stops a consumer replay; collapsing to a distinct key set per view per micro-batch stops a producer retry, which arrives at a different offset with identical content. |
| **Observability from day one** | enqueued_ts and sequence_number captured at receipt, or lag and gap detection are not computable at all — not harder, not computable. This is the single decision that cannot be retrofitted. |

## 5. Data Quality, Reconciliation & Lineage

No DQ or reconciliation obligation specific to this component. Two estate rules bind it: anything derived stores the input it was derived from — the threshold in force, the ruleset version, the counts — so a verdict can be reproduced months later; and an unknown value raises rather than being mapped to its nearest neighbour.

## 6. Performance & Scale

n/a
### B9 · Splunk ingest volume (medium)

Thirteen operational signals, multiplied by 288 cycles and by domain, is a different order of magnitude from a daily file pipeline. Splunk ingest is metered and rate limited.

**What to do.** Emit per micro-batch only what is actionable; aggregate the rest to a per-cycle or per-hour rollup. Decide this before the contract is written, not after the first bill.

## 7. Error Handling, Failure & Replay

Lag is the only intraday health signal there is. The envelope carries no timestamp of its own, so lag must come from broker metadata captured at receipt — which is why M12 needs enqueued_ts.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

### Estate conventions this component inherits

- **Configuration, not code.** Thresholds, mappings, calendars and status vocabularies live in tables and are read at run time. An unknown value raises; it is never mapped to its nearest neighbour or defaulted silently.
- **Reproducible verdicts.** Anything derived stores the input it was derived from — the threshold in force, the ruleset version, the counts. A verdict that cannot be reproduced three months later cannot be defended.
- **Bound everything that fans out.** Pods per micro-batch, connections per pod, retries per work item, calls per poll window. Every unbounded fan-out in this design eventually lands on the same Oracle.
- **Write then acknowledge.** Durable write first, then commit the offset or return the 202. The reverse order loses data silently in both the event path and the callback path.
- **Absence is a state.** NOT_RUN, STATUS_UNRESOLVED and 'no partition count known' are values to record, not gaps to infer. Most of the silent failure modes in this estate come from treating an empty result as a healthy one.

## 9. SEI Source Coverage

**SEI pack coverage: absent** — nothing in the SEI pack.
**Who answers for the gap: Joint** — needs both sides.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | §8.1 | nothing in the pack covers it | The thirteen signals are all file-shaped. Consumer lag — the only intraday health signal there is — appears in none of them. |

## 10. Gaps, Risks & What Is Missing

### What is missing

This component does not exist. Component 34 Observability predates events and has no lag concept.

**Priority P1, custom build Low.**

### Risk

- **MEDIUM · performance (B9).** Splunk ingest volume.

### Not specified — and what to do until it is

**Partition count per domain topic.** It is the denominator for 'every partition reported MB End' and the ceiling on consumer parallelism. Without it, completeness on the event channel is unprovable and throughput is unknown.

  *Recommended default:* Ask SEI. Until answered, record partitions_expected as null and never render a completeness verdict from a null denominator — show UNKNOWN rather than GOOD.

**Whether the pull can retrieve state as of the event.** If it can only read current state, replaying a micro-batch returns today's values and the file model's replay guarantees do not carry over. Every recovery procedure depends on this answer.

  *Recommended default:* Ask before designing recovery. If as-of retrieval does not exist, store the pulled payload — it is the only other way to make a restatement reproduce the original load.

### Gap against the SEI pack

- The thirteen signals are all file-shaped. Consumer lag — the only intraday health signal there is — appears in none of them. *(nearest counterpart: BBH File Ingestion Framework TDD, §8.1)*

## 11. Recommendation

Lateness on a continuous stream comes from the stream's own rhythm. No expectation table needed if the cadence is stable.

**Hub · event ingestion.** Build the staging store and the micro-batch registry first, before the listener. They are the two artefacts that make everything after them observable, and a listener shipped without them produces a pipeline nobody can debug.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For both sides.** What is the expected interval between micro-batches per topic, and is it stable enough to baseline?
- **Partition count per domain topic** — unanswered. Until it is: Ask SEI. Until answered, record partitions_expected as null and never render a completeness verdict from a null denominator — show UNKNOWN rather than GOOD.
- **Whether the pull can retrieve state as of the event** — unanswered. Until it is: Ask before designing recovery. If as-of retrieval does not exist, store the pulled payload — it is the only other way to make a restatement reproduce the original load.

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
- The bottleneck above has a measured figure at production volume, not an estimate.
- The component appears in the tracker with a status other than Not Started.
