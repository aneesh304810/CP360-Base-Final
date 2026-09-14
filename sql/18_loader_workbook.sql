-- =====================================================================
-- sql/18_loader_workbook.sql
-- Full SEI Loaders workbook (CP_Catalog_SEI_Loaders.xlsx) - outbound
-- loaders BBH -> SWP. 10 sheets. Idempotent guarded DDL.
-- =====================================================================
SET DEFINE OFF;

DECLARE
  PROCEDURE ddl(p VARCHAR2) IS
  BEGIN EXECUTE IMMEDIATE p;
  EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
BEGIN
  -- Loader_Catalog (one row per loader) + Grouping merged in
  ddl('CREATE TABLE ldr_catalog (
        loader_id        VARCHAR2(200),
        loader_name      VARCHAR2(400),
        group_name       VARCHAR2(200),
        template_pattern VARCHAR2(600),
        purpose          VARCHAR2(1000),
        business_domain  VARCHAR2(160),
        file_format      VARCHAR2(120),
        ui_support       VARCHAR2(120),
        system_support   VARCHAR2(120),
        function_point   VARCHAR2(200),
        header_req       VARCHAR2(60),
        footer_req       VARCHAR2(60),
        date_format      VARCHAR2(60),
        multi_firm       VARCHAR2(60),
        approval_req     VARCHAR2(120),
        internal_consistency VARCHAR2(60),
        version          VARCHAR2(40),
        notes            VARCHAR2(2000),
        direction        VARCHAR2(10) DEFAULT ''outbound'',
        project_id       VARCHAR2(40) DEFAULT ''sei'',
        source_xlsx      VARCHAR2(1000),
        CONSTRAINT pk_ldr_catalog PRIMARY KEY (loader_id))');

  -- Format_Structure
  ddl('CREATE TABLE ldr_format_structure (
        loader_id        VARCHAR2(200),
        component        VARCHAR2(200),
        required_for_ui  VARCHAR2(120),
        required_for_system VARCHAR2(120),
        notes            VARCHAR2(1000),
        CONSTRAINT pk_ldr_format PRIMARY KEY (loader_id, component))');

  -- Attributes (master + per-loader sheets merged)
  ddl('CREATE TABLE ldr_attributes (
        loader_id        VARCHAR2(200),
        attribute_name   VARCHAR2(256),
        description      VARCHAR2(1000),
        data_type        VARCHAR2(120),
        max_length       VARCHAR2(60),
        optionality      VARCHAR2(60),   -- Mandatory|Conditional|Optional
        valid_values     VARCHAR2(1000),
        notes            VARCHAR2(1000),
        source_sheet     VARCHAR2(120),
        CONSTRAINT pk_ldr_attr PRIMARY KEY (loader_id, attribute_name))');

  -- Validations
  ddl('CREATE TABLE ldr_validations (
        loader_id        VARCHAR2(200),
        attribute_name   VARCHAR2(256),
        validation_rule  VARCHAR2(1000),
        error_message    VARCHAR2(1000),
        seq              NUMBER,
        CONSTRAINT pk_ldr_val PRIMARY KEY (loader_id, attribute_name, seq))');

  -- Errors_Exceptions
  ddl('CREATE TABLE ldr_exceptions (
        loader_id        VARCHAR2(200),
        exception_type   VARCHAR2(200),
        description      VARCHAR2(1000),
        resolution_path  VARCHAR2(1000),
        seq              NUMBER,
        CONSTRAINT pk_ldr_exc PRIMARY KEY (loader_id, seq))');

  -- CP_Catalog_Mapping (loader -> module entities)
  ddl('CREATE TABLE ldr_module_map (
        loader_id          VARCHAR2(200),
        system_interface_360 VARCHAR2(200),
        api_360            VARCHAR2(400),
        data_360           VARCHAR2(400),
        datapoint_360      VARCHAR2(400),
        notes              VARCHAR2(1000),
        CONSTRAINT pk_ldr_modmap PRIMARY KEY (loader_id))');

  -- CIFS_Canonical_Mapping (canonical field -> physical loader field)
  ddl('CREATE TABLE ldr_canonical_map (
        canonical_field    VARCHAR2(256),
        canonical_category VARCHAR2(120),
        canonical_data_type VARCHAR2(120),
        loader_id          VARCHAR2(200),
        physical_field     VARCHAR2(400),
        notes              VARCHAR2(1000),
        seq                NUMBER,
        CONSTRAINT pk_ldr_canon PRIMARY KEY (canonical_field, loader_id, seq))');
END;
/

-- View: loader with counts
CREATE OR REPLACE VIEW v_loader_360 AS
SELECT c.loader_id, c.loader_name, c.group_name, c.purpose, c.business_domain,
       c.file_format, c.version, c.direction, c.project_id,
       (SELECT COUNT(*) FROM ldr_attributes a WHERE a.loader_id=c.loader_id) attr_count,
       (SELECT COUNT(*) FROM ldr_validations v WHERE v.loader_id=c.loader_id) val_count,
       (SELECT COUNT(*) FROM ldr_exceptions e WHERE e.loader_id=c.loader_id) exc_count,
       (SELECT COUNT(*) FROM ldr_canonical_map m WHERE m.loader_id=c.loader_id) canon_count
FROM ldr_catalog c;
