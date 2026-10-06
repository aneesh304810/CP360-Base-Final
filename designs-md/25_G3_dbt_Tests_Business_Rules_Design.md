---
cp360_type: design_document
component_id: 25
component_name: G3 dbt Tests + Business Rules
zone: 2. Hub
plane: Data Quality
priority: P1
technology: dbt
custom_build: Medium
depends_on: [15, 28]
status: Not Started
owner: TBD
architecture_decisions: [AD-2, AD-9]
pipeline_tiers: [Stage2-Oracle, Stage3-Exadata-Gold]
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, data-quality]
origin: SEI-BBH component tracker
sei_coverage: covered
gap_owner: BBH
in_scope: true
generated: true
sei_status: specified
architecture_domain: Processing
canonical_tier: not on the stage chain
control_entities: [DATE_CONTROL, DQ_VALIDATION_FAILURE, RECON_RESULT]
traceability_identifiers: [LOAD_ID, BUSINESS_DATE, SRC_RECORD_ID]
supplement: CP360-GAP-DESIGN-SUPPLEMENT
---

# G3 dbt Tests + Business Rules

## What this component is

Re-checks completeness and TRIGGER status before doing any work — trust but verify — then builds the layers in order, each as a build task followed by its own test task.

It sits in **Processing**, in the **Data quality and reconciliation** lane (dbt · Splunk).

## What SEI specifies

### S13 — Transformation DAG

Re-checks completeness and TRIGGER status before doing any work — trust but verify — then builds the layers in order, each as a build task followed by its own test task.

- **Technology.** Airflow + dbt
- **Source.** dbt §5.2 (p.11) · Appendix A.1 (p.25)

### S14 — STG — view

Standardises the source columns and computes a pass or fail verdict per row. Stores nothing: it is recomputed on read.

- **Technology.** dbt view
- **Source.** dbt §4.1 (p.10) · §6.3 (p.15)

## The Oracle objects it touches

No foreign key is declared in either document. Every join below
is one a model runs, not a constraint the database enforces.

| Object | What it holds | Source |
|---|---|---|
| `DATE_CONTROL` | The orchestration ledger, and the one object both documents write to. One row per business date, at most one row not COMPLETE at a time, enforced by a unique index on a CASE expression. | ingest Appendix E.1 (p.24) · §6.3 (p.13) · dbt Appendix A.2 (p.25) |
| `RAW tables` | Bronze. Validated detail rows as delivered, tagged with the business date and lineage. The dbt document names three: account, client and transaction. | ingest Glossary (p.25) · dbt §4.1 (p.10) |
| `DQ_VALIDATION_FAILURE` | One store for both failure categories, carrying whether the row can replay itself and whether it is still open. | dbt §7.1 (p.17) |

## What happens when it goes wrong

| # | Scenario | What the design does | Source |
|---|---|---|---|
| X21 | A transformation task fails | The date stays TRIGGER, no next date is created and the pipeline is locked. Airflow alerts and the run restarts from the failed task; each layer's write is idempotent for the date. | dbt §8.1 (p.20) |
| X39 | A successful file has to be replaced | Approval first, then the reason, approver, operator and affected downstream scope are recorded. The registry row and the RAW rows are deleted through the controlled process, the corrected file is dropped in Landing, and a fresh lifecycle starts. The downstream rebuild for that date is coordinated separately. | ingest Appendix D.4 (p.23) |
| X24 | A key column is missing | The STG view marks the row FAIL with a reason code and INT never reads it. The row goes to the DQ store as OPEN. | dbt §6.3 (p.15) |
| X25 | A code is not in the mapping table | Same path — FAIL at STG with its own reason code, excluded before any mapping is attempted. | dbt §6.3 (p.15) |

## Where SEI's documents disagree about this

Each one is a decision to take before a model is written.

### C2 — Stage 2 as five tables, or as STG plus INT

- **The architecture says.** Five STG2_* tables, materialised as tables, full refresh daily or incremental.
- **The design documents say.** A STG view that stores nothing, plus an INT table kept seven days and partitioned.
- **Why it matters.** Not a naming difference. One stores Stage 2 and one does not, and the retention, the replay window and the reconciliation boundaries all follow from which it is.

## Still open with SEI

SEI's own ids, so they can be quoted straight back.

- **D5.** Confirm retention units, Oracle partitioning support, volumetrics and run-window targets.

## Gaps and decisions that land here

From the consolidated gap supplement and the CP-Integration-Gateway
readiness review. These arrived after the SEI baseline and in several
places disagree with it; where they do, both readings are given and
neither is silently adopted.

### Gap register

| Gap | What is missing | Required disposition |
|---|---|---|
| `GAP-01` | No single master view joins inbound, outbound, foundation and platform architecture | Add consolidated architecture and responsibility boundaries |
| `GAP-02` | Business capability view is incomplete | Add a capability model across ingress, ingestion, orchestration, processing, foundation and runtime |
| `GAP-12` | Architecture-level acceptance criteria are missing | Add measurable design completion criteria |

### Against what this design already says

#### Conflict — Stage 3 names two different things

- **The supplement says.** Stage 3 IS Pre-Gold, on Oracle Exadata, and a fourth tier - Consumer Movement - carries publish and delivery with no transformation in flight.
- **This design holds.** The data path draws Stage 3 as the warehouse itself, with Pre-Gold as a separate layer before it and no publish tier at all.
- **What it costs to leave open.** Every document that says 'Stage 3' means one of two different databases. The acceptance criterion 'every component is assigned to one canonical domain and tier' cannot be evaluated until this is picked.
- **Decision.** `DEC-GAP-01`

#### Conflict — DIM and FACT are in the wrong tier

- **The supplement says.** Dimensions, facts, aggregates and control-total preparation are Stage 3 Pre-Gold, on Exadata. Stage 2 is normalised canonical entities and stops there.
- **This design holds.** Stage 2 INT is drawn as INT, DIM and FACT together, on the same Oracle estate - which is how both SEI design documents describe it.
- **What it costs to leave open.** This is not a folder move. If the supplement holds, DIM and FACT change database, the dbt chain splits across two estates, and the STG-to-INT reconciliation boundary stops being the last one that matters.
- **Decision.** `DEC-GAP-01`

#### Conflict — Three different counts of reconciliation boundaries

- **The supplement says.** Seven boundaries, including Stage 2 to Stage 3 and publish to consumer acknowledgement.
- **This design holds.** The pack specifies three. The architect review recommends twelve under an event-primary posture.
- **What it costs to leave open.** Nobody can say whether reconciliation is complete, because complete is three, seven or twelve depending on which document is open.
- **Decision.** `none raised - worth one`

#### Conflict — Stage 2 retention is settled here and open there

- **The supplement says.** Seven-day retention WHERE DEFINED, and SILVER-DEC-06 leaves retention and partition management open per entity.
- **This design holds.** Seven days, partition drop, stated flatly on every one of the 52 tables.
- **What it costs to leave open.** The replay window follows from retention. Stating it as settled when it is a per-entity decision makes every replay answer provisional without saying so.
- **Decision.** `SILVER-DEC-06`

#### Closes a gap — Stage 2 to Stage 3 movement has a pattern and a gate

- **The supplement says.** Database-link or direct-path movement preserving LOAD_ID and BUSINESS_DATE, with a reconciliation gate that authorises or holds the publish scope, and a replay boundary scoped by date and load.
- **This design holds.** The database picture has no movement component at all - Pre-Gold simply follows DIM and FACT with nothing in between.
- **What it costs to leave open.** Closed in design. Still needs DEC-GAP-04 to pick the mechanism.
- **Decision.** `DEC-GAP-04`

#### New — LOAD_ID is missing from every model we draw

- **The supplement says.** LOAD_ID is the identifier preserved from RAW through Stage 2, Stage 3, replay and publish evidence, and acceptance criterion 4 depends on it.
- **This design holds.** Stage 1 adds BUSINESS_DATE, SRC_RECORD_ID, FILE_REGISTRY_ID and LOAD_TS. Stage 2's standard columns add MICRO_BATCH_ID and DBT_INVOCATION_ID. Neither carries LOAD_ID.
- **What it costs to leave open.** Without it there is no single identifier for one load execution across four tiers, and the Stage 2 to Stage 3 reconciliation gate has nothing to key on. This is a hole in our own model, not in theirs.
- **Decision.** `SILVER-DEC-04`

#### New — Seven of 52 canonical models exist

- **The supplement says.** The code sample implements Account, Account Optional Field, Asset, Reference, Tax Lot, Transaction Header and Transaction Detail. Four of those seven are mapped to fewer attributes than the canonical model defines. The other 45 are targets.
- **This design holds.** All 52 canonical tables are drawn alike, with no build status at all - a model and an intention look identical.
- **What it costs to leave open.** Anyone sizing the work from our screens sees 52 designed tables and no indication that 45 of them do not exist.
- **Decision.** `SILVER-DEC-01`

#### New — A consumer-oriented model is sitting in Stage 2

- **The supplement says.** int_bbh_open_trade_star joins six INT models into a denormalised target layout and belongs in Pre-Gold or Publish.
- **This design holds.** Nothing. The app models the canonical layer and has no view of what is actually in the dbt project.
- **What it costs to leave open.** Consumer denormalisation inside Stage 2 is what stops Stage 2 being reusable: the next consumer needs a different shape and gets a second star beside the first.
- **Decision.** `SILVER-DEC-07`

#### Confirms the baseline — Dimensions before facts, and no placeholder keys

- **The supplement says.** Build dimensions before facts; late-arriving dimensions are held rather than replaced with placeholder keys.
- **This design holds.** The same, on the transformation chain and the Gold layer.

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand. Correct the
model and every document that used it is corrected with it:
`node tools/export_design_model.mjs && python3 tools/gen_design_docs.py`
