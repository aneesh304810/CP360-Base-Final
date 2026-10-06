---
id: stage2-canonical-model
title: Stage 2 Canonical Model
level: L1
icon: ◉
color: #159943
bg: #e8f6ed
order: 6
sub: 52 canonical tables, 10 domains, 7 built
generated: true
sei_status: overview
---

# Stage 2 — Silver, Enriched, the normalised canonical model

52 canonical tables across 10 business domains, 73 relationships, fed only by STG PASS rows.

**7 of the 52 exist in code**, and four of those are mapped to fewer
attributes than the canonical model defines. The rest are targets.
See R10.

## The INT contract

| Concern | Contract |
|---|---|
| Input | STG view rows where DQ_STATUS_CD = PASS, plus approved mapping tables |
| Materialization | dbt incremental table, partitioned by BUSINESS_DATE |
| Primary key | Natural key from the dictionary PLUS BUSINESS_DATE |
| Surrogate keys | Not generated here. Gold sequences such as ACCOUNT_KEY are never used in INT |
| Retention | 7 days, by partition drop |
| Transformation DQ | Unmapped codes, ambiguous mappings and unresolved relationships raise DQ_VALIDATION_FAILURE |
| Replay | OPEN, reprocess-eligible rows are re-selected by key plus BUSINESS_DATE |
| Reconciliation | STG PASS count = INT count, per table per BUSINESS_DATE, boundary STG_TO_INT |

## Standard columns, on all 52

Not in the canonical dictionary. Required by the contract, so every
dictionary key is short by at least one column.

| Column | Type | Purpose |
|---|---|---|
| `BUSINESS_DATE` | date | partition and key part |
| `SRC_RECORD_ID` | number | RAW lineage |
| `FILE_REGISTRY_ID` | number | file lineage |
| `MICRO_BATCH_ID` | number | event lineage — the event path's equivalent |
| `LOAD_TS` | timestamp | load time |
| `DBT_INVOCATION_ID` | varchar | run audit |

## Domains

| Domain | Tables | Built |
|---|---|---|
| Party Management | 11 | 0 |
| Account & Portfolio | 10 | 2 |
| Asset & Security Master | 3 | 1 |
| Positions & Holdings | 6 | 1 |
| Transactions & Cash Activity | 7 | 2 |
| Fees & Billing | 4 | 0 |
| Statements & Communications | 3 | 0 |
| Investment Product | 2 | 0 |
| Organization & Security | 3 | 0 |
| Reference & Configuration | 3 | 1 |

## Every canonical table

The INT key is the dictionary key **plus** `BUSINESS_DATE`.

| Table | Domain | INT key | Source sheet | Build |
|---|---|---|---|---|
| `CLIENT` | Party Management | `CLIENT_ID, BUSINESS_DATE` | Client | target |
| `CLIENT_ACCOUNT_LINKAGE` | Party Management | `CLIENT_ID, ACCOUNT_ID, RELATIONSHIP, BUSINESS_DATE` | Client Account Linkage | target |
| `CLIENT_INVESTMENT_MANAGER` | Party Management | `no dictionary key defined` | Client | target |
| `CLIENT_RELATED_THIRD_PARTY` | Party Management | `no dictionary key defined` | Client | target |
| `CLIENT_SOLUTION` | Party Management | `no dictionary key defined` | Client | target |
| `CLIENT_TAX_PROFILE` | Party Management | `no dictionary key defined` | Client | target |
| `CLIENT_W8_PROFILE` | Party Management | `no dictionary key defined` | Client | target |
| `PARTY_CONTACT` | Party Management | `CONTACT_IDENTIFIER, CONTACT_TYPE, ENTITY_IDENTIFIER, BUSINESS_DATE` | Contact Details | target |
| `PARTY_OPTIONAL_FIELDS` | Party Management | `PARTY_ID, BUSINESS_DATE` | Party Optional Fields | target |
| `PARTY_RELATIONSHIPS` | Party Management | `RELATIONSHIP_IDENTIFIER, RELATIONSHIP_ROLE, BUSINESS_DATE` | Relationships | target |
| `PAY_TO_RECIPIENTS` | Party Management | `ACCOUNT_NUMBER, ENTITY_ID, PAY_TO_METHOD, PROFILE_ID, BUSINESS_DATE` | Pay To Recipients | target |
| `ACCOUNT` | Account & Portfolio | `ACCOUNT_ID, BUSINESS_DATE` | Account | sample-expand |
| `ACCOUNT_FEE_PACKAGE_ASSOCIATION` | Account & Portfolio | `ACCOUNT_ID, FEE_PACKAGE_ID, BUSINESS_DATE` | Account | target |
| `ACCOUNT_INVESTMENT_GUIDELINES` | Account & Portfolio | `ACCOUNT_ID, INVESTMENT_GUIDELINE_ID, BUSINESS_DATE` | Account | target |
| `ACCOUNT_INVESTMENT_MANAGER` | Account & Portfolio | `ACCOUNT_ID, INVESTMENT_MANAGER, BUSINESS_DATE` | Account | target |
| `ACCOUNT_INVESTMENT_RESTRICTIONS` | Account & Portfolio | `ACCOUNT_ID, INVESTMENT_RESTRICTIONS, BUSINESS_DATE` | Account | target |
| `ACCOUNT_OPTIONAL_FIELDS` | Account & Portfolio | `ACCOUNT_ID, ACCOUNT_NUMBER, ACCOUNT_OPTIONAL_FIELD_ID, ACCOUNT_OPTIONAL_FIELD_VALUE, BUSINESS_DATE` | Account Optional Fields | sample |
| `ACCOUNT_SOLUTION` | Account & Portfolio | `ACCOUNT_ID, SOLUTION, BUSINESS_DATE` | Account | target |
| `ACCOUNT_SPECIFIC_FEE` | Account & Portfolio | `ACCOUNT_ID, ACCOUNT_SPECIFIC_FEE_TYPE, BUSINESS_DATE` | Account | target |
| `PORTFOLIO` | Account & Portfolio | `PORTFOLIO_ID, BUSINESS_DATE` | Portfolio | target |
| `PORTFOLIO_GROUPS` | Account & Portfolio | `GROUP_ID, GROUP_TYPE_ID, BUSINESS_DATE` | Portfolio Groups | target |
| `ASSET` | Asset & Security Master | `FIRM_ID, INSTRUMENT_ID, BUSINESS_DATE` | Asset | sample-expand |
| `ASSET_INVESTMENT_CLASS` | Asset & Security Master | `SCHEMA_ID, TRD_INSTRUMENT_ID, BUSINESS_DATE` | Asset Investment Class | target |
| `ASSET_OPTIONAL_FIELDS` | Asset & Security Master | `ASSET_OPTIONAL_FIELD_DATA_ID, BUSINESS_DATE` | Asset Optional Fields | target |
| `ACTIVE_COMMITS_AND_BLOCKS` | Positions & Holdings | `ACCOUNT_NUMBER, FIRM_ID, PORTFOLIO_ID, TRD_INSTRUMENT_ID, BUSINESS_DATE` | Active Commits and Blocks | target |
| `CUSTODY_AND_NOSTRO_POS` | Positions & Holdings | `ACCOUNT_NUMBER, INSTRUMENT_ID, ISO_3_CHARACTER_CCY, PORTFOLIO_ID, POSITION_TYPE, POSK_ID, TRADING_PARTNER_ACCOUNT_NAME, TRADING_PARTNER_ACCOUNT_NUMBER, BUSINESS_DATE` | Custody And Nostro Pos | target |
| `END_OF_DAY_POSITIONS` | Positions & Holdings | `AS_OF_DATE, TAXLOT_PORTFOLIO_ID, TRD_INSTRUMENT_ID, BUSINESS_DATE` | End of Day Positions | target |
| `END_OF_PERIOD_VALUE_AGG` | Positions & Holdings | `ACCOUNT_NUMBER, FIRM_ID, BUSINESS_DATE` | End of Period Value Agg | target |
| `FX_FORWARD_POSITION` | Positions & Holdings | `COUNTER_CURR, PORTFOLIO_ID, PROCESSING_DATE, REFERENCE_CURR, BUSINESS_DATE` | FX Forward Position | target |
| `TAXLOT` | Positions & Holdings | `TAXLOT_ID, BUSINESS_DATE` | Taxlot | sample |
| `RECURRING_CASH_ACTIVITY` | Transactions & Cash Activity | `ACCOUNT_NUMBER, NEXT_ACTIVITY_ID, PORTFOLIO_ID, PROCESSING_SCHEDULE_ID, BUSINESS_DATE` | Recurring Cash Activities | target |
| `TRANSACTION_DETAIL` | Transactions & Cash Activity | `TRANSACTION_DETAIL_ID, BUSINESS_DATE` | Transaction Detail | sample-expand |
| `TRANSACTION_DETAIL_ADJUSTMENT_TYPE` | Transactions & Cash Activity | `ADJUSTMENT_TYPE, TRANSACTION_DETAIL_ID, BUSINESS_DATE` | Transaction Detail | target |
| `TRANSACTION_HEADER` | Transactions & Cash Activity | `TRANSACTION_ID, BUSINESS_DATE` | Transaction Header | sample-expand |
| `TRANSACTION_HEADER_ADJUSTMENT_TYPE` | Transactions & Cash Activity | `ADJUSTMENT_TYPE, TRANSACTION_ID, BUSINESS_DATE` | Transaction Header | target |
| `TRANSACTION_HEADER_RELATED_TRANSACTION` | Transactions & Cash Activity | `TRANSACTION_ID, RELATED_TRANSACTION_ID, BUSINESS_DATE` | Transaction Header | target |
| `UPCOMING_CASH_ACTIVITIES` | Transactions & Cash Activity | `ACCOUNT_NUMBER, ACTIVITY_REF, ACTIVITY_TYPE, PORTFOLIO_ID, BUSINESS_DATE` | Curr Upcoming Activities | target |
| `FEE_COMPUTATION` | Fees & Billing | `COMPUTATION_ACTIVITY_ID, FEE_BASIS, RULE_DESCRIPTION, BUSINESS_DATE` | Fee Computation | target |
| `FEE_GROUP` | Fees & Billing | `FEE_GROUP_MEMBER_ACCOUNT, FEE_GROUP_MEMBER_ACCOUNT_PORTFOLIO, BUSINESS_DATE` | Fee Group | target |
| `FEE_PACKAGE` | Fees & Billing | `FEE_PACKAGE_PROFILE_ID, FEE_RULE_ID, BUSINESS_DATE` | Fee Package | target |
| `FEE_PACKAGE_USAGE` | Fees & Billing | `FEE_PACKAGE_USAGE_ID, BUSINESS_DATE` | Fee Package Usage | target |
| `STATEMENT_EVENT` | Statements & Communications | `STATEMENT_EVENT_ID, BUSINESS_DATE` | Statement Event | target |
| `STATEMENT_EVENT_INSTANCE` | Statements & Communications | `STATEMENT_EVENT_INSTANCE_ID, BUSINESS_DATE` | Statement Event Instance | target |
| `STATEMENT_PACKAGE` | Statements & Communications | `STATEMENT_PACKAGE_ID, BUSINESS_DATE` | Statement Package | target |
| `MODEL` | Investment Product | `MODEL_ID, BUSINESS_DATE` | Model | target |
| `MODEL_ALLOCATION` | Investment Product | `ALLOCATION_ID, BUSINESS_DATE` | Model Allocation | target |
| `ROLE_DETAILS` | Organization & Security | `ACCESS_TYPE, FUNCTION, ROLE_ID, TARGET_TYPE, BUSINESS_DATE` | Role Details | target |
| `USER_DETAIL` | Organization & Security | `ENTITY_ID, BUSINESS_DATE` | User Detail | target |
| `USER_TEAM_AND_ROLE` | Organization & Security | `EMPLOYEE_ROLE_ID, EMPLOYEE_TEAM_ID, ENTITY_ID, BUSINESS_DATE` | User Team and Role | target |
| `FUND_CUTOFF_TIMES` | Reference & Configuration | `no dictionary key defined` | Fund Cutoff Times | target |
| `INTEREST_RATES` | Reference & Configuration | `no dictionary key defined` | Interest Rates | target |
| `REFERENCE` | Reference & Configuration | `no dictionary key defined` | Reference | sample |

## Model gaps

| # | Gap | Recommendation | Blocks |
|---|---|---|---|
| 1 | ACCOUNT primary key differs between the dictionary sheet (ACCOUNT_NUMBER) and the domain sheet (ACCOUNT_ID). Children join on either. | Keep ACCOUNT_ID as PK, declare ACCOUNT_NUMBER a unique alternate key. | **yes** |
| 2 | ASSET PK is FIRM_ID + INSTRUMENT_ID, but positions and classifications reference TRD_INSTRUMENT_ID, and FIRM_ID is nullable. | Decide the asset grain — global or trading-level. Declare TRD_INSTRUMENT_ID a UK and make PK columns NOT NULL. | **yes** |
| 3 | Called PARTY_ADDRESS in the dictionary sheet and PARTY_CONTACT in the domain sheet and ERD. | Standardise on PARTY_CONTACT. | no |
| 4 | In the Account domain sheet these rows are labelled ACCOUNT_FEE_PACKAGE_ASSOCIATION. | Correct the table labels. | no |
| 5 | No primary key defined for 8 tables — 5 Party children and all 3 Reference tables. | Define composite keys. Without one there is no INT merge key and no partition identity. | **yes** |
| 6 | PK columns marked nullable. | Make NOT NULL or replace with a stable key. | **yes** |
| 7 | The FK points at FEE_PACKAGE, whose PK is FEE_PACKAGE_PROFILE_ID + FEE_RULE_ID — so the FK is to half a key. | Align to FEE_PACKAGE_PROFILE_ID, or split a package header from its rules. | no |
| 8 | Fee Group is referenced by FEE_GROUP_NAME, which is not a key. | Introduce FEE_GROUP_ID. | no |
| 9 | Many logical relationships are not declared foreign keys. | Declare them, or confirm they are intentionally loose. Shown as inferred edges throughout. | no |
| 10 | The ERD coverage page lists FEE_COMPUTATION twice and omits FEE_GROUP. | Correct the coverage slide and recheck per-domain attribute counts. | no |
| 11 | Composite primary keys with free-text members. | Replace text members with identifiers where available. | no |
| 12 | BUSINESS_DATE and the lineage columns are not in the canonical dictionary but are required by the INT contract — so every dictionary key is short by one column. | Add the standard INT columns to all 52 tables. This mockup already renders the effective INT key, not the dictionary key. | **yes** |

## Sources

- **BBH File Ingestion Framework Design Document v2.0** — SEI Professional Services
- **BBH dbt Transformation Design Document v2** — SEI Professional Services
- **SEI-BBH Integration Architecture v5** — SEI

Generated from the cited model, not written by hand.
