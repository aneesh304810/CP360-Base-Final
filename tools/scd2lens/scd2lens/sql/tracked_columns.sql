-- id: tracked_columns
-- The column list of one table, in column order. Technical columns, the
-- surrogate key and LOBs are dropped in Python, not here.
SELECT column_name, data_type, nullable
FROM   all_tab_columns
WHERE  owner = :owner AND table_name = :tbl
ORDER  BY column_id
