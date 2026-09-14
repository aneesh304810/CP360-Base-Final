-- =====================================================================
-- sql/27_legacy_dictionary.sql  (v2 — AddVantage master workbook shape)
-- Legacy business dictionary — one row per (source_system, field_code_norm,
-- master). Ingested from the AddVantage master workbook's "ALL" sheet
-- (and future CRD/STAR workbooks).
--
-- field_code_norm holds the CANONICAL join key: separators "/ . -" -> "_",
-- then "_L<digits>" -> "_<digits>", so the dictionary's BI/2-1 and the DWH
-- sheet's BI_2_L1 both resolve to BI_2_1. The same canonicalization is
-- applied to legacy_lineage.src_source_column at query time.
--
-- Classification columns (privacy/regulatory/operational/status) are kept
-- nullable for workbooks that carry them; the AddVantage master workbook
-- does not.
-- Idempotent guarded DDL, matching the style of 20_search_index.sql.
-- =====================================================================
SET DEFINE OFF;

DECLARE
  PROCEDURE ddl(p VARCHAR2) IS
  BEGIN EXECUTE IMMEDIATE p;
  EXCEPTION WHEN OTHERS THEN IF SQLCODE NOT IN (-955, -1430, -1442) THEN RAISE; END IF; END;
BEGIN
  ddl('CREATE TABLE legacy_dictionary (
        dict_key          VARCHAR2(200) NOT NULL,  -- system:field_code_norm:master
        source_system     VARCHAR2(40)  NOT NULL,  -- ADDVANTAGE | CRD | STAR
        field_code        VARCHAR2(120),           -- as authored, e.g. BI/2-1
        field_code_norm   VARCHAR2(120) NOT NULL,  -- canonical join key, e.g. BI_2_1
        asset_name        VARCHAR2(400),
        business_term     VARCHAR2(400),           -- ADDV Name
        business_function VARCHAR2(400),           -- Group, e.g. Basic Information (BI)
        master_name       VARCHAR2(200),           -- e.g. Account Master
        data_type         VARCHAR2(120),           -- raw: A / N / Date / A/N / ...
        max_length        VARCHAR2(40),
        num_precision     VARCHAR2(40),
        date_format       VARCHAR2(120),
        is_required       CHAR(1) DEFAULT ''N'',
        is_unique         CHAR(1) DEFAULT ''N'',
        short_desc        VARCHAR2(2000),          -- first line of Description
        long_desc         CLOB,                    -- full multi-line Description
        pb_field_mapping  VARCHAR2(400),
        comments_txt      CLOB,                    -- Data Selection / Comments
        privacy_class     VARCHAR2(60),
        regulatory_class  VARCHAR2(60),
        operational_class VARCHAR2(60),
        status            VARCHAR2(60),
        is_pii            CHAR(1) DEFAULT ''N'',
        updated_at        TIMESTAMP DEFAULT SYSTIMESTAMP,
        CONSTRAINT pk_legacy_dictionary PRIMARY KEY (dict_key))');

  -- lookup by canonical code within a system (the lineage join)
  ddl('CREATE INDEX ix_legacy_dict_code ON legacy_dictionary (source_system, field_code_norm)');
  -- lookup by canonical code across systems (search / fallback)
  ddl('CREATE INDEX ix_legacy_dict_norm ON legacy_dictionary (field_code_norm)');
  -- browse by master
  ddl('CREATE INDEX ix_legacy_dict_master ON legacy_dictionary (source_system, master_name)');
END;
/
