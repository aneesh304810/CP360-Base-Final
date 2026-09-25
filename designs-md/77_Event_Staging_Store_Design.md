---
cp360_type: design_document
component_id: 77
component_name: Event Staging Store
zone: 2. Hub
plane: Event Ingestion
priority: P1
technology: Oracle DDL
custom_build: High
depends_on: []
status: Not Started
owner: TBD
origin: events-primary architect review
sei_coverage: absent
gap_owner: BBH
in_scope: true
---

# Event Staging Store

## 1. Purpose & Scope

**(topic, partition, offset, sequence_number, enqueued_ts, eventid, key, op, view)**

Entirely BBH-owned and nobody is writing it. Ship it without enqueued_ts and sequence_number and lag and gap detection are not computable at all.

This component does not exist in the SEI design pack and has no entry in the original 65-component tracker. It is required by one substituted assumption: **SDC events are the primary ingestion path**, with everything from Stage 1 onward exactly as the pack specifies it.

## 2. Context & Dependencies

- Technology: Oracle DDL
- Custom build: High — High means a design document is mandatory before code.
- Source of record: Architect review — events-primary

## 3. Design Decisions

No prior design decisions exist — this component has never been specified.

**Direction.** BBH-owned and nobody is writing it. Ship without enqueued_ts and sequence_number and lag and gap detection are not computable at all.

## 4. Detailed Design

**Deliverable.** (topic, partition, offset, sequence_number, enqueued_ts, eventid, key, op, view)

**Technology.** Oracle DDL

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

## 6. Performance & Scale

The unique index on (topic, partition, offset) sits on the hot insert path. Range-partition by business date with local indexes, or the index becomes the bottleneck rather than the guard.
### B4 · Event staging insert rate (high)

A Python consumer writing envelope rows one at a time is the first wall every event pipeline hits. The unique index on (topic, partition, offset) sits directly on the hot insert path, so the guard that gives idempotency is also the thing that slows the write.

**What to do.** Array insert with a tuned batch size and one commit per micro-batch. Range-partition the staging table by business date with local indexes so index maintenance stays inside the current partition.

## 7. Error Handling, Failure & Replay

This is layer one of idempotency: a consumer replay yields the same offset and is rejected by the constraint.
### E1 · Offset committed before the durable write (critical)

If the consumer commits its offset and then crashes before the staging write lands, those events are gone and nothing records that they existed. The loss is silent and permanent — there is no gap to detect, because the sequence numbers were never stored.

**Who owns it today.** Nothing in the pack states the ordering. Write, then commit.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

## 9. SEI Source Coverage

**SEI pack coverage: absent** — nothing in the SEI pack.
**Who answers for the gap: BBH** — BBH-owned — do not ask SEI.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | §6.2 | nothing in the pack covers it | FILE_REGISTRY is the file path's record of receipt. The event path has no staging store specified — and it is entirely BBH-owned, so nobody outside BBH will write it. |

## 10. Gaps, Risks & What Is Missing

### What is missing

This component does not exist. Entirely BBH-owned and nobody is writing it. Ship it without enqueued_ts and sequence_number and lag and gap detection are not computable at all.

**Priority P1, custom build High.**

### Risk

- **HIGH · performance (B4).** Event staging insert rate.
- **CRITICAL · error path (E1).** Offset committed before the durable write.

### Gap against the SEI pack

- FILE_REGISTRY is the file path's record of receipt. The event path has no staging store specified — and it is entirely BBH-owned, so nobody outside BBH will write it. *(nearest counterpart: BBH File Ingestion Framework TDD, §6.2)*

## 11. Recommendation

BBH-owned and nobody is writing it. Ship without enqueued_ts and sequence_number and lag and gap detection are not computable at all.

## 12. Open Questions & Acceptance Criteria

### Open questions

None outstanding.

### Acceptance criteria

- The deliverable above exists and is reviewed.
- Each unowned error path above has a named owner and a disposition in `ERROR_CATALOG`.
- The bottleneck above has a measured figure at production volume, not an estimate.
- The component appears in the tracker with a status other than Not Started.
