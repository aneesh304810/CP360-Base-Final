# AddVantage User-Defined fields: analysis before the build

Status: analysis from the specification, the profiling figures it quotes, and
what the repository already knows. The three source files were not in the
session, so nothing below has been run against them. Every figure is the one
quoted in the brief; every claim that needs the data says so.

## 1. The lineage question first

The observation that started this ("mostly all the UD fields land to one
table, DIM_ACCOUNT_UD") is correct, and it is a property of AddVantage, not a
defect in the lineage.

AddVantage attaches user-defined fields to an entity, not to a table. The
`List` sheet counts 224 UD fields on `1=ACCOUNTMASTER`, 13 on one other
entity, 0 on the rest. Every one of the 224 is delivered to the warehouse
inside ONE column, `DIM_ACCOUNT_UD.USER_DEFINED_ATTRIBUTE_CLOB`, as a JSON
object keyed `UD_<n>` or `UD_<n>_<seq>`. So 224 source fields collapse into
one target column, and column-level lineage stops at the CLOB.

The repository already models the edge of this:

| What exists | Where | What it gives us |
|---|---|---|
| CLOB registered as `JSON_OBJECT_UD_ATTRIBUTES`, parser `json_parser`, sensitivity `ATTRIBUTE_PAYLOAD_REVIEW` | `sql/33_clob_registry.sql` | the inspector knows the column is a JSON envelope and masks samples |
| Five sibling envelopes: DIM_ACCOUNT_UD, DIM_MASTER_ACCOUNT_UD, DIM_INTERESTED_PARTY_UD, DIM_IP_RELATIONSHIP_UD, DIM_SECURITY_UD (+ _HIST) | same | the entity codes on the `List` sheet map onto these tables (section 4) |
| `legacy_lineage.is_ud` / `ud_key` | `sql/26_legacy_lineage.sql` | a lineage row per exploded key, status "UD Attribute" |
| explosion of the CLOB into per-key proof and lineage rows | `ingestion/legacy_lineage_conn.py` | the screens already draw `↳ UD_7` under the CLOB column, with a UD pill |
| AddVantage master dictionary, canonical code `BI_2_1` for `BI/2-1` and `BI_2_L1` | `legacy_dictionary`, `ingestion/legacy_dictionary_conn.py` | the join key convention a UD code should follow |
| JSON key census per CLOB, first 40 keys, masked | `ingestion/clob_inspector.py profile_json` | a sample-based view, not a registry |

The gap is precise. Today's explosion is driven by whichever keys appear in
the ONE proof sample row of the lineage workbook. A key not in that row has no
lineage row. The exploded rows carry no source chain ("UD rows have no source
chain" in the loader), no data type, no parent structure, no dictionary entry
and no lookup table. The data has 284 distinct keys across 1.2 million
key/value pairs. So:

- lineage knows a handful of UD keys and treats each as a flat column;
- the business meaning of a key (household, billing line, authority) is not
  recorded anywhere the catalogue can show;
- the multiline structures (`UD_32_1..20`) appear as 20 unrelated columns.

What the framework must add is a per-key lineage INSIDE the envelope:

```
AddVantage field  ──►  entity UD slot  ──►  CLOB key  ──►  virtual column  ──►  Silver entity
(dictionary code)      ACCOUNTMASTER n       UD_n(_seq)     DIM_ACCOUNT_UD.UD_n    ACCOUNT_HOUSEHOLD …
```

with each hop evidenced, so the lineage graph can expand DIM_ACCOUNT_UD into
its keys, group them by parent and domain, and show where each one lands.

## 1a. What Datapoint 360 already shows, and what was added for it

The AddVantage master dictionary already carries the UD fields: `UD/1` to
`UD/300`, each with its name ("OWNED BY CODE" for UD/1), its masters
(Account, Interested Party, Security Issue) and the one description the
workbook gives all 300: "User-Defined Text. Up to 300 fields available."
The canonical code `UD_1` is therefore already the join key between the
dictionary, the exploded lineage rows (`ud_key`) and the CLOB key. Nothing
new is needed to find a UD field; what was missing was its meaning.

For a coded field the meaning is its value list. So the first build step,
done before the extract is loaded here, is a code dictionary:

| Piece | Where |
|---|---|
| `cp_advantage_ud_dictionary`: one row per attribute, code, source; `OBSERVED` from the extract, `TABLES` from the AddVantage lookup table; `link_status` OBSERVED / STRONGLY_INFERRED / VERIFIED | `sql/75_advantage_ud_dictionary.sql` (seeded with the seven UD_1 values) |
| loader for `code_dictionary.csv`, dropping the profiler's free-text splits (UD_32 lines, codes with spaces) | `ingestion/advantage_ud_dictionary_conn.py`, step `advantage_ud_dictionary` |
| `GET /advantage-ud/codes?attribute=UD_1` | `api/app/routers_advantage_ud.py` |
| Datapoint 360, Non-SEI pane: a "Coded field · n values observed…" line under the description and a Code values table | `ui/src/Datapoint360.jsx`, `ui/src/advantageUd.js` |

The line under the description is deliberate about provenance: values
split from the extract read "observed … not yet confirmed against an
AddVantage table", and only a `VERIFIED` link says "verified". A reader
must not take an observed split for a defined lookup.

The profiler's outputs (`attribute_detail.csv` at 343 MB, `record_schemas.csv`,
`schema_variants.csv`, `attribute_profile.csv`, `code_dictionary.csv`,
`code_conflicts.csv`, `parent_structures.csv`, `type_variance.csv`,
`run_summary.*`, `parse_errors.csv`) go under `local-data/advantage-ud/profile/`.
Only `code_dictionary.csv` is read by the loader above. `attribute_detail.csv`
is per account and must be streamed, never loaded whole, and never committed.

## 1b. The UD 360 on Datapoint 360: built, waiting for the drop

Everything below runs today against a synthetic drop shaped exactly like
the profiler's files (`api/test/_advantage_ud_fixture.py`). The real
files replace it without a code change.

| Piece | Where |
|---|---|
| Registry, parent, family, schema, conflict and run tables | `sql/76_advantage_ud_profile.sql` |
| Loader for `attribute_profile`, `type_variance`, `parent_structures`, `schema_variants`, `code_conflicts`, `run_summary` | `ingestion/advantage_ud_profile_conn.py`, step `advantage_ud_profile` |
| Classification rules, as data with a source on every decision | `ingestion/advantage_ud_rules.yaml`, `advantage_ud_rules.py` |
| `/advantage-ud/overview`, `/attribute`, `/clob-shape`, `/registry` | `api/app/routers_advantage_ud.py` |
| Overview strip (tiles, how the CLOB looks, domains, classes, families) and the detail rows (key structure, presence, values, type and variance, shape, domain and Silver with its source, block lines, conflicts) | `ui/src/AdvantageUd360.jsx`, spliced into `Datapoint360.jsx` |

What the loader decides, and records as such:

- **Family** = the set of multipart blocks a row carries, named by role
  ("household + billing instruction + authority"). Exact key sets stay in
  the schema table under their family. In the synthetic drop eight key
  sets fold into five families; the real figure is what the 12,951 become.
- **Identifier reclassification**: a key profiled `TIMESTAMP`, 10 characters
  wide, under `UD_527` or `UD_540`, is read as `IDENTIFIER`. The profile is
  kept beside the decision (`dominant_type` vs `value_class`).
- **Conflicts** inside a free-text block are `PARAMETERIZED_VALUE`,
  `FORMATTING_VARIATION` or `FREE_TEXT_FALSE_POSITIVE`; outside one,
  `TRUE_CONFLICT`.
- **Domain and Silver entity** come from the rules file and are marked
  `RULE` ("hypothesis from the brief, not yet confirmed") until the
  workbook's field type or a sample overrides them. The pane prints the
  source next to the pill.
- **Never loaded**: `sample_values`, `attribute_detail.csv`,
  `record_schemas.csv`. The pane's "how the CLOB looks" is drawn from
  shapes (class, length, mask, first code), so no value is ever shown.

Two profiler details the loader allows for: counts are written as floats
(`19.0`), and `parent_attribute` is filled for single keys as well as
lines (the loader derives the parent from the key, so a single stays a
single).

## 2. What the profiling figures already tell us

The brief quotes a profiling run. Read as evidence, before any code:

| Figure | Reading |
|---|---|
| 21,672 rows, 100% parse success, 0 parse errors | the CLOB is well-formed JSON today; the quarantine path is insurance, not a current need |
| 284 distinct keys vs 224 UD fields on ACCOUNTMASTER | the surplus is multipart sequences: one field, many `_seq` keys. 284 keys over 18 parents + singles is consistent with 224 fields |
| 18 multipart parents, sequences up to 20, gaps such as `8,9` missing | type-3 text fields (99 lines of 32 chars). Gaps mean a line was blanked, not that the schema changed. Never infer a line count from the max sequence seen |
| 12,951 schema variants over 21,672 rows | 60% of rows have a unique key set. `HASH(sorted keys)` identifies a row, not a family. Schema families must be built on presence of PARENTS and of core keys, not on the exact key set (section 6) |
| 90 attributes with type variance | mostly representation, not meaning: numeric vs text, date masks, and 10-digit account numbers read as timestamps. The reclassification rule in the brief (10 digits, no separator, looks like an account: IDENTIFIER) must run before any type is declared stable |
| 3,475 code=description pairs, 12 conflicts, all 12 inside `UD_32_*` | code=description is a reliable signal for coded fields and a false positive in free text. `UD_32` is billing narrative; `=` there is prose ("ANNUAL MIN = …"). Split only where the attribute is coded (section 5) |
| payloads from 1 key (`{"UD_613":"Y"}`) to 100+ keys | presence of a key is not presence of a fact for the account. A missing key means "not set", never "deleted" |

Two things in the brief do not reconcile and need the data:

1. **`UD_514` is a multiline block in the TRP sample (`Ud 514 1..10`) but is
   not one of the 18 multipart parents in `parent_structures.csv`.** Either
   the extract never carries `UD_514`, or it carries it under a different
   shape. The cross-source reconciliation must report it either way.
2. **Field-type 3 caps a line at 32 characters, and the brief says values are
   so capped.** `attribute_profile.max_value_length` will confirm it per
   attribute. Any attribute over 32 is not a type-3 field, which is a free
   datatype check against the dictionary.

## 3. The parse model

One key, one row, five derived columns. No value is altered.

| Key | attribute_name | attribute_number | parent_attribute | sequence_number | key_structure |
|---|---|---|---|---|---|
| `UD_14` | UD_14 | 14 | null | null | SINGLE |
| `UD_23_2` | UD_23_2 | 23 | UD_23 | 2 | MULTIPART |
| `UD_32_19` | UD_32_19 | 32 | UD_32 | 19 | MULTIPART |
| anything else matching `^UD_` | as is | parsed if possible | null | null | NON_STANDARD |
| not matching `^UD_` | as is | null | null | null | NON_STANDARD, `is_ud_attribute=N` |

Rules that protect the data:

- `raw_value` is the string from the JSON, trimmed, nothing else. Leading
  zeros survive because nothing is ever cast at parse time.
- Value typing is a LABEL on the row (`value_type`), never a conversion.
  `IDENTIFIER_LEADING_ZERO` and `IDENTIFIER` stay VARCHAR for ever.
- `code_value` / `description_value` are filled only when the attribute's
  registry entry says it is coded (section 5). The parser may record that a
  value LOOKS like `code=desc`; the split is a classification decision.
- Multipart text is reconstructed by ordered concatenation of sequences for
  display only. The lines are the record. `ACCOUNT_BILLING_INSTRUCTION` keeps
  `line_number` and `instruction_text`; it never becomes 20 columns.

## 4. Where the metadata comes from, in precedence order

1. **The AddVantage UD workbook.** `List` gives entity ownership and the
   field-type code per UD; `Tables` gives every lookup table's codes and
   descriptions. This is the authority for meaning, type and lookup.
2. **The TRP multiline samples.** Business usage of `UD_23`, `UD_32`,
   `UD_506`, `UD_514`. Validation only, never a load source.
3. **Profiling.** Presence, type stability, lookup overlap.
4. **Value-pattern inference.** Last, and always labelled as inference.

Entity code to warehouse table, by name only, to be confirmed on the data:

| List entity | Likely envelope | Basis |
|---|---|---|
| 1 = ACCOUNTMASTER (224 fields) | DIM_ACCOUNT_UD | name, and the extract |
| 34 = MASTERACCOUNT | DIM_MASTER_ACCOUNT_UD | name |
| 3 = PARTY | DIM_INTERESTED_PARTY_UD | name |
| 5 = BENEFICIARYPARTY, 17 = CUSTODIAN | unknown | no table of that name is registered |

**The missing link is UD number to lookup table.** The brief says it is not
known whether the workbook carries it. The discovery step must look for a
sheet that does. If none exists, the link is derived: for each coded attribute
take its observed `code_value` set, intersect with `Tables.Code` per
`Table Number`, score by overlap, and record the best match as
`STRONGLY_INFERRED`. Never `VERIFIED` without a sheet or a person saying so.
The examples in the brief already suggest `UD_14` ("TE=TAX EXEMPT") pairs
with table 714 "TAX AND TAX EXEMPT"; that is exactly the kind of match the
scoring will surface, and exactly the kind that still needs a confirmation.

## 5. Classification: one decision per attribute, evidenced

For each of the 284 attributes the registry records one `value_class`, one
`domain`, one `silver_entity`, and the evidence that chose them. The order of
tests matters, because the later tests produce false positives on the
earlier cases:

1. Dictionary says Table (type 6): `CODE_DESCRIPTION`, split on first `=`,
   join to its lookup table. Conflicts are real conflicts.
2. Dictionary says Yes/No (type 2): `BOOLEAN_FLAG`; accept Y/N only, anything
   else is a quality finding.
3. Dictionary says Date (type 1): `DATE`, keep the string, record the mask.
   Mixed masks (`MM/DD/YYYY|DD/MM/YYYY`) stay ambiguous until a sample proves
   one.
4. Dictionary says Money (type 4): `CURRENCY`, string kept, decimal parsed
   into a second column.
5. Dictionary says Text (type 3), multipart: `TEXT` lines. `=` inside is
   prose. Code conflicts here are `FREE_TEXT_FALSE_POSITIVE`,
   `PARAMETERIZED_VALUE` ("ANNUAL MIN = amount") or `FORMATTING_VARIATION`.
6. No dictionary entry: profiling decides, and the registry says
   `INFERRED`. Ten digits with no separator and a leading-zero history is an
   `IDENTIFIER`, never a timestamp.

Domains and Silver entities, as a starting hypothesis from the brief, each to
be confirmed by the dictionary row:

| Attributes | Domain | Silver entity | Shape |
|---|---|---|---|
| UD_1, UD_2, UD_7 | ACCOUNT_CLASSIFICATION | ACCOUNT_CLASSIFICATION | coded |
| UD_14 | TAX | ACCOUNT_TAX_STATUS | coded, table 714 likely |
| UD_23_* | HOUSEHOLD | ACCOUNT_HOUSEHOLD | id, name, code, display name across sequences |
| UD_26, UD_31, UD_46, UD_80 | to classify | to classify | gold candidates, meaning unknown here |
| UD_32_* | BILLING | ACCOUNT_BILLING (lines) | narrative, 32-char lines |
| UD_51, UD_52 | IPS | ACCOUNT_IPS | per brief |
| UD_503 | AUTHORITY | ACCOUNT_AUTHORITY | coded: S=SINGLY, J=JOINTLY, … |
| UD_506_* | AUTHORITY | ACCOUNT_AUTHORITY (roles) | trustee, signer, executor, POA |
| UD_507, UD_534 | to classify | to classify | gold candidates |
| UD_514_* | to classify | to classify | TRP only so far |
| everything else | UNKNOWN until the dictionary row is read | | |

`ACCOUNT_COMPLIANCE`, `ACCOUNT_FIDUCIARY` and `ACCOUNT_STATUS` have no
attribute assigned yet by any evidence in hand; the `Rubal Notes` column
("Client AML Risk and Politically exposed Client") is the lead for
COMPLIANCE.

## 6. Schema families, and why signatures alone fail

With 12,951 distinct key sets, a family must be coarser than a key set. The
proposal, to be checked against `schema_variants.csv`:

- **Core keys**: attributes present in more than a threshold of rows (the
  `record_presence_pct` column). They define the "base account".
- **Parent presence**: which of the 18 parents appear, regardless of how many
  sequences. `UD_32` present means "has billing instructions", whether 3 or
  20 lines.
- **Family signature** = `HASH(sorted(core keys ∪ parents present))`.

That is expected to collapse 12,951 variants into a few dozen families, each
with a name a person recognises ("household + billing + authority"). The exact
key set and the typed signature are still stored per row in
`cp_advantage_ud_schema`, for drift detection: a new exact signature is a
warning, a new FAMILY is a finding, an unknown key is registered and the row
loads.

## 7. Target tables, and how they attach to CP360

The six tables in the brief, plus the one the brief's `List` sheet needs:

| Table | Grain | Attaches to |
|---|---|---|
| cp_advantage_ud_raw | one row per source row | `ACCOUNT_UD_KEY` surrogate, batch id as VARCHAR(30) |
| cp_advantage_ud_attribute | one row per source row per key | raw table; registry by attribute_name |
| cp_advantage_ud_registry | one row per attribute | `legacy_dictionary` by canonical code; `legacy_lineage` by `(dwh_target_table, ud_key)` |
| cp_advantage_ud_dictionary | one row per table, code | the `Tables` sheet; table 5 flagged PII/HR |
| cp_advantage_ud_field_type | one row per type code (1,2,3,4,6) | the `List` sheet |
| cp_advantage_ud_schema | one row per source row | exact, typed and family signatures |
| cp_advantage_ud_quarantine | one row per rejected source row | headers always written |

The registry is the lineage join. Once it exists, `legacy_lineage` rows with
`is_ud='Y'` can be synthesised from the REGISTRY instead of from the proof
sample, one per attribute, with the dictionary code as the source column.
That is the single change that turns "all UD fields land on one table" into a
navigable per-field lineage, and it is a loader change on the catalogue side,
not a change to `legacy_lineage_conn.py`.

## 8. Gold candidates: nothing promotes yet

The thirteen candidates (UD_1, 2, 7, 14, 26, 31, 46, 51, 52, 80, 503, 507,
534) each need four gates: meaning validated, datatype stable, owner known,
lookup understood. From the evidence in hand:

| Gate | Can be answered from | Status today |
|---|---|---|
| meaning validated | dictionary row + TRP usage | not readable here |
| datatype stable | `type_variance.csv`, after the identifier reclassification | not readable here |
| business owner | nobody in any file; needs a person | open for all 13 |
| lookup understood | `Tables` join + overlap score | not readable here |

So the honest output of the first run is a scored table with every row at
`NOT_YET`, each gate carrying its evidence or its blocker. Promotion is a
decision someone signs, not a threshold the pipeline crosses.

## 9. What the UI would show, once the data is in

Kept short on purpose, since the build waits on the analysis:

- On DIM_ACCOUNT_UD in the lineage graph: an expander that opens the envelope
  into its parents and singles, grouped by domain, each key a node with its
  dictionary name, type, presence, and a `VERIFIED` / `STRONGLY_INFERRED` /
  `INFERRED` evidence pill.
- Per attribute: the lineage strip (field code → UD slot → key → virtual
  column → Silver entity), the lookup table where there is one, type
  stability, and the gold gates.
- Per family: which accounts look alike, as counts only.
- Nothing shows a value. Samples are masked by the registry's sensitivity
  hint, which is already `ATTRIBUTE_PAYLOAD_REVIEW` for this column.

## 10. Open questions

1. Does any sheet in the UD workbook map UD number to lookup table? This
   decides whether links are `VERIFIED` or `STRONGLY_INFERRED`.
2. Why is `UD_514` multiline in TRP and absent from the 18 parents in the
   extract?
3. Which entity codes 5 (BENEFICIARYPARTY) and 17 (CUSTODIAN) land in,
   if anywhere, in the warehouse.
4. `LOAD_TYPE = EOD`: full snapshot or partial? Decides whether a missing key
   on a later batch is "unchanged" or "unknown". Until answered: never a
   deletion.
5. `ACTIVE_IND` is blank in every observed row. Is it unused, or not yet
   populated?
6. Who owns each of the 13 gold candidates.

## 11. What I need from you, in order of value

1. **The profiler outputs**, into `local-data/advantage-ud/profile/`. The
   six the loader reads are small: `attribute_profile.csv`,
   `type_variance.csv`, `parent_structures.csv`, `schema_variants.csv`,
   `code_conflicts.csv`, `run_summary.csv`. `attribute_detail.csv` and
   `record_schemas.csv` are not needed. If pasting into chat is the only
   route, drop the `sample_values` column first: it carries names.
2. **The UD workbook's sheet list** and, if one exists, the sheet that maps
   a UD number to a lookup table. This alone decides whether every coded
   field is `VERIFIED` or `STRONGLY_INFERRED`. Then the `Tables` and `List`
   sheets as CSV.
3. **`profile_ud_clob.py` itself**, into `tools/`, so the run is
   reproducible from the repository. The copy pasted into chat lost its
   indentation.
4. **One redacted CLOB**, if you want the example on the pane to be a real
   shape rather than a synthetic one: any row with every value replaced by
   its length or a mask. Not required.
5. **Answers to section 10**, especially `LOAD_TYPE` semantics and who owns
   the thirteen gold candidates.
6. **Not `dataVar.csv`.** The profile is enough for the catalogue; the
   extract is 21,672 accounts and does not belong in a chat or a repo.

## 12. What to run once the files are in

1. Drop the files as above.
2. `sql/75` and `sql/76` once.
3. `python -m ingestion.run advantage_ud_profile advantage_ud_dictionary`.
4. Open Datapoint 360 → Non-SEI → AddVantage. The strip appears above the
   list; a UD field's pane carries the extra rows.
5. Discovery of the two workbooks into `docs/advantage_ud/source_inventory.md`
   is the step after that, and it answers item 2 if the sheet exists.


1. Drop the three files in `local-data/advantage-ud/` (gitignored; see its
   README). They carry account numbers, household names and employee names
   and must never be committed.
2. Discovery: list every sheet, header row, column count and row count of
   both workbooks, and the CSV header, into
   `docs/advantage_ud/source_inventory.md`. Any column the brief does not
   describe is recorded `UNDOCUMENTED`, not guessed. This step also answers
   open question 1.
3. Only then the registry, dictionary and classification, in that order,
   because each later step reads the earlier one's output.

Generated outputs under `docs/advantage_ud/` hold structure, counts and
metadata only. No account number, household, person, batch id or sample value
that could identify one.
