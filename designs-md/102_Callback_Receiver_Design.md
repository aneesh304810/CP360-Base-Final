---
cp360_type: design_document
component_id: 102
component_name: Callback Receiver
zone: 2. Hub
plane: Ingress/Egress
priority: P1
technology: Python · Apigee-fronted endpoint
custom_build: Medium
depends_on: []
status: Not Started
owner: TBD
origin: events-primary architect review
sei_coverage: absent
gap_owner: SEI
in_scope: true
---

# Callback Receiver

## 1. Purpose & Scope

**Authenticate, validate envelope shape, durable write, 202**

SEI pushes loader status. Component 10 covers producing outbound payloads, nothing receives.

This component does not exist in the SEI design pack and has no entry in the original 65-component tracker. It is required by one substituted assumption: **SDC events are the primary ingestion path**, with everything from Stage 1 onward exactly as the pack specifies it.

## 2. Context & Dependencies

- Technology: Python · Apigee-fronted endpoint
- Custom build: Medium — High means a design document is mandatory before code.
- Source of record: Architect review — events-primary

## 3. Design Decisions

No prior design decisions exist — this component has never been specified.

**Direction.** Acknowledge on durable write. The inbox belongs to the Hub with Integration360 as a second consumer, so an observability tool is never on the remediation path.

## 4. Detailed Design

**Deliverable.** Authenticate, validate envelope shape, durable write, 202

**Technology.** Python · Apigee-fronted endpoint

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

## 6. Performance & Scale

Must not do correlation work inline. Parsing and matching belong downstream of the acknowledgement.

## 7. Error Handling, Failure & Replay

Acknowledge on durable write, never on successful processing. A 500 because a lookup failed ties SEI's retry behaviour to BBH's internal bugs.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

## 9. SEI Source Coverage

**SEI pack coverage: absent** — nothing in the SEI pack.
**Who answers for the gap: SEI** — SEI must answer.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | whole document | nothing in the pack covers it | No receiver is described. SEI pushes loader status into an endpoint BBH defines, and nothing in the pack defines it. |

## 10. Gaps, Risks & What Is Missing

### What is missing

This component does not exist. SEI pushes loader status. Component 10 covers producing outbound payloads, nothing receives.

**Priority P1, custom build Medium.**

### Risk

No ranked bottleneck or unowned error path touches this component.

### Gap against the SEI pack

- No receiver is described. SEI pushes loader status into an endpoint BBH defines, and nothing in the pack defines it. *(nearest counterpart: BBH File Ingestion Framework TDD, no section — the whole document)*

## 11. Recommendation

Acknowledge on durable write. The inbox belongs to the Hub with Integration360 as a second consumer, so an observability tool is never on the remediation path.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For SEI.** Will SEI supply a message_id on the status push that survives its own retry, and what is the retry behaviour on a 5xx from the BBH endpoint?

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
- The component appears in the tracker with a status other than Not Started.
