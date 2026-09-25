---
cp360_type: design_document
component_id: 17
component_name: Correction Handling
zone: 2. Hub
plane: Processing
priority: P1
technology: dbt
custom_build: High
depends_on: [15, 16, 21]
status: Not Started
owner: TBD
architecture_decisions: [AD-2, AD-8, AD-9]
pipeline_tiers: [Stage2-Oracle, Stage3-Exadata-Gold]
last_updated: 2026-08-10
tags: [SEI-BBH, Integration-Hub, hub, processing, bitemporal]
origin: SEI-BBH component tracker
sei_coverage: partial
gap_owner: SEI
in_scope: true
---

# Correction Handling

## 1. Purpose & Scope

**Bitemporal vs merge design, applied across Stage 2 and Gold**

Scope as recorded in the component tracker: No dbt idiom for bitemporal. Custom incremental strategy / macro, written once and reused..

## 2. Context & Dependencies

- Depends on components: 15, 16, 21
- Technology: dbt
- Custom build: High — High means a design document is mandatory before code.
- Source of record: Both (conflict)

## 3. Design Decisions

**Review verdict: gap.** Written for restatement and in-place merge. A delete arriving as an event has no defined downstream behaviour, and an outbound correction — a new submission referencing the one it corrects — is not modelled at all.

**Direction.** Component 17 predates events entirely. Both answers are needed before correction handling can be built.

## 4. Detailed Design

**Deliverable.** Bitemporal vs merge design, applied across Stage 2 and Gold

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

## 6. Performance & Scale

No performance concern identified for this component under the events-primary assumption.

## 7. Error Handling, Failure & Replay

### E9 · op = D semantics are undefined downstream (high)

A delete event names a key whose row no longer exists to pull. Correction Handling is written for restatement and in-place merge, not for a delete arriving as an event. Whether a delete soft-closes the INT row, removes it, or writes a tombstone is unstated.

**Who owns it today.** Component 17 predates events entirely.
### E12 · Dimension arriving after fact starts the 7-day clock (medium)

Hold-and-replay handles a fact whose dimension has not arrived, marking MISSING_DIMENSION_KEY with reprocess_eligible. But INT retains seven days, so a dimension that arrives on day eight means the held fact is silently gone from FACT for ever.

**Who owns it today.** The cliff is real and nothing surfaces days-to-expiry on held rows.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

## 9. SEI Source Coverage

**SEI pack coverage: partial** — partly specified — named, not sufficient.
**Who answers for the gap: SEI** — SEI must answer.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH dbt Transformation TDD v2 | §Appendix C | touches it, does not specify it | The twelve-scenario runbook, including reprocessing an already-closed row by direct UPDATE and never MERGE. |
| BBH File Ingestion Framework TDD v2.0 | §D.3 | touches it, does not specify it | Approved restatement — the procedure exists and names no approver. |
| BBH dbt Transformation TDD v2 | whole document | nothing in the pack covers it | Nothing defines the downstream semantics of an event op=D, and nothing defines an outbound correction. Both are written for a file world. |

## 10. Gaps, Risks & What Is Missing

### What is missing

Written for restatement and in-place merge. A delete arriving as an event has no defined downstream behaviour, and an outbound correction — a new submission referencing the one it corrects — is not modelled at all.

### Risk

- **HIGH · error path (E9).** op = D semantics are undefined downstream.
- **MEDIUM · error path (E12).** Dimension arriving after fact starts the 7-day clock.

### Gap against the SEI pack

- Nothing defines the downstream semantics of an event op=D, and nothing defines an outbound correction. Both are written for a file world. *(nearest counterpart: BBH dbt Transformation TDD, no section — the whole document)*

## 11. Recommendation

Component 17 predates events entirely. Both answers are needed before correction handling can be built.

**Action.** Define op=D semantics and the outbound correction protocol.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For SEI.** What are the downstream semantics of op=D — soft close, delete, or tombstone? And what is the outbound correction protocol when BBH sent a wrong loader?
- **From the tracker.** One answer both layers. (AD-2)

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
- Each unowned error path above has a named owner and a disposition in `ERROR_CATALOG`.
