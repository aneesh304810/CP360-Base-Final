-- id: active_ind_consistency
-- ACTIVE_IND against the real current-row rule, END_DATE IS NULL.
SELECT SUM(CASE WHEN end_date IS NULL AND NVL(TO_CHAR(active_ind), 'x') NOT IN ('1', 'Y') THEN 1 ELSE 0 END) AS open_not_flagged,
       SUM(CASE WHEN end_date IS NOT NULL AND TO_CHAR(active_ind) IN ('1', 'Y') THEN 1 ELSE 0 END) AS closed_but_flagged,
       COUNT(*) AS total_rows
FROM   {schema}.{tbl}
