-- =====================================================================
-- sql/22_reference_data.sql
-- Reference Data layer for Datapoint 360. A flat field-reference catalog
-- (the SWP EOD Data Feeds Reference List): one row per field, organized by
-- category, carrying authoritative description + detail. Attaches to data
-- points by (category + normalized field name). Enriches dp_registry entries;
-- does not create them. Idempotent guarded DDL.
-- =====================================================================
SET DEFINE OFF;

DECLARE
  PROCEDURE ddl(p VARCHAR2) IS
  BEGIN EXECUTE IMMEDIATE p;
  EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
BEGIN
  ddl('CREATE TABLE reference_data (
        ref_id              VARCHAR2(400) NOT NULL,  -- category|field_name_normalized
        category            VARCHAR2(200),
        position_order      NUMBER,
        field_name          VARCHAR2(256),           -- as authored
        field_name_normalized VARCHAR2(256),         -- normalized to match dp_registry
        field_description   VARCHAR2(2000),          -- short authoritative description
        detail_description  CLOB,                    -- long detail
        resolved            CHAR(1) DEFAULT ''N'',   -- Y if normalized name found in dp_registry
        project_id          VARCHAR2(40) DEFAULT ''sei'',
        CONSTRAINT pk_reference_data PRIMARY KEY (ref_id))');

  ddl('CREATE INDEX ix_refdata_cat ON reference_data(category)');
  ddl('CREATE INDEX ix_refdata_field ON reference_data(field_name_normalized)');
  ddl('CREATE INDEX ix_refdata_resolved ON reference_data(resolved)');
END;
/

-- View: data point enriched with its reference description(s).
-- A data point can appear in multiple categories, so this is one row per
-- (datapoint, category) pairing.
CREATE OR REPLACE VIEW v_datapoint_reference AS
SELECT r.field_name_normalized AS dp_name_normalized,
       r.category, r.position_order, r.field_name,
       r.field_description, r.detail_description, r.resolved
FROM reference_data r;
