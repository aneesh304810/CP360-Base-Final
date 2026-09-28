-- validate-crosswalk.sql ------------------------------------------------
--
-- READ ONLY. Every statement is a SELECT. Nothing here writes, alters or
-- deletes, so it is safe to run against the loaded schema at any time.
--
-- WHAT IT IS FOR. The workbook's own self-checks say whether the workbook is
-- internally consistent. This says whether the LOADED data is consistent —
-- a different question, because ingestion normalises names, canonicalises
-- field codes and resolves joins, and each of those can silently drop rows.
-- A join that matches nothing returns an empty screen, not an error.
--
-- HOW TO RUN
--   sqlplus user/pass@dsn @docs/sei-crosswalk/validate-crosswalk.sql > validate.txt
-- then paste validate.txt into the validation prompt.
--
-- Change DS below if the warehouse is not IMDS.
--
-- EVERY STATEMENT STANDS ALONE, deliberately. A single UNION ALL would be
-- tidier and would die entirely on the first missing table — and a checkout
-- that has not run sql/53 or sql/55 is exactly the case this has to survive.
-- An ORA-00942 here means "that table is absent", which is itself a finding.

DEFINE DS = 'IMDS'

SET PAGESIZE 200
SET LINESIZE 300
SET FEEDBACK OFF
SET TRIMSPOOL ON
SET NULL (null)
COLUMN item   FORMAT A46
COLUMN val    FORMAT A40
COLUMN v      FORMAT A34
COLUMN n      FORMAT 999999
COLUMN pct    FORMAT 999.9

PROMPT
PROMPT ============================================================
PROMPT == 1. ROW COUNTS — is anything empty that should not be?
PROMPT ============================================================
SELECT 'legacy_lineage'       item, COUNT(*) n FROM legacy_lineage      WHERE data_source = &DS
UNION ALL SELECT 'legacy_source_file',  COUNT(*) FROM legacy_source_file  WHERE data_source = &DS
UNION ALL SELECT 'legacy_src_column',   COUNT(*) FROM legacy_src_column   WHERE data_source = &DS
UNION ALL SELECT 'sei_verify',          COUNT(*) FROM sei_verify          WHERE data_source = &DS
UNION ALL SELECT 'sei_source_map',      COUNT(*) FROM sei_source_map      WHERE data_source = &DS
UNION ALL SELECT 'sei_dual_source',     COUNT(*) FROM sei_dual_source     WHERE data_source = &DS
UNION ALL SELECT 'sei_exception',       COUNT(*) FROM sei_exception       WHERE data_source = &DS
UNION ALL SELECT 'legacy_lane (all ds)',COUNT(*) FROM legacy_lane
UNION ALL SELECT 'sei_code_set (global)',       COUNT(*) FROM sei_code_set
UNION ALL SELECT 'sei_identifier_xwalk (global)',COUNT(*) FROM sei_identifier_xwalk
ORDER BY 1;

PROMPT -- these four need sql/53; ORA-00942 here means sql/53 was not run
SELECT 'sei_feed' item, COUNT(*) n FROM sei_feed WHERE data_source = &DS;
SELECT 'sei_input_lineage' item, COUNT(*) n FROM sei_input_lineage WHERE data_source = &DS;
SELECT 'sei_catalog_verify' item, COUNT(*) n FROM sei_catalog_verify WHERE data_source = &DS;
SELECT 'uaf_field_schema' item, COUNT(*) n FROM uaf_field_schema WHERE data_source = &DS;

PROMPT -- this one needs sql/55; ORA-00942 means the STAR/UAF filter has no data
SELECT 'legacy_lineage_lane' item, COUNT(*) n FROM legacy_lineage_lane WHERE data_source = &DS;

PROMPT
PROMPT ============================================================
PROMPT == 2. VOCABULARIES — every distinct value, so unknown ones surface
PROMPT ============================================================
PROMPT -- MATCH_VERDICT: expect only the 9. Anything else the UI renders grey.
SELECT NVL(match_verdict,'(null)') v, COUNT(*) n FROM sei_verify
 WHERE data_source = &DS GROUP BY match_verdict ORDER BY 2 DESC;

PROMPT -- MAP_KIND on VERIFY
SELECT NVL(map_kind,'(null)') v, COUNT(*) n FROM sei_verify
 WHERE data_source = &DS GROUP BY map_kind ORDER BY 2 DESC;

PROMPT -- MAP_KIND on SOURCE_MAP
SELECT NVL(map_kind,'(null)') v, COUNT(*) n FROM sei_source_map
 WHERE data_source = &DS GROUP BY map_kind ORDER BY 2 DESC;

PROMPT -- EVIDENCE, all four places it is recorded
SELECT 'verify.left'  v, NVL(evidence_left,'(null)') val, COUNT(*) n FROM sei_verify
 WHERE data_source = &DS GROUP BY evidence_left
UNION ALL
SELECT 'verify.right', NVL(evidence_right,'(null)'), COUNT(*) FROM sei_verify
 WHERE data_source = &DS GROUP BY evidence_right
UNION ALL
SELECT 'src_column',   NVL(evidence,'(null)'), COUNT(*) FROM legacy_src_column
 WHERE data_source = &DS GROUP BY evidence
UNION ALL
SELECT 'source_map',   NVL(evidence,'(null)'), COUNT(*) FROM sei_source_map
 WHERE data_source = &DS GROUP BY evidence
ORDER BY 1, 3 DESC;

PROMPT -- FAILED_CHECKS, split on the pipe. Unknown tokens render as raw text.
SELECT token v, COUNT(*) n FROM (
  SELECT TRIM(REGEXP_SUBSTR(failed_checks, '[^|]+', 1, LEVEL)) token
  FROM   sei_verify
  WHERE  data_source = &DS AND failed_checks IS NOT NULL
  CONNECT BY LEVEL <= REGEXP_COUNT(failed_checks, '\|') + 1
    AND PRIOR verify_id = verify_id AND PRIOR SYS_GUID() IS NOT NULL)
WHERE token IS NOT NULL GROUP BY token ORDER BY 2 DESC;

PROMPT -- DISPOSITION
SELECT NVL(disposition,'(null)') v, COUNT(*) n FROM sei_disposition
 WHERE lane_id IN (SELECT lane_id FROM legacy_lane WHERE data_source = &DS)
 GROUP BY disposition ORDER BY 2 DESC;

PROMPT -- LANE register
SELECT lane_id v, source_system || ' / ' || replacement_state val, 1 n
  FROM legacy_lane WHERE data_source = &DS ORDER BY 1;

PROMPT -- LINEAGE_STATUS
SELECT NVL(lineage_status,'(null)') v, COUNT(*) n FROM legacy_lineage
 WHERE data_source = &DS GROUP BY lineage_status ORDER BY 2 DESC;

PROMPT
PROMPT ============================================================
PROMPT == 3. JOINS — every join the API makes, and how much it loses
PROMPT ============================================================
PROMPT -- J1 sei_verify.lane_id -> legacy_lane. Drives the STAR/UAF badges.
SELECT CASE WHEN n.lane_id IS NULL THEN 'UNRESOLVED lane_id' ELSE 'resolved' END v,
       COUNT(*) n
FROM   sei_verify v LEFT JOIN legacy_lane n ON n.lane_id = v.lane_id
WHERE  v.data_source = &DS GROUP BY CASE WHEN n.lane_id IS NULL THEN 'UNRESOLVED lane_id' ELSE 'resolved' END;

PROMPT -- J2 verify -> lineage on (table, column). Drives the column drill.
SELECT CASE WHEN g.dwh_target_column IS NULL THEN 'verify row with NO lineage row'
            ELSE 'matched' END v, COUNT(*) n
FROM   sei_verify v
LEFT   JOIN (SELECT DISTINCT data_source, dwh_target_table, dwh_target_column
             FROM legacy_lineage) g
       ON g.data_source = v.data_source
      AND g.dwh_target_table = v.dwh_target_table
      AND g.dwh_target_column = v.dwh_target_column
WHERE  v.data_source = &DS
GROUP  BY CASE WHEN g.dwh_target_column IS NULL THEN 'verify row with NO lineage row' ELSE 'matched' END;

PROMPT -- J3 source_map -> verify on the CANONICALISED contract field.
PROMPT --    This is the join /flow and /column depend on. If it loses rows the
PROMPT --    ribbon diagram shows everything as 'no SEI source'.
SELECT CASE WHEN v.verify_id IS NULL THEN 'map row that matches NO verify row'
            ELSE 'matched' END vv, COUNT(*) n
FROM   sei_source_map m
LEFT   JOIN sei_verify v
       ON v.data_source = m.data_source
      AND REGEXP_REPLACE(UPPER(TRIM('_' FROM REGEXP_REPLACE(v.contract_field,'[[:space:]/.-]+','_'))),'_L([0-9]+)','_\1')
        = NVL(m.src_col_norm,
              REGEXP_REPLACE(UPPER(TRIM('_' FROM REGEXP_REPLACE(m.src_source_column,'[[:space:]/.-]+','_'))),'_L([0-9]+)','_\1'))
WHERE  m.data_source = &DS
GROUP  BY CASE WHEN v.verify_id IS NULL THEN 'map row that matches NO verify row' ELSE 'matched' END;

PROMPT -- J4 lineage -> source_file by normalised feed key. The old lane route.
SELECT NVL(f.source_system,'UNRESOLVED') v,
       COUNT(DISTINCT l.dwh_target_table || '.' || l.dwh_target_column) n
FROM   legacy_lineage l
LEFT   JOIN legacy_source_file f
       ON f.data_source = l.data_source
      AND f.src_file_key = REGEXP_REPLACE(UPPER(TRIM('_' FROM
            REGEXP_REPLACE(l.src_source_table,'[[:space:]/.-]+','_'))),'_{2,}','_')
WHERE  l.data_source = &DS GROUP BY NVL(f.source_system,'UNRESOLVED') ORDER BY 2 DESC;

PROMPT -- J5 lineage -> lineage_lane. The new lane route (needs sql/55).
SELECT NVL(l.source_system,'(unattributed)') v, COUNT(*) n
FROM   legacy_lineage g
LEFT   JOIN legacy_lineage_lane l ON l.lineage_id = g.lineage_id
WHERE  g.data_source = &DS GROUP BY NVL(l.source_system,'(unattributed)') ORDER BY 2 DESC;

PROMPT -- J6 code sets referenced vs code sets loaded
SELECT 'referenced by a contract field' v, COUNT(DISTINCT code_set_name) n
FROM   legacy_src_column WHERE data_source = &DS AND code_set_name IS NOT NULL
UNION ALL
SELECT 'loaded with member values', COUNT(DISTINCT code_set_name) FROM sei_code_set
WHERE  code_value IS NOT NULL
UNION ALL
SELECT 'loaded, name only', COUNT(DISTINCT code_set_name) FROM sei_code_set
WHERE  code_value IS NULL;

PROMPT
PROMPT ============================================================
PROMPT == 4. THE WORKBOOK'S OWN RULES, re-checked against loaded data
PROMPT ============================================================
SELECT 'NO_SOURCE rows with no DISPOSITION row' item, COUNT(*) n
FROM   sei_verify v
WHERE  v.data_source = &DS AND v.match_verdict = 'NO_SOURCE'
  AND  NOT EXISTS (SELECT 1 FROM sei_disposition d
                   WHERE d.lane_id = v.lane_id
                     AND d.dwh_target_table = v.dwh_target_table
                     AND d.dwh_target_column = v.dwh_target_column)
UNION ALL
SELECT 'PROVEN_MATCH resting on ASSUMED or NONE evidence', COUNT(*)
FROM   sei_verify WHERE data_source = &DS AND match_verdict = 'PROVEN_MATCH'
  AND (evidence_left IN ('ASSUMED','NONE') OR evidence_right IN ('ASSUMED','NONE')
       OR evidence_left IS NULL OR evidence_right IS NULL)
UNION ALL
SELECT 'PROVEN_MATCH with a non-empty FAILED_CHECKS', COUNT(*)
FROM   sei_verify WHERE data_source = &DS AND match_verdict = 'PROVEN_MATCH'
  AND  failed_checks IS NOT NULL AND TRIM(failed_checks) IS NOT NULL
UNION ALL
SELECT 'rows on a NOT_REPLACED lane NOT marked OUT_OF_SCOPE', COUNT(*)
FROM   sei_verify v JOIN legacy_lane n ON n.lane_id = v.lane_id
WHERE  v.data_source = &DS AND n.replacement_state <> 'REPLACED'
  AND  NVL(v.match_verdict,'x') <> 'OUT_OF_SCOPE'
UNION ALL
SELECT 'OUT_OF_SCOPE rows on a REPLACED lane', COUNT(*)
FROM   sei_verify v JOIN legacy_lane n ON n.lane_id = v.lane_id
WHERE  v.data_source = &DS AND n.replacement_state = 'REPLACED'
  AND  v.match_verdict = 'OUT_OF_SCOPE'
UNION ALL
SELECT 'composite MAP_IDs with no COMPOSITE_GROUP', COUNT(*)
FROM   sei_source_map WHERE data_source = &DS AND map_kind = 'COMPOSITE'
  AND (composite_group IS NULL OR UPPER(composite_group) = 'N/A')
UNION ALL
SELECT 'verify rows carrying no LANE_ID at all', COUNT(*)
FROM   sei_verify WHERE data_source = &DS AND lane_id IS NULL
UNION ALL
SELECT 'DUAL_SOURCE columns with no precedence rule', COUNT(*)
FROM   sei_dual_source WHERE data_source = &DS AND precedence_rule IS NULL
UNION ALL
SELECT 'BYPASSES_CONTRACT rows with no EXCEPTION raised', COUNT(*)
FROM   sei_verify v
WHERE  v.data_source = &DS AND INSTR(NVL(v.failed_checks,' '),'BYPASSES_CONTRACT') > 0
  AND  NOT EXISTS (SELECT 1 FROM sei_exception e WHERE e.data_source = v.data_source)
ORDER BY 1;

PROMPT
PROMPT ============================================================
PROMPT == 5. SHAPE — what the UI has to lay out
PROMPT ============================================================
SELECT 'distinct warehouse tables'  item, TO_CHAR(COUNT(DISTINCT dwh_target_table)) val FROM sei_verify WHERE data_source = &DS
UNION ALL SELECT 'distinct contract feeds', TO_CHAR(COUNT(DISTINCT contract_feed)) FROM sei_verify WHERE data_source = &DS
UNION ALL SELECT 'distinct SEI feeds',      TO_CHAR(COUNT(DISTINCT sei_feed))      FROM sei_source_map WHERE data_source = &DS
UNION ALL SELECT 'distinct functional groups', TO_CHAR(COUNT(DISTINCT functional_group)) FROM sei_verify WHERE data_source = &DS
UNION ALL SELECT 'longest warehouse table name', TO_CHAR(MAX(LENGTH(dwh_target_table))) FROM sei_verify WHERE data_source = &DS
UNION ALL SELECT 'longest contract feed name',   TO_CHAR(MAX(LENGTH(contract_feed)))    FROM sei_verify WHERE data_source = &DS
UNION ALL SELECT 'longest SEI feed name',        TO_CHAR(MAX(LENGTH(sei_feed)))         FROM sei_source_map WHERE data_source = &DS
UNION ALL SELECT 'most columns in one table',    TO_CHAR(MAX(c)) FROM
  (SELECT COUNT(*) c FROM sei_verify WHERE data_source = &DS GROUP BY dwh_target_table)
UNION ALL SELECT 'verify rows with a null functional_group', TO_CHAR(COUNT(*)) FROM sei_verify
  WHERE data_source = &DS AND functional_group IS NULL
UNION ALL SELECT 'verify rows with a null contract_feed', TO_CHAR(COUNT(*)) FROM sei_verify
  WHERE data_source = &DS AND contract_feed IS NULL
UNION ALL SELECT 'verify rows with a null verdict_reason', TO_CHAR(COUNT(*)) FROM sei_verify
  WHERE data_source = &DS AND verdict_reason IS NULL
UNION ALL SELECT 'verify rows with a null what_would_clear_it', TO_CHAR(COUNT(*)) FROM sei_verify
  WHERE data_source = &DS AND what_would_clear_it IS NULL
UNION ALL SELECT 'lineage rows with a null functional_group', TO_CHAR(COUNT(*)) FROM legacy_lineage
  WHERE data_source = &DS AND functional_group IS NULL
ORDER BY 1;

PROMPT -- per lane, the verdict spread. The readiness numbers, by source system.
SELECT NVL(n.source_system,'?') v, NVL(t.match_verdict,'(null)') val, COUNT(*) n
FROM   sei_verify t LEFT JOIN legacy_lane n ON n.lane_id = t.lane_id
WHERE  t.data_source = &DS
GROUP  BY NVL(n.source_system,'?'), t.match_verdict ORDER BY 1, 3 DESC;

PROMPT -- per table, cells and how many have no source. Drives the waffle.
SELECT dwh_target_table v, COUNT(*) n,
       SUM(CASE WHEN match_verdict = 'NO_SOURCE' THEN 1 ELSE 0 END) AS no_src
FROM   sei_verify WHERE data_source = &DS
GROUP  BY dwh_target_table ORDER BY 2 DESC;

PROMPT
PROMPT ============================================================
PROMPT == 6. EMPTINESS — columns the UI reads that are entirely null
PROMPT ============================================================
SELECT 'source_map.sei_type'      item, COUNT(*) n FROM sei_source_map WHERE data_source = &DS AND sei_type IS NOT NULL
UNION ALL SELECT 'source_map.sei_length',   COUNT(*) FROM sei_source_map WHERE data_source = &DS AND sei_length IS NOT NULL
UNION ALL SELECT 'source_map.map_rule',     COUNT(*) FROM sei_source_map WHERE data_source = &DS AND map_rule IS NOT NULL
UNION ALL SELECT 'source_map.open_question',COUNT(*) FROM sei_source_map WHERE data_source = &DS AND open_question IS NOT NULL
UNION ALL SELECT 'source_map.depends_on_feed', COUNT(*) FROM sei_source_map WHERE data_source = &DS AND depends_on_feed IS NOT NULL
UNION ALL SELECT 'src_column.src_type',     COUNT(*) FROM legacy_src_column WHERE data_source = &DS AND src_type IS NOT NULL
UNION ALL SELECT 'src_column.unit_of_measure', COUNT(*) FROM legacy_src_column WHERE data_source = &DS AND unit_of_measure IS NOT NULL
UNION ALL SELECT 'src_column.code_set_name',COUNT(*) FROM legacy_src_column WHERE data_source = &DS AND code_set_name IS NOT NULL
UNION ALL SELECT 'lineage.dwh_type',        COUNT(*) FROM legacy_lineage WHERE data_source = &DS AND dwh_type IS NOT NULL
UNION ALL SELECT 'lineage.src_source_table',COUNT(*) FROM legacy_lineage WHERE data_source = &DS AND src_source_table IS NOT NULL
UNION ALL SELECT 'source_file.source_system',COUNT(*) FROM legacy_source_file WHERE data_source = &DS AND source_system IS NOT NULL
ORDER BY 1;

PROMPT
PROMPT == END. Paste everything above into the validation prompt.
EXIT
