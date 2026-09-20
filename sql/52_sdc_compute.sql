-- ============================================================================
-- 52_sdc_compute.sql — SDC client compute sizing, as tables.
--
-- Source: the "SDC Client compute sizing reference" workbook — three sheets,
-- Summary / Daily Totals / Day_wise_views_queried — one per reference client
-- per measured period. More clients are more PERIOD rows; nothing here is
-- single-tenant and nothing has to be rebuilt to add the next one.
--
-- WHAT THIS MEASURES, AND WHY EVENT 360 CARES
--
-- It measures warehouse compute against SDC views: queries, rows, GB scanned,
-- elapsed seconds, on a sized warehouse. That is the READ-BACK. Consumption
-- rule 1 says an event is a notification and the consumer must fetch the
-- record from the SDC view named in the payload, so this is the bill for
-- obeying the contract. The chain a projection runs on is
--
--     event -> META_EVENT_DEFINITION.SDC_VIEW -> that view's measured
--           seconds per query -> warehouse hours -> credits -> money
--
-- THE THREE THINGS TO READ BEFORE BUILDING ON THIS
--
-- 1. COST ATTACHES TO THE VIEW, NOT TO THE EVENT. Twenty events naming
--    ACCOUNT_BASIC_VIEW cost about what one of them costs, because the view is
--    read either way. Any query that divides a period total by the number of
--    events has the economics backwards. Join through OBJECT_NAME.
--
-- 2. VIEW_COVERAGE_PCT ON THE PERIOD ROW IS A GUARD, NOT A STATISTIC. It is
--    the per-view sheet's share of the Summary sheet's query count. A workbook
--    listing only the busiest views can cover a fraction of real traffic, and
--    every figure derived from the view grain is then that same fraction of
--    the truth. Read it before quoting any number from here; below 97 the
--    loader records the shortfall and the projection is a FLOOR.
--
-- 3. ELAPSED_SEC IS SUMMED QUERY TIME, NOT WAREHOUSE UPTIME. A warehouse runs
--    queries concurrently and stays up across idle gaps, so the invoice can
--    fall either side of this sum. It is stored as measured. Any conversion to
--    money must state its concurrency assumption; none is stored here because
--    none was measured.
--
-- Idempotent: every statement tolerates re-running.
-- ============================================================================

DECLARE e EXCEPTION; PRAGMA EXCEPTION_INIT(e, -955);
BEGIN EXECUTE IMMEDIATE '
  CREATE TABLE ref_warehouse_size (
    wh_size           VARCHAR2(10)  NOT NULL,
    credits_per_hour  NUMBER(6,2)   NOT NULL,
    updated_at        TIMESTAMP DEFAULT SYSTIMESTAMP,
    CONSTRAINT pk_ref_warehouse_size PRIMARY KEY (wh_size))';
EXCEPTION WHEN e THEN NULL; END;
/

MERGE INTO ref_warehouse_size t USING (SELECT 'XS'  s, 1   c FROM dual) s
  ON (t.wh_size=s.s) WHEN NOT MATCHED THEN INSERT (wh_size,credits_per_hour) VALUES (s.s,s.c);
MERGE INTO ref_warehouse_size t USING (SELECT 'S'   s, 2   c FROM dual) s
  ON (t.wh_size=s.s) WHEN NOT MATCHED THEN INSERT (wh_size,credits_per_hour) VALUES (s.s,s.c);
MERGE INTO ref_warehouse_size t USING (SELECT 'M'   s, 4   c FROM dual) s
  ON (t.wh_size=s.s) WHEN NOT MATCHED THEN INSERT (wh_size,credits_per_hour) VALUES (s.s,s.c);
MERGE INTO ref_warehouse_size t USING (SELECT 'L'   s, 8   c FROM dual) s
  ON (t.wh_size=s.s) WHEN NOT MATCHED THEN INSERT (wh_size,credits_per_hour) VALUES (s.s,s.c);
MERGE INTO ref_warehouse_size t USING (SELECT 'XL'  s, 16  c FROM dual) s
  ON (t.wh_size=s.s) WHEN NOT MATCHED THEN INSERT (wh_size,credits_per_hour) VALUES (s.s,s.c);
MERGE INTO ref_warehouse_size t USING (SELECT '2XL' s, 32  c FROM dual) s
  ON (t.wh_size=s.s) WHEN NOT MATCHED THEN INSERT (wh_size,credits_per_hour) VALUES (s.s,s.c);
MERGE INTO ref_warehouse_size t USING (SELECT '3XL' s, 64  c FROM dual) s
  ON (t.wh_size=s.s) WHEN NOT MATCHED THEN INSERT (wh_size,credits_per_hour) VALUES (s.s,s.c);
MERGE INTO ref_warehouse_size t USING (SELECT '4XL' s, 128 c FROM dual) s
  ON (t.wh_size=s.s) WHEN NOT MATCHED THEN INSERT (wh_size,credits_per_hour) VALUES (s.s,s.c);
COMMIT;

-- One row per client per measured period. PERIOD_ID is derived, not a
-- sequence: '<CLIENT>:<first_day>:<last_day>'. Re-loading the same workbook
-- therefore updates its own rows instead of accumulating a second copy, and
-- loading next month's extract adds a period beside this one rather than
-- overwriting the history you are trying to build a trend from.
DECLARE e EXCEPTION; PRAGMA EXCEPTION_INIT(e, -955);
BEGIN EXECUTE IMMEDIATE '
  CREATE TABLE meta_sdc_compute_period (
    period_id          VARCHAR2(120) NOT NULL,
    client_code        VARCHAR2(40)  NOT NULL,
    first_day          DATE,
    last_day           DATE,
    period_days        NUMBER(6),
    accounts           NUMBER(12),
    positions          NUMBER(14),      -- NULL until someone measures it
    transactions       NUMBER(14),      -- NULL until someone measures it
    warehouse          VARCHAR2(10),
    -- as the Summary sheet states them
    sum_queries        NUMBER(14),
    sum_rows           NUMBER(18),
    sum_gb             NUMBER(16,4),
    sum_elapsed_sec    NUMBER(16,2),
    -- as the per-view grain actually adds up
    view_queries       NUMBER(14),
    view_gb            NUMBER(16,4),
    view_elapsed_sec   NUMBER(16,2),
    -- read note 2 in the header before using anything derived from the views
    view_coverage_pct  NUMBER(6,2),
    -- the two together say WHY coverage is short: fewer days, or fewer views
    view_days          NUMBER(6),
    daily_days         NUMBER(6),
    source_file        VARCHAR2(260),
    loaded_at          TIMESTAMP DEFAULT SYSTIMESTAMP,
    CONSTRAINT pk_meta_sdc_compute_period PRIMARY KEY (period_id))';
EXCEPTION WHEN e THEN NULL; END;
/

DECLARE e EXCEPTION; PRAGMA EXCEPTION_INIT(e, -955);
BEGIN EXECUTE IMMEDIATE '
  CREATE TABLE meta_sdc_compute_daily (
    period_id          VARCHAR2(120) NOT NULL,
    activity_date      DATE          NOT NULL,
    queries            NUMBER(14),
    rows_selected      NUMBER(18),
    gb_scanned         NUMBER(16,4),
    elapsed_sec        NUMBER(16,2),
    hours              NUMBER(12,4),
    updated_at         TIMESTAMP DEFAULT SYSTIMESTAMP,
    CONSTRAINT pk_meta_sdc_compute_daily PRIMARY KEY (period_id, activity_date))';
EXCEPTION WHEN e THEN NULL; END;
/

-- The model grain. OBJECT_NAME is stored verbatim, schema prefix and all:
-- I02_STAGE.TRANSACTION_BASIC_VIEW and TRANSACTION_BASIC_VIEW are different
-- objects with different costs, and folding them together to make the join to
-- SDC_VIEW tidier would merge two bills into one.
DECLARE e EXCEPTION; PRAGMA EXCEPTION_INIT(e, -955);
BEGIN EXECUTE IMMEDIATE '
  CREATE TABLE meta_sdc_compute_view (
    period_id          VARCHAR2(120) NOT NULL,
    activity_date      DATE          NOT NULL,
    object_name        VARCHAR2(200) NOT NULL,
    queries            NUMBER(14),
    rows_selected      NUMBER(18),
    gb_scanned         NUMBER(16,4),
    elapsed_sec        NUMBER(16,2),
    hours              NUMBER(12,6),
    updated_at         TIMESTAMP DEFAULT SYSTIMESTAMP,
    CONSTRAINT pk_meta_sdc_compute_view
      PRIMARY KEY (period_id, activity_date, object_name))';
EXCEPTION WHEN e THEN NULL; END;
/

DECLARE e EXCEPTION; PRAGMA EXCEPTION_INIT(e, -955);
BEGIN EXECUTE IMMEDIATE
  'CREATE INDEX ix_sdc_view_object ON meta_sdc_compute_view (object_name)';
EXCEPTION WHEN e THEN NULL; END;
/
DECLARE e EXCEPTION; PRAGMA EXCEPTION_INIT(e, -955);
BEGIN EXECUTE IMMEDIATE
  'CREATE INDEX ix_sdc_period_client ON meta_sdc_compute_period (client_code, last_day)';
EXCEPTION WHEN e THEN NULL; END;
/

-- The per-view profile over a whole period: what one read of this view costs
-- in time. Multiply by a credit price and a concurrency assumption to get
-- money; this view deliberately stops short of money, because the two numbers
-- that turn time into money are commercial and are not measured in the
-- workbook.
CREATE OR REPLACE VIEW v_sdc_view_profile AS
SELECT v.period_id,
       p.client_code,
       p.accounts,
       p.warehouse,
       w.credits_per_hour,
       p.period_days,
       p.view_coverage_pct,
       v.object_name,
       SUM(v.queries)               AS queries,
       SUM(v.rows_selected)         AS rows_selected,
       SUM(v.gb_scanned)            AS gb_scanned,
       SUM(v.elapsed_sec)           AS elapsed_sec,
       SUM(v.elapsed_sec)/3600      AS elapsed_hours,
       CASE WHEN SUM(v.queries) > 0
            THEN SUM(v.elapsed_sec)/SUM(v.queries) END AS sec_per_query,
       CASE WHEN SUM(v.queries) > 0
            THEN SUM(v.gb_scanned)/SUM(v.queries) END  AS gb_per_query,
       CASE WHEN p.period_days > 0
            THEN SUM(v.elapsed_sec)/p.period_days END  AS sec_per_day
  FROM meta_sdc_compute_view v
  JOIN meta_sdc_compute_period p ON p.period_id = v.period_id
  LEFT JOIN ref_warehouse_size w ON w.wh_size  = p.warehouse
 GROUP BY v.period_id, p.client_code, p.accounts, p.warehouse,
          w.credits_per_hour, p.period_days, p.view_coverage_pct, v.object_name;

-- ------------------------------------------------------- post-load checks --
-- The loader asserts these itself and refuses to commit a bad load; this is
-- the independent second opinion.
--
-- SELECT 'view grain covers < 97% of Summary' AS gate, period_id, view_coverage_pct
--   FROM meta_sdc_compute_period WHERE view_coverage_pct < 97
-- UNION ALL
-- SELECT 'daily rows outside the period', period_id, COUNT(*) FROM meta_sdc_compute_daily d
--   WHERE NOT EXISTS (SELECT 1 FROM meta_sdc_compute_period p
--                      WHERE p.period_id = d.period_id
--                        AND d.activity_date BETWEEN p.first_day AND p.last_day)
--   GROUP BY period_id HAVING COUNT(*) > 0
-- UNION ALL
-- SELECT 'view rows with no period', period_id, COUNT(*) FROM meta_sdc_compute_view v
--   WHERE NOT EXISTS (SELECT 1 FROM meta_sdc_compute_period p WHERE p.period_id = v.period_id)
--   GROUP BY period_id HAVING COUNT(*) > 0;
--
-- Stale-row cleanup, for the case where a period is RELOADED SMALLER than it
-- was (a re-extract with fewer days or fewer views). MERGE updates and
-- inserts; it never deletes, so rows from the wider load would survive and
-- inflate every total. Run this immediately after such a reload, with the
-- loaded_at of the run you just did:
--
-- DELETE FROM meta_sdc_compute_view  WHERE period_id = :pid AND updated_at < :run_started;
-- DELETE FROM meta_sdc_compute_daily WHERE period_id = :pid AND updated_at < :run_started;
-- COMMIT;
