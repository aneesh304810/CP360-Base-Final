# Prompt — validate the ingested IMDS / STAR / UAF / SEI crosswalk

Run this on your enterprise Claude **after** loading the workbook. Paste the
output of `docs/sei-crosswalk/validate-crosswalk.sql` (and, if you have them,
the API responses listed in step 2) underneath it.

What comes back is a report you can hand straight back to the build session.
It is deliberately in two halves: a fenced JSON block a machine can act on,
and prose a person can argue with.

---

## Why this exists

The workbook's own self-checks answer "is the workbook internally
consistent?". This answers a different and later question: **"is the loaded
data good enough for the screens to be worth looking at?"**

Between the two sits ingestion, which normalises feed names, canonicalises
field codes, resolves lanes and upserts on generated keys. Every one of
those steps can drop rows silently — a join that matches nothing returns an
empty panel, not an error. Three faults already reached the running app that
way: a header-case mismatch that parsed four sheets to zero rows, a feed-key
round trip that lost UAF while STAR resolved fine, and an unused bind
variable that would have reported "no code sets loaded" for a table that was
full.

So the question is not "did it load" but "did it load into the shape the
screens read".

---

## Step 1 — run the SQL

```
sqlplus user/pass@dsn @docs/sei-crosswalk/validate-crosswalk.sql > validate.txt
```

Read only; every statement is a `SELECT`. If the warehouse is not IMDS,
change the `DEFINE DS` line at the top.

`ORA-00942` on a section is **not a failure to work around** — it means that
table is absent, which is a finding. Keep it in the output.

## Step 2 — optional but much better: the API's own answers

These are literally what the screens receive, so a disagreement between them
and the SQL is the most useful single signal in this whole exercise.

```bash
B=http://localhost:8000/api/sei-crosswalk ; D=IMDS
for e in summary lane-systems lanes flow evidence waffle divergence \
         readiness exceptions catalog; do
  echo "### $e"; curl -s "$B/$e?data_source=$D"; echo
done > api.json
for s in STAR UAF; do
  echo "### lane-scope $s"; curl -s "$B/lane-scope?system=$s&data_source=$D"; echo
done >> api.json
```

## Step 3 — paste this prompt, then `validate.txt`, then `api.json`

---

# PROMPT — copy everything below this line

You are auditing the **loaded** state of a data-lineage crosswalk, not a
document. I will paste the output of a read-only SQL validation script, and
possibly a set of JSON API responses. Both describe an Oracle schema holding
the IMDS warehouse's lineage and its SEI replacement crosswalk.

## What the data is supposed to be

A **lane** is `incumbent source system → target warehouse`. IMDS is fed by
two: `STAR_IMDS` (being replaced by SEI, `REPLACEMENT_STATE = REPLACED`) and
`UAF_IMDS` (not being replaced, `NOT_REPLACED`). SEI does not run parallel to
the incumbent; it lands in the incumbent's compatibility contract and the
existing pipeline carries it from there.

Tables, and what each holds:

| Table | Grain | Read by |
|---|---|---|
| `LEGACY_LINEAGE` | one row per (target column × source) | every lineage screen |
| `LEGACY_LINEAGE_LANE` | one row per lineage row, giving its lane | the STAR/UAF filter |
| `LEGACY_SOURCE_FILE` | one row per incumbent feed | the source-system badges |
| `LEGACY_SRC_COLUMN` | the contract field's own type metadata | the format check |
| `LEGACY_LANE` | the lane register | the readiness denominator |
| `SEI_VERIFY` | **one row per final column** — the verdict | every crosswalk screen |
| `SEI_SOURCE_MAP` | one row per (contract field × SEI datapoint) | the ribbon diagram |
| `SEI_CODE_SET` | one row per code value (global, no `DATA_SOURCE`) | decode readiness |
| `SEI_IDENTIFIER_XWALK` | one row per entity (global) | identifier readiness |
| `SEI_DISPOSITION` | what happens to a gap | the `NO_SOURCE` follow-through |
| `SEI_DUAL_SOURCE` | columns written by two lanes | the divergence panel |
| `SEI_EXCEPTION` | raised issues with an owner | the exceptions panel |
| `SEI_FEED`, `SEI_INPUT_LINEAGE`, `SEI_CATALOG_VERIFY`, `UAF_FIELD_SCHEMA` | SEI's own catalogue | the catalogue panel |

## The controlled vocabularies

Anything outside these lists is a finding — the UI renders an unknown value
as undifferentiated grey with no explanation behind it.

- **`MATCH_VERDICT`** (exactly 9): `PROVEN_MATCH` · `UNKNOWN` ·
  `DECODE_NEEDED` · `PRECISION_RISK` · `TYPE_SHIFT` · `NOT_COMPARABLE` ·
  `NO_SOURCE` · `NO_BASELINE` · `OUT_OF_SCOPE`
- **`MAP_KIND`** (6): `DIRECT` · `LOOKUP` · `DERIVED` · `COMPOSITE` ·
  `CONSTANT` · `UNAVAILABLE`
- **`EVIDENCE`** (6): `LIVE_DDL` · `COPYBOOK` · `FEED_WORKBOOK` · `DOCUMENT` ·
  `ASSUMED` · `NONE`
- **`DISPOSITION`** (5): `DEFAULT` · `DERIVE` · `DROP` · `BLOCK` · `UNDECIDED`
- **`REPLACEMENT_STATE`** (3): `REPLACED` · `NOT_REPLACED` · `SEI_NATIVE`
- **`LINEAGE_STATUS`** (3): `MAPPED` · `UNMAPPED` · `NOT_APPLICABLE`
- **`FAILED_CHECKS`** (14, pipe-separated, empty for `PROVEN_MATCH`):
  `TYPE_FAMILY` · `LENGTH` · `SCALE` · `NULLABILITY` · `CODE_SET` · `UNIT` ·
  `CURRENCY` · `SIGN` · `DATE_GRANULARITY` · `CARDINALITY` ·
  `FEED_DEPENDENCY` · `NO_TYPES_SUPPLIED` · `BYPASSES_CONTRACT` ·
  `DUAL_SOURCE`

## The rules the data must obey

1. `UNKNOWN` is never a pass. A `PROVEN_MATCH` requires **both** sides'
   evidence to be `LIVE_DDL`, `COPYBOOK` or `FEED_WORKBOOK`.
2. Every row on a `NOT_REPLACED` lane is `OUT_OF_SCOPE`. Every UAF row.
   These are **in** the lineage and **out** of the readiness denominator —
   two different exclusions, and conflating them is the classic error.
3. Every `NO_SOURCE` row needs a `SEI_DISPOSITION` row. `UNDECIDED` is a
   placeholder, not an answer.
4. A `COMPOSITE` map gets N rows sharing a `COMPOSITE_GROUP`, never one row.
5. `UNAVAILABLE` exists so an absence is a row rather than a missing row.
6. Every verify row carries a `LANE_ID`. Without it the STAR/UAF filter
   cannot see the row at all.

## What I need you to do

Work only from what I paste. **Do not invent numbers.** Where the input does
not say, write `null` in the JSON and say so in the prose. If a section is
missing from the input, list it under `missing_inputs` rather than guessing.

Assess six things, in this order:

1. **Did it load?** Which tables are empty or absent, and what does each
   absence disable on screen.
2. **Vocabulary drift.** Every value present that is not in the lists above,
   with its count and the column it is in.
3. **Join loss.** For each join in section 3 of the SQL: how many rows it
   loses, and what goes blank as a result. A join at 100% and a join at 0%
   look identical on screen — both render something — so say which.
4. **Rule violations.** Section 4, each with its count, ranked by whether it
   makes a number on screen *wrong* versus merely *incomplete*. A wrong
   number is worse than a missing one.
5. **UI gaps.** Given the shape in section 5 — how many tables, how many
   feeds, longest names, most columns in one table — what will lay out badly,
   what is too sparse to be worth a panel, and what is dense enough to need
   one it does not have. Be specific: "38 contract feeds in a three-column
   ribbon diagram is unreadable; it needs grouping or a top-N with a
   remainder bucket" is useful, "consider improving the layout" is not.
6. **Functional gaps.** What question would someone running this cutover ask
   that this data can answer and no screen currently does — and, separately,
   what they would ask that the data **cannot** answer yet, naming the
   artefact that would fix it.

## Output format

First, a single fenced `json` block, exactly this shape:

```json
{
  "data_source": "IMDS",
  "generated_from": ["sql", "api"],
  "missing_inputs": [],
  "tables": [
    {"name": "SEI_VERIFY", "rows": 0, "state": "ok|empty|absent",
     "disables": "what is blank on screen if this is empty"}
  ],
  "vocabulary_drift": [
    {"column": "SEI_VERIFY.MATCH_VERDICT", "value": "...", "n": 0,
     "expected_one_of": 9}
  ],
  "joins": [
    {"id": "J1", "join": "sei_verify.lane_id -> legacy_lane",
     "matched": 0, "lost": 0, "pct_lost": 0.0,
     "breaks": "what is blank or wrong on screen"}
  ],
  "rule_violations": [
    {"rule": 3, "description": "...", "n": 0,
     "severity": "wrong_number|incomplete|cosmetic"}
  ],
  "shape": {
    "warehouse_tables": 0, "contract_feeds": 0, "sei_feeds": 0,
    "functional_groups": 0, "max_columns_in_one_table": 0,
    "longest_table_name": 0, "longest_feed_name": 0
  },
  "verdict_spread": [{"lane": "STAR", "verdict": "NO_SOURCE", "n": 0}],
  "ui_findings": [
    {"panel": "flow|waffle|evidence|verdict_spread|divergence|readiness|exceptions|catalog|column_page|glossary",
     "finding": "what specifically will read badly, with the number that makes it so",
     "change": "the concrete change",
     "priority": "high|medium|low"}
  ],
  "functional_gaps": [
    {"question": "the question a cutover lead would ask",
     "answerable_today": true,
     "needs": "the artefact or column that would make it answerable",
     "priority": "high|medium|low"}
  ],
  "data_actions": [
    {"action": "what to fix in the workbook or the load",
     "owner": "workbook author|ingestion|warehouse DBA|SEI|feed owner",
     "unblocks": "what it turns green"}
  ]
}
```

Then, under a `## Reading` heading, at most 400 words of prose: the three
things that matter most and why, in plain sentences. No bullet-point
restatement of the JSON.

## Constraints

- **Structure, counts and metadata only.** Never reproduce account numbers,
  client names, transaction identifiers, positions, balances, credentials,
  connection strings or hostnames. Column names, table names, type names,
  feed names and code-set *values* are metadata and are in scope; the
  entities they describe are not.
- If the SQL output and the API JSON disagree about the same number, **say
  so explicitly and give both.** That disagreement is a bug in the API layer
  and is worth more than either number on its own.
- Rank by consequence, not by count. One wrong number on a summary card
  outranks two hundred missing optional descriptions.
- Do not recommend "more analysis". Name the artefact, the column or the
  person.
