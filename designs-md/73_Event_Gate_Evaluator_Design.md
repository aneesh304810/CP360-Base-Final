---
cp360_type: design_document
component_id: 73
component_name: Event Gate Evaluator
zone: 2. Hub
plane: Orchestration
priority: P1
technology: Python · Oracle
custom_build: Medium
depends_on: []
status: Not Started
owner: TBD
origin: events-primary architect review
sei_coverage: absent
gap_owner: Joint
in_scope: true
---

# Event Gate Evaluator

## 1. Purpose & Scope

**Replaces E.2's MINUS: every micro-batch LOADED, plus the EOD marker received**

E.2 counts DAILY interfaces MINUS ARCHIVED. Under events there is no interface to count and nothing reaches ARCHIVED.

This component does not exist in the SEI design pack and has no entry in the original 65-component tracker. It is required by one substituted assumption: **SDC events are the primary ingestion path**, with everything from Stage 1 onward exactly as the pack specifies it.

## 2. Context & Dependencies

- Technology: Python · Oracle
- Custom build: Medium — High means a design document is mandatory before code.
- Source of record: Architect review — events-primary

### The Orchestration plane

**What the pack has.** C.1 specifies the DAG well: three tasks, dynamic task mapping, a deterministic run id, a guarded PENDING to TRIGGER transition, and dim-before-fact with hold-and-replay. For one daily file cycle this is a complete and careful design.

**What it does not.** It assumes a discrete 'everything has arrived' moment. Events never produce one. There is no intraday cadence model, no intraday SLA, no gate that works without interfaces to count, no partial-view policy inside a micro-batch, and no poller for the return leg. Replay is worse than missing — it is specified in terms the event path cannot honour.

**Plane verdict:** 2 of 7 specified · 2 partly · 3 absent.

## 3. Design Decisions

No prior design decisions exist — this component has never been specified.

**Direction.** Every micro-batch LOADED plus the EOD marker received. Marker-only gating lets the transformation run on short Stage 1 and the existing boundaries cannot see it.

## 4. Detailed Design

**Deliverable.** Replaces E.2's MINUS: every micro-batch LOADED, plus the EOD marker received

**Technology.** Python · Oracle

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

## 6. Performance & Scale

Trivial to compute. Its cost is entirely in being wrong.

## 7. Error Handling, Failure & Replay

Gating on the marker alone lets the transformation run on short Stage 1 — and STG→INT still reconciles, because it ties against a Stage 1 that is itself short.
### E4 · The gate cannot detect event loss (critical)

A micro-batch that fails at 11am and goes unnoticed means the EOD transformation runs on short Stage 1 — and STG→INT reconciles cleanly, because it ties against a Stage 1 that is itself short. The existing three boundaries are all downstream of the loss and cannot see it.

**Who owns it today.** Requires the four event-side boundaries and a gate that demands every micro-batch LOADED.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

## 9. SEI Source Coverage

**SEI pack coverage: absent** — nothing in the SEI pack.
**Who answers for the gap: Joint** — needs both sides.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | §E.2 | nothing in the pack covers it | The completeness gate is expected active DAILY interfaces MINUS distinct ARCHIVED. Under events there is no interface to count and nothing reaches ARCHIVED, so this query returns nothing meaningful and the pack proposes no replacement. |
| BBH File Ingestion Framework TDD v2.0 | §E.1 | touches it, does not specify it | UX_DATE_CONTROL_ACTIVE, a function-based unique index on CASE WHEN STATUS <> 'COMPLETE' THEN 1 END. One line, and it is what physically enforces a single active date. |

## 10. Gaps, Risks & What Is Missing

### What is missing

This component does not exist. E.2 counts DAILY interfaces MINUS ARCHIVED. Under events there is no interface to count and nothing reaches ARCHIVED.

**Priority P1, custom build Medium.**

### Risk

- **CRITICAL · error path (E4).** The gate cannot detect event loss.

### Gap against the SEI pack

- The completeness gate is expected active DAILY interfaces MINUS distinct ARCHIVED. Under events there is no interface to count and nothing reaches ARCHIVED, so this query returns nothing meaningful and the pack proposes no replacement. *(nearest counterpart: BBH File Ingestion Framework TDD, §E.2)*

## 11. Recommendation

Every micro-batch LOADED plus the EOD marker received. Marker-only gating lets the transformation run on short Stage 1 and the existing boundaries cannot see it.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For both sides.** E.2's completeness MINUS counts DAILY interfaces against ARCHIVED. Under events there is no interface to count and nothing reaches ARCHIVED. What replaces it?

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
- Each unowned error path above has a named owner and a disposition in `ERROR_CATALOG`.
- The component appears in the tracker with a status other than Not Started.
