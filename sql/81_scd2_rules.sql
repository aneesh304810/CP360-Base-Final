-- ============================================================================
-- 81_scd2_rules.sql
-- SCD2 rule cards for ODI 360: what the ODI repository says each warehouse
-- dimension's load does, checked against the warehouse. Written by
-- `python -m ingestion.run scd2` (ingestion/scd2_conn.py), which runs the
-- column scan and scd2lens and lands the cards here. Read by routers_scd2.
--
-- GRAIN
--   scd2_card           one row per table: pattern, keys, counts, quality
--   scd2_rule           one row per rule per table, with confidence + evidence
--   scd2_mapping        PBDW column -> Data 360 attribute
--   scd2_open_question  the truncated tasks to re-export
--   scd2_dup_month      versions opened and duplicates per month (profiled runs)
--   scd2_column_role    the column scan's verdict and role columns
--
-- Every child row carries RAN_AT; the API reads children at the card's
-- RAN_AT only, so a rerun with fewer rules leaves no stale row showing.
-- Column names, rule text, counts and dates only: no warehouse key value.
--
-- Idempotent: an existing table is left alone (ORA-955).
-- ============================================================================

DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE scd2_card (
      table_name                VARCHAR2(128) NOT NULL,
      pattern                   VARCHAR2(40),
      scan_verdict              VARCHAR2(40),
      writers                   VARCHAR2(2000),
      surrogate_key             VARCHAR2(128),
      natural_key               VARCHAR2(400),
      version_key               VARCHAR2(400),
      partition_col             VARCHAR2(128),
      partition_values          VARCHAR2(2000),
      row_count                 NUMBER,
      dup_rows                  NUMBER,
      dup_pct                   NUMBER(7,2),
      dup_keys                  NUMBER,
      gaps                      NUMBER,
      overlaps                  NUMBER,
      multiple_open             NUMBER,
      none_open                 NUMBER,
      active_open_not_flagged   NUMBER,
      active_closed_but_flagged NUMBER,
      freshness_alert           VARCHAR2(400),
      volume_alerts             VARCHAR2(2000),
      rule_count                NUMBER,
      proven_count              NUMBER,
      inferred_count            NUMBER,
      unknown_count             NUMBER,
      open_count                NUMBER,
      notes                     VARCHAR2(4000),
      ran_at                    TIMESTAMP,
      CONSTRAINT pk_scd2_card PRIMARY KEY (table_name)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/

DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE scd2_rule (
      table_name  VARCHAR2(128) NOT NULL,
      rule_id     VARCHAR2(10)  NOT NULL,
      rule_text   VARCHAR2(4000),
      confidence  VARCHAR2(20),
      evidence    VARCHAR2(4000),
      ran_at      TIMESTAMP,
      CONSTRAINT pk_scd2_rule PRIMARY KEY (table_name, rule_id)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/

DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE scd2_mapping (
      table_name    VARCHAR2(128) NOT NULL,
      pbdw_column   VARCHAR2(128) NOT NULL,
      data360_attr  VARCHAR2(200),
      ran_at        TIMESTAMP,
      CONSTRAINT pk_scd2_mapping PRIMARY KEY (table_name, pbdw_column)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/

DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE scd2_open_question (
      table_name  VARCHAR2(128) NOT NULL,
      seq         NUMBER        NOT NULL,
      question    VARCHAR2(2000),
      ran_at      TIMESTAMP,
      CONSTRAINT pk_scd2_open_question PRIMARY KEY (table_name, seq)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/

DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE scd2_dup_month (
      table_name  VARCHAR2(128) NOT NULL,
      month       VARCHAR2(7)   NOT NULL,
      versions    NUMBER,
      dup_rows    NUMBER,
      ran_at      TIMESTAMP,
      CONSTRAINT pk_scd2_dup_month PRIMARY KEY (table_name, month)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/

DECLARE e_exists EXCEPTION; PRAGMA EXCEPTION_INIT(e_exists, -955);
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE scd2_column_role (
      table_name     VARCHAR2(128) NOT NULL,
      verdict        VARCHAR2(40),
      confidence     VARCHAR2(20),
      surrogate_key  VARCHAR2(128),
      valid_from     VARCHAR2(128),
      valid_to       VARCHAR2(128),
      current_flag   VARCHAR2(128),
      version        VARCHAR2(128),
      row_hash       VARCHAR2(128),
      business_date  VARCHAR2(128),
      audit          VARCHAR2(128),
      to_convention  VARCHAR2(200),
      missing_roles  VARCHAR2(400),
      maps_to        VARCHAR2(2000),
      notes          VARCHAR2(2000),
      ran_at         TIMESTAMP,
      CONSTRAINT pk_scd2_column_role PRIMARY KEY (table_name)
    )';
EXCEPTION WHEN e_exists THEN NULL; END;
/
