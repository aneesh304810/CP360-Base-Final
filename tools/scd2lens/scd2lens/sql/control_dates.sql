-- id: control_dates
-- The latest control row: what the load thinks today is.
SELECT * FROM (
  SELECT load_date, current_business_date, prior_business_date
  FROM   {schema}.DIM_CONTROL_DATES
  ORDER  BY load_date DESC)
WHERE ROWNUM = 1
