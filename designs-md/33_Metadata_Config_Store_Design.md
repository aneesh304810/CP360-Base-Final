---
cp360_type: design_document
component_id: 33
component_name: Metadata & Configuration Store
zone: 2. Hub
plane: Foundation
priority: P1
technology: Oracle DDL + Python
custom_build: High
depends_on: [6, 28]
status: Not Started
owner: TBD
architecture_decisions: [AD-6, AD-9, AD-2]
pipeline_tiers: [Stage1-Oracle, Stage2-Oracle, Stage3-Exadata-Gold, Consumer-Movement]
last_updated: 2026-08-10
tags: [SEI-BBH, Integration-Hub, hub, foundation, config]
origin: SEI-BBH component tracker
sei_coverage: partial
gap_owner: Joint
in_scope: true
---

# Metadata & Configuration Store

## 1. Purpose & Scope

**Config model: rules, thresholds, mappings, schedules**

Scope as recorded in the component tracker: CORE BUILD. Everything config-driven depends on this. Build first..

## 2. Context & Dependencies

- Depends on components: 6, 28
- Technology: Oracle DDL + Python
- Custom build: High — High means a design document is mandatory before code.
- Source of record: Both

### The Foundation plane

**What the pack has.** Quarantine, reconciliation and the configuration store are all genuinely specified — FILE_REGISTRY's lifecycle, dq_validation_failure with resolution_status and reprocess_eligible, RECON_RESULT's three boundaries, FILE_SCHEMA_CONFIG. The error and recovery thinking in D.1 to D.6 is the strongest part of the whole pack.

**What it does not.** Every one of them is inbound and file-shaped. No event dead-letter, no outbound quarantine, nine reconciliation boundaries missing, no schema contract, no expectation model, no loader template registry, no read-only grant, no PII classification, and nine of thirteen Splunk signals with no payload contract. Lineage also degrades permanently under events and the pack does not say so.

**Plane verdict:** 2 of 12 specified · 4 partly · 6 absent.

## 3. Design Decisions

**Review verdict: amend.** Needs three new catalogues: the view catalogue, the eventid → domain/view map, and the expectation store.

**Direction.** Three new catalogues land here: M17, M18 and M19. Config, not code — an unknown value should raise, never be silently mapped.

## 4. Detailed Design

**Deliverable.** Config model: rules, thresholds, mappings, schedules

### Framework tables this component needs

| Table | State | Purpose |
| --- | --- | --- |
| `GUARDRAIL_POLICY` | new | Every threshold and limit in the platform, in one versioned place. |
| `CIRCUIT_BREAKER_STATE` | new | Stops a failing dependency being hammered by a fixed cadence. |

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
**Who answers for the gap: Joint** — needs both sides.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | §6.1 | touches it, does not specify it | FILE_SCHEMA_CONFIG — the only configuration store in the pack, and it covers file metadata only. |

## 10. Gaps, Risks & What Is Missing

### What is missing

Needs three new catalogues: the view catalogue, the eventid → domain/view map, and the expectation store.

### Risk

No ranked bottleneck or unowned error path touches this component.

### Gap against the SEI pack

No absent-coverage citation recorded.

## 11. Recommendation

Three new catalogues land here: M17, M18 and M19. Config, not code — an unknown value should raise, never be silently mapped.

**Action.** M17 and M18 land here.

**Foundation-wide.** Five control tables are specified and each is sound on its own. What is absent is anything that spans them, and that absence is why four error vocabularies already exist in one pipeline before a line of event code has been written. Build the four models once, estate-wide, rather than letting each component grow its own.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For both sides.** FILE_SCHEMA_CONFIG covers file metadata. Where do the view catalogue, the eventid map and the interface calendar live?
- **From the tracker.** One store, or does SEI keep its own? (risk R1)

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
