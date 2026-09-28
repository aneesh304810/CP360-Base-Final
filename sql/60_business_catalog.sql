-- 60_business_catalog.sql -----------------------------------------------
-- What each warehouse table IS, in business words.
--
-- The Business view showed DIM_IP_REL_REMIT_BLOCKS, ACCOUNT_KEY and
-- FIS_LOAD_DATE — the same estate the Technical view shows, entered the
-- same way. The reason is that nothing in the catalogue says what a
-- warehouse TABLE is for. LEGACY_DICTIONARY answers that for a SOURCE
-- field, and _legacy_groups resolves a grouping from five columns, but a
-- business name and a sentence of description per warehouse table exist
-- nowhere. This is that layer.
--
-- IT DOES NOT OWN THE GROUPING, AND MUST NOT LEARN TO.
-- LEGACY_LINEAGE.FUNCTIONAL_GROUP is already ingested and is the authority
-- — sixteen values the business authored. SUGGESTED_GROUP here is read ONLY
-- where a table has no functional_group at all, it is written in those same
-- sixteen values plus four proposals, and the UI says when it is the one
-- being shown. A second taxonomy competing with the authored one is the
-- failure this column is shaped to avoid, so 62_business_catalog_check.sql
-- reports the real distribution and no figure should be quoted from this
-- column without running it.
--
-- HISTORY IS AN AXIS, NOT A DOMAIN. The workbook has a "History" group, but
-- DIM_ACCOUNT_UD_HIST is an account table and a history table at once.
-- Filing it under History empties Account Master of its own history and
-- fills History with ten unrelated subjects. IS_HISTORY is a flag so the
-- view can offer it as a filter over the real domains instead.
--
-- Additive. Nothing existing reads it; nothing existing breaks without it.
-- Seeded separately from the CSV in docs/business-catalog, which is the
-- reviewable copy — a reload of the workbook must not discard a review.

DECLARE
  e_exists EXCEPTION;
  PRAGMA EXCEPTION_INIT(e_exists, -955);
  PROCEDURE ddl(s VARCHAR2) IS
  BEGIN EXECUTE IMMEDIATE s;
  EXCEPTION WHEN e_exists THEN NULL;
  END;
BEGIN
  ddl('CREATE TABLE business_catalog (
        data_source           VARCHAR2(30)  DEFAULT ''PBDW'' NOT NULL,
        table_name            VARCHAR2(200) NOT NULL,
        business_name         VARCHAR2(200),
        business_description  VARCHAR2(1000),
        grain                 VARCHAR2(200),
        suggested_group       VARCHAR2(120),
        is_history            CHAR(1) DEFAULT ''N'',
        is_staging            CHAR(1) DEFAULT ''N'',
        -- high | med | low. low means an abbreviation nobody outside the
        -- load team can expand; the view shows these as unconfirmed rather
        -- than printing a guess in the business''s own voice.
        confidence            VARCHAR2(10)  DEFAULT ''med'',
        review_status         VARCHAR2(20)  DEFAULT ''DRAFT'',
        reviewed_by           VARCHAR2(120),
        reviewed_on           DATE,
        source_of_text        VARCHAR2(40)  DEFAULT ''GENERATED'',
        updated_at            TIMESTAMP DEFAULT SYSTIMESTAMP,
        CONSTRAINT pk_business_catalog PRIMARY KEY (data_source, table_name))');

  ddl('CREATE INDEX ix_bizcat_group ON business_catalog (data_source, suggested_group)');
  ddl('CREATE INDEX ix_bizcat_review ON business_catalog (review_status, confidence)');
END;
/
