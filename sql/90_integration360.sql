-- ============================================================================
-- 90_integration360.sql
-- Integration 360: what Airflow and dbt report about each run, kept as rows so
-- the page reads records, not logs. Written only by
-- api/app/routers_integration360.py through the API's db layer.
--   i360_run   one row per DAG run (or dbt invocation) per pipeline
--   i360_task  one row per task event: state, try, duration, the error line
--   i360_test  one row per check: a dbt test or model result, a source
--              freshness check, a Great Expectations or Soda check, or a
--              loader error code; the column it is about; expected, observed,
--              threshold, failures; a capped sample of the bad rows as JSON
--   i360_note  the root cause and the action a person types against a finding
-- Identifiers and counts only; no credential, hostname or client value beyond
-- what the check itself reports. Idempotent (ORA-955 / ORA-1430 / ORA-1408).
-- ============================================================================
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE i360_run (
      run_key       VARCHAR2(200)  NOT NULL,   -- dag_id || : || run_id
      dag_id        VARCHAR2(200)  NOT NULL,
      run_id        VARCHAR2(200),
      business_date VARCHAR2(10),              -- YYYY-MM-DD when the run says
      state         VARCHAR2(20),              -- running | success | failed | queued
      source        VARCHAR2(20),              -- airflow | dbt | check
      started_at    TIMESTAMP,
      ended_at      TIMESTAMP,
      received_at   TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
      CONSTRAINT pk_i360_run PRIMARY KEY (run_key)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE i360_task (
      task_key      VARCHAR2(300)  NOT NULL,   -- run_key || : || task_id || : || try
      run_key       VARCHAR2(200)  NOT NULL,
      dag_id        VARCHAR2(200)  NOT NULL,
      task_id       VARCHAR2(200)  NOT NULL,
      map_index     NUMBER(6),
      state         VARCHAR2(20),              -- success | failed | up_for_retry | upstream_failed | skipped | running
      try_number    NUMBER(4),
      started_at    TIMESTAMP,
      ended_at      TIMESTAMP,
      duration_s    NUMBER(12,3),
      log_url       VARCHAR2(1000),
      error_code    VARCHAR2(100),             -- the loader''s code when the task reports one
      error_detail  VARCHAR2(2000),            -- the one line that matters, never the log
      received_at   TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
      CONSTRAINT pk_i360_task PRIMARY KEY (task_key)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE i360_test (
      test_key      VARCHAR2(400)  NOT NULL,   -- run_key || : || node_id (or check id)
      run_key       VARCHAR2(200)  NOT NULL,
      dag_id        VARCHAR2(200),
      business_date VARCHAR2(10),
      rule_kind     VARCHAR2(30),              -- dbt_test | dbt_model | dbt_freshness | great_expectations | soda | loader
      node_id       VARCHAR2(400),             -- dbt unique_id, or the check id
      model_name    VARCHAR2(200),             -- the model or dataset the check is about
      test_name     VARCHAR2(400),             -- unique, not_null, relationships, accepted_values, freshness, the expectation
      column_name   VARCHAR2(200),
      status        VARCHAR2(20),              -- pass | fail | warn | error | skipped
      failures      NUMBER(12),
      total_rows    NUMBER(12),
      expected      VARCHAR2(400),
      observed      VARCHAR2(400),
      threshold     VARCHAR2(200),
      message       VARCHAR2(2000),
      severity      VARCHAR2(10),
      execution_s   NUMBER(12,3),
      bad_rows_json CLOB,                      -- at most 50 rows, as the check reported them
      received_at   TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
      CONSTRAINT pk_i360_test PRIMARY KEY (test_key)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE i360_note (
      note_id       VARCHAR2(40)   NOT NULL,
      dag_id        VARCHAR2(200)  NOT NULL,
      finding_key   VARCHAR2(400),             -- the test_key or task_key the note is about
      root_cause    VARCHAR2(2000),
      action        VARCHAR2(2000),
      author        VARCHAR2(100),
      created_at    TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
      CONSTRAINT pk_i360_note PRIMARY KEY (note_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX ix_i360_run_dag ON i360_run (dag_id, received_at)';
EXCEPTION WHEN e_exists THEN NULL; END;
/
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX ix_i360_task_run ON i360_task (run_key, state)';
EXCEPTION WHEN e_exists THEN NULL; END;
/
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX ix_i360_test_dag ON i360_test (dag_id, business_date, status)';
EXCEPTION WHEN e_exists THEN NULL; END;
/
