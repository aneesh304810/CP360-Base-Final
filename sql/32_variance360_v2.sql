-- ============================================================================
-- 32_variance360_v2.sql — Variance 360 final: deviation stats, value census,
-- CLOB inspector tables. Idempotent; run after 31_variance360.sql.
-- ============================================================================

-- deviation / census columns on the composition profile
DECLARE
  PROCEDURE add_col(p_sql VARCHAR2) IS
  BEGIN
    EXECUTE IMMEDIATE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLCODE NOT IN (-1430) THEN RAISE; END IF;  -- column already exists
  END;
BEGIN
  add_col('ALTER TABLE recon_dtype_profile ADD (mean_val      NUMBER)');
  add_col('ALTER TABLE recon_dtype_profile ADD (stddev_val    NUMBER)');
  add_col('ALTER TABLE recon_dtype_profile ADD (median_val    NUMBER)');
  add_col('ALTER TABLE recon_dtype_profile ADD (min_val       VARCHAR2(80))');
  add_col('ALTER TABLE recon_dtype_profile ADD (max_val       VARCHAR2(80))');
  add_col('ALTER TABLE recon_dtype_profile ADD (outlier_cnt   NUMBER)');
  add_col('ALTER TABLE recon_dtype_profile ADD (ndv           NUMBER)');
  add_col('ALTER TABLE recon_dtype_profile ADD (value_census  VARCHAR2(1000))');
END;
/

-- one row per CLOB column profiled
BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE recon_clob_profile (
      run_id         VARCHAR2(60)  NOT NULL,
      data_source    VARCHAR2(40)  NOT NULL,
      table_name     VARCHAR2(200) NOT NULL,
      column_name    VARCHAR2(200) NOT NULL,
      blob_count     NUMBER,
      len_min        NUMBER, len_max NUMBER, len_avg NUMBER,
      len_mode       NUMBER,                       -- most common length
      len_uniform_pct NUMBER,                      -- % of blobs at len_mode
      truncated_cnt  NUMBER,                       -- blobs shorter than mode
      structure      VARCHAR2(30),                 -- FIXED_WIDTH | TEXT |
                                                   -- DELIMITED | UNKNOWN
      spec_fields    NUMBER,                       -- fields in lineage parse spec
      spec_resolved  NUMBER,                       -- SUBSTR-resolvable fields
      spec_coverage_bytes NUMBER,                  -- bytes covered by spec
      unmapped_regions VARCHAR2(400),              -- e.g. 91-98:12844
      referenced_by_transform CHAR(1) DEFAULT ''N'',
      CONSTRAINT pk_recon_clob PRIMARY KEY
        (run_id, table_name, column_name)
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

-- parsed-field profiles (mirrors recon_dtype_profile at sub-CLOB grain)
BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE recon_clob_fields (
      run_id         VARCHAR2(60)  NOT NULL,
      table_name     VARCHAR2(200) NOT NULL,
      clob_column    VARCHAR2(200) NOT NULL,
      field_name     VARCHAR2(200) NOT NULL,       -- STG2 target or BYTES_x_y
      pos_start      NUMBER, pos_len NUMBER,
      target_column  VARCHAR2(200),                -- mapped STG2 column
      inferred_type  VARCHAR2(60),
      conformance_pct NUMBER,
      nonnull_rows   NUMBER, total_rows NUMBER,
      bad_rows       NUMBER,
      mean_val NUMBER, stddev_val NUMBER, outlier_cnt NUMBER,
      date_mask      VARCHAR2(60),
      risk           VARCHAR2(40),
      verdict        VARCHAR2(400),
      CONSTRAINT pk_recon_clob_fields PRIMARY KEY
        (run_id, table_name, clob_column, field_name)
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/
