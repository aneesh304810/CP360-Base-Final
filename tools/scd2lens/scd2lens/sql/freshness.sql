-- id: freshness
SELECT MAX(start_date) AS max_start, MAX(load_date) AS max_load, MAX(updated_tsp) AS max_updated, COUNT(*) AS total_rows
FROM   {schema}.{tbl}
