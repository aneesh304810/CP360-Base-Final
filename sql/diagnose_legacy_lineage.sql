-- Diagnose the legacy catalogue: what is actually IN legacy_lineage.
--
-- Same facts as GET /legacy-lineage/profile, for when restarting the API is
-- inconvenient. Read-only — every statement is a SELECT.
--
-- Run all six and paste the output back. Q3 and Q4 are the ones that decide
-- the grouping; Q2 decides the coverage percentages.
--
-- Oracle. On Postgres: drop the FROM dual, and replace
-- "WHERE ROWNUM <= n" with "LIMIT n".

PROMPT ===== Q1  which columns exist =====
SELECT column_id, column_name, data_type, data_length, nullable
FROM   user_tab_columns
WHERE  table_name = 'LEGACY_LINEAGE'
ORDER  BY column_id;

PROMPT ===== Q2  lineage_status vocabulary (decides every % mapped) =====
SELECT NVL(lineage_status, '(null)')                        AS lineage_status,
       COUNT(*)                                             AS rows_,
       COUNT(dwh_target_column)                             AS with_target,
       COUNT(DISTINCT src_source_table)                     AS src_tables
FROM   legacy_lineage
GROUP  BY NVL(lineage_status, '(null)')
ORDER  BY COUNT(*) DESC;

PROMPT ===== Q3  is there anything to group BY? (nulls + cardinality) =====
-- A column can be the L0 spine only if populated_rows is high AND buckets is
-- a readable number. Add any column Q1 shows that is not listed here.
SELECT 'FUNCTIONAL_GROUP' AS column_name, COUNT(functional_group) AS populated_rows,
       COUNT(DISTINCT functional_group) AS buckets, COUNT(*) AS total_rows
FROM legacy_lineage
UNION ALL SELECT 'SRC_SOURCE_TABLE', COUNT(src_source_table),
       COUNT(DISTINCT src_source_table), COUNT(*) FROM legacy_lineage
UNION ALL SELECT 'STG1_SOURCE_TABLE', COUNT(stg1_source_table),
       COUNT(DISTINCT stg1_source_table), COUNT(*) FROM legacy_lineage
UNION ALL SELECT 'DWH_TARGET_TABLE', COUNT(dwh_target_table),
       COUNT(DISTINCT dwh_target_table), COUNT(*) FROM legacy_lineage
UNION ALL SELECT 'DATA_SOURCE', COUNT(data_source),
       COUNT(DISTINCT data_source), COUNT(*) FROM legacy_lineage;

PROMPT ===== Q4  the actual names (this is what the buckets would read) =====
SELECT * FROM (
  SELECT NVL(functional_group, '(null)') AS functional_group, COUNT(*) AS rows_,
         COUNT(DISTINCT src_source_table) AS src_tables
  FROM   legacy_lineage
  GROUP  BY NVL(functional_group, '(null)')
  ORDER  BY COUNT(*) DESC)
WHERE ROWNUM <= 30;

PROMPT ===== Q5  the source files themselves (the thing L0 lists) =====
SELECT * FROM (
  SELECT src_source_table,
         MIN(stg1_source_table)                    AS stg1_table,
         MIN(dwh_target_table)                     AS a_target_table,
         COUNT(DISTINCT src_source_column)         AS fields,
         COUNT(DISTINCT dwh_target_table)          AS target_tables
  FROM   legacy_lineage
  WHERE  src_source_table IS NOT NULL
  GROUP  BY src_source_table
  ORDER  BY COUNT(DISTINCT src_source_column) DESC)
WHERE ROWNUM <= 40;

PROMPT ===== Q6  three whole rows, so the shape is not guessed at =====
SELECT * FROM legacy_lineage WHERE ROWNUM <= 3;

PROMPT ===== Q7  what else is in the schema (a grouping may live elsewhere) =====
SELECT table_name, num_rows FROM user_tables ORDER BY table_name;
