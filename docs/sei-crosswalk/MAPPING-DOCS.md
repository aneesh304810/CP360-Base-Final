# SEI mapping documents — the v2 and v4 crosswalk workbooks

`STAR_IMDS_SEI_Lineage_Catalog_v2_Transformations-Usage-Matrix.xlsx` read
seven SEI mapping documents into the catalog. Seven sheets are new, eight
changed. `STAR_IMDS_SEI_Lineage_Catalog_v4_SEI-Source-Files.xlsx` then
resolved every SEI source to the SEI feed file that carries it and rebuilt
the end-to-end sheet at a wider grain (see **v4** below). This is what the
loader does with each, and what to expect on screen.

Nothing in these documents is an approved SEI-to-STAR crosswalk. Every row
carries `DRAFT_REVIEW_REQUIRED` as written, and no verdict in `SEI_VERIFY`
changes because of them.

## Load it

```
sql/79_sei_mapping_docs.sql            once; additive, idempotent
sql/80_sei_lineage_v4.sql              once, before the v4 workbook; additive, idempotent
$env:CP_SEI_XLSX = "<path to the v2 or v4 workbook>"
.\local\load.ps1 sei_crosswalk           (or: python -m ingestion.run sei_crosswalk)
```

Load v4 with `CP_SEI_RELOAD=1`: its lineage rows are keyed by `LINEAGE_ID`,
not by the v2 path key, so a merge on top of a v2 load would hold both.

Set `CP_SEI_RELOAD=1` to replace the lane's rows rather than merge: the
seven new tables are purged by `DATA_SOURCE` with the rest.

**Formula cells.** `TRANSFORMATION_SUMMARY` and `STAR_FIELD_USAGE_SUMMARY`
are counted by formula. If the workbook was written by a program and never
opened in Excel, those cells have no cached value and load as blank; the
loader says so by sheet name. Open the workbook in Excel and save it once.
The screens recompute both summaries from the comparison rows and the
usage matrix anyway, so a blank summary costs nothing on screen.

## What a good load looks like

The first real load of the v2 workbook printed this count line; a reload
should match it:

    sei_crosswalk[IMDS]: ... e2e=1121, entityid=12, mapsrc=7, refcode=250,
    seistar=479, starstage=1121, usage=693, usageexc=105, usagesum=9,
    xcompare=1121, xform=672, control=102, feed=15 ...

`usagesum=9` is the ten summary rows minus TOTAL. `feed=15` is the ten
STAR feeds (OTDDIFI1 included) plus five UAF.

One warning is expected and harmless: `star_field_usage_summary[OTDDIFI1]:
declared 1.0% but 43/43 is 100.0%`. The sheet stores a fully-used family's
percentage as the number 1, which cannot be told from 1%; the loader uses
the computed 43/43 and says so.

Three rows were rejected on that first load for width: a 19,991-character
mapping rule in SEI_INPUT_LINEAGE, a 581-character SEI object expression
in the stage map, a 434-character normalised SEI field in the crosswalk.
The columns are widened (re-run `sql/79`) and the loader now cuts any cell
that still outruns its column, ending it with `… [cut: N chars]`, so the
row lands and the cut is visible. The full text stays in the workbook.

## v4 — SEI source files (`STAR_IMDS_SEI_Lineage_Catalog_v4_SEI-Source-Files.xlsx`)

35 sheets, 10,565 rows. Everything the v2 loader read still loads; what
changed is read into the same tables, so every screen keeps working and
gains what v4 adds.

| Change | What the loader does |
|---|---|
| **`SEI_STAR_IMDS_LINEAGE`** replaces `SEI_STAR_IMDS_E2E_XWALK` (1,285 rows, was 1,121). One row per IMDS column *or orphan STAR field*; `LINEAGE_COMPLETENESS` in place of `LINK_STATUS`; `LINEAGE_ID` key. | Lands in `sei_e2e_xwalk`, keyed `{ds}:{LINEAGE_ID}`. The completeness word is the `link_class`: `FULL_SEI_STAR_IMDS` → `E2E`, `SEI_TO_IMDS_NO_STAR_FIELD` → `SEI_DIRECT`, `STAR_TO_IMDS_NO_SEI_SOURCE` → `NO_SEI_SOURCE`, and two new ones: `SEI_TO_STAR_NO_IMDS_TARGET` → **`STAR_ONLY`** (a STAR field the documents map but nothing loads; `IMDS_TARGET_OBJECT = NOT_IDENTIFIED` reads as no target) and `NOT_POPULATED_IN_LOAD` → **`NOT_POPULATED`** (an IMDS column the STAR load never writes). The word itself stays in `link_status`. `STAR_FIELDS` may list several (`;`): kept whole, normalised by the first, `star_in_layout = Y` only when every one is in the published layout. `LINEAGE_STATUS` → `crosswalk_status`; `BUSINESS_DECISION_FLAG`, `COMPARISON_ID`, `IMDS_TYPE`, `IMDS_NULLABLE`, `STAR_FIELD_RESOLUTION`, `SEI_TO_IMDS_LOGIC_ORIGIN` land in columns of the same name (sql/80). |
| **`SEI_SOURCE_FILE` / `_FIELDS` / `_STATUS`** on the lineage, `SEI_TO_STAR_FIELD_MAP` and `LOT_LEVEL_POSITION_MAP` (and the stage map if present). | `sei_file`, `sei_file_fields`, `sei_file_status` on each table (sql/80). The status vocabulary is stored as given: `VERIFIED_IN_FEED_SPEC`, `PARTIALLY_VERIFIED`, `FILE_ONLY_NO_FIELD`, `SYSTEM_OR_CONSTANT`, `DERIVED_AT_RUNTIME`, `FIELD_NOT_IN_FEED_SPEC`, `NOT_AVAILABLE_IN_SEI_FEEDS`, `UNRESOLVED`, `NO_SEI_SOURCE`. |
| **`SEI_TO_STAR_FIELD_MAP`** 571 rows, was 479: 92 STAR layout fields no document mentions, `SOURCE_SHEET = STAR_LAYOUT_DETAIL`. | Loaded as rows; the register counts a document's own rows against what it declared and reports the layout-added ones apart (`s2s_from_layout`), so the register still agrees. |
| **`LINEAGE_SUMMARY`** (formula counts per STAR feed + IMDS table). | Lands in `sei_control` as `LINEAGE_SUMMARY`, control `feed → table`, `ROWS` the result, the counts in the detail. `/sei-crosswalk/lineage-summary` recomputes it from the lineage rows and returns the sheet's rows beside. Formula cells need the workbook saved in Excel once, as before. |
| `STAR_FEED` (10 rows), `SEI_FEED` (53), `TRANSFORMATION_REGISTER` (687), `LANE_LINEAGE` (46 columns). | Rows only; they load as before. `STAR_FEED.LAYOUT_AVAILABLE` and `SEI_TO_STAR.TARGET_STAR_USAGE_*` are not read. |

**Coverage is over the paths in scope.** `STAR_ONLY` and `NOT_POPULATED`
rows are not paths a SEI source could cover: one loads nothing, the other
has nothing to replace. `/e2e-coverage` reports `total`, `in_scope`,
`not_populated` and `star_only`; `coverage_pct` divides by `in_scope`. The
candidate ribbon leaves both out and says how many (`excluded`). The
ribbon's SEI node is the resolved feed file where there is one.

**A warehouse that has not run sql/80** still answers: the API tries the
wide select first and falls back to the v2 columns, and the SEI files view
says the workbook does not resolve files.

Expected count line for a v4 load: `e2e=1285, seistar=571, xform=687,
control=` (102 plus the 23 LINEAGE_SUMMARY rows), the rest as for v2.

## The mapping documents on the Lineage page (STAR lane)

The Lineage page reads STAR feed → IMDS column: the source files are
STAR's and UAF's, the warehouse is IMDS, and SEI is the mapping on that
chain, not a source file of its own. `LANE_LINEAGE` gave the STAR lane 108
rows. The mapping documents describe 1,121 IMDS stage columns over 14
tables in the same shape (STAR feed, STAR field, the load logic), and the
workbook tags them `LANE_ID = STAR_IMDS` itself, so the loader puts them
into the STAR lane of the same lineage tables, each carrying its SEI
mapping beside it.

| Column | What it holds |
|---|---|
| SRC | the STAR feed and the STAR field the load reads today (the uploader column when the document names no field); the published type and length from `STAR_LAYOUT_DETAIL` on the source column |
| → | the legacy STAR → IMDS load logic, on the one hop, as `LANE_LINEAGE`'s own rows |
| DWH | the IMDS table and column, the type split into type, length and precision |
| status | `MAPPED` when a STAR field or load logic is documented; `NOT_APPLICABLE` for a column the STAR load never writes |
| detail | which of those, then the SEI mapping in words: *replaced by SEI Taxlot.QUANTITY_HELD (verified in feed spec)*, or *no SEI source named (gap)*, or *STAR field not in the file map*, or *nothing for SEI to replace*; an open business decision; and that the row is a draft from a named document |
| side table | `legacy_lineage_xform`, which the column page's chain rules read: the SEI file and field that replaces the STAR input, the SEI-equivalent logic, the two transformation ids off the comparison (`<COMPARISON_ID>-IM` / `-SEI`), the equivalence verdict, approval, evidence, nullability |

A column `LANE_LINEAGE` already has keeps its verified row; the document's
row for it is skipped and counted in the log. A STAR field with no IMDS
target is not a lineage row and stays out. Row ids carry a prefix
(`{ds}:DOC:{table}:{column}:{chain}`), so the rows load in both lineage
modes — load and attach — and a reload (`CP_SEI_RELOAD=1`) purges them by
that prefix without touching the baseline. `CP_SEI_DOC_LINEAGE=0` leaves
them out.

On the Lineage page's system badge row, a lane the register declares with
no feed, verify or lineage row behind it (ADDVANTAGE_IMDS, "seeded lane")
is now offered only when nothing else is, so IMDS offers STAR and UAF.

## The step after STAR → IMDS on the source view

Lineage → Source view → open a STAR feed. Under its picture of what it
loads into IMDS sits the next node on the spine, **SEI feed files**: the
SEI outbound files (Taxlot, Account Outbound Interface, End of Day
Positions, …) that replace this feed's fields after cutover. One card per
SEI file with what the SEI feed register says it is, how many of the
feed's fields it carries, how many of those are verified in the published
feed spec, and the IMDS tables they reach; then, on demand, the field
table: STAR field today → SEI file.field after cutover, how it resolved,
where it lands in IMDS with a way to the verdict. Fields in the layout no
document mentions, open dependencies and fields read by nothing are marked.
Drawn for STAR only, and only when a mapping document covers the feed.

**On the Picture itself.** The canvas gains a toggle, **SEI source
mapping · n of m**, on by default when the crosswalk knows the feed. On, a
third column of SEI feed files stands to the right of the warehouse
tables, and a dashed wire runs from each warehouse column to the SEI file
that replaces its STAR input: green when the SEI field is verified in the
published feed spec, orange or red when it is not. Click a wire or a
column and the detail pane adds *After cutover · SEI source*: the SEI
file and field, the resolution, and the SEI-equivalent logic beside the
rule that is kept. The Reading view carries the same as a chip per row.
**⤓ export CSV** writes the picture as a table, one row per column link:
feed field, warehouse column, operation, rule, lineage status, SEI file,
SEI field, resolution, SEI-equivalent logic, equivalence.

```
GET /sei-crosswalk/feed-sei-files?feed=PEDDIFI1
GET /sei-crosswalk/source-canvas?src_table=PEDDIFI1   now carries `sei` per column and `sei_files`
```

## The seven new sheets

| Sheet | Table (sql/79) | Grain | Key |
|---|---|---|---|
| MAPPING_SOURCE_REGISTER | `sei_mapping_source` | one mapping document / STAR feed | `{ds}:{feed}` |
| SEI_TO_STAR_FIELD_MAP | `sei_star_field_map` | one STAR file field and its SEI source | the sheet's `MAP_ID`, prefixed `{ds}:` |
| STAR_TO_IMDS_STAGE_MAP | `star_imds_stage_map` | one IMDS column, its STAR field, legacy logic and SEI equivalent | `{ds}:{table}:{column}:{feed}:{star field}` |
| SEI_STAR_IMDS_E2E_XWALK | `sei_e2e_xwalk` | one SEI → STAR → IMDS path | `{ds}:{table}:{column}:{feed}:{star field}:{sei source}` |
| REFERENCE_CODE_XWALK | `sei_reference_code_xwalk` | one code value | `{ds}:{set}:{side}:{code}:{maps to}` |
| ENTITY_ID_DERIVATION | `sei_entity_id_derivation` | one Entity ID logic step | `{ds}:{feed}:{step}` |
| USAGE_RECON_EXCEPTIONS | `star_usage_mapping_exception` | one usage disagreement | `{ds}:{result}:{feed}:{field}` |

Columns are matched by name whatever their case, spacing or punctuation.
A column nothing reads is named in the log (`sheet has column(s) nothing
reads`); a sheet that parses to nothing prints its header row.

### Readings made at load

- **`LINK_STATUS` → `link_class`.** `E2E_LINKED` → `E2E`, `DIRECT_SEI_TO_IMDS`
  → `SEI_DIRECT`, `STAR_FIELD_NOT_IN_FILE_MAP` → `STAR_NOT_IN_FILE_MAP`,
  `NO_SEI_SOURCE` → `NO_SEI_SOURCE`. The sheet's word is kept in
  `link_status`. A row without one is classed by which ends it has.
  Coverage on screen = `E2E` + `SEI_DIRECT`.
- **`SEI_SOURCE` (Object.Field)** is split into `sei_object` and `sei_field`.
- **`star_in_layout`** on the SEI → STAR map and the E2E crosswalk: each
  STAR field is checked against `STAR_LAYOUT_DETAIL` from the same
  workbook. `N` is the field the E2E sheet calls not-in-file-map.
- **`MAPS_TO_CODE = UNKNOWN`** on a reference code is `is_mapped = N`: the
  document lists the codes, not their mappings.
- **`EVIDENCE_COMPLETENESS`** is stored as given, including the new value
  `IM_ONLY_DOCUMENTED`.
- **TOTAL rows** on the two summary sheets are not feed families and are
  skipped.

## The changed sheets

- **TRANSFORMATION_REGISTER / TRANSFORMATION_COMPARISON.** Schema unchanged;
  the rows simply load (sql/56). Coverage spans 14 IMDS tables.
- **TRANSFORMATION_SUMMARY.** Now one row per IMDS target table
  (`TARGET_OBJECT`, `TARGET_ROWS`, five completeness counts,
  `SEI_COVERAGE_PERCENT`, `APPROVAL_STATE`). It still lands in
  `SEI_CONTROL`: the table is the control, `TARGET_ROWS` its result, the
  counts in the detail. `/sei-crosswalk/transformation-summary` recomputes
  the same numbers from the comparison rows and shows the sheet's beside.
- **STAR_FIELD_USAGE_MATRIX.** Columns J–M land on `star_field_usage`:
  `MAPPING_DOC_USAGE` → `doc_usage_status`, `SEI_SOURCE_MAPPED` →
  `sei_mapped`, `USAGE_RECON_RESULT` → `usage_check`, `MAPPING_DOC` →
  `mapping_document`. Columns A–I are read as before.
- **STAR_FIELD_USAGE_SUMMARY.** `SEI_MAPPED_FIELDS`, `SEI_MAPPED_PERCENT`,
  `USED_BUT_UNMAPPED` (→ `used_no_sei_source`), `USAGE_CONFLICTS`,
  `ADDED_FROM_MAPPING_DOC`, `MAPPING_DOC` land; the three dropped layout
  columns stay NULL. The TOTAL row is skipped.
- **STAR_FEED, FINAL_VERIFICATION, _MANIFEST.** Rows only; they load as
  before.

## On screen

Lineage → the crosswalk dashboard gains a panel, **The SEI mapping
documents**, below "Does the new logic compute the same value?":

- **Cutover** (the default). One row per IMDS column of a STAR feed, read
  left to right: the STAR field that feeds it today, struck through and
  *replaced by* the SEI source the document proposes; the transformation,
  *kept* into IMDS; the IMDS column, with a way to its verdict. The rule
  in the middle is classed by whether it survives the swap:

  | state | meaning |
  |---|---|
  | same rule | the SEI-equivalent logic is the legacy logic, verbatim |
  | same rule, SEI input | the legacy logic with the STAR input swapped for the SEI input and nothing else changed |
  | copied as is | neither side has a rule: the value passes through |
  | two SEI versions | the document gives an `-- ALT:` alternative |
  | rewritten | a different rule on the SEI side |
  | new rule | no legacy rule, a SEI one |
  | no SEI rule | a legacy rule and nothing on the SEI side: the gap |

  A STAR field outside the published layout is marked ⚠, one the usage
  matrix says is read by nothing says so, and a column with no SEI source
  *stays until a SEI source is named*. Business decisions flagged in the
  document are counted and marked on the rule.
- **Coverage.** Per IMDS target table: paths, a stacked bar of link
  classes, coverage over the paths in scope, no-SEI-source, not-in-map and
  (v4) not-loaded counts. Click a table for its paths, filter by link
  class, open a row for the three logics side by side, and jump to the
  column's verdict. A row shows the SEI feed file its source resolves to
  and how well. A click on the candidate ribbon above scopes this view.
- **SEI files** (v4). Every SEI source resolved to the published SEI feed
  file: status pills, one row per file with the paths it carries, how many
  are verified in the feed spec, the IMDS tables it reaches and the STAR
  feeds it goes through; where the SEI → IMDS logic comes from and how the
  STAR field was found.
- **Documents.** The register, with what each document declared beside what
  the lane tables actually hold. A difference is rows the load dropped.
- **Transformations.** The per-table summary, recomputed, with the sheet's
  own figure beside it.
- **Reference codes**, **Entity ID**, **Usage exceptions.**

The STAR field usage drill shows, per field, what the mapping document says
and whether a SEI source is mapped.

## API

```
GET /sei-crosswalk/mapping-docs
GET /sei-crosswalk/e2e-coverage
GET /sei-crosswalk/e2e-rows?table=&feed=&link=&q=
GET /sei-crosswalk/transformation-summary
GET /sei-crosswalk/reference-codes?code_set=
GET /sei-crosswalk/entity-id
GET /sei-crosswalk/usage-exceptions?result=&feed=
GET /sei-crosswalk/flow-candidates
GET /sei-crosswalk/lineage-summary                  v4: per STAR feed + IMDS table, recomputed, the sheet's rows beside
GET /sei-crosswalk/cutover-lineage?feed=&q=         one row per IMDS column: STAR today, SEI after, the rule and its state
```

## Tests

```
python ingestion/test/test_mapping_docs_parse.py    the seven sheets and the two rebuilt summaries, by the published headers
python api/test/test_mapping_docs.py                the endpoints on a fake db
node ui/test/run.mjs                                the panel and its model
```
