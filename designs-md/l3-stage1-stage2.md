---
id: l3-stages
title: Stage 1 RAW & Stage 2 Enriched
level: L3
icon: 🧱
color: #0e8f7e
bg: #dff2ef
order: 3
sub: withdrawn - to be rewritten from the drawing
match: stage ?1|stage ?2|raw|enrich|dbt|landing|staging|transform
generated: true
sei_status: overview
---

# The layer model

## As BBH states it

Stage 2, Silver and Enriched are one layer under three names. Inside it: STG is a view, held in memory, and its job is the source DQ check. INT, DIM and FACT together are the normalised SWP data model, with reference mapping and translation applied.

Above that sit two layers SEI's documents do not describe: a PRE-GOLD layer shaped as a mirror of IMDS and PBDW, and then a simple movement of that data into the actual warehouse. SEI's design publishes straight from DIM and FACT and stops.

**Why it matters.** It changes what Gold means. In SEI's documents DIM and FACT are the approved Gold tables and the end of the line. In BBH's model they are the normalised middle, and Gold is the consumer-shaped mirror above them. Both cannot be the published contract, and which one is decides where reconciliation has to end.

*BBH, stated directly — not from either SEI document*

## The stage chain

| Stage | What it is | What is in it |
|---|---|---|
| **Stage 1** — RAW — as delivered | The file exactly as it arrived, append-only, tagged with the business date and lineage. Nothing is cleaned here. | `T4` |
| **Stage 2** — STG — a view, in memory | Standardises the columns and marks every row pass or fail. It is a view: it holds nothing and is recomputed on read. Its job is the source DQ check. | `S14` |
| **Stage 2 INT** — the normalised SWP model | INT, DIM and FACT together, with reference mapping and translation applied. Passing rows only; INT keeps seven days; dimensions are built before facts so a transaction can always find its account. | `S15` `S16` `S17` `T5` `T6` |
| **Stage 3** — the actual data warehouse | A Pre-Gold layer shaped as a mirror of IMDS and PBDW, then a simple movement of that data into the warehouse itself. | `B1` `B2` |

## As the architecture states it

| Layer | Technology | Objects |
|---|---|---|
| **Python ingestion** | Python + Oracle | — |
| **RAW (SWP)** | Python-managed, append only | `RAW_ACCOUNT`, `RAW_CLIENT`, `RAW_TAXLOT`, `RAW_TRANSACTION`, `RAW_POSITION`, `RAW_CORRECTED_TRANSACTION`, `RAW_CORRECTED_POSITION` |
| **Stage 2** | dbt · table | `STG2_ACCOUNT`, `STG2_INTERESTED_PARTY`, `STG2_TAX_LOT`, `STG2_TRANSACTIONS`, `STG2_CP_HOLDINGS` |
| **Gold** | dbt · existing Oracle DW tables | `DIM_ACCOUNT (SCD2)`, `DIM_INTERESTED_PARTY (SCD2)`, `FACT_TRANSACTIONS (merge)`, `FACT_CP_HOLDINGS (merge)`, `FACT_TAX_LOT (periodic snapshot)` |
| **Consumption** | BI | — |

## The feeds, and what each does to Gold

| Feed | Files | Pattern | Gold |
|---|---|---|---|
| **Full snapshot** — the entire table, every day | Account Snapshot · Client Snapshot · Tax Lot Snapshot | SCD2 / periodic snapshot | DIM_ACCOUNT and DIM_INTERESTED_PARTY as SCD2; FACT_TAX_LOT appended by date |
| **Delta** — new or changed records today | Transaction Delta · Position Delta | incremental / merge | FACT_TRANSACTIONS and FACT_CP_HOLDINGS, both merged |
| **Correction** — past records corrected today | Corrected Transactions · Corrected Positions | merge, updating what is already there | FACT_TRANSACTIONS and FACT_CP_HOLDINGS, same two facts |

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand.
