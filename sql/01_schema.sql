-- CP Catalog core schema (portable, idempotent)
SET DEFINE OFF;

BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE datasets (
      platform_id      VARCHAR2(60)  NOT NULL,
      schema_name      VARCHAR2(128) NOT NULL,
      object_name      VARCHAR2(256) NOT NULL,
      object_type      VARCHAR2(20)  DEFAULT ''TABLE'' NOT NULL,
      project_id       VARCHAR2(40)  DEFAULT ''internal'',
      layer            VARCHAR2(20),
      domain           VARCHAR2(80),
      tech_desc        CLOB,
      business_desc    CLOB,
      owner            VARCHAR2(128),
      tags             VARCHAR2(1000),
      row_count        NUMBER,
      source_xlsx_path VARCHAR2(1000),
      position_order   NUMBER,
      feed_class       VARCHAR2(20),
      geography        VARCHAR2(10),
      regulatory_scope VARCHAR2(40),
      certification    VARCHAR2(10),
      lifecycle_state  VARCHAR2(20) DEFAULT ''active'',
      last_seen_at     TIMESTAMP,
      created_at       TIMESTAMP DEFAULT SYSTIMESTAMP,
      updated_at       TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_datasets PRIMARY KEY (platform_id, schema_name, object_name)
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;  -- -955 = name already used (table exists)
END;
/
BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE columns (
      platform_id     VARCHAR2(60)  NOT NULL,
      schema_name     VARCHAR2(128) NOT NULL,
      object_name     VARCHAR2(256) NOT NULL,
      column_name     VARCHAR2(128) NOT NULL,
      position_order  NUMBER,
      data_type       VARCHAR2(128),
      base_data_type  VARCHAR2(60),
      data_format     VARCHAR2(60),
      max_length      NUMBER,
      precision       NUMBER,
      scale           NUMBER,
      nullable        CHAR(1) DEFAULT ''Y'',
      is_pk           CHAR(1) DEFAULT ''N'',
      tech_desc       CLOB,
      business_desc   CLOB,
      sensitivity     VARCHAR2(40),
      is_pii          CHAR(1) DEFAULT ''N'',
      pii_category    VARCHAR2(60),
      pii_attribute   VARCHAR2(128),
      CONSTRAINT pk_columns PRIMARY KEY (platform_id, schema_name, object_name, column_name)
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;  -- -955 = name already used (table exists)
END;
/
BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE transformations (
      target_key      VARCHAR2(520) NOT NULL,
      transform_type  VARCHAR2(30),
      dbt_model       VARCHAR2(256),
      project_id      VARCHAR2(40) DEFAULT ''internal'',
      compiled_sql    CLOB,
      raw_sql         CLOB,
      updated_at      TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_transformations PRIMARY KEY (target_key)
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;  -- -955 = name already used (table exists)
END;
/
BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE transform_lineage (
      edge_id     VARCHAR2(1050) NOT NULL,
      from_key    VARCHAR2(520) NOT NULL,
      to_key      VARCHAR2(520) NOT NULL,
      from_type   VARCHAR2(20) DEFAULT ''dataset'',
      to_type     VARCHAR2(20) DEFAULT ''dataset'',
      source      VARCHAR2(30),
      project_id  VARCHAR2(40),
      CONSTRAINT pk_transform_lineage PRIMARY KEY (edge_id)
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;  -- -955 = name already used (table exists)
END;
/
BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE column_lineage (
      edge_id        VARCHAR2(1320) NOT NULL,
      from_column    VARCHAR2(650) NOT NULL,
      to_column      VARCHAR2(650) NOT NULL,
      transform_expr CLOB,
      source         VARCHAR2(30),
      model_key      VARCHAR2(256),
      CONSTRAINT pk_column_lineage PRIMARY KEY (edge_id)
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;  -- -955 = name already used (table exists)
END;
/
BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX ix_datasets_project ON datasets(project_id)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE NOT IN (-955, -1408) THEN RAISE; END IF;  -- already exists
END;
/
BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX ix_datasets_type ON datasets(object_type)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE NOT IN (-955, -1408) THEN RAISE; END IF;  -- already exists
END;
/
BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX ix_columns_pii ON columns(is_pii)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE NOT IN (-955, -1408) THEN RAISE; END IF;  -- already exists
END;
/
BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX ix_tl_from ON transform_lineage(from_key)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE NOT IN (-955, -1408) THEN RAISE; END IF;  -- already exists
END;
/
BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX ix_tl_to ON transform_lineage(to_key)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE NOT IN (-955, -1408) THEN RAISE; END IF;  -- already exists
END;
/
BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX ix_cl_from ON column_lineage(from_column)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE NOT IN (-955, -1408) THEN RAISE; END IF;  -- already exists
END;
/
