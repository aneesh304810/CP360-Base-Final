-- id: key_rows
-- Every version of one key, oldest first, for the Python-side diff.
SELECT {cols}
FROM   {schema}.{tbl}
WHERE  {nk} = :k
ORDER  BY start_date, {sk}
