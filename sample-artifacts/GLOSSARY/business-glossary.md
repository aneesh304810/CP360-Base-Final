# CP Catalog — Authored Business Glossary

> Fills gaps that dbt metrics/descriptions don't cover — especially regulatory
> mappings and business terms without a MetricFlow metric. The connector merges
> these with what it derives from dbt; authored rows supplement, and set
> regulatory_scope which dbt rarely carries.
>
> Columns: Term | Definition | Domain | Owner | Regulatory | Maps to (schema.model.column)

| Term | Definition | Domain | Owner | Regulatory | Maps to |
|------|-----------|--------|-------|-----------|---------|
| Assets Under Custody | Total market value of assets held in custody for clients | positions | Custody Ops | NYDFS 500, MiFID II | imdw.sei_gld_positions_summary.market_value_usd |
| Net Asset Value | Portfolio value net of liabilities, struck at EOD | nav | Fund Accounting | NYDFS 500 | imdw.gld_nav_daily.nav_usd |
| Cost Basis | Original acquisition value of a tax lot for gain/loss | taxlots | Tax Operations | IRS, MiFID II | imdw.sei_gld_taxlots_summary.cost_basis_usd |
| Accrued Income | Income earned but not yet received, accrued daily | accruals | Fund Accounting | NYDFS 500 | pbdw.int_accruals_enriched.amount_usd |
| Gross Income | Total income from interest and dividends before fees | gl | Fund Accounting | | imdw.gld_income_statement.gross_income_usd |
