---
cp360_type: design_document
component_id: 101
component_name: SDC Event Listener
zone: 2. Hub
plane: Event Ingestion
priority: P1
technology: Python · Event Hub consumer
custom_build: High
depends_on: []
status: Not Started
owner: TBD
origin: events-primary architect review
sei_coverage: absent
gap_owner: BBH
in_scope: true
---

# SDC Event Listener

## 1. Purpose & Scope

**Consumer group per domain topic; durable write then offset commit**

There is no component between SEI publishing and Stage 1 holding rows. Components 8 and 9 are file sensors.

This component does not exist in the SEI design pack and has no entry in the original 65-component tracker. It is required by one substituted assumption: **SDC events are the primary ingestion path**, with everything from Stage 1 onward exactly as the pack specifies it.

## 2. Context & Dependencies

- Technology: Python · Event Hub consumer
- Custom build: High — High means a design document is mandatory before code.
- Source of record: Architect review — events-primary

## 3. Design Decisions

No prior design decisions exist — this component has never been specified.

**Direction.** BBH-owned. Durable write, then commit the offset. The reverse order loses events with no trace.

## 4. Detailed Design

**Deliverable.** Consumer group per domain topic; durable write then offset commit

**Technology.** Python · Event Hub consumer

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

## 6. Performance & Scale

Throughput ceiling is partition count × one consumer per partition. Partition count is unstated, so the ceiling is unknown and unprovable.

## 7. Error Handling, Failure & Replay

Offset must be committed only after the durable write. The reverse order loses events silently on a crash — the single most damaging ordering mistake available here.
### E1 · Offset committed before the durable write (critical)

If the consumer commits its offset and then crashes before the staging write lands, those events are gone and nothing records that they existed. The loss is silent and permanent — there is no gap to detect, because the sequence numbers were never stored.

**Who owns it today.** Nothing in the pack states the ordering. Write, then commit.
### E7 · Consumer rebalance in the middle of a box (high)

A group rebalance mid-micro-batch moves a partition to a different consumer, so MB Start and MB End for that partition land on different processes with different in-memory state.

**Who owns it today.** Nothing coordinates a box across a rebalance. The registry has to be the coordination point, not process memory.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

## 9. SEI Source Coverage

**SEI pack coverage: absent** — nothing in the SEI pack.
**Who answers for the gap: BBH** — BBH-owned — do not ask SEI.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | §C.1 | nothing in the pack covers it | C.1 is the file path's equivalent: a scheduled DAG that discovers work. The event path's listener has no counterpart section in any document. |

## 10. Gaps, Risks & What Is Missing

### What is missing

This component does not exist. There is no component between SEI publishing and Stage 1 holding rows. Components 8 and 9 are file sensors.

**Priority P1, custom build High.**

### Risk

- **CRITICAL · error path (E1).** Offset committed before the durable write.
- **HIGH · error path (E7).** Consumer rebalance in the middle of a box.

### Gap against the SEI pack

- C.1 is the file path's equivalent: a scheduled DAG that discovers work. The event path's listener has no counterpart section in any document. *(nearest counterpart: BBH File Ingestion Framework TDD, §C.1)*

## 11. Recommendation

BBH-owned. Durable write, then commit the offset. The reverse order loses events with no trace.

## 12. Open Questions & Acceptance Criteria

### Open questions

None outstanding.

### Acceptance criteria

- The deliverable above exists and is reviewed.
- Each unowned error path above has a named owner and a disposition in `ERROR_CATALOG`.
- The component appears in the tracker with a status other than Not Started.
