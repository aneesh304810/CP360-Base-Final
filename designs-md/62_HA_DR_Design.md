---
cp360_type: design_document
component_id: 62
component_name: HA / DR
zone: 4. OpenShift
plane: Operations
priority: P2
technology: Infra
custom_build: Low
depends_on: [44]
status: Not Started
owner: TBD
origin: SEI-BBH component tracker
sei_coverage: absent
gap_owner: Joint
in_scope: true
---

# HA / DR

## 1. Purpose & Scope

**DR topology, RTO/RPO for the batch window**

Scope as recorded in the component tracker: Topology design + runbook..

## 2. Context & Dependencies

- Depends on components: 44
- Technology: Infra
- Custom build: Low — High means a design document is mandatory before code.
- Source of record: NEW

## 3. Design Decisions

**Review verdict: gap.** No RPO or RTO anywhere in the pack. Under events, Event Hub retention *is* the recovery window and therefore the RTO — and retention is unstated.

**Direction.** State retention first, then derive RPO and RTO from it. The pack has no DR section at all — D.1 to D.6 are data correction, not disaster recovery.

## 4. Detailed Design

**Deliverable.** DR topology, RTO/RPO for the batch window

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

## 6. Performance & Scale

No performance concern identified for this component under the events-primary assumption.

## 7. Error Handling, Failure & Replay

No unowned error path identified for this component.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

## 9. SEI Source Coverage

**SEI pack coverage: absent** — nothing in the SEI pack.
**Who answers for the gap: Joint** — needs both sides.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH File Ingestion Framework TDD v2.0 | §D.1 | nothing in the pack covers it | D.1 to D.6 are data-correction procedures. There is no disaster recovery section in any document — no RPO, no RTO, no failover for Oracle, OpenShift or the landing zone. |

## 10. Gaps, Risks & What Is Missing

### What is missing

No RPO or RTO anywhere in the pack. Under events, Event Hub retention *is* the recovery window and therefore the RTO — and retention is unstated.

### Risk

No ranked bottleneck or unowned error path touches this component.

### Gap against the SEI pack

- D.1 to D.6 are data-correction procedures. There is no disaster recovery section in any document — no RPO, no RTO, no failover for Oracle, OpenShift or the landing zone. *(nearest counterpart: BBH File Ingestion Framework TDD, §D.1)*

## 11. Recommendation

State retention first, then derive RPO and RTO from it. The pack has no DR section at all — D.1 to D.6 are data correction, not disaster recovery.

**Action.** State retention, then derive RPO and RTO from it rather than the reverse.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For both sides.** What is Event Hub retention? Under events it is the replay window and therefore the RTO, and it is unstated.
- **From the tracker.** What is the agreed RTO/RPO?

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
