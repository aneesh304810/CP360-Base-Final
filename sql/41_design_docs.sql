-- ============================================================
-- 41 · Design document store — the same designs-md/*.md content,
-- ingested for governance/search. UI reads the compiled module;
-- these tables make the docs queryable and auditable. Re-runnable.
-- ============================================================
BEGIN EXECUTE IMMEDIATE '
CREATE TABLE design_docs (
  doc_id    VARCHAR2(60) PRIMARY KEY,
  title     VARCHAR2(200) NOT NULL,
  doc_level VARCHAR2(10),
  icon      VARCHAR2(10),
  color     VARCHAR2(10),
  doc_order NUMBER(4),
  sub_title VARCHAR2(400),
  match_rx  VARCHAR2(400),
  zone_dflt VARCHAR2(40),
  is_default CHAR(1) DEFAULT 'N',
  src_file  VARCHAR2(200),
  load_ts   TIMESTAMP DEFAULT SYSTIMESTAMP
)'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE '
CREATE TABLE design_doc_sections (
  doc_id     VARCHAR2(60) NOT NULL,
  section_no NUMBER(4) NOT NULL,
  heading    VARCHAR2(400),
  body_md    CLOB,
  PRIMARY KEY (doc_id, section_no)
)'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
/
COMMIT;
