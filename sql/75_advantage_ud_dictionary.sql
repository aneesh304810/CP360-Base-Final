-- =====================================================================
-- sql/75_advantage_ud_dictionary.sql
-- The code values an AddVantage user-defined field is observed to carry.
--
-- WHY A TABLE OF ITS OWN. legacy_dictionary describes UD/1 the way the
-- AddVantage master workbook does: "User-Defined Text. Up to 300 fields
-- available." That is true of every one of the 300 and tells a reader
-- nothing about UD/1. What UD/1 means is in its values: 2=CLIENT ACCOUNT,
-- 6=PARTNER ACCOUNT, and so on, split from the "code=description" strings
-- inside DIM_ACCOUNT_UD.USER_DEFINED_ATTRIBUTE_CLOB. Those pairs are a
-- dictionary of their own, with their own grain (attribute, code), and
-- Datapoint 360 shows them under the generic description.
--
-- TWO SOURCES, KEPT APART. SOURCE = OBSERVED is what the extract carries,
-- with how often. SOURCE = TABLES is what the AddVantage lookup table
-- defines, once the UD -> table link is known. A code in TABLES and not
-- OBSERVED is unused; a code OBSERVED and not in TABLES is a finding.
-- Collapsing them would hide both.
--
-- LINK_STATUS says how the row's meaning was established:
--   OBSERVED           split from the extract, nobody has confirmed it
--   STRONGLY_INFERRED  the code set overlaps an AddVantage table's codes
--   VERIFIED           a workbook sheet or a person maps the UD to the table
--
-- Guarded, idempotent. The seed below is the first attribute whose values
-- were supplied by hand; the loader (ingestion step advantage_ud_dictionary)
-- replaces it row for row from code_dictionary.csv.
-- =====================================================================
SET DEFINE OFF;

DECLARE
  PROCEDURE ddl(p VARCHAR2) IS
  BEGIN EXECUTE IMMEDIATE p;
  EXCEPTION WHEN OTHERS THEN IF SQLCODE NOT IN (-955, -1430, -1442) THEN RAISE; END IF; END;
BEGIN
  ddl('CREATE TABLE cp_advantage_ud_dictionary (
        dict_key          VARCHAR2(200) NOT NULL,  -- attribute:code:source
        attribute_name    VARCHAR2(60)  NOT NULL,  -- UD_1, UD_23_1 (canonical, joins legacy_dictionary.field_code_norm)
        parent_attribute  VARCHAR2(60),            -- UD_23 for UD_23_1, NULL for a single
        code_value        VARCHAR2(50)  NOT NULL,  -- as carried: leading zeros kept
        description_value VARCHAR2(400),
        occurrence_count  NUMBER,                  -- rows in the extract carrying this pair (OBSERVED only)
        source            VARCHAR2(20)  NOT NULL,  -- OBSERVED | TABLES
        table_number      NUMBER,                  -- AddVantage lookup table, when linked
        link_status       VARCHAR2(30)  DEFAULT ''OBSERVED'',
        is_pii            CHAR(1)       DEFAULT ''N'',
        updated_at        TIMESTAMP     DEFAULT SYSTIMESTAMP,
        CONSTRAINT pk_cp_addv_ud_dict PRIMARY KEY (dict_key))');
  ddl('CREATE INDEX ix_cp_addv_ud_dict_attr ON cp_advantage_ud_dictionary (attribute_name, source)');
END;
/

-- UD_1 "OWNED BY CODE": the seven values observed, supplied by hand on
-- 2026-10-07 before the extract was profiled in this repository.
MERGE INTO cp_advantage_ud_dictionary t
USING (
  SELECT 'UD_1' AS attribute_name, '1' AS code_value, 'INTERNAL/FIRM ACCOUNT' AS description_value FROM dual UNION ALL
  SELECT 'UD_1', '2', 'CLIENT ACCOUNT'       FROM dual UNION ALL
  SELECT 'UD_1', '3', 'EMPLOYEE ACCOUNT'     FROM dual UNION ALL
  SELECT 'UD_1', '4', 'PARTNER RELATIVE'     FROM dual UNION ALL
  SELECT 'UD_1', '5', 'EMPLOYEE RELATIVE'    FROM dual UNION ALL
  SELECT 'UD_1', '6', 'PARTNER ACCOUNT'      FROM dual UNION ALL
  SELECT 'UD_1', '7', 'RETIRED PARTNER'      FROM dual
) s
ON (t.dict_key = s.attribute_name || ':' || s.code_value || ':OBSERVED')
WHEN MATCHED THEN UPDATE SET
  t.description_value = s.description_value, t.updated_at = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT
  (dict_key, attribute_name, parent_attribute, code_value, description_value,
   occurrence_count, source, link_status)
  VALUES (s.attribute_name || ':' || s.code_value || ':OBSERVED', s.attribute_name, NULL,
   s.code_value, s.description_value, NULL, 'OBSERVED', 'OBSERVED');
COMMIT;
