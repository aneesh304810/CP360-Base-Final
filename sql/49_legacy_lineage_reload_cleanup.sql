-- ============================================================================
-- 49_legacy_lineage_reload_cleanup.sql
--
-- DESTRUCTIVE. Read this before running it. It deletes rows.
--
-- WHY IT IS NEEDED
--
-- sql/29 specified LINEAGE_ID as {data_source}:{tgt}:{col}:{srchash}. The
-- loader never implemented it and wrote {tgt}:{col} instead, which means
-- load() upserted every source chain for one DWH column onto ONE row: a
-- column fed by two sources kept whichever row the sheet listed last, and
-- the fan-in was gone before it reached the database.
--
-- The connector now writes the specified format. Because load() UPSERTS on
-- LINEAGE_ID and never deletes, the next reload INSERTS the new-format rows
-- and LEAVES the old-format ones in place — so every field would be counted
-- twice and every coverage percentage would be wrong in a new way.
--
-- ORDER MATTERS: reload first, then run this. Running it before the reload
-- empties the table until the reload finishes.
--
--   1. reload the workbook with the fixed connector
--   2. run STEP 1 below and read the numbers
--   3. run STEP 2 only if they look right
--
-- The rule is precise rather than clever: a row belongs to the new format iff
-- its id starts with '{data_source}:'. Nothing is matched on colon counts —
-- a table or column name containing a colon would make that wrong.
-- ============================================================================

-- Set this to the warehouse you just reloaded.
DEFINE ds = 'PBDW'

-- ---------------------------------------------------------------- STEP 1 ---
-- Look before deleting. old_format is what STEP 2 removes; new_format is what
-- the reload just wrote. If new_format is 0 the reload did not run, or ran
-- with an older connector — stop, and do not run STEP 2.
SELECT COUNT(*)                                                AS total_rows,
       COUNT(CASE WHEN lineage_id LIKE '&ds' || ':%'
                  THEN 1 END)                                  AS new_format,
       COUNT(CASE WHEN lineage_id NOT LIKE '&ds' || ':%'
                  THEN 1 END)                                  AS old_format,
       COUNT(DISTINCT dwh_target_table || '.' || dwh_target_column)
                                                               AS target_columns
FROM   legacy_lineage
WHERE  NVL(data_source, '&ds') = '&ds';

-- How much fan-in the old key was destroying: rows per target column above 1.
SELECT COUNT(*)            AS target_columns_with_fan_in,
       SUM(n) - COUNT(*)   AS chains_previously_lost
FROM (
  SELECT dwh_target_table, dwh_target_column, COUNT(*) AS n
  FROM   legacy_lineage
  WHERE  lineage_id LIKE '&ds' || ':%'
  GROUP  BY dwh_target_table, dwh_target_column
  HAVING COUNT(*) > 1);

-- ---------------------------------------------------------------- STEP 2 ---
-- Only after STEP 1 shows a healthy new_format count.
-- DELETE FROM legacy_lineage
-- WHERE  NVL(data_source, '&ds') = '&ds'
--   AND  lineage_id NOT LIKE '&ds' || ':%';
-- COMMIT;

-- ---------------------------------------------------------------- STEP 3 ---
-- Rows loaded before sql/29 have a NULL data_source and the API's
-- ?data_source= filter cannot see them. Harmless to run more than once.
-- UPDATE legacy_lineage SET data_source = '&ds' WHERE data_source IS NULL;
-- COMMIT;
