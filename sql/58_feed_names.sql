-- 58_feed_names.sql ------------------------------------------------------
--
-- What a feed IS, beside what it is called.
--
-- The Source view lists three cards reading "STAR outbound dataset", with
-- PEDDIFI1, TBMEIFI7 and ACDDIFI1 underneath. The heading is the same on
-- all three, so the only thing distinguishing them is an eight-character
-- code, and nobody outside the team knows that PEDDIFI1 is the portfolio
-- valuation. The flow diagram has the same problem: its middle column is
-- codes.
--
-- The workbook cannot fix this. STAR_FEED.DATASET carries a classification
-- ("STAR outbound dataset"), not a name, and that is a reasonable thing for
-- it to carry — the names live in the delivery folder the feeds are
-- published from, which is not an input to the workbook.
--
-- So: a small register, seeded from that folder, joined on the normalised
-- feed key so a spelling difference does not silently drop a name. It is
-- deliberately a table rather than a constant in the UI: these names change
-- when the business renames a feed, and that should be an UPDATE rather
-- than a release.
--
-- SOURCE tells you where a name came from, and it matters. DELIVERY_FOLDER
-- means someone read it off the published file list; WORKBOOK means the
-- ingest supplied it and it should win. Nothing here is evidence about
-- lineage — a name is a label, and mistaking it for a mapping is the error
-- this whole schema is arranged to prevent.

DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE feed_alias (
      alias_id       VARCHAR2(300) NOT NULL,   -- {ds}:{feed_key}
      data_source    VARCHAR2(40),
      feed_key       VARCHAR2(200),            -- normalised, joins anything
      feed_code      VARCHAR2(200),            -- as published
      business_name  VARCHAR2(400),
      source_system  VARCHAR2(60),
      source         VARCHAR2(60),             -- DELIVERY_FOLDER | WORKBOOK | MANUAL
      notes          VARCHAR2(2000),
      updated_at     TIMESTAMP DEFAULT SYSTIMESTAMP,
      CONSTRAINT pk_feed_alias PRIMARY KEY (alias_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/

-- The STAR daily delivery folder, as published.
--
-- TWO DISCREPANCIES ARE SEEDED AS THEY ARE, NOT RECONCILED.
--
--   TBMEIFI7 vs TBDEIFI7 — the workbook and the loaded data say TBMEIFI7;
--   the delivery folder says TBDEIFI7 - Trail Balance. One of them is
--   wrong and I cannot tell which from here. Both keys are seeded with the
--   same name and a note, so the screen reads correctly either way and the
--   conflict stays visible instead of being quietly resolved by whichever
--   spelling I happened to prefer.
--
--   OTDDIFI1 - Open Trades is in the delivery folder and not among the
--   nine feeds STAR_FEED registers. Seeded anyway: an alias for a feed
--   that never arrives costs nothing, and its absence from the workbook is
--   worth someone noticing.

MERGE INTO feed_alias t USING (
  SELECT 'IMDS:TJDDIFI1' alias_id, 'IMDS' ds, 'TJDDIFI1' k, 'TJDDIFI1' c,
         'Transaction Journal' n, 'STAR' s, 'DELIVERY_FOLDER' src, NULL nt FROM dual
  UNION ALL SELECT 'IMDS:OTDDIFI1','IMDS','OTDDIFI1','OTDDIFI1','Open Trades','STAR',
    'DELIVERY_FOLDER','In the delivery folder; not registered in STAR_FEED' FROM dual
  UNION ALL SELECT 'IMDS:TBDEIFI7','IMDS','TBDEIFI7','TBDEIFI7','Trial Balance','STAR',
    'DELIVERY_FOLDER','Folder spells it TBDEIFI7; the workbook says TBMEIFI7' FROM dual
  UNION ALL SELECT 'IMDS:TBMEIFI7','IMDS','TBMEIFI7','TBMEIFI7','Trial Balance','STAR',
    'DELIVERY_FOLDER','Workbook spells it TBMEIFI7; the folder says TBDEIFI7' FROM dual
  UNION ALL SELECT 'IMDS:SMDDIFI1','IMDS','SMDDIFI1','SMDDIFI1','SMF Data','STAR',
    'DELIVERY_FOLDER',NULL FROM dual
  UNION ALL SELECT 'IMDS:ODDDIFI1','IMDS','ODDDIFI1','ODDDIFI1','Open Dividends','STAR',
    'DELIVERY_FOLDER',NULL FROM dual
  UNION ALL SELECT 'IMDS:ORDDIFI1','IMDS','ORDDIFI1','ORDDIFI1','Open Interest','STAR',
    'DELIVERY_FOLDER',NULL FROM dual
  UNION ALL SELECT 'IMDS:PEDDIFI1','IMDS','PEDDIFI1','PEDDIFI1','Portfolio Valuation','STAR',
    'DELIVERY_FOLDER',NULL FROM dual
  UNION ALL SELECT 'IMDS:ACDDIFI1','IMDS','ACDDIFI1','ACDDIFI1','Account File','STAR',
    'DELIVERY_FOLDER',NULL FROM dual
  UNION ALL SELECT 'IMDS:CGDEIFI1','IMDS','CGDEIFI1','CGDEIFI1','Currency Gain Loss','STAR',
    'DELIVERY_FOLDER',NULL FROM dual
  UNION ALL SELECT 'IMDS:RGDEIFI1','IMDS','RGDEIFI1','RGDEIFI1',
    'Realized Gain Loss — sales transactions','STAR','DELIVERY_FOLDER',NULL FROM dual
) s ON (t.alias_id = s.alias_id)
WHEN MATCHED THEN UPDATE SET
  t.business_name = s.n, t.feed_code = s.c, t.source_system = s.s,
  t.source = s.src, t.notes = s.nt, t.updated_at = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT
  (alias_id, data_source, feed_key, feed_code, business_name, source_system,
   source, notes)
  VALUES (s.alias_id, s.ds, s.k, s.c, s.n, s.s, s.src, s.nt);

COMMIT;

DECLARE
  PROCEDURE idx(p_sql VARCHAR2) IS
    e_dup EXCEPTION; PRAGMA EXCEPTION_INIT(e_dup, -955);
  BEGIN EXECUTE IMMEDIATE p_sql;
  EXCEPTION WHEN e_dup THEN NULL; END;
BEGIN
  idx('CREATE INDEX ix_feed_alias_key ON feed_alias (data_source, feed_key)');
END;
/

-- Which feeds in the loaded data still have no business name?
--
--   SELECT f.src_file, f.src_file_key, f.source_system
--   FROM   legacy_source_file f
--   LEFT   JOIN feed_alias a
--          ON a.data_source = f.data_source AND a.feed_key = f.src_file_key
--   WHERE  f.data_source = 'IMDS' AND a.alias_id IS NULL
--   ORDER  BY 1;
--
-- And the reverse — names seeded for a feed that never arrived:
--
--   SELECT a.feed_code, a.business_name, a.notes
--   FROM   feed_alias a
--   LEFT   JOIN legacy_source_file f
--          ON f.data_source = a.data_source AND f.src_file_key = a.feed_key
--   WHERE  a.data_source = 'IMDS' AND f.src_file IS NULL;
