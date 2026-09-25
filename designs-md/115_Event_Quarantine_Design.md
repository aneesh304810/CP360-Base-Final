---
cp360_type: design_document
component_id: 115
component_name: Event Quarantine
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
gap_owner: BBH
in_scope: true
---

# Event Quarantine

## 1. Purpose & Scope

**Dead-letter with a reason taxonomy and a bounded replay counter**

Component 29 is a file quarantine. The event path has no equivalent and therefore no poison-pill escape.

This component does not exist in the SEI design pack and has no entry in the original 65-component tracker. It is required by one substituted assumption: **SDC events are the primary ingestion path**, with everything from Stage 1 onward exactly as the pack specifies it.

## 2. Context & Dependencies

- Technology: Oracle DDL + Python
- Custom build: High — High means a design document is mandatory before code.
- Source of record: Architect review — events-primary

## 3. Design Decisions

No prior design decisions exist — this component has never been specified.

**Direction.** BBH-owned and the highest-value single addition. Without a dead-letter path a poison envelope stalls its partition permanently.

## 4. Detailed Design

**Deliverable.** Dead-letter with a reason taxonomy and a bounded replay counter

**Technology.** Oracle DDL + Python

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

## 6. Performance & Scale

n/a

## 7. Error Handling, Failure & Replay

A file that fails becomes QUARANTINED. An event that fails has nowhere to go. Reasons needed: unknown view, invalid op, key not found, pull timeout, unparseable envelope, sequencer cycle.
### E2 · Poison envelope stalls a partition indefinitely (critical)

Ordering is guaranteed within a partition, so a single unprocessable envelope blocks everything behind it until a human intervenes. At-least-once redelivery means it returns for ever.

**Who owns it today.** No dead-letter path exists for events. Component 29 quarantines files.
### E10 · Replay has no attempt limit (medium)

The Replay / Rerun Engine has no maximum attempt count before a work item is quarantined. A permanently failing item retries for ever and consumes capacity every cycle.

**Who owns it today.** Bounded retry plus quarantine. Trivial to add now, painful to retrofit.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

## 9. SEI Source Coverage

**SEI pack coverage: absent** — nothing in the SEI pack.
**Who answers for the gap: BBH** — BBH-owned — do not ask SEI.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | §D.2 | nothing in the pack covers it | D.2 recovers a QUARANTINED file. There is no event equivalent, so a poison envelope has no escape route. |

## 10. Gaps, Risks & What Is Missing

### What is missing

This component does not exist. Component 29 is a file quarantine. The event path has no equivalent and therefore no poison-pill escape.

**Priority P1, custom build High.**

### Risk

- **CRITICAL · error path (E2).** Poison envelope stalls a partition indefinitely.
- **MEDIUM · error path (E10).** Replay has no attempt limit.

### Gap against the SEI pack

- D.2 recovers a QUARANTINED file. There is no event equivalent, so a poison envelope has no escape route. *(nearest counterpart: BBH File Ingestion Framework TDD, §D.2)*

## 11. Recommendation

BBH-owned and the highest-value single addition. Without a dead-letter path a poison envelope stalls its partition permanently.

## 12. Open Questions & Acceptance Criteria

### Open questions

None outstanding.

### Acceptance criteria

- The deliverable above exists and is reviewed.
- Each unowned error path above has a named owner and a disposition in `ERROR_CATALOG`.
- The component appears in the tracker with a status other than Not Started.
