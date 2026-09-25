---
cp360_type: design_document
component_id: 31
component_name: Audit & Lineage
zone: 2. Hub
plane: Foundation
priority: P1
technology: Python + dbt
custom_build: Medium
depends_on: [14, 17]
status: Not Started
owner: TBD
architecture_decisions: [AD-2, AD-8]
pipeline_tiers: [Stage1-Oracle, Stage2-Oracle, Stage3-Exadata-Gold, Consumer-Movement]
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, foundation]
origin: SEI-BBH component tracker
sei_coverage: partial
gap_owner: SEI
in_scope: true
---

# Audit & Lineage

## 1. Purpose & Scope

**End-to-end lineage design, evidence retention**

Scope as recorded in the component tracker: dbt docs covers model lineage only. Custom row-level lineage via LOAD_ID chain..

## 2. Context & Dependencies

- Depends on components: 14, 17
- Technology: Python + dbt
- Custom build: Medium — High means a design document is mandatory before code.
- Source of record: Both

### The Foundation plane

**What the pack has.** Quarantine, reconciliation and the configuration store are all genuinely specified — FILE_REGISTRY's lifecycle, dq_validation_failure with resolution_status and reprocess_eligible, RECON_RESULT's three boundaries, FILE_SCHEMA_CONFIG. The error and recovery thinking in D.1 to D.6 is the strongest part of the whole pack.

**What it does not.** Every one of them is inbound and file-shaped. No event dead-letter, no outbound quarantine, nine reconciliation boundaries missing, no schema contract, no expectation model, no loader template registry, no read-only grant, no PII classification, and nine of thirteen Splunk signals with no payload contract. Lineage also degrades permanently under events and the pack does not say so.

**Plane verdict:** 2 of 12 specified · 4 partly · 6 absent.

## 3. Design Decisions

**Review verdict: degraded.** Because the pull re-reads current state, lineage runs Gold row → micro-batch → key and never Gold row → the specific change that caused it. That is a permanent reduction in what lineage can answer, and it should be stated rather than discovered.

**Direction.** Accept it, and state the event-path limit explicitly: because the pull re-reads current state, lineage runs Gold row to micro-batch to key and never to the change that caused it.

## 4. Detailed Design

**Deliverable.** End-to-end lineage design, evidence retention

### Framework tables this component needs

| Table | State | Purpose |
| --- | --- | --- |
| `DQ_RULE` | new | The rules themselves, as data: which gate, what scope, blocking or advisory, at what threshold. |
| `DQ_RUN_RESULT` | new | Evidence that a rule ran, and what it found — including when it found nothing. |
| `DQ_VALIDATION_FAILURE` | extend | Keep as specified; add three columns. |

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

**SEI pack coverage: partial** — partly specified — named, not sufficient.
**Who answers for the gap: SEI** — SEI must answer.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | §6.2 | touches it, does not specify it | FILE_REGISTRY unique on FILE_NAME plus BUSINESS_DATE, with RETRY_COUNT. |
| BBH File Ingestion Framework TDD v2.0 | §Appendix F | the pack and this design disagree | The glossary says FILE_REGISTRY is versioned per interface and date with one current version. |

**Disagreement with §Appendix F.** §6.2's unique key gives exactly one row; D.1 and D.5 reuse it and D.4 deletes it. History survives only as RETRY_COUNT. Either the schema gains version history or the glossary line goes.

## 10. Gaps, Risks & What Is Missing

### What is missing

Because the pull re-reads current state, lineage runs Gold row → micro-batch → key and never Gold row → the specific change that caused it. That is a permanent reduction in what lineage can answer, and it should be stated rather than discovered.

### Risk

No ranked bottleneck or unowned error path touches this component.

### Gap against the SEI pack

No absent-coverage citation recorded.

## 11. Recommendation

Accept it, and state the event-path limit explicitly: because the pull re-reads current state, lineage runs Gold row to micro-batch to key and never to the change that caused it.

**Action.** State the limit. Add MICROBATCH_ID to carry what remains.

**Foundation-wide.** Five control tables are specified and each is sound on its own. What is absent is anything that spans them, and that absence is why four error vocabularies already exist in one pipeline before a line of event code has been written. Build the four models once, estate-wide, rather than letting each component grow its own.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For SEI.** RAW_*.FILE_REGISTRY_ID is still a proposal. Will it be accepted? Without it, tracing a row back to its delivering file degrades to business-date granularity.
- **From the tracker.** Is lineage audit-defensible under AD-2?

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
