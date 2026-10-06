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
generated: true
sei_status: specified
architecture_domain: Orchestration
canonical_tier: not on the stage chain
control_entities: [DATE_CONTROL, FILE_REGISTRY]
traceability_identifiers: [BUSINESS_DATE, DAG_RUN_ID]
supplement: CP360-GAP-DESIGN-SUPPLEMENT
---

# Dim-before-Fact / dbt Threads

## What this component is

Re-checks completeness and TRIGGER status before doing any work — trust but verify — then builds the layers in order, each as a build task followed by its own test task.

It sits in **Orchestration**, in the **Transformation DAG** lane (Airflow 3.0 · dbt).

## What SEI specifies

### S13 — Transformation DAG

Re-checks completeness and TRIGGER status before doing any work — trust but verify — then builds the layers in order, each as a build task followed by its own test task.

- **Technology.** Airflow + dbt
- **Source.** dbt §5.2 (p.11) · Appendix A.1 (p.25)

### S16 — DIM — built first

History by direct-compare MERGE into tables that already exist. The surrogate key comes from the Oracle sequence already in use. No DDL is issued against Gold.

- **Technology.** dbt MERGE
- **Source.** dbt §4.1 (p.10) · §6.4 (p.15)

### S17 — FACT — built second

Loads only transactions whose dimension has resolved. A transaction whose account has not arrived is never written with a placeholder key — it is held and replayed once the dimension exists.

- **Technology.** dbt MERGE
- **Source.** dbt §4.1 (p.10) · §7.1 (p.17)

## The Oracle objects it touches

No foreign key is declared in either document. Every join below
is one a model runs, not a constraint the database enforces.

| Object | What it holds | Source |
|---|---|---|
| `DATE_CONTROL` | The orchestration ledger, and the one object both documents write to. One row per business date, at most one row not COMPLETE at a time, enforced by a unique index on a CASE expression. | ingest Appendix E.1 (p.24) · §6.3 (p.13) · dbt Appendix A.2 (p.25) |
| `INT tables` | Silver persistence. Passing rows only, seven days, partitioned by business date. | dbt §4.1 (p.10) · Appendix A.3 (p.26) |
| `Gold DIM / FACT` | Already exist and already carry history from the current system. This programme changes only how they are populated. | dbt §6.4 (p.15) · §10.1 (p.23) |
| `DQ_VALIDATION_FAILURE` | One store for both failure categories, carrying whether the row can replay itself and whether it is still open. | dbt §7.1 (p.17) |

## What happens when it goes wrong

| # | Scenario | What the design does | Source |
|---|---|---|---|
| X21 | A transformation task fails | The date stays TRIGGER, no next date is created and the pipeline is locked. Airflow alerts and the run restarts from the failed task; each layer's write is idempotent for the date. | dbt §8.1 (p.20) |
| X39 | A successful file has to be replaced | Approval first, then the reason, approver, operator and affected downstream scope are recorded. The registry row and the RAW rows are deleted through the controlled process, the corrected file is dropped in Landing, and a fresh lifecycle starts. The downstream rebuild for that date is coordinated separately. | ingest Appendix D.4 (p.23) |
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
- **D5.** Confirm retention units, Oracle partitioning support, volumetrics and run-window targets.

## How this works, from the architecture supplement

### DATE_CONTROL transition ownership

| Transition | Owner | Guard |
|---|---|---|
| Create PENDING | Transformation completion process | Previous date completed and no conflicting active row |
| PENDING to TRIGGER | Ingestion completeness task | Missing-interface set is empty AND the atomic update affects one row |
| TRIGGER to COMPLETE | Transformation DAG | Required models, tests, DQ gates, reconciliation and publish succeed |
| TRIGGER retry | Authorised recovery procedure | Same business date and replay-safe processing |

### The two-DAG contract

- Run separate Ingestion and Transformation DAGs
- Use DATE_CONTROL as the durable business-date state machine
- Permit one guarded owner of the PENDING to TRIGGER transition
- Build dimensions before facts
- Advance to the next business date only after the complete transformation and publish boundary succeeds

## Open against this component

**2 other open items** — `GAP-06`, `R17`. Stated in full, with both readings and the decision each needs, in the gap supplement.

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand. Correct the
model and every document that used it is corrected with it:
`node tools/export_design_model.mjs && python3 tools/gen_design_docs.py`
