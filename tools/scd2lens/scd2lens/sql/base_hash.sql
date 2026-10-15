-- id: base_hash
-- The inline view every duplicate check builds on: one row per version with
-- its chunked hash and whether it equals the previous version's hash.
-- {hash_expr} is generated in chunks of hash_chunk_size columns; {nk} and
-- {part} are validated identifiers; the date filter is a bind.
SELECT {nk_select}{part_select} start_date, end_date, row_hash,
       CASE WHEN row_hash = LAG(row_hash) OVER (PARTITION BY {nk}{part_by} ORDER BY start_date) THEN 1 ELSE 0 END AS is_dup
FROM (SELECT {nk_select}{part_select} start_date, end_date, {hash_expr} AS row_hash
      FROM   {schema}.{tbl}
      WHERE  1 = 1 {since_clause})
