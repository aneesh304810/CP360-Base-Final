-- =====================================================================
-- interdependency_data_quality.sql
-- Run these BEFORE relying on the Feed/Loader Interdependency graph.
-- They tell you whether the underlying key fields and descriptions are
-- good enough for meaningful edges. Run under the SILVER schema.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. WHICH key fields actually exist across feeds/loaders?
--    (Tune KEY_PATTERNS in routers_interdependency.py against this.)
--    Shows each key-ish column, how many feeds and loaders carry it.
-- ---------------------------------------------------------------------
SELECT LOWER(column_name) AS key_field,
       SUM(CASE WHEN schema_name <> 'LOADERS' THEN 1 ELSE 0 END) AS in_feeds,
       SUM(CASE WHEN schema_name =  'LOADERS' THEN 1 ELSE 0 END) AS in_loaders,
       COUNT(*) AS total_occurrences
FROM columns
WHERE (  LOWER(column_name) LIKE '%account_number%'
      OR LOWER(column_name) LIKE '%account_id%'
      OR LOWER(column_name) LIKE '%portfolio_id%'
      OR LOWER(column_name) LIKE '%client_id%'
      OR LOWER(column_name) LIKE '%form_id%'
      OR LOWER(column_name) LIKE '%position_id%'
      OR LOWER(column_name) LIKE '%asset_id%'
      OR LOWER(column_name) LIKE '%cusip%'
      OR LOWER(column_name) LIKE '%isin%'
      OR LOWER(column_name) LIKE '%_id'
      OR LOWER(column_name) LIKE '%_number'
      OR LOWER(column_name) LIKE '%_nbr%')
GROUP BY LOWER(column_name)
ORDER BY total_occurrences DESC;

-- ---------------------------------------------------------------------
-- 2. NAMING INCONSISTENCY hunt — variants of "account" that DON'T match
--    the canonical 'account_number'. These are the missed-edge risks.
--    (e.g. ACCT_NBR, ACCOUNT_NO, ACCTNUM won't link to ACCOUNT_NUMBER.)
-- ---------------------------------------------------------------------
SELECT LOWER(column_name) AS variant, COUNT(*) AS occurrences
FROM columns
WHERE ( LOWER(column_name) LIKE '%acct%'
     OR LOWER(column_name) LIKE '%account%' )
  AND LOWER(column_name) NOT LIKE '%account_number%'
GROUP BY LOWER(column_name)
ORDER BY occurrences DESC;

-- ---------------------------------------------------------------------
-- 3. MISSING business descriptions on key fields.
--    Edges still draw without these, but you lose the MATCH/mismatch
--    validation and the business story. Aim for 0 rows here.
-- ---------------------------------------------------------------------
SELECT schema_name, object_name, column_name
FROM columns
WHERE ( LOWER(column_name) LIKE '%account_number%'
     OR LOWER(column_name) LIKE '%portfolio_id%'
     OR LOWER(column_name) LIKE '%client_id%'
     OR LOWER(column_name) LIKE '%form_id%' )
  AND business_desc IS NULL
  AND tech_desc IS NULL
ORDER BY schema_name, object_name;

-- ---------------------------------------------------------------------
-- 4. DESCRIPTION MISMATCH preview — the SAME key described DIFFERENTLY
--    in different feeds. These become the ⚠ CHECK edges in the UI.
--    Review these: either a naming coincidence (false link) or a real
--    inconsistency to fix.
-- ---------------------------------------------------------------------
SELECT LOWER(column_name) AS key_field,
       COUNT(DISTINCT LOWER(TRIM(
         CASE WHEN business_desc IS NULL THEN tech_desc ELSE business_desc END))) AS distinct_descriptions,
       COUNT(*) AS carriers
FROM columns
WHERE LOWER(column_name) LIKE '%account_number%'
   OR LOWER(column_name) LIKE '%portfolio_id%'
   OR LOWER(column_name) LIKE '%client_id%'
GROUP BY LOWER(column_name)
HAVING COUNT(DISTINCT LOWER(TRIM(
         CASE WHEN business_desc IS NULL THEN tech_desc ELSE business_desc END))) > 1
ORDER BY distinct_descriptions DESC;

-- ---------------------------------------------------------------------
-- 5. DOMAIN coverage — feeds/loaders with no domain fall into
--    "Unassigned" (bad swimlane lanes / hub clustering).
-- ---------------------------------------------------------------------
-- feeds:
SELECT NVL(domain, '(no domain)') AS domain, COUNT(*) AS feeds
FROM datasets WHERE object_type = 'FEED'
GROUP BY NVL(domain, '(no domain)') ORDER BY feeds DESC;

-- loaders:
SELECT NVL(business_domain, '(no domain)') AS domain, COUNT(*) AS loaders
FROM ldr_catalog
GROUP BY NVL(business_domain, '(no domain)') ORDER BY loaders DESC;

-- ---------------------------------------------------------------------
-- 6. EDGE PREVIEW — how many feed-pairs would link on account_number?
--    Sanity-check the graph density before opening the UI.
--    (High number on one key = expected; that key is a hub.)
-- ---------------------------------------------------------------------
SELECT LOWER(a.column_name) AS shared_key, COUNT(*) AS feed_pairs
FROM columns a
JOIN columns b
  ON LOWER(a.column_name) = LOWER(b.column_name)
 AND a.object_name < b.object_name
 AND a.schema_name <> 'LOADERS'
 AND b.schema_name <> 'LOADERS'
WHERE LOWER(a.column_name) LIKE '%account_number%'
   OR LOWER(a.column_name) LIKE '%portfolio_id%'
   OR LOWER(a.column_name) LIKE '%client_id%'
GROUP BY LOWER(a.column_name)
ORDER BY feed_pairs DESC;
