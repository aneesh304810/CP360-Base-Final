-- ============================================================================
-- 38_api360_admin_ux.sql — admin UX overlays (NOT catalog truth)
--   api_system_meta      presentation metadata for systems; a row without
--                        sources shows PLANNED. project_id from folders
--                        remains the real system assignment.
--   api_ingest_manifest  fetcher config: URL/FILE sources a manifest run
--                        downloads/copies INTO the artifacts tree, then the
--                        ONE connector ingests. Tree stays the single truth.
-- Idempotent.
-- ============================================================================
BEGIN EXECUTE IMMEDIATE '
CREATE TABLE api_system_meta (
      code         VARCHAR2(40) PRIMARY KEY,
      display_name VARCHAR2(120),
      parent_class VARCHAR2(10),
      auth_hint    VARCHAR2(40),
      owner        VARCHAR2(80),
      notes        VARCHAR2(400),
      created_at   TIMESTAMP DEFAULT SYSTIMESTAMP
)'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE '
CREATE TABLE api_ingest_manifest (
      src_id       VARCHAR2(40) PRIMARY KEY,
      system       VARCHAR2(40) NOT NULL,
      kind         VARCHAR2(10) NOT NULL,
      location     VARCHAR2(2000) NOT NULL,
      domain       VARCHAR2(120),
      filename     VARCHAR2(200),
      enabled      CHAR(1) DEFAULT ''Y'',
      last_run_at  TIMESTAMP,
      last_result  VARCHAR2(400),
      created_at   TIMESTAMP DEFAULT SYSTIMESTAMP
)'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
/
