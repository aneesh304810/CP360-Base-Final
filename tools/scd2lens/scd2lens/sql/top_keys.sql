-- id: top_keys
-- The keys with the most versions, and how many of those are duplicates.
-- Returns key VALUES: this is the one query whose output names a business
-- key, and it is shown only on the operator's console, never in a report.
WITH base AS ({base})
SELECT * FROM (
  SELECT {nk_concat} AS key_value, COUNT(*) AS versions, SUM(is_dup) AS dup_rows
  FROM   base GROUP BY {nk_concat} ORDER BY COUNT(*) DESC)
WHERE ROWNUM <= :n
