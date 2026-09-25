---
cp360_type: design_document
component_id: 106
component_name: Intraday Stage-1 Loader
zone: 2. Hub
plane: Event Ingestion
priority: P1
technology: Python · Oracle array insert
custom_build: Medium
depends_on: []
status: Not Started
owner: TBD
origin: events-primary architect review
sei_coverage: absent
gap_owner: BBH
in_scope: true
---

# Intraday Stage-1 Loader

## 1. Purpose & Scope

**Continuous micro-batch load into Stage 1 with one commit per micro-batch**

Component 13 is a file ingestion framework. The event path loads continuously, not once a day.

This component does not exist in the SEI design pack and has no entry in the original 65-component tracker. It is required by one substituted assumption: **SDC events are the primary ingestion path**, with everything from Stage 1 onward exactly as the pack specifies it.

## 2. Context & Dependencies

- Technology: Python · Oracle array insert
- Custom build: Medium — High means a design document is mandatory before code.
- Source of record: Architect review — events-primary

## 3. Design Decisions

No prior design decisions exist — this component has never been specified.

**Direction.** BBH-owned. Array insert, one commit per micro-batch.

## 4. Detailed Design

**Deliverable.** Continuous micro-batch load into Stage 1 with one commit per micro-batch

**Technology.** Python · Oracle array insert

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

## 6. Performance & Scale

Array insert with a tuned batch size, one commit per micro-batch. Row-by-row insert and per-row commit is the classic first wall and it arrives early.
### B2 · STG is a view, and events make it run 288 times a day (critical)

The dbt TDD defines STG as a view, recomputed on read. Under a daily file cycle it is recomputed once. Under intraday events, INT is built incrementally all day, so the STG view is recomputed on every incremental run — and each recomputation scans Stage 1. This is the single largest cost the event substitution introduces, and it comes from a design decision that was entirely reasonable when it was made.

**What to do.** Either materialise STG per micro-batch, or ensure the INT incremental predicate pushes down to Stage 1's partition so the view scans one micro-batch rather than the whole accumulated day. Verify the push-down on the actual plan; do not assume it.
### B4 · Event staging insert rate (high)

A Python consumer writing envelope rows one at a time is the first wall every event pipeline hits. The unique index on (topic, partition, offset) sits directly on the hot insert path, so the guard that gives idempotency is also the thing that slows the write.

**What to do.** Array insert with a tuned batch size and one commit per micro-batch. Range-partition the staging table by business date with local indexes so index maintenance stays inside the current partition.
### B6 · INT's incremental MERGE into a growing current-day partition (high)

INT is partitioned by BUSINESS_DATE with a 7-day window. Under intraday events the current day's partition is written to continuously, and an incremental MERGE against a partition that grows all day degrades as the day goes on. The 6pm micro-batch is materially slower than the 6am one.

**What to do.** Subpartition by micro-batch, or load append-only with a late dedupe at the gate. Measure the degradation curve before choosing; it may be acceptable at real volumes, but nobody knows the real volumes.
### B10 · Pull latency is inside the micro-batch's critical path (medium)

The box is not complete until every view has been pulled and loaded. A single slow view holds the whole micro-batch, and the next micro-batch is already arriving. Queueing under a fixed cadence is how a small latency regression becomes an unbounded backlog.

**What to do.** Bound the pull with a timeout and an explicit partial disposition, and monitor the ratio of micro-batch duration to cadence interval. Above roughly 0.7 the system has no recovery headroom left.

## 7. Error Handling, Failure & Replay

A failed micro-batch rolls back whole. A partially loaded micro-batch marked LOADED is the defect that makes the EOD gate lie.
### E6 · Partial micro-batch failure across views (high)

If three of five views pull successfully and the fourth times out, is the micro-batch FAILED and rolled back whole, or PARTIAL and advanced? Component 22 sets a partial-batch policy for files and says nothing about views inside a box.

**Who owns it today.** Unowned. The safe default is roll back whole; the useful default is not, and somebody has to choose.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

## 9. SEI Source Coverage

**SEI pack coverage: absent** — nothing in the SEI pack.
**Who answers for the gap: BBH** — BBH-owned — do not ask SEI.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | §C.1 | nothing in the pack covers it | The file loader runs once per file per day. A continuous micro-batch loader with one commit per box has no counterpart. |

## 10. Gaps, Risks & What Is Missing

### What is missing

This component does not exist. Component 13 is a file ingestion framework. The event path loads continuously, not once a day.

**Priority P1, custom build Medium.**

### Risk

- **CRITICAL · performance (B2).** STG is a view, and events make it run 288 times a day.
- **HIGH · performance (B4).** Event staging insert rate.
- **HIGH · performance (B6).** INT's incremental MERGE into a growing current-day partition.
- **MEDIUM · performance (B10).** Pull latency is inside the micro-batch's critical path.
- **HIGH · error path (E6).** Partial micro-batch failure across views.

### Gap against the SEI pack

- The file loader runs once per file per day. A continuous micro-batch loader with one commit per box has no counterpart. *(nearest counterpart: BBH File Ingestion Framework TDD, §C.1)*

## 11. Recommendation

BBH-owned. Array insert, one commit per micro-batch.

## 12. Open Questions & Acceptance Criteria

### Open questions

None outstanding.

### Acceptance criteria

- The deliverable above exists and is reviewed.
- Each unowned error path above has a named owner and a disposition in `ERROR_CATALOG`.
- The bottleneck above has a measured figure at production volume, not an estimate.
- The component appears in the tracker with a status other than Not Started.
