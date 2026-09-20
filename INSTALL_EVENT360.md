# Event 360 — install, ingest, run

Event 360 is three things kept deliberately apart, because two of them are
opinions and one is a specification:

| | What it is | Where it comes from |
|---|---|---|
| **The contract** | what SEI says an event is | the event specification workbook |
| **Our decisions** | who consumes it, how critical it is | CSVs you maintain |
| **The measured bill** | warehouse time per SDC view | the SDC compute sizing workbook |

Every panel in the UI says which of the three it is showing. That is not
tidiness: a criticality band is ours, and if it reaches a screen looking like a
specification field somebody will eventually quote it back to SEI.

---

## 1. Run the SQL, in order

```bash
sqlplus $CP_CATALOG_DB_DSN @sql/51_event360.sql
sqlplus $CP_CATALOG_DB_DSN @sql/52_sdc_compute.sql
sqlplus $CP_CATALOG_DB_DSN @sql/53_event_subscription.sql
```

All three are idempotent — re-running them is safe and is the normal way to
pick up a change.

`53` seeds `ref_compute_agreement` with what is known today: **$7 per
credit-hour, XS warehouse, a 15,000 floor**. Two values in that row are NOT
measured and are flagged as such by the API:

- `concurrency = 1` treats summed query elapsed time as warehouse uptime.
- `minimum_per = 'YEAR'` is unconfirmed.

Update the row when you know better; every figure on the cost screen follows.

## 2. Ingest

```bash
python -m ingestion.run event360            # the contract: 105 events, 575 fields
python -m ingestion.run sdc_compute         # the measured read-back, per SDC view
python -m ingestion.run event_subscription  # who consumes what
```

Each step is independent and idempotent. Run any one of them again after a new
extract; nothing needs rebuilding.

### Where the files go

| Step | Drop into | Shape |
|---|---|---|
| `event360` | `sample-artifacts/EVENT-360/<workbook>.xlsx` | 8 sheets; sheet 8 is not loaded |
| `sdc_compute` | `sample-artifacts/SDC-COMPUTE/<workbook>.xlsx` | Summary / Daily Totals / Day_wise_views_queried |
| `event_subscription` | `sample-artifacts/EVENT-360/consumers.csv` and `subscriptions.csv` | see below |

Sample CSVs are committed so the screens have something to show. **Replace
them** — they are a shape, not data.

```csv
# consumers.csv
consumer_code,consumer_name,delivery_mode,owner_team,status,notes
STATEMENTS,Client statements,stream,Client Reporting,ACTIVE,
```
`status` is `ACTIVE | PLANNED | RETIRED` — a system can be planned.

```csv
# subscriptions.csv
consumer_code,event_id,filter_expr,delivery_mode,status,since_dt,requested_by,notes
STATEMENTS,1,all operations,stream,ACTIVE,2026-01-01,,
```
`status` is `ACTIVE | REQUESTED | RETIRED` — a subscription is never planned,
it is requested, and somebody has to approve it. **The `filter_expr` is not
decoration**: a subscription taking all operations pays for every insert and
update; narrowing it is the cheapest saving available and needs no change to
the contract.

### Adding more compute extracts as they arrive

Nothing needs rebuilding. `PERIOD_ID` is `<CLIENT>:<first_day>:<last_day>`,
derived from the data, so re-loading the same workbook updates its own rows,
next month's extract adds a period beside it, and another client adds another
code. One workbook per folder at a time, or name it:

```bash
CP_SDC_COMPUTE_XLSX="…/client_b_oct.xlsx" python -m ingestion.run sdc_compute
```

### If a workbook cannot leave the environment

```bash
python -m tools.sdc_compute_base <file> --explain
python -m tools.sdc_compute_base <file> --credit-price 7 --minimum 15000
```

Same parser, no database, writes an anonymised JSON of rates and counts.
`sample-artifacts/SDC-COMPUTE/EXTRACT_PROMPT.md` is a prompt for the case where
even that has to happen somewhere else.

## 3. API

`api/app/main.py` already mounts `routers_event360`. Restart the API and check:

```bash
curl -s localhost:8000/event360/summary | head -c 400
```

`{"loaded": false, …}` means the ingestion has not run — the UI says the same
thing rather than showing demo data.

### Endpoints

| Route | Answers |
|---|---|
| `GET /event360/summary` | the estate at a glance, plus the compute period in force |
| `GET /event360/events` | every event with its criticality inputs and the weights used |
| `GET /event360/groups?by=type\|domain\|cross\|view\|ops` | the estate grouped, with subscription coverage and compute per group |
| `GET /event360/event/{id}` | the passport: contract, fields, triggers, coupling, subscriptions, view profile |
| `GET /event360/lanes?by=domain\|table` | swimlanes |
| `GET /event360/link[?domain=]` | the three-stage flow; with `domain`, one band per event |
| `GET /event360/interdependence[?table=]` | blast radius per column and the domain × table heatmap |
| `GET /event360/column/{table}/{column}` | every event that fires when that column changes |
| `GET /event360/subscriptions[?consumer=]` | subscriptions, consumers, the matrix, and what nobody reads |
| `POST /event360/cost` | price a basket of events |
| `GET /event360/contract` | envelope, consumption rules, criticality weights, agreement |

`POST /event360/cost` takes `{"event_ids": [...]}` plus optional overrides —
`credit_price`, `concurrency`, `minimum_amount`, `minimum_per`,
`target_accounts`, `growth_per_quarter_pct` — so a screen can explore without
editing the agreement. The response always states which values it used.

## 4. UI

Three files, already wired:

- `ui/src/Event360.jsx` — the module
- `ui/src/event360_api_additions.js` — its own API client
- `ui/src/App.jsx` and `ui/src/AppShell.jsx` — route `event360` and a nav entry

The client lives in its own file on purpose: `ui/src/api.js` is routinely ahead
in working copies and behind in the repo, and adding calls there is how a page
ends up throwing `api.evtSummary is not a function` on whichever machine pulls
the branch.

**If your `App.jsx` or `AppShell.jsx` differ from the repo's**, the change is
two lines in each:

```jsx
// App.jsx
import Event360 from "./Event360.jsx";
...
 event360: <Event360 t={t} />,
```
```jsx
// AppShell.jsx — in NAV_GROUPS
 { group: 'Events', items: [
 ['event360', 'Event 360', '◐'],
 ] },
```

---

## What the screens will tell you that you may not expect

**Cost attaches to the view, not the event.** Consumption rule 1 says an event
is a notification and the record must be fetched from the SDC view named in the
payload, so the bill is warehouse time on that view. Twenty events naming
`ACCOUNT_BASIC_VIEW` cost about what one costs. The basket prices **distinct
views**, so ticking an event whose view is already in the basket adds nothing.
That is the right answer, not a bug.

**Where there is a floor, the floor is the bill.** At $7/hour with usage far
below a 15,000 minimum, trimming a chatty event saves nothing. The screen
reports the floor as the answer and usage as the thing consuming headroom, and
says how many warehouse-hours of headroom are left.

**An unmeasured view is named, not priced at zero.** If a basket names a view
the compute extract did not cover, the screen says so in red. Absent is not
free.

**Criticality is ours.** Five weighted inputs from
`ref_event_criticality_weight`, all shown on screen with their raw values,
because a score whose arithmetic is hidden is an opinion in a badge. Change a
weight, re-run nothing, refresh — the bands move.

## Still unmeasured, and labelled as such

| | Why it matters |
|---|---|
| **Concurrency** | `TOTAL_ELAPSED_TIME_SEC` is summed query runtime, not warehouse uptime. The bill falls either side of it. One month of billed warehouse-hours settles it |
| **Whether the floor is per month or per year** | changes the headroom figure by 12× |
| **Positions and transactions**, both clients | position and transaction views are where the compute is and they do not scale on account count; today they fall back to the account ratio and the API says so |
| **Messages per event** | nothing measures it yet, so criticality's volume input is zero for every event. Visible, because the weights are on screen |
