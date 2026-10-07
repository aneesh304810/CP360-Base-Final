-- =====================================================================
-- sql/77_advantage_ud_ingest.sql
-- The extract itself, the UD workbook, and the TRP reconciliation.
--
--   cp_advantage_ud_raw          one row per extract row: the ids, the
--                                payload's hash and signatures, never the
--                                payload (it stays in DIM_ACCOUNT_UD).
--   cp_advantage_ud_attribute    one row per extract row per key: the
--                                value AS A STRING with its label. This is
--                                the Silver grain. Leading zeros kept.
--   cp_advantage_ud_quarantine   extract rows that did not parse. Headers
--                                exist even when the run has none.
--   cp_advantage_ud_field_type   the five AddVantage UD field types.
--   cp_advantage_ud_table        the AddVantage lookup tables (List sheet).
--   cp_advantage_ud_link         UD attribute -> lookup table, with how it
--                                was established (VERIFIED from a sheet,
--                                STRONGLY_INFERRED from code overlap).
--   cp_advantage_ud_recon        TRP samples vs the extract, per attribute:
--                                counts only.
--
-- The attribute table carries values, so it carries PII (household names,
-- officer names via table 5). It is for the warehouse's own use; the API
-- never selects raw_value from it. Guarded, idempotent. Requires 75, 76.
-- =====================================================================
SET DEFINE OFF;

DECLARE
  PROCEDURE ddl(p VARCHAR2) IS
  BEGIN EXECUTE IMMEDIATE p;
  EXCEPTION WHEN OTHERS THEN IF SQLCODE NOT IN (-955, -1430, -1442) THEN RAISE; END IF; END;
BEGIN
  ddl('CREATE TABLE cp_advantage_ud_raw (
        account_ud_key        NUMBER(20)   NOT NULL,
        account_number        VARCHAR2(20) NOT NULL,
        account_key           NUMBER(20),
        as_of_date            VARCHAR2(30),            -- as delivered (DD-MON-RR); cast downstream
        load_date             VARCHAR2(60),
        batch_id              VARCHAR2(30),            -- 20 digits, never a number
        load_type             VARCHAR2(20),
        fis_load_date         VARCHAR2(60),
        active_ind            VARCHAR2(1),
        created_tsp           VARCHAR2(60),
        updated_tsp           VARCHAR2(60),
        source_row_number     NUMBER,
        payload_hash          VARCHAR2(64),            -- SHA-256 of the CLOB text
        payload_length        NUMBER,
        key_count             NUMBER,
        schema_signature      VARCHAR2(16),
        typed_signature       VARCHAR2(16),
        parse_status          VARCHAR2(20),            -- OK | QUARANTINED
        loaded_at             TIMESTAMP DEFAULT SYSTIMESTAMP,
        CONSTRAINT pk_cp_addv_ud_raw PRIMARY KEY (account_ud_key))');
  ddl('CREATE INDEX ix_cp_addv_ud_raw_acct ON cp_advantage_ud_raw (account_number)');
  ddl('CREATE INDEX ix_cp_addv_ud_raw_sig ON cp_advantage_ud_raw (schema_signature)');

  ddl('CREATE TABLE cp_advantage_ud_attribute (
        attr_key              VARCHAR2(100) NOT NULL,  -- account_ud_key:attribute_name
        account_ud_key        NUMBER(20)   NOT NULL,
        account_number        VARCHAR2(20) NOT NULL,
        attribute_name        VARCHAR2(60) NOT NULL,
        attribute_number      NUMBER,
        parent_attribute      VARCHAR2(60),
        sequence_number       NUMBER,
        key_structure         VARCHAR2(20),
        is_ud_attribute       CHAR(1),
        raw_value             VARCHAR2(4000),          -- the string, untouched
        value_type            VARCHAR2(30),            -- a label, not a cast
        date_mask             VARCHAR2(120),
        code_value            VARCHAR2(100),
        description_value     VARCHAR2(2000),
        leading_zero_ind      CHAR(1),
        value_length          NUMBER,
        loaded_at             TIMESTAMP DEFAULT SYSTIMESTAMP,
        CONSTRAINT pk_cp_addv_ud_attr PRIMARY KEY (attr_key))');
  ddl('CREATE INDEX ix_cp_addv_ud_attr_name ON cp_advantage_ud_attribute (attribute_name)');
  ddl('CREATE INDEX ix_cp_addv_ud_attr_acct ON cp_advantage_ud_attribute (account_number, attribute_name)');

  ddl('CREATE TABLE cp_advantage_ud_quarantine (
        quarantine_key        VARCHAR2(100) NOT NULL,  -- account_ud_key or row:<n>
        source_row_number     NUMBER,
        account_number        VARCHAR2(20),
        account_ud_key        NUMBER(20),
        batch_id              VARCHAR2(30),
        parse_error           VARCHAR2(400),
        payload_sample        VARCHAR2(1000),
        loaded_at             TIMESTAMP DEFAULT SYSTIMESTAMP,
        CONSTRAINT pk_cp_addv_ud_quar PRIMARY KEY (quarantine_key))');

  ddl('CREATE TABLE cp_advantage_ud_field_type (
        type_code             NUMBER       NOT NULL,   -- 1 Date, 2 Yes/No, 3 Text, 4 Money, 6 Table
        type_name             VARCHAR2(60),
        type_description      VARCHAR2(1000),
        value_class           VARCHAR2(40),            -- what the catalogue calls it
        CONSTRAINT pk_cp_addv_ud_ftype PRIMARY KEY (type_code))');

  ddl('CREATE TABLE cp_advantage_ud_table (
        table_number          NUMBER       NOT NULL,
        table_name            VARCHAR2(200),
        table_type            NUMBER,
        code_count            NUMBER,
        is_pii                CHAR(1) DEFAULT ''N'',   -- table 5 OFFICER TABLE holds employee names
        sme_notes             VARCHAR2(2000),
        CONSTRAINT pk_cp_addv_ud_table PRIMARY KEY (table_number))');

  ddl('CREATE TABLE cp_advantage_ud_link (
        attribute_name        VARCHAR2(60) NOT NULL,
        table_number          NUMBER       NOT NULL,
        link_status           VARCHAR2(30),            -- VERIFIED | STRONGLY_INFERRED | WEAK
        overlap_pct           NUMBER(9,4),             -- observed codes found in the table
        observed_codes        NUMBER,
        matched_codes         NUMBER,
        source_sheet          VARCHAR2(200),
        CONSTRAINT pk_cp_addv_ud_link PRIMARY KEY (attribute_name, table_number))');

  ddl('CREATE TABLE cp_advantage_ud_recon (
        attribute_name        VARCHAR2(60) NOT NULL,
        trp_rows              NUMBER,                  -- sample rows carrying the attribute
        matched_accounts      NUMBER,                  -- sample account found in the extract
        value_equal           NUMBER,
        value_differs         NUMBER,
        missing_in_extract    NUMBER,                  -- account in extract, key absent
        account_not_in_extract NUMBER,
        null_tokens           NUMBER,                  -- N/A, NA, NONE, SILENT, blank
        junk_markers          NUMBER,                  -- #ERROR, DELETE FILE, TEST, DUPE ...
        in_registry           CHAR(1),
        loaded_at             TIMESTAMP DEFAULT SYSTIMESTAMP,
        CONSTRAINT pk_cp_addv_ud_recon PRIMARY KEY (attribute_name))');
END;
/

MERGE INTO cp_advantage_ud_field_type t
USING (SELECT 1 AS type_code, 'Date' AS type_name, 'Accepts MMDDYY or MM/DD/YY' AS type_description, 'DATE' AS value_class FROM dual UNION ALL
       SELECT 2, 'Yes/No', 'Y or N', 'BOOLEAN_FLAG' FROM dual UNION ALL
       SELECT 3, 'Text', 'Up to 99 lines of 32 characters each', 'TEXT' FROM dual UNION ALL
       SELECT 4, 'Money', 'Up to 10 digits', 'CURRENCY' FROM dual UNION ALL
       SELECT 6, 'Table', 'Value must come from an AddVantage system table', 'CODE_DESCRIPTION' FROM dual) s
ON (t.type_code = s.type_code)
WHEN NOT MATCHED THEN INSERT (type_code, type_name, type_description, value_class)
  VALUES (s.type_code, s.type_name, s.type_description, s.value_class);
COMMIT;
