# IMDS · STAR · UAF · SEI — data lineage workbook

**Canonical prompt. Self-contained — supersedes the earlier generation and
fix-pass prompts.** Paste the whole of this file, attach the source documents,
run it.

You are a data lineage analyst. Produce ONE Excel workbook named
`IMDS_STAR_UAF_SEI_Data_Lineage.xlsx` that records, at final-column level:

- the **existing** lineage into IMDS from every incumbent source system —
  STAR and UAF — as the baseline
- the **proposed** SEI mapping, which reaches IMDS through a compatibility
  contract rather than through a lineage of its own
- a **mechanical verification** of which SEI datapoint matches which incumbent
  field, which do not, and which cannot be judged yet

The workbook is loaded by an automated ingester. Sheet names, column names and
controlled values are a contract. Do not rename, reorder, add or drop columns.
No merged cells, one header row, data from row 2, no blank rows inside a sheet,
no totals rows, no colour that carries meaning.

---

## THE MODEL — read this before the sheets

**A lane is one `incumbent source system → target warehouse` pairing.** Legacy
is a group of lanes, not a system. The four known lanes:

| lane | state | contract |
|---|---|---|
| `STAR_IMDS` | REPLACED by SEI | `STAR-compatible` |
| `UAF_IMDS` | **NOT_REPLACED** | none |
| `ADDVANTAGE_PBDW` | REPLACED by SEI | `AddVantage-compatible` |
| `ADDVANTAGE_IMDS` | unconfirmed — do not assert without evidence | — |

**SEI never gets a lineage chain of its own.** It lands in the shape the
incumbent already delivers, and the existing pipeline carries it the rest of the
way unchanged. So the chain gains two hops on the left and keeps everything to
the right of the contract:

```
today:      STAR feed ─────────────────────────► IMDS table.column
after SEI:  SEI feed → SEI canonical → STAR-compatible ► IMDS table.column
                                       └─ the contract, named
                                          for the incumbent it imitates
```

**Two exclusions that are not the same thing.** UAF has no SEI successor, so it
is excluded from the *SEI coverage denominator*. It is **not** excluded from the
*lineage* — it is a live path into `RULESDBO` that IMDS reads every day, and it
belongs in the workbook, counted as lineage and marked out of scope for the SEI
verdicts. A lane that is absent looks like an oversight; a lane marked
`OUT_OF_SCOPE` looks like a decision.

**Two join points, and the grain that follows from them:**

- `LANE_LINEAGE.SRC_SOURCE_TABLE` / `SRC_SOURCE_COLUMN` hold the **incumbent
  feed and field**. That pair *is* the contract.
- `SEI_TO_CONTRACT.TARGET_CONTRACT_FEED` / `TARGET_CONTRACT_FIELD` point at it.

So `LANE_LINEAGE` is one row per **(lane, target table, target column)**, and
`SEI_TO_CONTRACT` is one row per **(lane, contract feed, contract field, SEI
datapoint)**. When one contract field feeds several target columns, the fan-out
happens in the join — never by duplicating the mapping row. Map once, inherit
everywhere.

---

## INPUTS

Use only the documents attached to this conversation. Name every one you used in
`_MANIFEST`, and say what you took from it.

Expected, in rough order of authority:

1. **IMDS live DDL extract** — `ALL_TAB_COLUMNS` plus primary keys (Appendix A
   has the query). This is the only thing that can produce a `PROVEN_MATCH`.
2. IMDS data dictionary — usable, but it is a document, not DDL. See rule 4.
3. STAR feed layouts / copybooks — ACDDIFI1, PEDDIFI1, TJDDIFI1, ODDDIFI1,
   ORDDIFI1, SMDDIFI1, TBMEIFI7, and any others
4. STAR → IMDS lineage or ETL mapping documents
5. UAF feed documentation and the UAF load job specifications
6. SEI feed workbooks / interface specifications — field lists **with declared
   types**
7. SEI reference / code-value documentation
8. SEI architecture notes, and any existing SEI ↔ STAR or SEI ↔ AddVantage
   mapping drafts

**If an input is missing, do not stop and do not skip rows.** Emit the rows you
can identify, set unknown cells to `UNKNOWN`, set `EVIDENCE` to `NONE`, and
write one `EXCEPTIONS` row per gap naming the document that would have closed it.

---

## THE NINE RULES — these override anything else in this prompt

1. **Never invent a type, length, scale, nullability or code value.** If it is
   not in an attached document, the cell is the literal string `UNKNOWN`. A
   plausible `NUMBER(15,2)` is far more damaging than an honest `UNKNOWN`,
   because it will be believed and it will clear a check it should have failed.

2. **Every factual row carries `EVIDENCE`**, from: `LIVE_DDL` · `COPYBOOK` ·
   `FEED_WORKBOOK` · `DOCUMENT` · `ASSUMED` · `NONE`. `ASSUMED` means derived
   from something adjacent — inferring a contract field's type from the target
   column it feeds, for instance. `ASSUMED` is permitted and can never produce a
   `PROVEN_MATCH`.

3. **Drive from the target.** `LANE_LINEAGE` holds one row for every IMDS target
   column in scope, including columns with no incumbent field behind them. A
   source field with no target is a curiosity; a target column with no source is
   a cutover blocker, and only iterating the target side finds it.

4. **`UNKNOWN` is never a pass**, and a data dictionary is not DDL. Write
   `PROVEN_MATCH` only when **both** sides' type, length, scale and nullability
   came from `LIVE_DDL`, `COPYBOOK` or `FEED_WORKBOOK`. If target types came from
   a data dictionary, `EVIDENCE_RIGHT` is `DOCUMENT` and no row can reach
   `PROVEN_MATCH` however good the SEI side is — say so once in `_MANIFEST` as
   `CEILING` rather than repeating it per row.

5. **Composites get N rows, not one.** Several SEI datapoints combining into one
   contract field means one `SEI_TO_CONTRACT` row per datapoint, sharing a
   `COMPOSITE_GROUP`. Never concatenate datapoint names into a cell. Reserve the
   `:n` suffix in `MAP_ID` for composite parts only.

6. **Never deduplicate across lanes.** If two lanes write the same IMDS column,
   that is two legitimate rows and a real finding — it needs a stated precedence
   rule, and it goes in `DUAL_SOURCE`. Collapsing it destroys the finding.

7. **Do not assert a lane, a feed or a field you have no evidence for.** A lane
   named in this prompt that no attached document supports gets
   `REPLACEMENT_STATE` recorded honestly and an `EXCEPTIONS` row — not a
   confident entry. Never infer a feed's contents from its name.

8. **No production data.** Structure and metadata only. No account numbers,
   client or party names, transaction identifiers, balances, credentials,
   connection strings, hostnames, or sample values from real records. Code-set
   *values* (status codes, type codes) are metadata and are in scope; the
   entities they describe are not.

9. **Report what you could not resolve.** Every cell set to `UNKNOWN` because of
   a missing document gets an `EXCEPTIONS` row. A silently blank workbook is
   worse than a loud incomplete one.

---

## SHEET 1 — `_MANIFEST`

`ITEM` | `VALUE` | `NOTES`

One row for each of: `GENERATED_ON` (ISO date), `SCOPE_SUMMARY`,
`SOURCE_DOCUMENT` (one per attached document — value is the filename, notes is
what you took from it), then `ROWCOUNT_<SHEETNAME>` per sheet, then:

- `UNRESOLVED_COUNT` — number of `EXCEPTIONS` rows
- `PROVEN_MATCH_COUNT` — `VERIFY` rows with `PROVEN_MATCH`
- `CEILING` — per rule 4, or `None — target evidence is live DDL`
- `BASELINE_COVERAGE` — incumbent feeds present, out of the feeds known to exist
- `CODE_VALUES_SUPPLIED` — `Y` / `N`, per sheet 7
- `DECODE_STATUS` — one line on whether decodes can be judged at all
- `DUAL_SOURCE_COLUMNS` — count, and the tables affected
- `CONTRACT_BYPASS_COLUMNS` — count, per the note under `VERIFY`

---

## SHEET 2 — `LANE_REGISTER`

`LANE_ID` | `SOURCE_SYSTEM` | `DATA_SOURCE` | `REPLACEMENT_STATE` |
`SUCCESSOR_SYSTEM` | `CONTRACT_NAME` | `NOTES`

- `LANE_ID` — `<SOURCE>_<WAREHOUSE>`, uppercase
- `DATA_SOURCE` — the target warehouse: `IMDS` | `PBDW`
- `REPLACEMENT_STATE` — `REPLACED` | `NOT_REPLACED` | `SEI_NATIVE`
- `CONTRACT_NAME` — the shape SEI must land in, named for the incumbent
  (`STAR-compatible`). `N/A` when not replaced.

Seed from the table in **THE MODEL**, then correct each row against the attached
documents per rule 7. `SEI_NATIVE` is for a SEI datapoint set with no incumbent
counterpart at all — net-new scope, not an orphan to chase.

---

## SHEET 3 — `SOURCE_FEED`

One row per **incumbent** feed, file or message — STAR feeds, UAF messages,
AddVantage extracts. Not SEI; SEI has its own sheet.

`LANE_ID` | `FEED_NAME` | `FEED_FAMILY` | `DATASET` | `SUBJECT_AREA` | `GRAIN` |
`FREQUENCY` | `LOAD_BEHAVIOUR` | `KEY_FIELDS` | `LAYOUT_AVAILABLE` | `EVIDENCE` |
`SOURCE_DOC` | `NOTES`

- `LOAD_BEHAVIOUR` — `FULL` | `CHANGE` | `UPDATE` | `RESTATE` | `UNKNOWN`
- `GRAIN` — what one record represents, in words
- `KEY_FIELDS` — pipe-separated, uniquely identifying a record
- `LAYOUT_AVAILABLE` — `Y` | `N`. `N` means no copybook or layout was attached.

---

## SHEET 4 — `LANE_LINEAGE` — the baseline

**One row per (`LANE_ID`, `DATA_SOURCE`, `DWH_TARGET_TABLE`,
`DWH_TARGET_COLUMN`).** Every lane goes in this sheet, UAF included. Columns
mirror the `LEGACY_LINEAGE` table so the load is a direct insert.

`LANE_ID` | `DATA_SOURCE` | `DWH_TARGET_TABLE` | `DWH_TARGET_COLUMN` |
`DWH_TYPE` | `DWH_LENGTH` | `DWH_PRECISION` | `DWH_NULLABLE` | `DWH_PK_FLAG` |
`STG2_SOURCE_TABLE` | `STG2_SOURCE_COLUMN` | `STG2_TYPE` | `STG2_LENGTH` |
`STG2_PRECISION` | `STG2_TO_DWH_TRANSFORM` |
`STG1_SOURCE_TABLE` | `STG1_SOURCE_COLUMN` | `STG1_TYPE` | `STG1_LENGTH` |
`STG1_PRECISION` | `STG1_TO_STG2_TRANSFORM` |
`SRC_SOURCE_TABLE` | `SRC_SOURCE_COLUMN` | `SRC_TYPE` | `SRC_LENGTH` |
`SRC_PRECISION` | `SRC_TO_STG1_TRANSFORM` |
`UNIT_OF_MEASURE` | `CURRENCY_BASIS` | `SIGN_CONVENTION` | `CODE_SET_NAME` |
`LINEAGE_STATUS` | `LINEAGE_STATUS_DETAIL` | `SUBJECT_AREA` | `EVIDENCE` |
`SOURCE_DOC` | `SOURCE_DOC_LOCATOR` | `NOTES`

Filling rules:

- **`SRC_SOURCE_TABLE` is the incumbent feed and `SRC_SOURCE_COLUMN` is the
  incumbent field.** For `STAR_IMDS` that is the STAR feed and STAR field; for
  `UAF_IMDS` the UAF message and UAF field. This pair is the contract and the
  join point, so populate it wherever it is known, even if every staging column
  is `N/A`.
- Write `SRC_SOURCE_TABLE` **verbatim**, including any date or sequence
  placeholders. Do not normalise, truncate or clean it — the ingester derives
  its own join key.
- For a lane with no persisted staging — UAF's command jobs, or a direct
  STAR→IMDS ETL — put `N/A` in the `STG1_*` and `STG2_*` columns and name the
  procedure or job in `SRC_TO_STG1_TRANSFORM`, exactly as the document names it.
  `N/A` and `Not Applicable` both mean "this stage does not exist"; do not use
  `NULL`, `-`, or an empty cell for it.
- **Type convention, applied uniformly:** `DWH_TYPE` holds the bare type name
  (`VARCHAR2`, `NUMBER`, `DATE`, `CHAR`); the size goes in `DWH_LENGTH` /
  `DWH_PRECISION`. Never `VARCHAR2(255)` in the type with `UNKNOWN` in the
  length. Same convention for `STG*_` and `SRC_`.
- Treat a uniform `VARCHAR2(255)` running down many columns as suspect — that is
  a dictionary default, not a measured length. Where DDL contradicts a
  dictionary, DDL wins and the difference goes in `NOTES`.
- `DWH_NULLABLE` / `DWH_PK_FLAG` — `Y` | `N` | `UNKNOWN`
- `UNIT_OF_MEASURE` — `shares`, `currency amount`, `percent`, `basis points`,
  `days`, `N/A`, `UNKNOWN`
- `CURRENCY_BASIS` — `ASSET` | `BASE` | `LOCAL` | `N/A` | `UNKNOWN`
- `SIGN_CONVENTION` — how a negative or short value is represented, or `UNKNOWN`
- `CODE_SET_NAME` — the named domain when the column holds a code; must appear
  in `CODE_SET`. `N/A` when not coded.
- `LINEAGE_STATUS` — `MAPPED` | `UNMAPPED` | `NOT_APPLICABLE`. `UNMAPPED` means
  the target column exists and no incumbent field feeds it. Populate the row.
- `SUBJECT_AREA` — from the list in `ENUMS`. Do not use `Reference` as a
  catch-all; it means code and lookup data only.
- `SOURCE_DOC_LOCATOR` — page, sheet name or section where you read it

---

## SHEET 5 — `SEI_FEED`

`SEI_FEED` | `SEI_ENTITY` | `SUBJECT_AREA` | `DELIVERY_MODE` | `FREQUENCY` |
`GRAIN` | `KEY_FIELDS` | `LOAD_BEHAVIOUR` | `TYPES_PUBLISHED` | `EVIDENCE` |
`SOURCE_DOC` | `NOTES`

- `DELIVERY_MODE` — `FILE` | `EVENT` | `API` | `UNKNOWN`
- `TYPES_PUBLISHED` — `Y` | `N`. `N` means the document names the datapoints but
  not their types. This flag predicts how much of the verification can complete,
  so set it accurately.
- `SUBJECT_AREA` — same discipline as sheet 4. A client is a party, not
  reference data; a fee is billing, not reference data.

---

## SHEET 6 — `SEI_TO_CONTRACT` — the new mapping

**One row per (`LANE_ID`, `TARGET_CONTRACT_FEED`, `TARGET_CONTRACT_FIELD`, SEI
datapoint).** N rows for a composite. **One row only**, however many target
columns consume that contract field — the fan-out is the join's job.

`MAP_ID` | `LANE_ID` | `TARGET_CONTRACT_FEED` | `TARGET_CONTRACT_FIELD` |
`SEI_FEED` | `SEI_ENTITY` | `SEI_DATAPOINT` | `SEI_TYPE` | `SEI_LENGTH` |
`SEI_SCALE` | `SEI_NULLABLE` | `SEI_UNIT_OF_MEASURE` | `SEI_CURRENCY_BASIS` |
`SEI_SIGN_CONVENTION` | `SEI_CODE_SET_NAME` | `MAP_KIND` | `COMPOSITE_GROUP` |
`COMPOSITE_ROLE` | `SEI_TO_CONTRACT_RULE` | `JOIN_KEY` | `DEPENDS_ON_FEED` |
`EVIDENCE` | `SOURCE_DOC` | `SOURCE_DOC_LOCATOR` | `OPEN_QUESTION` | `NOTES`

- `MAP_ID` — `<LANE_ID>:<TARGET_CONTRACT_FEED>:<TARGET_CONTRACT_FIELD>:<n>`,
  n from 1. Any `MAP_ID` ending `:2` or higher **must** have a populated
  `COMPOSITE_GROUP`.
- `MAP_KIND` — `DIRECT` | `LOOKUP` | `DERIVED` | `COMPOSITE` | `CONSTANT` |
  `UNAVAILABLE`
  - `UNAVAILABLE` means the contract field has no SEI datapoint behind it. Emit
    the row with the SEI columns `N/A` — the absence is the finding, and it must
    be a row, not a missing row.
- `COMPOSITE_GROUP` — shared id across combining rows; `N/A` otherwise
- `COMPOSITE_ROLE` — this datapoint's part: `base amount`, `rate`, `start date`
- `SEI_TO_CONTRACT_RULE` — the transformation in words or pseudocode. State any
  parameter you do **not** have — day-count basis, rounding rule, FX rate source
  — as `-- NOT SUPPLIED` inside the rule rather than omitting it.
- `JOIN_KEY` — the key used when the datapoint comes from another feed
- `DEPENDS_ON_FEED` — a feed that must load first (reference or rate feeds)
- `OPEN_QUESTION` — the one question that would unblock this row
- No rows for a `NOT_REPLACED` lane. UAF has no successor; that is correct, not
  a gap.

If two rows propose **different** SEI sources for the same contract field, keep
both and raise an `EXCEPTIONS` row. Two sources for one field is a decision, not
a duplicate.

---

## SHEET 7 — `CODE_SET`

**One row per code value, inside a named domain.**

`CODE_SET_NAME` | `SIDE` | `CODE_VALUE` | `CODE_DESCRIPTION` | `MAPS_TO_SIDE` |
`MAPS_TO_CODE` | `MAPS_TO_DESCRIPTION` | `EVIDENCE` | `SOURCE_DOC` | `NOTES`

- `CODE_SET_NAME` — the domain name (`ACCT_STATUS`), **never a row number**
- `SIDE` / `MAPS_TO_SIDE` — `SEI` | `STAR` | `UAF` | `IMDS`
- `CODE_VALUE` — one member value (`A`, `C`, `01`)
- `CODE_DESCRIPTION` — what that value means, **never a copy of the domain name**

If a reference document lists **domains only and not their member values** —
which is common — do not fabricate values:

- one row per domain, `CODE_VALUE` = `NOT_SUPPLIED`, `CODE_DESCRIPTION` =
  `Domain named in the reference workbook; member values not published`
- one `EXCEPTIONS` row per domain, `WHO_CAN_ANSWER` = `SEI design team`, asking
  for its permitted values with descriptions
- `_MANIFEST` item `CODE_VALUES_SUPPLIED` = `N`

Where a crosswalk is documented, fill `MAPS_TO_*`. Where a code exists on one
side with no counterpart, `MAPS_TO_CODE` = `NO_EQUIVALENT` — that is a finding.
Where the other side is simply absent, leave `UNKNOWN`, raise one `EXCEPTIONS`
row per domain against the owning side, and summarise once in `_MANIFEST` as
`DECODE_STATUS` rather than repeating it per row.

---

## SHEET 8 — `IDENTIFIER_XWALK`

`ENTITY` | `SEI_IDENTIFIER` | `STAR_IDENTIFIER` | `UAF_IDENTIFIER` |
`IMDS_IDENTIFIER` | `CARDINALITY` | `RESOLUTION_RULE` | `AUTHORITATIVE_SIDE` |
`EVIDENCE` | `NOTES`

- `CARDINALITY` — `1:1` | `1:N` | `N:1` | `N:N` | `UNKNOWN`
- Cover at least: account, portfolio, instrument/security, party, transaction.
- Where an instrument can be matched on more than one identifier
  (`INSTRUMENT_ID`, `ISIN`, `CUSIP`, `SEDOL`), emit one row per identifier and
  say in `RESOLUTION_RULE` which takes precedence, and in what context.

---

## SHEET 9 — `VERIFY` — you generate this

**One row per `LANE_LINEAGE` row** — same row set, same grain, UAF included.
This is the answer to "what matches with what".

`DATA_SOURCE` | `LANE_ID` | `DWH_TARGET_TABLE` | `DWH_TARGET_COLUMN` |
`SUBJECT_AREA` | `CONTRACT_FEED` | `CONTRACT_FIELD` | `SEI_DATAPOINT_COUNT` |
`SEI_DATAPOINTS` | `MAP_KIND` | `MATCH_VERDICT` | `VERDICT_REASON` |
`FAILED_CHECKS` | `EVIDENCE_LEFT` | `EVIDENCE_RIGHT` | `BLOCKS_CUTOVER` |
`WHAT_WOULD_CLEAR_IT`

- `EVIDENCE_LEFT` — the SEI side; `EVIDENCE_RIGHT` — the incumbent/IMDS side
- `SEI_DATAPOINTS` — pipe-separated, for readability only; `SEI_TO_CONTRACT`
  holds the authoritative rows
- `BLOCKS_CUTOVER` — `Y` | `N`
- `WHAT_WOULD_CLEAR_IT` — the specific artefact or decision needed, in one
  sentence. Not "more analysis".

### The verdict algorithm — apply in order, first match wins

LEFT = the SEI side. RIGHT = the incumbent field as consumed by IMDS.

1. Lane `REPLACEMENT_STATE` ≠ `REPLACED` → **`OUT_OF_SCOPE`**, `BLOCKS_CUTOVER`
   = `N`. Every UAF row lands here. Not a gap; do not score it.
2. `LINEAGE_STATUS` = `UNMAPPED`, or no contract field → **`NO_BASELINE`**,
   `BLOCKS_CUTOVER` = `N`. A pre-existing hole with its own owner, not a SEI
   finding. **If such a row nonetheless has SEI datapoints attached**, they are a
   direct SEI → IMDS proposal that bypasses the contract: keep them, add
   `BYPASSES_CONTRACT` to `FAILED_CHECKS`, and raise an `EXCEPTIONS` row.
   Bypassing may be right for operational columns like `upd_user`, but it is an
   architecture decision and must not arrive as a side effect of a join.
3. No `SEI_TO_CONTRACT` row, or `MAP_KIND` = `UNAVAILABLE` → **`NO_SOURCE`**,
   `BLOCKS_CUTOVER` = `Y`. Add a `DISPOSITION` row.
4. `MAP_KIND` = `COMPOSITE` → **`NOT_COMPARABLE`**, `BLOCKS_CUTOVER` = `Y`. No
   single left-hand side exists, so no field-level check applies.
5. Either side's type, length, scale or nullability is `UNKNOWN`, **or** either
   evidence is `ASSUMED` or `NONE` → **`UNKNOWN`**, `BLOCKS_CUTOVER` = `Y`.
6. A code set is involved and its crosswalk is absent or incomplete, or
   `MAP_KIND` = `LOOKUP` → **`DECODE_NEEDED`**, `BLOCKS_CUTOVER` = `Y`.
7. Type families differ — character ↔ numeric, character ↔ date/time, numeric ↔
   date/time → **`TYPE_SHIFT`**, `BLOCKS_CUTOVER` = `Y`.
8. Same family, RIGHT narrower than LEFT — shorter length, fewer decimal places,
   or `DATE` on the right against a timestamp on the left →
   **`PRECISION_RISK`**, `BLOCKS_CUTOVER` = `Y`.
9. `UNIT_OF_MEASURE`, `CURRENCY_BASIS` or `SIGN_CONVENTION` differ between the
   sides, or either is `UNKNOWN` → **`UNKNOWN`**, with the attribute named in
   `FAILED_CHECKS`. Matching types do not make two numbers mean the same thing.
10. Otherwise → **`PROVEN_MATCH`**, `BLOCKS_CUTOVER` = `N`.

Additionally, whatever the verdict:

- `DEPENDS_ON_FEED` populated → add `FEED_DEPENDENCY`. A field assembled from two
  feeds that can arrive separately produces a *wrong* value rather than a
  missing one, which is the harder failure to detect.
- The column is written by more than one lane → add `DUAL_SOURCE` and make sure
  it appears in the `DUAL_SOURCE` sheet.

`MATCH_VERDICT`, exactly these strings: `PROVEN_MATCH` | `UNKNOWN` |
`DECODE_NEEDED` | `PRECISION_RISK` | `TYPE_SHIFT` | `NOT_COMPARABLE` |
`NO_SOURCE` | `NO_BASELINE` | `OUT_OF_SCOPE`

`FAILED_CHECKS`, pipe-separated from exactly this list, empty for
`PROVEN_MATCH`: `TYPE_FAMILY` | `LENGTH` | `SCALE` | `NULLABILITY` | `CODE_SET` |
`UNIT` | `CURRENCY` | `SIGN` | `DATE_GRANULARITY` | `CARDINALITY` |
`FEED_DEPENDENCY` | `NO_TYPES_SUPPLIED` | `BYPASSES_CONTRACT` | `DUAL_SOURCE`

---

## SHEET 10 — `DISPOSITION`

One row per `NO_SOURCE` column in `VERIFY`.

`LANE_ID` | `DWH_TARGET_TABLE` | `DWH_TARGET_COLUMN` | `DISPOSITION` |
`DISPOSITION_DETAIL` | `PROPOSED_BY` | `OWNER` | `APPROVED_ON` | `NOTES`

- `DISPOSITION` — `DEFAULT` | `DERIVE` | `DROP` | `BLOCK` | `UNDECIDED`
- Default every row to `UNDECIDED`, with `OWNER` and `APPROVED_ON` blank. You may
  propose one in `DISPOSITION_DETAIL` with your reasoning. Do not mark anything
  approved — that is the warehouse data owner's decision.

---

## SHEET 11 — `DUAL_SOURCE`

One row per IMDS column written by more than one lane. Expect
`RULESDBO.ENTITY` and `RULESDBO.ENTITY_HIST` here if both STAR and UAF populate
them.

`DWH_TARGET_TABLE` | `DWH_TARGET_COLUMN` | `LANES` | `PRECEDENCE_RULE` |
`PROPOSED_BY` | `OWNER` | `APPROVED_ON` | `EVIDENCE` | `NOTES`

- `LANES` — pipe-separated `LANE_ID`s
- `PRECEDENCE_RULE` — which lane wins when both supply a value, and on what
  basis: last write, a source priority, a record-type split. `UNKNOWN` unless a
  document states it — and a document stating it is rare, which is the point of
  the sheet.
- `OWNER` = `IMDS data owner`, `APPROVED_ON` blank until it is decided

---

## SHEET 12 — `EXCEPTIONS`

`SHEET` | `ROW_KEY` | `COLUMN` | `ISSUE` | `WHY_UNRESOLVED` | `WHO_CAN_ANSWER` |
`SUGGESTED_QUESTION`

- `WHO_CAN_ANSWER` — `SEI design team` | `STAR owner` | `UAF owner` |
  `IMDS data owner` | `BBH mapping` | `UNKNOWN`
- `SUGGESTED_QUESTION` — phrased to be sent as-is, naming the artefact needed
  rather than asking for clarification in general

---

## SHEET 13 — `ENUMS`

`LIST_NAME` | `VALUE` | `MEANING`

Every controlled vocabulary used above, so the workbook validates itself and the
ingester can check values without a second document. Include the `SUBJECT_AREA`
list you used — and if you had to add an area to classify an entity honestly,
list it here rather than forcing the entity into `Reference`.

---

## EXCEL MECHANICS

- Format as **Text** before writing, or values are silently corrupted: every
  identifier, field code and feed name (`BI/1-1` becomes a date), every
  `*_LENGTH`, `*_SCALE`, `*_PRECISION`, and any date written `YYYYMMDD`.
- Freeze the header row and add an autofilter on every sheet.
- **No formulas** — write computed values. A formula that evaluates to an error
  loads as an error.
- Sensible column widths, no wrapping.
- Use `UNKNOWN`, `N/A`, `NOT_SUPPLIED` and `NO_EQUIVALENT` as written. Never
  leave a specified cell truly empty except `NOTES`, `OPEN_QUESTION` and the
  approval columns.

If you cannot produce an `.xlsx`, produce one CSV per sheet named
`<SHEETNAME>.csv`, UTF-8, all fields quoted, and say so.

---

## SELF-CHECK BEFORE YOU RETURN THE FILE

Run these and state the result of each. If any fails, fix it and re-run rather
than explaining it away.

1. `LANE_LINEAGE` and `VERIFY` have the same row count, and every
   (`LANE_ID`, `DWH_TARGET_TABLE`, `DWH_TARGET_COLUMN`) appears exactly once in
   each. Uniqueness is on the **triple** — a column may legitimately appear once
   per lane.
2. Every `SEI_TO_CONTRACT` (`LANE_ID`, `TARGET_CONTRACT_FEED`,
   `TARGET_CONTRACT_FIELD`) exists in `LANE_LINEAGE` as (`LANE_ID`,
   `SRC_SOURCE_TABLE`, `SRC_SOURCE_COLUMN`). List any that do not — a SEI
   mapping pointing at a contract field nobody consumes is either net-new scope
   or a typo, and the two look identical in a spreadsheet.
3. Every `CODE_SET_NAME` referenced in `LANE_LINEAGE` or `SEI_TO_CONTRACT`
   appears in `CODE_SET`.
4. Every `COMPOSITE_GROUP` value appears on two or more rows. A composite group
   of one is a mis-classified `DIRECT`.
5. No `PROVEN_MATCH` row has `EVIDENCE_LEFT` or `EVIDENCE_RIGHT` of `ASSUMED` or
   `NONE`, and none has a non-empty `FAILED_CHECKS`.
6. Every `NO_SOURCE` row in `VERIFY` has a matching `DISPOSITION` row.
7. Every value in every controlled column appears in `ENUMS`.
8. No cell contains an account number, client or party name, transaction
   identifier, balance, credential, connection string or hostname.
9. No `MAP_ID` ends in `:2` or higher without a populated `COMPOSITE_GROUP`.
10. No `CODE_SET_NAME` is numeric, and no `CODE_DESCRIPTION` equals its own
    `CODE_SET_NAME`.
11. Every `VERIFY` row with no contract field has verdict `NO_BASELINE`.
12. Every `LANE_REGISTER` lane has at least one `LANE_LINEAGE` row, or an
    `EXCEPTIONS` row saying why it has none.
13. Every column in `DUAL_SOURCE` appears in `LANE_LINEAGE` under each lane it
    names, and every `VERIFY` row for those columns carries `DUAL_SOURCE` in
    `FAILED_CHECKS`.

---

## WHAT TO SAY IN YOUR REPLY

Short. Give me:

- row counts per sheet, and the `VERIFY` breakdown by `MATCH_VERDICT` and by lane
- the self-check results, one line each
- the `CEILING` value and why
- the top five `EXCEPTIONS` by how much they block, with the document that would
  clear each
- anything in the attached documents that contradicted something else, and which
  you treated as authoritative

Do not summarise the workbook sheet by sheet — I will open it.

---

## APPENDIX A — the IMDS DDL extract

This is the single highest-value input. Without it, rule 4 caps the workbook at
zero proven matches forever.

```sql
SELECT c.owner, c.table_name, c.column_name, c.data_type,
       c.data_length, c.data_precision, c.data_scale, c.nullable, c.column_id,
       CASE WHEN pk.column_name IS NOT NULL THEN 'Y' ELSE 'N' END AS pk_flag
FROM   all_tab_columns c
LEFT JOIN ( SELECT cc.owner, cc.table_name, cc.column_name
            FROM   all_constraints ct
            JOIN   all_cons_columns cc
              ON   cc.owner = ct.owner
             AND   cc.constraint_name = ct.constraint_name
            WHERE  ct.constraint_type = 'P' ) pk
  ON   pk.owner = c.owner
 AND   pk.table_name = c.table_name
 AND   pk.column_name = c.column_name
WHERE  c.owner IN ('BBHRPTDBO','RULESDBO','HOLDINGDBO','SECURITYDBO')
ORDER  BY c.owner, c.table_name, c.column_id;
```

## APPENDIX B — the incumbent feed inventory

Known STAR feed families: `ACDDIFI1` (accounts), `PEDDIFI1` (positions),
`TJDDIFI1` (trades and transactions), `ODDDIFI1` (open dividends), `ORDDIFI1`
(accrued interest), `SMDDIFI1` (security master), `TBMEIFI7` (NAV / fund
accounting).

This list is a checklist for `BASELINE_COVERAGE`, **not** permission to invent
rows. A feed with no attached layout or lineage document gets an `EXCEPTIONS`
row and nothing else. Do not infer a feed's contents from its name.

UAF reaches IMDS through command jobs and stored procedures rather than a file
layout — record the job name in `SRC_TO_STG1_TRANSFORM` and treat the job
specification as the `SOURCE_DOC`.
