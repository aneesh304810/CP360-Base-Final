---
cp360_type: design_document
component_id: 109
component_name: SEI Status Poller
zone: 2. Hub
plane: Orchestration
priority: P2
technology: Python · Airflow · Apigee
custom_build: Medium
depends_on: []
status: Not Started
owner: TBD
origin: events-primary architect review
sei_coverage: absent
gap_owner: SEI
in_scope: true
---

# SEI Status Poller

## 1. Purpose & Scope

**Non-terminal submissions only, tiered cadence, detail fetch on terminal**

The backstop for a notification that never arrives. Nothing in the 65 calls SEI for status.

This component does not exist in the SEI design pack and has no entry in the original 65-component tracker. It is required by one substituted assumption: **SDC events are the primary ingestion path**, with everything from Stage 1 onward exactly as the pack specifies it.

## 2. Context & Dependencies

- Technology: Python · Airflow · Apigee
- Custom build: Medium — High means a design document is mandatory before code.
- Source of record: Architect review — events-primary

### The Orchestration plane

**What the pack has.** C.1 specifies the DAG well: three tasks, dynamic task mapping, a deterministic run id, a guarded PENDING to TRIGGER transition, and dim-before-fact with hold-and-replay. For one daily file cycle this is a complete and careful design.

**What it does not.** It assumes a discrete 'everything has arrived' moment. Events never produce one. There is no intraday cadence model, no intraday SLA, no gate that works without interfaces to count, no partial-view policy inside a micro-batch, and no poller for the return leg. Replay is worse than missing — it is specified in terms the event path cannot honour.

**Plane verdict:** 2 of 7 specified · 2 partly · 3 absent.

## 3. Design Decisions

No prior design decisions exist — this component has never been specified.

**Direction.** The retention answer matters most: if detail is purged, BBH's stored copy becomes the system of record for outbound exceptions.

## 4. Detailed Design

**Deliverable.** Non-terminal submissions only, tiered cadence, detail fetch on terminal

**Technology.** Python · Airflow · Apigee

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

## 6. Performance & Scale

Terminal submissions must drop out of the poll set, or Apigee call volume grows with history rather than with work in flight.

## 7. Error Handling, Failure & Replay

A submission past max age becomes STATUS_UNRESOLVED rather than sitting at SUBMITTED for ever. When push and poll disagree, the poll wins and terminal never regresses.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

## 9. SEI Source Coverage

**SEI pack coverage: absent** — nothing in the SEI pack.
**Who answers for the gap: SEI** — SEI must answer.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | whole document | nothing in the pack covers it | No SEI status API is described anywhere — no endpoint, no auth, no pagination, no rate limits, no retention window for reject detail. |

## 10. Gaps, Risks & What Is Missing

### What is missing

This component does not exist. The backstop for a notification that never arrives. Nothing in the 65 calls SEI for status.

**Priority P2, custom build Medium.**

### Risk

No ranked bottleneck or unowned error path touches this component.

### Gap against the SEI pack

- No SEI status API is described anywhere — no endpoint, no auth, no pagination, no rate limits, no retention window for reject detail. *(nearest counterpart: BBH File Ingestion Framework TDD, no section — the whole document)*

## 11. Recommendation

The retention answer matters most: if detail is purged, BBH's stored copy becomes the system of record for outbound exceptions.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For SEI.** What is the status API contract — endpoint, auth through Apigee, pagination, rate limits, whether a mid-processing poll returns partial errors, and how long reject detail stays retrievable?

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
- The component appears in the tracker with a status other than Not Started.
