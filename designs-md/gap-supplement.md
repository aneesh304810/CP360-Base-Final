---
id: gap-supplement
title: Gap Supplement
level: L1
icon: ▦
color: #a8560f
bg: #fff7ec
order: 2
sub: what the two supplements change about this corpus
generated: true
sei_status: overview
---

# Gap supplement — what it changes

The authoritative cross-component design supplement, merged from the Markdown corpus, the architecture PDFs, the two technical designs, the canonical-model references and the sample implementation code.

Built from: all_markdown.md, CP360_Architecture_Gap_Design_Supplement.md, CP360_Stage2_Silver_Intermediate_Canonical_Model.md, SEI-BBH Integration Architecture v5, BBH File Ingestion Framework TDD v2.0, BBH dbt Transformation TDD v2, SEI Data Cloud Event Specification, SWP_BBH Canonical Model with ERD Draft, SWP_BBH Normalized Canonical Data Model v1 Draft, all_code.txt.

## Precedence when documents conflict

1. Approved architecture decision records in the CP360 design corpus
2. This gap supplement, for the subjects it explicitly covers
3. The current File Ingestion and dbt Transformation technical designs
4. Integration architecture material
5. Older component summaries, drafts and proposal-only artifacts

## The four-tier model

The single most consequential thing in the supplement, and not what
the stage chain in this corpus draws. See R1 and R2 below.

| Tier | Canonical name | Responsibility |
|---|---|---|
| **Stage 1** | RAW | Source-faithful Oracle persistence with ingestion lineage. |
| **Stage 2** | Enriched | dbt standardization, DQ, conforming, enrichment and intermediate persistence. |
| **Stage 3** | Pre-Gold | Oracle Exadata consumer-oriented transformations, dimensions, facts and control-total preparation. |
| **Consumer Movement** | Publish and delivery | Extract, transport, load and verify, with no transformation in flight. |

## Gap register

| Gap | What is missing | Required disposition | Domain |
|---|---|---|---|
| `GAP-01` | No single master view joins inbound, outbound, foundation and platform architecture | Add consolidated architecture and responsibility boundaries | Processing |
| `GAP-02` | Business capability view is incomplete | Add a capability model across ingress, ingestion, orchestration, processing, foundation and runtime | Processing |
| `GAP-03` | Ingress and egress component responsibilities are fragmented | Add Landing, Momentum/SFTP, API Gateway, Apigee, Loader Framework, callbacks and source boundaries | Ingress and Egress |
| `GAP-04` | OpenShift is named but not designed as a platform domain | Add runtime topology, deployment, secret, storage, scaling, CI/CD and operations contracts | OpenShift Platform |
| `GAP-05` | Foundation services are spread across many documents | Add a canonical control, metadata, evidence, audit, security, observability and lineage model | Foundation |
| `GAP-06` | DATE_CONTROL and file lifecycles lack one canonical state view | Add state machines, transition ownership, guards and recovery behaviour | Orchestration |
| `GAP-07` | SDC event architecture is not integrated into CP360 | Add event taxonomy, payload handling, idempotency, retrieval, replay and marker-event gating | SEI Data Cloud Events |
| `GAP-08` | Stage 2 to Stage 3 cross-database movement is under-specified | Add movement pattern, controls, replay boundary and reconciliation | Stage 3 Pre-Gold Boundary |
| `GAP-09` | Identifiers are inconsistent across components | Add canonical traceability identifiers and propagation rules | Foundation |
| `GAP-10` | HA/DR and graceful degradation are proposal-level | Add requirements, recovery scope and validation expectations | Security, Audit, Lineage, HA and DR |
| `GAP-11` | Logical relationships among control and processing entities are not consolidated | Add logical ERDs | Foundation |
| `GAP-12` | Architecture-level acceptance criteria are missing | Add measurable design completion criteria | Processing |

## What the supplements change about this corpus

25 findings. Holding a second design document beside the first is
worth nothing unless somebody compares them. Nothing below is
silently resolved: where the two disagree, both readings are stated
and the decision is named.

### Conflict — 6

#### `R1` Stage 3 names two different things

- **The supplement says.** Stage 3 IS Pre-Gold, on Oracle Exadata, and a fourth tier - Consumer Movement - carries publish and delivery with no transformation in flight.
- **This corpus holds.** The data path draws Stage 3 as the warehouse itself, with Pre-Gold as a separate layer before it and no publish tier at all.
- **What it costs to leave open.** Every document that says 'Stage 3' means one of two different databases. The acceptance criterion 'every component is assigned to one canonical domain and tier' cannot be evaluated until this is picked.
- **Decision.** `DEC-GAP-01`
- **Lands on.** the database model, and PROC_STAGES

#### `R2` DIM and FACT are in the wrong tier

- **The supplement says.** Dimensions, facts, aggregates and control-total preparation are Stage 3 Pre-Gold, on Exadata. Stage 2 is normalised canonical entities and stops there.
- **This corpus holds.** Stage 2 INT is drawn as INT, DIM and FACT together, on the same Oracle estate - which is how both SEI design documents describe it.
- **What it costs to leave open.** This is not a folder move. If the supplement holds, DIM and FACT change database, the dbt chain splits across two estates, and the STG-to-INT reconciliation boundary stops being the last one that matters.
- **Decision.** `DEC-GAP-01`
- **Lands on.** PROC_STAGES, the stage chain, the database model

#### `R3` The file lifecycle has two sets of state names

- **The supplement says.** DISCOVERED, PROCESSING, DUPLICATE_SKIPPED, QUARANTINED, FAILED, ARCHIVE_FAILED, ARCHIVED.
- **This corpus holds.** RECEIVED, VALIDATED, LOADING, QUARANTINED, FAILED, ARCHIVE_FAILED, ARCHIVED - from the File Ingestion design document.
- **What it costs to leave open.** Two names for one state machine is two state machines. Operators will see one set in the registry and the other in the runbook, and DUPLICATE_SKIPPED exists in only one of them.
- **Decision.** `none raised - worth one`
- **Lands on.** SEI_STATES, the file ingestion screen

#### `R4` Three different counts of reconciliation boundaries

- **The supplement says.** Seven boundaries, including Stage 2 to Stage 3 and publish to consumer acknowledgement.
- **This corpus holds.** The pack specifies three. The architect review recommends twelve under an event-primary posture.
- **What it costs to leave open.** Nobody can say whether reconciliation is complete, because complete is three, seven or twelve depending on which document is open.
- **Decision.** `none raised - worth one`
- **Lands on.** RECON_RESULT, the DQ lane

#### `R5` Stage 2 retention is settled here and open there

- **The supplement says.** Seven-day retention WHERE DEFINED, and SILVER-DEC-06 leaves retention and partition management open per entity.
- **This corpus holds.** Seven days, partition drop, stated flatly on every one of the 52 tables.
- **What it costs to leave open.** The replay window follows from retention. Stating it as settled when it is a per-entity decision makes every replay answer provisional without saying so.
- **Decision.** `SILVER-DEC-06`
- **Lands on.** the INT contract, every table record

#### `R20` The context screen credits the gateway with controls it does not yet enforce

- **The supplement says.** GW-GAP-01: the inbound trust boundary is NOT yet demonstrated as fully enforced. GW-RISK-03: arbitrary path forwarding is a live risk until a governed allowlist exists.
- **This corpus holds.** The boundary screen lists what the single managed door buys - mTLS and OAuth to SEI, rotation in one place, retry and circuit-breaker policy, one authoritative log - in the present tense, as though all of it were in force.
- **What it costs to leave open.** A diagram that credits a component with controls it does not have is worse than one that omits the component: it stops anybody asking. Those claims need a 'designed, not yet enforced' state.
- **Decision.** `GW-GAP-01, GW-GAP-02`
- **Lands on.** the boundary screen, the gateway band

### Closes a gap — 4

#### `R6` The outbound submission registry now has a design

- **The supplement says.** WORKFLOW_DEFINITION to WORKFLOW_INSTANCE to LOADER_DELIVERY and API_CALL, each reporting STATUS_EVENT.
- **This corpus holds.** The loader loop screen says there is no outbound equivalent of FILE_REGISTRY, so a reject count has nothing to reconcile against and a batch that never comes back never ages out.
- **What it costs to leave open.** Closed, if the ERD is approved. LOADER_DELIVERY plus STATUS_EVENT is the registry that was missing.
- **Lands on.** the loader loop, the database model

#### `R7` Stage 2 to Stage 3 movement has a pattern and a gate

- **The supplement says.** Database-link or direct-path movement preserving LOAD_ID and BUSINESS_DATE, with a reconciliation gate that authorises or holds the publish scope, and a replay boundary scoped by date and load.
- **This corpus holds.** The database picture has no movement component at all - Pre-Gold simply follows DIM and FACT with nothing in between.
- **What it costs to leave open.** Closed in design. Still needs DEC-GAP-04 to pick the mechanism.
- **Decision.** `DEC-GAP-04`
- **Lands on.** the database model, the data path

#### `R8` Correlation across the loader round trip

- **The supplement says.** CORRELATION_ID propagated through Hub, orchestration, API and loader execution, callback and monitoring; IDEMPOTENCY_KEY stable across retries of the same business operation.
- **This corpus holds.** The loader screen asks for one submission id threading all four legs, and names it as missing.
- **What it costs to leave open.** Closed. The identifiers exist and have propagation rules.
- **Lands on.** the loader loop

#### `R24` The correlation identifier now has an owner and a rule

- **The supplement says.** The gateway validates a trusted incoming correlation value or generates one, and propagates it to outbound calls, logs, metrics and traces.
- **This corpus holds.** Both the loader loop and the boundary screen ask for a correlation id minted at the gateway and carried through, and name it as not yet owned.
- **What it costs to leave open.** Closed. The gateway owns minting and propagation, which is the answer both screens were asking for.
- **Lands on.** the boundary screen, the loader loop

### New — 11

#### `R9` LOAD_ID is missing from every model we draw

- **The supplement says.** LOAD_ID is the identifier preserved from RAW through Stage 2, Stage 3, replay and publish evidence, and acceptance criterion 4 depends on it.
- **This corpus holds.** Stage 1 adds BUSINESS_DATE, SRC_RECORD_ID, FILE_REGISTRY_ID and LOAD_TS. Stage 2's standard columns add MICRO_BATCH_ID and DBT_INVOCATION_ID. Neither carries LOAD_ID.
- **What it costs to leave open.** Without it there is no single identifier for one load execution across four tiers, and the Stage 2 to Stage 3 reconciliation gate has nothing to key on. This is a hole in our own model, not in theirs.
- **Decision.** `SILVER-DEC-04`
- **Lands on.** S1_COLS and S2_STD_COLS

#### `R10` Seven of 52 canonical models exist

- **The supplement says.** The code sample implements Account, Account Optional Field, Asset, Reference, Tax Lot, Transaction Header and Transaction Detail. Four of those seven are mapped to fewer attributes than the canonical model defines. The other 45 are targets.
- **This corpus holds.** All 52 canonical tables are drawn alike, with no build status at all - a model and an intention look identical.
- **What it costs to leave open.** Anyone sizing the work from our screens sees 52 designed tables and no indication that 45 of them do not exist.
- **Decision.** `SILVER-DEC-01`
- **Lands on.** the Stage 2 canonical model

#### `R11` Three foundation entities with no table anywhere

- **The supplement says.** Workflow metadata, API configuration and a schema registry are named as control and metadata entities.
- **This corpus holds.** The database model holds five control tables. None of these three is among them, and nothing else in the corpus defines them.
- **What it costs to leave open.** The outbound path is configuration-driven by design and has no configuration store. Schema registry ownership is DEC-GAP-07 and unassigned.
- **Decision.** `DEC-GAP-07`
- **Lands on.** the control plane

#### `R12` A consumer-oriented model is sitting in Stage 2

- **The supplement says.** int_bbh_open_trade_star joins six INT models into a denormalised target layout and belongs in Pre-Gold or Publish.
- **This corpus holds.** Nothing. The app models the canonical layer and has no view of what is actually in the dbt project.
- **What it costs to leave open.** Consumer denormalisation inside Stage 2 is what stops Stage 2 being reusable: the next consumer needs a different shape and gets a second star beside the first.
- **Decision.** `SILVER-DEC-07`
- **Lands on.** nothing yet

#### `R13` Graceful degradation has four named behaviours

- **The supplement says.** Oracle unavailable: do not claim or advance durable state. Splunk or Integration360 unavailable: follow the buffering policy, never silently discard required evidence. SEI APIs unavailable: workflow state stays queryable, retry reuses the same correlation and idempotency keys. CP360 UI unavailable: durable state remains in Oracle and Airflow.
- **This corpus holds.** Nothing on partial failure of a dependency.
- **What it costs to leave open.** The third one is the sharp one: evidence silently discarded during a Splunk outage is indistinguishable afterwards from evidence that was never produced.
- **Decision.** `DEC-GAP-08`
- **Lands on.** nothing yet

#### `R14` Landing zone failure modes, including ambiguous match

- **The supplement says.** Partial file exposure, duplicate physical delivery for the same logical interface and date, no configuration match, MORE THAN ONE configuration match, storage unavailable. A file matching two configurations is a configuration error and is not loaded.
- **This corpus holds.** The file screen covers validation thoroughly and says nothing about what happens before a file is matched to an interface.
- **What it costs to leave open.** Ambiguous match is the one with no safe default: loading against the first match silently routes a file to the wrong RAW table.
- **Decision.** `DEC-GAP-02, DEC-GAP-03`
- **Lands on.** the file ingestion screen

#### `R15` HA and DR establish no numbers at all

- **The supplement says.** Seven items to finalise, and the supplement states plainly that no numerical RTO or RPO is established and that values require formal BBH approval.
- **This corpus holds.** Nothing on availability, failover or recovery objectives.
- **What it costs to leave open.** Production readiness has a named precondition that is not started. It is honest about being unstarted, which is better than a number nobody agreed.
- **Decision.** `DEC-GAP-09`
- **Lands on.** nothing yet

#### `R21` The rate limit our design depends on is not in the operation contract

- **The supplement says.** A governed operation declares method, path pattern, vendor target, schema version, header allowlists, timeout, retry and circuit-breaker policy. There is no quota or rate-limit field.
- **This corpus holds.** The boundary screen says rate limiting at the gateway is 'where the key-set collapser's restraint is actually enforced', and the mitigation for a consumer read-storm starving ingestion is 'separate API products with their own quota tiers'.
- **What it costs to leave open.** Our stated mitigation has no implementation named anywhere. The collapser proposes and nothing disposes.
- **Decision.** `none raised - worth one`
- **Lands on.** the boundary screen, GATEWAY_NOTE

#### `R22` Starvation has a second cause: the gateway does not scale yet

- **The supplement says.** HorizontalPodAutoscaler comes 'after load behaviour is validated', and PodDisruptionBudget and NetworkPolicy are listed as required but not yet in place (GW-GAP-06, GW-RISK-06).
- **This corpus holds.** The shared-quota risk assumes the gateway itself keeps up and only the SEI quota is contended.
- **What it costs to leave open.** A bursty set-based pull, a loader window and interactive reads share a service with no autoscaling and no disruption budget. The queue forms before the quota is reached.
- **Decision.** `GW-GAP-06`
- **Lands on.** the boundary screen

#### `R23` The vendor token cache is per-pod, and the storm is a named test

- **The supplement says.** The token is cached in memory until a safe expiry boundary, and 'concurrent requests do not create a token-refresh storm' is a required test.
- **This corpus holds.** Nothing. The gateway is drawn as one band with no internal state.
- **What it costs to leave open.** In-memory means per-pod: every replica refreshes on its own clock, and the refresh count scales with replicas rather than with work. The puller's burst is exactly the shape that triggers it.
- **Decision.** `GW-GAP-07`
- **Lands on.** nothing yet

#### `R25` Rotate anything that may have been exposed - including ours

- **The supplement says.** GW-RISK-02 requires rotation evidence and clean repository and pipeline scans for any credential that may previously have been exposed.
- **This corpus holds.** This repository carried a plaintext Oracle password in local/load-all.ps1 across more than one commit. The working tree no longer has it; the history still does, and nothing has been rotated.
- **What it costs to leave open.** The gateway review sets the standard and this repository does not meet it. Rotation and a history rewrite are both still open, and this has been flagged more than once.
- **Decision.** `GW-RISK-02`
- **Lands on.** the repository, not a screen

### Confirms the baseline — 4

#### `R16` ARCHIVE_FAILED never reloads RAW

- **The supplement says.** Retries the archive operation and does not reload committed RAW records.
- **This corpus holds.** The same rule, in the same words, from the File Ingestion design.
- **Lands on.** the file ingestion screen

#### `R17` One guarded owner of PENDING to TRIGGER

- **The supplement says.** The missing-interface set is empty AND the atomic update affects exactly one row.
- **This corpus holds.** The same guard, drawn as the gate.
- **Lands on.** the gate

#### `R18` Dimensions before facts, and no placeholder keys

- **The supplement says.** Build dimensions before facts; late-arriving dimensions are held rather than replaced with placeholder keys.
- **This corpus holds.** The same, on the transformation chain and the Gold layer.
- **Lands on.** the stage chain

#### `R19` An event is a notification, not the record

- **The supplement says.** Treat the event as notification; retrieve the current record from the named SDC view by payload key; process duplicates idempotently.
- **This corpus holds.** The same, as the three event kinds and the event-then-fetch path.
- **Lands on.** events and the gate

## Canonical traceability identifiers

| Identifier | Scope | Propagation rule |
|---|---|---|
| `PROJECT_ID` | CP360 project or catalog scope | Applied to metadata and catalog entities where multiple projects coexist |
| `FILE_ID` | Physical or logical file lifecycle | Created in FILE_REGISTRY and referenced by loaded RAW rows |
| `LOAD_ID` | One ingestion or load execution | Preserved from RAW through Stage 2, Stage 3, replay and publish evidence |
| `SRC_RECORD_ID` | Source record within a delivery | Preserved on record-level lineage where available |
| `BUSINESS_DATE` | Processing and partition date | Present in RAW, INT, control, DQ, reconciliation and publish evidence |
| `DAG_RUN_ID` | Airflow execution | Recorded in control and operational evidence |
| `CORRELATION_ID` | Cross-component request or workflow | Propagated through Hub, orchestration, API and loader execution, callback and monitoring |
| `IDEMPOTENCY_KEY` | Duplicate prevention for requests | Stable across retries of the same business operation |
| `EVENT_ID` | SEI Data Cloud event definition | Retained with event-processing evidence and consumer outcome |

## Foundation entities

| Entity | Purpose | Exists |
|---|---|---|
| `FILE_SCHEMA_CONFIG` | Active interface definition, filename matching, parsing, validation, RAW target | yes |
| `FILE_REGISTRY` | File lifecycle, counts, status, timestamps, business date, lineage | yes |
| `DATE_CONTROL` | Durable business-date state machine, SLA cutoff, DAG run traceability | yes |
| `DQ_VALIDATION_FAILURE` | Source and Transformation DQ failures and resolution state | yes |
| `RECON_RESULT` | Immutable reconciliation result per date, model and control | yes |
| `Workflow metadata` | Workflow definitions, step ordering, routing, dependencies, retry policy | **no table anywhere** |
| `API configuration` | Endpoint, authentication reference, timeout, retry, response mapping | **no table anywhere** |
| `Schema registry` | Versioned file and API contracts and compatibility metadata | **no table anywhere** |

## Stage 2 to Stage 3

Database-link or approved direct-path movement from Stage 2 Oracle to Stage 3 Exadata, preserving LOAD_ID, BUSINESS_DATE, source keys and reconciliation attributes. Full reload may use the approved bulk mechanism. CDC or GoldenGate only for an approved intraday requirement.

**The gate.** Reconciliation PASS authorises the publish scope. FAIL holds the publish and preserves the replay scope.

**Replay boundary.** Scoped by approved business date and load lineage. Replay must not create duplicate active dimension rows or duplicate fact rows.

## Reconciliation boundaries

Seven. The pack specifies three; the architect review recommends
twelve under an event-primary posture. See R4.

- physical file rows versus parsed rows
- header and trailer count versus parsed rows
- parsed rows versus committed RAW rows
- RAW PASS plus DQ failures versus applicable source scope
- Stage 2 source versus Stage 3 inserted and rejected scope
- dimension and fact load counts and business control totals
- Pre-Gold publish scope versus consumer delivery and acknowledgement

## Decisions required before build completion

| Decision | What must be settled |
|---|---|
| `DEC-GAP-01` | Approve canonical Stage 1, Stage 2, Stage 3 and Consumer Movement terminology |
| `DEC-GAP-02` | Confirm the Landing file-readiness convention |
| `DEC-GAP-03` | Confirm unknown-file and ambiguous-match exception locations |
| `DEC-GAP-04` | Confirm the Stage 2 to Stage 3 default transfer mechanism and fallback bulk load |
| `DEC-GAP-05` | Confirm event consumer persistence and duplicate-detection key |
| `DEC-GAP-06` | Confirm OpenShift namespace, tenancy, scaling and shared-storage model |
| `DEC-GAP-07` | Confirm schema registry ownership and compatibility policy |
| `DEC-GAP-08` | Confirm Integration360 versus Splunk evidence ownership by event family |
| `DEC-GAP-09` | Approve HA topology and component-level RTO and RPO |
| `DEC-GAP-10` | Confirm correction and historical replay rules for each consumer |
| `SILVER-DEC-01` | Confirm the canonical entity inventory and ownership by domain |
| `SILVER-DEC-02` | Confirm the canonical business key for each entity |
| `SILVER-DEC-03` | Confirm whether Stage 2 stores daily snapshots, effective-dated history, or a combination by entity |
| `SILVER-DEC-04` | Confirm the standard lineage columns available in every RAW source |
| `SILVER-DEC-05` | Confirm Oracle schemas for STG, INT, DQ and reconciliation objects |
| `SILVER-DEC-06` | Confirm retention and partition-management rules by Stage 2 entity |
| `SILVER-DEC-07` | Confirm the location and naming of Stage 3 and publish models |
| `SILVER-DEC-08` | Confirm whether generic INT_REFERENCE stays generic or is decomposed into typed models |

## Acceptance criteria

### Architecture

1. Every architecture component is assigned to one canonical domain and tier
2. Every business-date transition has one owner, guard and persisted evidence record
3. Every file lifecycle state has an entry rule, exit rule, retry rule and operational event
4. Stage 2 to Stage 3 movement preserves LOAD_ID and BUSINESS_DATE and has a reconciliation gate
5. No Source or Transformation DQ failure progresses without approved resolution
6. Dimension processing completes and passes its tests before dependent facts are built
7. Every API, loader, workflow and SDC event is traceable by correlation or event identifier
8. Gateway, orchestration, ingestion, transformation and publishing failures are distinguishable in evidence
9. OpenShift deployments use versioned images, external config, secrets, health checks and controlled promotion
10. Security-sensitive changes, replay actions and manual state interventions are audited
11. HA/DR requirements and runbooks are approved and tested before production readiness
12. Component Markdown links to this supplement rather than defining conflicting alternatives

### Stage 2 Silver

1. Every source interface maps to one or more STG views
2. Every STG PASS record maps to a canonical model or a documented non-persisted disposition
3. Every canonical entity has an approved grain and business key
4. Every incremental model has a deterministic unique key including BUSINESS_DATE
5. Every canonical relationship has a defined DQ rule
6. Every model preserves available load and file lineage
7. Every model has not-null, uniqueness and applicable relationship tests
8. Stage 2 reconciliation is recorded for every business date
9. Consumer-specific models are outside the Stage 2 folder
10. A failed Stage 2 test or reconciliation prevents Stage 3 publication

## Naming standard

| Object type | Pattern | Example |
|---|---|---|
| RAW table | `RAW_<SOURCE_ENTITY>` | `RAW_TRANSACTION_HEADER` |
| STG view | `STG_<SOURCE_ENTITY>` | `STG_TRANSACTION_HEADER` |
| Canonical INT model | `INT_<CANONICAL_ENTITY>` | `INT_TRANSACTION_HEADER` |
| Pre-Gold model | `PG_<BUSINESS_OUTPUT>` | `PG_BBH_OPEN_TRADE` |
| Publish model | `PUB_<CONSUMER>_<OUTPUT>` | `PUB_IMDS_BBH_OPEN_TRADE` |
| DQ model | `DQ_<ENTITY>_<RULE_GROUP>` | `DQ_TRANSACTION_RELATIONSHIP` |
| Reconciliation model | `RECON_<LAYER>_<ENTITY>` | `RECON_INT_TRANSACTION_HEADER` |

## Code finding — `int_bbh_open_trade_star`

Joins Account, Asset, Reference, Tax Lot, Transaction Header and Transaction Detail into a denormalised, target-oriented layout, and sits in the Stage 2 intermediate folder.

Consumer-oriented denormalisation in Stage 2 is what stops Stage 2 being reusable: the next consumer needs a different shape and gets a second star beside the first.

Relocate to models/pre_gold/trades/pg_bbh_open_trade.sql, or to models/publish/imds/pub_bbh_open_trade_star.sql.

## HA and DR

No numerical RTO or RPO is established. Values require formal BBH
approval. Open:

- availability-zone and site topology for the Integration Hub and OpenShift runtime
- Oracle and Exadata replication and failover approach
- Airflow metadata database protection
- persistent storage backup and restore
- RTO and RPO per platform component
- failover ownership and operational communication
- periodic restore tests and DR game-day evidence

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand.
