-- =====================================================================
-- sql/76_advantage_ud_profile.sql
-- The AddVantage UD registry: what the profiler learned about every key
-- in DIM_ACCOUNT_UD.USER_DEFINED_ATTRIBUTE_CLOB, plus the decisions the
-- rules made about it. Five tables, one grain each.
--
--   cp_advantage_ud_registry   one row per attribute (UD_1, UD_23_2): key
--                              structure, presence, lengths, dominant type
--                              and its variance, and the classification
--                              (value class, domain, Silver entity) with
--                              the SOURCE that decided it.
--   cp_advantage_ud_parent     one row per multipart parent: observed
--                              sequences, gaps, children per record, role.
--   cp_advantage_ud_schema     one row per distinct key set seen in the
--                              extract, with its family.
--   cp_advantage_ud_family     one row per family: the parents a row
--                              carries, which is what a reader recognises.
--   cp_advantage_ud_conflict   one row per code with several descriptions,
--                              classified (a billing line is not a conflict).
--   cp_advantage_ud_run        the run summary metrics, as integers.
--
-- STRUCTURE, COUNTS AND METADATA ONLY. The profiler's sample_values column
-- is never loaded: it can hold a household name or an account number. The
-- UI draws the SHAPE of a value from the registry instead.
--
-- Guarded, idempotent. Requires sql/75 for the code dictionary it joins.
-- =====================================================================
SET DEFINE OFF;

DECLARE
  PROCEDURE ddl(p VARCHAR2) IS
  BEGIN EXECUTE IMMEDIATE p;
  EXCEPTION WHEN OTHERS THEN IF SQLCODE NOT IN (-955, -1430, -1442) THEN RAISE; END IF; END;
BEGIN
  ddl('CREATE TABLE cp_advantage_ud_registry (
        attribute_name        VARCHAR2(60)  NOT NULL,
        attribute_number      NUMBER,
        parent_attribute      VARCHAR2(60),
        sequence_number       NUMBER,
        key_structure         VARCHAR2(20),            -- SINGLE | MULTIPART | NON_STANDARD
        is_ud_attribute       CHAR(1) DEFAULT ''Y'',
        occurrence_count      NUMBER,
        record_presence_pct   NUMBER(9,4),
        distinct_value_count  NUMBER,
        null_or_blank_count   NUMBER,
        min_value_length      NUMBER,
        max_value_length      NUMBER,
        avg_value_length      NUMBER(12,3),
        dominant_type         VARCHAR2(40),            -- as profiled
        dominant_type_pct     NUMBER(9,4),
        type_variance_ind     CHAR(1),
        type_distribution     VARCHAR2(2000),          -- JSON {type: count}
        leading_zero_count    NUMBER,
        date_masks            VARCHAR2(200),
        variance_class        VARCHAR2(60),            -- from type_variance.csv
        value_class           VARCHAR2(40),            -- decided: after identifier reclassification
        type_reclassified     CHAR(1) DEFAULT ''N'',
        domain                VARCHAR2(40),
        silver_entity         VARCHAR2(60),
        class_source          VARCHAR2(20),            -- DICTIONARY | SAMPLES | RULE | INFERRED
        gold_candidate        CHAR(1) DEFAULT ''N'',
        is_free_text          CHAR(1) DEFAULT ''N'',
        updated_at            TIMESTAMP DEFAULT SYSTIMESTAMP,
        CONSTRAINT pk_cp_addv_ud_reg PRIMARY KEY (attribute_name))');
  ddl('CREATE INDEX ix_cp_addv_ud_reg_parent ON cp_advantage_ud_registry (parent_attribute)');
  ddl('CREATE INDEX ix_cp_addv_ud_reg_domain ON cp_advantage_ud_registry (domain)');

  ddl('CREATE TABLE cp_advantage_ud_parent (
        parent_attribute      VARCHAR2(60) NOT NULL,
        record_count          NUMBER,
        observed_sequences    VARCHAR2(1000),
        missing_sequences     VARCHAR2(1000),
        min_children          NUMBER,
        max_children          NUMBER,
        avg_children          NUMBER(12,3),
        structure_role        VARCHAR2(40),            -- HOUSEHOLD | BILLING_INSTRUCTION | AUTHORITY | TEXT_BLOCK
        line_names            VARCHAR2(400),           -- what the sequences mean, when known
        updated_at            TIMESTAMP DEFAULT SYSTIMESTAMP,
        CONSTRAINT pk_cp_addv_ud_parent PRIMARY KEY (parent_attribute))');

  ddl('CREATE TABLE cp_advantage_ud_family (
        family_id             VARCHAR2(20) NOT NULL,
        family_label          VARCHAR2(400),
        parents_present       VARCHAR2(1000),
        parent_count          NUMBER,
        record_count          NUMBER,
        variant_count         NUMBER,
        min_attribute_count   NUMBER,
        max_attribute_count   NUMBER,
        updated_at            TIMESTAMP DEFAULT SYSTIMESTAMP,
        CONSTRAINT pk_cp_addv_ud_family PRIMARY KEY (family_id))');

  ddl('CREATE TABLE cp_advantage_ud_schema (
        schema_signature      VARCHAR2(16) NOT NULL,
        attribute_count       NUMBER,
        attribute_list        CLOB,
        record_count          NUMBER,
        typed_variant_count   NUMBER,
        record_pct            NUMBER(9,4),
        family_id             VARCHAR2(20),
        updated_at            TIMESTAMP DEFAULT SYSTIMESTAMP,
        CONSTRAINT pk_cp_addv_ud_schema PRIMARY KEY (schema_signature))');
  ddl('CREATE INDEX ix_cp_addv_ud_schema_fam ON cp_advantage_ud_schema (family_id)');

  ddl('CREATE TABLE cp_advantage_ud_conflict (
        conflict_key          VARCHAR2(200) NOT NULL,  -- attribute:code
        attribute_name        VARCHAR2(60),
        code_value            VARCHAR2(50),
        description_count     NUMBER,
        descriptions          VARCHAR2(2000),
        conflict_class        VARCHAR2(40),            -- PARAMETERIZED_VALUE | FORMATTING_VARIATION | FREE_TEXT_FALSE_POSITIVE | TRUE_CONFLICT
        updated_at            TIMESTAMP DEFAULT SYSTIMESTAMP,
        CONSTRAINT pk_cp_addv_ud_conflict PRIMARY KEY (conflict_key))');

  ddl('CREATE TABLE cp_advantage_ud_run (
        metric                VARCHAR2(60) NOT NULL,
        value_num             NUMBER,
        updated_at            TIMESTAMP DEFAULT SYSTIMESTAMP,
        CONSTRAINT pk_cp_addv_ud_run PRIMARY KEY (metric))');
END;
/
