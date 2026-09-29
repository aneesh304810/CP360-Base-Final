# SEI crosswalk — merge the code, then ingest

**This supersedes `COPY-AND-INSTALL.md` and `INSTALL.md`.** One page, in order.

Everything is on branch `claude/column-lineage-graph`, commits `c5cc8b2`
through `66d6baf`. Fifteen files: **nine new, three edited, three documents.**

---

## PART 1 — MERGE THE CODE

Pick the path that matches how your enterprise repo relates to this one.

### Path A — the repos share history

```bash
git fetch origin claude/column-lineage-graph
git checkout -b sei-crosswalk origin/claude/column-lineage-graph
# review, then merge into your integration branch
```

Or take only the feature commits, skipping the documentation-only ones:

```bash
git cherry-pick c5cc8b2 d436a99          # code + schema
git cherry-pick 94e8d81 7ef8b34 b62b219 66d6baf   # docs, optional
```

`c5cc8b2` and `d436a99` are the two that carry code. The rest are documents.

### Path B — separate repos, no shared history

A patch file is committed at `docs/sei-crosswalk/sei-crosswalk.patch`:

```bash
git apply --check docs/sei-crosswalk/sei-crosswalk.patch   # dry run first
git apply --3way  docs/sei-crosswalk/sei-crosswalk.patch
```

`--check` tells you whether the three edited files will conflict before
anything is written. `--3way` leaves conflict markers instead of failing
outright if they do.

### Path C — manual, if the patch conflicts

**Copy these whole. No file of these names exists in your repo, so there is
nothing to lose.**

```
sql/51_sei_crosswalk.sql
sql/52_sei_crosswalk_attach.sql
sql/53_sei_catalog.sql
sql/54_sei_widen.sql
sql/55_lineage_lane.sql
sql/56_transformations.sql
sql/57_widen_v3.sql
sql/58_feed_names.sql
sql/59_transformation_review.sql
ingestion/lane_lineage_conn.py
api/app/routers_sei_crosswalk.py
ui/src/seiCrosswalkApi.js
ui/src/CrosswalkDashboard.jsx
ui/src/CrosswalkFlow.jsx
ui/src/laneMeta.js
ui/src/crosswalkGlossary.js
ui/src/feedNames.js
ui/src/ChainRules.jsx
ui/src/ruleParse.js
ui/src/ruleGraph.js
ui/src/dagLayout.js
ui/src/OperatorGraph.jsx
ui/src/SourceCanvas.jsx
ui/src/linkOps.js
docs/sei-crosswalk/MERGE-AND-INGEST.md
docs/sei-crosswalk/TAG-REFERENCE.md
docs/sei-crosswalk/gen-tag-reference.mjs
docs/sei-crosswalk/validate-crosswalk.sql
docs/ingestion-prompts/PROMPT_VALIDATE_INGESTED_CROSSWALK.md
ui/test/  (run.mjs + twelve .test.jsx — `npm test` in ui/)
api/test/test_graph_chain.py
api/test/test_source_canvas_scope.py
api/test/test_lane_scope_filter.py
ingestion/test/test_table_catalog.py
api/app/routers_business_catalog.py
ui/src/businessCatalog.js
ui/src/plainRule.js
ui/src/SeiBusinessSummary.jsx
ui/test/business-catalog.test.jsx
ui/test/plain-rule.test.jsx
ui/test/sei-business.test.jsx
api/test/test_business_summary.py
ingestion/test/test_lane_lineage_parse.py
docs/ingestion-prompts/PROMPT_IMDS_STAR_UAF_SEI_data_lineage.md
docs/ingestion-prompts/PROMPT_PBDW_ADDVANTAGE_SEI_crosswalk.md
```

**Hand-apply the edits in these. They already exist in your repo and a whole-
file copy would clobber work that is not mine.**

```
api/app/main.py             two entries in the router mount tuple
ui/src/BizLineage.jsx       business names on the table list, header and crumb
ui/src/CrosswalkDashboard.jsx  the Business/Detail toggle + SeiBusinessSummary mount
ingestion/run.py            one STEPS entry + one dispatch branch
ui/src/LineageHome.jsx      CrosswalkDashboard, UAF in SYS_META, dsSystems, dictSys
ui/src/LineageGraph.jsx     dim floors, empty-lane collapse, stage colour on nodes
ui/src/LegacyLineage.jsx    DictionaryMiss replaces the AddVantage-only message
ui/src/SourceLineage.jsx    stageMeta, lane filter, dictSystem, SourceCanvas
ui/src/BizLineage.jsx       stageMeta, lane filter, dictSystem
api/app/routers_legacy_source.py   /source-fields `system` made optional
```

**Do NOT copy these three — hand-apply the edit.** Your copies are likely
ahead of this branch, and overwriting reverts your work.

**`api/app/main.py`** — one entry in the router mount tuple:

```python
             "routers_event360",
             "routers_sei_crosswalk"):
```

**`ingestion/run.py`** — one entry in `STEPS`:

```python
    "sei_crosswalk",     # IMDS/STAR/UAF/SEI crosswalk workbook
```

and one branch in `_run_step`:

```python
    if step == "sei_crosswalk":
        from .lane_lineage_conn import SeiCrosswalkConnector
        c = SeiCrosswalkConnector.from_env()
        n = c.load(loader, c.parse())
        log.info("sei_crosswalk: merged %s rows", n)
        return
```

**`ui/src/LineageHome.jsx`** — one import, and swap the SEI placeholder:

```jsx
import CrosswalkDashboard from "./CrosswalkDashboard.jsx";
```

Find the `scope === "sei"` ternary — the panel reading *"SEI lineage —
arriving with the SWP program"* — and replace the placeholder `<div>` with:

```jsx
    <CrosswalkDashboard t={t} dataSource={ds} onOpenTechnical={openTechnical} />
```

Leave the ternary itself alone. `ds` and `openTechnical` are already in scope.
If your file has diverged past recognition, the only requirement is that
`scope === "sei"` renders that component instead of the placeholder.

**`ingestion/legacy_lineage_conn.py` is in none of these lists. It is not
touched and must not be** — the copy in this repository is older than the copy
running in some environments.

### Confirm the merge

```bash
python -m py_compile ingestion/lane_lineage_conn.py api/app/routers_sei_crosswalk.py
cd ui && ./node_modules/.bin/esbuild src/CrosswalkDashboard.jsx src/seiCrosswalkApi.js \
         src/LineageHome.jsx --outdir=/tmp/chk
```

Both must be silent. (A full `npm run build` will fail on `DocDrill.jsx`
importing `mermaid`, which is absent from `package.json` — pre-existing on a
clean checkout of this branch, verified by building with every one of these
changes stashed.)

---

## PART 2 — SCHEMA

```bash
sqlplus $CP_DB_USER/$CP_DB_PASS@$CP_DB_DSN @sql/51_sei_crosswalk.sql
sqlplus $CP_DB_USER/$CP_DB_PASS@$CP_DB_DSN @sql/52_sei_crosswalk_attach.sql
sqlplus $CP_DB_USER/$CP_DB_PASS@$CP_DB_DSN @sql/53_sei_catalog.sql
sqlplus $CP_DB_USER/$CP_DB_PASS@$CP_DB_DSN @sql/54_sei_widen.sql
sqlplus $CP_DB_USER/$CP_DB_PASS@$CP_DB_DSN @sql/55_lineage_lane.sql
sql/56_transformations.sql
sql/57_widen_v3.sql
sql/58_feed_names.sql
sql/59_transformation_review.sql
```

Run them in order. All idempotent — `CREATE` swallows ORA-955, `ALTER`
swallows ORA-1430, and `54` swallows ORA-942/904/1441 per column. **Fourteen
new tables; no existing table is altered.**

- `53` adds the four tables the SEI catalogue sheets need. Skipping it is
  what produced the ORA-00942 storm on the first real load.
- `54` widens 19 columns whose real values overflowed the first guess
  (ORA-12899). It truncates nothing.
- `56` adds the nine tables the 24-sheet "With-Transformations" workbook
  needs, and gives `SEI_DISPOSITION` a `DATA_SOURCE` column — that sheet
  lost its `LANE_ID`, and every disposition query scoped by lane, so
  without it the undecided count reads zero. It also drops the disposition
  check constraint, because the workbook now uses GENERATE, RETAIN and
  DEFER as well as the original five.
- `57` widens the two columns the first 24-sheet load rejected rows on
  (`SEI_INPUT_LINEAGE.CODE_SET_NAME`, `STAR_UPLOADER_JOB.PRE_PROCESS`),
  adds `ACCEPTABLE_VALUES` its own column, and pre-emptively widens the
  free-text columns that hold paragraphs rather than phrases. Re-ingest
  after it: the 15 rejected rows only come back on a reload.
- `58` adds `FEED_ALIAS` and seeds it from the STAR daily delivery folder,
  so a feed shows as "Portfolio Valuation · PEDDIFI1" rather than as one of
  three cards all headed "STAR outbound dataset". Renaming a feed is an
  UPDATE to this table, not a UI release. No re-ingest needed.
- `59` adds `SEI_XFORM_REVIEW` and its log — a reviewer's decision on
  whether the proposed SEI transformation is correct. **Not purged by the
  loader**, deliberately: these are people's decisions, and a workbook
  reload must not delete them. The loader's purge list does not name
  either table.
- `55` adds `LEGACY_LINEAGE_LANE`. **Without it the STAR/UAF badge filters
  nothing** — both lanes live in `LEGACY_LINEAGE` under one `DATA_SOURCE`
  with no column telling them apart, so selecting UAF relabelled the spine
  and left the same files on screen. It needs a re-ingest to populate.

```sql
SELECT COUNT(*) FROM user_tables WHERE table_name IN
 ('LEGACY_LANE','LEGACY_SRC_COLUMN','SEI_SOURCE_MAP','SEI_VERIFY','SEI_CODE_SET',
  'SEI_IDENTIFIER_XWALK','SEI_DISPOSITION','SEI_DUAL_SOURCE','SEI_EXCEPTION');
-- 9
```

Restart the API and confirm in the log: `mounted routers_sei_crosswalk`.

```bash
curl -s "$API/sei-crosswalk/summary?data_source=IMDS"
```

Zeros before ingestion is correct — that is what makes the dashboard
self-hide, and why PBDW's screens are unchanged.

---

## PART 3 — INGEST

### Before you start: which warehouse has a baseline?

```sql
SELECT data_source, COUNT(*) FROM legacy_lineage GROUP BY data_source;
```

The answer decides the mode, and the mode is the only thing that can do
damage. **Set it explicitly. Never rely on `auto`.**

| Warehouse | Baseline in `legacy_lineage`? | Mode |
|---|---|---|
| IMDS | no — STAR was never loaded | **`load`** — the workbook supplies it |
| PBDW | yes — ~1,180 AddVantage rows | **`attach`** — SEI side only |

### IMDS

The crosswalk workbook **is** the IMDS lineage document: its `LANE_LINEAGE`
sheet mirrors `LEGACY_LINEAGE` column for column, every lane including UAF.

```bash
export CP_SEI_XLSX=/path/to/IMDS_STAR_UAF_SEI_Data_Lineage.xlsx
export CP_SEI_DATA_SOURCE=IMDS
export CP_SEI_LINEAGE_MODE=load
python -m ingestion.run sei_crosswalk
```

Expect a log line per sheet, then `merged N rows`. `lineage=0` means the sheet
parsed but no row had both a target table and column — check the header row.

### PBDW, when its workbook exists

Generate it with `docs/ingestion-prompts/PROMPT_PBDW_ADDVANTAGE_SEI_crosswalk.md`.
That prompt needs two SQL extracts attached; both queries are in its INPUTS
section. Without them the model invents AddVantage field codes and nothing
joins.

```bash
export CP_SEI_XLSX=/path/to/PBDW_ADDVANTAGE_SEI_Crosswalk.xlsx
export CP_SEI_DATA_SOURCE=PBDW
export CP_SEI_LINEAGE_MODE=attach
python -m ingestion.run sei_crosswalk
```

In `attach` mode the connector writes neither `legacy_lineage` nor
`legacy_source_file`, and purges neither even with `CP_SEI_RELOAD=1`.

### Re-running after editing a workbook

```bash
export CP_SEI_RELOAD=1
```

`loader._merge` upserts and never deletes, so without this a row removed from
the workbook survives and every coverage figure is wrong afterwards. The purge
is scoped to `(data_source, source_system)`.

---

## PART 4 — VERIFY

```sql
-- 1. PBDW's baseline is untouched. Compare to the count you took in Part 3.
SELECT data_source, COUNT(*) FROM legacy_lineage GROUP BY data_source;

-- 2. The verdict spread. PROVEN_MATCH is expected to be 0 until live DDL lands.
SELECT match_verdict, COUNT(*) FROM sei_verify
WHERE  data_source = 'IMDS' GROUP BY match_verdict ORDER BY 2 DESC;

-- 3. No duplicated baseline. Fan-in across lanes is legitimate; the same
--    chain twice is not. Any row returned means two loaders wrote the lineage.
SELECT dwh_target_table, dwh_target_column, COUNT(*) AS rows_
FROM   legacy_lineage WHERE data_source = 'IMDS'
GROUP  BY dwh_target_table, dwh_target_column
HAVING COUNT(*) > COUNT(DISTINCT NVL(src_source_table,'~')||'|'||
                                 NVL(src_source_column,'~'));

-- 4. Every lane, and whether it counts toward readiness
SELECT lane_id, replacement_state, contract_name FROM legacy_lane;
```

On a PBDW attach run the log also ends with the number that matters most:

```
attach: all N SEI mappings resolved to an existing lineage row
attach: K of N SEI mappings point at a contract field no existing lineage
        row consumes...
```

A non-zero `K` means either net-new scope or a field code the canon rule
cannot reconcile — indistinguishable in a spreadsheet, very different
problems. The query listing them is at the foot of `sql/52`.

**Then open it: Lineage → scope chip → Scope: SEI.**

---

## PART 5 — ROLLBACK

```sql
DROP TABLE sei_exception;    DROP TABLE sei_dual_source;
DROP TABLE sei_disposition;  DROP TABLE sei_identifier_xwalk;
DROP TABLE sei_code_set;     DROP TABLE sei_verify;
DROP TABLE sei_source_map;   DROP TABLE legacy_src_column;
DROP TABLE legacy_lane;
DELETE FROM legacy_lineage     WHERE data_source = 'IMDS';
DELETE FROM legacy_source_file WHERE data_source = 'IMDS';
COMMIT;
```

Then revert the three edits and delete the nine new files. No PBDW row is
involved at any point.

---

## Parts 1 and 2 change no data

Merge the code and run the schema whenever you like — before any workbook
exists, before any decision about ingestion. Nothing is visible and nothing
moves until Part 3.
