-- =====================================================================
-- sql/13_widen_api_columns.sql
-- Widen free-text API columns to CLOB so large real-world Swagger specs
-- (huge error tables, long descriptions) never overflow.
-- Idempotent: each ALTER is guarded; -1442/-1451/-22859/-1735 = already
-- modified / incompatible no-op are tolerated. Safe to re-run.
-- =====================================================================
SET DEFINE OFF;

DECLARE
  PROCEDURE widen(p_table VARCHAR2, p_col VARCHAR2, p_type VARCHAR2) IS
  BEGIN
    EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table || ' MODIFY (' || p_col || ' ' || p_type || ')';
    DBMS_OUTPUT.PUT_LINE('Widened ' || p_table || '.' || p_col || ' -> ' || p_type);
  EXCEPTION WHEN OTHERS THEN
    -- ORA-01439 (col to CLOB needs empty) handled below; otherwise log + continue
    IF SQLCODE = -1439 THEN
      DBMS_OUTPUT.PUT_LINE('Recreating ' || p_table || '.' || p_col || ' as CLOB (had data)');
      EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table || ' ADD (' || p_col || '_tmp ' || p_type || ')';
      EXECUTE IMMEDIATE 'UPDATE ' || p_table || ' SET ' || p_col || '_tmp = ' || p_col;
      EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table || ' DROP COLUMN ' || p_col;
      EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table || ' RENAME COLUMN ' || p_col || '_tmp TO ' || p_col;
    ELSE
      DBMS_OUTPUT.PUT_LINE('Skip ' || p_table || '.' || p_col || ': ' || SQLERRM);
    END IF;
  END;
BEGIN
  -- the column that overflowed (22K chars) + its sibling
  widen('api_endpoint_errors', 'business_exception', 'CLOB');
  widen('api_endpoint_errors', 'error_details', 'CLOB');
  -- other free-text spec fields that real specs can blow past
  widen('api_fields', 'description', 'CLOB');
  widen('api_fields', 'example_value', 'VARCHAR2(4000)');
  widen('api_endpoints', 'summary', 'VARCHAR2(4000)');
  widen('api_endpoints', 'full_endpoint_url', 'VARCHAR2(2000)');
  widen('api_endpoints', 'path', 'VARCHAR2(2000)');
  widen('api_sources', 'spec_path', 'VARCHAR2(2000)');
END;
/
