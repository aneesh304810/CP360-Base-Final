-- id: freshness
-- {extra} adds MAX(load_date) / MAX(updated_tsp) only when the table has them.
SELECT MAX({vf}) AS max_start{extra}, COUNT(*) AS total_rows
FROM   {schema}.{tbl}
