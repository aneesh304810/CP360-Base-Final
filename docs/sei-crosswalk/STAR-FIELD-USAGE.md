# STAR field usage — three new crosswalk sheets

The workbook now carries which published STAR fields anybody actually
**reads**. `STAR_LAYOUT_DETAIL` says what a feed family publishes; nothing
said what consumes it, so the crosswalk counted every published field as
something to account for. A family publishing 139 fields of which 49 are
read showed 90 apparent gaps that nothing consumes.

## Load it

```sql
@sql/65_star_field_usage.sql      -- the three usage tables
@sql/66_sei_verify_usage_key.sql  -- the column that links them to verdicts
```

Then re-run the `sei_crosswalk` ingestion step. **Both** files matter:
without sql/66 the usage loads and shows, but the one number that makes
it worth having — how much of the open backlog sits on unread fields —
cannot be computed, and the screen says so rather than guessing. No new environment
variable — the sheets are found inside the workbook `CP_SEI_XLSX` already
points at.

| Sheet | Table | Rows |
|---|---|---|
| `STAR_FIELD_USAGE_MATRIX` | `star_field_usage` | one per (family, field) |
| `STAR_FIELD_USAGE_SUMMARY` | `star_field_usage_summary` | one per family |
| `STAR_FIELD_USAGE_RECON` | `star_field_usage_recon` | one per disagreement |

Check it with `GET /sei-crosswalk/star-usage/health`, or the commented
queries at the foot of `sql/65`.

## Three decisions worth knowing

**The summary is stored as declared, not recomputed.** It carries three
counts the matrix has no rows for — `CATALOG_LAYOUT_FIELDS`,
`MATRIX_MATCHED_LAYOUT_FIELDS` and `MATRIX_UNMATCHED_LAYOUT_FIELDS`
(matched + unmatched = published, asserted per family in the tests) — — the layout side — and they do not
always agree with it: one family shows 0 fields in the matrix against 42
on the layout side, another 73 against 74. That disagreement is the
finding, which is why the workbook also ships a reconciliation sheet.
Recomputing the summary from the matrix would erase it. The API returns
both the declared and the counted figure and the screen shows them side
by side.

**The percentage is derived, not read.** `Sheet.get()` stringifies every
cell, so Excel's `0.071`, the text `"98.6%"` and a bare `72.7` are
indistinguishable by type — and `1` is 1% or 100% with nothing in the
value to say which. `used / total` has no such ambiguity, so that is what
is stored. The declared cell is still compared against it and a
disagreement beyond rounding is logged.

**An unrecognised usage word stays unrecognised.** `is_used` is `Y`, `N`
or `NULL`. Folding something the workbook spelled unexpectedly into "not
used" would turn a typo into a field that looks out of scope. `NULL` is
its own bucket on the screen, labelled *Not stated*.

## It changes no verdict

Usage is evidence. A field nobody reads today is still a field the
contract publishes, and whether that puts it out of scope is a decision
about the contract — not something a join should make. So **Field usage**
is its own tab on the SEI crosswalk dashboard rather than a badge beside
a verdict, and nothing is subtracted from the denominator.

## The number this is for

*How many open crosswalk items are fields nobody reads?* That is the part
of the backlog that may not be work at all, and it is now answered —
`GET /sei-crosswalk/star-usage/coverage`, and the band across the top of
the Field usage tab.

`sql/66` adds `CONTRACT_KEY` and `CONTRACT_FIELD_KEY` to `SEI_VERIFY`,
written by the loader with `_usage_key` — **the same function that writes
`NORMALIZED_KEY` on the usage rows**. There is deliberately no `UPDATE`
in that file: an UPDATE would be a second implementation of the rule, in
SQL, and a join that silently stops matching does not raise. It returns a
smaller number, and a smaller number here reads as good news.

**It is a ladder, and it says which rung answered.** `CONTRACT_FEED` is
sometimes the bare family and sometimes a longer label, so the
family-qualified key is tried first and the field name alone second. A
match on the weaker key is still a match — but it is right only if no two
families share a field name, so `matched_on` is in the payload and the
caveat is on the screen.

**Three outcomes that all produce a number** and must not be confused:

| | |
|---|---|
| matched, strong key | `matched_on: "feed_and_field"` |
| matched, weak key | `matched_on: "field_only"`, with the caveat |
| never keyed | `null`, **not** 0 — run sql/66 and re-ingest |

The last one matters most: "nothing matched" and "the key was never
written" produce the same count and mean opposite things.

## It is still not subtracted

The number is **sized here and decided elsewhere**. These are published
contract fields; to take them out of scope, record a **disposition**
against them and the denominator follows — through the mechanism that
already exists for scope decisions, with an owner and a date against it.
Nothing on this screen moves a column out of the denominator on its own.

## Two normalisations, both stored

The matrix ships `NORMALIZED_KEY` — the workbook's own key, shaped
`FAMILY|FIELDNOSPACES` (`ACDDIFI1|ENTITYNUMBER`). That is **not** the rule
the rest of the crosswalk uses: `_norm_code` folds separators to
underscores, so the same field is `ENTITY_NUMBER` to us.

Both are stored, because each answers a question the other cannot. Ours
joins `STAR_LAYOUT_FIELD` and everything else the loader wrote.
Theirs reproduces the reconciliation sheet, which was computed with it.
Deriving one from the other would be a guess about which rule a given
row was matched under.

`/star-usage/coverage` returns our count of unmatched layout fields and
the workbook's own (`MATRIX_UNMATCHED_LAYOUT_FIELDS`) side by side. A
difference between them is the two rules disagreeing about what counts as
the same field name — worth knowing before trusting either.

## The blank-cell caveat is carried, not hidden

Every matrix row carries `NOTES`: *"Blank Used/Unused value interpreted as
Unused."* That is a **reading of the evidence, not the evidence** — an
Unused that came from an empty cell is weaker than one that came from the
word "Unused". It is stored per row and shown once above the drill-down
list, because somebody about to drop 90 fields on the strength of it
should see it.

## Headers came from screenshots first

The first version of this parser was written from photographs of the
sheets, and several headers were cut off by the column width — the
summary's last columns were visible only as `ELDS`. The delivered headers
have since replaced the guesses (`CATALOG_LAYOUT_FIELDS`,
`MATRIX_MATCHED_LAYOUT_FIELDS`, `MATRIX_UNMATCHED_LAYOUT_FIELDS`), and the
old guesses are kept as aliases.

The guard built for that stays, because it is worth having anyway — the
parser **logs any column in the sheet that nothing read**:

```
star_field_usage_summary: sheet has column(s) nothing reads: COVERAGEPCT.
If one of these matters, add it to the parser.
```

Watch for that line on the first load. A column read under the wrong name
is bad; one silently dropped is worse, because the load succeeds and the
number is just quietly missing.

## Tests

```
python ingestion/test/test_star_field_usage.py   # the three parsers
python api/test/test_star_usage.py               # the five endpoints
```


---

## On the Mapping & divergence grid

The drill list (**Lineage → Technical view → Mapping & divergence → a
feed**) now carries a **Usage** column and an **Export to Excel** button.

### The join needed one more step than expected

`SEI_VERIFY.CONTRACT_FIELD` carries a **positional suffix** that the usage
matrix does not: `Base_Market_Value_10`, `Trade_Date_128`,
`Local_Accrued_Interest_134`. Measured against the delivered rows:

| | |
|---|---|
| contract-field parts matching **as written** | **0 of 19** |
| matching once the trailing `_<digits>` is removed | **19 of 19** |

Without that strip the column would be blank on every row — which reads as
*"no usage data"* rather than *"the key did not line up"*.

The strip is a **heuristic**, so the exact match is tried first: a field
that genuinely ends in a number (`Level_2`) matches as written and is not
truncated into a different field. Each row records which rung answered,
shown on hover.

### Five states, because a composite has no yes/no answer

A warehouse column is often fed by several contract fields, comma joined
(`Base_Market_Value_10,Trade_Date_Cash_136`).

| Value | Means |
|---|---|
| `used` | every contract field behind it is read |
| `unused` | none of them is |
| **`mixed`** | **some are and some are not** — dropping this column loses something somebody reads |
| `partial` | at least one contract field had no usage row at all |
| `unknown` | the usage word was one nothing recognised |
| *blank* | nothing matched |

`mixed` is the one that earns its place. Folding it into "unused" is the
mistake this column exists to prevent.

The grid header reports how the join went (`usage: 41 of 53 matched`), and
when nothing is loaded it says so rather than leaving cells blank — *"no
usage column"* and *"usage not loaded"* look identical in the cells and
are different problems.

### Export

`GET /sei-crosswalk/columns.xlsx` — the same filters as the grid.

* **The whole filtered set, not the page.** The screen fetches 500 rows
  because that is what a person scrolls; the export defaults to 20,000. An
  export that silently stopped at 500 would be worse than none, because
  the file looks complete.
* **Two sheets.** `Columns` is the grid with the usage column and how each
  row was matched, frozen header and autofilter on. `About` records when
  it was taken, from which lane, under which filters, how many rows got a
  usage answer, and what each usage value means. A spreadsheet that leaves
  its own origin behind becomes a number nobody can defend.
* **Everything is written as text** except the one genuine number
  (`sei_datapoint_count`). Excel turning a contract field into a date is a
  classic way to lose data between two people.
* It is a link, not a fetch, so the browser does the download and a
  20,000-row workbook never sits in a JavaScript string.

Needs `openpyxl` on the API host — already in `requirements.txt`. If it is
missing the endpoint returns 501 saying so, rather than a 500.
