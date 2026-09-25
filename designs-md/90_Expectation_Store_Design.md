---
cp360_type: design_document
component_id: 90
component_name: Expectation Store
zone: 2. Hub
plane: Foundation
priority: P1
technology: Oracle DDL
custom_build: Medium
depends_on: []
status: Not Started
owner: TBD
origin: events-primary architect review
sei_coverage: absent
gap_owner: Joint
in_scope: true
---

# Expectation Store

## 1. Purpose & Scope

**Interface calendar, loader cadence, marker schedule, event cadence baseline**

EXPECTED_INTERFACE_CALENDAR and REQUIRED_IND are still proposals, and no channel has an expectation model.

This component does not exist in the SEI design pack and has no entry in the original 65-component tracker. It is required by one substituted assumption: **SDC events are the primary ingestion path**, with everything from Stage 1 onward exactly as the pack specifies it.

## 2. Context & Dependencies

- Technology: Oracle DDL
- Custom build: Medium — High means a design document is mandatory before code.
- Source of record: Architect review — events-primary

### The Foundation plane

**What the pack has.** Quarantine, reconciliation and the configuration store are all genuinely specified — FILE_REGISTRY's lifecycle, dq_validation_failure with resolution_status and reprocess_eligible, RECON_RESULT's three boundaries, FILE_SCHEMA_CONFIG. The error and recovery thinking in D.1 to D.6 is the strongest part of the whole pack.

**What it does not.** Every one of them is inbound and file-shaped. No event dead-letter, no outbound quarantine, nine reconciliation boundaries missing, no schema contract, no expectation model, no loader template registry, no read-only grant, no PII classification, and nine of thirteen Splunk signals with no payload contract. Lineage also degrades permanently under events and the pack does not say so.

**Plane verdict:** 2 of 12 specified · 4 partly · 6 absent.

## 3. Design Decisions

No prior design decisions exist — this component has never been specified.

**Direction.** The single largest dependency in the P list. Without it, 'what was expected today' is wrong every weekend and holiday, and false missing interfaces are worse than no report.

## 4. Detailed Design

**Deliverable.** Interface calendar, loader cadence, marker schedule, event cadence baseline

**Technology.** Oracle DDL

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

## 6. Performance & Scale

n/a

## 7. Error Handling, Failure & Replay

Without it nothing can be late, only absent. On the event channel lateness is derivable from the stream's own rhythm; on every other channel it needs a stated expectation.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

**Open.** A12 grants the loader DML on RAW plus the registry, and DML-only on Gold. No consumer grant is described anywhere in the pack, so a read-only role gets improvised at connection time — which in practice means reusing the loader's account. The masking policy for the 786 PII fields in SDC scope is unapproved.

## 9. SEI Source Coverage

**SEI pack coverage: absent** — nothing in the SEI pack.
**Who answers for the gap: Joint** — needs both sides.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | §5.2 | nothing in the pack covers it | §5.2 leans on required-versus-optional interfaces twice, and §6.1's field list has no such column. EXPECTED_INTERFACE_CALENDAR and REQUIRED_IND remain proposals. |

## 10. Gaps, Risks & What Is Missing

### What is missing

This component does not exist. EXPECTED_INTERFACE_CALENDAR and REQUIRED_IND are still proposals, and no channel has an expectation model.

**Priority P1, custom build Medium.**

### Risk

No ranked bottleneck or unowned error path touches this component.

### Gap against the SEI pack

- §5.2 leans on required-versus-optional interfaces twice, and §6.1's field list has no such column. EXPECTED_INTERFACE_CALENDAR and REQUIRED_IND remain proposals. *(nearest counterpart: BBH File Ingestion Framework TDD, §5.2)*

## 11. Recommendation

The single largest dependency in the P list. Without it, 'what was expected today' is wrong every weekend and holiday, and false missing interfaces are worse than no report.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For both sides.** EXPECTED_INTERFACE_CALENDAR and REQUIRED_IND are still proposals. Will they be accepted, and what is each interface's cadence and holiday calendar?

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
- The component appears in the tracker with a status other than Not Started.
