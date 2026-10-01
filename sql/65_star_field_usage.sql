-- 65_star_field_usage.sql -------------------------------------------------
-- Which published STAR fields are actually USED, per feed family.
--
-- WHY THIS CHANGES AN ANSWER AND NOT JUST A SCREEN. STAR_LAYOUT_DETAIL says
-- what a feed family publishes. It does not say what anybody reads. The SEI
-- crosswalk has been counting every published field as something that must
-- be accounted for, so a family publishing 139 fields of which 49 are read
-- shows 90 apparent gaps that are not gaps -- nothing consumes them. Usage
-- is the column that tells those two apart.
--
-- IT IS EVIDENCE, NOT A DECISION. Loading this does not change a verdict and
-- must not: "unused" is a statement about today's consumers, and a field
-- nobody reads is still a field the contract publishes. It is recorded, it
-- is shown beside the verdict, and a human decides what it means for scope.
--
-- THREE SHEETS, THREE TABLES, ON PURPOSE. The summary is NOT derivable from
-- the matrix -- it carries counts from the layout side that the matrix has
-- no rows for, which is exactly why the workbook also ships a reconciliation
-- sheet. Collapsing them would throw away the disagreement, and the
-- disagreement is the finding.

DECLARE
  e_exists EXCEPTION;
  PRAGMA EXCEPTION_INIT(e_exists, -955);
  PROCEDURE ddl(s VARCHAR2) IS
  BEGIN EXECUTE IMMEDIATE s;
  EXCEPTION WHEN e_exists THEN NULL;
  END;
BEGIN
  -- One row per (feed family, field). FIELD_NORM carries the same
  -- canonicalisation the crosswalk join uses, so a usage row can be matched
  -- to the STAR_LAYOUT_FIELD it describes without a second normalisation
  -- rule to keep in step -- and a NULL here is how the recon sheet's
  -- "did not match by normalised name" rows are found again later.
  ddl('CREATE TABLE star_field_usage (
        usage_id        VARCHAR2(400) NOT NULL,
        data_source     VARCHAR2(40)  NOT NULL,
        feed_family     VARCHAR2(120),
        field_name      VARCHAR2(400),
        -- OUR canonicalisation (_norm_code), used to join STAR_LAYOUT_FIELD
        -- and the rest of the crosswalk, which were all written with it.
        field_norm      VARCHAR2(400),
        -- THE WORKBOOK''S OWN key, as given: FAMILY|FIELDNOSPACES. It is a
        -- DIFFERENT rule -- "Entity Number" is ENTITY_NUMBER to _norm_code
        -- and ENTITYNUMBER here -- and it is the one the reconciliation
        -- sheet was computed with. Both are stored because each answers a
        -- question the other cannot: ours joins our tables, theirs
        -- reproduces their finding.
        normalized_key  VARCHAR2(400),
        -- USED | UNUSED | (whatever the workbook says). Stored as given and
        -- folded only for the flag below, so an unexpected value is visible
        -- rather than silently bucketed.
        usage_status    VARCHAR2(40),
        is_used         CHAR(1),
        matrix_value    VARCHAR2(200),
        source_sheet    VARCHAR2(200),
        source_row      NUMBER,
        source_document VARCHAR2(400),
        -- The workbook''s caveat, carried per row because that is where it
        -- was written: "Blank Used/Unused value interpreted as Unused."
        -- That is a reading of the evidence, not the evidence, and anyone
        -- acting on an Unused needs to see it.
        notes           VARCHAR2(1000),
        loaded_at       TIMESTAMP DEFAULT SYSTIMESTAMP,
        CONSTRAINT pk_star_field_usage PRIMARY KEY (usage_id))');
  ddl('CREATE INDEX ix_sfu_fam ON star_field_usage (data_source, feed_family)');
  ddl('CREATE INDEX ix_sfu_norm ON star_field_usage (data_source, field_norm)');
  ddl('CREATE INDEX ix_sfu_key ON star_field_usage (data_source, normalized_key)');

  -- The workbook''s own totals per family. DECLARED_* because they are the
  -- workbook speaking; what the matrix rows actually add up to is computed
  -- at read time and shown beside them. Where they disagree, the recon
  -- table says why.
  ddl('CREATE TABLE star_field_usage_summary (
        summary_id      VARCHAR2(300) NOT NULL,
        data_source     VARCHAR2(40)  NOT NULL,
        feed_family     VARCHAR2(120),
        total_fields    NUMBER,
        used_fields     NUMBER,
        unused_fields   NUMBER,
        used_percent    NUMBER,
        -- The layout side, named exactly as the workbook names it.
        -- MATCHED + UNMATCHED = CATALOG_LAYOUT_FIELDS, and the unmatched
        -- count is the one worth watching: it is how many published fields
        -- the usage study never reached, per family.
        catalog_layout_fields          NUMBER,
        matrix_matched_layout_fields   NUMBER,
        matrix_unmatched_layout_fields NUMBER,
        notes           VARCHAR2(1000),
        loaded_at       TIMESTAMP DEFAULT SYSTIMESTAMP,
        CONSTRAINT pk_star_field_usage_sum PRIMARY KEY (summary_id))');

  -- Why the two sides do not agree, one row per disagreement. RECON_TYPE is
  -- the workbook''s own classification (MATRIX_FIELD_NOT_IN_STAR_LAYOUT and
  -- friends) and is stored as given: inventing our own vocabulary for
  -- somebody else''s finding is how two systems end up describing the same
  -- row differently.
  ddl('CREATE TABLE star_field_usage_recon (
        recon_id        VARCHAR2(400) NOT NULL,
        data_source     VARCHAR2(40)  NOT NULL,
        recon_type      VARCHAR2(120),
        feed_family     VARCHAR2(120),
        field_name      VARCHAR2(400),
        field_norm      VARCHAR2(400),
        usage_status    VARCHAR2(40),
        detail          VARCHAR2(1000),
        source_document VARCHAR2(400),
        loaded_at       TIMESTAMP DEFAULT SYSTIMESTAMP,
        CONSTRAINT pk_star_field_usage_recon PRIMARY KEY (recon_id))');
  ddl('CREATE INDEX ix_sfur_type ON star_field_usage_recon (data_source, recon_type)');
END;
/

-- ---------------------------------------------------------------- check
-- Read-only. Run after the load; it reports what the data says rather than
-- what the load intended.
--
--   1. rows per table
-- SELECT 'star_field_usage' t, COUNT(*) n FROM star_field_usage
-- UNION ALL SELECT 'summary', COUNT(*) FROM star_field_usage_summary
-- UNION ALL SELECT 'recon', COUNT(*) FROM star_field_usage_recon;
--
--   2. declared totals vs what the matrix rows actually add up to.
--      A difference is not an error -- it is the thing the recon sheet
--      exists to explain -- but an UNEXPLAINED difference is.
-- SELECT s.feed_family, s.total_fields AS declared_total,
--        m.n AS matrix_rows, s.used_fields AS declared_used, m.used,
--        (SELECT COUNT(*) FROM star_field_usage_recon r
--          WHERE r.feed_family = s.feed_family) AS recon_rows
--   FROM star_field_usage_summary s
--   LEFT JOIN (SELECT feed_family, COUNT(*) n,
--                     SUM(CASE WHEN is_used = 'Y' THEN 1 ELSE 0 END) used
--                FROM star_field_usage GROUP BY feed_family) m
--     ON m.feed_family = s.feed_family
--  ORDER BY s.feed_family;
--
--   3. usage rows that match no published layout field. These are the
--      MATRIX_FIELD_NOT_IN_STAR_LAYOUT cases; the count here should agree
--      with the recon sheet's own count.
-- SELECT COUNT(*) FROM star_field_usage u
--  WHERE NOT EXISTS (SELECT 1 FROM star_layout_field f
--                     WHERE f.data_source = u.data_source
--                       AND f.feed_family = u.feed_family
--                       AND f.field_norm  = u.field_norm);
