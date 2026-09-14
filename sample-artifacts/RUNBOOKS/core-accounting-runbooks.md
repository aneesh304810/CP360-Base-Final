# Runbook Domain: Core Accounting

> Each `##` heading is one business function (a runbook). The table rows are the
> ordered API steps. The connector joins Method + Path to the endpoint catalog to
> pull operationId, params, depends-on entities, and schema automatically.
> You only author: function name, intro, and the ordered Method | Path | Domain | Purpose rows.

## Daily Position Reconciliation
**Goal:** Reconcile end-of-day positions against the prior day and explain deltas.
**Persona:** Operations analyst, middle office

| # | Method | Path | Domain | Purpose |
|---|--------|------|--------|---------|
| 1 | POST | /v2/oauthtoken | documents | Authenticate; captures access_token for all later steps |
| 2 | GET | /firm-base-curr-cache | infrastructure | Establish firm base currency before pulling balances |
| 3 | GET | /realtimeholdings | core-accounting | Pull current positions and market values (source of truth) |
| 4 | POST | /netavailablecurrencybalance | core-accounting | Confirm available cash by currency for settlement readiness |
| 5 | GET | /transactions | core-accounting | List today's activity to explain holding deltas |

## Tax Lot Audit for a Portfolio
**Goal:** Audit open tax lots (cost basis, acquisition date, quantity) for a portfolio.
**Persona:** Audit, middle office

| # | Method | Path | Domain | Purpose |
|---|--------|------|--------|---------|
| 1 | POST | /v2/oauthtoken | documents | Authenticate; captures access_token |
| 2 | POST | /retrieveAccountDetails | client-management | Validate account is active and look up its portfolios |
| 3 | GET | /portfolio/taxlots | core-accounting | Pull every open tax lot for cost-basis audit |
| 4 | GET | /transactions | core-accounting | Reconcile tax lots against historical buy/sell activity |

## Cash Balance & Projection Check
**Goal:** Determine spendable cash today and project forward from fixed-income flows.
**Persona:** Operations analyst

| # | Method | Path | Domain | Purpose |
|---|--------|------|--------|---------|
| 1 | POST | /v2/oauthtoken | documents | Authenticate; captures access_token |
| 2 | GET | /firm-base-curr-cache | infrastructure | Determine firm reporting currency |
| 3 | POST | /netavailablecurrencybalance | core-accounting | Spendable cash today, by currency |
| 4 | GET | /amortizationaccretionsch | cash | Projected future cash flows from amortization |
