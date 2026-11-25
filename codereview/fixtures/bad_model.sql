{{ config(materialized='incremental', incremental_strategy='merge') }}
select * from silver.positions p
join cfg_tolerance t on t.domain = p.domain and t.is_current = 'Y'
