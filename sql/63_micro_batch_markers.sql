-- 63_micro_batch_markers.sql ---------------------------------------------
-- The Micro_Batch_Markers sheet of the Event 360 workbook.
--
-- Markers are NOT catalog events and the sheet says so in its own column:
-- "Catalog event = No". They carry ids 1000 and 1001, well clear of the
-- catalog's 1..105, and they are published on every subscribed domain topic
-- rather than on one. Putting them in META_EVENT_DEFINITION would add two
-- rows to a table whose count is gated at 105 and would make every
-- "how many events are there" answer wrong by two.
--
-- ONE TABLE, TWO KINDS, BECAUSE THE SHEET HAS TWO. Rows 2-3 are markers
-- with a numeric id. Rows 4-5 have the literal word "Rule" in the id
-- column and state a consumption rule about the markers -- zero-event
-- topic boundary, cross-topic integrity. A parser that reads the id as a
-- number produces two junk rows with a null key. ENTRY_KIND keeps both,
-- using the sheet's own word.
--
-- Additive. Nothing existing reads it; nothing existing breaks without it.

DECLARE
  e_exists EXCEPTION;
  PRAGMA EXCEPTION_INIT(e_exists, -955);
  PROCEDURE ddl(s VARCHAR2) IS
  BEGIN EXECUTE IMMEDIATE s;
  EXCEPTION WHEN e_exists THEN NULL;
  END;
BEGIN
  ddl('CREATE TABLE ref_micro_batch_marker (
        entry_key       VARCHAR2(80)  NOT NULL,   -- ''1000'' or ''RULE:1''
        entry_kind      VARCHAR2(10)  NOT NULL,   -- MARKER | RULE
        marker_id       NUMBER,                   -- null on a RULE row
        marker_name     VARCHAR2(200),
        published_where VARCHAR2(400),
        catalog_event   CHAR(1) DEFAULT ''N'',    -- the sheet says No for all
        payload_fields  VARCHAR2(600),
        purpose         VARCHAR2(2000),
        source_row      NUMBER,
        updated_at      TIMESTAMP DEFAULT SYSTIMESTAMP,
        CONSTRAINT pk_ref_micro_batch_marker PRIMARY KEY (entry_key),
        CONSTRAINT ck_ref_mbm_kind CHECK (entry_kind IN (''MARKER'',''RULE'')))');

  ddl('CREATE INDEX ix_ref_mbm_kind ON ref_micro_batch_marker (entry_kind)');
END;
/
