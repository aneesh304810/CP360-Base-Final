---
cp360_type: design_document
component_id: 9
component_name: File Arrival Sensors
zone: 2. Hub
plane: Ingress/Egress
priority: P1
technology: Airflow
custom_build: Medium
depends_on: [8, 18]
status: Not Started
owner: TBD
architecture_decisions: [AD-8]
pipeline_tiers: [Stage1-Oracle]
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, ingress-egress]
origin: SEI-BBH component tracker
sei_coverage: covered
gap_owner: Joint
in_scope: true
---

# File Arrival Sensors

## 1. Purpose & Scope

**Per-file sensor design; start-on-arrival not batch-complete**

Scope as recorded in the component tracker: Custom sensor/deferrable operator per domain. Base sensors do not know your manifest..

## 2. Context & Dependencies

- Depends on components: 8, 18
- Technology: Airflow
- Custom build: Medium — High means a design document is mandatory before code.
- Source of record: NEW

## 3. Design Decisions

**Review verdict: demoted.** Deferrable sensors idling all day for a path that now only needs to prove a file was generated and held. The registry gains no state meaning 'available and deliberately unused', so a standby file looks either permanently missing or falsely satisfies a gate that should not be running.

**Direction.** Add the state. Without it a standby file looks either permanently missing or falsely satisfies a gate that should not be running.

## 4. Detailed Design

**Deliverable.** Per-file sensor design; start-on-arrival not batch-complete

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

## 6. Performance & Scale

No performance concern identified for this component under the events-primary assumption.

## 7. Error Handling, Failure & Replay

No unowned error path identified for this component.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

## 9. SEI Source Coverage

**SEI pack coverage: covered** — specified in the SEI pack.
**Who answers for the gap: Joint** — needs both sides.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | §C.1 | specifies this component | The three-task DAG: discover_work_items, process_file.expand(...), evaluate_completeness_and_sla under trigger_rule='all_done'. |
| BBH File Ingestion Framework TDD v2.0 | §C.4 | touches it, does not specify it | Three guardrails, of which 'no large file contents through XCom' is the one that constrains the loader's shape. |

## 10. Gaps, Risks & What Is Missing

### What is missing

Deferrable sensors idling all day for a path that now only needs to prove a file was generated and held. The registry gains no state meaning 'available and deliberately unused', so a standby file looks either permanently missing or falsely satisfies a gate that should not be running.

### Risk

No ranked bottleneck or unowned error path touches this component.

### Gap against the SEI pack

The pack specifies this component. The gap is not in the documentation.

## 11. Recommendation

Add the state. Without it a standby file looks either permanently missing or falsely satisfies a gate that should not be running.

**Action.** Add the state. Reduce the sensor to a readiness check.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For both sides.** Under events the files are standby. Is there a registry state meaning 'available and deliberately unused'?
- **From the tracker.** Manifest-driven or filename pattern?

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
