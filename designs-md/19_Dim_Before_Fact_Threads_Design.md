---
cp360_type: design_document
component_id: 19
component_name: Dim-before-Fact / dbt Threads
zone: 2. Hub
plane: Orchestration
priority: P2
technology: Airflow + dbt
custom_build: Low
depends_on: [16, 55]
status: Not Started
owner: TBD
architecture_decisions: [AD-2]
pipeline_tiers: [Stage2-Oracle, Stage3-Exadata-Gold]
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, orchestration]
origin: SEI-BBH component tracker
sei_coverage: covered
gap_owner: BBH
in_scope: true
---

# Dim-before-Fact / dbt Threads

## 1. Purpose & Scope

**Build-order and concurrency design**

Scope as recorded in the component tracker: Selector config and thread tuning..

**Custom build: Low.** Largely platform or vendor capability. The design work is the contract around it — what it guarantees, what it does not, and who is called when it stops.

**Where it sits.** Hub · orchestration. C.1's three-task DAG is careful and complete for one daily cycle. It assumes a discrete moment when everything has arrived, and events never produce one. Do not extend the daily DAG to run 288 times; separate the clocks.

## 2. Context & Dependencies

- **Upstream** — depends on #16 Gold (dbt), #55 Oracle Connection Pooling
- Technology: Airflow + dbt
- Custom build: Low — High means a design document is mandatory before code.
- Source of record: NEW

### The Orchestration plane

**What the pack has.** C.1 specifies the DAG well: three tasks, dynamic task mapping, a deterministic run id, a guarded PENDING to TRIGGER transition, and dim-before-fact with hold-and-replay. For one daily file cycle this is a complete and careful design.

**What it does not.** It assumes a discrete 'everything has arrived' moment. Events never produce one. There is no intraday cadence model, no intraday SLA, no gate that works without interfaces to count, no partial-view policy inside a micro-batch, and no poller for the return leg. Replay is worse than missing — it is specified in terms the event path cannot honour.

**Plane verdict:** 2 of 7 specified · 2 partly · 3 absent.

## 3. Design Decisions

**Review verdict: bottleneck.** The ordering cost moves from once a day to once per micro-batch, including on boxes containing a single domain.

**Direction.** Fully specified by the pack, and sound. Order conditionally on the collapsed key set so single-domain boxes pay nothing.

### Stage 2 → Gold: externalise the rules so a BA owns them

Every mapping and derivation between Stage 2 and Gold is hand-written dbt SQL. A change to what a column means is therefore a code change, a pull request and a release. The people who own the business meaning cannot change it; the people who can change it do not own the meaning. That gap is where wrong numbers come from, and it gets worse as the mapping surface grows.

**Principle.** Externalise the rules, not the engine. Generate dbt from them; never interpret them at run time.

| Ownership | Covers |
| --- | --- |
| **BA owns** | Source column to target column mapping · code and value translations · derived expressions and their conditions · defaults · which attributes are SCD-tracked · the rule's business description |
| **Engineering owns** | Join strategy · incremental predicates · merge keys · partitioning · SCD2 close and open mechanics · dim-before-fact ordering · hold-and-replay |

## 4. Detailed Design

**Deliverable.** Build-order and concurrency design

### Implementation — Hub · orchestration

C.1's three-task DAG is careful and complete for one daily cycle. It assumes a discrete moment when everything has arrived, and events never produce one. Do not extend the daily DAG to run 288 times; separate the clocks.

| Concern | How to build it |
| --- | --- |
| **Two runtimes** | A long-running consumer owns the intraday path. The existing DAG owns the EOD transformation. They meet at a gate that requires every micro-batch LOADED plus the marker received. |
| **The gate** | Marker-only gating lets the transformation run on short Stage 1, and STG_TO_INT still reconciles because it ties against a Stage 1 that is itself short. The gate must count micro-batches, not trust a signal. |
| **Conditional ordering** | Only serialise dim-before-fact when the micro-batch actually contains both domains. Paying the ordering cost 288 times for boxes holding one domain is waste. |
| **Bounded retry** | Maximum attempts per work item before quarantine. The replay engine has no limit today, so a permanently failing item retries for ever and consumes capacity every cycle. |
| **Partial-batch policy for views** | The existing policy covers partial file batches. Three of five views pulling successfully inside one micro-batch is the equivalent case and the more frequent one, and it is unowned. |

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

### B8 · DIM-before-FACT serialisation is now paid per micro-batch (medium)

Under a daily batch the ordering cost is paid once. Under intraday it is paid 288 times, including on the many micro-batches that contain only one domain and need no ordering at all.

**What to do.** Serialise only when the micro-batch actually contains both domains. Inspect the collapsed key set before choosing the execution shape.

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

**SEI pack coverage: covered** — specified in the SEI pack.
**Who answers for the gap: BBH** — BBH-owned — do not ask SEI.

| Document | Section | Kind | What it says |
| --- | --- | --- | --- |
| BBH dbt Transformation TDD v2 | §B.4 | specifies this component | Dimension before fact, with fact_transactions.sql taking only dq_reason IS NULL and dq_int_txn_missing_dim.sql reading the failures off the same join, so the two cannot disagree. |

## 10. Gaps, Risks & What Is Missing

### What is missing

The ordering cost moves from once a day to once per micro-batch, including on boxes containing a single domain.

### Risk

- **MEDIUM · performance (B8).** DIM-before-FACT serialisation is now paid per micro-batch.

### Not specified — and what to do until it is

**How transform__<BUSINESS_DATE> and restatement both hold.** The run already exists and succeeded, so Airflow refuses a second one, and C.1's reconciliation path fires only when no matching run exists — the opposite case. As written the run-id rule and the recovery procedure contradict each other.

  *Recommended default:* Restatement runs as a separate DAG with its own run id, which is how they coexist today. Say so explicitly in the document; the contradiction is only resolved by a convention nobody wrote down.

**Whether there is an intraday SLA at all.** The pack's only clock is the EOD cutoff. Without an intraday definition of 'behind', a micro-batch that failed at 11am is not late, only absent, and nothing escalates.

  *Recommended default:* Derive lateness from the stream's own rhythm — a rolling baseline of the inter-micro-batch interval — rather than waiting for a calendar nobody will write.

### Gap against the SEI pack

The pack specifies this component. The gap is not in the documentation.

## 11. Recommendation

Fully specified by the pack, and sound. Order conditionally on the collapsed key set so single-domain boxes pay nothing.

**Action.** B8 — order conditionally on the collapsed key set.

**On externalising the rules.** Externalised without effective dating, generated SQL and CI tests, this produces a system where more people can change logic and nobody can explain a number — strictly worse than hard-coded SQL. The three guardrails are not refinements to add later; they are what makes the idea safe at all.

**Hub · orchestration.** Answer the run-id contradiction before anything else on this plane is built. Every recovery procedure in the pack depends on a mechanism that cannot currently execute.

## 12. Open Questions & Acceptance Criteria

### Open questions

- **From the tracker.** Thread count vs Oracle contention ceiling?
- **How transform__<BUSINESS_DATE> and restatement both hold** — unanswered. Until it is: Restatement runs as a separate DAG with its own run id, which is how they coexist today. Say so explicitly in the document; the contradiction is only resolved by a convention nobody wrote down.
- **Whether there is an intraday SLA at all** — unanswered. Until it is: Derive lateness from the stream's own rhythm — a rolling baseline of the inter-micro-batch interval — rather than waiting for a calendar nobody will write.

### Acceptance criteria

- The deliverable above exists and is reviewed.
- The bottleneck above has a measured figure at production volume, not an estimate.
