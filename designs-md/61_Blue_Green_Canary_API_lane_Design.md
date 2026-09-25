---
cp360_type: design_document
component_id: 61
component_name: Blue-Green / Canary (API lane)
zone: 4. OpenShift
plane: Deployment
priority: P3
technology: Infra
custom_build: None
depends_on: [12]
status: Not Started
owner: TBD
origin: SEI-BBH component tracker
sei_coverage: unassessed
gap_owner: unassessed
in_scope: true
---

# Blue-Green / Canary (API lane)

## 1. Purpose & Scope

**Zero-downtime release design for real-time**

Scope as recorded in the component tracker: Platform capability..

**Custom build: None.** Nothing is built here. The deliverable is a contract, a configuration entry or a review, and treating it as build work is how it ends up unowned.

**Where it sits.** OpenShift · deployment. Ordinary CI/CD, with one property that is not ordinary: **Gold is DML-only MERGE with `on_schema_change='fail'`**, so reverting a model version does not revert the data it already merged. Rollback here is forward-fix plus a data repair, and the design has to say so rather than implying a revert is enough.

## 2. Context & Dependencies

- **Upstream** — depends on #12 API Gateway / Data Plane
- Technology: Infra
- Custom build: None — High means a design document is mandatory before code.
- Source of record: NEW

## 3. Design Decisions

No review finding against this component: the events-primary substitution does not change what it does. The design decisions that remain are build decisions. Ordinary CI/CD, with one property that is not ordinary: **Gold is DML-only MERGE with `on_schema_change='fail'`**, so reverting a model version does not revert the data it already merged. Rollback here is forward-fix plus a data repair, and the design has to say so rather than implying a revert is enough.

## 4. Detailed Design

**Deliverable.** Zero-downtime release design for real-time

### Implementation — OpenShift · deployment

Ordinary CI/CD, with one property that is not ordinary: **Gold is DML-only MERGE with `on_schema_change='fail'`**, so reverting a model version does not revert the data it already merged. Rollback here is forward-fix plus a data repair, and the design has to say so rather than implying a revert is enough.

| Concern | How to build it |
| --- | --- |
| **Pipeline stages** | Lint, unit test, dbt parse and compile, dbt build against a seeded test schema, then promote the image by digest. The dbt compile step is where a generated model from the rule registry is validated before anyone reviews it. |
| **GitOps** | Declarative environment state, with the image digest as the only thing that differs between environments. Configuration comes from the metadata store, not from a per-environment manifest. |
| **dbt release** | A model version and its ruleset version travel together. Rolling back one without the other leaves Gold rows stamped with a `RULE_SET_VERSION` whose logic is no longer deployed. |
| **Data repair path** | Document it explicitly: which restatement DAG, who approves, and how the affected business dates are identified. A rollback runbook that stops at 'revert the model' is incomplete and will be discovered mid-incident. |
| **Database change management** | Every schema change is a migration with a forward script and a rollback script, versioned alongside the code. The P-marked columns in the build spec are the first batch. |

## 5. Data Quality, Reconciliation & Lineage

No DQ or reconciliation obligation specific to this component. Two estate rules bind it: anything derived stores the input it was derived from — the threshold in force, the ruleset version, the counts — so a verdict can be reproduced months later; and an unknown value raises rather than being mapped to its nearest neighbour.

## 6. Performance & Scale

No ranked bottleneck touches this component. The estate rule still binds it: bound anything that fans out — pods per micro-batch, connections per pod, retries per work item, calls per poll window. Every unbounded fan-out in this design eventually lands on the same Oracle.

## 7. Error Handling, Failure & Replay

No unowned error path identified for this component. Two estate conventions still bind it: durable write first, then acknowledge — committing an offset or returning a 202 before the write lands loses data with no trace; and absence is a state to record rather than a gap to infer, which is where most of the silent failures in this estate come from.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

### Estate conventions this component inherits

- **Configuration, not code.** Thresholds, mappings, calendars and status vocabularies live in tables and are read at run time. An unknown value raises; it is never mapped to its nearest neighbour or defaulted silently.
- **Reproducible verdicts.** Anything derived stores the input it was derived from — the threshold in force, the ruleset version, the counts. A verdict that cannot be reproduced three months later cannot be defended.
- **Bound everything that fans out.** Pods per micro-batch, connections per pod, retries per work item, calls per poll window. Every unbounded fan-out in this design eventually lands on the same Oracle.
- **Write then acknowledge.** Durable write first, then commit the offset or return the 202. The reverse order loses data silently in both the event path and the callback path.
- **Absence is a state.** NOT_RUN, STATUS_UNRESOLVED and 'no partition count known' are values to record, not gaps to infer. Most of the silent failure modes in this estate come from treating an empty result as a healthy one.

## 9. SEI Source Coverage

**Not assessed against the SEI pack.** No citation has been mapped for this component, which is a gap in the review rather than a statement that the pack covers it. Assessing it means one pass: find the section that governs it, record whether that section specifies it, partly touches it or is silent, and name who answers for the difference. That is a four-line entry in `ui/src/seiCitations.js` and it is what turns an assertion into something that can be put in front of SEI beside the page.

No citation recorded. Either this is BBH platform work the pack was never going to cover, or the mapping has not been written yet.

## 10. Gaps, Risks & What Is Missing

### What is missing

No review finding: the events-primary substitution does not change what this component does. What is missing is build detail rather than design. Ordinary CI/CD, with one property that is not ordinary: **Gold is DML-only MERGE with `on_schema_change='fail'`**, so reverting a model version does not revert the data it already merged. Rollback here is forward-fix plus a data repair, and the design has to say so rather than implying a revert is enough.

### Risk

No ranked bottleneck or unowned error path touches this component.

### Not specified — and what to do until it is

**Whether a seeded test schema with representative data exists.** Without it, `dbt build` in CI proves only that the SQL parses. The first real test of a transformation is then production.

  *Recommended default:* Build one from a masked subset, refreshed monthly. It is also what makes restatement rehearsable, which D.1 to D.6 currently assume without providing.

**Who approves a restatement.** D.3 says 'approved restatement' and names no approver. Approval of a procedure that rewrites a closed business date is a control, not a formality.

  *Recommended default:* Name the role in `STATUS_TRANSITION.APPROVER_ROLE` and enforce it at the transition rather than in a runbook nobody reads at 3am.

### Gap against the SEI pack

No absent-coverage citation recorded.

## 11. Recommendation

No component-specific change is recommended: the review found nothing wrong with what this component does. The recommendation below is about how it should be built.

**OpenShift · deployment.** Write the rollback runbook before the first release, and test it on a real business date in a lower environment. With DML-only Gold, the difference between a ten-minute incident and a two-day one is whether that runbook existed beforehand.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **From the tracker.** Needed for phase 1 or later?
- **Whether a seeded test schema with representative data exists** — unanswered. Until it is: Build one from a masked subset, refreshed monthly. It is also what makes restatement rehearsable, which D.1 to D.6 currently assume without providing.
- **Who approves a restatement** — unanswered. Until it is: Name the role in `STATUS_TRANSITION.APPROVER_ROLE` and enforce it at the transition rather than in a runbook nobody reads at 3am.

### Acceptance criteria

- The deliverable above exists and is reviewed.
