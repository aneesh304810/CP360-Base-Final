---
cp360_type: design_document
component_id: 121
component_name: Outbound Reconciliation
zone: 2. Hub
plane: Data Quality
priority: P1
technology: Python · SQL
custom_build: Medium
depends_on: []
status: Not Started
owner: TBD
origin: events-primary architect review
sei_coverage: absent
gap_owner: SEI
in_scope: true
---

# Outbound Reconciliation

## 1. Purpose & Scope

**Generated → validated → submitted → accepted → rejected: five counts that must tie**

The outbound counterpart of the four event-side boundaries. Same omission, opposite direction.

This component does not exist in the SEI design pack and has no entry in the original 65-component tracker. It is required by one substituted assumption: **SDC events are the primary ingestion path**, with everything from Stage 1 onward exactly as the pack specifies it.

## 2. Context & Dependencies

- Technology: Python · SQL
- Custom build: Medium — High means a design document is mandatory before code.
- Source of record: Architect review — events-primary

## 3. Design Decisions

No prior design decisions exist — this component has never been specified.

**Direction.** Without the counts, no outbound completeness claim is provable.

## 4. Detailed Design

**Deliverable.** Generated → validated → submitted → accepted → rejected: five counts that must tie

**Technology.** Python · SQL

## 5. Data Quality, Reconciliation & Lineage

Gates G0, G1 and G3 are row-level and run per micro-batch. G2, G4 and G5 are set-level aggregates and run at the EOD gate only — running them per box is 288 full passes a day. G6 is the outbound gate and blocks a submission rather than warning.

Twelve reconciliation boundaries are required, against the three the pack specifies:

| Group | Boundaries |
| --- | --- |
| Event | `EVENTS_TO_KEYS` · `KEYS_TO_PULLED` · `PULLED_TO_STAGE1` · `STAGE1_TO_MICROBATCH` |
| Pipeline | `STG_TO_INT` · `INT_TO_DIM` · `INT_TO_FACT` |
| Outbound | `GENERATED_TO_VALIDATED` · `VALIDATED_TO_SUBMITTED` · `SUBMITTED_TO_ACKED` · `ACKED_TO_ACCEPTED` · `ACCEPTED_TO_REJECTED` |

## 6. Performance & Scale

Daily set-based aggregate per loader type.

## 7. Error Handling, Failure & Replay

RECON_RESULT’s three boundaries are all inbound. Sent versus accepted is a boundary that exists nowhere, so a loader that silently dropped three percent of its records on the way out is invisible to every control in the estate.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

## 9. SEI Source Coverage

**SEI pack coverage: absent** — nothing in the SEI pack.
**Who answers for the gap: SEI** — SEI must answer.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH dbt Transformation TDD v2 | §B.5 | nothing in the pack covers it | B.5's three boundaries are inbound. Sent versus accepted is a boundary that exists nowhere, so a loader that silently dropped three percent on the way out is invisible. |

## 10. Gaps, Risks & What Is Missing

### What is missing

This component does not exist. The outbound counterpart of the four event-side boundaries. Same omission, opposite direction.

**Priority P1, custom build Medium.**

### Risk

No ranked bottleneck or unowned error path touches this component.

### Gap against the SEI pack

- B.5's three boundaries are inbound. Sent versus accepted is a boundary that exists nowhere, so a loader that silently dropped three percent on the way out is invisible. *(nearest counterpart: BBH dbt Transformation TDD, §B.5)*

## 11. Recommendation

Without the counts, no outbound completeness claim is provable.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For SEI.** Will SEI return accepted and rejected counts per submission, so sent-versus-accepted can be made to tie?

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
- The component appears in the tracker with a status other than Not Started.
