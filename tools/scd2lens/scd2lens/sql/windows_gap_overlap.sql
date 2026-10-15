-- id: windows_gap_overlap
-- Consecutive versions whose end date is not the next start minus the
-- offset the end-date variable applies. Counts only.
SELECT COUNT(*) AS bad_windows,
       SUM(CASE WHEN end_date IS NULL THEN 1 ELSE 0 END) AS open_with_successor,
       SUM(CASE WHEN end_date IS NOT NULL AND end_date > next_start - :offset THEN 1 ELSE 0 END) AS overlaps,
       SUM(CASE WHEN end_date IS NOT NULL AND end_date < next_start - :offset THEN 1 ELSE 0 END) AS gaps
FROM (
  SELECT {nk_select}{part_select} start_date, end_date,
         LEAD(start_date) OVER (PARTITION BY {nk}{part_by} ORDER BY start_date) AS next_start
  FROM   {schema}.{tbl} WHERE 1 = 1 {since_clause})
WHERE next_start IS NOT NULL AND (end_date IS NULL OR end_date <> next_start - :offset)
