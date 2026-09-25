---
cp360_type: design_document
component_id: 59
component_name: dbt Release & Rollback
zone: 4. OpenShift
plane: Deployment
priority: P1
technology: dbt + CI/CD
custom_build: High
depends_on: [15, 16, 21]
status: Not Started
owner: TBD
origin: SEI-BBH component tracker
sei_coverage: unassessed
gap_owner: unassessed
in_scope: true
---

# dbt Release & Rollback

## 1. Purpose & Scope

**dbt versioning, release cadence, rollback design**

Scope as recorded in the component tracker: No native rollback for a merged SCD2 dim. Custom restore path tied to the replay engine..

**Custom build: High.** A design document is mandatory before code, and this one is that document. High means there is no vendor default to fall back on — every behaviour below is a decision somebody has to make and own.

**Where it sits.** OpenShift · deployment. Ordinary CI/CD, with one property that is not ordinary: **Gold is DML-only MERGE with `on_schema_change='fail'`**, so reverting a model version does not revert the data it already merged. Rollback here is forward-fix plus a data repair, and the design has to say so rather than implying a revert is enough.

## 2. Context & Dependencies

- **Upstream** — depends on #15 Stage 2 Enriched (dbt), #16 Gold (dbt), #21 Replay / Rerun Engine
- Technology: dbt + CI/CD
- Custom build: High — High means a design document is mandatory before code.
- Source of record: NEW

## 3. Design Decisions

No review finding against this component: the events-primary substitution does not change what it does. The design decisions that remain are build decisions. Ordinary CI/CD, with one property that is not ordinary: **Gold is DML-only MERGE with `on_schema_change='fail'`**, so reverting a model version does not revert the data it already merged. Rollback here is forward-fix plus a data repair, and the design has to say so rather than implying a revert is enough.

### Stage 2 → Gold: externalise the rules so a BA owns them

Every mapping and derivation between Stage 2 and Gold is hand-written dbt SQL. A change to what a column means is therefore a code change, a pull request and a release. The people who own the business meaning cannot change it; the people who can change it do not own the meaning. That gap is where wrong numbers come from, and it gets worse as the mapping surface grows.

**Principle.** Externalise the rules, not the engine. Generate dbt from them; never interpret them at run time.

| Ownership | Covers |
| --- | --- |
| **BA owns** | Source column to target column mapping · code and value translations · derived expressions and their conditions · defaults · which attributes are SCD-tracked · the rule's business description |
| **Engineering owns** | Join strategy · incremental predicates · merge keys · partitioning · SCD2 close and open mechanics · dim-before-fact ordering · hold-and-replay |

## 4. Detailed Design

**Deliverable.** dbt versioning, release cadence, rollback design

### Implementation — OpenShift · deployment

Ordinary CI/CD, with one property that is not ordinary: **Gold is DML-only MERGE with `on_schema_change='fail'`**, so reverting a model version does not revert the data it already merged. Rollback here is forward-fix plus a data repair, and the design has to say so rather than implying a revert is enough.

| Concern | How to build it |
| --- | --- |
| **Pipeline stages** | Lint, unit test, dbt parse and compile, dbt build against a seeded test schema, then promote the image by digest. The dbt compile step is where a generated model from the rule registry is validated before anyone reviews it. |
| **GitOps** | Declarative environment state, with the image digest as the only thing that differs between environments. Configuration comes from the metadata store, not from a per-environment manifest. |
| **dbt release** | A model version and its ruleset version travel together. Rolling back one without the other leaves Gold rows stamped with a `RULE_SET_VERSION` whose logic is no longer deployed. |
| **Data repair path** | Document it explicitly: which restatement DAG, who approves, and how the affected business dates are identified. A rollback runbook that stops at 'revert the model' is incomplete and will be discovered mid-incident. |
| **Database change management** | Every schema change is a migration with a forward script and a rollback script, versioned alongside the code. The P-marked columns in the build spec are the first batch. |

**Build note for this component.** With DML-only Gold, 'rollback' means forward-fix plus data repair. The runbook must name the restatement DAG, the approver and how affected business dates are identified.

### Rule registry data model

| Table | Grain | Columns |
| --- | --- | --- |
| `TRANSFORM_RULESET` | one row per target model per version | TARGET_MODEL · VERSION · STATUS · EFFECTIVE_FROM / TO · APPROVED_BY · APPROVED_TS |
| `TRANSFORM_RULE` | one row per target column per ruleset | RULESET_ID · SEQ · TARGET_COLUMN · RULE_TYPE · SOURCE_EXPRESSION · CONDITION · DEFAULT_VALUE · BUSINESS_DESCRIPTION |
| `TRANSFORM_LOOKUP` | one row per source value per domain per version | LOOKUP_DOMAIN · SOURCE_VALUE · TARGET_VALUE · EFFECTIVE_FROM / TO |
| `TRANSFORM_RULE_TEST` | one row per expectation | RULE_ID · INPUT_JSON · EXPECTED_VALUE · LAST_RUN_TS · LAST_RESULT |

- **TRANSFORM_RULESET** — Never updated in place — superseded. A ruleset that produced a row must stay readable for as long as that row is explainable.
- **TRANSFORM_RULE** — RULE_TYPE is a closed set: DIRECT, CONSTANT, LOOKUP, DERIVED_EXPR, CONDITIONAL, AGGREGATE. An open expression language is how a rule registry becomes a second programming language nobody can review.
- **TRANSFORM_LOOKUP** — The classic BA-owned artefact, and the one most often kept in a spreadsheet today. An unmapped source value raises; it never passes through or defaults silently.
- **TRANSFORM_RULE_TEST** — At least one per rule, run in CI on every regeneration. Without it, externalisation means more people able to ship a wrong number rather than fewer.

### Authoring to production

| Step | Stage | What happens |
| --- | --- | --- |
| 1 | BA edits a rule | Authoring surface writes to the registry as a draft ruleset. Nothing downstream moves. |
| 2 | Approval | STATUS_TRANSITION marks the draft-to-active move as REQUIRES_APPROVAL. A derivation on fact_transactions is a change to the firm's books, and four eyes is the control. |
| 3 | Compile | CI regenerates the dbt models from the approved ruleset. The generated SQL lands in a pull request as a diff — the BA's change made reviewable in engineering's own terms. |
| 4 | Test | Rule expectations run against the generated SQL, alongside the existing dbt tests. |
| 5 | Run | An ordinary dbt run. Lineage, tests and documentation all still work, because the output is dbt and not an interpreter. |
| 6 | Stamp | Every Gold row carries RULE_SET_VERSION. Three months later the number is explainable without archaeology in the commit log. |

**Scope boundary.** Stage 2 to Gold only. Do not extend it to Stage 1 ingestion, where the RAW DDL is the contract and there is no business logic to own, and do not let it absorb the correctness machinery — SCD2 mechanics, merge semantics and hold-and-replay stay in code.

### How it lands in the dbt project

This has to fit the dbt project as it stands — incremental models, on_schema_change='fail', DML-only MERGE into Gold, dim before fact. The shape that fits is code generation into the existing models directory, not a runtime lookup inside a model.

| Piece | Lives in | What it is |
| --- | --- | --- |
| **Registry** | `Oracle` | TRANSFORM_RULESET, TRANSFORM_RULE, TRANSFORM_LOOKUP, TRANSFORM_RULE_TEST. The BA's authoring surface writes here and nowhere else. |
| **Generator** | `dbt-codegen step in CI` | Reads the approved ruleset and writes models/gold/*.sql. Runs before dbt parse, never during it. |
| **Generated models** | `models/gold/` | Real .sql files, committed. A rule change arrives as a SQL diff in a pull request. |
| **Expectations** | `dbt unit tests` | TRANSFORM_RULE_TEST rows compile to dbt unit tests (dbt 1.8+) beside the model, so a rule is proven before the model runs against real data. |
| **Lookups** | `dbt seeds` | TRANSFORM_LOOKUP exports to seeds/ so the mapping is version-controlled with the model that uses it, and an unmapped value fails the build rather than the night. |

**Considered and rejected**

- **Jinja macro reading a seed at parse time** — The seed becomes the source of truth but the pull request diff is a CSV, so review is meaningless. dbt docs then shows generated SQL that nobody wrote and nobody can explain.
- **A rule interpreter running inside the warehouse** — Slower, unobservable, and it discards dbt's lineage, tests and documentation — the three things that make the current design defensible.
- **Externalising Stage 1 as well** — There is no business logic there to own. The RAW DDL is the schema contract, and adding a rule layer would put a second contract in front of it.

**Guardrails**

- A rule that adds a target column is a schema change, and Gold runs on_schema_change='fail'. The generator must detect the new column at compile time and demand an explicit migration — discovering it when the model fails at 3am is the outcome this is meant to prevent.
- The generated model carries the ruleset id and version in a header comment and as a column, so the SQL and the row agree about which logic produced it.
- Generation is deterministic: the same ruleset produces byte-identical SQL. A noisy generator makes every diff unreadable and the review worthless.
- dbt unit tests need 1.8 or later. On an older version the expectations have to run as a separate CI step against the compiled SQL, which is weaker but still better than none.
- A correction becomes a new ruleset version with an effective date, never an edit to the version that already ran. Correction Handling keeps its restatement path; what changes is that a mapping fix no longer needs a code release.

**Release.** dbt Release & Rollback changes shape. Today a model version is the unit of release. With the registry it is a ruleset version plus the generated model, and the two must travel together — rolling back the model without the ruleset leaves rows stamped with a version whose logic is no longer deployed. Roll back both, or neither.

## 5. Data Quality, Reconciliation & Lineage

No DQ or reconciliation obligation specific to this component. Two estate rules bind it: anything derived stores the input it was derived from — the threshold in force, the ruleset version, the counts — so a verdict can be reproduced months later; and an unknown value raises rather than being mapped to its nearest neighbour.

## 6. Performance & Scale

No ranked bottleneck touches this component. The estate rule still binds it: bound anything that fans out — pods per micro-batch, connections per pod, retries per work item, calls per poll window. Every unbounded fan-out in this design eventually lands on the same Oracle.

## 7. Error Handling, Failure & Replay

No unowned error path identified for this component. Two estate conventions still bind it: durable write first, then acknowledge — committing an offset or returning a 202 before the write lands loses data with no trace; and absence is a state to record rather than a gap to infer, which is where most of the silent failures in this estate come from.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

**Rule authoring is a privileged action.** A derivation on `fact_transactions` is a change to the firm's books. Draft-to-active on a ruleset carries `REQUIRES_APPROVAL` and a four-eyes flow; the BA authors, someone else approves, and both are recorded.

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

**On externalising the rules.** Externalised without effective dating, generated SQL and CI tests, this produces a system where more people can change logic and nobody can explain a number — strictly worse than hard-coded SQL. The three guardrails are not refinements to add later; they are what makes the idea safe at all.

**OpenShift · deployment.** Write the rollback runbook before the first release, and test it on a real business date in a lower environment. With DML-only Gold, the difference between a ten-minute incident and a two-day one is whether that runbook existed beforehand.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **From the tracker.** Rollback of an SCD2 dim - how?
- **Whether a seeded test schema with representative data exists** — unanswered. Until it is: Build one from a masked subset, refreshed monthly. It is also what makes restatement rehearsable, which D.1 to D.6 currently assume without providing.
- **Who approves a restatement** — unanswered. Until it is: Name the role in `STATUS_TRANSITION.APPROVER_ROLE` and enforce it at the transition rather than in a runbook nobody reads at 3am.

### Acceptance criteria

- The deliverable above exists and is reviewed.
