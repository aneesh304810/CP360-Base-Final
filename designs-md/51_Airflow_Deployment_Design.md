---
cp360_type: design_document
component_id: 51
component_name: Airflow Deployment
zone: 4. OpenShift
plane: Runtime
priority: P1
technology: Infra + Airflow
custom_build: Medium
depends_on: [18]
status: Not Started
owner: TBD
origin: SEI-BBH component tracker
sei_coverage: unassessed
gap_owner: unassessed
in_scope: true
---

# Airflow Deployment

## 1. Purpose & Scope

**Scheduler HA, KubernetesExecutor, pod operator design**

Scope as recorded in the component tracker: Helm values + custom pod templates per task type..

## 2. Context & Dependencies

- Depends on components: 18
- Technology: Infra + Airflow
- Custom build: Medium — High means a design document is mandatory before code.
- Source of record: NEW

## 3. Design Decisions

No review finding against this component: the events-primary substitution does not change it.

## 4. Detailed Design

**Deliverable.** Scheduler HA, KubernetesExecutor, pod operator design

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

## 6. Performance & Scale

### B3 · Airflow task volume multiplies by roughly 300× (high)

The scheduler polls its metadata database continuously and uses SELECT FOR UPDATE in its loop. Moving from about one DAG run a day to 288 intraday runs, each with per-domain dynamic task mapping, multiplies task_instance rows by two to three orders of magnitude. Nothing in the pack has costed the scheduler itself.

**What to do.** Size the scheduler and its database for the new task rate before build, set an aggressive metadata retention policy, and consider one long-running consumer rather than 288 scheduled DAG runs.

## 7. Error Handling, Failure & Replay

No unowned error path identified for this component.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

## 9. SEI Source Coverage

Not assessed against the SEI pack.

No citation recorded. Either this is BBH platform work the pack was never going to cover, or the mapping has not been written yet.

## 10. Gaps, Risks & What Is Missing

### What is missing

Nothing identified. The component is specified and the events-primary substitution does not change it.

### Risk

- **HIGH · performance (B3).** Airflow task volume multiplies by roughly 300×.

### Gap against the SEI pack

No absent-coverage citation recorded.

## 11. Recommendation

No change recommended.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **From the tracker.** HA scheduler required for the window?

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The bottleneck above has a measured figure at production volume, not an estimate.
