---
cp360_type: design_document
component_id: 30
component_name: Reconciliation Framework
zone: 2. Hub
plane: Foundation
priority: P1
technology: Python
custom_build: High
depends_on: [26, 27, 35]
status: Not Started
owner: TBD
architecture_decisions: [AD-2, AD-6]
pipeline_tiers: [Stage1-Oracle, Stage2-Oracle, Stage3-Exadata-Gold, Consumer-Movement]
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, foundation]
origin: SEI-BBH component tracker
sei_coverage: covered
gap_owner: BBH
in_scope: true
---

# Reconciliation Framework

## 1. Purpose & Scope

**Recon model: control totals, exception lifecycle**

Scope as recorded in the component tracker: Custom recon data model + exception lifecycle + Integration360 publication..

## 2. Context & Dependencies

- Depends on components: 26, 27, 35
- Technology: Python
- Custom build: High — High means a design document is mandatory before code.
- Source of record: Both

### The Foundation plane

**What the pack has.** Quarantine, reconciliation and the configuration store are all genuinely specified — FILE_REGISTRY's lifecycle, dq_validation_failure with resolution_status and reprocess_eligible, RECON_RESULT's three boundaries, FILE_SCHEMA_CONFIG. The error and recovery thinking in D.1 to D.6 is the strongest part of the whole pack.

**What it does not.** Every one of them is inbound and file-shaped. No event dead-letter, no outbound quarantine, nine reconciliation boundaries missing, no schema contract, no expectation model, no loader template registry, no read-only grant, no PII classification, and nine of thirteen Splunk signals with no payload contract. Lineage also degrades permanently under events and the pack does not say so.

**Plane verdict:** 2 of 12 specified · 4 partly · 6 absent.

## 3. Design Decisions

**Review verdict: gap.** Three boundaries, all downstream of Stage 1 and all inbound. The event path adds four upstream of them — events received → distinct keys → rows pulled → Stage 1 loaded — and the outbound path adds five that exist nowhere: generated → validated → submitted → accepted → rejected. Loss in either direction is currently undetectable by construction.

**Direction.** RECON_RESULT's three boundaries are sound and all inbound-downstream. Add four event-side and five outbound. Nine missing boundaries is why loss in either direction is currently undetectable.

## 4. Detailed Design

**Deliverable.** Recon model: control totals, exception lifecycle

### Framework tables this component needs

| Table | State | Purpose |
| --- | --- | --- |
| `DQ_RULE` | new | The rules themselves, as data: which gate, what scope, blocking or advisory, at what threshold. |
| `DQ_RUN_RESULT` | new | Evidence that a rule ran, and what it found — including when it found nothing. |
| `DQ_VALIDATION_FAILURE` | extend | Keep as specified; add three columns. |

## 5. Data Quality, Reconciliation & Lineage

Twelve reconciliation boundaries are required, against the three the pack specifies:

| Group | Boundaries |
| --- | --- |
| Event | `EVENTS_TO_KEYS` · `KEYS_TO_PULLED` · `PULLED_TO_STAGE1` · `STAGE1_TO_MICROBATCH` |
| Pipeline | `STG_TO_INT` · `INT_TO_DIM` · `INT_TO_FACT` |
| Outbound | `GENERATED_TO_VALIDATED` · `VALIDATED_TO_SUBMITTED` · `SUBMITTED_TO_ACKED` · `ACKED_TO_ACCEPTED` · `ACCEPTED_TO_REJECTED` |

## 6. Performance & Scale

No performance concern identified for this component under the events-primary assumption.

## 7. Error Handling, Failure & Replay

### E4 · The gate cannot detect event loss (critical)

A micro-batch that fails at 11am and goes unnoticed means the EOD transformation runs on short Stage 1 — and STG→INT reconciles cleanly, because it ties against a Stage 1 that is itself short. The existing three boundaries are all downstream of the loss and cannot see it.

**Who owns it today.** Requires the four event-side boundaries and a gate that demands every micro-batch LOADED.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

**Open.** A12 grants the loader DML on RAW plus the registry, and DML-only on Gold. No consumer grant is described anywhere in the pack, so a read-only role gets improvised at connection time — which in practice means reusing the loader's account. The masking policy for the 786 PII fields in SDC scope is unapproved.

## 9. SEI Source Coverage

**SEI pack coverage: covered** — specified in the SEI pack.
**Who answers for the gap: BBH** — BBH-owned — do not ask SEI.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH dbt Transformation TDD v2 | §B.5 | touches it, does not specify it | Three boundaries — STG_TO_INT, INT_TO_DIM, INT_TO_FACT — all downstream of Stage 1 and all inbound. |

**Disagreement with §B.5.** Nine more are needed: four upstream on the event path and five outbound. Without the upstream four, event loss is undetectable by construction, because STG_TO_INT ties perfectly against a Stage 1 that is itself short.

## 10. Gaps, Risks & What Is Missing

### What is missing

Three boundaries, all downstream of Stage 1 and all inbound. The event path adds four upstream of them — events received → distinct keys → rows pulled → Stage 1 loaded — and the outbound path adds five that exist nowhere: generated → validated → submitted → accepted → rejected. Loss in either direction is currently undetectable by construction.

### Risk

- **CRITICAL · error path (E4).** The gate cannot detect event loss.

### Gap against the SEI pack

The pack specifies this component. The gap is not in the documentation.

## 11. Recommendation

RECON_RESULT's three boundaries are sound and all inbound-downstream. Add four event-side and five outbound. Nine missing boundaries is why loss in either direction is currently undetectable.

**Action.** Add the four inbound (E4) and the five outbound (M23).

**Foundation-wide.** Five control tables are specified and each is sound on its own. What is absent is anything that spans them, and that absence is why four error vocabularies already exist in one pipeline before a line of event code has been written. Build the four models once, estate-wide, rather than letting each component grow its own.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **From the tracker.** Who owns the recon record? (AD-6)

### Acceptance criteria

- The deliverable above exists and is reviewed.
- Each unowned error path above has a named owner and a disposition in `ERROR_CATALOG`.
