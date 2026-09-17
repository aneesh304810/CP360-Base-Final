-- ============================================================================
-- 50_legacy_source_file.sql
-- The CP_SOURCE_FILE sheet: what each AddVantage EOD feed is, in business words.
--
-- Why: legacy_lineage.src_source_table holds the physical transmission name —
--   Addv-ACCT-CHK-REG_BBH-TRP_YYYYMMDDHHMMSS.dat
-- which tells a business reader nothing. The workbook has always carried the
-- answer on its own sheet:
--   column A  AddVantage EOD Data feed   the physical file
--   column B  Dataset                    "Account-Check Register"
-- and nothing ingested it. This table is that sheet, plus the join key.
--
-- THE JOIN KEY. src_source_table sometimes carries the full transmission name
-- and sometimes a shorter form, so matching on the raw string alone misses.
-- SRC_FILE_KEY is the name with the extension, the date placeholder
-- (YYYYMMDDHHMMSS) and the sequence placeholder (<SEQ NO.>) removed, separators
-- collapsed to underscores, uppercased, and any BBH/TRP transmission tokens
-- dropped FROM THE END only.
--
-- That last restriction matters: BBH_REQUEST_AUTHORIZER is a real source table
-- whose name begins with BBH, and stripping the token wherever it appeared
-- would have turned it into REQUEST_AUTHORIZER and broken its own lineage.
--
-- Additive: nothing already loaded changes, and every screen works unchanged
-- if this table is empty or absent.
-- ============================================================================

DECLARE
  e_exists EXCEPTION;  PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE legacy_source_file (
      src_file        VARCHAR2(400) NOT NULL,   -- column A, verbatim
      src_file_key    VARCHAR2(400) NOT NULL,   -- the join key (see above)
      dataset         VARCHAR2(400),            -- column B, the business name
      source_system   VARCHAR2(40)  DEFAULT ''ADDVANTAGE'',
      data_source     VARCHAR2(40)  DEFAULT ''PBDW'',
      updated_at      TIMESTAMP     DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_legacy_source_file PRIMARY KEY (src_file)
    )';
EXCEPTION WHEN e_exists THEN NULL;
END;
/

DECLARE
  e_idx EXCEPTION;  PRAGMA EXCEPTION_INIT(e_idx, -955);
BEGIN
  EXECUTE IMMEDIATE
    'CREATE INDEX ix_legacy_source_file_key ON legacy_source_file (src_file_key)';
EXCEPTION WHEN e_idx THEN NULL;
END;
/

-- How well does it join? Run after loading. src_tables_matched well below
-- src_tables_total means the lineage sheet spells its source files in a form
-- the key does not reach — send the mismatches rather than widening the rule
-- by guesswork.
--
-- SELECT COUNT(DISTINCT l.src_source_table) AS src_tables_total,
--        COUNT(DISTINCT CASE WHEN f.src_file IS NOT NULL
--                            THEN l.src_source_table END) AS src_tables_matched
-- FROM   legacy_lineage l
-- LEFT   JOIN legacy_source_file f
--        ON f.src_file_key = UPPER(REGEXP_REPLACE(
--             REGEXP_REPLACE(l.src_source_table,
--               '(\.dat|\.txt|\.csv)$|<[^>]*>|Y{4}M{2}D{2}(H{2}M{2}S{2})?', ''),
--             '[^A-Za-z0-9]+', '_'))
-- WHERE  l.src_source_table IS NOT NULL;
