-- ============================================================================
-- 83_odi_repo.sql
-- ODI 360: the ODI repository export itself — what each scenario does, step
-- by step, which tables it reads and writes, the variables it refreshes, the
-- database objects it leans on and the table-to-table edges. Written by
-- `python -m ingestion.run odi_repo` (ingestion/odi_repo_conn.py) from the
-- CSVs in CP_ODI_DIR. Read by routers_odi.
--
-- GRAIN
--   odi_scenario   one row per scenario: what it writes/reads, KMs, procedures,
--                  variables, load plans and the scheduler jobs that call it
--   odi_task       one row per task per scenario (step_no, task_no); the code
--                  preview as the export cut it, and whether it was cut
--   odi_variable   one row per ODI variable with its refresh SQL
--   odi_table      one row per warehouse table the repository touches
--   odi_object     one row per database object the repository names
--   odi_edge       one row per lineage edge (table feeds table, via scenario)
--
-- Code previews are the repository's own SQL/PL-SQL text, truncated by the
-- export before it reaches here; no warehouse data value is in any row.
--
-- Idempotent: an existing table is left alone (ORA-955).
-- ============================================================================

DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE odi_scenario (
      scenario          VARCHAR2(200) NOT NULL,
      writes            VARCHAR2(4000),
      reads             VARCHAR2(4000),
      db_procedures     VARCHAR2(4000),
      kms               VARCHAR2(2000),
      variables         VARCHAR2(4000),
      load_pattern      VARCHAR2(60),
      load_plans        VARCHAR2(2000),
      autosys_jobs      VARCHAR2(2000),
      step_count        NUMBER,
      task_count        NUMBER,
      truncated_tasks   NUMBER,
      loaded_at         TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_odi_scenario PRIMARY KEY (scenario))';
EXCEPTION WHEN e_exists THEN NULL; END;
/
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE odi_task (
      scenario          VARCHAR2(200) NOT NULL,
      step_no           NUMBER        NOT NULL,
      task_no           NUMBER        NOT NULL,
      version           VARCHAR2(40),
      task_name1        VARCHAR2(400),
      task_name2        VARCHAR2(400),
      task_name3        VARCHAR2(400),
      task_type         VARCHAR2(10),
      reads             VARCHAR2(4000),
      writes            VARCHAR2(4000),
      code_chars        NUMBER,
      code_preview      VARCHAR2(4000),
      truncated         CHAR(1),
      loaded_at         TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_odi_task PRIMARY KEY (scenario, step_no, task_no))';
EXCEPTION WHEN e_exists THEN NULL; END;
/
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE odi_variable (
      name              VARCHAR2(400) NOT NULL,
      project           VARCHAR2(200),
      datatype          VARCHAR2(60),
      default_value     VARCHAR2(2000),
      refresh_lschema   VARCHAR2(200),
      refresh_sql       VARCHAR2(4000),
      source_file       VARCHAR2(400),
      loaded_at         TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_odi_variable PRIMARY KEY (name))';
EXCEPTION WHEN e_exists THEN NULL; END;
/
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE odi_table (
      table_name        VARCHAR2(128) NOT NULL,
      written_by        VARCHAR2(4000),
      read_by           VARCHAR2(4000),
      write_operations  VARCHAR2(400),
      indexes           VARCHAR2(4000),
      layer             VARCHAR2(60),
      writer_count      NUMBER,
      reader_count      NUMBER,
      loaded_at         TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_odi_table PRIMARY KEY (table_name))';
EXCEPTION WHEN e_exists THEN NULL; END;
/
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE odi_object (
      object_type       VARCHAR2(60)  NOT NULL,
      schema_name       VARCHAR2(128) NOT NULL,
      name              VARCHAR2(200) NOT NULL,
      on_table          VARCHAR2(128),
      columns           VARCHAR2(4000),
      used_by           VARCHAR2(4000),
      loaded_at         TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_odi_object PRIMARY KEY (object_type, schema_name, name))';
EXCEPTION WHEN e_exists THEN NULL; END;
/
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE odi_edge (
      src_type          VARCHAR2(40)  NOT NULL,
      src               VARCHAR2(200) NOT NULL,
      relation          VARCHAR2(40)  NOT NULL,
      dst_type          VARCHAR2(40)  NOT NULL,
      dst               VARCHAR2(200) NOT NULL,
      detail            VARCHAR2(400) DEFAULT ''-'' NOT NULL,
      loaded_at         TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_odi_edge PRIMARY KEY (src_type, src, relation, dst_type, dst, detail))';
EXCEPTION WHEN e_exists THEN NULL; END;
/
