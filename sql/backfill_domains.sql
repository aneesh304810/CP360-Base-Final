-- =====================================================================
-- backfill_domains.sql
-- Populates datasets.domain (feeds) and ldr_catalog.business_domain
-- (loaders) by inferring a business domain from the object name, so the
-- Inbound Feeds / Loaders / Interdependency screens group properly instead
-- of dumping everything into "Other" / "Unassigned".
--
-- Safe to re-run. Only fills rows where domain is currently NULL/blank, so
-- it never overwrites a domain you've already curated. Run under SILVER.
-- After running, restart uvicorn and hard-refresh the UI.
-- =====================================================================
SET DEFINE OFF;
SET SCAN OFF;

-- 1. FEEDS: infer datasets.domain from object_name (only where empty)
--    Add/adjust the WHEN branches to match your real feed naming.
UPDATE datasets d
SET d.domain = CASE
    WHEN LOWER(d.object_name) LIKE '%account%'      THEN 'Account and Client'
    WHEN LOWER(d.object_name) LIKE '%client%'       THEN 'Account and Client'
    WHEN LOWER(d.object_name) LIKE '%position%'     THEN 'Positions'
    WHEN LOWER(d.object_name) LIKE '%taxlot%'       THEN 'Positions'
    WHEN LOWER(d.object_name) LIKE '%holding%'      THEN 'Positions'
    WHEN LOWER(d.object_name) LIKE '%transaction%'  THEN 'Transactions'
    WHEN LOWER(d.object_name) LIKE '%settlement%'   THEN 'Transactions'
    WHEN LOWER(d.object_name) LIKE '%cash%'         THEN 'Cash'
    WHEN LOWER(d.object_name) LIKE '%fee%'          THEN 'Fee and Billing'
    WHEN LOWER(d.object_name) LIKE '%accrual%'      THEN 'Fee and Billing'
    WHEN LOWER(d.object_name) LIKE '%bill%'         THEN 'Fee and Billing'
    WHEN LOWER(d.object_name) LIKE '%asset%'        THEN 'Reference and Asset'
    WHEN LOWER(d.object_name) LIKE '%security%'     THEN 'Reference and Asset'
    WHEN LOWER(d.object_name) LIKE '%instrument%'   THEN 'Reference and Asset'
    WHEN LOWER(d.object_name) LIKE '%portfolio%'    THEN 'Portfolio and Model'
    WHEN LOWER(d.object_name) LIKE '%model%'        THEN 'Portfolio and Model'
    WHEN LOWER(d.object_name) LIKE '%allocation%'   THEN 'Portfolio and Model'
    WHEN LOWER(d.object_name) LIKE '%fx%'           THEN 'FX and Derivatives'
    WHEN LOWER(d.object_name) LIKE '%forward%'      THEN 'FX and Derivatives'
    WHEN LOWER(d.object_name) LIKE '%corporate%'    THEN 'Corporate Actions'
    WHEN LOWER(d.object_name) LIKE '%dividend%'     THEN 'Corporate Actions'
    WHEN LOWER(d.object_name) LIKE '%nav%'          THEN 'Valuation'
    WHEN LOWER(d.object_name) LIKE '%performance%'  THEN 'Valuation'
    WHEN LOWER(d.object_name) LIKE '%statement%'    THEN 'Reporting'
    ELSE 'Other'
  END
WHERE d.object_type = 'FEED'
  AND (d.domain IS NULL OR TRIM(d.domain) IS NULL);

-- 1b. Also populate tags (workstream) from domain if workstream is empty,
--     so the Inbound Feeds grouping (which reads tags) lines up too.
UPDATE datasets d
SET d.tags = d.domain
WHERE d.object_type = 'FEED'
  AND (d.tags IS NULL OR TRIM(d.tags) IS NULL)
  AND d.domain IS NOT NULL;

-- 2. LOADERS: infer ldr_catalog.business_domain from loader name/id
UPDATE ldr_catalog l
SET l.business_domain = CASE
    WHEN LOWER(l.loader_name) LIKE '%account%'     THEN 'Account and Client'
    WHEN LOWER(l.loader_name) LIKE '%client%'      THEN 'Account and Client'
    WHEN LOWER(l.loader_name) LIKE '%position%'    THEN 'Positions'
    WHEN LOWER(l.loader_name) LIKE '%transaction%' THEN 'Transactions'
    WHEN LOWER(l.loader_name) LIKE '%cash%'        THEN 'Cash'
    WHEN LOWER(l.loader_name) LIKE '%fee%'         THEN 'Fee and Billing'
    WHEN LOWER(l.loader_name) LIKE '%asset%'       THEN 'Reference and Asset'
    WHEN LOWER(l.loader_name) LIKE '%portfolio%'   THEN 'Portfolio and Model'
    WHEN LOWER(l.loader_name) LIKE '%model%'       THEN 'Portfolio and Model'
    ELSE 'Other'
  END
WHERE l.business_domain IS NULL OR TRIM(l.business_domain) IS NULL;

-- mirror to loader_catalog if that table is what your view reads
UPDATE loader_catalog l
SET l.business_domain = CASE
    WHEN LOWER(l.loader_name) LIKE '%account%'     THEN 'Account and Client'
    WHEN LOWER(l.loader_name) LIKE '%client%'      THEN 'Account and Client'
    WHEN LOWER(l.loader_name) LIKE '%position%'    THEN 'Positions'
    WHEN LOWER(l.loader_name) LIKE '%transaction%' THEN 'Transactions'
    WHEN LOWER(l.loader_name) LIKE '%cash%'        THEN 'Cash'
    WHEN LOWER(l.loader_name) LIKE '%fee%'         THEN 'Fee and Billing'
    WHEN LOWER(l.loader_name) LIKE '%asset%'       THEN 'Reference and Asset'
    WHEN LOWER(l.loader_name) LIKE '%portfolio%'   THEN 'Portfolio and Model'
    WHEN LOWER(l.loader_name) LIKE '%model%'       THEN 'Portfolio and Model'
    ELSE 'Other'
  END
WHERE l.business_domain IS NULL OR TRIM(l.business_domain) IS NULL;

COMMIT;

-- 3. Verify — should now show real domains, not one big 'Other'
SELECT NVL(domain,'(null)') domain, COUNT(*) feeds
FROM datasets WHERE object_type='FEED' GROUP BY NVL(domain,'(null)') ORDER BY feeds DESC;
