# SEI crosswalk — install and ingestion

Adds the IMDS / STAR / UAF / SEI crosswalk to Lineage 360: the lane register,
the SEI → contract mapping, the verdicts, and the Mapping & Divergence
dashboard with drill-down.

**PBDW is untouched.** No existing table is altered, no existing loader is
edited, no existing endpoint changes its query. The dashboard reads its own
tables and renders an empty state for any warehouse with no crosswalk loaded,
so a PBDW screen behaves exactly as it does today until a PBDW crosswalk is
ingested. That is a property of the data, not a feature flag.

---

## 1. Files

### New — copy these in

| File | What it is |
|---|---|
| `sql/51_sei_crosswalk.sql` | DDL: 9 new tables, indexes, the lane seed |
| `sql/52_sei_crosswalk_attach.sql` | Canonical field-code columns, for attaching to an existing baseline |
| `ingestion/lane_lineage_conn.py` | The workbook connector |
| `api/app/routers_sei_crosswalk.py` | 8 read-only endpoints under `/sei-crosswalk` |
| `ui/src/seiCrosswalkApi.js` | API client + the verdict vocabulary |
| `ui/src/CrosswalkDashboard.jsx` | The dashboard and its drill-down |
| `docs/sei-crosswalk/INSTALL.md` | This file |

### Modified — three small edits

| File | Edit |
|---|---|
| `ingestion/run.py` | `"sei_crosswalk"` added to the step list, plus its dispatch branch |
| `api/app/main.py` | `"routers_sei_crosswalk"` added to the mount tuple |
| `ui/src/LineageHome.jsx` | one import; the `scope === "sei"` placeholder panel now renders `CrosswalkDashboard` |

Nothing else in the repository is touched. In particular
`ingestion/legacy_lineage_conn.py` is **not** edited — the copy in this
repository is older than the copy running in some environments, and editing a
stale file is how several working screens have been broken before.

---

## 2. Database

```bash
sqlplus $CP_DB_USER/$CP_DB_PASS@$CP_DB_DSN @sql/51_sei_crosswalk.sql
```

Idempotent — every `CREATE` swallows ORA-955, so a re-run is a no-op. It
creates:

`legacy_lane` · `legacy_src_column` · `sei_source_map` · `sei_verify` ·
`sei_code_set` · `sei_identifier_xwalk` · `sei_disposition` ·
`sei_dual_source` · `sei_exception`

and seeds three lanes (`ADDVANTAGE_PBDW`, `STAR_IMDS`, `UAF_IMDS`). The
loader overwrites the seed from the workbook's `LANE_REGISTER` sheet.

**Nothing is ALTERed.** The contract field's own type lives in
`legacy_src_column`, a side table keyed the way `legacy_source_file` is,
rather than as three new columns on `legacy_lineage`.

Verify:

```sql
SELECT table_name FROM user_tables
WHERE  table_name IN ('LEGACY_LANE','LEGACY_SRC_COLUMN','SEI_SOURCE_MAP',
                      'SEI_VERIFY','SEI_CODE_SET','SEI_IDENTIFIER_XWALK',
                      'SEI_DISPOSITION','SEI_DUAL_SOURCE','SEI_EXCEPTION')
ORDER BY table_name;          -- expect 9 rows
```

---

## 3. Ingestion

Put the workbook somewhere the loader can read, then:

```bash
export CP_SEI_XLSX=/path/to/IMDS_STAR_UAF_SEI_Data_Lineage.xlsx
export CP_SEI_DATA_SOURCE=IMDS          # the target warehouse
python -m ingestion.run sei_crosswalk
```

### Re-running

`loader._merge` upserts and never deletes. For PBDW that gap had to be
cleaned up after the fact by `sql/49`; this connector does not repeat it:

```bash
export CP_SEI_RELOAD=1                  # delete this lane's rows, then load
python -m ingestion.run sei_crosswalk
```

The purge is scoped to `(data_source, source_system)`. **PBDW rows carry a
different `data_source` and are never in range.** Use it whenever a row has
been removed from the workbook — without it the stale row survives and every
coverage percentage is wrong afterwards.

### What the log should say

```
sei_crosswalk[IMDS]: code=…, disp=…, dual=…, exc=…, feed=…, lane=…,
                     lineage=…, map=…, srccol=…, verify=…, xwalk=…
sei_crosswalk: merged N rows across 11 tables
```

`lineage=0` means the sheet was found but no row had both a target table and
a target column — check the header row. Header matching folds case, spaces,
underscores and hyphens, so `DWH_TARGET_TABLE` and `DWH_Target_Table` both
work; a genuinely different name does not.

A warning naming missing sheets is normal while the workbook is incomplete —
each missing sheet simply contributes nothing.

### Verify the load

```sql
-- every lane, and whether it counts toward readiness
SELECT lane_id, replacement_state, contract_name FROM legacy_lane;

-- the verdict spread. PROVEN_MATCH is expected to be 0 until live DDL lands
SELECT match_verdict, COUNT(*) FROM sei_verify
WHERE  data_source='IMDS' GROUP BY match_verdict ORDER BY 2 DESC;

-- the join actually connects: contract fields the mapping points at that no
-- lineage row consumes. Should be empty; anything here is net-new scope or a typo
SELECT DISTINCT m.src_file_key, m.src_source_column
FROM   sei_source_map m
WHERE  m.data_source='IMDS'
AND NOT EXISTS (SELECT 1 FROM legacy_src_column c
                WHERE c.data_source = m.data_source
                  AND c.src_file_key = m.src_file_key
                  AND c.src_source_column = m.src_source_column);

-- PBDW is untouched
SELECT data_source, COUNT(*) FROM legacy_lineage GROUP BY data_source;
```

---

## 3b. Attaching the PBDW crosswalk to a baseline that already exists

PBDW is the opposite case to IMDS and must be run differently.

IMDS had no STAR lineage in `legacy_lineage`, so the workbook supplied the
baseline **and** the SEI mapping. PBDW already has 1,180 rows, loaded from the
AddVantage mapping workbook by `legacy_lineage_conn.py`. For PBDW the crosswalk
workbook supplies **only the SEI side** and attaches to what is there.

### Run it

```bash
export CP_SEI_XLSX=/path/to/PBDW_ADDVANTAGE_SEI_Crosswalk.xlsx
export CP_SEI_DATA_SOURCE=PBDW
export CP_SEI_LINEAGE_MODE=attach        # explicit is better than auto here
python -m ingestion.run sei_crosswalk
```

`CP_SEI_LINEAGE_MODE` takes `load`, `attach` or `auto` (the default). `auto`
counts existing `legacy_lineage` rows for the warehouse and attaches when it
finds any. Set it explicitly for PBDW anyway — the cost of being wrong is
asymmetric, and an explicit value cannot be surprised by an empty database.

In attach mode the connector:

- **does not write** `legacy_lineage` or `legacy_source_file`, and logs how
  many workbook rows it skipped for that reason
- **does not purge** them either, even with `CP_SEI_RELOAD=1`
- writes only its own tables: the lane register, the SEI mapping, the
  verdicts, code sets, dispositions, dual-source and exceptions

### The workbook is not quite the same either

Two differences from the IMDS workbook:

- `LANE_LINEAGE` is not needed. If present it is parsed and then skipped, with
  a warning naming the row count. Leaving it out is cleaner.
- `TARGET_CONTRACT_FIELD` must hold the **AddVantage field code exactly as
  `legacy_lineage.src_source_column` holds it** — `BI/1-1`, `BI/2-1`. Not the
  business name, not the DWH column name.

### Why field codes need care

The same AddVantage field appears as `BI/2-1` on one sheet and `BI_2_L1` on
another. That is why `_norm_code` and `_legacy_groups._CANON` exist. Both sides
are therefore stored and joined canonically: the loader writes `src_col_norm`
and the API joins on it, so either spelling resolves.

Run `sql/52_sei_crosswalk_attach.sql` before the first attach — it adds
`src_col_norm` to the crosswalk's own tables. Additive, and only to tables
`sql/51` created.

```bash
sqlplus $CP_DB_USER/$CP_DB_PASS@$CP_DB_DSN @sql/52_sei_crosswalk_attach.sql
```

### The one number that says whether it worked

Attach mode ends with a join health check and logs one of:

```
attach: all N SEI mappings resolved to an existing lineage row
attach: K of N SEI mappings point at a contract field no existing lineage
        row consumes...
```

A non-zero `K` matters more than the row count. It means either net-new scope,
or a field code the canon rule cannot reconcile — and those look identical in a
spreadsheet while being very different problems. The commented query at the
foot of `sql/52` lists them.

### Verify PBDW's baseline survived

```sql
SELECT data_source, COUNT(*) FROM legacy_lineage GROUP BY data_source;
-- PBDW must be unchanged from before the run
```

---

## 4. API

`api/app/main.py` mounts routers in a guarded loop, so a bad import is logged
and skipped rather than taking the API down. Restart, then:

```bash
curl -s "$API/sei-crosswalk/summary?data_source=IMDS" | head -c 400
curl -s "$API/sei-crosswalk/divergence?data_source=IMDS" | head -c 400
```

Confirm the mount in the API log: `mounted routers_sei_crosswalk`.

Every endpoint is read-only and scoped by `data_source`.

---

## 5. UI

No new dependency. `CrosswalkDashboard.jsx` imports only React and
`seiCrosswalkApi.js`.

```bash
cd ui && npm run build
```

**Known pre-existing build failure, unrelated to this change:**
`src/DocDrill.jsx` imports `mermaid`, which is not in `ui/package.json`, so
`npm run build` fails on a clean checkout of this branch too. Verified by
building with these changes stashed — identical error. Either add the
dependency or remove the import; it is not introduced here and not fixed here.

To see the dashboard: **Lineage → scope chip → Scope: SEI**. That position
previously rendered a placeholder panel ("SEI lineage — arriving with the SWP
program"); it now renders the dashboard.

Drill-down is a stack, so Back returns to wherever the click came from:

```
overview  →  column list (by verdict, divergence shape, lane or table)
          →  one column: chain, contract field, SEI datapoints, findings
```

---

## 6. Rollback

```sql
DROP TABLE sei_exception;         DROP TABLE sei_dual_source;
DROP TABLE sei_disposition;       DROP TABLE sei_identifier_xwalk;
DROP TABLE sei_code_set;          DROP TABLE sei_verify;
DROP TABLE sei_source_map;        DROP TABLE legacy_src_column;
DROP TABLE legacy_lane;
DELETE FROM legacy_lineage      WHERE data_source = 'IMDS';
DELETE FROM legacy_source_file  WHERE data_source = 'IMDS';
COMMIT;
```

Then revert the three modified files and delete the five new ones. Nothing
else carries state from this feature.

---

## 7. Two things to settle before the numbers mean anything

**Live DDL.** Target types currently come from a data dictionary, which makes
the target-side evidence `DOCUMENT`. The rule forbids `PROVEN_MATCH` on
document evidence, so the dashboard reads 0 proven no matter how good the SEI
side gets, and says so in a banner. One extract lifts the ceiling for every
mapped column at once:

```sql
SELECT c.owner, c.table_name, c.column_name, c.data_type,
       c.data_length, c.data_precision, c.data_scale, c.nullable, c.column_id,
       CASE WHEN pk.column_name IS NOT NULL THEN 'Y' ELSE 'N' END AS pk_flag
FROM   all_tab_columns c
LEFT JOIN ( SELECT cc.owner, cc.table_name, cc.column_name
            FROM   all_constraints ct
            JOIN   all_cons_columns cc
              ON   cc.owner = ct.owner AND cc.constraint_name = ct.constraint_name
            WHERE  ct.constraint_type = 'P' ) pk
  ON   pk.owner = c.owner AND pk.table_name = c.table_name
 AND   pk.column_name = c.column_name
WHERE  c.owner IN ('BBHRPTDBO','RULESDBO','HOLDINGDBO','SECURITYDBO')
ORDER  BY c.owner, c.table_name, c.column_id;
```

**Functional group.** `_legacy_groups.py` resolves grouping through a chain
and records which resolver answered. The workbook's `SUBJECT_AREA` feeds none
of them, and `FUNCTIONAL_GROUP` is empty in the current load. The connector
accepts either spelling into `functional_group`, so grouping works today —
but the prompt should be corrected to emit `FUNCTIONAL_GROUP`, because a
second consumer reading the workbook directly would not have that forgiveness.
