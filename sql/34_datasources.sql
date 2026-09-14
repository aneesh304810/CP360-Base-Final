-- ============================================================================
-- 34_datasources.sql — Admin data-source registry. Secrets live in a
-- separate table so DBAs can grant differently; the secret column stores a
-- REFERENCE ('env:VAR' or 'enc:<ciphertext>'), never plaintext.
-- Idempotent (-955 tolerant).
-- ============================================================================
BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE cp_datasources (
      name           VARCHAR2(60)  PRIMARY KEY,
      role           VARCHAR2(30),          -- SYSTEM_OF_RECORD | UNDER_TEST |
                                            -- PROFILING | CATALOG
      method         VARCHAR2(10),          -- HOST | LDAP | TNS
      host           VARCHAR2(200),
      port           NUMBER,
      service        VARCHAR2(100),
      ldap_alias     VARCHAR2(400),
      tns_entry      VARCHAR2(100),
      schemas        VARCHAR2(400),         -- comma separated
      username       VARCHAR2(60),
      thick_mode     CHAR(1) DEFAULT ''Y'',
      read_only      CHAR(1) DEFAULT ''Y'',
      last_test_at   TIMESTAMP,
      last_test_ok   CHAR(1),
      last_test_msg  VARCHAR2(1000),
      created_at     TIMESTAMP DEFAULT SYSTIMESTAMP,
      updated_at     TIMESTAMP
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/
BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE cp_datasource_secret (
      name        VARCHAR2(60) PRIMARY KEY
                  REFERENCES cp_datasources(name) ON DELETE CASCADE,
      secret_ref  VARCHAR2(2000) NOT NULL,   -- env:VARNAME or enc:<b64>
      updated_at  TIMESTAMP DEFAULT SYSTIMESTAMP
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;
END;
/
