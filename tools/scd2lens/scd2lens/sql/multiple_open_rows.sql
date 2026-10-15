-- id: multiple_open_rows
SELECT SUM(CASE WHEN n > 1 THEN 1 ELSE 0 END) AS keys_many_open,
       SUM(CASE WHEN n = 0 THEN 1 ELSE 0 END) AS keys_none_open,
       COUNT(*) AS keys_total
FROM (SELECT {nk_concat} AS k, SUM(CASE WHEN end_date IS NULL THEN 1 ELSE 0 END) AS n
      FROM {schema}.{tbl} GROUP BY {nk_concat})
