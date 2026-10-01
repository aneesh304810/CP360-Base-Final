-- 66_sei_verify_usage_key.sql ---------------------------------------------
-- The one column that connects STAR field usage to the crosswalk verdicts.
--
-- THE QUESTION IT UNLOCKS: "how many of the open items are fields nobody
-- reads?" That is the part of the backlog that may not be work at all, and
-- until now it could not be answered. SEI_VERIFY stores CONTRACT_FIELD as
-- written -- "Entity Number" -- and STAR_FIELD_USAGE is keyed on the
-- workbook's own normalisation, ACDDIFI1|ENTITYNUMBER. Nothing joined.
--
-- WHY NOT NORMALISE IN THE QUERY. Because the two sides would then be
-- normalised by two different implementations -- Python on the way in, SQL
-- on the way out -- free to drift apart. A join that silently stops
-- matching does not raise; it returns a smaller number, and a smaller
-- number here reads as good news. The key is computed once, by the same
-- function that wrote STAR_FIELD_USAGE.NORMALIZED_KEY, and stored.
--
-- TWO KEYS, BECAUSE THE FEED NAME IS THE UNRELIABLE HALF. CONTRACT_FEED is
-- sometimes the bare family (ACDDIFI1) and sometimes a longer label. The
-- field name is dependable. So the family-qualified key is tried first and
-- the field-only key second, and /star-usage/coverage says which one
-- answered -- a match on the weaker key is still a match, but the reader
-- should know it was the weaker one.

DECLARE
  PROCEDURE add_col(tbl VARCHAR2, col VARCHAR2, spec VARCHAR2) IS
  BEGIN
    EXECUTE IMMEDIATE 'ALTER TABLE ' || tbl || ' ADD (' || col || ' ' || spec || ')';
  EXCEPTION
    -- ORA-01430: column already exists. Re-running is safe.
    WHEN OTHERS THEN
      IF SQLCODE != -1430 THEN RAISE; END IF;
  END;
  PROCEDURE ddl(s VARCHAR2) IS
  BEGIN EXECUTE IMMEDIATE s;
  EXCEPTION WHEN OTHERS THEN
    IF SQLCODE NOT IN (-955, -1408) THEN RAISE; END IF;   -- exists / indexed
  END;
BEGIN
  -- FAMILY|FIELD, both upper-cased with every non-alphanumeric removed.
  add_col('sei_verify', 'contract_key', 'VARCHAR2(400)');
  -- FIELD alone, same rule. The fallback when the feed name does not line up.
  add_col('sei_verify', 'contract_field_key', 'VARCHAR2(400)');
  ddl('CREATE INDEX ix_sei_verify_ckey ON sei_verify (data_source, contract_key)');
  ddl('CREATE INDEX ix_sei_verify_fkey ON sei_verify (data_source, contract_field_key)');
END;
/

-- POPULATED BY THE LOADER, NOT HERE. Re-run the sei_crosswalk ingestion
-- step and every row is written with both keys. There is deliberately no
-- UPDATE in this file: an UPDATE would be a second implementation of the
-- normalisation rule, in SQL, and the whole point of storing the key is to
-- have exactly one.
--
-- Check it afterwards:
--
--   SELECT COUNT(*) AS total,
--          COUNT(contract_key) AS keyed,
--          COUNT(*) - COUNT(contract_key) AS unkeyed
--     FROM sei_verify WHERE data_source = 'IMDS';
--
-- `unkeyed` counts rows whose CONTRACT_FIELD is blank -- columns with no
-- STAR field behind them at all. That is a real state (NO_SOURCE), not a
-- load failure, and it should roughly equal:
--
--   SELECT COUNT(*) FROM sei_verify
--    WHERE data_source = 'IMDS' AND contract_field IS NULL;
