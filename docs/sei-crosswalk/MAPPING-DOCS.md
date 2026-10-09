# SEI mapping documents — the v2 crosswalk workbook

`STAR_IMDS_SEI_Lineage_Catalog_v2_Transformations-Usage-Matrix.xlsx` read
seven SEI mapping documents into the catalog. Seven sheets are new, eight
changed. This is what the loader does with each, and what to expect on
screen.

Nothing in these documents is an approved SEI-to-STAR crosswalk. Every row
carries `DRAFT_REVIEW_REQUIRED` as written, and no verdict in `SEI_VERIFY`
changes because of them.

## Load it

```
sql/79_sei_mapping_docs.sql            once; additive, idempotent
$env:CP_SEI_XLSX = "<path to the v2 workbook>"
.\local\load.ps1 sei_crosswalk           (or: python -m ingestion.run sei_crosswalk)
```

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

- **Coverage.** Per IMDS target table: paths, a stacked bar of link
  classes, coverage, no-SEI-source and not-in-map counts. Click a table for
  its paths, filter by link class, open a row for the three logics side by
  side, and jump to the column's verdict.
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
```

## Tests

```
python ingestion/test/test_mapping_docs_parse.py    the seven sheets and the two rebuilt summaries, by the published headers
python api/test/test_mapping_docs.py                the endpoints on a fake db
node ui/test/run.mjs                                the panel and its model
```
