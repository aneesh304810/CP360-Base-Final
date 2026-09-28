-- 55_lineage_lane.sql ---------------------------------------------------
-- Which lane does a lineage row belong to?
--
-- LEGACY_LINEAGE has no lane column and must not gain one: it is shared with
-- whatever loaded the warehouse's baseline, and an ALTER on it is a change to
-- someone else's table. So the attribution lives beside it, keyed by the same
-- LINEAGE_ID.
--
-- Without this table the STAR/UAF badge selects nothing. Both lanes land in
-- LEGACY_LINEAGE under one DATA_SOURCE, indistinguishable, and the only way
-- to tell them apart was to normalise SRC_SOURCE_TABLE into a feed key and
-- join LEGACY_SOURCE_FILE — which works for STAR and fails for UAF, because
-- a UAF message is not named the same way in LANE_LINEAGE as in UAF_FEED.
-- LANE_LINEAGE already carries LANE_ID on every row. This records it.
--
-- Additive. Nothing existing reads it; nothing existing breaks without it.

DECLARE
  e_exists EXCEPTION;
  PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE legacy_lineage_lane (
      lineage_id         VARCHAR2(400) NOT NULL,
      lane_id            VARCHAR2(80),
      source_system      VARCHAR2(60),
      data_source        VARCHAR2(30),
      dwh_target_table   VARCHAR2(200),
      dwh_target_column  VARCHAR2(200),
      src_source_table   VARCHAR2(400),
      src_file_key       VARCHAR2(400),
      CONSTRAINT pk_legacy_lineage_lane PRIMARY KEY (lineage_id)
    )';
EXCEPTION WHEN e_exists THEN NULL;
END;
/

DECLARE
  PROCEDURE idx(p_sql VARCHAR2) IS
    e_dup EXCEPTION; PRAGMA EXCEPTION_INIT(e_dup, -955);
    e_col EXCEPTION; PRAGMA EXCEPTION_INIT(e_col, -1408);
  BEGIN
    EXECUTE IMMEDIATE p_sql;
  EXCEPTION
    WHEN e_dup THEN NULL;
    WHEN e_col THEN NULL;
  END;
BEGIN
  idx('CREATE INDEX ix_lll_ds_sys  ON legacy_lineage_lane (data_source, source_system)');
  idx('CREATE INDEX ix_lll_ds_src  ON legacy_lineage_lane (data_source, src_source_table)');
  idx('CREATE INDEX ix_lll_ds_tgt  ON legacy_lineage_lane (data_source, dwh_target_table)');
END;
/

-- Health check. Every lineage row for a warehouse should be attributable.
--
--   SELECT NVL(l.source_system,'(unattributed)') sys, COUNT(*) rows_
--   FROM   legacy_lineage g
--   LEFT   JOIN legacy_lineage_lane l ON l.lineage_id = g.lineage_id
--   WHERE  g.data_source = 'IMDS'
--   GROUP  BY NVL(l.source_system,'(unattributed)')
--   ORDER  BY 2 DESC;
