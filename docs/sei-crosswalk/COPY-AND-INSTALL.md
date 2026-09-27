# SEI crosswalk — what to copy, what to override, how to install

Two categories, and the difference matters.

**Seven new files: copy whole.** Nothing in your repo has these names, so
there is no conflict and nothing to lose.

**Three existing files: do NOT copy whole — apply the edits by hand.** Your
enterprise copies of these are almost certainly ahead of this branch. The
codebase already records what happens otherwise: `legacy_source_file_conn.py`
notes that "editing a stale file is how api.js, mockData.js and
routers_legacy_lineage.py each broke a working screen." Overwriting
`LineageHome.jsx` with mine would revert whatever you have added to it since.
All three edits are small and shown in full below.

---

## A. Copy whole — seven new files

| Copy to | From |
|---|---|
| `sql/51_sei_crosswalk.sql` | new — 9 tables, indexes, lane seed |
| `sql/52_sei_crosswalk_attach.sql` | new — canonical field-code columns |
| `ingestion/lane_lineage_conn.py` | new — the workbook connector |
| `api/app/routers_sei_crosswalk.py` | new — 8 read-only endpoints |
| `ui/src/seiCrosswalkApi.js` | new — API client + verdict vocabulary |
| `ui/src/CrosswalkDashboard.jsx` | new — dashboard + drill-down |
| `docs/sei-crosswalk/INSTALL.md` | new — the runbook |

No existing file is renamed, moved or deleted.

**`ingestion/legacy_lineage_conn.py` is deliberately NOT in this list.** It is
not touched, and must not be. The copy in this repository is older than the
copy running in some environments.

---

## B. Apply by hand — three existing files

### B1 · `api/app/main.py` — one line

Find the router mount tuple (around line 22) and add the last entry:

```python
             "routers_environment360", "routers_env_infra",
             "routers_event360",
             "routers_sei_crosswalk"):          # <-- ADD THIS LINE
```

The loop is already guarded, so a failed import is logged and skipped rather
than taking the API down.

### B2 · `ingestion/run.py` — two edits

**In the `STEPS` list**, after `legacy_source_file`:

```python
    "legacy_source_file",# CP_SOURCE_FILE: the business name of each AddVantage EOD feed
    "sei_crosswalk",     # IMDS/STAR/UAF/SEI crosswalk workbook — lanes, mapping, verdicts
```

**In `_run_step`**, anywhere among the other `if step ==` branches:

```python
    if step == "sei_crosswalk":
        from .lane_lineage_conn import SeiCrosswalkConnector
        c = SeiCrosswalkConnector.from_env()
        n = c.load(loader, c.parse())
        log.info("sei_crosswalk: merged %s rows", n)
        return
```

### B3 · `ui/src/LineageHome.jsx` — two edits

**Add the import**, beside the other view imports near the top:

```jsx
import SourceLineage from "./SourceLineage.jsx";
import CrosswalkDashboard from "./CrosswalkDashboard.jsx";   // <-- ADD
```

**Replace the SEI placeholder panel.** Find this block (around line 330) —
it is the panel that currently reads "SEI lineage — arriving with the SWP
program":

```jsx
   {scope === "sei" ? (
    <div style={{ background: t.panel || "#fff",
     border: `1px solid ${t.panel2 || "#dfe6e9"}`,
     borderRadius: 3, padding: 44, textAlign: "center",
     color: t.muted || "#999", fontSize: 13 }}>
     🧬 SEI lineage — arriving with the SWP program.<br />
     <span style={{ fontSize: 11 }}>Non-SEI (AddVantage) is available now.</span>
    </div>
   ) : view === "source" ? (
```

and replace the placeholder `<div>` with the component, leaving the ternary
around it exactly as it is:

```jsx
   {scope === "sei" ? (
    <CrosswalkDashboard t={t} dataSource={ds} onOpenTechnical={openTechnical} />
   ) : view === "source" ? (
```

`ds` and `openTechnical` are already in scope at that point — no other change
is needed.

**If your `LineageHome.jsx` has diverged** and the block does not match: the
only thing that matters is that `scope === "sei"` renders
`<CrosswalkDashboard t={t} dataSource={ds} onOpenTechnical={openTechnical} />`
instead of the placeholder. Nothing else in the file is involved.

---

## C. Install

### 1. Database

```bash
sqlplus $CP_DB_USER/$CP_DB_PASS@$CP_DB_DSN @sql/51_sei_crosswalk.sql
sqlplus $CP_DB_USER/$CP_DB_PASS@$CP_DB_DSN @sql/52_sei_crosswalk_attach.sql
```

Both are idempotent — every `CREATE` swallows ORA-955 and every `ALTER`
swallows ORA-1430, so re-running is a no-op. Run `51` before `52`.

Nine new tables; **no existing table is altered.**

```sql
SELECT table_name FROM user_tables
WHERE  table_name IN ('LEGACY_LANE','LEGACY_SRC_COLUMN','SEI_SOURCE_MAP',
                      'SEI_VERIFY','SEI_CODE_SET','SEI_IDENTIFIER_XWALK',
                      'SEI_DISPOSITION','SEI_DUAL_SOURCE','SEI_EXCEPTION');
-- expect 9
```

### 2. API

Restart, then confirm the mount in the log:

```
mounted routers_sei_crosswalk
```

```bash
curl -s "$API/sei-crosswalk/summary?data_source=IMDS" | head -c 300
```

Before any ingestion this returns zeros. That is correct, and it is what makes
the dashboard self-hide.

### 3. UI

No new dependency. Build as usual.

**Known pre-existing failure, not from this change:** `src/DocDrill.jsx`
imports `mermaid`, which is absent from `ui/package.json`, so `npm run build`
fails on a clean checkout of this branch too — verified by building with all
of these changes stashed and getting the identical error. If your enterprise
repo has `mermaid` installed, you will not see it.

### 4. Ingest

**IMDS** — the workbook supplies the baseline:

```bash
export CP_SEI_XLSX=/path/to/IMDS_STAR_UAF_SEI_Data_Lineage.xlsx
export CP_SEI_DATA_SOURCE=IMDS
export CP_SEI_LINEAGE_MODE=load
python -m ingestion.run sei_crosswalk
```

**PBDW** — the baseline already exists, so attach to it:

```bash
export CP_SEI_XLSX=/path/to/PBDW_ADDVANTAGE_SEI_Crosswalk.xlsx
export CP_SEI_DATA_SOURCE=PBDW
export CP_SEI_LINEAGE_MODE=attach
python -m ingestion.run sei_crosswalk
```

Set the mode explicitly in both cases. `auto` works by counting existing rows,
but the cost of being wrong is asymmetric and an explicit value cannot be
surprised by an empty database.

Add `CP_SEI_RELOAD=1` to re-run after editing the workbook. In `attach` mode
the purge never touches `legacy_lineage` or `legacy_source_file`.

### 5. Confirm PBDW survived

```sql
SELECT data_source, COUNT(*) FROM legacy_lineage GROUP BY data_source;
```

PBDW's count must be identical to before the run. If it is not, the mode was
`load` when it should have been `attach` — restore from backup and re-run.

### 6. See it

**Lineage → scope chip → Scope: SEI.**

---

## D. Order of operations, in one list

1. Copy the seven new files
2. Apply the three hand-edits (B1, B2, B3)
3. Run `sql/51`, then `sql/52`
4. Restart the API, confirm `mounted routers_sei_crosswalk`
5. Rebuild the UI
6. Ingest IMDS with `CP_SEI_LINEAGE_MODE=load`
7. Ingest PBDW with `CP_SEI_LINEAGE_MODE=attach`, when its workbook exists
8. Check `legacy_lineage` counts per warehouse
9. Open Lineage → Scope: SEI

Steps 1–5 change no data and are safe to do ahead of any workbook.

---

## E. Rollback

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

Then revert the three hand-edits and delete the seven new files. Nothing else
carries state from this feature, and no PBDW row is involved in any of it.
