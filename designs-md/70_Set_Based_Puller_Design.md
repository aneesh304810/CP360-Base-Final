---
cp360_type: design_document
component_id: 70
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

## 2. Context & Dependencies

- Technology: Python · SEI view API
- Custom build: High — High means a design document is mandatory before code.
- Source of record: Architect review — events-primary

## 3. Design Decisions

No prior design decisions exist — this component has never been specified.

**Direction.** As-of retrieval is the difference between replay reproducing the original load and replay quietly returning today's values. Ask before designing recovery.

## 4. Detailed Design

**Deliverable.** One bound, set-based retrieval per view per micro-batch

**Technology.** Python · SEI view API

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

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

### Gap against the SEI pack

- The canvas starts at SWP_RAW. How rows get there under events — a set-based pull per view per micro-batch — is not described anywhere. *(nearest counterpart: BBH dbt Transformation TDD, §Appendix E)*

## 11. Recommendation

As-of retrieval is the difference between replay reproducing the original load and replay quietly returning today's values. Ask before designing recovery.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For both sides.** Does the view API offer as-of retrieval or only current state? And what are its rate limits, pagination and timeout behaviour?

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
- Each unowned error path above has a named owner and a disposition in `ERROR_CATALOG`.
- The bottleneck above has a measured figure at production volume, not an estimate.
- The component appears in the tracker with a status other than Not Started.
