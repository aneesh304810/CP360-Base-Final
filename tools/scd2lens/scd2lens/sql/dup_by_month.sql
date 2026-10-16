-- id: dup_by_month
WITH base AS ({base})
SELECT TO_CHAR({vf}, 'YYYY-MM') AS month, COUNT(*) AS versions, SUM(is_dup) AS dup_rows
FROM   base
GROUP  BY TO_CHAR({vf}, 'YYYY-MM')
ORDER  BY 1
