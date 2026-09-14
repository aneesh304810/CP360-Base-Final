# Patch: fix ×5 duplicate field rows in the Lineage tree

**File to edit:** the existing router that serves
`GET /api/legacy-lineage/dictionary?system=...`
(likely `app/routers/legacy_lineage.py` — find with `grep -rn "legacy-lineage" app/`)

## Root cause
The route joins `LEGACY_LINEAGE` to `LEGACY_DICTIONARY` on the field code alone.
`LEGACY_DICTIONARY` can hold multiple rows per `FIELD_CODE_NORM` (one per
`MASTER_NAME`, plus any loader-appended duplicates), so each lineage field row
fans out N×. Only the lineage side carries `DWH_TYPE`/`DWH_LENGTH`, which is why
only one row per group showed `VARCHAR2 42.0`.

## Fix
Replace the direct join to `SILVER.LEGACY_DICTIONARY` with a pre-deduplicated
inline view. Find the JOIN in the route's SQL, e.g.:

```sql
-- BEFORE (fans out)
LEFT JOIN silver.legacy_dictionary d
       ON UPPER(d.field_code_norm) = UPPER(l.dwh_target_column)
      AND UPPER(d.source_system)   = :system
```

```sql
-- AFTER (one row per field code)
LEFT JOIN (
    SELECT field_code_norm,
           source_system,
           MAX(business_term)  AS business_term,
           MAX(short_desc)     AS short_desc,
           MAX(data_type)      AS data_type,
           MAX(max_length)     AS max_length,
           MAX(privacy_class)  AS privacy_class,
           MAX(CASE WHEN is_pii = 'Y' THEN 'Y' END) AS is_pii
    FROM silver.legacy_dictionary
    GROUP BY field_code_norm, source_system
) d ON UPPER(d.field_code_norm) = UPPER(l.dwh_target_column)
   AND UPPER(d.source_system)   = :system
```

Adjust the inner SELECT column list to whatever dictionary columns the route
actually projects. Keep it LEFT JOIN so undefined fields still render.

## Verify the dictionary itself
Run once to see whether duplicates are legitimate multi-master entries or a
loader bug:

```sql
SELECT field_code_norm,
       COUNT(*)                         AS rows_total,
       COUNT(DISTINCT master_name)      AS masters,
       COUNT(DISTINCT dict_key)         AS keys
FROM   silver.legacy_dictionary
WHERE  UPPER(source_system) = 'ADDVANTAGE'
GROUP  BY field_code_norm
HAVING COUNT(*) > 1
ORDER  BY rows_total DESC;
```

- `rows_total = masters` → legitimate multi-master entries; the SQL dedupe above
  is the right permanent fix.
- `rows_total > masters` (identical rows repeated) → the dictionary loader
  appended on re-runs. Make it idempotent: unique index on
  `(source_system, field_code_norm, master_name)` and switch the load to MERGE.
  Given the earlier `loader.commit()` silent-rollback fix, check whether a retry
  path re-inserted after a partial commit — that produces exactly this pattern.
