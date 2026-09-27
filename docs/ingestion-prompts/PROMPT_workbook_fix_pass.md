# Fix pass on STAR_IMDS_SEI_Mapping_Workbook_Verified.xlsx

Do not regenerate the workbook from scratch. Open the attached
`STAR_IMDS_SEI_Mapping_Workbook_Verified.xlsx`, apply the corrections below, and
return it with the same sheet names and column headers. Keep every row you
cannot improve exactly as it is.

The seven rules from the original prompt still hold, and rule 1 above all:
**never invent a type, length, scale, nullability or code value.** The point of
this pass is to fix structure and grain, not to fill gaps with guesses. If a
correction below cannot be made from an attached document, leave the cell
`UNKNOWN` and add an `EXCEPTIONS` row.

---

## FIX 1 — `CODE_SET` is in the wrong shape

Current state: `CODE_SET_NAME` holds a row number (1, 2, 3 …), `CODE_VALUE`
holds what is actually the *name* of a reference domain (`ACCT_STATUS`,
`PORTFOLIO_TYPE`, `COUNTRY`, `ICB_SECTOR` …), and `CODE_DESCRIPTION` repeats
that same string. Loaded as-is this creates 197 code sets named after integers
and not one usable code value.

What the sheet means: one row per **code value**, inside a named domain.

Rebuild it:

- `CODE_SET_NAME` — the domain name (`ACCT_STATUS`), never a number
- `CODE_VALUE` — one member value of that domain (`A`, `C`, `01` …)
- `CODE_DESCRIPTION` — what that value means, never a copy of the domain name

If the SEI reference workbook lists **domains only and not their member
values** — which is what the current output suggests — then say so plainly
rather than fabricating values. In that case:

- Emit one row per domain with `CODE_VALUE` = `NOT_SUPPLIED` and
  `CODE_DESCRIPTION` = `Domain named in the reference workbook; member values
  not published`.
- Add one `EXCEPTIONS` row per domain, `WHO_CAN_ANSWER` = `SEI design team`,
  `SUGGESTED_QUESTION` naming the domain and asking for its permitted values
  with descriptions.
- Set `_MANIFEST` item `CODE_VALUES_SUPPLIED` to `N`.

Separately: every `MAPS_TO_CODE` is currently `UNKNOWN`, so there is no STAR
side at all. Add one `EXCEPTIONS` row per domain against
`WHO_CAN_ANSWER` = `STAR owner` asking for the equivalent STAR code set. Until
both sides exist, every decode stays blocked, and the workbook should say that
once rather than 197 times — put the summary line in `_MANIFEST` as
`DECODE_STATUS`.

---

## FIX 2 — `SEI_TO_STAR` is at the wrong grain

Current state: the sheet has roughly one row per **IMDS target column**, so the
same mapping is duplicated when two IMDS tables consume the same STAR field.
`ACDDIFI1.STAR_ENTITY_ID_1` appears twice, as `…:1` and `…:2`, because
`RULESDBO.ENTITY` and `RULESDBO.ENTITY_HIST` both read it. The same happens for
`CSTDY_HD_ACCT_NUM_8`, `FK_BSE_CRNCY_CDE_4` and `v_termination_date`.

This is wrong for two reasons. It double-counts the mapping effort, and it
creates two rows that can disagree about the same contract field — the exact
divergence the single-mapping design exists to prevent.

Correct grain: **one row per (`LANE_ID`, `TARGET_STAR_FEED`,
`TARGET_STAR_FIELD`, SEI datapoint).** The fan-out to several IMDS target
columns happens in the join, not in this sheet.

- Deduplicate. Where two rows are identical apart from the `:n` suffix, keep one.
- Where two such rows **differ** in any SEI column, keep both, set
  `MAP_KIND` = `UNAVAILABLE` on neither, and add an `EXCEPTIONS` row flagging a
  contradiction — two different SEI sources proposed for one contract field is
  a decision, not a duplicate.
- Reserve the `:n` suffix in `MAP_ID` for **composite parts only**. After this
  pass, any `MAP_ID` ending `:2` or higher must have a populated
  `COMPOSITE_GROUP`.

Report the before and after row counts in `_MANIFEST` as
`ROWCOUNT_SEI_TO_STAR_BEFORE_DEDUPE` and `ROWCOUNT_SEI_TO_STAR`.

---

## FIX 3 — rows where `STAR_FIELD` is `N/A` but SEI datapoints are attached

`VERIFY` contains at least one row — `RULESDBO.ENTITY.upd_user` — with
`STAR_FEED` and `STAR_FIELD` of `N/A` and `SEI_DATAPOINT_COUNT` of 2.

If there is no STAR field, there is no contract field to join on, so those SEI
datapoints were attached by something other than the specified join. Find every
such row and resolve it one of two ways:

- The STAR field exists and was missed → populate `STAR_FEED` / `STAR_FIELD` in
  `STAR_TO_IMDS` and re-derive.
- There genuinely is no STAR field → the SEI datapoints are a **direct SEI → IMDS
  proposal that bypasses the compatibility contract**. Keep them, but set
  `VERIFY.MATCH_VERDICT` = `NO_BASELINE`, add `BYPASSES_CONTRACT` to
  `FAILED_CHECKS`, and raise an `EXCEPTIONS` row. Bypassing the contract may be
  the right answer for operational columns like `upd_user` and `upd_date`, but
  it is an architecture decision and must not arrive as a side effect of a join.

List every affected column in `_MANIFEST` as `CONTRACT_BYPASS_COLUMNS`.

---

## FIX 4 — merge live IMDS DDL, if it is attached

`_MANIFEST` records that target types came from `IMDS_data_dictionary.xlsx`,
"a data dictionary, not live DDL". That sets a hard ceiling: with
`EVIDENCE_RIGHT` of `DOCUMENT`, rule 4 forbids `PROVEN_MATCH` on every row, so
the workbook cannot score above zero however good the SEI side becomes.

If a live DDL extract is attached to this conversation:

- Overwrite `DWH_TYPE`, `DWH_LENGTH`, `DWH_PRECISION`, `DWH_NULLABLE` and
  `DWH_PK_FLAG` from it, and set `EVIDENCE` = `LIVE_DDL` on those rows.
- Normalise: `DWH_TYPE` holds the bare type name (`VARCHAR2`, `NUMBER`, `DATE`,
  `CHAR`), with the size in `DWH_LENGTH` / `DWH_PRECISION`. Today some rows
  carry `VARCHAR2(255)` in the type while `DWH_LENGTH` says `UNKNOWN`, and the
  `CHAR` rows do the opposite. One convention, applied to every row.
- Treat a uniform `VARCHAR2(255)` across many columns as suspect — that is a
  dictionary default, not a measured length. Where DDL contradicts the
  dictionary, DDL wins and the difference goes in `NOTES`.
- Re-run the full verdict algorithm afterwards and report the new
  `MATCH_VERDICT` distribution against the old one.

If no DDL is attached, change nothing here and add one `_MANIFEST` row:
`CEILING` = `No PROVEN_MATCH is reachable until live IMDS DDL replaces the data
dictionary as target evidence.`

---

## FIX 5 — extend the baseline to the remaining STAR feeds, if their lineage is attached

`STAR_FEED` holds three feeds — `ACDDIFI1`, `PEDDIFI1`, `TBMEIFI7` — because
`IMDS_Star_Linage_Data (003).xlsx` documented only those. Four families are
absent entirely: `TJDDIFI1` (trades and transactions), `ODDDIFI1` (open
dividends), `ORDDIFI1` (accrued interest), `SMDDIFI1` (security master).

If lineage documents for any of them are attached, extend `STAR_FEED`,
`STAR_TO_IMDS`, `SEI_TO_STAR` and `VERIFY` using the same rules. If not, add one
`EXCEPTIONS` row per missing feed, `WHO_CAN_ANSWER` = `STAR owner`, and set
`_MANIFEST` item `BASELINE_COVERAGE` to the feeds present out of the feeds known
to exist.

Do not infer a feed's contents from its name.

---

## FIX 6 — `SUBJECT_AREA` on `SEI_FEED`

`Reference` is being used as a catch-all — `Client`, the `Fee *` entities,
`Statement *`, `Model *`, `User Detail`, `Role Details` and `Relationships` are
all filed under it. `Reference` should mean code and lookup data only.

Reclassify against the same subject areas used elsewhere in the workbook:
`Entity & SMA Account Master`, `Positions & Holdings`, `Trades & Transactions`,
`Security Master & Income`, `Fund Accounting & NAV`, `Reference`. Add `Party &
Relationships`, `Fees & Billing` and `Client Reporting` if the existing list
cannot hold an entity honestly — and list any area you add in `ENUMS`.

`Client` is a party, not reference data. Get that one right at minimum.

---

## FIX 7 — confirm the `ADDVANTAGE_IMDS` lane

`LANE_REGISTER` marks `ADDVANTAGE_IMDS` as `NOT_REPLACED` with the note "seeded
lane; no attached evidence of AddVantage feeding IMDS". Declining to assert an
unevidenced lane was the right call — leave the value as it is.

Add one `EXCEPTIONS` row, `WHO_CAN_ANSWER` = `IMDS data owner`, asking whether
AddVantage feeds IMDS at all. It changes which columns sit in the coverage
denominator, so it is a scoping question, not a detail.

---

## FIX 8 — the UAF → IMDS lane has no lineage rows anywhere

`LANE_REGISTER` records `UAF_IMDS`, and `_MANIFEST` records three UAF documents
used to confirm it is `NOT_REPLACED`. But no sheet carries a single UAF lineage
row, because the only column-level sheet is named and scoped to the STAR lane.

That is a defect in the original specification, not in your output. Two
different exclusions were being conflated:

- **Excluded from the SEI coverage denominator** — correct for UAF. It has no
  SEI successor, so it must never be scored for SEI readiness.
- **Excluded from lineage altogether** — wrong. UAF → IMDS is a real, live path
  into `RULESDBO` that IMDS consumes every day. It belongs in the lineage, shown
  and counted as lineage, and merely marked out of scope for the SEI verdicts.

### 8a. Rename the sheet and widen its scope

Rename `STAR_TO_IMDS` to **`LANE_LINEAGE`**. Keep every column exactly as it is.
The sheet already carries `LANE_ID` and `DATA_SOURCE` as its first two columns,
so it was always shaped to hold more than one lane — only its name said
otherwise. `LANE_LINEAGE` also survives the PBDW lane arriving later, which
`LANE_TO_IMDS` would not.

Its grain becomes: **one row per (`LANE_ID`, `DATA_SOURCE`,
`DWH_TARGET_TABLE`, `DWH_TARGET_COLUMN`).**

### 8b. Add the UAF rows

Build them from the UAF documents already attached — your own `_MANIFEST` notes
record where the content is:

- `UAF Job 1 - PDPA009_IntraDay_UAFtoPACE_CMD.pdf` — noted as UAF record-type
  routing and UAF population of the `RULESDBO` account/entity structures
- `UAF Job 3 - PDBA016_UAF_ADDRESS_LOAD_CMD.pdf` — noted as UAF address
  processing into `RULESDBO.BBH_INTERESTED_PARTIES` current and history structures
- `UAF to IFI feed information-v2.docx` — the feed and message content

Fill them the same way as any other lane:

- `LANE_ID` = `UAF_IMDS`, `DATA_SOURCE` = `IMDS`
- `SRC_SOURCE_TABLE` = the UAF message or feed, verbatim
- `SRC_SOURCE_COLUMN` = the UAF field
- The stored procedure or command job goes in `SRC_TO_STG1_TRANSFORM` (or the
  nearest populated stage), named exactly as the document names it
- Stages the path does not have are `N/A`, as everywhere else
- `EVIDENCE` = `DOCUMENT` — these are job specifications, not DDL

Same discipline as the rest: no invented types, an `EXCEPTIONS` row per gap.

### 8c. Add them to `VERIFY` too

Every `LANE_LINEAGE` row gets a `VERIFY` row, UAF included. Verdict rule 1 fires
first and gives them all `OUT_OF_SCOPE` with `BLOCKS_CUTOVER` = `N`.

This is the point of carrying them: the lane appears in the ledger, visibly
excluded and with a stated reason, rather than being silently absent. A lane
that is missing looks like an oversight; a lane marked `OUT_OF_SCOPE` looks like
a decision.

### 8d. Expect an overlap on `RULESDBO.ENTITY`, and do not clean it up

Your `_MANIFEST` note against UAF Job 1 already raises "dual-source ownership
questions with STAR". If both the STAR lane and the UAF lane write
`RULESDBO.ENTITY` or `RULESDBO.ENTITY_HIST`, then after 8b the same
(`DWH_TARGET_TABLE`, `DWH_TARGET_COLUMN`) will legitimately appear **twice** —
once per lane.

That is correct and must be preserved. Two lanes writing one column is a real
finding that needs a stated precedence rule, and nobody has stated one.

- Do not deduplicate across lanes.
- For every column written by more than one lane, add an `EXCEPTIONS` row,
  `WHO_CAN_ANSWER` = `IMDS data owner`, `SUGGESTED_QUESTION` asking which lane
  wins when both supply a value, and on what basis — last write, a source
  priority, or a record-type split.
- List those columns in `_MANIFEST` as `DUAL_SOURCE_COLUMNS`.

---

## AFTER THE FIXES

Self-check 1 from the original prompt **changes**, because a final column may
now legitimately appear once per lane. Replace it with:

1. `LANE_LINEAGE` and `VERIFY` have the same row count, and every
   (`LANE_ID`, `DWH_TARGET_TABLE`, `DWH_TARGET_COLUMN`) appears exactly once in
   each. Uniqueness is on the triple, not on the column alone.

Run the other seven as written, plus these four:

9.  No `MAP_ID` ends in `:2` or higher without a populated `COMPOSITE_GROUP`.
10. No `CODE_SET_NAME` is numeric.
11. Every `VERIFY` row whose `STAR_FIELD` is `N/A` has verdict `NO_BASELINE`.
12. Every `LANE_REGISTER` lane has at least one `LANE_LINEAGE` row, or an
    `EXCEPTIONS` row saying why it has none.

In your reply give me only: the row counts before and after per sheet, the
`MATCH_VERDICT` distribution before and after, the self-check results one line
each, and anything in FIX 1–7 you could not do and why.
