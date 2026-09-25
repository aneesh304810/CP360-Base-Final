---
cp360_type: design_document
component_id: 124
component_name: Schema Contract Registry
zone: 2. Hub
plane: Foundation
priority: P1
technology: Oracle DDL + CI
custom_build: Medium
depends_on: []
status: Not Started
owner: TBD
origin: events-primary architect review
sei_coverage: absent
gap_owner: SEI
in_scope: true
---

# Schema Contract Registry

## 1. Purpose & Scope

**Per-view column contract, versioned, checked before the pull is trusted**

The most predictable future incident in the pack, and nothing watches for it.

This component does not exist in the SEI design pack and has no entry in the original 65-component tracker. It is required by one substituted assumption: **SDC events are the primary ingestion path**, with everything from Stage 1 onward exactly as the pack specifies it.

## 2. Context & Dependencies

- Technology: Oracle DDL + CI
- Custom build: Medium — High means a design document is mandatory before code.
- Source of record: Architect review — events-primary

### The Foundation plane

**What the pack has.** Quarantine, reconciliation and the configuration store are all genuinely specified — FILE_REGISTRY's lifecycle, dq_validation_failure with resolution_status and reprocess_eligible, RECON_RESULT's three boundaries, FILE_SCHEMA_CONFIG. The error and recovery thinking in D.1 to D.6 is the strongest part of the whole pack.

**What it does not.** Every one of them is inbound and file-shaped. No event dead-letter, no outbound quarantine, nine reconciliation boundaries missing, no schema contract, no expectation model, no loader template registry, no read-only grant, no PII classification, and nine of thirteen Splunk signals with no payload contract. Lineage also degrades permanently under events and the pack does not say so.

**Plane verdict:** 2 of 12 specified · 4 partly · 6 absent.

## 3. Design Decisions

No prior design decisions exist — this component has never been specified.

**Direction.** Two individually sound decisions — RAW DDL as the contract, and on_schema_change='fail' — are jointly a production incident with no owner. This registry is the guard.

## 4. Detailed Design

**Deliverable.** Per-view column contract, versioned, checked before the pull is trusted

**Technology.** Oracle DDL + CI

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

## 6. Performance & Scale

One cached read per view per run.

## 7. Error Handling, Failure & Replay

FILE_SCHEMA_CONFIG holds no column mapping, so RAW DDL is the schema contract, while Gold runs on_schema_change='fail'. A column added upstream breaks the pipeline by design with no notification path. This component is the guard.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

**Open.** A12 grants the loader DML on RAW plus the registry, and DML-only on Gold. No consumer grant is described anywhere in the pack, so a read-only role gets improvised at connection time — which in practice means reusing the loader's account. The masking policy for the 786 PII fields in SDC scope is unapproved.

## 9. SEI Source Coverage

**SEI pack coverage: absent** — nothing in the SEI pack.
**Who answers for the gap: SEI** — SEI must answer.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | §6.1 | nothing in the pack covers it | §6.1 makes the RAW DDL the schema contract by holding no column mapping, and Gold runs on_schema_change='fail'. No section describes how a schema change is notified, with what lead time or what compatibility rule. |

## 10. Gaps, Risks & What Is Missing

### What is missing

This component does not exist. The most predictable future incident in the pack, and nothing watches for it.

**Priority P1, custom build Medium.**

### Risk

No ranked bottleneck or unowned error path touches this component.

### Gap against the SEI pack

- §6.1 makes the RAW DDL the schema contract by holding no column mapping, and Gold runs on_schema_change='fail'. No section describes how a schema change is notified, with what lead time or what compatibility rule. *(nearest counterpart: BBH File Ingestion Framework TDD, §6.1)*

## 11. Recommendation

Two individually sound decisions — RAW DDL as the contract, and on_schema_change='fail' — are jointly a production incident with no owner. This registry is the guard.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For SEI.** There is no schema-change protocol anywhere in the pack. How is a change notified, with what lead time, and what is the backward-compatibility rule?

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
- The component appears in the tracker with a status other than Not Started.
