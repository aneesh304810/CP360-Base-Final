-- =====================================================================
-- sql/17_datapoint_direction.sql
-- Add inbound/outbound grouping to Datapoint 360.
-- Inbound = SWP EOD feeds; Outbound = loaders. SEI is a project tag.
-- Idempotent: adds columns only if missing.
-- =====================================================================
SET DEFINE OFF;

DECLARE
  PROCEDURE add_col(p_table VARCHAR2, p_col VARCHAR2, p_def VARCHAR2) IS
    n NUMBER;
  BEGIN
    SELECT COUNT(*) INTO n FROM user_tab_columns
     WHERE table_name = UPPER(p_table) AND column_name = UPPER(p_col);
    IF n = 0 THEN
      EXECUTE IMMEDIATE 'ALTER TABLE '||p_table||' ADD '||p_col||' '||p_def;
    END IF;
  END;
BEGIN
  add_col('dp_registry',    'in_inbound',  'CHAR(1) DEFAULT ''N''');
  add_col('dp_registry',    'in_outbound', 'CHAR(1) DEFAULT ''N''');
  add_col('dp_occurrences', 'direction',   'VARCHAR2(10)');  -- inbound|outbound|null
END;
/

-- convenience view: data points grouped by direction
CREATE OR REPLACE VIEW v_datapoint_direction AS
SELECT dp_name_normalized, dp_display_name, occurrence_count, module_count,
       is_pii, pii_attribute, pii_category, is_key,
       in_inbound, in_outbound,
       CASE WHEN in_inbound='Y' AND in_outbound='Y' THEN 'both'
            WHEN in_inbound='Y' THEN 'inbound'
            WHEN in_outbound='Y' THEN 'outbound'
            ELSE 'other' END AS direction_group
FROM dp_registry;
