-- 62_business_catalog_check.sql ------------------------------------------
-- Read-only. What the INGESTED data actually says, so the catalogue is
-- checked against it rather than against anyone's reading of the names.
--
-- FUNCTIONAL_GROUP is already loaded and is the authority. Everything the
-- catalogue adds — a business name, a sentence, a grain — is only the layer
-- that is missing. These five queries say whether that is true, how the
-- real groups are distributed, and where the taxonomy leaves tables with
-- nowhere sensible to sit.
--
-- Nothing here writes. Run it before trusting a single figure quoted from
-- the catalogue's own suggested_group column.

-- 1. The real distribution. This replaces every count derived from table
--    names: it is the workbook's own answer, per warehouse table.
SELECT NVL(functional_group, '(no group on the row)') AS functional_group,
       COUNT(DISTINCT dwh_target_table) AS tables_,
       COUNT(DISTINCT dwh_target_column) AS columns_,
       COUNT(*) AS lineage_rows
FROM   legacy_lineage
WHERE  (data_source = 'PBDW' OR data_source IS NULL)
GROUP  BY NVL(functional_group, '(no group on the row)')
ORDER  BY COUNT(DISTINCT dwh_target_table) DESC;

-- 2. Tables whose rows disagree about the group. One table carrying two
--    groups is not an error, but a business view has to pick one, and it
--    should pick knowingly.
SELECT dwh_target_table,
       COUNT(DISTINCT functional_group) AS groups_,
       LISTAGG(DISTINCT functional_group, ' | ')
         WITHIN GROUP (ORDER BY functional_group) AS which
FROM   legacy_lineage
WHERE  (data_source = 'PBDW' OR data_source IS NULL)
  AND  functional_group IS NOT NULL
GROUP  BY dwh_target_table
HAVING COUNT(DISTINCT functional_group) > 1
ORDER  BY 2 DESC, 1;

-- 3. The buckets that are a to-do list rather than a domain. If these hold
--    real numbers, the Business view's landing screen is mostly them.
SELECT NVL(functional_group,'(none)') AS functional_group,
       COUNT(DISTINCT dwh_target_table) AS tables_,
       COUNT(DISTINCT dwh_target_column) AS columns_
FROM   legacy_lineage
WHERE  (data_source = 'PBDW' OR data_source IS NULL)
  AND (functional_group IS NULL
       OR UPPER(TRIM(functional_group)) IN ('OTHER','HISTORY','REVIEW REQUIRED'))
GROUP  BY NVL(functional_group,'(none)')
ORDER  BY 2 DESC;

-- 4. Which tables those are. This is the list the four proposed groups
--    (Fees & Billing, Compliance & Oversight, Lending & Credit, Tax) were
--    guessed at from — the data decides whether they are needed.
SELECT DISTINCT dwh_target_table, NVL(functional_group,'(none)') AS functional_group
FROM   legacy_lineage
WHERE  (data_source = 'PBDW' OR data_source IS NULL)
  AND (functional_group IS NULL
       OR UPPER(TRIM(functional_group)) IN ('OTHER','HISTORY','REVIEW REQUIRED'))
ORDER  BY 2, 1;

-- 5. Catalogue coverage, both ways. A table in the warehouse with no
--    business name is a blank card; a catalogue row for a table that is not
--    there is a card for something that does not exist.
SELECT 'in lineage, not catalogued' AS gap, l.dwh_target_table AS table_name
FROM  (SELECT DISTINCT dwh_target_table FROM legacy_lineage
       WHERE (data_source = 'PBDW' OR data_source IS NULL)
         AND dwh_target_table IS NOT NULL) l
LEFT  JOIN business_catalog c
       ON c.data_source = 'PBDW' AND c.table_name = l.dwh_target_table
WHERE c.table_name IS NULL
UNION ALL
SELECT 'catalogued, not in lineage', c.table_name
FROM   business_catalog c
LEFT   JOIN (SELECT DISTINCT dwh_target_table FROM legacy_lineage
             WHERE (data_source = 'PBDW' OR data_source IS NULL)) l
       ON l.dwh_target_table = c.table_name
WHERE  c.data_source = 'PBDW' AND l.dwh_target_table IS NULL
ORDER  BY 1, 2;
