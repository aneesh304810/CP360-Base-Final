---
cp360_type: design_document
component_id: 34
component_name: Observability
zone: 2. Hub
plane: Foundation
priority: P2
technology: Infra
custom_build: Low
depends_on: [64]
status: Not Started
owner: TBD
architecture_decisions: []
pipeline_tiers: [Stage1-Oracle, Stage2-Oracle, Stage3-Exadata-Gold, Consumer-Movement]
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, foundation, splunk, cp360]
origin: SEI-BBH component tracker
sei_coverage: partial
gap_owner: Joint
in_scope: true
---

# Observability

## 1. Purpose & Scope

**Logs, metrics, traces; SLIs and alerting**

Scope as recorded in the component tracker: Standard stack + custom metric emission from Python/Airflow..

## 2. Context & Dependencies

- Depends on components: 64
- Technology: Infra
- Custom build: Low — High means a design document is mandatory before code.
- Source of record: BBH V4.2

### The Foundation plane

**What the pack has.** Quarantine, reconciliation and the configuration store are all genuinely specified — FILE_REGISTRY's lifecycle, dq_validation_failure with resolution_status and reprocess_eligible, RECON_RESULT's three boundaries, FILE_SCHEMA_CONFIG. The error and recovery thinking in D.1 to D.6 is the strongest part of the whole pack.

**What it does not.** Every one of them is inbound and file-shaped. No event dead-letter, no outbound quarantine, nine reconciliation boundaries missing, no schema contract, no expectation model, no loader template registry, no read-only grant, no PII classification, and nine of thirteen Splunk signals with no payload contract. Lineage also degrades permanently under events and the pack does not say so.

**Plane verdict:** 2 of 12 specified · 4 partly · 6 absent.

## 3. Design Decisions

**Review verdict: gap.** No consumer lag, no sequence gap detection, no micro-batch state. The primary ingestion path is unobserved, and Splunk volume is about to change order of magnitude.

**Direction.** Define the nine, add the event-channel signals, and decide the rollup before the Splunk contract is written — thirteen signals times 288 cycles times domains is a different order of magnitude.

## 4. Detailed Design

**Deliverable.** Logs, metrics, traces; SLIs and alerting

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

## 6. Performance & Scale

### B9 · Splunk ingest volume (medium)

Thirteen operational signals, multiplied by 288 cycles and by domain, is a different order of magnitude from a daily file pipeline. Splunk ingest is metered and rate limited.

**What to do.** Emit per micro-batch only what is actionable; aggregate the rest to a per-cycle or per-hour rollup. Decide this before the contract is written, not after the first bill.

## 7. Error Handling, Failure & Replay

No unowned error path identified for this component.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

**Open.** A12 grants the loader DML on RAW plus the registry, and DML-only on Gold. No consumer grant is described anywhere in the pack, so a read-only role gets improvised at connection time — which in practice means reusing the loader's account. The masking policy for the 786 PII fields in SDC scope is unapproved.

## 9. SEI Source Coverage

**SEI pack coverage: partial** — partly specified — named, not sufficient.
**Who answers for the gap: Joint** — needs both sides.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | §8.1 | touches it, does not specify it | Thirteen operational signals, files_discovered through transformation_triggered. |
| BBH File Ingestion Framework TDD v2.0 | §E.6 | the pack and this design disagree | Splunk contract for four events, correlation key of event type plus business date, and an explicit prohibition on adding SLA_STATUS, SLA_BREACH_IND or ALERT_SENT_IND to DATE_CONTROL. |

**Disagreement with §E.6.** Nine of the thirteen signals have no payload contract, and none of the thirteen covers the event channel — the primary ingestion path has no observability contract at all.

## 10. Gaps, Risks & What Is Missing

### What is missing

No consumer lag, no sequence gap detection, no micro-batch state. The primary ingestion path is unobserved, and Splunk volume is about to change order of magnitude.

### Risk

- **MEDIUM · performance (B9).** Splunk ingest volume.

### Gap against the SEI pack

No absent-coverage citation recorded.

## 11. Recommendation

Define the nine, add the event-channel signals, and decide the rollup before the Splunk contract is written — thirteen signals times 288 cycles times domains is a different order of magnitude.

**Action.** M16, M10, B9.

**Foundation-wide.** Five control tables are specified and each is sound on its own. What is absent is anything that spans them, and that absence is why four error vocabularies already exist in one pipeline before a line of event code has been written. Build the four models once, estate-wide, rather than letting each component grow its own.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For both sides.** E.6 defines required context for four Splunk events; §8.1 lists thirteen. Nine have no payload contract, and none of the thirteen covers the event channel. Is that intended?
- **From the tracker.** What are the SLOs for the EOD window?

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
- The bottleneck above has a measured figure at production volume, not an estimate.
