---
cp360_type: design_document
component_id: 68
component_name: Loader Submission Registry
zone: 2. Hub
plane: Ingress/Egress
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

# Loader Submission Registry

## 1. Purpose & Scope

**LOADER_SUBMISSION · LOADER_STATUS_HISTORY (with SOURCE) · LOADER_ERROR**

The outbound path has no FILE_REGISTRY equivalent anywhere in the pack or the 65.

This component does not exist in the SEI design pack and has no entry in the original 65-component tracker. It is required by one substituted assumption: **SDC events are the primary ingestion path**, with everything from Stage 1 onward exactly as the pack specifies it.

## 2. Context & Dependencies

- Technology: Oracle DDL + Python
- Custom build: High — High means a design document is mandatory before code.
- Source of record: Architect review — events-primary

## 3. Design Decisions

No prior design decisions exist — this component has never been specified.

**Direction.** BBH-owned. Record the submission at send time — without that row, a submission that never reached SEI is indistinguishable from one that succeeded.

## 4. Detailed Design

**Deliverable.** LOADER_SUBMISSION · LOADER_STATUS_HISTORY (with SOURCE) · LOADER_ERROR

**Technology.** Oracle DDL + Python

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

## 6. Performance & Scale

Error detail is fetched once on reaching terminal-with-errors, paginated and stored. Re-fetching per poll pulls the same rejected records repeatedly.

## 7. Error Handling, Failure & Replay

Without a row written at send time, a submission that never reached SEI is indistinguishable from one that succeeded. Silence looks exactly like success.
### E11 · Outbound has no error model at all (medium)

Loader submissions have no registry, no status history, no error store and no correction protocol. A retry reuses the submission id; a correction is a new submission that references the one it corrects. Neither is defined.

**Who owns it today.** The whole outbound half of the estate.
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
| BBH File Ingestion Framework TDD v2.0 | §6.2 | nothing in the pack covers it | FILE_REGISTRY is the inbound record of a file. The outbound path has no submission registry, so a submission that never reached SEI is indistinguishable from one that succeeded. |

## 10. Gaps, Risks & What Is Missing

### What is missing

This component does not exist. The outbound path has no FILE_REGISTRY equivalent anywhere in the pack or the 65.

**Priority P1, custom build High.**

### Risk

- **MEDIUM · error path (E11).** Outbound has no error model at all.
- **HIGH · error path (E14).** No record of what was actually sent.

### Gap against the SEI pack

- FILE_REGISTRY is the inbound record of a file. The outbound path has no submission registry, so a submission that never reached SEI is indistinguishable from one that succeeded. *(nearest counterpart: BBH File Ingestion Framework TDD, §6.2)*

## 11. Recommendation

BBH-owned. Record the submission at send time — without that row, a submission that never reached SEI is indistinguishable from one that succeeded.

## 12. Open Questions & Acceptance Criteria

### Open questions

None outstanding.

### Acceptance criteria

- The deliverable above exists and is reviewed.
- Each unowned error path above has a named owner and a disposition in `ERROR_CATALOG`.
- The component appears in the tracker with a status other than Not Started.
