-- Quality / gates / observability
SET DEFINE OFF;

BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE quality_results (
      result_id     VARCHAR2(64) NOT NULL,
      dataset_key   VARCHAR2(520) NOT NULL,
      column_name   VARCHAR2(128),
      test_name     VARCHAR2(256),
      dimension     VARCHAR2(30),
      status        VARCHAR2(20),
      observed_value NUMBER,
      threshold     NUMBER,
      message       VARCHAR2(2000),
      project_id    VARCHAR2(40),
      run_id        VARCHAR2(120),
      run_ts        VARCHAR2(40),
      CONSTRAINT pk_quality_results PRIMARY KEY (result_id)
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;  -- -955 = name already used (table exists)
END;
/
BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE quality_gates (
      gate_id       VARCHAR2(64) NOT NULL,
      gate_name     VARCHAR2(160),
      scope_key     VARCHAR2(520),
      project_id    VARCHAR2(40),
      verdict       VARCHAR2(20),
      rules_total   NUMBER,
      rules_passed  NUMBER,
      rules_failed  NUMBER,
      blocking      CHAR(1) DEFAULT ''N'',
      detail        CLOB,
      run_ts        VARCHAR2(40),
      CONSTRAINT pk_quality_gates PRIMARY KEY (gate_id)
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;  -- -955 = name already used (table exists)
END;
/
BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE runs (
      run_id      VARCHAR2(600) NOT NULL,
      dag_id      VARCHAR2(250),
      task_id     VARCHAR2(250),
      project_id  VARCHAR2(40),
      status      VARCHAR2(30),
      start_ts    VARCHAR2(40),
      end_ts      VARCHAR2(40),
      duration_s  NUMBER,
      CONSTRAINT pk_runs PRIMARY KEY (run_id)
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;  -- -955 = name already used (table exists)
END;
/
BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE freshness (
      snapshot_id   VARCHAR2(64) NOT NULL,
      dataset_key   VARCHAR2(520) NOT NULL,
      project_id    VARCHAR2(40),
      row_count     NUMBER,
      max_loaded_at VARCHAR2(40),
      lag_minutes   NUMBER,
      status        VARCHAR2(20),
      captured_ts   VARCHAR2(40),
      CONSTRAINT pk_freshness PRIMARY KEY (snapshot_id)
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;  -- -955 = name already used (table exists)
END;
/
