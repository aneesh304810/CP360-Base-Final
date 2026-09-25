---
cp360_type: design_document
component_id: 11
component_name: Apigee Proxy
zone: 2. Hub
plane: Ingress/Egress
priority: P3
technology: Vendor/Infra
custom_build: Low
depends_on: [10, 35]
status: Not Started
owner: TBD
architecture_decisions: [AD-11]
pipeline_tiers: []
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, ingress-egress, api]
origin: SEI-BBH component tracker
sei_coverage: partial
gap_owner: Joint
in_scope: true
---

# Apigee Proxy

## 1. Purpose & Scope

**Proxy design: submit path + status-return path**

Scope as recorded in the component tracker: Proxy config + policies. No application code..

## 2. Context & Dependencies

- Depends on components: 10, 35
- Technology: Vendor/Infra
- Custom build: Low — High means a design document is mandatory before code.
- Source of record: SEI v5

## 3. Design Decisions

No review finding against this component: the events-primary substitution does not change it.

**Direction.** Settle AD-3 before the callback receiver is built; it decides auth, rate limits and who owns the error envelope.

## 4. Detailed Design

**Deliverable.** Proxy design: submit path + status-return path

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

## 6. Performance & Scale

No performance concern identified for this component under the events-primary assumption.

## 7. Error Handling, Failure & Replay

No unowned error path identified for this component.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

## 9. SEI Source Coverage

**SEI pack coverage: partial** — partly specified — named, not sufficient.
**Who answers for the gap: Joint** — needs both sides.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| SEI-BBH Integration Architecture v5 | whole document | touches it, does not specify it | Node 12, the Apigee proxy, on both the submit and status-return paths. Whether it is a decision or a placeholder is open as AD-3. |

## 10. Gaps, Risks & What Is Missing

### What is missing

Nothing identified. The component is specified and the events-primary substitution does not change it.

### Risk

No ranked bottleneck or unowned error path touches this component.

### Gap against the SEI pack

No absent-coverage citation recorded.

## 11. Recommendation

Settle AD-3 before the callback receiver is built; it decides auth, rate limits and who owns the error envelope.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For both sides.** Is Apigee a firm decision or a placeholder (AD-3), and does it front both the submit path and the status-return path?
- **From the tracker.** Is Apigee a decision or a placeholder? (AD-3)

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
