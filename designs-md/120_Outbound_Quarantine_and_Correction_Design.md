---
cp360_type: design_document
component_id: 120
component_name: Outbound Quarantine & Correction
zone: 2. Hub
plane: Foundation
priority: P1
technology: Python · Oracle
custom_build: High
depends_on: []
status: Not Started
owner: TBD
origin: events-primary architect review
sei_coverage: absent
gap_owner: SEI
in_scope: true
---

# Outbound Quarantine & Correction

## 1. Purpose & Scope

**Rejected records held, with the correction protocol and resubmission lineage**

Component 29 quarantines inbound files. Rejected outbound records have nowhere to go and no defined route back.

This component does not exist in the SEI design pack and has no entry in the original 65-component tracker. It is required by one substituted assumption: **SDC events are the primary ingestion path**, with everything from Stage 1 onward exactly as the pack specifies it.

## 2. Context & Dependencies

- Technology: Python · Oracle
- Custom build: High — High means a design document is mandatory before code.
- Source of record: Architect review — events-primary

### The Foundation plane

**What the pack has.** Quarantine, reconciliation and the configuration store are all genuinely specified — FILE_REGISTRY's lifecycle, dq_validation_failure with resolution_status and reprocess_eligible, RECON_RESULT's three boundaries, FILE_SCHEMA_CONFIG. The error and recovery thinking in D.1 to D.6 is the strongest part of the whole pack.

**What it does not.** Every one of them is inbound and file-shaped. No event dead-letter, no outbound quarantine, nine reconciliation boundaries missing, no schema contract, no expectation model, no loader template registry, no read-only grant, no PII classification, and nine of thirteen Splunk signals with no payload contract. Lineage also degrades permanently under events and the pack does not say so.

**Plane verdict:** 2 of 12 specified · 4 partly · 6 absent.

## 3. Design Decisions

No prior design decisions exist — this component has never been specified.

**Direction.** Model retry and correction as different operations. A retry reuses the submission id; a correction is a new submission carrying corrects_submission_id.

## 4. Detailed Design

**Deliverable.** Rejected records held, with the correction protocol and resubmission lineage

**Technology.** Python · Oracle

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

## 6. Performance & Scale

n/a

## 7. Error Handling, Failure & Replay

A retry and a correction are different operations. A retry reuses the submission identifier because the same payload goes again; a correction is a new submission carrying corrects_submission_id, because the payload changed. Collapsing the two makes sent-versus-accepted unprovable.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

**Open.** A12 grants the loader DML on RAW plus the registry, and DML-only on Gold. No consumer grant is described anywhere in the pack, so a read-only role gets improvised at connection time — which in practice means reusing the loader's account. The masking policy for the 786 PII fields in SDC scope is unapproved.

## 9. SEI Source Coverage

**SEI pack coverage: absent** — nothing in the SEI pack.
**Who answers for the gap: SEI** — SEI must answer.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | §D.2 | nothing in the pack covers it | D.2 quarantines an inbound file. Rejected outbound records have nowhere to go and no defined route back. |

## 10. Gaps, Risks & What Is Missing

### What is missing

This component does not exist. Component 29 quarantines inbound files. Rejected outbound records have nowhere to go and no defined route back.

**Priority P1, custom build High.**

### Risk

No ranked bottleneck or unowned error path touches this component.

### Gap against the SEI pack

- D.2 quarantines an inbound file. Rejected outbound records have nowhere to go and no defined route back. *(nearest counterpart: BBH File Ingestion Framework TDD, §D.2)*

## 11. Recommendation

Model retry and correction as different operations. A retry reuses the submission id; a correction is a new submission carrying corrects_submission_id.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For SEI.** What is the correction protocol for a loader BBH sent wrongly? Does a corrected submission reference the original, and does SEI supersede or duplicate?

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
- The component appears in the tracker with a status other than Not Started.
