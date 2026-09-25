---
cp360_type: design_document
component_id: 15
component_name: Stage 2 Enriched (dbt)
zone: 2. Hub
plane: Processing
priority: P1
technology: dbt
custom_build: Medium
depends_on: [14, 17, 25]
status: Not Started
owner: TBD
architecture_decisions: [AD-2, AD-9, AD-1]
pipeline_tiers: [Stage2-Oracle]
last_updated: 2026-08-10
tags: [SEI-BBH, Integration-Hub, hub, processing, dbt]
origin: SEI-BBH component tracker
sei_coverage: partial
gap_owner: Joint
in_scope: true
---

# Stage 2 Enriched (dbt)

## 1. Purpose & Scope

**5 STG2_* models, 8 processing steps, tests**

Scope as recorded in the component tracker: Standard dbt models. Custom macros for dedup and latest-record selection..

## 2. Context & Dependencies

- Depends on components: 14, 17, 25
- Technology: dbt
- Custom build: Medium — High means a design document is mandatory before code.
- Source of record: SEI v5

## 3. Design Decisions

**Review verdict: bottleneck.** Two problems. This design names a Pre-Gold Exadata tier and an Enriched layer that the SEI pack does not have; the pack has STG as a view and INT as Silver. And the STG view is recomputed on every incremental run, which events turn from once a day into 288 times a day.

**Direction.** Reconcile the layer model before either document is treated as a spec. Then fix the STG view recomputation (B2).

### Stage 2 → Gold: externalise the rules so a BA owns them

Every mapping and derivation between Stage 2 and Gold is hand-written dbt SQL. A change to what a column means is therefore a code change, a pull request and a release. The people who own the business meaning cannot change it; the people who can change it do not own the meaning. That gap is where wrong numbers come from, and it gets worse as the mapping surface grows.

**Principle.** Externalise the rules, not the engine. Generate dbt from them; never interpret them at run time.

| Ownership | Covers |
| --- | --- |
| **BA owns** | Source column to target column mapping · code and value translations · derived expressions and their conditions · defaults · which attributes are SCD-tracked · the rule's business description |
| **Engineering owns** | Join strategy · incremental predicates · merge keys · partitioning · SCD2 close and open mechanics · dim-before-fact ordering · hold-and-replay |

## 4. Detailed Design

**Deliverable.** 5 STG2_* models, 8 processing steps, tests

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

## 5. Data Quality, Reconciliation & Lineage

No DQ, reconciliation or lineage obligation specific to this component beyond the estate-wide framework.

## 6. Performance & Scale

### B2 · STG is a view, and events make it run 288 times a day (critical)

The dbt TDD defines STG as a view, recomputed on read. Under a daily file cycle it is recomputed once. Under intraday events, INT is built incrementally all day, so the STG view is recomputed on every incremental run — and each recomputation scans Stage 1. This is the single largest cost the event substitution introduces, and it comes from a design decision that was entirely reasonable when it was made.

**What to do.** Either materialise STG per micro-batch, or ensure the INT incremental predicate pushes down to Stage 1's partition so the view scans one micro-batch rather than the whole accumulated day. Verify the push-down on the actual plan; do not assume it.
### B6 · INT's incremental MERGE into a growing current-day partition (high)

INT is partitioned by BUSINESS_DATE with a 7-day window. Under intraday events the current day's partition is written to continuously, and an incremental MERGE against a partition that grows all day degrades as the day goes on. The 6pm micro-batch is materially slower than the 6am one.

**What to do.** Subpartition by micro-batch, or load append-only with a late dedupe at the gate. Measure the degradation curve before choosing; it may be acceptable at real volumes, but nobody knows the real volumes.

## 7. Error Handling, Failure & Replay

No unowned error path identified for this component.

## 8. Security & Access Control

Estate defaults apply: a dedicated read-only account for any consumer, business keys masked on read rather than at rest, and secrets from the platform secret store.

**Rule authoring is a privileged action.** A derivation on `fact_transactions` is a change to the firm's books. Draft-to-active on a ruleset carries `REQUIRES_APPROVAL` and a four-eyes flow; the BA authors, someone else approves, and both are recorded.

## 9. SEI Source Coverage

**SEI pack coverage: partial** — partly specified — named, not sufficient.
**Who answers for the gap: Joint** — needs both sides.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH dbt Transformation TDD v2 | §Appendix E | the pack and this design disagree | STG is a view, recomputed on read. INT is Silver, primary key natural key plus BUSINESS_DATE, seven-day retention. |

**Disagreement with §Appendix E.** This codebase names a Stage 2 Enriched layer and a Pre-Gold Exadata tier that the pack does not have. The layer models have to be reconciled before either document is a build spec.

## 10. Gaps, Risks & What Is Missing

### What is missing

Two problems. This design names a Pre-Gold Exadata tier and an Enriched layer that the SEI pack does not have; the pack has STG as a view and INT as Silver. And the STG view is recomputed on every incremental run, which events turn from once a day into 288 times a day.

### Risk

- **CRITICAL · performance (B2).** STG is a view, and events make it run 288 times a day.
- **HIGH · performance (B6).** INT's incremental MERGE into a growing current-day partition.

### Gap against the SEI pack

No absent-coverage citation recorded.

## 11. Recommendation

Reconcile the layer model before either document is treated as a spec. Then fix the STG view recomputation (B2).

**Action.** Reconcile the layer model first, then B2.

**On externalising the rules.** Externalised without effective dating, generated SQL and CI tests, this produces a system where more people can change logic and nobody can explain a number — strictly worse than hard-coded SQL. The three guardrails are not refinements to add later; they are what makes the idea safe at all.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **For both sides.** The pack's layer model is RAW to STG (a view) to INT to DIM and FACT. This design names Stage 2 Enriched and a Pre-Gold Exadata tier that the pack does not have. Which is the build target?
- **From the tracker.** Full refresh or incremental per model?

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The open question above has a written answer from the named owner.
- The bottleneck above has a measured figure at production volume, not an estimate.
