# PBDW business catalogue

A business name, a sentence of description and a grain for each of the 176
warehouse tables in `LEGACY_LINEAGE`.

## What this adds, and what it deliberately does not

**It does not touch the grouping.** `FUNCTIONAL_GROUP` is already ingested and is
the authority — sixteen values the business authored. Nothing here re-derives it, and
`suggested_group` is read only where a table has no group at all.

What is genuinely missing is one level down. `LEGACY_DICTIONARY` describes a
**source field**. `FUNCTIONAL_GROUP` groups a **lineage row**. Nothing says what a
**warehouse table** is for — so the Business view can only show `DIM_IP_REL_REMIT_BLOCKS`
where it wants to show *Remittance Blocks: party relationships whose payments are
currently blocked.* That sentence is what this supplies, 176 times.

**Every row is a draft.** The text was generated from the table names and from what
the lineage shows flowing into them. It is a starting point for the people who own these
tables, not an authority, and `review_status` stays `DRAFT` until someone signs it off.

## How it loads

It rides the workbook you already maintain. One more sheet, same file, same
ingest step, same command:

```
python -m ingestion.run legacy_dictionary
```

The connector looks for a sheet whose header has a business-name column beside
a table column — `TABLE CATALOG` by default, any name via
`CP_LEGACY_TABLE_CATALOG_SHEET`, and it reads the wording people actually use
(`Warehouse Table` / `Friendly Name` / `Definition` / `Granularity` all resolve).
A workbook without the sheet loads exactly as it does today.

**The sheet is the source of truth.** Correct a description there, re-run, and
the database has it. `Review Status` and `Reviewed By` travel with the row, so a
line someone has signed off stays signed off across reloads.

`TABLE-CATALOG-sheet.csv` in this folder is that sheet, filled in and ready to
paste.

### Why not rows in LEGACY_DICTIONARY

The ingestion, yes. The table, no — the grain is different.
`legacy_dictionary` is one row per **source field**: `dict_key` is
`system:field_code_norm:master`, `field_code_norm` is `NOT NULL` and in the
primary key, and `source_system` holds ADDVANTAGE / CRD / STAR. A warehouse
table has no field code and no legacy source system, so a row there means
inventing both — and then `/systems` reports PBDW as a legacy source with 176
assets, `/dictionary` lists tables among field definitions, `/business-def`
looks them up by a code they do not have, and the group resolvers count rows
that can never join. One table, two meanings, six consumers disagreeing about
which — the same shape as the bug that emptied the Business view this week.

Making `legacy_dictionary` polymorphic with an `entry_type` column is the other
honest option. It costs a `WHERE entry_type = 'FIELD'` in each of those six
consumers, and missing one gives a wrong number rather than an error. Say the
word if you would rather have one table and take that on.

## Files

| file | what it is |
|---|---|
| `TABLE-CATALOG-sheet.csv` | **paste this into the workbook** — the sheet, filled in |
| `pbdw-business-catalog.csv` | the reviewable copy — open in Excel, correct the text, fill `reviewed_by` |
| `../../sql/60_business_catalog.sql` | the table |
| `../../sql/61_business_catalog_seed.sql` | the first pass, 176 `MERGE` statements |
| `../../sql/62_business_catalog_check.sql` | **read-only** — what the ingested data actually says |
| `_source_catalog.py`, `_build.py` | how the CSV was produced, so a correction can be re-run |

The seed is a `MERGE` guarded on `review_status = 'DRAFT'`, so re-running it never
overwrites a row someone has reviewed.

## Run the check before quoting any number below

Everything in the next two sections is my reading of 176 table **names**. Your
ingested `FUNCTIONAL_GROUP` is the truth, and `62_business_catalog_check.sql` reports it:
the real distribution per group, tables whose rows disagree about their group, what is
actually sitting in Other / History / Review Required, and catalogue coverage both ways.
Where the query and this document disagree, the query is right.

## What my reading of the names suggests

| n | group | |
|---:|---|---|
| 5 | Intraday / API Keys & Control |  |
| 5 | Audit Trail & Change History |  |
| 0 | History | **nothing lands here** |
| 0 | Other | **nothing lands here** |
| 14 | Account Master & Reference Data |  |
| 15 | Reference Data |  |
| 22 | IPS / Investment Policy |  |
| 13 | Interested Parties & Relationships |  |
| 8 | Securities / Asset Master |  |
| 32 | Reporting & Analytics |  |
| 8 | Transactions & Journals |  |
| 9 | Positions & Holdings |  |
| 11 | Pricing & Valuation |  |
| 0 | Review Required | **nothing lands here** |
| 7 | Market / Research Data |  |
| 3 | Security / Access Reference |  |

### Three of the sixteen are not domains

- **History** — `DIM_ACCOUNT_UD_HIST` is an account table *and* a history table.
  Filing it under History empties Account Master of its own history and fills History with
  ten unrelated subjects. The 16 history tables carry an `is_history` flag instead,
  so the view can offer history as a filter across the real domains.
- **Other** and **Review Required** — a to-do list rather than a place. Query 3 in the
  check says how much is really in them; if it is a large number, that is the single
  biggest thing standing between you and a Business view that reads well.

Separately, 6 tables are staging or temporary (`is_staging`). They are in the
lineage but nobody should report from them, and listing them beside `FACT_CP_HOLDINGS`
invites exactly that.

## Four domains the sixteen have no home for

24 tables, and no value in the list fits them. Query 4 in the check will show where
they actually sit today; if the answer is Other, these four values are worth adding.

**Fees & Billing** (13)

- `FACT_FEE_ACCOUNT_WORKSHEET`
- `FACT_FEE_ACCT_WKSHEET_ALLOC`
- `FACT_FEE_ACCT_WKSHEET_AMOUNTS`
- `FACT_FEE_ACCT_WKSHT_COMPONENT`
- `FACT_FEE_ACCT_WKSHT_COMP_STEPS`
- `FACT_FEE_MA_ACCT_WKSHT_CENT_AC`
- `FACT_FEE_RECEIVE_OPEN`
- `REF_FEE_RECEIVE_BALANCE`
- `REF_FEE_RECEIVE_MSTR_BALANCE`
- `REF_FEE_SCHEDULE`
- `REF_FEE_SCHEDULE_COMPONENT`
- `REF_FEE_SCHEDULE_DETAILS`
- `REF_FIS_FEE_SCHEDULE`

**Compliance & Oversight** (6)

- `CRD_COMPL_RULES`
- `PBDW_CS_TEST_V2`
- `PBDW_CS_VIOLATIONS_V2`
- `REF_ACCOUNT_REVIEW_RECON`
- `REF_MASTER_REVIEW_RECON`
- `TMP_ALERTS`

**Lending & Credit** (3)

- `REF_ACBS_FACILITY_LIST`
- `REF_ACBS_KEY_METRICS`
- `REF_ACBS_SYND_PARTICIPATION`

**Tax** (2)

- `REF_K1_DETAIL`
- `REF_TRUST_TAX`

## Two more things worth a decision

- **Reporting & Analytics takes 32 tables** on my reading —
  performance, benchmarks, statements and AUM together. It would be the largest group by
  far and the one a business reader is least likely to find anything in. Splitting it into
  Performance & Benchmarks, Client Statements and Assets Under Management gives three
  groups of roughly equal size.
- **Security / Access Reference is about access control, not securities.** Three tables
  belong to it, and the name reads as the securities master to anyone who has not been told
  otherwise. "User Access & Entitlements" would not.

## 12 tables nobody outside the load team can read

Each has an abbreviation that is not expanded anywhere in the lineage, the dictionary
or the workbook. The description says what the table appears to hold and says plainly that
the abbreviation is unconfirmed. These need an owner to name them, and they are the
shortest path to a Business view that reads properly.

| table | what it appears to be | unexplained |
|---|---|---|
| `CFG_TR_CUSIP_LTS` | Thomson Reuters CUSIP List | `LTS` |
| `DIM_ACCOUNT_IR_BLOCKS` | Account IR Blocks | `IR` |
| `DIM_BBH_IPS_UIMP` | Policy UIMP | `UIMP` |
| `DIM_BBH_IPS_UIMP_REALLOCATION` | Policy UIMP Reallocation | `UIMP` |
| `DIM_CRM_TAR_CONTACTS` | CRM TAR Contacts | `TAR` |
| `FACT_MAP_DETAILS` | MAP Report Details | `MAP` |
| `FACT_MAP_HEADER` | MAP Report Header | `MAP` |
| `FACT_PENNY_IT` | Penny Test Items | `IT` |
| `PBDW_CSM_SECURITY` | Compliance Security Master | `CSM` |
| `REF_ADDV_TAB_35` | AddVantage Table 35 | `TAB_35` |
| `REF_SM_SECURITY` | Security Master Extract | `SM` |
| `TWM001_USER_REF` | User Reference (TWM001) | `TWM001` |

Answer those twelve and the catalogue is 164 of 176 confident.
