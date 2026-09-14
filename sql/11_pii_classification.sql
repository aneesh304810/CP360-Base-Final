-- PII dictionary + matches
SET DEFINE OFF;

BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE pii_classifications (
      pii_component_normalized VARCHAR2(256) NOT NULL,
      pii_component        VARCHAR2(256),
      pii_attribute        VARCHAR2(128),
      sensitivity_category VARCHAR2(60),
      sensitivity_level    NUMBER,
      source_xlsx_path     VARCHAR2(1000),
      CONSTRAINT pk_pii_classifications PRIMARY KEY (pii_component_normalized)
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;  -- -955 = name already used (table exists)
END;
/
BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE pii_field_matches (
      match_id      VARCHAR2(64) NOT NULL,
      module        VARCHAR2(40),
      ref_type      VARCHAR2(40),
      ref_key       VARCHAR2(520),
      parent_name   VARCHAR2(256),
      matched_field_name VARCHAR2(256),
      pii_component_normalized VARCHAR2(256),
      pii_attribute VARCHAR2(128),
      sensitivity_category VARCHAR2(60),
      match_confidence VARCHAR2(20),
      project_id    VARCHAR2(40),
      CONSTRAINT pk_pii_field_matches PRIMARY KEY (match_id)
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;  -- -955 = name already used (table exists)
END;
/
BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX ix_pii_match_module ON pii_field_matches(module)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE NOT IN (-955, -1408) THEN RAISE; END IF;  -- already exists
END;
/
BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX ix_pii_match_proj ON pii_field_matches(project_id)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE NOT IN (-955, -1408) THEN RAISE; END IF;  -- already exists
END;
/
BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX ix_pii_match_cat ON pii_field_matches(sensitivity_category)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE NOT IN (-955, -1408) THEN RAISE; END IF;  -- already exists
END;
/
