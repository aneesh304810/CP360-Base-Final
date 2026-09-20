# SDC compute sizing extracts

Drop each **SDC Client compute sizing reference** workbook here — one per
reference client per measured period — and run:

```bash
python -m ingestion.run sdc_compute
```

The folder may hold only one workbook at a time, because two of them are two
different clients or periods and guessing between them would be worse than
refusing. Name one explicitly when you have several:

```bash
CP_SDC_COMPUTE_XLSX="sample-artifacts/SDC-COMPUTE/client_b_oct.xlsx" \
  python -m ingestion.run sdc_compute
```

## Adding more as they arrive

Nothing needs rebuilding. `PERIOD_ID` is `<CLIENT>:<first_day>:<last_day>`,
derived from the data, so:

* re-loading the same workbook **updates its own rows** — safe to repeat;
* next month's extract **adds a period beside** the first, so a trend builds
  up rather than being overwritten;
* another client **adds another `CLIENT_CODE`**, and the projection can then
  pick the closest comparator, or blend, instead of standing on a single month.

Set `CP_SDC_COMPUTE_CLIENT` if the Summary sheet's client name is not the code
you want to store it under.

## The one number to read before quoting anything

`META_SDC_COMPUTE_PERIOD.VIEW_COVERAGE_PCT` — the per-view sheet's share of the
Summary sheet's query count. A workbook that lists only the busiest views can
cover a fraction of real traffic, and then everything derived from the view
grain is that same fraction of the truth. The load records it rather than
failing, because a partial extract is still worth having; it just must not be
read as a total.

## What the sheets must contain

| Sheet | Needs |
|---|---|
| `Summary` | client, `# of Accounts`, totals, `WH` size |
| `Daily Totals` | `ACTIVITY_DATE` + per-day totals |
| `Day_wise_views_queried` | `ACTIVITY_DATE`, `OBJECT_NAME`, queries, rows, GB, seconds |

The third is the one that matters. Without the view grain an event cannot be
priced, because an event's cost is the cost of reading the SDC view it names.

Header rows are found automatically — the title and subtitle lines above the
`Daily Totals` header are skipped — and column names are matched loosely, so
`TOTAL_NO_OF_QUERIES`, `No of Queries` and `Queries` all land in the same place.

## If the file cannot leave your machine

`python -m tools.sdc_compute_base <file> --explain` does the same parse without
a database and writes an anonymised JSON of rates and counts instead.
