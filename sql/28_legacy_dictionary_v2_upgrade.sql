-- =====================================================================
-- sql/28_legacy_dictionary_v2_upgrade.sql
-- ONLY needed if the v1 27_legacy_dictionary.sql was already deployed.
-- Fresh installs run the (v2) 27 script alone and skip this file.
-- Adds the AddVantage-master-workbook columns and the master index, then
-- clears rows so the v2 connector reloads with the new composite keys.
-- =====================================================================
SET DEFINE OFF;

DECLARE
  PROCEDURE ddl(p VARCHAR2) IS
  BEGIN EXECUTE IMMEDIATE p;
  EXCEPTION WHEN OTHERS THEN IF SQLCODE NOT IN (-955, -1430, -1442, -1408) THEN RAISE; END IF; END;
BEGIN
  ddl('ALTER TABLE legacy_dictionary ADD (master_name VARCHAR2(200))');
  ddl('ALTER TABLE legacy_dictionary ADD (data_type VARCHAR2(120))');
  ddl('ALTER TABLE legacy_dictionary ADD (max_length VARCHAR2(40))');
  ddl('ALTER TABLE legacy_dictionary ADD (num_precision VARCHAR2(40))');
  ddl('ALTER TABLE legacy_dictionary ADD (date_format VARCHAR2(120))');
  ddl('ALTER TABLE legacy_dictionary ADD (is_required CHAR(1) DEFAULT ''N'')');
  ddl('ALTER TABLE legacy_dictionary ADD (is_unique CHAR(1) DEFAULT ''N'')');
  ddl('ALTER TABLE legacy_dictionary ADD (pb_field_mapping VARCHAR2(400))');
  ddl('ALTER TABLE legacy_dictionary ADD (comments_txt CLOB)');
  ddl('CREATE INDEX ix_legacy_dict_master ON legacy_dictionary (source_system, master_name)');
  -- v1 keys were system:code; v2 keys are system:code:master -> reload cleanly
  EXECUTE IMMEDIATE 'DELETE FROM legacy_dictionary';
  COMMIT;
END;
/
