---
id: stage1-raw-model
title: Stage 1 RAW Model
level: L1
icon: ▧
color: #5c6b7a
bg: #eef1f4
order: 5
sub: one table per interface, append-only, no keys
generated: true
sei_status: overview
---

# Stage 1 — the RAW data model

**One table per inbound interface.** The DDL is per interface, declared alongside the interface rather than in a central model. FILE_SCHEMA_CONFIG.TARGET_RAW_TABLE is what routes a file to its table, which is why there is deliberately no column-mapping table: the RAW table's own DDL is the schema contract.

*ingest Glossary (p.25) - dbt section 4.1 (p.10)*

There is no canonical model here, and that is the design. Stage 1
holds what arrived, in the shape it arrived in. The first normalised
model is Stage 2 INT.

## The five rules

| Rule | What it means |
|---|---|
| **Append-only** | Rows are added, never updated in place. A corrected delivery is a new row set for the same business date, not an edit. |
| **No keys declared** | No primary key, no foreign key, no uniqueness. Identity is asserted first in STG, and enforced first in INT. |
| **Nothing cleaned** | No trimming, no casting beyond what the load needs, no code translation. The first thing that reads a row's content is the STG view. |
| **Nothing rejected** | A row that will fail DQ still lands. Rejection is a Stage 2 decision, so the evidence of what arrived survives it. |
| **One transaction per file** | A file loads whole or not at all, and the three counts must agree before the commit. |

## The only columns Stage 1 adds

| Column | Type | Purpose |
|---|---|---|
| `BUSINESS_DATE` | date | which day this row belongs to - set from the file, not from the clock |
| `SRC_RECORD_ID` | number | the row's identity within its delivery, so a DQ failure in Stage 2 can name the line it came from |
| `FILE_REGISTRY_ID` | number | which delivery it arrived in - the join back to the file, its counts and its archive path |
| `LOAD_TS` | timestamp | when it landed |

`LOAD_ID` is **not** among them, and the supplement makes it the
identifier preserved across all four tiers. See R9.

## The RAW tables

| Table | Named by |
|---|---|
| `RAW_ACCOUNT` | both sources |
| `RAW_CLIENT` | both sources |
| `RAW_TRANSACTION` | both sources |
| `RAW_TAXLOT` | **the architecture only** |
| `RAW_POSITION` | **the architecture only** |
| `RAW_CORRECTED_TRANSACTION` | **the architecture only** |
| `RAW_CORRECTED_POSITION` | **the architecture only** |

### Conflict C1 — Three RAW tables, or seven

The architecture names seven. The dbt design document names three - account, client and transaction. Position, tax lot and the two correction tables do not appear in it at all.

Four of the seven feeds have no transformation designed for them. If the architecture is right, the design document covers under half the inbound surface, and the gap is invisible from Stage 2 because nothing downstream asks for a table that was never modelled.

## What Stage 1 does not answer

- No entities and no relationships - the first normalised model is Stage 2 INT.
- No reference-code translation - codes land as delivered.
- No deduplication - a duplicate delivery is two row sets, told apart by FILE_REGISTRY_ID.
- No retention rule is stated in either document for RAW, unlike INT's seven days.

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand.
