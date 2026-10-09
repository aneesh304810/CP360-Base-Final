-- ============================================================================
-- 80_sei_lineage_v4.sql
-- The v4 crosswalk workbook (STAR_IMDS_SEI_Lineage_Catalog_v4_SEI-Source-
-- Files): the SEI side of every mapping resolved to the SEI feed FILE that
-- carries it, and the end-to-end sheet rebuilt at a wider grain.
--
-- WHAT CHANGED IN THE WORKBOOK.
--
--   SEI_STAR_IMDS_LINEAGE     replaces SEI_STAR_IMDS_E2E_XWALK. One row per
--                             IMDS column OR orphan STAR field (1,285 rows,
--                             was 1,121 paths). LINK_STATUS is gone; the
--                             row's shape is LINEAGE_COMPLETENESS, and two
--                             new shapes appear: SEI_TO_STAR_NO_IMDS_TARGET
--                             (a STAR field the documents map but nothing
--                             loads) and NOT_POPULATED_IN_LOAD (an IMDS
--                             column the STAR load never writes). It lands
--                             in SEI_E2E_XWALK, the table every screen
--                             reads, with the new columns below.
--   LINEAGE_SUMMARY           formula counts per STAR feed + IMDS table.
--                             Lands in SEI_CONTROL; the API recomputes it.
--   SEI_SOURCE_FILE,          on SEI_TO_STAR_FIELD_MAP, LOT_LEVEL_POSITION_MAP
--   SEI_SOURCE_FILE_FIELDS,   and the lineage: the SEI feed file(s) resolved
--   SEI_SOURCE_FILE_STATUS    from the published feed spec, the exact
--                             File.FIELD pairs, and how well they resolved.
--   SEI_TO_STAR_FIELD_MAP     571 rows, was 479: 92 STAR layout fields the
--                             documents never mention are added from
--                             STAR_LAYOUT_DETAIL (SOURCE_SHEET says so).
--
-- Everything is ADD COLUMN; a column that already exists is skipped
-- (ORA-1430), so the script is idempotent. Run once before loading v4.
-- ============================================================================

DECLARE
  PROCEDURE ddl(p_sql VARCHAR2) IS
    e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
    e_col    EXCEPTION; PRAGMA EXCEPTION_INIT(e_col,    -1430);
    e_shrink EXCEPTION; PRAGMA EXCEPTION_INIT(e_shrink, -1441);
    e_notab  EXCEPTION; PRAGMA EXCEPTION_INIT(e_notab,  -942);
  BEGIN
    EXECUTE IMMEDIATE p_sql;
  EXCEPTION WHEN e_exists THEN NULL; WHEN e_col THEN NULL; WHEN e_shrink THEN NULL; WHEN e_notab THEN NULL;
  END;
BEGIN
  -- the end-to-end lineage, v4 grain
  ddl('ALTER TABLE sei_e2e_xwalk ADD (
        lineage_id             VARCHAR2(120),             -- LINEAGE_ID as written (LIN-<hash>)
        sei_file               VARCHAR2(400),             -- SEI_SOURCE_FILE: the feed file(s), ; separated
        sei_file_fields        VARCHAR2(1000),            -- SEI_SOURCE_FILE_FIELDS: File.FIELD pairs
        sei_file_status        VARCHAR2(40),              -- VERIFIED_IN_FEED_SPEC | PARTIALLY_VERIFIED | FILE_ONLY_NO_FIELD | SYSTEM_OR_CONSTANT | DERIVED_AT_RUNTIME | FIELD_NOT_IN_FEED_SPEC | NOT_AVAILABLE_IN_SEI_FEEDS | UNRESOLVED | NO_SEI_SOURCE
        star_field_resolution  VARCHAR2(40),              -- DOCUMENTED | PARSED_FROM_IM_LOGIC | MATCHED_BY_TARGET_NAME | LANE_LINEAGE | SEI_TO_STAR_FIELD_MAP | NOT_RESOLVED
        imds_type              VARCHAR2(80),
        imds_nullable          VARCHAR2(10),
        sei_imds_logic_origin  VARCHAR2(40),              -- DOCUMENTED | COMPOSED_FROM_STAR_LOGIC | COMPOSED_DIRECT | SEI_JOIN_LOGIC_ONLY | MISSING
        business_decision      CHAR(1),
        comparison_id          VARCHAR2(120))');
  -- link_class gains NOT_POPULATED (the column the STAR load never writes);
  -- the column was VARCHAR2(30) already, nothing to widen.

  -- the SEI -> STAR hop
  ddl('ALTER TABLE sei_star_field_map ADD (
        sei_file               VARCHAR2(400),
        sei_file_fields        VARCHAR2(1000),
        sei_file_status        VARCHAR2(40))');

  -- the STAR -> IMDS hop (carried if the sheet has them)
  ddl('ALTER TABLE star_imds_stage_map ADD (
        sei_file               VARCHAR2(400),
        sei_file_fields        VARCHAR2(1000),
        sei_file_status        VARCHAR2(40))');

  -- the raw LOT_LEVEL_POSITION import
  ddl('ALTER TABLE lot_level_position_map ADD (
        sei_source_file        VARCHAR2(400),
        sei_source_file_fields VARCHAR2(1000),
        sei_source_file_status VARCHAR2(40))');

  -- v4's SEI_SOURCE is free text up to 620 chars ("Not available in SI data
  -- feeds", a join described in words); the object parsed out of it can
  -- exceed the 200 the v2 column was given.
  ddl('ALTER TABLE sei_e2e_xwalk MODIFY (sei_object VARCHAR2(1000))');
  ddl('ALTER TABLE sei_e2e_xwalk MODIFY (sei_field_norm VARCHAR2(1000))');

  ddl('CREATE INDEX ix_see_file ON sei_e2e_xwalk (data_source, sei_file_status)');
END;
/
