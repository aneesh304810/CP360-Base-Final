---
cp360_type: design_document
component_id: 76
component_name: G0 Envelope Gate
zone: 2. Hub
plane: Event Ingestion
priority: P1
technology: Python
custom_build: Medium
depends_on: []
status: Not Started
owner: TBD
origin: events-primary architect review
sei_coverage: absent
gap_owner: Joint
in_scope: true
---

# G0 Envelope Gate

## 1. Purpose & Scope

**Per-envelope structural validation before staging**

G1 validates a file's structure. Nothing validates an envelope.

This component does not exist in the SEI design pack and has no entry in the original 65-component tracker. It is required by one substituted assumption: **SDC events are the primary ingestion path**, with everything from Stage 1 onward exactly as the pack specifies it.

## 2. Context & Dependencies

- Technology: Python
- Custom build: Medium — High means a design document is mandatory before code.
- Source of record: Architect review — events-primary

## 3. Design Decisions

No prior design decisions exist — this component has never been specified.

**Direction.** Without the catalogue, routing an event to the right view is inference rather than contract.

## 4. Detailed Design

**Deliverable.** Per-envelope structural validation before staging

**Technology.** Python

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

## 6. Performance & Scale

Must run in the consumer loop, so it has to be O(1) per envelope with no database lookup.

## 7. Error Handling, Failure & Replay

Unknown eventid, unresolvable view, invalid op, missing key. Each needs a disposition. Without a dead-letter path a single poison envelope stalls its partition for ever.
### E2 · Poison envelope stalls a partition indefinitely (critical)

Ordering is guaranteed within a partition, so a single unprocessable envelope blocks everything behind it until a human intervenes. At-least-once redelivery means it returns for ever.

**Who owns it today.** No dead-letter path exists for events. Component 29 quarantines files.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

## 9. SEI Source Coverage

**SEI pack coverage: absent** — nothing in the SEI pack.
**Who answers for the gap: Joint** — needs both sides.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | §C.4 | nothing in the pack covers it | C.4 validates a file's structure before load. Nothing validates an envelope, so an unknown view or an invalid op reaches the collapser. |

## 10. Gaps, Risks & What Is Missing

### What is missing

This component does not exist. G1 validates a file's structure. Nothing validates an envelope.

**Priority P1, custom build Medium.**

### Risk

- **CRITICAL · error path (E2).** Poison envelope stalls a partition indefinitely.

### Gap against the SEI pack

- C.4 validates a file's structure before load. Nothing validates an envelope, so an unknown view or an invalid op reaches the collapser. *(nearest counterpart: BBH File Ingestion Framework TDD, §C.4)*

## 11. Recommendation

Without the catalogue, routing an event to the right view is inference rather than contract.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For both sides.** Is there a published catalogue mapping eventid to domain and view? eventid is a type code, not a message identifier.

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
- Each unowned error path above has a named owner and a disposition in `ERROR_CATALOG`.
- The component appears in the tracker with a status other than Not Started.
