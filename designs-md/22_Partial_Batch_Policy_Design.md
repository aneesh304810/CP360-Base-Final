---
cp360_type: design_document
component_id: 22
component_name: Partial-Batch Policy
zone: 2. Hub
plane: Orchestration
priority: P1
technology: Airflow
custom_build: Medium
depends_on: [18, 23]
status: Not Started
owner: TBD
architecture_decisions: [AD-9]
pipeline_tiers: [Consumer-Movement]
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, orchestration]
origin: SEI-BBH component tracker
sei_coverage: partial
gap_owner: Joint
in_scope: true
---

# Partial-Batch Policy

## 1. Purpose & Scope

**Policy + implementation: halt-all vs per-domain proceed**

Scope as recorded in the component tracker: Custom branching + trigger rules. Publish-completeness marker per domain..

## 2. Context & Dependencies

- Depends on components: 18, 23
- Technology: Airflow
- Custom build: Medium — High means a design document is mandatory before code.
- Source of record: NEW

### The Orchestration plane

**What the pack has.** C.1 specifies the DAG well: three tasks, dynamic task mapping, a deterministic run id, a guarded PENDING to TRIGGER transition, and dim-before-fact with hold-and-replay. For one daily file cycle this is a complete and careful design.

**What it does not.** It assumes a discrete 'everything has arrived' moment. Events never produce one. There is no intraday cadence model, no intraday SLA, no gate that works without interfaces to count, no partial-view policy inside a micro-batch, and no poller for the return leg. Replay is worse than missing — it is specified in terms the event path cannot honour.

**Plane verdict:** 2 of 7 specified · 2 partly · 3 absent.

## 3. Design Decisions

**Review verdict: gap.** Sets policy for partial file batches. Silent on partial view failure inside a micro-batch, which is the equivalent case and the more frequent one.

**Direction.** Safe default is roll back whole; useful default is not. Somebody has to choose, and the choice belongs in this component.

## 4. Detailed Design

**Deliverable.** Policy + implementation: halt-all vs per-domain proceed

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

## 6. Performance & Scale

No performance concern identified for this component under the events-primary assumption.

## 7. Error Handling, Failure & Replay

### E6 · Partial micro-batch failure across views (high)

If three of five views pull successfully and the fourth times out, is the micro-batch FAILED and rolled back whole, or PARTIAL and advanced? Component 22 sets a partial-batch policy for files and says nothing about views inside a box.

**Who owns it today.** Unowned. The safe default is roll back whole; the useful default is not, and somebody has to choose.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

## 9. SEI Source Coverage

**SEI pack coverage: partial** — partly specified — named, not sufficient.
**Who answers for the gap: Joint** — needs both sides.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | §C.4 | touches it, does not specify it | Discovery guardrails and partial-batch behaviour for files. Silent on partial view failure inside a micro-batch, which is the equivalent case and the more frequent one. |

## 10. Gaps, Risks & What Is Missing

### What is missing

Sets policy for partial file batches. Silent on partial view failure inside a micro-batch, which is the equivalent case and the more frequent one.

### Risk

- **HIGH · error path (E6).** Partial micro-batch failure across views.

### Gap against the SEI pack

No absent-coverage citation recorded.

## 11. Recommendation

Safe default is roll back whole; useful default is not. Somebody has to choose, and the choice belongs in this component.

**Action.** E6.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For both sides.** The policy covers partial file batches. What is the policy when three of five views pull successfully inside one micro-batch and the fourth times out?
- **From the tracker.** Can consumers tolerate a partial business date? (AD-5)

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
- Each unowned error path above has a named owner and a disposition in `ERROR_CATALOG`.
