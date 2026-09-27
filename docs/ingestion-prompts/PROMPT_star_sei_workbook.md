# Build the STAR → IMDS and SEI → STAR → IMDS mapping workbook

You are a data lineage analyst. Produce ONE Excel workbook (`.xlsx`) that captures,
at final-column level, (a) the existing STAR → IMDS lineage baseline, (b) the
proposed SEI → STAR-compatible → IMDS mapping, and (c) a mechanical verification
of which SEI datapoint matches which STAR field and which do not.

The workbook will be loaded into a lineage database by an automated ingester.
Column names, sheet names and controlled values below are a contract. Do not
rename, reorder, add or drop columns. Do not merge cells. One header row, data
from row 2, no blank rows inside a sheet, no totals rows, no colour coding that
carries meaning.

---

## INPUTS

Use only the documents attached to this conversation. Name every one you used in
the `_MANIFEST` sheet.

Expected, in rough order of authority:

1. IMDS target DDL or data dictionary (`HOLDINGDBO`, `ACCOUNTDBO`, `RULESDBO`, …)
2. STAR outbound feed layouts / copybooks (ACDDIFI1, PEDDIFI1, TJDDIFI1, ODDDIFI1,
   ORDDIFI1, SMDDIFI1, TBDEIFI and any others)
3. STAR → IMDS ETL mapping documents or job specifications
4. SEI feed workbooks / interface specifications (field lists WITH declared types)
5. SEI architecture or design notes
6. Any existing SEI ↔ STAR or SEI ↔ AddVantage mapping drafts
7. Reference / code-set documentation for any of the three sides

**If an input is missing, do not stop and do not skip rows.** Emit the rows you
can identify, set the unknown cells to `UNKNOWN`, set `EVIDENCE` to `NONE`, and
write one `EXCEPTIONS` row per gap naming the document you would have needed.

---

## THE SEVEN RULES — these override anything else in this prompt

1. **Never invent a type, length, scale, nullability or code value.** If it is not
   in an attached document, the cell is the literal string `UNKNOWN`. A wrong
   `NUMBER(15,2)` is far more damaging than an honest `UNKNOWN`, because it will
   be believed and it will clear a check it should have failed.

2. **Every factual row carries an `EVIDENCE` value** from:
   `LIVE_DDL` · `COPYBOOK` · `FEED_WORKBOOK` · `DOCUMENT` · `ASSUMED` · `NONE`.
   `ASSUMED` means you derived it from something adjacent (for example inferring a
   compatibility field's type from the target column it feeds). `ASSUMED` is
   permitted, but it can never produce a `PROVEN_MATCH` verdict.

3. **Drive from the target, not the source.** `STAR_TO_IMDS` must contain exactly
   one row for every IMDS target column in scope, including columns with no STAR
   field behind them. A source field with no target is a curiosity; a target
   column with no source is a cutover blocker, and it can only be found by
   iterating the target side.

4. **`UNKNOWN` is never a pass.** It records the absence of a check. Never write
   `PROVEN_MATCH` unless BOTH sides' type, length, scale and nullability came from
   `LIVE_DDL`, `COPYBOOK` or `FEED_WORKBOOK`.

5. **Composites get N rows, not one.** When several SEI datapoints combine into one
   STAR field, emit one `SEI_TO_STAR` row per SEI datapoint, all sharing a
   `COMPOSITE_GROUP` value. Never concatenate several datapoint names into a cell.

6. **No production data.** Structure and metadata only. No account numbers, client
   names, party names, transaction identifiers, balances, credentials, connection
   strings, hostnames, file paths containing environment names, or sample values
   taken from real records. If an attached document contains such values, do not
   carry them into the workbook. Code-set *values* (status codes, type codes) are
   metadata and are in scope; the entities they describe are not.

7. **Report what you could not resolve.** Every cell you set to `UNKNOWN` because
   of a missing document gets an `EXCEPTIONS` row. A silently blank workbook is
   worse than a loud incomplete one.

---

## SHEET 1 — `_MANIFEST`

Columns: `ITEM` | `VALUE` | `NOTES`

Emit one row for each of: `GENERATED_ON` (ISO date), `SCOPE_SUMMARY`,
`SOURCE_DOCUMENT` (one row per attached document — value is the filename, notes
is what you took from it), then one row per sheet named
`ROWCOUNT_<SHEETNAME>`, then `UNRESOLVED_COUNT` (the number of `EXCEPTIONS`
rows), then `PROVEN_MATCH_COUNT`.

---

## SHEET 2 — `LANE_REGISTER`

A lane is one `source system → warehouse` pairing. Legacy is a *group* of lanes,
not a system.

Columns: `LANE_ID` | `SOURCE_SYSTEM` | `DATA_SOURCE` | `REPLACEMENT_STATE` |
`SUCCESSOR_SYSTEM` | `CONTRACT_NAME` | `NOTES`

- `LANE_ID` — uppercase, `<SOURCE>_<WAREHOUSE>`, e.g. `STAR_IMDS`
- `DATA_SOURCE` — the target warehouse: `PBDW` | `IMDS`
- `REPLACEMENT_STATE` — `REPLACED` | `NOT_REPLACED` | `SEI_NATIVE`
- `CONTRACT_NAME` — the compatibility shape SEI must land in, named for the
  incumbent it imitates (e.g. `STAR-compatible`). Blank when `NOT_REPLACED`.

Seed it with at least: `ADDVANTAGE_PBDW`, `ADDVANTAGE_IMDS`, `STAR_IMDS`,
`UAF_IMDS`. Mark `UAF_IMDS` as `NOT_REPLACED` — it is not part of the SEI
migration and must be excluded from SEI coverage rather than scored zero.

---

## SHEET 3 — `STAR_FEED`

One row per STAR outbound feed.

Columns: `FEED_NAME` | `FEED_FAMILY` | `DATASET` | `SUBJECT_AREA` | `GRAIN` |
`FREQUENCY` | `LOAD_BEHAVIOUR` | `KEY_FIELDS` | `LAYOUT_AVAILABLE` | `EVIDENCE` |
`SOURCE_DOC` | `NOTES`

- `LOAD_BEHAVIOUR` — `FULL` | `CHANGE` | `UPDATE` | `RESTATE` | `UNKNOWN`
- `GRAIN` — what one record represents, in words
- `KEY_FIELDS` — pipe-separated field names that uniquely identify a record
- `LAYOUT_AVAILABLE` — `Y` | `N`; `N` means no copybook was attached for this feed

---

## SHEET 4 — `STAR_TO_IMDS` — the baseline

**One row per IMDS target column.** These columns mirror the `LEGACY_LINEAGE`
table so the load is a direct insert.

`LANE_ID` | `DATA_SOURCE` | `DWH_TARGET_TABLE` | `DWH_TARGET_COLUMN` | `DWH_TYPE` |
`DWH_LENGTH` | `DWH_PRECISION` | `DWH_NULLABLE` | `DWH_PK_FLAG` |
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

- **`SRC_SOURCE_TABLE` is the STAR feed name and `SRC_SOURCE_COLUMN` is the STAR
  field name.** This pair is the compatibility contract — it is the join point
  that SEI must land in, so it must be populated wherever a STAR field is known,
  even if every staging column is `N/A`.
- Write `SRC_SOURCE_TABLE` as the physical feed name **verbatim**, including any
  date or sequence placeholders. Do not normalise, truncate or clean it — the
  ingester derives its own join key.
- If the STAR → IMDS ETL has no persisted staging layer, put `N/A` in the
  `STG1_*` and `STG2_*` columns. `N/A` and `Not Applicable` are both recognised
  as "this stage does not exist"; do not use `NULL`, `-`, or an empty cell to
  mean it.
- `DWH_NULLABLE` / `DWH_PK_FLAG` — `Y` | `N` | `UNKNOWN`
- `UNIT_OF_MEASURE` — e.g. `shares`, `currency amount`, `percent`, `basis points`,
  `days`, `N/A`, `UNKNOWN`
- `CURRENCY_BASIS` — `ASSET` | `BASE` | `LOCAL` | `N/A` | `UNKNOWN`
- `SIGN_CONVENTION` — how a negative or short value is represented, or `UNKNOWN`
- `CODE_SET_NAME` — the named code set when the column holds a code; must also
  appear in `CODE_SET`. `N/A` when the column is not coded.
- `LINEAGE_STATUS` — `MAPPED` | `UNMAPPED` | `NOT_APPLICABLE`. `UNMAPPED` means
  the IMDS column exists and no STAR field feeds it. Populate the row anyway.
- `SOURCE_DOC_LOCATOR` — page, sheet name, or section where you read it

---

## SHEET 5 — `SEI_FEED`

One row per SEI outbound feed or entity.

`SEI_FEED` | `SEI_ENTITY` | `SUBJECT_AREA` | `DELIVERY_MODE` | `FREQUENCY` |
`GRAIN` | `KEY_FIELDS` | `LOAD_BEHAVIOUR` | `TYPES_PUBLISHED` | `EVIDENCE` |
`SOURCE_DOC` | `NOTES`

- `DELIVERY_MODE` — `FILE` | `EVENT` | `API` | `UNKNOWN`
- `TYPES_PUBLISHED` — `Y` | `N`. `N` means the document names the datapoints but
  not their types. This single flag predicts how much of the verification can
  complete, so set it accurately.

---

## SHEET 6 — `SEI_TO_STAR` — the new mapping

**One row per (SEI datapoint → STAR field) pair.** N rows for a composite.

`MAP_ID` | `LANE_ID` | `TARGET_STAR_FEED` | `TARGET_STAR_FIELD` | `SEI_FEED` |
`SEI_ENTITY` | `SEI_DATAPOINT` | `SEI_TYPE` | `SEI_LENGTH` | `SEI_SCALE` |
`SEI_NULLABLE` | `SEI_UNIT_OF_MEASURE` | `SEI_CURRENCY_BASIS` |
`SEI_SIGN_CONVENTION` | `SEI_CODE_SET_NAME` | `MAP_KIND` | `COMPOSITE_GROUP` |
`COMPOSITE_ROLE` | `SEI_TO_STAR_RULE` | `JOIN_KEY` | `DEPENDS_ON_FEED` |
`EVIDENCE` | `SOURCE_DOC` | `SOURCE_DOC_LOCATOR` | `OPEN_QUESTION` | `NOTES`

- `MAP_ID` — `<LANE_ID>:<TARGET_STAR_FEED>:<TARGET_STAR_FIELD>:<n>`, n starting at 1
- `MAP_KIND` — `DIRECT` | `LOOKUP` | `DERIVED` | `COMPOSITE` | `CONSTANT` | `UNAVAILABLE`
  - `UNAVAILABLE` means the STAR field has no SEI datapoint behind it. Emit the
    row with the SEI columns set to `N/A` — the absence is the finding and it must
    be a row, not a missing row.
- `COMPOSITE_GROUP` — shared id across the rows that combine; `N/A` otherwise
- `COMPOSITE_ROLE` — this datapoint's part, e.g. `base amount`, `rate`,
  `start date`
- `SEI_TO_STAR_RULE` — the transformation in words or pseudocode. State any
  parameter you do NOT have (day-count basis, rounding rule, FX rate source) as
  `-- NOT SUPPLIED` inside the rule rather than omitting it.
- `JOIN_KEY` — the key used when the datapoint comes from a different feed
- `DEPENDS_ON_FEED` — a feed that must load first (reference or rate feeds)
- `OPEN_QUESTION` — the one question that would unblock this row, if any

---

## SHEET 7 — `CODE_SET`

`CODE_SET_NAME` | `SIDE` | `CODE_VALUE` | `CODE_DESCRIPTION` | `MAPS_TO_SIDE` |
`MAPS_TO_CODE` | `MAPS_TO_DESCRIPTION` | `EVIDENCE` | `SOURCE_DOC` | `NOTES`

- `SIDE` / `MAPS_TO_SIDE` — `SEI` | `STAR` | `IMDS`
- One row per code value per side. Where a crosswalk is documented, fill
  `MAPS_TO_*`; where it is not, leave them `UNKNOWN` and add an `EXCEPTIONS` row.
  A code that exists on one side with no counterpart on the other is a finding —
  emit it with `MAPS_TO_CODE` = `NO_EQUIVALENT`.

---

## SHEET 8 — `IDENTIFIER_XWALK`

`ENTITY` | `SEI_IDENTIFIER` | `STAR_IDENTIFIER` | `IMDS_IDENTIFIER` |
`CARDINALITY` | `RESOLUTION_RULE` | `AUTHORITATIVE_SIDE` | `EVIDENCE` | `NOTES`

- `CARDINALITY` — `1:1` | `1:N` | `N:1` | `N:N` | `UNKNOWN`
- Cover at least: account, portfolio, instrument/security, party, transaction.
- Where an instrument can be matched on more than one identifier (INSTRUMENT_ID,
  ISIN, CUSIP, SEDOL), emit one row per identifier and say in `RESOLUTION_RULE`
  which takes precedence and in what context.

---

## SHEET 9 — `VERIFY` — you generate this, do not ask for it

**One row per IMDS target column** — the same row set as `STAR_TO_IMDS`. This is
the answer to "what matches with what".

`DATA_SOURCE` | `LANE_ID` | `DWH_TARGET_TABLE` | `DWH_TARGET_COLUMN` |
`SUBJECT_AREA` | `STAR_FEED` | `STAR_FIELD` | `SEI_DATAPOINT_COUNT` |
`SEI_DATAPOINTS` | `MAP_KIND` | `MATCH_VERDICT` | `VERDICT_REASON` |
`FAILED_CHECKS` | `EVIDENCE_LEFT` | `EVIDENCE_RIGHT` | `BLOCKS_CUTOVER` |
`WHAT_WOULD_CLEAR_IT`

- `SEI_DATAPOINTS` — pipe-separated, for readability only; the authoritative rows
  are in `SEI_TO_STAR`
- `EVIDENCE_LEFT` — evidence for the SEI side; `EVIDENCE_RIGHT` — for the
  STAR/IMDS side
- `BLOCKS_CUTOVER` — `Y` | `N`
- `WHAT_WOULD_CLEAR_IT` — the specific artefact or decision needed, in one
  sentence. Not "more analysis".

### The verdict algorithm — apply in order, first match wins

Let LEFT = the SEI side, RIGHT = the STAR field as consumed by IMDS.

1. The lane's `REPLACEMENT_STATE` is not `REPLACED` → `OUT_OF_SCOPE`.
   `BLOCKS_CUTOVER` = `N`. Do not score these; they are not gaps.
2. `STAR_TO_IMDS.LINEAGE_STATUS` = `UNMAPPED` → `NO_BASELINE`.
   A pre-existing hole, not a SEI finding. `BLOCKS_CUTOVER` = `N`.
3. No `SEI_TO_STAR` row, or `MAP_KIND` = `UNAVAILABLE` → `NO_SOURCE`.
   `BLOCKS_CUTOVER` = `Y`. Add a `DISPOSITION` row.
4. `MAP_KIND` = `COMPOSITE` → `NOT_COMPARABLE`. `BLOCKS_CUTOVER` = `Y`.
   A composite has no single left-hand side, so no field-level check applies.
5. Either side's type, length, scale or nullability is `UNKNOWN`, **or** either
   evidence is `ASSUMED` or `NONE` → `UNKNOWN`. `BLOCKS_CUTOVER` = `Y`.
6. A code set is involved and the `CODE_SET` crosswalk is absent or incomplete,
   or `MAP_KIND` = `LOOKUP` → `DECODE_NEEDED`. `BLOCKS_CUTOVER` = `Y`.
7. Type families differ (character ↔ numeric, character ↔ date/time, numeric ↔
   date/time) → `TYPE_SHIFT`. `BLOCKS_CUTOVER` = `Y`.
8. Same family, but RIGHT is narrower than LEFT — shorter length, fewer decimal
   places, or `DATE` on the right against a timestamp on the left →
   `PRECISION_RISK`. `BLOCKS_CUTOVER` = `Y`.
9. `UNIT_OF_MEASURE`, `CURRENCY_BASIS` or `SIGN_CONVENTION` differ between the
   sides, or either is `UNKNOWN` → `UNKNOWN`, with the differing attribute named
   in `FAILED_CHECKS`. Types matching does not make a number mean the same thing.
10. Otherwise → `PROVEN_MATCH`. `BLOCKS_CUTOVER` = `N`.

`FAILED_CHECKS` — pipe-separated, from exactly this list, empty for
`PROVEN_MATCH`: `TYPE_FAMILY` | `LENGTH` | `SCALE` | `NULLABILITY` | `CODE_SET` |
`UNIT` | `CURRENCY` | `SIGN` | `DATE_GRANULARITY` | `CARDINALITY` |
`FEED_DEPENDENCY` | `NO_TYPES_SUPPLIED`

Also raise `FEED_DEPENDENCY` whenever `DEPENDS_ON_FEED` is populated — a field
assembled from two feeds that can arrive separately produces a wrong value rather
than a missing one, which is the harder failure to detect.

`MATCH_VERDICT` vocabulary, exactly these strings: `PROVEN_MATCH` | `UNKNOWN` |
`DECODE_NEEDED` | `PRECISION_RISK` | `TYPE_SHIFT` | `NOT_COMPARABLE` |
`NO_SOURCE` | `NO_BASELINE` | `OUT_OF_SCOPE`

---

## SHEET 10 — `DISPOSITION`

One row per `NO_SOURCE` column from `VERIFY`.

`DWH_TARGET_TABLE` | `DWH_TARGET_COLUMN` | `DISPOSITION` | `DISPOSITION_DETAIL` |
`PROPOSED_BY` | `OWNER` | `APPROVED_ON` | `NOTES`

- `DISPOSITION` — `DEFAULT` | `DERIVE` | `DROP` | `BLOCK` | `UNDECIDED`
- Default every row to `UNDECIDED` with `OWNER` and `APPROVED_ON` blank. You may
  propose a disposition in `DISPOSITION_DETAIL` and put your reasoning there, but
  do not mark anything approved. These are the warehouse data owner's decision.

---

## SHEET 11 — `EXCEPTIONS`

`SHEET` | `ROW_KEY` | `COLUMN` | `ISSUE` | `WHY_UNRESOLVED` | `WHO_CAN_ANSWER` |
`SUGGESTED_QUESTION`

- `WHO_CAN_ANSWER` — `SEI design team` | `STAR owner` | `IMDS data owner` |
  `BBH mapping` | `UNKNOWN`
- `SUGGESTED_QUESTION` — phrased so it can be sent as-is, naming the artefact
  needed rather than asking for clarification in general

---

## SHEET 12 — `ENUMS`

`LIST_NAME` | `VALUE` | `MEANING`

Emit every controlled vocabulary used above, so the workbook validates itself and
the ingester can check values without a second document.

---

## EXCEL MECHANICS

- Format these columns as **Text** before writing, or values will be silently
  corrupted: every identifier, field code and feed name (`BI/1-1` becomes a date,
  `ACDDIFI1` is fine but `1-2` is not), every `*_LENGTH`, `*_SCALE`,
  `*_PRECISION`, and every date written as `YYYYMMDD`.
- Freeze the header row on every sheet.
- Add an autofilter to the header row on every sheet.
- No formulas — write computed values. The ingester reads values, and a formula
  that evaluates to an error will load as an error.
- Set a sensible column width; do not wrap.
- Use `UNKNOWN`, `N/A` and `NO_EQUIVALENT` as written. Never leave a specified
  cell truly empty except `NOTES`, `OPEN_QUESTION` and the approval columns.

If you cannot produce an `.xlsx` in this environment, produce one CSV per sheet
named `<SHEETNAME>.csv`, UTF-8, comma-delimited, all fields quoted, and say so.

---

## SELF-CHECK BEFORE YOU RETURN THE FILE

Run these and state the result of each in your reply. If any fails, fix it and
re-run rather than explaining it away.

1. `STAR_TO_IMDS` and `VERIFY` have the same row count, and every
   (`DWH_TARGET_TABLE`, `DWH_TARGET_COLUMN`) in one appears exactly once in the other.
2. Every `SEI_TO_STAR.TARGET_STAR_FEED` + `TARGET_STAR_FIELD` pair exists as a
   (`SRC_SOURCE_TABLE`, `SRC_SOURCE_COLUMN`) pair in `STAR_TO_IMDS`. List any
   that do not — a SEI mapping pointing at a STAR field nobody consumes is either
   net-new scope or a typo, and the two look identical in a spreadsheet.
3. Every `CODE_SET_NAME` referenced in `STAR_TO_IMDS` or `SEI_TO_STAR` appears in
   `CODE_SET`.
4. Every `COMPOSITE_GROUP` value appears on two or more rows. A composite group of
   one is a mis-classified `DIRECT`.
5. No `PROVEN_MATCH` row has `EVIDENCE_LEFT` or `EVIDENCE_RIGHT` of `ASSUMED` or
   `NONE`, and none has a non-empty `FAILED_CHECKS`.
6. Every `NO_SOURCE` row in `VERIFY` has a matching `DISPOSITION` row.
7. Every value in every controlled column appears in `ENUMS`.
8. No cell contains an account number, client or party name, transaction
   identifier, balance, credential, connection string or hostname.

---

## WHAT TO SAY IN YOUR REPLY

Keep it short. Give me:

- the counts: IMDS columns covered, SEI datapoints mapped, and the `VERIFY`
  breakdown by `MATCH_VERDICT`
- the self-check results, one line each
- the top five `EXCEPTIONS` by how much they block, with the document that would
  clear each one
- anything in the attached documents that contradicted something else, and which
  you treated as authoritative

Do not summarise the workbook's contents back to me sheet by sheet — I will open it.
