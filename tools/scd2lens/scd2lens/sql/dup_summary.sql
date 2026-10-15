-- id: dup_summary
WITH base AS ({base})
SELECT COUNT(*) AS total_rows, SUM(is_dup) AS dup_rows,
       ROUND(100 * SUM(is_dup) / NULLIF(COUNT(*), 0), 2) AS dup_pct,
       COUNT(DISTINCT CASE WHEN is_dup = 1 THEN {nk_concat} END) AS dup_keys
FROM   base
