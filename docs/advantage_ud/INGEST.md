# Ingesting the AddVantage UD sources

Five sources, in this order, on the catalogue database you already load
with `local\load.ps1`. Nothing new to install: `oracledb`, `openpyxl` and
`pyyaml` are already in `requirements.txt`.

| # | Source | Step | Tables |
|---|---|---|---|
| 1 | profiler outputs (6 small csv) | `advantage_ud_profile` | registry, parent, family, schema, conflict, run |
| 2 | `code_dictionary.csv` | `advantage_ud_dictionary` | dictionary (OBSERVED) |
| 3 | `dataVar.csv`, the extract | `advantage_ud_extract` | raw, attribute, quarantine (+ registry, schema for drift) |
| 4 | `AddV User Defined Fields … .xlsx` | `advantage_ud_workbook` | table, field_type, dictionary (TABLES), link |
| 5 | `TRP AddV UD MultiLine … .xlsx` | `advantage_ud_trp` | recon |

The order matters: 3 needs 1 to know which keys are new, 4 needs 2 to
infer links from observed codes, 5 needs 3 to compare values.

## 0. Before you start

- Pull `claude/column-lineage-graph` at the latest commit.
- `CP_CATALOG_DB_DSN` set as for every other load (see `RUN_GUIDE.md`).
- `legacy_dictionary` loaded (step `legacy_dictionary`). Optional, but
  without it the UD fields have no names on the screen.

## 1. Put the files where the loaders look

```
local-data\advantage-ud\
    dataVar.csv                                   the extract (21,672 rows)
    AddV User Defined Fields 042926 v1.xlsx       the UD workbook (name must contain "User Defined")
    TRP AddV UD MultiLine 100726 1144.xlsx        the samples (name must contain "TRP")
    profile\
        attribute_profile.csv     required
        code_dictionary.csv       required
        type_variance.csv         parent_structures.csv     schema_variants.csv
        code_conflicts.csv        run_summary.csv
```

Do not copy `attribute_detail.csv` or `record_schemas.csv`; nothing reads
them. The folder is gitignored. Other locations work through
`CP_ADDV_UD_PROFILE_DIR`, `CP_ADDV_UD_CODES`, `CP_ADDV_UD_EXTRACT`,
`CP_ADDV_UD_WORKBOOK`, `CP_ADDV_UD_TRP`.

## 2. Discovery first, once

```powershell
python tools\advantage_ud_discovery.py local-data\advantage-ud
```

Writes `docs\advantage_ud\source_inventory.md`: every sheet, header row,
column and row count, with any column the brief does not describe marked
UNDOCUMENTED. Structure only, no values. Read it before loading: if the
UD workbook has a sheet mapping UD numbers to table numbers, the workbook
step will find it and the links come out VERIFIED. If not, they are
inferred from code overlap and marked STRONGLY_INFERRED or WEAK.

## 3. Create the tables, once

```powershell
sqlplus -S $env:CP_CATALOG_DB_DSN "@sql\75_advantage_ud_dictionary.sql"
sqlplus -S $env:CP_CATALOG_DB_DSN "@sql\76_advantage_ud_profile.sql"
sqlplus -S $env:CP_CATALOG_DB_DSN "@sql\77_advantage_ud_ingest.sql"
```

All three are guarded; running them again is harmless.

## 4. Load, in order

```powershell
.\local\load.ps1 advantage_ud_profile
.\local\load.ps1 advantage_ud_dictionary
.\local\load.ps1 advantage_ud_extract
.\local\load.ps1 advantage_ud_workbook
.\local\load.ps1 advantage_ud_trp
```

What each logs:

- profile: `{'variance': 90, 'profile': 284, 'parents': 18, 'schemas': 12951, 'conflicts': 12, 'run': 11}`
- dictionary: `N pairs kept, dropped {'FREE_TEXT_PARENT': …, 'CODE_SHAPE': …}`. The
  dropped rows are the profiler's free-text splits; dropping them is intended.
- extract: `{'rows': 21672, 'ok': 21672, 'quarantined': 0, 'attributes': 1199055,
  'new_attributes': 0, 'new_schemas': 0, 'distinct_schemas': 12951}`. It streams
  in chunks of 2,000 rows (`CP_ADDV_UD_CHUNK`) and merges in bulk. Expect
  minutes, not seconds: 1.2 million attribute rows. A WARNING names any key
  not in the registry (it is registered, not refused) and counts any exact
  key set not seen before (drift, recorded).
- workbook: `N tables, 5 field types, M entities, K codes, L links (sheet name or "inferred")`.
- trp: `N accounts, M UD columns, U undocumented columns`.

Re-running any step is safe: rows merge by key. The extract never deletes:
a key absent from a later payload leaves the earlier attribute row in place.

## 5. Check

```sql
SELECT parse_status, COUNT(*) FROM cp_advantage_ud_raw GROUP BY parse_status;   -- OK 21672
SELECT COUNT(*), COUNT(DISTINCT attribute_name) FROM cp_advantage_ud_attribute; -- 1199055, 284
SELECT parse_error, COUNT(*) FROM cp_advantage_ud_quarantine GROUP BY parse_error;
SELECT * FROM cp_advantage_ud_table ORDER BY table_number;
SELECT link_status, COUNT(*) FROM cp_advantage_ud_link GROUP BY link_status;
SELECT source, COUNT(*) FROM cp_advantage_ud_dictionary GROUP BY source;      -- OBSERVED and TABLES
SELECT * FROM cp_advantage_ud_recon WHERE missing_in_extract > 0;              -- UD_514?
SELECT attribute_name FROM cp_advantage_ud_registry WHERE class_source = 'INFERRED' AND occurrence_count IS NULL; -- registered by the extract, not yet profiled
```

Then `GET /api/advantage-ud/ingest-status` returns the same as one JSON,
and the overview strip on Datapoint 360 → Non-SEI → AddVantage →
Browse by Category → User-Defined (UD) reads it. On the Legacy Lineage
screen, DIM_ACCOUNT_UD's CLOB proof is read as structure.

## 6. If something is off

| You see | Cause | Do |
|---|---|---|
| "not loaded yet" on the strip | registry empty or `76` not run | run `76`, then the profile step |
| `… lacks ['attribute_name']` or `lacks USER_DEFINED_ATTRIBUTE_CLOB` | a renamed header | the headers are the brief's; check `source_inventory.md` |
| `Tables sheet lacks Table Number / Code columns; skipped` | different header names | send the inventory; the aliases are in `advantage_ud_workbook_conn.py` |
| `TRP sheet lacks an 'Account Number' column` | same | same |
| extract warns about many new keys | profile step not run first | run `advantage_ud_profile`, then re-run the extract |
| UD fields have no names on the screen | `legacy_dictionary` not loaded | run `legacy_dictionary` |
| 0 codes for a field you know is coded | its parent is in `free_text_parents` | edit `ingestion/advantage_ud_rules.yaml`, re-run the dictionary step |
| links all WEAK | observed codes and table codes rarely overlap | that is a finding; a mapping sheet or a person settles it |

## 7. What the load never does

It never reads `sample_values`, `attribute_detail.csv` or `record_schemas.csv`;
never commits anything under `local-data/`; never stores a TRP value (counts
only); masks table 5 (OFFICER TABLE) descriptions; and the API never selects
`raw_value` from the attribute table. The attribute table holds client values
and is for the warehouse's own use.
