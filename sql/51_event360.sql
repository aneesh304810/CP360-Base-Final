-- ============================================================================
-- 51_event360.sql — Event 360: the SEI event contract, as tables.
--
-- Source: the event specification workbook (8 sheets, 105 events, 575 fields).
-- Sheet 8 (Extraction_Status) is deliberately not loaded.
--
-- THE ONE THING TO READ BEFORE CHANGING ANYTHING HERE
--
-- META_EVENT_FIELD.DATA_TYPE, LENGTH_PRECISION and NULLABLE are VARCHAR2 and
-- they hold the literal string 'NOT_SPECIFIED' for almost every row. That is
-- not laziness in the loader and not a gap to be filled in later: the
-- specification NEVER STATES payload field data types, lengths or nullability.
-- 'NOT_SPECIFIED' is the fact.
--
-- Typing these columns as NUMBER/VARCHAR2(n) with real lengths, or letting a
-- modeller "tidy" them into inferred types, converts an honest absence into a
-- confident fiction that downstream consumers will build against. It is the
-- single biggest schema risk in this ingestion. If SEI later publishes types,
-- they arrive as a new column beside these, not by overwriting them.
--
-- The same holds for verbatim text. Several event names and object names in
-- the source carry typos — IDENTTIFIERS, insterest, Acount_ISA_Detail,
-- INSTRUMENT_GLOBA. They are loaded exactly as written, because a "typo" in a
-- contract may be the real object name and correcting it silently would break
-- the join it is meant to support.
--
-- Idempotent: every statement tolerates re-running.
-- ============================================================================

-- ---------------------------------------------------------------- REF ------

DECLARE e EXCEPTION; PRAGMA EXCEPTION_INIT(e, -955);
BEGIN EXECUTE IMMEDIATE '
  CREATE TABLE ref_event_type (
    event_type      VARCHAR2(10)  NOT NULL,
    description     VARCHAR2(2000),
    event_count     NUMBER(5),
    updated_at      TIMESTAMP DEFAULT SYSTIMESTAMP,
    CONSTRAINT pk_ref_event_type PRIMARY KEY (event_type))';
EXCEPTION WHEN e THEN NULL; END;
/

DECLARE e EXCEPTION; PRAGMA EXCEPTION_INIT(e, -955);
BEGIN EXECUTE IMMEDIATE '
  CREATE TABLE ref_event_domain (
    domain          VARCHAR2(20)  NOT NULL,
    coverage        VARCHAR2(2000),
    event_count     NUMBER(5),
    updated_at      TIMESTAMP DEFAULT SYSTIMESTAMP,
    CONSTRAINT pk_ref_event_domain PRIMARY KEY (domain))';
EXCEPTION WHEN e THEN NULL; END;
/

-- The envelope contract. META_EVENT_FIELD instantiates these per event, so a
-- payload field name that is not in here is a load error, not a new field.
DECLARE e EXCEPTION; PRAGMA EXCEPTION_INIT(e, -955);
BEGIN EXECUTE IMMEDIATE '
  CREATE TABLE ref_envelope_field (
    field           VARCHAR2(60)  NOT NULL,
    description     VARCHAR2(2000),
    data_type       VARCHAR2(30),      -- ''Numeric'' for eventId, else NOT_SPECIFIED
    length_precision VARCHAR2(30),
    mandatory       VARCHAR2(30),
    updated_at      TIMESTAMP DEFAULT SYSTIMESTAMP,
    CONSTRAINT pk_ref_envelope_field PRIMARY KEY (field))';
EXCEPTION WHEN e THEN NULL; END;
/

-- The six consumer rules. They are reference rows AND assertions the loader
-- enforces; see event360_conn.CONSUMPTION_RULES.
DECLARE e EXCEPTION; PRAGMA EXCEPTION_INIT(e, -955);
BEGIN EXECUTE IMMEDIATE '
  CREATE TABLE ref_consumption_rule (
    rule_no         NUMBER(3)     NOT NULL,
    rule_text       CLOB,
    updated_at      TIMESTAMP DEFAULT SYSTIMESTAMP,
    CONSTRAINT pk_ref_consumption_rule PRIMARY KEY (rule_no))';
EXCEPTION WHEN e THEN NULL; END;
/

-- --------------------------------------------------------------- EVENTS ----

DECLARE e EXCEPTION; PRAGMA EXCEPTION_INIT(e, -955);
BEGIN EXECUTE IMMEDIATE '
  CREATE TABLE meta_event_definition (
    event_id                NUMBER(5)     NOT NULL,   -- 1..98, 102..108
    event_name              VARCHAR2(200) NOT NULL,   -- verbatim, typos kept
    event_type              VARCHAR2(10)  NOT NULL,
    domain                  VARCHAR2(20)  NOT NULL,
    section                 VARCHAR2(10)  NOT NULL,   -- alternate key, 4.1..4.105
    page                    NUMBER(5),
    sdc_view                VARCHAR2(80),             -- NULL for markers
    payload_key             VARCHAR2(200),            -- NULL for markers
    operation_codes         VARCHAR2(60),             -- NULL for markers
    description             CLOB,
    sample_payload          CLOB,                     -- JSON as text
    trigger_tables_columns  CLOB,                     -- newline-delimited
    trigger_condition       CLOB,
    consumer_guidance       CLOB,
    detail_extraction_status VARCHAR2(30),
    payload_field_list      VARCHAR2(100),            -- comma-delimited
    composite_key_parts     VARCHAR2(200),            -- newline-delimited
    trigger_column_count    NUMBER(3),                -- RECOMPUTED on load
    source_page_reference   VARCHAR2(60),
    field_extraction_status VARCHAR2(40),
    -- set by the loader, not the sheet: a row the contract contradicts itself
    -- about. Event 92 is the known case (SDC view ''Not applicable'' but the
    -- sample payload carries "view": "NULL").
    load_flag               VARCHAR2(30),
    load_flag_note          VARCHAR2(400),
    updated_at              TIMESTAMP DEFAULT SYSTIMESTAMP,
    CONSTRAINT pk_meta_event_definition PRIMARY KEY (event_id),
    CONSTRAINT uq_meta_event_section    UNIQUE (section))';
EXCEPTION WHEN e THEN NULL; END;
/

-- Grain: one row per field per event. Field ordinal is continuous across BOTH
-- categories, so (section, field_ordinal) is unique but (section, field_name)
-- is not guaranteed to be.
DECLARE e EXCEPTION; PRAGMA EXCEPTION_INIT(e, -955);
BEGIN EXECUTE IMMEDIATE '
  CREATE TABLE meta_event_field (
    section          VARCHAR2(10)  NOT NULL,
    field_ordinal    NUMBER(3)     NOT NULL,
    source_page      NUMBER(5),
    event_id         NUMBER(5)     NOT NULL,
    event_name       VARCHAR2(200),            -- denormalised for readability
    field_category   VARCHAR2(20)  NOT NULL,   -- PAYLOAD | TRIGGER_DRIVING
    field_name       VARCHAR2(60)  NOT NULL,
    description      VARCHAR2(400),
    data_type        VARCHAR2(30),   -- NOT_SPECIFIED by design; see header
    length_precision VARCHAR2(30),   -- NOT_SPECIFIED by design; see header
    nullable         VARCHAR2(20),   -- NOT_SPECIFIED by design; see header
    is_key           VARCHAR2(5),
    source_table     VARCHAR2(60),   -- TRIGGER_DRIVING rows only
    source_column    VARCHAR2(60),   -- TRIGGER_DRIVING rows only
    sample_value     VARCHAR2(200),
    extraction_status VARCHAR2(20),
    updated_at       TIMESTAMP DEFAULT SYSTIMESTAMP,
    CONSTRAINT pk_meta_event_field PRIMARY KEY (section, field_ordinal))';
EXCEPTION WHEN e THEN NULL; END;
/

DECLARE e EXCEPTION; PRAGMA EXCEPTION_INIT(e, -955);
BEGIN EXECUTE IMMEDIATE
  'CREATE INDEX ix_meta_event_field_event ON meta_event_field (event_id)';
EXCEPTION WHEN e THEN NULL; END;
/
DECLARE e EXCEPTION; PRAGMA EXCEPTION_INIT(e, -955);
BEGIN EXECUTE IMMEDIATE
  'CREATE INDEX ix_meta_event_field_cat ON meta_event_field (field_category, field_name)';
EXCEPTION WHEN e THEN NULL; END;
/
DECLARE e EXCEPTION; PRAGMA EXCEPTION_INIT(e, -955);
BEGIN EXECUTE IMMEDIATE
  'CREATE INDEX ix_meta_event_field_src ON meta_event_field (source_table, source_column)';
EXCEPTION WHEN e THEN NULL; END;
/
DECLARE e EXCEPTION; PRAGMA EXCEPTION_INIT(e, -955);
BEGIN EXECUTE IMMEDIATE
  'CREATE INDEX ix_meta_event_def_type ON meta_event_definition (event_type, domain)';
EXCEPTION WHEN e THEN NULL; END;
/

-- ------------------------------------------------------- post-load checks --
-- Run after `python -m ingestion.run event360`. The loader asserts all of
-- these itself and refuses to commit a bad load, so a row here should never
-- come back non-empty; it is the independent second opinion.
--
-- SELECT 'event count <> 105' AS gate, COUNT(*) AS actual
--   FROM meta_event_definition HAVING COUNT(*) <> 105
-- UNION ALL
-- SELECT 'field count <> 575', COUNT(*) FROM meta_event_field HAVING COUNT(*) <> 575
-- UNION ALL
-- SELECT 'event id in 99..101', COUNT(*) FROM meta_event_definition
--   WHERE event_id BETWEEN 99 AND 101 HAVING COUNT(*) > 0
-- UNION ALL
-- SELECT 'type not in ref', COUNT(*) FROM meta_event_definition d
--   WHERE NOT EXISTS (SELECT 1 FROM ref_event_type r WHERE r.event_type = d.event_type)
--   HAVING COUNT(*) > 0
-- UNION ALL
-- SELECT 'domain not in ref', COUNT(*) FROM meta_event_definition d
--   WHERE NOT EXISTS (SELECT 1 FROM ref_event_domain r WHERE r.domain = d.domain)
--   HAVING COUNT(*) > 0
-- UNION ALL
-- SELECT 'field has no parent event', COUNT(*) FROM meta_event_field f
--   WHERE NOT EXISTS (SELECT 1 FROM meta_event_definition d WHERE d.event_id = f.event_id)
--   HAVING COUNT(*) > 0
-- UNION ALL
-- SELECT 'payload field count wrong for type', COUNT(*) FROM (
--   SELECT d.event_id, d.event_type, COUNT(*) AS n
--   FROM meta_event_definition d
--   JOIN meta_event_field f ON f.event_id = d.event_id
--   WHERE f.field_category = 'PAYLOAD'
--   GROUP BY d.event_id, d.event_type)
--   WHERE (event_type = 'Marker' AND n <> 3) OR (event_type <> 'Marker' AND n <> 4)
--   HAVING COUNT(*) > 0;
