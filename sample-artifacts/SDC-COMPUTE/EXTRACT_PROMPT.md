# Prompt for extracting a compute sizing workbook

Paste everything between the rules into an assistant that can read the
workbook or its CSVs. It is written to be self-contained — it assumes no
knowledge of CP360 or of Event 360.

**Best case: you don't need this at all.** If you can export
`Day_wise_views_queried` as a CSV with its columns unchanged, send that plus
the `Summary` and `Daily Totals` sheets and the loader reads them directly.
Use this prompt when the raw rows cannot leave the environment, or when there
are too many to paste.

---

You are helping me summarise a Snowflake compute-usage workbook so the numbers
can be used in a cost model. The workbook is **SDC Client compute sizing
reference** and has three sheets:

- `Summary` — one row: Client, # of Accounts, TOTAL_NO_OF_QUERIES, Rows queried,
  TOTAL_SIZE_SCANNED_GB, TOTAL_ELAPSED_TIME_SEC, Hours, WH
- `Daily Totals` — ACTIVITY_DATE, TOTAL_NO_OF_QUERIES, TOTAL_NO_OF_ROWS_SELECTED,
  TOTAL_SIZE_SCANNED_GB, TOTAL_ELAPSED_TIME_SEC, Hours
- `Day_wise_views_queried` — ACTIVITY_DATE, OBJECT_NAME, TOTAL_NO_OF_QUERIES,
  TOTAL_NO_OF_ROWS_SELECTED, TOTAL_SIZE_SCANNED_GB, TOTAL_ELAPSED_TIME_SEC, HOURS

**Rules — these matter more than the formatting.**

1. Report exact values from the sheets. Do not round beyond what I ask for, do
   not estimate, and do not interpolate a missing day or a missing view.
2. If something is not in the workbook, write `UNKNOWN`. Do not infer it, and
   do not leave it blank — a blank reads as zero downstream.
3. Keep `OBJECT_NAME` **verbatim, including any schema prefix**.
   `I02_STAGE.TRANSACTION_BASIC_VIEW` and `TRANSACTION_BASIC_VIEW` are
   different objects with different costs. Never merge them, never strip the
   prefix, never tidy the spelling.
4. Do not drop rows because they look small. A view read twice a month still
   has to appear.
5. Do not include the client's name anywhere in your output. Use `CLIENT_A`.
6. If two rows share the same date and object name, **sum** them, and say in
   Output 5 how many such pairs you merged.

Produce exactly these five outputs, each as a fenced CSV block.

**Output 1 — view profile.** One row per distinct `OBJECT_NAME`, aggregated over
every day in the workbook, sorted by `total_elapsed_sec` descending. Include
every view, however small.

```
object_name,days_present,total_queries,total_rows,total_gb,total_elapsed_sec,sec_per_query,gb_per_query,pct_of_total_elapsed
```

`sec_per_query` = total_elapsed_sec / total_queries, 2 dp.
`gb_per_query` = total_gb / total_queries, 4 dp.
`pct_of_total_elapsed` = this view's share of the sum of all views' elapsed
seconds, 2 dp. These should sum to about 100.

**Output 2 — period header.** One row.

```
first_day,last_day,days_in_daily_sheet,days_in_view_sheet,accounts,warehouse_size,summary_queries,summary_rows,summary_gb,summary_elapsed_sec,daily_queries,daily_rows,daily_gb,daily_elapsed_sec,view_queries,view_rows,view_gb,view_elapsed_sec
```

**Output 3 — daily series.** Every row of `Daily Totals`, oldest first.

```
activity_date,queries,rows,gb,elapsed_sec
```

**Output 4 — reconciliation.** Do the arithmetic and state it plainly; do not
smooth over a disagreement.

```
check,value,comment
view_queries_as_pct_of_summary,,
view_elapsed_as_pct_of_summary,,
daily_queries_as_pct_of_summary,,
days_in_view_sheet_vs_daily_sheet,,
```

Then, in prose: if the per-view sheet accounts for less than about 97% of the
Summary query count, say which explanation the data supports — it covers
**fewer days** than the daily sheet, or it lists **fewer views** than were
actually read. Compare the two day counts to tell them apart.

**Output 5 — what the workbook does not say.** Answer each with the value or
`UNKNOWN`, and add anything else that struck you as odd.

```
question,answer
Does the Summary sheet contain any formula whose meaning is unclear (quote the cell and the formula),
Is TOTAL_ELAPSED_TIME_SEC the sum of individual query runtimes or measured warehouse uptime,
Does the period contain a month end or a quarter end,
Are there days missing from the daily series,
Number of duplicate (date object_name) pairs summed,
Number of rows dropped for any reason and why,
Is there a positions or holdings count anywhere in the workbook,
Is there a transactions-per-month count anywhere in the workbook,
Does any sheet name a credit price or a warehouse cost,
```

---

## What a human still has to answer

None of these are in the workbook, and the projection cannot be finished
without the first two.

| Needed | Why it matters |
|---|---|
| **$ per credit** on the agreement | every figure scales linearly with it; there is no safe default |
| **Warehouse uptime vs summed query time** for the same period | `TOTAL_ELAPSED_TIME_SEC` is summed query runtime. A warehouse runs queries concurrently and stays up across idle gaps, so the invoice falls either side of that sum. One month of actual warehouse-hours billed settles it |
| Client A's **positions** and **transactions per month** | position and transaction views are where the cost is, and they do not scale on account count |
| BBH's **positions** and **transactions per month** | same, for the other side of the ratio |
| Any **minimum commitment or tier** | at 15,000 accounts a floor price can be most of the bill, and it does not scale down |
| Whether the compute is **billed by SEI or run on BBH's own warehouse** | it is a real cost either way, but a different budget, and the two should not be added into one number without saying so |
