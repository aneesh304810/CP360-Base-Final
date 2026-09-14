-- Audit + versioning (resource_ref avoids reserved word RESOURCE)
SET DEFINE OFF;

BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE audit_log (
      audit_id     VARCHAR2(64) NOT NULL,
      prev_hash    VARCHAR2(64),
      user_id      VARCHAR2(256),
      user_role    VARCHAR2(40),
      action       VARCHAR2(60),
      resource_ref VARCHAR2(520),
      outcome      VARCHAR2(20),
      detail       CLOB,
      event_ts     TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_audit_log PRIMARY KEY (audit_id)
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;  -- -955 = name already used (table exists)
END;
/
BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE dataset_versions (
      version_id         VARCHAR2(64) NOT NULL,
      dataset_key        VARCHAR2(520) NOT NULL,
      version_no         VARCHAR2(20),
      change_type        VARCHAR2(10),
      project_id         VARCHAR2(40),
      created_by         VARCHAR2(256),
      created_at         TIMESTAMP DEFAULT SYSTIMESTAMP,
      schema_snapshot    CLOB,
      lineage_snapshot   CLOB,
      ownership_snapshot CLOB,
      CONSTRAINT pk_dataset_versions PRIMARY KEY (version_id)
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;  -- -955 = name already used (table exists)
END;
/
BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE dataset_diffs (
      diff_id         VARCHAR2(64) NOT NULL,
      dataset_key     VARCHAR2(520) NOT NULL,
      from_version    VARCHAR2(20),
      to_version      VARCHAR2(20),
      added_columns   CLOB,
      removed_columns CLOB,
      changed_columns CLOB,
      created_at      TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_dataset_diffs PRIMARY KEY (diff_id)
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;  -- -955 = name already used (table exists)
END;
/
