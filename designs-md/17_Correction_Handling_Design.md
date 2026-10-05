---
cp360_type: design_document
component_id: 17
component_name: Correction Handling
zone: 2. Hub
plane: Processing
priority: P1
technology: dbt
custom_build: High
depends_on: [15, 16, 21]
status: Not Started
owner: TBD
architecture_decisions: [AD-2, AD-8, AD-9]
pipeline_tiers: [Stage2-Oracle, Stage3-Exadata-Gold]
last_updated: 2026-08-10
tags: [SEI-BBH, Integration-Hub, hub, processing, bitemporal]
origin: SEI-BBH component tracker
sei_coverage: partial
gap_owner: SEI
in_scope: true
generated: true
sei_status: specified
generated: true
sei_status: specified
generated: true
sei_status: specified
---

# Correction Handling

## What this component is

SEI gives it the rule it was missing: a closed interval is corrected by direct UPDATE, never by MERGE.

It sits in **Processing**, in the **dbt models** lane (dbt · Oracle).

## What SEI specifies

### S16 — DIM — built first

History by direct-compare MERGE into tables that already exist. The surrogate key comes from the Oracle sequence already in use. No DDL is issued against Gold.

- **Technology.** dbt MERGE
- **Source.** dbt §4.1 (p.10) · §6.4 (p.15)

## The Oracle objects it touches

No foreign key is declared in either document. Every join below
is one a model runs, not a constraint the database enforces.

| Object | What it holds | Source |
|---|---|---|
| `INT tables` | Silver persistence. Passing rows only, seven days, partitioned by business date. | dbt §4.1 (p.10) · Appendix A.3 (p.26) |
| `Gold DIM / FACT` | Already exist and already carry history from the current system. This programme changes only how they are populated. | dbt §6.4 (p.15) · §10.1 (p.23) |

## What happens when it goes wrong

| # | Scenario | What the design does | Source |
|---|---|---|---|
| X32 | A correction arrives and the row is still current | A normal MERGE, joined on the surrogate key rather than the natural key — a natural-key join matches both the closing and the opening row and fails. | dbt §6.4.1 (p.15) |
| X33 | A correction arrives and the interval is already closed | A direct UPDATE of that closed row only. Never a MERGE — it would reopen an interval that is settled. | dbt §6.4.1 (p.15) |
| X34 | Someone changes the shape of a Gold table | Refused. Every Gold model fails on a schema change, and the service account holds DML only — no create, alter or drop. | dbt §8.4 (p.21) |

## Where SEI's documents disagree about this

Each one is a decision to take before a model is written.

### C3 — Two Gold facts, or three

- **The architecture says.** FACT_TRANSACTIONS, FACT_CP_HOLDINGS and FACT_TAX_LOT, each with its own strategy — merge, merge and periodic snapshot.
- **The design documents say.** FACT_TRANSACTIONS only.
- **Why it matters.** Holdings and tax lot are the two the design document is silent on, and a periodic snapshot is a different pattern from a merge — it is not covered by the SCD2 and merge logic that is specified.

### C4 — Corrections as files, or as a rule

- **The architecture says.** Two correction files arrive daily and Stage 2 has a named step, correction file integration, that merges them.
- **The design documents say.** Correction is a MERGE-versus-UPDATE rule applied inside the dimension build. No correction file is described.
- **Why it matters.** The architecture has corrections entering as data; the design document has them as a write strategy. Both may be needed, but nobody has said how a correction file reaches the rule.

## Still open with SEI

SEI's own ids, so they can be quoted straight back.

- **D1.** Confirm the existing sequence name and ownership behind the Gold surrogate key.
- **D3.** Confirm the current history coverage of the existing dimensions.

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand. Correct the
model and every document that used it is corrected with it:
`node tools/export_design_model.mjs && python3 tools/gen_design_docs.py`
