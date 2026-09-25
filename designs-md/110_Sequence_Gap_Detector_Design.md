---
cp360_type: design_document
component_id: 110
component_name: Sequence Gap Detector
zone: 2. Hub
plane: Event Ingestion
priority: P1
technology: Python · SQL
custom_build: Medium
depends_on: []
status: Not Started
owner: TBD
origin: events-primary architect review
sei_coverage: absent
gap_owner: Joint
in_scope: true
---

# Sequence Gap Detector

## 1. Purpose & Scope

**Monotonic sequence numbers per partition; a gap is a provably lost event**

Absent from the pack and from the 65, despite costing almost nothing.

This component does not exist in the SEI design pack and has no entry in the original 65-component tracker. It is required by one substituted assumption: **SDC events are the primary ingestion path**, with everything from Stage 1 onward exactly as the pack specifies it.

## 2. Context & Dependencies

- Technology: Python · SQL
- Custom build: Medium — High means a design document is mandatory before code.
- Source of record: Architect review — events-primary

## 3. Design Decisions

No prior design decisions exist — this component has never been specified.

**Direction.** If yes, this is the strongest completeness proof in the estate and it costs almost nothing. Build it first.

## 4. Detailed Design

**Deliverable.** Monotonic sequence numbers per partition; a gap is a provably lost event

**Technology.** Python · SQL

## 5. Data Quality, Reconciliation & Lineage

Twelve reconciliation boundaries are required, against the three the pack specifies:

| Group | Boundaries |
| --- | --- |
| Event | `EVENTS_TO_KEYS` · `KEYS_TO_PULLED` · `PULLED_TO_STAGE1` · `STAGE1_TO_MICROBATCH` |
| Pipeline | `STG_TO_INT` · `INT_TO_DIM` · `INT_TO_FACT` |
| Outbound | `GENERATED_TO_VALIDATED` · `VALIDATED_TO_SUBMITTED` · `SUBMITTED_TO_ACKED` · `ACKED_TO_ACCEPTED` · `ACCEPTED_TO_REJECTED` |

## 6. Performance & Scale

One ordered scan per partition per micro-batch. Cheap.

## 7. Error Handling, Failure & Replay

This is the strongest completeness proof in the whole estate and it currently has no owner. The file channel has nothing comparable.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

## 9. SEI Source Coverage

**SEI pack coverage: absent** — nothing in the SEI pack.
**Who answers for the gap: Joint** — needs both sides.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | whole document | nothing in the pack covers it | Event Hub sequence numbers are monotonic per partition, so a gap is a provably lost event — the strongest completeness proof available, and no document mentions it. |

## 10. Gaps, Risks & What Is Missing

### What is missing

This component does not exist. Absent from the pack and from the 65, despite costing almost nothing.

**Priority P1, custom build Medium.**

### Risk

No ranked bottleneck or unowned error path touches this component.

### Gap against the SEI pack

- Event Hub sequence numbers are monotonic per partition, so a gap is a provably lost event — the strongest completeness proof available, and no document mentions it. *(nearest counterpart: BBH File Ingestion Framework TDD, no section — the whole document)*

## 11. Recommendation

If yes, this is the strongest completeness proof in the estate and it costs almost nothing. Build it first.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For both sides.** Are Event Hub sequence numbers monotonic per partition and gap-free under normal operation?

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
- The component appears in the tracker with a status other than Not Started.
