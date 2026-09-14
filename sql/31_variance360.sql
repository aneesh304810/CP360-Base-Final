-- ============================================================================
-- 31_variance360.sql
-- Variance 360 — column composition profiling + stage variance results.
--
-- Reads:  legacy_lineage (the stage chain per field, per data_source),
--         legacy_dictionary (declared formats, IS_PII for sample suppression).
-- Writes: the four tables below. No source data is ever copied — only metrics.
--
-- Idempotent: safe to run more than once (matches repo convention).
-- ============================================================================

-- One row per profiling run (ad-hoc from UI or ingestion-hooked).
BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE recon_runs (
      run_id        VARCHAR2(60)  NOT NULL,
      data_source   VARCHAR2(40)  NOT NULL,
      run_type      VARCHAR2(30),                 -- COMPOSITION | STAGE | BOTH
      scope         VARCHAR2(200),                -- table name or ALL
      status        VARCHAR2(20)  DEFAULT ''RUNNING'',
      step          VARCHAR2(400),                -- progress text for UI strip
      started_at    TIMESTAMP     DEFAULT SYSTIMESTAMP,
      finished_at   TIMESTAMP,
      rows_scanned  NUMBER,
      cols_profiled NUMBER,
      sql_hash      VARCHAR2(64),                 -- evidence: generated-SQL hash
      error_text    VARCHAR2(2000),
      CONSTRAINT pk_recon_runs PRIMARY KEY (run_id)
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

-- Column composition (content-class census) per column per run.
BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE recon_dtype_profile (
      run_id          VARCHAR2(60)  NOT NULL,
      data_source     VARCHAR2(40)  NOT NULL,
      stage           VARCHAR2(10)  NOT NULL,     -- SRC | STG1 | STG2 | DWH
      table_name      VARCHAR2(200) NOT NULL,
      column_name     VARCHAR2(200) NOT NULL,
      declared_type   VARCHAR2(120),
      inferred_type   VARCHAR2(60),               -- INTEGER/DECIMAL/DATE:<mask>/
                                                  -- BOOLEAN_FLAG/STRING/
                                                  -- STRING_NUMERICLOOK/MIXED/EMPTY
      conformance_pct NUMBER,
      total_rows      NUMBER,
      nonnull_rows    NUMBER,
      pct_decimal     NUMBER, pct_integer NUMBER, pct_date NUMBER,
      pct_bool        NUMBER, pct_text    NUMBER, pct_blank NUMBER,
      pct_bad         NUMBER,                     -- won''t survive the cast
      bad_rows        NUMBER,
      num_prec_max    NUMBER, num_scale_max NUMBER,
      max_len         NUMBER,
      lead_zero_rows  NUMBER,
      date_mask       VARCHAR2(60),
      risk            VARCHAR2(40),               -- CAST_UNSAFE / IDENTIFIER_
                                                  -- LEADING_ZERO / TYPE_DRIFT / ''''
      verdict         VARCHAR2(400),
      samples_json    CLOB,                       -- outliers; suppressed when PII
      pii_suppressed  CHAR(1) DEFAULT ''N'',
      CONSTRAINT pk_recon_dtype PRIMARY KEY (run_id, stage, table_name, column_name)
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

-- Stage-variance metric values: one row per field x stage x metric.
BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE recon_profile (
      run_id      VARCHAR2(60)  NOT NULL,
      data_source VARCHAR2(40)  NOT NULL,
      lineage_id  VARCHAR2(600) NOT NULL,         -- FK-in-spirit -> legacy_lineage
      stage       VARCHAR2(10)  NOT NULL,
      table_name  VARCHAR2(200),
      column_name VARCHAR2(200),
      metric      VARCHAR2(20)  NOT NULL,         -- CNT/NULLS/NDV/SUM/MIN/MAX/AVG/
                                                  -- MAXLEN/HASHSUM/MIN_D/MAX_D
      value_num   NUMBER,
      value_str   VARCHAR2(200),
      CONSTRAINT pk_recon_profile PRIMARY KEY (run_id, lineage_id, stage, metric)
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

-- Pre-aggregated rollup the UI reads (never scans recon_profile live).
BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE recon_summary (
      run_id           VARCHAR2(60)  NOT NULL,
      data_source      VARCHAR2(40)  NOT NULL,
      functional_group VARCHAR2(200),
      table_name       VARCHAR2(200) NOT NULL,
      fields_total     NUMBER,
      fields_variant   NUMBER,
      variance_score   NUMBER,                    -- severity-weighted, see engine
      worst_hop        VARCHAR2(30),              -- e.g. STG1->STG2
      breaks_src_stg1  NUMBER, breaks_stg1_stg2 NUMBER, breaks_stg2_dwh NUMBER,
      dominant_metric  VARCHAR2(20),
      status           VARCHAR2(10),              -- RED / AMBER / GREEN
      CONSTRAINT pk_recon_summary PRIMARY KEY (run_id, table_name)
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE
    'CREATE INDEX ix_recon_dtype_tbl ON recon_dtype_profile (data_source, table_name, run_id)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE NOT IN (-955, -1408) THEN RAISE; END IF;
END;
/
BEGIN
  EXECUTE IMMEDIATE
    'CREATE INDEX ix_recon_profile_lid ON recon_profile (run_id, lineage_id)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE NOT IN (-955, -1408) THEN RAISE; END IF;
END;
/
BEGIN
  EXECUTE IMMEDIATE
    'CREATE INDEX ix_recon_summary_ds ON recon_summary (data_source, run_id, variance_score)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE NOT IN (-955, -1408) THEN RAISE; END IF;
END;
/
