---
cp360_type: design_document
component_id: 105
component_name: Set-Based Puller
zone: 2. Hub
plane: Event Ingestion
priority: P1
technology: Python · SEI view API
custom_build: High
depends_on: []
status: Not Started
owner: TBD
origin: events-primary architect review
sei_coverage: absent
gap_owner: Joint
in_scope: true
---

# Set-Based Puller

## 1. Purpose & Scope

**One bound, set-based retrieval per view per micro-batch**

Per-event retrieval is the default anyone reaches for and it is ruinous — see bottleneck B1.

This component does not exist in the SEI design pack and has no entry in the original 65-component tracker. It is required by one substituted assumption: **SDC events are the primary ingestion path**, with everything from Stage 1 onward exactly as the pack specifies it.

**Custom build: High.** A design document is mandatory before code, and this one is that document. High means there is no vendor default to fall back on — every behaviour below is a decision somebody has to make and own.

**Where it sits.** Hub · event ingestion. The chain between SEI publishing and Stage 1 holding rows. None of it exists in any document, all of it is BBH-owned, and it is the path that carries the daily load. Build it as one deployable unit with one owner, not as six components discovered separately.

## 2. Context & Dependencies

- **No recorded dependency either way.** Either it is genuinely standalone, or the tracker's depends_on column was never filled for it — worth confirming, because an unrecorded dependency is the one that surfaces during integration testing.
- Technology: Python · SEI view API
- Custom build: High — High means a design document is mandatory before code.
- Source of record: Architect review — events-primary
- **Before the gate.** Its output is counted by the completeness gate, so a silent failure here makes the business date close on incomplete data.

## 3. Design Decisions

No prior design decisions exist — this component has never been specified.

**Direction.** As-of retrieval is the difference between replay reproducing the original load and replay quietly returning today's values. Ask before designing recovery.

## 4. Detailed Design

**Deliverable.** One bound, set-based retrieval per view per micro-batch

**Technology.** Python · SEI view API

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

The system's throughput ceiling. Oracle's 1000-element IN limit forces a global temporary table or array bind with a join — an IN list built by string concatenation will fail in production and silently truncate in test.
### B1 · The pull is the system's throughput ceiling (critical)

Query count is driven by cadence × views, not by account count. A five-minute cadence is 288 cycles a day; the reference client ran 17,955 queries a month, about 2.08 per cycle. Ten views at the same cadence is roughly 86,000 queries a month. Scaling the estimate by accounts understates it badly, because accounts do not appear in the formula.

**What to do.** One set-based query per view per micro-batch, bound to a collapsed key set. Never one query per event. Oracle's 1000-element IN limit means a global temporary table or an array bind with a join — a concatenated IN list fails in production and truncates silently in test.
### B10 · Pull latency is inside the micro-batch's critical path (medium)

The box is not complete until every view has been pulled and loaded. A single slow view holds the whole micro-batch, and the next micro-batch is already arriving. Queueing under a fixed cadence is how a small latency regression becomes an unbounded backlog.

**What to do.** Bound the pull with a timeout and an explicit partial disposition, and monitor the ratio of micro-batch duration to cadence interval. Above roughly 0.7 the system has no recovery headroom left.

## 7. Error Handling, Failure & Replay

Needs a circuit breaker. If SEI's view API degrades, retrying every micro-batch amplifies load against an already failing dependency.
### E3 · Replay does not reproduce the original load (critical)

The file path replays identical bytes and gets an identical result. The event pull re-reads current state, so replaying yesterday's micro-batch today returns today's values. The recovery procedures in D.1 to D.6 are written entirely in file terms and do not survive the substitution.

**Who owns it today.** Either store the pulled payload, or obtain as-of retrieval from SEI. Neither is specified.
### E5 · Not-found key on pull has no disposition (high)

The key changed and by the time the pull runs the row is gone — a delete race, and at low rates entirely normal. At high rates it is a symptom of something serious. Treating it as an error alarms constantly; treating it as normal hides real loss.

**Who owns it today.** Needs a rate threshold tied to the observed delete rate, not a binary rule.
### E8 · No circuit breaker on the SEI view API (high)

If SEI's retrieval degrades, every micro-batch retries against an already failing dependency and amplifies the load. The classic retry storm, with a fixed cadence guaranteeing it repeats.

**Who owns it today.** Needs a breaker with backoff and an explicit degraded mode that stops pulling and keeps staging.

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
| BBH dbt Transformation TDD v2 | §Appendix E | nothing in the pack covers it | The canvas starts at SWP_RAW. How rows get there under events — a set-based pull per view per micro-batch — is not described anywhere. |

## 10. Gaps, Risks & What Is Missing

### What is missing

This component does not exist. Per-event retrieval is the default anyone reaches for and it is ruinous — see bottleneck B1.

**Priority P1, custom build High.**

### Risk

- **CRITICAL · performance (B1).** The pull is the system's throughput ceiling.
- **MEDIUM · performance (B10).** Pull latency is inside the micro-batch's critical path.
- **CRITICAL · error path (E3).** Replay does not reproduce the original load.
- **HIGH · error path (E5).** Not-found key on pull has no disposition.
- **HIGH · error path (E8).** No circuit breaker on the SEI view API.

### Not specified — and what to do until it is

**Partition count per domain topic.** It is the denominator for 'every partition reported MB End' and the ceiling on consumer parallelism. Without it, completeness on the event channel is unprovable and throughput is unknown.

  *Recommended default:* Ask SEI. Until answered, record partitions_expected as null and never render a completeness verdict from a null denominator — show UNKNOWN rather than GOOD.

**Whether the pull can retrieve state as of the event.** If it can only read current state, replaying a micro-batch returns today's values and the file model's replay guarantees do not carry over. Every recovery procedure depends on this answer.

  *Recommended default:* Ask before designing recovery. If as-of retrieval does not exist, store the pulled payload — it is the only other way to make a restatement reproduce the original load.

### Gap against the SEI pack

- The canvas starts at SWP_RAW. How rows get there under events — a set-based pull per view per micro-batch — is not described anywhere. *(nearest counterpart: BBH dbt Transformation TDD, §Appendix E)*

## 11. Recommendation

As-of retrieval is the difference between replay reproducing the original load and replay quietly returning today's values. Ask before designing recovery.

**Hub · event ingestion.** Build the staging store and the micro-batch registry first, before the listener. They are the two artefacts that make everything after them observable, and a listener shipped without them produces a pipeline nobody can debug.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For both sides.** Does the view API offer as-of retrieval or only current state? And what are its rate limits, pagination and timeout behaviour?
- **Partition count per domain topic** — unanswered. Until it is: Ask SEI. Until answered, record partitions_expected as null and never render a completeness verdict from a null denominator — show UNKNOWN rather than GOOD.
- **Whether the pull can retrieve state as of the event** — unanswered. Until it is: Ask before designing recovery. If as-of retrieval does not exist, store the pulled payload — it is the only other way to make a restatement reproduce the original load.

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
- Each unowned error path above has a named owner and a disposition in `ERROR_CATALOG`.
- The bottleneck above has a measured figure at production volume, not an estimate.
- The component appears in the tracker with a status other than Not Started.
