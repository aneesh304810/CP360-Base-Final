---
cp360_type: design_document
component_id: 29
component_name: Error Handling & Quarantine
zone: 2. Hub
plane: Foundation
priority: P1
technology: Python
custom_build: High
depends_on: [23, 50]
status: Not Started
owner: TBD
architecture_decisions: [AD-2, AD-8]
pipeline_tiers: [Stage1-Oracle, Stage2-Oracle]
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, foundation]
origin: SEI-BBH component tracker
sei_coverage: covered
gap_owner: BBH
in_scope: true
---

# Error Handling & Quarantine

## 1. Purpose & Scope

**Error taxonomy, quarantine store, resubmission path**

Scope as recorded in the component tracker: Custom taxonomy + quarantine lifecycle + resubmission path..

## 2. Context & Dependencies

- Depends on components: 23, 50
- Technology: Python
- Custom build: High — High means a design document is mandatory before code.
- Source of record: Both

### The Foundation plane

**What the pack has.** Quarantine, reconciliation and the configuration store are all genuinely specified — FILE_REGISTRY's lifecycle, dq_validation_failure with resolution_status and reprocess_eligible, RECON_RESULT's three boundaries, FILE_SCHEMA_CONFIG. The error and recovery thinking in D.1 to D.6 is the strongest part of the whole pack.

**What it does not.** Every one of them is inbound and file-shaped. No event dead-letter, no outbound quarantine, nine reconciliation boundaries missing, no schema contract, no expectation model, no loader template registry, no read-only grant, no PII classification, and nine of thirteen Splunk signals with no payload contract. Lineage also degrades permanently under events and the pack does not say so.

**Plane verdict:** 2 of 12 specified · 4 partly · 6 absent.

## 3. Design Decisions

**Review verdict: gap.** A file quarantine. The event path has no dead-letter, so a poison envelope has no escape and stalls its partition.

**Direction.** The pack specifies a file quarantine well. Extend it: an event dead-letter with a reason taxonomy, and an outbound quarantine for rejected records. Neither exists.

## 4. Detailed Design

**Deliverable.** Error taxonomy, quarantine store, resubmission path

### Framework tables this component needs

| Table | State | Purpose |
| --- | --- | --- |
| `ERROR_CATALOG` | new | The error vocabulary, as reference data rather than string literals at call sites. |
| `ERROR_EVENT` | new | Every error instance in one place, whatever produced it. |
| `EVENT_DEAD_LETTER` | new | The event path's quarantine. Holds the envelope, its position and why it could not be processed. |
| `OUTBOUND_ERROR` | new | Rejections, from both sides: what G6 refused to send, and what SEI refused to accept. |

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

## 6. Performance & Scale

No performance concern identified for this component under the events-primary assumption.

## 7. Error Handling, Failure & Replay

No unowned error path identified for this component.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

**Open.** A12 grants the loader DML on RAW plus the registry, and DML-only on Gold. No consumer grant is described anywhere in the pack, so a read-only role gets improvised at connection time — which in practice means reusing the loader's account. The masking policy for the 786 PII fields in SDC scope is unapproved.

## 9. SEI Source Coverage

**SEI pack coverage: covered** — specified in the SEI pack.
**Who answers for the gap: BBH** — BBH-owned — do not ask SEI.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | §D.2 | specifies this component | QUARANTINED recovery for a file. |
| BBH File Ingestion Framework TDD v2.0 | §D.6 | specifies this component | Stale in-progress recovery — a registry row left at LOADING past the timeout. |
| BBH File Ingestion Framework TDD v2.0 | whole document | nothing in the pack covers it | No event dead-letter and no outbound quarantine. With at-least-once delivery and ordering inside a partition, one unprocessable envelope stalls that partition permanently and redelivery keeps returning it. |

## 10. Gaps, Risks & What Is Missing

### What is missing

A file quarantine. The event path has no dead-letter, so a poison envelope has no escape and stalls its partition.

### Risk

No ranked bottleneck or unowned error path touches this component.

### Gap against the SEI pack

- No event dead-letter and no outbound quarantine. With at-least-once delivery and ordering inside a partition, one unprocessable envelope stalls that partition permanently and redelivery keeps returning it. *(nearest counterpart: BBH File Ingestion Framework TDD, no section — the whole document)*

## 11. Recommendation

The pack specifies a file quarantine well. Extend it: an event dead-letter with a reason taxonomy, and an outbound quarantine for rejected records. Neither exists.

**Action.** M15 — the highest-value single addition in this review.

**Foundation-wide.** Five control tables are specified and each is sound on its own. What is absent is anything that spans them, and that absence is why four error vocabularies already exist in one pipeline before a line of event code has been written. Build the four models once, estate-wide, rather than letting each component grow its own.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **From the tracker.** Quarantine retention and reprocessing route?

### Acceptance criteria

- The deliverable above exists and is reviewed.
