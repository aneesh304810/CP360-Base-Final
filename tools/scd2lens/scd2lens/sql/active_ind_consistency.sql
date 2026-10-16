-- id: active_ind_consistency
-- The current-row flag against the real current-row rule, {vt} IS NULL.
SELECT SUM(CASE WHEN {vt} IS NULL AND NVL(TO_CHAR({flag}), 'x') NOT IN ('1', 'Y') THEN 1 ELSE 0 END) AS open_not_flagged,
       SUM(CASE WHEN {vt} IS NOT NULL AND TO_CHAR({flag}) IN ('1', 'Y') THEN 1 ELSE 0 END) AS closed_but_flagged,
       COUNT(*) AS total_rows
FROM   {schema}.{tbl}
