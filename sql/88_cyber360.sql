-- ============================================================================
-- 88_cyber360.sql
-- Cyber Security 360: the application inventory and its scan coverage.
-- One row per application we run, home-grown, vendor (code managed by us
-- or a vendor package) or SaaS, with whether it goes through the
-- application scan, and when it does not, the constraint behind that and
-- whether the scan group accepts it. The review question is the thread's
-- own: for each application not scanned, why; and where there is no valid
-- constraint, get it scanned.
--
--   cyber_app        one row per application; the current state.
--   cyber_app_log    one row per changed field, who and when, because a
--                    reviewer's decision on a constraint is evidence.
--
-- Written only by api/app/routers_cyber360.py. No hostnames, addresses or
-- credentials belong in a row: runtime is a schedule or platform name.
-- Idempotent: an existing table is left alone (ORA-955).
-- ============================================================================
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE cyber_app (
      app_id               VARCHAR2(40)   NOT NULL,
      app_name             VARCHAR2(200)  NOT NULL,
      app_class            VARCHAR2(24)   NOT NULL,   -- HOME_GROWN | VENDOR_MANAGED_CODE | VENDOR_PACKAGE | SAAS
      category             VARCHAR2(120),             -- .NET utility, Windows service, shell scripts, web application, vendor desktop ...
      runtime              VARCHAR2(200),             -- RMJ schedule, Tomcat, mainframe terminal, vendor hosted
      tech_stack           VARCHAR2(200),
      surface              VARCHAR2(20),              -- WEB | API | BATCH | SERVICE | DESKTOP | PLATFORM
      scan_status          VARCHAR2(20)   NOT NULL,   -- SCANNED | SERVER_ONLY | NOT_SCANNED
      scan_types           VARCHAR2(200),             -- what the scan covers today: web, api, server
      constraint_kind      VARCHAR2(30),              -- NONE | NO_WEB_SURFACE | VENDOR_BINARY | DESKTOP_EMULATOR | SERVER_SCAN_ONLY | LEGACY_STACK_RETIRING | SAAS_VENDOR_HOSTED | OTHER
      constraint_text      VARCHAR2(2000),            -- why it cannot be scanned, in the owner''s words
      constraint_valid     VARCHAR2(10)   DEFAULT ''TBD'',   -- YES | NO | TBD: the scan group''s decision
      recommended_control  VARCHAR2(400),             -- what covers it instead, or the scan to schedule
      action               VARCHAR2(400),
      owner_team           VARCHAR2(120),
      devsecops_integration VARCHAR2(20)  DEFAULT ''NONE'',    -- NONE | PARTIAL | INTEGRATED | NOT_APPLICABLE: is it in the DevSecOps pipeline (SAST, SCA, secrets, DAST in CI)
      devsecops_detail     VARCHAR2(400),             -- which pipeline and which checks
      lifecycle            VARCHAR2(20)   DEFAULT ''ACTIVE'',  -- ACTIVE | RETIRING | RETIRED
      notes                VARCHAR2(2000),
      source_ref           VARCHAR2(200),             -- where the row came from, e.g. the Application Scans thread
      updated_by           VARCHAR2(120),
      id_source            VARCHAR2(10),              -- session | proxy | none
      created_at           TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
      updated_at           TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
      CONSTRAINT pk_cyber_app PRIMARY KEY (app_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX ix_cyber_app_scan ON cyber_app (scan_status, app_class)';
EXCEPTION WHEN e_exists THEN NULL; END;
/
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE cyber_app_log (
      log_id       VARCHAR2(40)   NOT NULL,
      app_id       VARCHAR2(40)   NOT NULL,
      field        VARCHAR2(40)   NOT NULL,
      before_v     VARCHAR2(2000),
      after_v      VARCHAR2(2000),
      author       VARCHAR2(120)  NOT NULL,
      id_source    VARCHAR2(10),
      created_at   TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
      CONSTRAINT pk_cyber_app_log PRIMARY KEY (log_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/
DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX ix_cyber_app_log_app ON cyber_app_log (app_id, created_at)';
EXCEPTION WHEN e_exists THEN NULL; END;
/

-- A table created before the DevSecOps columns existed gets them (ORA-01430: already there).
DECLARE e_dup EXCEPTION; PRAGMA EXCEPTION_INIT(e_dup, -1430);
BEGIN
  EXECUTE IMMEDIATE 'ALTER TABLE cyber_app ADD (devsecops_integration VARCHAR2(20) DEFAULT ''NONE'', devsecops_detail VARCHAR2(400))';
EXCEPTION WHEN e_dup THEN NULL; END;
/
