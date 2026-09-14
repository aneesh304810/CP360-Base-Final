-- Datapoint 360
SET DEFINE OFF;

BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE dp_registry (
      dp_name_normalized VARCHAR2(256) NOT NULL,
      dp_display_name    VARCHAR2(256),
      occurrence_count   NUMBER DEFAULT 0,
      module_count       NUMBER DEFAULT 0,
      is_pii             CHAR(1) DEFAULT ''N'',
      pii_attribute      VARCHAR2(128),
      pii_category       VARCHAR2(60),
      primary_project_id VARCHAR2(40),
      project_ids_csv    VARCHAR2(400),
      is_key             CHAR(1) DEFAULT ''N'',
      CONSTRAINT pk_dp_registry PRIMARY KEY (dp_name_normalized)
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;  -- -955 = name already used (table exists)
END;
/
BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE dp_occurrences (
      dp_name_normalized VARCHAR2(256) NOT NULL,
      module        VARCHAR2(40) NOT NULL,
      ref_key       VARCHAR2(520) NOT NULL,
      ref_label     VARCHAR2(512),
      project_id    VARCHAR2(40),
      CONSTRAINT pk_dp_occurrences PRIMARY KEY (dp_name_normalized, module, ref_key)
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;  -- -955 = name already used (table exists)
END;
/
BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX ix_dp_occ_proj ON dp_occurrences(project_id)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE NOT IN (-955, -1408) THEN RAISE; END IF;  -- already exists
END;
/
BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX ix_dp_reg_proj ON dp_registry(primary_project_id)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE NOT IN (-955, -1408) THEN RAISE; END IF;  -- already exists
END;
/
