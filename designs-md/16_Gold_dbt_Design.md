---
cp360_type: design_document
component_id: 16
component_name: Gold (dbt)
zone: 2. Hub
plane: Processing
priority: P1
technology: dbt
custom_build: High
depends_on: [15, 26, 60]
status: Not Started
owner: TBD
architecture_decisions: [AD-1, AD-2, AD-9]
pipeline_tiers: [Stage3-Exadata-Gold, Consumer-Movement]
last_updated: 2026-08-13
tags: [SEI-BBH, Integration-Hub, processing]
origin: SEI-BBH component tracker
sei_coverage: covered
gap_owner: SEI
in_scope: true
generated: true
sei_status: specified
architecture_domain: Processing
canonical_tier: Stage 2 - Enriched (INT)
control_entities: [DATE_CONTROL, DQ_VALIDATION_FAILURE, RECON_RESULT]
traceability_identifiers: [LOAD_ID, BUSINESS_DATE, SRC_RECORD_ID]
supplement: CP360-GAP-DESIGN-SUPPLEMENT
---

# Gold (dbt)

## What this component is

One tracker component, two ordered SEI layers — and the tables already exist, so dbt populates rather than builds them.

It sits in **Processing**, in the **dbt models** lane (dbt · Oracle).

## What SEI specifies

### S16 — DIM — built first

History by direct-compare MERGE into tables that already exist. The surrogate key comes from the Oracle sequence already in use. No DDL is issued against Gold.

- **Technology.** dbt MERGE
- **Source.** dbt §4.1 (p.10) · §6.4 (p.15)

### S17 — FACT — built second

Loads only transactions whose dimension has resolved. A transaction whose account has not arrived is never written with a placeholder key — it is held and replayed once the dimension exists.

- **Technology.** dbt MERGE
- **Source.** dbt §4.1 (p.10) · §7.1 (p.17)

### T6 — Gold DIM / FACT

Already exist and already carry history from the current system. This programme changes only how they are populated.

- **Columns.** DIM_ACCOUNT: ACCOUNT_KEY (PK) · ACCOUNT_NUMBER · ACCOUNT_TYPE · SITUS_CODE · START_DATE · END_DATE · ACTIVE_IND  │  FACT_TRANSACTIONS: TRANSACTION_ID (PK) · BUSINESS_DATE · TRANSACTION_AMOUNT · ACCOUNT_KEY
- **Source.** dbt §6.4 (p.15) · §10.1 (p.23)

## The Oracle objects it touches

No foreign key is declared in either document. Every join below
is one a model runs, not a constraint the database enforces.

| Object | What it holds | Source |
|---|---|---|
| `INT tables` | Silver persistence. Passing rows only, seven days, partitioned by business date. | dbt §4.1 (p.10) · Appendix A.3 (p.26) |
| `Gold DIM / FACT` | Already exist and already carry history from the current system. This programme changes only how they are populated. | dbt §6.4 (p.15) · §10.1 (p.23) |
| `DQ_VALIDATION_FAILURE` | One store for both failure categories, carrying whether the row can replay itself and whether it is still open. | dbt §7.1 (p.17) |

## What happens when it goes wrong

| # | Scenario | What the design does | Source |
|---|---|---|---|
| X32 | A correction arrives and the row is still current | A normal MERGE, joined on the surrogate key rather than the natural key — a natural-key join matches both the closing and the opening row and fails. | dbt §6.4.1 (p.15) |
| X33 | A correction arrives and the interval is already closed | A direct UPDATE of that closed row only. Never a MERGE — it would reopen an interval that is settled. | dbt §6.4.1 (p.15) |
| X34 | Someone changes the shape of a Gold table | Refused. Every Gold model fails on a schema change, and the service account holds DML only — no create, alter or drop. | dbt §8.4 (p.21) |
| X22 | FACT fails after DIM succeeded | The restart resumes at the fact build. The dimension is not rebuilt. | dbt §8.1 (p.20) |
| X30 | A transaction's dimension has not arrived | Never written to Gold with a placeholder key. Held in the DQ store as replayable and OPEN, re-derived from INT on a later day once the dimension exists, then marked RESOLVED. | dbt §7.1 (p.17) · Figure 5a (p.18) |

## Where SEI's documents disagree about this

Each one is a decision to take before a model is written.

### C3 — Two Gold facts, or three

- **The architecture says.** FACT_TRANSACTIONS, FACT_CP_HOLDINGS and FACT_TAX_LOT, each with its own strategy — merge, merge and periodic snapshot.
- **The design documents say.** FACT_TRANSACTIONS only.
- **Why it matters.** Holdings and tax lot are the two the design document is silent on, and a periodic snapshot is a different pattern from a merge — it is not covered by the SCD2 and merge logic that is specified.

## Still open with SEI

SEI's own ids, so they can be quoted straight back.

- **D1.** Confirm the existing sequence name and ownership behind the Gold surrogate key.
- **D2.** Confirm all missing dimensions resolve inside the seven-day window, and approve the single-table DQ design, the replay policy and the retention-boundary alert.
- **D3.** Confirm the current history coverage of the existing dimensions.

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
