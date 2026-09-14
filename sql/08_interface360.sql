-- Interface 360 (self-contained)
SET DEFINE OFF;

BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE interface360_interfaces (
      interface_id        VARCHAR2(64) NOT NULL,
      domain              VARCHAR2(40),
      date_of_update      VARCHAR2(40),
      scope               VARCHAR2(20),
      update_owner        VARCHAR2(128),
      application         VARCHAR2(256),
      integration_name    VARCHAR2(256),
      description         CLOB,
      feed_type           VARCHAR2(40),
      source_system       VARCHAR2(160),
      source_party        VARCHAR2(40),
      target_system       VARCHAR2(160),
      target_party        VARCHAR2(40),
      direction           VARCHAR2(40),
      direct_feed         CHAR(1),
      feed_routing        VARCHAR2(1000),
      intraday            CHAR(1),
      eod_overnight       CHAR(1),
      frequency           VARCHAR2(120),
      extract_type        VARCHAR2(40),
      app_contact         VARCHAR2(160),
      migration_flag      CHAR(1),
      type_app_extract    VARCHAR2(60),
      process_improvement VARCHAR2(1000),
      notes               CLOB,
      source_project_id   VARCHAR2(40),
      target_project_id   VARCHAR2(40),
      carries_pii         CHAR(1) DEFAULT ''N'',
      pii_categories      VARCHAR2(400),
      created_at          TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_if360_interfaces PRIMARY KEY (interface_id)
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;  -- -955 = name already used (table exists)
END;
/
BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE interface360_systems (
      system_name    VARCHAR2(160) NOT NULL,
      project_id     VARCHAR2(40),
      party          VARCHAR2(40),
      inbound_count  NUMBER DEFAULT 0,
      outbound_count NUMBER DEFAULT 0,
      total_count    NUMBER DEFAULT 0,
      carries_pii    CHAR(1) DEFAULT ''N'',
      CONSTRAINT pk_if360_systems PRIMARY KEY (system_name)
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;  -- -955 = name already used (table exists)
END;
/
BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE interface360_routing_hops (
      interface_id  VARCHAR2(64) NOT NULL,
      hop_order     NUMBER NOT NULL,
      system_name   VARCHAR2(160),
      project_id    VARCHAR2(40),
      CONSTRAINT pk_if360_routing_hops PRIMARY KEY (interface_id, hop_order)
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;  -- -955 = name already used (table exists)
END;
/
BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX ix_if360_src ON interface360_interfaces(source_system)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE NOT IN (-955, -1408) THEN RAISE; END IF;  -- already exists
END;
/
BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX ix_if360_tgt ON interface360_interfaces(target_system)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE NOT IN (-955, -1408) THEN RAISE; END IF;  -- already exists
END;
/
BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX ix_if360_srcproj ON interface360_interfaces(source_project_id)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE NOT IN (-955, -1408) THEN RAISE; END IF;  -- already exists
END;
/
BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX ix_if360_tgtproj ON interface360_interfaces(target_project_id)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE NOT IN (-955, -1408) THEN RAISE; END IF;  -- already exists
END;
/
