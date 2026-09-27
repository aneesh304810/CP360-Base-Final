# PBDW — SEI to AddVantage crosswalk workbook

Paste this whole file as your prompt, attach the documents and the two
extracts named below, and run it.

You are a data lineage analyst. Produce ONE Excel workbook named
`PBDW_ADDVANTAGE_SEI_Crosswalk.xlsx` mapping SEI datapoints onto the
AddVantage fields that already feed the PB Data Warehouse, and verifying which
of them match.

**This workbook does NOT contain lineage.** PBDW's lineage already exists in
the warehouse — 1,180 rows loaded from the AddVantage mapping workbook. You
are attaching a SEI side to a baseline that is already there. Do not restate
it, do not re-derive it, and do not include a lineage sheet.

The workbook is loaded by an automated ingester in `attach` mode. Sheet names,
column names and controlled values are a contract. One header row, data from
row 2, no merged cells, no blank rows inside a sheet, no formulas.

---

## THE MODEL, IN ONE PARAGRAPH

SEI never reaches the warehouse on its own. It lands in the shape AddVantage
already delivers — the **AddVantage-compatible contract** — and the existing
PBDW pipeline carries it from there unchanged. So the only thing you are
mapping is:

```
SEI datapoint  ──►  AddVantage field code  ──►  (already built, untouched)  ──►  PBDW column
```

Your entire job is the first arrow.

---

## INPUTS

### Required: the contract inventory

Run this and attach the result as `pbdw_contract_inventory.csv`. It is the
list of AddVantage field codes the warehouse actually consumes, and **it is
the only set of values your mapping may point at.**

```sql
SELECT DISTINCT
       l.src_source_table                       AS contract_feed,
       l.src_source_column                      AS contract_field,
       COUNT(DISTINCT l.dwh_target_table || '.' || l.dwh_target_column)
                                                AS feeds_columns,
       MIN(f.dataset)                           AS feed_dataset,
       MIN(d.short_desc)                        AS field_description
FROM   legacy_lineage l
LEFT JOIN legacy_source_file f
       ON f.data_source = l.data_source
      AND f.src_file_key = REGEXP_REPLACE(UPPER(TRIM('_' FROM
            REGEXP_REPLACE(l.src_source_table,'[[:space:]/.-]+','_'))),'_{2,}','_')
LEFT JOIN legacy_dictionary d
       ON d.field_code_norm = REGEXP_REPLACE(UPPER(TRIM('_' FROM
            REGEXP_REPLACE(l.src_source_column,'[[:space:]/.-]+','_'))),
            '_L([0-9]+)','_\1')
WHERE  l.data_source = 'PBDW'
  AND  l.src_source_column IS NOT NULL
GROUP BY l.src_source_table, l.src_source_column
ORDER BY 1, 2;
```

### Required: the target inventory

Attach as `pbdw_target_inventory.csv`. It is the row set your `VERIFY` sheet
must reproduce exactly — one row per PBDW column.

```sql
SELECT l.dwh_target_table, l.dwh_target_column, l.dwh_type, l.dwh_length,
       l.dwh_precision, l.functional_group, l.lineage_status,
       l.src_source_table AS contract_feed, l.src_source_column AS contract_field
FROM   legacy_lineage l
WHERE  l.data_source = 'PBDW'
ORDER  BY l.dwh_target_table, l.dwh_target_column;
```

### Also attach

- SEI feed workbooks / interface specifications, with declared types
- SEI reference / code-value documentation
- The AddVantage master dictionary workbook, if you have it
- Any existing SEI ↔ AddVantage mapping drafts
- IMDS-style live DDL for the PBDW target tables, if available

If an input is missing, do not stop and do not skip rows. Emit what you can,
set unknown cells to `UNKNOWN`, evidence to `NONE`, and write an `EXCEPTIONS`
row naming the document that would have closed the gap.

---

## THE TEN RULES — these override everything else

1. **Never invent a type, length, scale, nullability or code value.** Not in a
   document means the cell is the literal string `UNKNOWN`. A plausible
   `NUMBER(15,2)` is far worse than an honest `UNKNOWN`: it will be believed
   and it will clear a check it should have failed.

2. **`TARGET_CONTRACT_FIELD` may only contain a value that appears in
   `pbdw_contract_inventory.csv`, copied verbatim.** This is the rule the
   whole load depends on. An AddVantage field code is written `BI/1-1` in one
   place and `BI_2_L1` in another; the ingester reconciles those two spellings
   but it cannot reconcile a value you invented, a business name, or a PBDW
   column name. Anything not in the inventory is a failed join and shows up as
   a number in the load log.

3. **Every factual row carries `EVIDENCE`**: `LIVE_DDL` · `COPYBOOK` ·
   `FEED_WORKBOOK` · `DOCUMENT` · `ASSUMED` · `NONE`. `ASSUMED` is permitted
   and can never produce a `PROVEN_MATCH`.

4. **Drive from the target.** `VERIFY` holds one row for every line of
   `pbdw_target_inventory.csv` — same count, same pairs. Including the columns
   with no SEI datapoint: a column with no source is the finding, and only
   iterating the target side finds it.

5. **`UNKNOWN` is never a pass.** Write `PROVEN_MATCH` only when BOTH sides'
   type, length, scale and nullability came from `LIVE_DDL`, `COPYBOOK` or
   `FEED_WORKBOOK`.

6. **Composites get N rows, not one**, sharing a `COMPOSITE_GROUP`. Never
   concatenate datapoint names into one cell. Reserve the `:n` suffix in
   `MAP_ID` for composite parts only.

7. **One row per (contract field, SEI datapoint) — not per PBDW column.** One
   AddVantage field feeds several warehouse columns; map it once and the
   fan-out happens in the join. Duplicating the mapping per target column is
   how two rows come to disagree about one contract field.

8. **No lineage.** No `LANE_LINEAGE`, no `SOURCE_FEED`, no staging columns, no
   `DWH_TYPE` on the mapping sheet. The baseline exists and is not yours.

9. **No production data.** Structure and metadata only — no account numbers,
   client or party names, transaction identifiers, balances, credentials,
   connection strings or hostnames. Code-set *values* are metadata and in
   scope; the entities they describe are not.

10. **Report what you could not resolve.** Every `UNKNOWN` caused by a missing
    document gets an `EXCEPTIONS` row.

---

## SHEETS — eleven, exactly these names

### 1 · `_MANIFEST`
`ITEM` | `VALUE` | `NOTES`

Rows for `GENERATED_ON`, `SCOPE_SUMMARY`, one `SOURCE_DOCUMENT` per attachment,
one `ROWCOUNT_<SHEET>` per sheet, then `UNRESOLVED_COUNT`,
`PROVEN_MATCH_COUNT`, `CEILING`, `CODE_VALUES_SUPPLIED`,
`CONTRACT_FIELDS_MATCHED` (how many of your `TARGET_CONTRACT_FIELD` values
were found in the inventory) and `CONTRACT_FIELDS_UNMATCHED`.

### 2 · `LANE_REGISTER`
`LANE_ID` | `SOURCE_SYSTEM` | `DATA_SOURCE` | `REPLACEMENT_STATE` |
`SUCCESSOR_SYSTEM` | `CONTRACT_NAME` | `NOTES`

One row: `ADDVANTAGE_PBDW` | `ADDVANTAGE` | `PBDW` | `REPLACED` | `SEI` |
`AddVantage-compatible`. Add a second only if a document supports it.

### 3 · `SEI_FEED`
`SEI_FEED` | `SEI_ENTITY` | `SUBJECT_AREA` | `DELIVERY_MODE` | `FREQUENCY` |
`GRAIN` | `KEY_FIELDS` | `LOAD_BEHAVIOUR` | `TYPES_PUBLISHED` | `EVIDENCE` |
`SOURCE_DOC` | `NOTES`

`TYPES_PUBLISHED` is `Y`/`N` — whether the document gives types as well as
names. It predicts how much of the verification can complete, so set it
accurately. `SUBJECT_AREA` must not use `Reference` as a catch-all; a client
is a party, a fee is billing.

### 4 · `SEI_TO_CONTRACT` — the heart of it
**One row per (contract field, SEI datapoint).**

`MAP_ID` | `LANE_ID` | `TARGET_CONTRACT_FEED` | `TARGET_CONTRACT_FIELD` |
`SEI_FEED` | `SEI_ENTITY` | `SEI_DATAPOINT` | `SEI_TYPE` | `SEI_LENGTH` |
`SEI_SCALE` | `SEI_NULLABLE` | `SEI_UNIT_OF_MEASURE` | `SEI_CURRENCY_BASIS` |
`SEI_SIGN_CONVENTION` | `SEI_CODE_SET_NAME` | `MAP_KIND` | `COMPOSITE_GROUP` |
`COMPOSITE_ROLE` | `SEI_TO_CONTRACT_RULE` | `JOIN_KEY` | `DEPENDS_ON_FEED` |
`EVIDENCE` | `SOURCE_DOC` | `SOURCE_DOC_LOCATOR` | `OPEN_QUESTION` | `NOTES`

- `MAP_ID` — `ADDVANTAGE_PBDW:<feed>:<field>:<n>`, n from 1
- `TARGET_CONTRACT_FEED` / `TARGET_CONTRACT_FIELD` — **copied verbatim from
  `pbdw_contract_inventory.csv`**, per rule 2
- `MAP_KIND` — `DIRECT` | `LOOKUP` | `DERIVED` | `COMPOSITE` | `CONSTANT` |
  `UNAVAILABLE`. `UNAVAILABLE` means the contract field has no SEI datapoint:
  emit the row with the SEI columns `N/A`. The absence is the finding and must
  be a row, not a missing row.
- `SEI_TO_CONTRACT_RULE` — the transformation in words or pseudocode. State
  any parameter you do NOT have (day-count basis, rounding rule, FX source) as
  `-- NOT SUPPLIED` inside the rule rather than omitting it.

If two rows propose **different** SEI sources for one contract field, keep both
and raise an `EXCEPTIONS` row. That is a decision, not a duplicate.

### 5 · `CODE_SET`
`CODE_SET_NAME` | `SIDE` | `CODE_VALUE` | `CODE_DESCRIPTION` | `MAPS_TO_SIDE` |
`MAPS_TO_CODE` | `MAPS_TO_DESCRIPTION` | `EVIDENCE` | `SOURCE_DOC` | `NOTES`

`CODE_SET_NAME` is the domain name (`ACCT_STATUS`), **never a row number**.
`CODE_VALUE` is one member value. `CODE_DESCRIPTION` is what that value means,
never a copy of the domain name.

If the reference document lists **domains only, without their values** — which
is common — emit one row per domain with `CODE_VALUE` = `NOT_SUPPLIED` and
`CODE_DESCRIPTION` = `Domain named in the reference workbook; member values not
published`, raise one `EXCEPTIONS` row per domain against the SEI design team,
and set `_MANIFEST.CODE_VALUES_SUPPLIED` = `N`. Do not fabricate values.

The AddVantage side is `SIDE` = `ADDVANTAGE`.

### 6 · `IDENTIFIER_XWALK`
`ENTITY` | `SEI_IDENTIFIER` | `ADDVANTAGE_IDENTIFIER` | `PBDW_IDENTIFIER` |
`CARDINALITY` | `RESOLUTION_RULE` | `AUTHORITATIVE_SIDE` | `EVIDENCE` | `NOTES`

Cover at least account, master account, interested party, security issue,
transaction. Where an instrument matches on several identifiers, one row each,
and say in `RESOLUTION_RULE` which wins and in what context.

### 7 · `VERIFY` — you generate this
**One row per line of `pbdw_target_inventory.csv`.**

`DATA_SOURCE` | `LANE_ID` | `DWH_TARGET_TABLE` | `DWH_TARGET_COLUMN` |
`FUNCTIONAL_GROUP` | `CONTRACT_FEED` | `CONTRACT_FIELD` |
`SEI_DATAPOINT_COUNT` | `SEI_DATAPOINTS` | `MAP_KIND` | `MATCH_VERDICT` |
`VERDICT_REASON` | `FAILED_CHECKS` | `EVIDENCE_LEFT` | `EVIDENCE_RIGHT` |
`BLOCKS_CUTOVER` | `WHAT_WOULD_CLEAR_IT`

Copy `DWH_TARGET_TABLE`, `DWH_TARGET_COLUMN`, `FUNCTIONAL_GROUP`,
`CONTRACT_FEED` and `CONTRACT_FIELD` from the target inventory. Do not invent,
rename or omit a single one.

#### The verdict algorithm — in order, first match wins

LEFT = the SEI side. RIGHT = the AddVantage contract field.

1. `LINEAGE_STATUS` is `UNMAPPED`, or the inventory row has no contract field →
   **`NO_BASELINE`**, `BLOCKS_CUTOVER` = `N`. A pre-existing hole with its own
   owner, not a SEI finding. If SEI datapoints are nonetheless proposed, add
   `BYPASSES_CONTRACT` to `FAILED_CHECKS` and raise an exception.
2. No `SEI_TO_CONTRACT` row, or `MAP_KIND` = `UNAVAILABLE` → **`NO_SOURCE`**,
   `Y`. Add a `DISPOSITION` row.
3. `MAP_KIND` = `COMPOSITE` → **`NOT_COMPARABLE`**, `Y`.
4. Either side's type, length, scale or nullability is `UNKNOWN`, or either
   evidence is `ASSUMED`/`NONE` → **`UNKNOWN`**, `Y`.
5. A code set is involved with an absent or incomplete crosswalk, or
   `MAP_KIND` = `LOOKUP` → **`DECODE_NEEDED`**, `Y`.
6. Type families differ → **`TYPE_SHIFT`**, `Y`.
7. Same family, RIGHT narrower than LEFT → **`PRECISION_RISK`**, `Y`.
8. `UNIT_OF_MEASURE`, `CURRENCY_BASIS` or `SIGN_CONVENTION` differ or are
   `UNKNOWN` → **`UNKNOWN`**, with the attribute named in `FAILED_CHECKS`.
   Matching types do not make two numbers mean the same thing.
9. Otherwise → **`PROVEN_MATCH`**, `N`.

Also, whatever the verdict: `DEPENDS_ON_FEED` populated → add
`FEED_DEPENDENCY`; the column written by more than one source → add
`DUAL_SOURCE`.

`MATCH_VERDICT`, exactly: `PROVEN_MATCH` | `UNKNOWN` | `DECODE_NEEDED` |
`PRECISION_RISK` | `TYPE_SHIFT` | `NOT_COMPARABLE` | `NO_SOURCE` |
`NO_BASELINE` | `OUT_OF_SCOPE`

`FAILED_CHECKS`, pipe-separated, empty for `PROVEN_MATCH`: `TYPE_FAMILY` |
`LENGTH` | `SCALE` | `NULLABILITY` | `CODE_SET` | `UNIT` | `CURRENCY` | `SIGN` |
`DATE_GRANULARITY` | `CARDINALITY` | `FEED_DEPENDENCY` | `NO_TYPES_SUPPLIED` |
`BYPASSES_CONTRACT` | `DUAL_SOURCE` | `COLLAPSE`

### 8 · `DISPOSITION`
`LANE_ID` | `DWH_TARGET_TABLE` | `DWH_TARGET_COLUMN` | `DISPOSITION` |
`DISPOSITION_DETAIL` | `PROPOSED_BY` | `OWNER` | `APPROVED_ON` | `NOTES`

One per `NO_SOURCE` row. `DISPOSITION` ∈ `DEFAULT` | `DERIVE` | `DROP` |
`BLOCK` | `UNDECIDED`, defaulting to `UNDECIDED` with `OWNER` and
`APPROVED_ON` blank. Propose in `DISPOSITION_DETAIL`; approve nothing.

### 9 · `DUAL_SOURCE`
`DWH_TARGET_TABLE` | `DWH_TARGET_COLUMN` | `LANES` | `PRECEDENCE_RULE` |
`PROPOSED_BY` | `OWNER` | `APPROVED_ON` | `EVIDENCE` | `NOTES`

Only where a document shows a PBDW column written from more than one source.
`PRECEDENCE_RULE` is `UNKNOWN` unless a document states it.

### 10 · `EXCEPTIONS`
`SHEET` | `ROW_KEY` | `COLUMN` | `ISSUE` | `WHY_UNRESOLVED` | `WHO_CAN_ANSWER` |
`SUGGESTED_QUESTION`

`WHO_CAN_ANSWER` ∈ `SEI design team` | `AddVantage owner` | `PBDW data owner` |
`BBH mapping` | `UNKNOWN`. Phrase the question so it can be sent as-is.

### 11 · `ENUMS`
`LIST_NAME` | `VALUE` | `MEANING` — every controlled vocabulary used above.

---

## EXCEL MECHANICS

- Format as **Text** before writing, or values are silently corrupted: every
  field code (`BI/1-1` becomes a date), every feed name, every `*_LENGTH`,
  `*_SCALE`, `*_PRECISION`, and any `YYYYMMDD` date.
- Freeze the header row and add an autofilter on every sheet.
- No formulas — write computed values.
- Use `UNKNOWN`, `N/A`, `NOT_SUPPLIED`, `NO_EQUIVALENT` as written. Never
  leave a specified cell empty except `NOTES`, `OPEN_QUESTION` and the
  approval columns.

If you cannot produce an `.xlsx`, produce one CSV per sheet named
`<SHEETNAME>.csv`, UTF-8, all fields quoted, and say so.

---

## SELF-CHECK BEFORE YOU RETURN THE FILE

State the result of each. Fix failures rather than explaining them.

1. **Every `TARGET_CONTRACT_FIELD` appears in `pbdw_contract_inventory.csv`.**
   List any that do not — this is the check that decides whether the load
   joins at all.
2. `VERIFY` has exactly the same row count as `pbdw_target_inventory.csv`, and
   every (table, column) pair appears once in each.
3. No `SEI_TO_CONTRACT` row duplicates a (contract field, SEI datapoint) pair.
4. Every `COMPOSITE_GROUP` appears on two or more rows.
5. No `MAP_ID` ends `:2` or higher without a `COMPOSITE_GROUP`.
6. No `PROVEN_MATCH` row has `ASSUMED`/`NONE` evidence or a non-empty
   `FAILED_CHECKS`.
7. Every `NO_SOURCE` row has a `DISPOSITION` row.
8. No `CODE_SET_NAME` is numeric, and no `CODE_DESCRIPTION` equals its own
   `CODE_SET_NAME`.
9. Every controlled value appears in `ENUMS`.
10. No cell contains an account number, client or party name, transaction
    identifier, balance, credential, connection string or hostname.
11. No lineage sheet is present, and no sheet contains a `DWH_TYPE` or staging
    column — those belong to the existing baseline.

---

## WHAT TO SAY IN YOUR REPLY

Short:

- row counts per sheet, and the `VERIFY` breakdown by `MATCH_VERDICT`
- **how many `TARGET_CONTRACT_FIELD` values matched the inventory, and how
  many did not** — this one first
- the self-check results, one line each
- the `CEILING` value and why
- the top five `EXCEPTIONS` by how much they block, with the document that
  clears each
- anything in the attachments that contradicted something else, and which you
  treated as authoritative

Do not summarise the workbook sheet by sheet — I will open it.
