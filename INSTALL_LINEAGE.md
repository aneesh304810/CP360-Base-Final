# Installing the lineage work on this branch

Branch: `claude/column-lineage-graph`

Everything here is additive. The minimum useful install is **step 1 + step 2**
(one SQL file, one ingestion step); the rest is optional and independent.

---

## 0. What is safe to take, and what is not

**New files — drop them in, they collide with nothing:**

```
api/app/_legacy_compat.py            api/app/routers_legacy_profile.py
api/app/_legacy_groups.py            api/app/routers_legacy_source.py
api/app/routers_legacy_graph.py      api/app/routers_legacy_matrix.py
ingestion/legacy_source_file_conn.py ui/src/DependencyMatrix.jsx
ui/src/TableExplorer.jsx
ui/src/LineageGraph.jsx              ui/src/SourceLineage.jsx
ui/src/lineage_api_additions.js      tools/check_lineage_fanin.py
sql/49_legacy_lineage_reload_cleanup.sql
sql/50_legacy_source_file.sql
sql/diagnose_legacy_lineage.sql
```

**Modified files — your copies are ahead of this repository's in at least
three cases, so merge by hand rather than overwriting:**

| file | the change | risk |
|---|---|---|
| `api/app/main.py` | 4 router names added to the mount tuple | none |
| `api/app/routers_legacy_lineage.py` | `tables()` only: selects `functional_group`, accepts `data_source`, counts `'Exists'` as mapped | none if your copy lacks it — **skip the hunk if your deployed copy already returns `functional_group`** |
| `ingestion/run.py` | new `legacy_source_file` step + single-step CLI | none |
| `ingestion/legacy_lineage_conn.py` | **changes `lineage_id` format and writes `data_source`** | **see step 4 — do not take casually** |
| `ui/src/LegacyLineage.jsx`, `ui/src/LineageHome.jsx` | UX rework | merge by hand |
| `ui/src/api.js` | restores 9 `legacy*` methods this repo was missing | **check yours first** — this file has twice been the thing that broke the app. If your working copy already has `legacy*`, `impact*`, `mapper*`, `acon*` and `recon*`, keep yours |

---

## 1. SQL — run in this order

Run as the schema owner (**`SILVER`**, or an account with rights on it).

| # | file | when |
|---|---|---|
| 1 | `sql/26_legacy_lineage.sql` | already run — the `legacy_lineage` table |
| 2 | `sql/29_legacy_lineage_data_source.sql` | already run — adds `DATA_SOURCE`. Run it if `?data_source=` has never worked |
| 3 | **`sql/50_legacy_source_file.sql`** | **required** for CP_SOURCE_FILE. Creates `LEGACY_SOURCE_FILE` + its index. Idempotent |
| 4 | `sql/49_legacy_lineage_reload_cleanup.sql` | **only if you take the connector change in step 4.** Destructive, and runs AFTER the reload, not before |

```bash
sqlplus SILVER/****@host:1521/service @sql/50_legacy_source_file.sql
```

`sql/diagnose_legacy_lineage.sql` is read-only and optional — run it any time
a screen's numbers look wrong.

---

## 2. Ingest CP_SOURCE_FILE

The sheet is in the workbook you already load.

```bash
export CP_CATALOG_DB_DSN='SILVER/****@host:1521/service'
export CP_LEGACY_LINEAGE_XLSX='/path/to/legacy_lineage.xlsx'
export CP_LEGACY_DATA_SOURCE='PBDW'          # optional, default PBDW

python -m ingestion.run legacy_source_file
```

Optional: `CP_LEGACY_SOURCE_FILE_SHEET` names the sheet explicitly; omitted,
it auto-detects `CP_SOURCE_FILE`.

Expect in the log:

```
legacy_source_file: sheet 'CP_SOURCE_FILE', feed=col0 dataset=col1
legacy_source_file[PBDW]: 137 feeds, 137 with a dataset name
legacy_source_file: merged 137 feeds
```

A `key ... is shared by [...]` warning means two feeds reduce to one join key
and one of them will show the other's business name. Send me the pair.

> **Note:** `python -m ingestion.run <step>` only started working on this
> branch. `run()` previously ignored `sys.argv` and ran *every* step, despite
> README_FINAL.md and LOCAL_SETUP.md documenting otherwise. Without the fix,
> loading this one sheet would also re-run `legacy_lineage`.

---

## 3. Restart and verify

```bash
# API
uvicorn app.main:app --reload          # from api/

# UI
npm run dev                            # from ui/
```

Expected at startup — all three must mount:

```
routers_legacy_graph ... routers_legacy_source
routers_legacy_profile ... routers_legacy_matrix
```

Check without the UI:

```bash
curl -s localhost:8000/api/legacy-lineage/group-sources | head -40
```

`dataset_family` should show `files_covered` close to your file count. If it
reads 0, `LEGACY_SOURCE_FILE` is empty or the join key is not matching — send
me that output rather than guessing.

Then: **Lineage → Source view.** Groups should read `Account`, `Fee`,
`Audit Trail`… and files should read `Account-Check Register` rather than
`Addv-ACCT-CHK-REG_BBH-TRP_YYYYMMDDHHMMSS.dat`.

---

## 4. OPTIONAL and separate — the lineage connector fix

`ingestion/legacy_lineage_conn.py` in this branch fixes two real defects:
`DATA_SOURCE` was never written, and `LINEAGE_ID` was `{table}:{column}`, so a
DWH column fed by **two source chains kept only one of them** — the fan-in was
discarded at load time.

It changes `LINEAGE_ID` to the format `sql/29` specified
(`{data_source}:{tgt}:{col}:{srchash}`). Because `load()` upserts and never
deletes, a reload writes the new rows and **leaves the old ones**, so every
field is counted twice until you clean up.

**Measure it before deciding.** The database cannot tell you how much is
being lost: the collapse happens at load, so `LEGACY_LINEAGE` afterwards holds
one row per target column and looks perfectly consistent. It cannot show you
what it never received. The workbook is the only witness:

```bash
python tools/check_lineage_fanin.py /path/to/legacy_lineage.xlsx
```

It reads the workbook, writes nothing, needs no code change, and prints how
many rows the old key discards and which source files disappear entirely. If
it reports 0, skip step 4 with confidence.

Only if you want it:

1. take the connector change
2. `python -m ingestion.run legacy_lineage`
3. run **STEP 1** of `sql/49_legacy_lineage_reload_cleanup.sql` and read the counts
4. run **STEP 2** only if `new_format` looks right

Nothing in steps 1–3 of this document depends on this. Skip it and everything
else still works.

---

## Rolling back

Steps 1–3 add a table, a connector, three routers and two UI components.
To undo: drop `LEGACY_SOURCE_FILE`, remove the three router names from
`main.py`, restart. No existing table is altered and no existing row is
rewritten — except by step 4, which is why it is step 4.
