---
cp360_type: design_document
component_id: 117
component_name: Loader Template Registry
zone: 2. Hub
plane: Foundation
priority: P1
technology: Oracle DDL + Python
custom_build: High
depends_on: []
status: Not Started
owner: TBD
origin: events-primary architect review
sei_coverage: absent
gap_owner: SEI
in_scope: true
---

# Loader Template Registry

## 1. Purpose & Scope

**The 24 SEI loader templates, versioned, with attribute obligation and validation rules**

Data 360 holds the loader definitions with every attribute typed Mandatory, Conditional or Optional plus its validations. Nothing in the Hub reads them, so those obligations exist only as documentation.

This component does not exist in the SEI design pack and has no entry in the original 65-component tracker. It is required by one substituted assumption: **SDC events are the primary ingestion path**, with everything from Stage 1 onward exactly as the pack specifies it.

## 2. Context & Dependencies

- Technology: Oracle DDL + Python
- Custom build: High — High means a design document is mandatory before code.
- Source of record: Architect review — events-primary

### The Foundation plane

**What the pack has.** Quarantine, reconciliation and the configuration store are all genuinely specified — FILE_REGISTRY's lifecycle, dq_validation_failure with resolution_status and reprocess_eligible, RECON_RESULT's three boundaries, FILE_SCHEMA_CONFIG. The error and recovery thinking in D.1 to D.6 is the strongest part of the whole pack.

**What it does not.** Every one of them is inbound and file-shaped. No event dead-letter, no outbound quarantine, nine reconciliation boundaries missing, no schema contract, no expectation model, no loader template registry, no read-only grant, no PII classification, and nine of thirteen Splunk signals with no payload contract. Lineage also degrades permanently under events and the pack does not say so.

**Plane verdict:** 2 of 12 specified · 4 partly · 6 absent.

## 3. Design Decisions

No prior design decisions exist — this component has never been specified.

**Direction.** Pin the version in force at generation onto every submission, or an error returned next week cannot be read against the template that produced it.

## 4. Detailed Design

**Deliverable.** The 24 SEI loader templates, versioned, with attribute obligation and validation rules

**Technology.** Oracle DDL + Python

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

## 6. Performance & Scale

Cached per run. One read per loader type, never per record.

## 7. Error Handling, Failure & Replay

The template version in force at generation must be pinned onto the submission. An error SEI returns against last week’s submission can only be read against the version in force that day — and the catalogue already shows v1.24, v1.21 and v9 live together.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

**Open.** A12 grants the loader DML on RAW plus the registry, and DML-only on Gold. No consumer grant is described anywhere in the pack, so a read-only role gets improvised at connection time — which in practice means reusing the loader's account. The masking policy for the 786 PII fields in SDC scope is unapproved.

## 9. SEI Source Coverage

**SEI pack coverage: absent** — nothing in the SEI pack.
**Who answers for the gap: SEI** — SEI must answer.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| SEI-BBH Integration Architecture v5 | whole document | nothing in the pack covers it | The 24 loader templates live in Data 360, not in the design pack. No section covers template versioning or the change protocol, and v1.24, v1.21 and v9 are live together. |

## 10. Gaps, Risks & What Is Missing

### What is missing

This component does not exist. Data 360 holds the loader definitions with every attribute typed Mandatory, Conditional or Optional plus its validations. Nothing in the Hub reads them, so those obligations exist only as documentation.

**Priority P1, custom build High.**

### Risk

No ranked bottleneck or unowned error path touches this component.

### Gap against the SEI pack

- The 24 loader templates live in Data 360, not in the design pack. No section covers template versioning or the change protocol, and v1.24, v1.21 and v9 are live together. *(nearest counterpart: SEI-BBH Integration Architecture, no section — the whole document)*

## 11. Recommendation

Pin the version in force at generation onto every submission, or an error returned next week cannot be read against the template that produced it.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For SEI.** The loader templates live in Data 360, not in the design pack. How is a template version change communicated, and how long are two versions supported? The catalogue shows v1.24, v1.21 and v9 live together.

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
- The component appears in the tracker with a status other than Not Started.
