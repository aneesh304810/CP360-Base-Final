-- Feed enumerations
SET DEFINE OFF;

BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE column_enumerations (
      platform_id   VARCHAR2(60) NOT NULL,
      schema_name   VARCHAR2(128) NOT NULL,
      object_name   VARCHAR2(256) NOT NULL,
      column_name   VARCHAR2(128) NOT NULL,
      enum_value    VARCHAR2(80) NOT NULL,
      enum_label    VARCHAR2(512),
      CONSTRAINT pk_column_enumerations PRIMARY KEY (platform_id, schema_name, object_name, column_name, enum_value)
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;  -- -955 = name already used (table exists)
END;
/
