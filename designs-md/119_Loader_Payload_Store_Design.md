---
cp360_type: design_document
component_id: 119
component_name: Loader Payload Store
zone: 2. Hub
plane: Ingress/Egress
priority: P1
technology: Oracle DDL + object store
custom_build: Medium
depends_on: []
status: Not Started
owner: TBD
origin: events-primary architect review
sei_coverage: absent
gap_owner: BBH
in_scope: true
---

# Loader Payload Store

## 1. Purpose & Scope

**What was generated and what was sent, with a content hash, written before submission**

Without it a rejected record cannot be tied to the bytes that caused it, and a disagreement with SEI has no evidence on the BBH side.

This component does not exist in the SEI design pack and has no entry in the original 65-component tracker. It is required by one substituted assumption: **SDC events are the primary ingestion path**, with everything from Stage 1 onward exactly as the pack specifies it.

## 2. Context & Dependencies

- Technology: Oracle DDL + object store
- Custom build: Medium — High means a design document is mandatory before code.
- Source of record: Architect review — events-primary

## 3. Design Decisions

No prior design decisions exist — this component has never been specified.

**Direction.** BBH-owned. Write the payload and its hash before the send, not after.

## 4. Detailed Design

**Deliverable.** What was generated and what was sent, with a content hash, written before submission

**Technology.** Oracle DDL + object store

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

## 6. Performance & Scale

Store the artefact once and reference it. Never regenerate it to answer a question about it.

## 7. Error Handling, Failure & Replay

Write before send, in that order. A payload recorded only after a successful send cannot explain a send that failed halfway, and a rejection arriving two days later has nothing to be read against.
### E14 · No record of what was actually sent (high)

A rejection names records in a payload nobody kept. Without the generated artefact and its hash written before submission, a reject cannot be tied back to the bytes that caused it, a partial send cannot be told from a complete one, and a disagreement with SEI has no evidence on the BBH side.

**Who owns it today.** Unowned. The submission registry records that a send happened, not what it contained.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

## 9. SEI Source Coverage

**SEI pack coverage: absent** — nothing in the SEI pack.
**Who answers for the gap: BBH** — BBH-owned — do not ask SEI.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | whole document | nothing in the pack covers it | Nothing records what was sent. A rejection names records in a payload nobody kept. |

## 10. Gaps, Risks & What Is Missing

### What is missing

This component does not exist. Without it a rejected record cannot be tied to the bytes that caused it, and a disagreement with SEI has no evidence on the BBH side.

**Priority P1, custom build Medium.**

### Risk

- **HIGH · error path (E14).** No record of what was actually sent.

### Gap against the SEI pack

- Nothing records what was sent. A rejection names records in a payload nobody kept. *(nearest counterpart: BBH File Ingestion Framework TDD, no section — the whole document)*

## 11. Recommendation

BBH-owned. Write the payload and its hash before the send, not after.

## 12. Open Questions & Acceptance Criteria

### Open questions

None outstanding.

### Acceptance criteria

- The deliverable above exists and is reviewed.
- Each unowned error path above has a named owner and a disposition in `ERROR_CATALOG`.
- The component appears in the tracker with a status other than Not Started.
