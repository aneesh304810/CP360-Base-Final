# Lineage ingestion prompts

Prompts run against an enterprise Claude with the source documents attached, to
produce the workbook this repo's lineage loader ingests.

## Use this one

**`PROMPT_IMDS_STAR_UAF_SEI_data_lineage.md`** — canonical. Self-contained,
lane-shaped, covers IMDS as the target with STAR, UAF and SEI as sources.
Produces `IMDS_STAR_UAF_SEI_Data_Lineage.xlsx`, 13 sheets.

## For PBDW, when its mapping arrives

**`PROMPT_PBDW_ADDVANTAGE_SEI_crosswalk.md`** — the attach case. PBDW's
lineage already exists, so that workbook carries only the SEI side: eleven
sheets, no lineage sheet. It requires two SQL extracts as inputs, and the rule
that decides whether the load joins at all is that every
`TARGET_CONTRACT_FIELD` must be copied verbatim from the contract inventory.

## After the load — validate what actually landed

**`PROMPT_VALIDATE_INGESTED_CROSSWALK.md`** — audits the LOADED data rather
than the workbook. Different question: the workbook's own self-checks say it
is internally consistent, and ingestion still normalises feed names,
canonicalises field codes and resolves lanes, any of which can drop rows
silently. A join that matches nothing renders an empty panel, not an error.

Run `docs/sei-crosswalk/validate-crosswalk.sql` (read only), optionally dump
the API responses as the prompt describes, paste both under the prompt. It
returns a JSON findings block plus a short reading — vocabulary drift, join
loss per join, rule violations ranked by whether they make a number wrong or
merely incomplete, and the UI and functional gaps the shape of the data
implies.

## Superseded — kept for history, do not run

- `PROMPT_star_sei_workbook.md` — the first generation prompt. Scoped the
  column-level sheet to the STAR lane and named it `STAR_TO_IMDS`, which left
  the UAF lane with nowhere to record its lineage.
- `PROMPT_workbook_fix_pass.md` — eight corrections to the workbook that came
  back from the first prompt. All eight are folded into the canonical prompt.

## What the fix pass taught, now baked in

- **A lane is `incumbent source → target warehouse`.** The column-level sheet is
  `LANE_LINEAGE`, keyed on (lane, target table, target column), and holds every
  lane. Out of the SEI coverage denominator and out of the lineage are different
  things; only the first is true of UAF.
- **Map once at the contract.** `SEI_TO_CONTRACT` is one row per (lane, contract
  feed, contract field, SEI datapoint) — never one per target column. The
  fan-out to several target columns happens in the join. The first run produced
  the per-target grain and duplicated four ACDDIFI1 fields, which is how two
  rows can come to disagree about one contract field.
- **Never dedupe across lanes.** Two lanes writing one IMDS column is a finding
  needing a precedence rule, not a duplicate. It has its own sheet,
  `DUAL_SOURCE`.
- **A data dictionary is not DDL.** Target types from a dictionary cap the
  workbook at zero proven matches however good the SEI side gets. The
  `ALL_TAB_COLUMNS` query in Appendix A is the single highest-value input.
- **A reference workbook may publish domains without their values.** That is a
  `NOT_SUPPLIED` row and an exception, never invented codes. The first run
  returned 197 domain names shaped as if they were code values.

## Schema note

`LANE_LINEAGE` mirrors the `LEGACY_LINEAGE` table so the load is a direct
insert, with three additions that table does not yet have: `SRC_TYPE`,
`SRC_LENGTH`, `SRC_PRECISION`. The format check needs the contract side's type,
so those are an additive `ALTER` in the style of `sql/29_` and `sql/50_`.
