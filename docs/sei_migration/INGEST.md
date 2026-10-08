# Data Analysis: SEI migration catalog

Utilities → **Data Analysis** reads SEI's merged source-file catalog
(`SEI_All_Source_Files_Merged_Catalog_Expanded.xlsx`) as a migration: for
every field of every SEI conversion load file, where its value comes from
in BBH, by what rule, where it goes next, and what is still open.

SEI is the **target**. The catalog's "Source_Object" is the SEI load file
(`account-basic.dat`), and BBH's answer sits in the right-hand columns:
"Tables/Fields/Off-System", "Other Mapping Logic", "Other Status" and the
two DSR columns.

## Load it

1. Run `sql/78_sei_migration.sql` once (idempotent).
2. Drop the workbook into `local-data/sei-migration/` (or point
   `CP_SEI_MIGRATION_DIR` elsewhere). Any workbook or csv in the folder is
   read; on each sheet the reader finds the header row and takes the sheet
   only if it carries `Catalog_ID` and `Source_Attribute`. Skipped sheets
   are named in the log.
3. Run one step:

       .\local\load.ps1 sei_migration
       python -m ingestion.run sei_migration        # the same, from the repo root

   `sei_migration` is also part of the full `python -m ingestion.run`.
   Set `CP_SEI_MIGRATION_RELOAD=1` to replace the tables rather than merge.

Nothing under `local-data/` is committed.

## What is read from each row

| Reading | Looked for | Values |
|---|---|---|
| Mandatory class | the per-account-type matrix `House Account: YES \| ...` | ALWAYS, CONDITIONAL (some YES, some NO), OPTIONAL, NOT_APPLICABLE, UNKNOWN |
| Effective rule | "Other Mapping Logic" after its last `---`; without one, the whole cell; without the cell, SEI's processing logic (marked SEI) | text |
| Rule class | patterns on the effective rule | DIRECT, CONSTANT, SET_NULL, LOOKUP, CONDITIONAL, CONCATENATE, TRANSFORM, DERIVED, NOT_APPLICABLE, NOT_MAPPED |
| Status class | "Other Status", split on `\|` (`NA-UK \| Complete` is COMPLETE with detail `NA-UK`) | COMPLETE, OPEN, BLOCKED, NA, UNSPECIFIED |
| Sources | tables in "Tables/Fields/Off-System"; `TABLE.FIELD` and `Field (TABLE)` in the rule; Title_Case fields in a rule that names one table (marked INFERRED); the Config list in Acceptable Values | system by prefix: UAF/PACE, IM, STAR, PB (SGA_), AddVantage (AV_), Conversion (XOS_), SEI config (Config_), CRM |
| Targets | outbound file and field names, `REPORT : ... FIELD NAME: ...`, ADE-CAS, Desktop | OUTBOUND, BOXI, ADE_CAS, DESKTOP |
| Flags | "truncat", "report out", "mitigate" in the note or rule; a domicile other than All | truncation_risk, report_out, null_mitigation, country_specific |

The rules live in `ingestion/sei_migration_rules.py` and are tested in
`api/test/test_sei_migration.py`. The API (`/sei-migration/*`) never
re-derives them, so the screen and the log agree.

## Findings

| Kind | Meaning |
|---|---|
| MANDATORY_UNMAPPED | required for every account type, no rule written |
| MANDATORY_OPEN | required for every account type, status not complete |
| UNMAPPED | no rule, not marked not-applicable |
| STATUS_OPEN | rule written, status open or blocked |
| LOOKUP_NO_TABLE | rule needs a lookup, names no crosswalk or config list |
| TRUNCATION / REPORT_OUT / NULL_MITIGATION | the note warns about it |
| DSR_PENDING | DSR logic written, its status not complete |
| COUNTRY_SPECIFIC | one domicile only |
