---
id: feed-to-stage1-map
title: Feed to Stage 1 Map
level: L1
icon: ⇄
color: #0091bf
bg: #e4f0fb
order: 7
sub: 38 feeds, 23 with no RAW table named
generated: true
sei_status: overview
---

# SWP feed — Stage 1 RAW — Stage 2 canonical

Neither document publishes this map. The only real one is
`FILE_SCHEMA_CONFIG.TARGET_RAW_TABLE`, which is configuration rather
than a list, so the chain from a file to a canonical table exists
nowhere on paper. What follows is matched by name and labelled with
how confident that match is.

**23 of 38 feeds have no Stage 1 landing table named by either
document**, and two of them — ASSET and PORTFOLIO — are anchors of the Stage 2
model.

| | Count |
|---|---|
| Feeds | 38 |
| RAW table named | 6 |
| Inferred | 9 |
| No RAW table | 23 |

## One feed is not one table

| Feed | Canonical tables |
|---|---|
| Account | 7 |
| Client | 6 |
| Transaction Header | 3 |
| Transaction Detail | 2 |

## The map

| Feed | Stage 1 RAW | Confidence | Stage 2 canonical tables |
|---|---|---|---|
| Account | `RAW_ACCOUNT` | named | `ACCOUNT`, `ACCOUNT_FEE_PACKAGE_ASSOCIATION`, `ACCOUNT_INVESTMENT_GUIDELINES`, `ACCOUNT_INVESTMENT_MANAGER`, `ACCOUNT_INVESTMENT_RESTRICTIONS`, `ACCOUNT_SOLUTION`, `ACCOUNT_SPECIFIC_FEE` |
| Account Optional Fields | `RAW_ACCOUNT` | likely | `ACCOUNT_OPTIONAL_FIELDS` |
| Active Commits and Blocks | `RAW_POSITION` | likely | `ACTIVE_COMMITS_AND_BLOCKS` |
| Asset | — | none | `ASSET` |
| Asset Investment Class | — | none | `ASSET_INVESTMENT_CLASS` |
| Asset Optional Fields | — | none | `ASSET_OPTIONAL_FIELDS` |
| Client | `RAW_CLIENT` | named | `CLIENT`, `CLIENT_INVESTMENT_MANAGER`, `CLIENT_RELATED_THIRD_PARTY`, `CLIENT_SOLUTION`, `CLIENT_TAX_PROFILE`, `CLIENT_W8_PROFILE` |
| Client Account Linkage | `RAW_CLIENT` | likely | `CLIENT_ACCOUNT_LINKAGE` |
| Contact Details | `RAW_CLIENT` | likely | `PARTY_CONTACT` |
| Curr Upcoming Activities | — | none | `UPCOMING_CASH_ACTIVITIES` |
| Custody And Nostro Pos | `RAW_POSITION` | likely | `CUSTODY_AND_NOSTRO_POS` |
| End of Day Positions | `RAW_POSITION` | named | `END_OF_DAY_POSITIONS` |
| End of Period Value Agg | `RAW_POSITION` | likely | `END_OF_PERIOD_VALUE_AGG` |
| Fee Computation | — | none | `FEE_COMPUTATION` |
| Fee Group | — | none | `FEE_GROUP` |
| Fee Package | — | none | `FEE_PACKAGE` |
| Fee Package Usage | — | none | `FEE_PACKAGE_USAGE` |
| Fund Cutoff Times | — | none | `FUND_CUTOFF_TIMES` |
| FX Forward Position | `RAW_POSITION` | likely | `FX_FORWARD_POSITION` |
| Interest Rates | — | none | `INTEREST_RATES` |
| Model | — | none | `MODEL` |
| Model Allocation | — | none | `MODEL_ALLOCATION` |
| Party Optional Fields | `RAW_CLIENT` | likely | `PARTY_OPTIONAL_FIELDS` |
| Pay To Recipients | — | none | `PAY_TO_RECIPIENTS` |
| Portfolio | — | none | `PORTFOLIO` |
| Portfolio Groups | — | none | `PORTFOLIO_GROUPS` |
| Recurring Cash Activities | — | none | `RECURRING_CASH_ACTIVITY` |
| Reference | — | none | `REFERENCE` |
| Relationships | `RAW_CLIENT` | likely | `PARTY_RELATIONSHIPS` |
| Role Details | — | none | `ROLE_DETAILS` |
| Statement Event | — | none | `STATEMENT_EVENT` |
| Statement Event Instance | — | none | `STATEMENT_EVENT_INSTANCE` |
| Statement Package | — | none | `STATEMENT_PACKAGE` |
| Taxlot | `RAW_TAXLOT` | named | `TAXLOT` |
| Transaction Detail | `RAW_TRANSACTION` | named | `TRANSACTION_DETAIL`, `TRANSACTION_DETAIL_ADJUSTMENT_TYPE` |
| Transaction Header | `RAW_TRANSACTION` | named | `TRANSACTION_HEADER`, `TRANSACTION_HEADER_ADJUSTMENT_TYPE`, `TRANSACTION_HEADER_RELATED_TRANSACTION` |
| User Detail | — | none | `USER_DETAIL` |
| User Team and Role | — | none | `USER_TEAM_AND_ROLE` |

## RAW tables with no feed

`RAW_CORRECTED_TRANSACTION` and `RAW_CORRECTED_POSITION` are named by the architecture but have no source sheet in the
canonical model. Corrections arrive as a re-delivery rather than as a
feed of their own — or they do not, and which reading is right is
conflict C4.

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand.
