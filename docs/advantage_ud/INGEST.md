# Ingesting the AddVantage UD profile and code dictionary

Six small files in, two tables of knowledge out, one screen that reads
them. Everything runs on the catalogue database you already load with
`local\load.ps1`; nothing new to install.

## 0. Before you start

- Pull `claude/column-lineage-graph` at commit `ee76a0c` or later.
- `CP_CATALOG_DB_DSN` set as for every other load (see `RUN_GUIDE.md`).
- The profiler has been run on `dataVar.csv` and produced its output folder.
- `legacy_dictionary` is loaded (step `legacy_dictionary`). Not required,
  but without it the UD fields have no names on the screen.

## 1. Put the files where the loader looks

```
local-data\advantage-ud\profile\
    attribute_profile.csv        required  the registry
    type_variance.csv            optional  variance classes
    parent_structures.csv        optional  the multiline blocks
    schema_variants.csv          optional  key sets and families
    code_conflicts.csv           optional  classified conflicts
    run_summary.csv              optional  the headline counts
    code_dictionary.csv          required  the code values
```

Do NOT copy `attribute_detail.csv` or `record_schemas.csv`. They are per
account, hundreds of megabytes, and nothing reads them. The folder is
gitignored; its README says so.

Another location works too: set `CP_ADDV_UD_PROFILE_DIR` to the folder and
`CP_ADDV_UD_CODES` to the code_dictionary.csv path.

## 2. Create the tables, once

```powershell
sqlplus -S $env:CP_CATALOG_DB_DSN "@sql\75_advantage_ud_dictionary.sql"
sqlplus -S $env:CP_CATALOG_DB_DSN "@sql\76_advantage_ud_profile.sql"
```

Both are guarded: running them again is harmless. `75` also seeds the seven
UD_1 values supplied by hand; the loader replaces them row for row.

## 3. Load

```powershell
.\local\load.ps1 advantage_ud_profile
.\local\load.ps1 advantage_ud_dictionary
```

or, from the repo root, `python -m ingestion.run advantage_ud_profile advantage_ud_dictionary`.

Each step logs what it read, for example
`advantage_ud_profile: {'variance': 90, 'profile': 284, 'parents': 18, 'schemas': 12951, 'conflicts': 12, 'run': 11}`
and `advantage_ud_dictionary: 3412 pairs kept, dropped {'FREE_TEXT_PARENT': 58, 'CODE_SHAPE': 5}`.
The dropped counts are the profiler's free-text splits (UD_32 lines, codes
with spaces); they are meant to be dropped.

Re-running is safe. Rows MERGE by key, so counts refresh and nothing
duplicates. A pair no longer observed stays, which is a finding for the
drift report, not a deletion.

## 4. Check

```sql
SELECT COUNT(*) FROM cp_advantage_ud_registry;              -- 284 expected
SELECT key_structure, COUNT(*) FROM cp_advantage_ud_registry GROUP BY key_structure;
SELECT COUNT(*) FROM cp_advantage_ud_parent;                -- 18
SELECT COUNT(*) FROM cp_advantage_ud_family;                -- the number the 12,951 fold to
SELECT COUNT(*) FROM cp_advantage_ud_schema;                -- 12951
SELECT conflict_class, COUNT(*) FROM cp_advantage_ud_conflict GROUP BY conflict_class;
SELECT attribute_name, COUNT(*) FROM cp_advantage_ud_dictionary GROUP BY attribute_name ORDER BY 2 DESC;
SELECT * FROM cp_advantage_ud_registry WHERE type_reclassified = 'Y';  -- the 10-digit ids
```

Then, with uvicorn running:

```
GET /api/advantage-ud/overview            loaded: true, attributes, families
GET /api/advantage-ud/attribute?name=UD_1 registry row, codes, shape
GET /api/advantage-ud/type-variance
GET /api/advantage-ud/schema-variance
GET /api/advantage-ud/clob-shape          the example payload, shapes only
```

On the screen: Datapoint 360 → Non-SEI → AddVantage → Browse by Category →
User-Defined (UD). The strip appears with its three tabs, and a UD field's
pane carries the extra rows. On the Legacy Lineage screen, DIM_ACCOUNT_UD's
CLOB proof is read as structure.

## 5. If something is off

| You see | Cause | Do |
|---|---|---|
| "not loaded yet" on the strip | `cp_advantage_ud_registry` is empty or `76` was not run | run `76`, then the profile step |
| `attribute_profile.csv lacks ['attribute_name']` | a different profiler version or a renamed header | the loader needs the headers in `docs/advantage_ud/ANALYSIS.md` §1b |
| UD fields have no names on the screen | `legacy_dictionary` not loaded | run `legacy_dictionary` |
| 0 codes for a field you know is coded | its parent is in `free_text_parents` | edit `ingestion/advantage_ud_rules.yaml` and re-run the dictionary step |
| the API 500s on `/advantage-ud/*` | should not happen: a missing table answers an empty list | send the uvicorn traceback |

## 6. What the load never does

It never reads `sample_values`, `attribute_detail.csv` or `record_schemas.csv`,
never commits anything under `local-data/`, and never puts a value on the
screen: shapes come from class, length, mask and the first dictionary code.
