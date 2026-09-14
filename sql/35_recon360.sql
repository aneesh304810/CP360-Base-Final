-- ============================================================================
-- 35_recon360.sql — Recon 360 parallel-run reconciliation store (SILVER).
-- Idempotent (-955 tolerant). Break rows hold SAMPLES only, PII-masked.
-- ============================================================================
BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE recon_pr_runs (
      run_id        VARCHAR2(40) PRIMARY KEY,
      side_a        VARCHAR2(60),
      side_b        VARCHAR2(60),
      schema_a      VARCHAR2(60),
      schema_b      VARCHAR2(60),
      scope_desc    VARCHAR2(400),
      depth         VARCHAR2(20),        -- SCHEMA | AGG | ROWHASH
      status        VARCHAR2(20),        -- RUNNING | COMPLETE | FAILED
      step          VARCHAR2(200),
      tables_total  NUMBER,
      tables_done   NUMBER,
      match_rate    NUMBER,
      started_at    TIMESTAMP DEFAULT SYSTIMESTAMP,
      finished_at   TIMESTAMP,
      error_text    VARCHAR2(2000)
)';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
/
BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE recon_pr_schema (
      run_id      VARCHAR2(40),
      table_name  VARCHAR2(200),
      drift_type  VARCHAR2(30),   -- B_MISSING_TABLE | A_MISSING_TABLE |
                                  -- B_MISSING_COL | A_MISSING_COL | TYPE_DRIFT
                                  -- | NULLABILITY
      column_name VARCHAR2(200),
      a_def       VARCHAR2(200),
      b_def       VARCHAR2(200),
      severity    VARCHAR2(12)    -- DRIFT | FIX_FIRST
)';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
/
BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE recon_pr_table (
      run_id        VARCHAR2(40),
      table_name    VARCHAR2(200),
      pk_cols       VARCHAR2(400),
      cnt_a         NUMBER,
      cnt_b         NUMBER,
      cols_compared NUMBER,
      metric_breaks VARCHAR2(2000),  -- e.g. SUM(AMOUNT) dA=12844.16
      missing_b     NUMBER,
      extra_b       NUMBER,
      mismatch      NUMBER,
      status        VARCHAR2(12),    -- GREEN | AMBER | RED | SKIPPED
      note          VARCHAR2(400),
      CONSTRAINT pk_recon_pr_table PRIMARY KEY (run_id, table_name)
)';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
/
BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE recon_pr_break (
      run_id      VARCHAR2(40),
      table_name  VARCHAR2(200),
      break_type  VARCHAR2(20),      -- MISSING_B | EXTRA_B | MISMATCH
      pk_value    VARCHAR2(400),
      cols_differ VARCHAR2(1000),
      a_values    VARCHAR2(2000),    -- col=val · masked when PII
      b_values    VARCHAR2(2000)
)';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
/
BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE recon_pr_config (
      scope       VARCHAR2(200),     -- GLOBAL or table name
      rule_type   VARCHAR2(20),      -- IGNORE_COLS | NUM_TOL | DATE_ONLY |
                                     -- PK_COLS | SKIP_TABLE
      column_name VARCHAR2(200),
      rule_value  VARCHAR2(400),
      note        VARCHAR2(400),
      created_at  TIMESTAMP DEFAULT SYSTIMESTAMP
)';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
/
-- sensible defaults (idempotent-ish: only insert if table empty)
DECLARE n NUMBER;
BEGIN
  SELECT COUNT(*) INTO n FROM recon_pr_config;
  IF n = 0 THEN
    INSERT INTO recon_pr_config (scope, rule_type, column_name, rule_value, note)
    VALUES ('GLOBAL', 'IGNORE_COLS', NULL,
            'LOAD_DATE,BATCH_ID,CREATED_TSP,UPDATED_TSP,ETL_TSP,ROW_HASH',
            'warehouse metadata — legitimately differs');
    COMMIT;
  END IF;
END;
/
