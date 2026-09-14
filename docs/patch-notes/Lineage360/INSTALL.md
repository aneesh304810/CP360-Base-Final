# Legacy Lineage — Functional Groups + Dependency Swimlane

Handles the updated workbook:
- `CP_LEGACY_LINEAGE_SHEET` new columns: **Functional_Group**, **Table_Type**
- New sheet: **Table_Dependency_Network** (Source_Table, Target_Table,
  Column_Link, Source_Function, Target_Function)

## What you get

**Lineage by Functional Group** — the Legacy E2E Lineage tab now groups by
functional group first: group card (table/field counts, mapped-% bar, table
type pill) → tables → columns, with the existing SRC→STG1→STG2→DWH backward
trace and per-stage proof unchanged. Searching a table auto-expands groups.

**Dependency Swimlane** — one lane per functional group (Target_Function),
source tables wired to the target tables they load. Column count labeled on
every link, cross-lane links in amber with an "also feeds …" tag on the shared
source, EXCLUDE / Not Applicable sources hidden behind a toggle (dashed when
shown). Click a target table → panel lists every inbound source with the full
Column_Link chips; clicking a chip deep-links into the lineage view at that
exact table + column.

## Files → where they go (all OVERWRITE except the SQL, which is new)

| In zip | Copy to |
|---|---|
| `sql/27_legacy_lineage_update.sql` | `sql/27_legacy_lineage_update.sql` (NEW) |
| `ingestion/legacy_lineage_conn.py` | `ingestion/legacy_lineage_conn.py` |
| `api-app/routers_legacy_lineage.py` | `api/app/routers_legacy_lineage.py` |
| `ui-src/LegacyLineage.jsx` | `ui/src/LegacyLineage.jsx` |
| `ui-src/api.js` | `ui/src/api.js` |

`api.js` includes the interface-fix changes you already applied plus the new
legacy client functions — safe to overwrite.

## Steps

```powershell
# 1. copy files (as above)

# 2. schema update — idempotent, safe to re-run
sqlplus user/pass@db @sql/27_legacy_lineage_update.sql

# 3. re-ingest the workbook (parses the new columns + new sheet)
#    optional env if the sheet name differs: CP_LEGACY_DEPENDENCY_SHEET
python -m ingestion.run legacy_lineage

# 4. FULL API restart
Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force
Get-ChildItem -Path api -Filter __pycache__ -Recurse -Directory | Remove-Item -Recurse -Force
uvicorn app.main:app --app-dir api --port 8000

# 5. UI: npm run dev, then Ctrl+Shift+R
```

## Verify

```powershell
curl "http://localhost:8000/legacy-lineage/functional-groups"
#   -> groups with table/field counts (drives the group cards)

curl "http://localhost:8000/legacy-lineage/dependency-network"
#   -> edges grouped source->target with columns[], plus nodes; EXCLUDE hidden
curl "http://localhost:8000/legacy-lineage/dependency-network?include_excluded=Y"
curl "http://localhost:8000/legacy-lineage/dependency-network?table=AUDIT_TRAIL_ACCOUNT"
```

UI: Legacy E2E Lineage tab → two sub-tabs. In the swimlane, click
AUDIT_TRAIL_ACCOUNT → 18 column chips → click ACCOUNT_NUMBER → lands in the
lineage view with that column's backward chain expanded.

## Notes
- Lane membership comes from Target_Function (Source_Function is blank in the
  sheet except EXCLUDE rows); a shared source lives in the lane of its first
  target and cross-lane links render in amber.
- Duplicate rows in the sheet are deduped at ingest (dep_id = source:target:column).
- Synthesized UD rows inherit the parent table's functional group/table type.
- Connector tested against your exact sheet layout; API/UI validated for
  syntax but not runtime-tested here (no Oracle/Vite in this environment).
