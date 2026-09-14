-- =====================================================================
-- sql/24_quality_guardrails.sql
-- Quality Guardrails observability plane (guarded, idempotent).
-- Safe to run repeatedly. ORA-00955 (name in use) / -00942 tolerated.
-- Captures failed / at-risk jobs across validation, monitoring,
-- transformation tests and orchestration, with the failure -> root cause
-- -> bad-data chain for drill-down.
-- =====================================================================
SET DEFINE OFF;
DECLARE
  PROCEDURE ddl(p VARCHAR2) IS
  BEGIN EXECUTE IMMEDIATE p;
  EXCEPTION WHEN OTHERS THEN
    -- ORA-00955 (object exists), ORA-00942 (missing), ORA-01408 (index exists) -> ignore
    IF SQLCODE NOT IN (-955, -942, -1408) THEN RAISE; END IF;
  END;
BEGIN
  ddl('CREATE TABLE guardrail_events (
    event_id        VARCHAR2(60)  NOT NULL,
    engine          VARCHAR2(40),
    event_type      VARCHAR2(40),
    status          VARCHAR2(20),
    severity        VARCHAR2(20),
    pipeline_id     VARCHAR2(128),
    dag_id          VARCHAR2(128),
    task_id         VARCHAR2(128),
    dataset_key     VARCHAR2(256),
    model_key       VARCHAR2(256),
    column_name     VARCHAR2(128),
    rule_name       VARCHAR2(200),
    expectation     VARCHAR2(400),
    observed_value  VARCHAR2(400),
    threshold       VARCHAR2(200),
    bad_row_count   NUMBER,
    total_row_count NUMBER,
    message         VARCHAR2(1000),
    root_cause      VARCHAR2(1000),
    bad_data_sample CLOB,
    upstream_source VARCHAR2(256),
    run_id          VARCHAR2(80),
    run_ts          TIMESTAMP,
    project_id      VARCHAR2(60),
    CONSTRAINT pk_guardrail_events PRIMARY KEY (event_id))');
  ddl('CREATE INDEX ix_guardrail_status   ON guardrail_events (status)');
  ddl('CREATE INDEX ix_guardrail_severity ON guardrail_events (severity)');
  ddl('CREATE INDEX ix_guardrail_pipeline ON guardrail_events (pipeline_id)');
END;
/
