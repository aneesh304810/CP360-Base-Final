---
cp360_type: design_document
component_id: 113
component_name: Micro-Batch Registry
zone: 2. Hub
plane: Event Ingestion
priority: P1
technology: Oracle DDL + Python
custom_build: High
depends_on: []
status: Not Started
owner: TBD
origin: events-primary architect review
sei_coverage: absent
gap_owner: Joint
in_scope: true
---

# Micro-Batch Registry

## 1. Purpose & Scope

**(topic, partition, mb_id) with state, counts and both box timestamps**

The event channel's FILE_REGISTRY. It does not exist.

This component does not exist in the SEI design pack and has no entry in the original 65-component tracker. It is required by one substituted assumption: **SDC events are the primary ingestion path**, with everything from Stage 1 onward exactly as the pack specifies it.

## 2. Context & Dependencies

- Technology: Oracle DDL + Python
- Custom build: High — High means a design document is mandatory before code.
- Source of record: Architect review — events-primary

## 3. Design Decisions

No prior design decisions exist — this component has never been specified.

**Direction.** Without the denominator, 'every partition reported MB End' cannot be distinguished from 'the ones we happened to see'.

## 4. Detailed Design

**Deliverable.** (topic, partition, mb_id) with state, counts and both box timestamps

**Technology.** Oracle DDL + Python

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

## 6. Performance & Scale

Small table, high update rate. One row per partition per micro-batch per topic — at a five-minute cadence that is still tens of thousands of rows a day.

## 7. Error Handling, Failure & Replay

A start with no end, or a partition that never reported, is the only way to see a stalled producer. Without the partition count as a denominator, 'all partitions reported' is unprovable.
### E7 · Consumer rebalance in the middle of a box (high)

A group rebalance mid-micro-batch moves a partition to a different consumer, so MB Start and MB End for that partition land on different processes with different in-memory state.

**Who owns it today.** Nothing coordinates a box across a rebalance. The registry has to be the coordination point, not process memory.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

## 9. SEI Source Coverage

**SEI pack coverage: absent** — nothing in the SEI pack.
**Who answers for the gap: Joint** — needs both sides.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | §6.2 | nothing in the pack covers it | The event channel's FILE_REGISTRY. Micro-batch boxing is per partition, and nothing records which partitions reported. |

## 10. Gaps, Risks & What Is Missing

### What is missing

This component does not exist. The event channel's FILE_REGISTRY. It does not exist.

**Priority P1, custom build High.**

### Risk

- **HIGH · error path (E7).** Consumer rebalance in the middle of a box.

### Gap against the SEI pack

- The event channel's FILE_REGISTRY. Micro-batch boxing is per partition, and nothing records which partitions reported. *(nearest counterpart: BBH File Ingestion Framework TDD, §6.2)*

## 11. Recommendation

Without the denominator, 'every partition reported MB End' cannot be distinguished from 'the ones we happened to see'.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For both sides.** How many partitions does each domain topic have?

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
- Each unowned error path above has a named owner and a disposition in `ERROR_CATALOG`.
- The component appears in the tracker with a status other than Not Started.
