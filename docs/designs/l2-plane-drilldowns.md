---
id: l2-planes
title: L2 Plane Drill-downs
level: L2
icon: 🔍
color: #0b5e83
bg: #e0f5fd
order: 2
sub: how each plane is built - ingress, transform, egress, control
zone_default: 2. Hub
---

One level below the zone map. Each plane gets its internal flow, a component contract table, the failure modes it owns, and the decisions holding it up. Component IDs match the design tracker throughout.

- 1 · Ingress / Egress
- 2 · Processing
- 3 · Orchestration
- 4 · Data Quality
- 5 · Foundation
- 6 · OpenShift
- L3 scope

## Ingress / Egress

The contract boundary. Nothing here knows what an account is — this plane moves bytes, authenticates, and decides only whether a delivery is complete. Business meaning starts in Processing.

### Internal flow

### Component contracts

| ID | Component | Responsibility | Interface out | Build |
|---|---|---|---|---|
| 8 | Landing Zone + transport | Receive, authenticate, retain. Write-once directory per business date. No parsing. | File on volume + manifest | INF |
| 9 | Arrival sensors | Detect per-file arrival and manifest completeness. Trigger the domain branch, not the whole batch. | Airflow trigger event | AIR |
| 10 | Outbound producers | Build extracts, JSON payloads and loader files to SEI's spec from Zone 3 sources. | File / JSON to Apigee | PY |
| 11 | Apigee proxy | Submit path and status-return path. Auth, throttling, payload size limits. | HTTPS to SEI · status to 35 | VEN |
| 12 | API Gateway / Data Plane | Real-time route to SWP APIs. Independent lifecycle from batch. | HTTPS to SEI APIs | VEN |

### Failure modes this plane owns

- **Partial delivery.** Six of seven files land. The sensor must distinguish "late" from "missing" — that needs a manifest with an expected-file list, or you are guessing on a timeout.
- **Silent truncation.** A file that lands mid-write looks complete. Requires a done-marker or size-stable check, not just existence.
- **Redelivery.** SEI resends a file for a date already loaded. The plane must not decide — it stamps and passes through; idempotency belongs to Processing.

### Blocked on

AD-10 transport protocol — SEI unspecified, BBH says sFTP. AD-3 Apigee firm or placeholder. AD-11 is outbound in scope at all.

## Processing

The only plane allowed to hold business logic. Python owns everything up to and including the RAW insert; dbt owns everything after. That line is not negotiable — it is what keeps lineage traceable.

### Internal flow

### Component contracts

| ID | Component | Responsibility | Key design point | Build |
|---|---|---|---|---|
| 13 | Python ingestion framework | Validate, profile, stamp, load. One framework driven by config — not seven scripts. | Loader abstraction so cx_Oracle / SQL*Loader / external tables are swappable per domain by size. | PY |
| 14 | Stage 1 RAW | Store as received. Immutable, append only. | Partition by BUSINESS_DATE. Retention drives replay depth — set it from the replay requirement, not from disk. | DDL |
| 15 | Stage 2 Enriched | Standardise, integrate corrections, apply rules, select latest. | Dedup and latest-record are macros, written once. Snapshot domains want incremental with a change hash, not full refresh. | DBT |
| 16 | Gold | Kimball dims and facts, business-ready. | `dbt snapshot` will not cover this. Custom incremental SCD2 macro; merge strategy differs per fact. | DBT |
| 17 | Correction handling | Apply corrected transactions and positions consistently in Stage 2 and Gold. | No dbt idiom for bitemporal. One custom strategy, reused — not per-model logic. | DBT |

### Failure modes this plane owns

- **Correction arrives before the record it corrects.** Out-of-order delivery. Needs a park-and-retry position, or corrections silently no-op.
- **Full-snapshot volume.** Account, Client and Tax Lot arrive complete every day. Full refresh on a full snapshot is the worst combination available; ask SEI for a change hash before optimising anything else.
- **Late-arriving dimension.** A fact references an account not yet in the dim. Decide: reject, or inferred-member row. Rejecting mid-window is expensive.
- **Merge destroys history.** Under in-place merge, an as-of question from last Tuesday is unanswerable. This is AD-2, and it is the single most consequential open item.

### Blocked on

AD-1 Gold write target — decides whether dbt touches production schemas. AD-2 correction semantics — one answer must hold across 15, 16 and 21.

## Orchestration

Airflow holds control flow and nothing else. No transformations, no business rules, no thresholds — those live in dbt and in config. The plane's job is deciding what runs, in what order, and what happens when something does not.

### Internal flow

### Component contracts

| ID | Component | Responsibility | Key design point | Build |
|---|---|---|---|---|
| 18 | DAG + per-domain fan-out | Seven independent branches to G2; join only where Stage 2 genuinely needs it. | Dynamic task mapping over domain config. A hand-written static DAG will not survive the eighth feed. | AIR |
| 19 | Build order / threads | Dims before facts; dbt thread count tuned to the Oracle ceiling. | Ceiling comes from component 55, not from cluster capacity. | AIR |
| 20 | Intraday cadence | Schedule and overlap prevention against the EOD run. | Must not allow an intraday run and EOD run to write the same target concurrently. | AIR |
| 21 | Replay engine | Re-run a business date end to end from RAW. | Airflow `clear` reruns tasks; it does not undo a merge into a Gold fact. This is a bespoke component. | PY |
| 22 | Partial-batch policy | Decide halt-all vs per-domain proceed on a branch failure. | Needs a per-domain publish-completeness marker consumers can read. | AIR |

### Failure modes this plane owns

- **Replay is not backfill.** Backfill assumes the target was empty. Replay must reverse or supersede an existing Gold state — which only works if AD-2 lands on append.
- **Overlapping runs.** Intraday firing while EOD is mid-Gold. Needs a run-level lock per target, not just DAG-level concurrency.
- **Parallelism inversion.** Past the Oracle session ceiling, more pods make the window longer. Measure before setting the fan-out width.
- **Retry masking a data problem.** Airflow retries are for transient infrastructure faults. A DQ failure must never be retried — it must block.

### Blocked on

AD-4 intraday lane. AD-5 partial-batch policy. AD-2 determines whether replay is even implementable.

## Data Quality — blocking

Five gates, four of them blocking. The design principle: a gate that fires after the damage is a report, not a control. G4 exists because SEI v5 placed its only DQ step after the Gold load, where it stops nothing.

### Gate interlock

### Component contracts

| ID | Gate | Checks | Key design point | Build |
|---|---|---|---|---|
| 23 | G1 file / structural | Encoding, delimiter, column count, header, row count vs manifest, checksum. | Rule-driven from the registry, not hardcoded per feed. | PY |
| 24 | G2 RAW profiling | Null rates, cardinality, volume vs trailing average, date range sanity. | Aggregate SQL pushed to Oracle. Never pull rows into Python to profile. | AIR |
| 25 | G3 dbt tests + rules | Uniqueness, referential integrity, accepted values, business rule assertions. | Generic tests for structure; singular tests for business rules. | DBT |
| 26 | G4 tie-out | RAW → Gold row and control-total reconciliation, per target. | Compare against captured ingest metadata rather than rescanning — turns a table scan into a lookup. | AIR |
| 27 | G5 post-publish recon | Cross-system totals, consumer-visible consistency. | Define what auto-triggers a replay versus what pages a human. | AIR |
| 28 | DQ framework | Registry, severity tiers, results store, override path. | Severity must be changeable without a code release, and readable by Airflow so the gate can branch on it. | PY |

### Failure modes this plane owns

- **Everything fatal.** Without severity tiers you block on a null in a cosmetic column at 2am. Two tiers minimum, held in config.
- **No override.** Blocking with no release path means a failure waits for the morning. Needs an audited approve-and-proceed, logged to the same lineage store.
- **Thresholds drifting into dbt.** A threshold buried in a dbt test cannot be read by Airflow, so the gate cannot branch on severity. Keep thresholds in config.
- **G4 against the window.** The tie-out is the expensive gate and the only one protecting production. If it does not fit the window, the honest answer is to widen the window — not to demote the gate.

## Foundation

Cross-cutting services every other plane calls. No domain knowledge lives here — a foundation component that knows what a tax lot is has been built wrong.

### Dependency shape

### Component contracts

| ID | Component | Responsibility | Key design point | Build |
|---|---|---|---|---|
| 29 | Error & quarantine | Error taxonomy, quarantine store, resubmission path. | Quarantine is a first-class store with retention and a route back in — not a reject folder. | PY |
| 30 | Reconciliation framework | Control totals, exception lifecycle, publication to Integration360. | An exception has states and an owner. Model the lifecycle, not just the alert. | PY |
| 31 | Audit & lineage | Row-level lineage via the LOAD_ID chain; evidence retention. | dbt docs gives model-level lineage only. Row-level is yours to build. | PY |
| 32 | Security & access | AuthN/AuthZ, classification, masking if PII is present. | Classify the SWP extracts before designing — masking changes the RAW model. | INF |
| 33 | Metadata & config store | Single source for specs, rules, thresholds, mappings, schedules. | Everything config-driven depends on this. If it is late, 13/18/23/28 get hardcoded and never get un-hardcoded. | DDL |
| 34 | Observability | Logs, metrics, traces, SLIs. | Emit run-level metrics from Python and Airflow deliberately; do not rely on container logs. | INF |
| 35 | Integration360 | Monitoring, exceptions, process tracking, recon surface. | Existing BBH platform; the Hub builds the adapter. | VEN |
| 36 | SSO | Federated access to SWP UI. | Configuration only. | INF |

### Failure modes this plane owns

- **Two config stores.** SEI keeps its own Metadata/Config/Mapping (component 5b) and the Hub keeps 33. They will diverge. Decide which is authoritative for shared mappings.
- **Two monitoring surfaces.** SEI's dashboard and Integration360 both claim status. AD-6 resolves the recon record, but not the operator's question of which screen to trust.
- **Lineage that cannot answer the audit question.** Under in-place merge, lineage records that a row changed but not what it was. That is not audit-defensible.

## OpenShift — infrastructure & deployment

Twenty-two components, none of them in either source deck. This plane does not appear in the architecture conversation until it is late, which is exactly why it is drawn here.

### Runtime shape

### The two constraints this plane imposes upward

- **Pods are cheap, Oracle sessions are not.** Component 55 sets the ceiling on the fan-out designed in component 18. That is an empirical number from the DBA plus a load test — get it before committing to a window.
- **Deployment velocity is an AD-1 consequence.** If dbt writes PBDW and IMDS directly, your dbt release pipeline sits inside BBH production change control with whatever approval cycle that carries. A Hub-owned schema keeps the Hub's own cadence. ARB should see that this decision lands on release speed, not only on data ownership.
- **Long lead items.** Network egress to SEI (49) and Oracle session grants (55) are approval-bound, not build-bound. Start both now regardless of where the rest of the design sits.

### What gets an L3 document, and what does not

### L3 required — 13 components

Behaviour is not derivable from the L2 flow. Each needs a design doc reviewed before code: interface, data model, state transitions, failure and recovery, test strategy.

| ID | Component | Why L3 |
|---|---|---|
| 13 | Ingestion framework | Config-driven abstraction across three load mechanisms |
| 16 | Gold | Custom SCD2 macro; no dbt default |
| 17 | Corrections | Bitemporal strategy, reused everywhere |
| 18 | DAG fan-out | Dynamic mapping over config |
| 21 | Replay engine | State reversal; no framework support |
| 23 | G1 validation | Rule engine + blocking semantics |
| 26 | G4 tie-out | Crosses the model graph; gates publish |
| 28 | DQ framework | Registry, severity, override, audit |
| 29 | Error & quarantine | Lifecycle and resubmission |
| 30 | Recon framework | Exception state model |
| 33 | Config store | Schema everything else depends on |
| 10 | Outbound producers | Three output formats to SEI spec |
| 59 | dbt release & rollback | Restore path for a merged dim |

### L3 not required — 52 components

A diagram would restate the L2 flow. These need a one-page spec instead:

- **Config and platform (24 items).** Namespaces, RBAC, secrets, storage, quotas, GitOps, backup. Deliverable is a values file and a runbook, not a diagram.
- **DDL (4 items).** RAW, IMDS Stage, PBDW publication, config schema. Deliverable is the DDL plus a partitioning note.
- **Contract-only (10 items).** All of Zone 1 plus real-time consumers. Deliverable is an agreed interface spec, owned jointly with SEI.
- **Standard dbt (5 items).** Stage 2 models, Pivotal feed, IMDS load, tests. Deliverable is the model plus its schema.yml.
- **Vendor config (5 items).** Apigee, API Gateway, Integration360 adapter, SSO, BI.
**Sequence.** Component 33 first — it is the schema four other high-custom components read. Then 13 and 28 together, since G1 lives inside the framework. Then 17, because 16, 21 and 59 all inherit its answer. Nothing in that chain moves until AD-2 closes.

