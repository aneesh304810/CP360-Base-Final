// The catalogue must improve the screen when it is loaded and change
// nothing when it is not.
//
// WHY. The Business view showed DIM_ACCOUNT because nothing read
// BUSINESS_CATALOG. The fix has to be safe in the other direction too: a
// warehouse with no catalogue, a table missing from it, or a service that
// does not answer must all render exactly what the screen rendered before
// — the physical name — never a blank heading.

import { bizName, bizEntry, termName } from "../src/businessCatalog.js";

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${msg}${cond ? "" : `  -> ${String(got)}`}`);
  if (!cond) bad++;
};

const BY = {
  DIM_ACCOUNT: { table_name: "DIM_ACCOUNT", business_name: "Account",
    business_description: "The accounts BBH holds and services.",
    grain: "one row per account", is_history: "N", is_staging: "N",
    confidence: "high", review_status: "DRAFT" },
  FACT_CP_HOLDINGS_TEMP: { table_name: "FACT_CP_HOLDINGS_TEMP",
    business_name: "Holdings — Staging",
    business_description: "The holdings load in progress.",
    grain: "one row per account per security, current batch",
    is_history: "N", is_staging: "Y", confidence: "high",
    review_status: "REVIEWED" },
  DIM_ACCOUNT_IR_BLOCKS: { table_name: "DIM_ACCOUNT_IR_BLOCKS",
    business_name: "Account IR Blocks", business_description: "IR is not expanded.",
    grain: "one row per account per block", is_history: "N", is_staging: "N",
    confidence: "low", review_status: "DRAFT" },
};

// ---- loaded: the business name leads -----------------------------------
ok(bizName(BY, "DIM_ACCOUNT") === "Account", "a catalogued table shows its business name");
ok(bizEntry(BY, "DIM_ACCOUNT").grain === "one row per account", "and its grain");
ok(bizEntry(BY, "FACT_CP_HOLDINGS_TEMP").is_staging === "Y",
   "staging is flagged, so nobody reports from it");
ok(bizEntry(BY, "DIM_ACCOUNT_IR_BLOCKS").confidence === "low",
   "an unconfirmed name is flagged");

// ---- case and whitespace ------------------------------------------------
["dim_account", "Dim_Account", " DIM_ACCOUNT "].forEach((v) => {
  ok(bizName(BY, v) === "Account", `"${v}" resolves`, bizName(BY, v));
});

// ---- NOT loaded: the screen must be unchanged ---------------------------
// This is the direction that matters. Every one of these renders the
// physical name, which is what the view showed before the catalogue existed.
const EMPTY = {};
[[EMPTY, "DIM_ACCOUNT"], [null, "DIM_ACCOUNT"], [undefined, "DIM_ACCOUNT"],
 [BY, "DIM_NOT_CATALOGUED"]].forEach(([by, t]) => {
  ok(bizName(by, t) === t, `no entry: falls back to the physical name (${t})`,
     bizName(by, t));
  ok(bizEntry(by, t) === null, `no entry: bizEntry is null, not undefined (${t})`,
     bizEntry(by, t));
});
// a heading is never blank, whatever it is handed
[null, undefined, ""].forEach((t) => {
  ok(bizName(BY, t) === "", "a missing table name yields an empty string, not undefined",
     bizName(BY, t));
  ok(typeof bizName(BY, t) === "string", "and always a string");
});
// a row present but with no business_name still shows the physical name
const PARTIAL = { DIM_OFFICE: { table_name: "DIM_OFFICE", business_name: null } };
ok(bizName(PARTIAL, "DIM_OFFICE") === "DIM_OFFICE",
   "a row with a null business name falls back rather than printing null",
   bizName(PARTIAL, "DIM_OFFICE"));

// ---- field terms: the list, not the column page ------------------------
// The field list showed ACCOUNT_KEY and ACCOUNT_LONG_NAME_1 because
// /legacy-lineage/fields carries no business term. The term existed all
// along -- the column page fetched it one field at a time -- so the list
// now reads the same join in bulk. Same fallback rule as the table names.
const TERMS = {
  ACCOUNT_LONG_NAME_1: { dwh_target_column: "ACCOUNT_LONG_NAME_1",
    business_term: "Account Long Name Line 1", field_code: "BI/2-1",
    business_function: "Basic Information (BI)", is_pii: "N",
    short_desc: "Stores full name of account." },
  ACCOUNT_TAX_ID: { dwh_target_column: "ACCOUNT_TAX_ID",
    business_term: "Tax Identification Number", field_code: "TX/1-1",
    business_function: "Tax & Regulatory", is_pii: "Y", short_desc: null },
  ACCOUNT_KEY: { dwh_target_column: "ACCOUNT_KEY", business_term: null,
    field_code: null, business_function: null, is_pii: "N" },
};
ok(termName(TERMS, "ACCOUNT_LONG_NAME_1") === "Account Long Name Line 1",
   "a column with a term shows the term");
ok(termName(TERMS, "account_long_name_1") === "Account Long Name Line 1",
   "case does not matter");
ok(termName(TERMS, " ACCOUNT_LONG_NAME_1 ") === "Account Long Name Line 1",
   "nor does a stray space from a hand-edited sheet");
ok(TERMS.ACCOUNT_TAX_ID.is_pii === "Y", "personal data is flagged on the row");

// the fallback, which is the direction that must not regress
ok(termName(TERMS, "ACCOUNT_KEY") === "ACCOUNT_KEY",
   "a column with a null term keeps its physical name",
   termName(TERMS, "ACCOUNT_KEY"));
ok(termName(TERMS, "BATCH_ID") === "BATCH_ID",
   "a column absent from the dictionary keeps its physical name");
ok(termName({}, "BATCH_ID") === "BATCH_ID", "no terms loaded: physical name");
ok(termName(null, "BATCH_ID") === "BATCH_ID", "null map: physical name");
[null, undefined, ""].forEach((c) => {
  ok(termName(TERMS, c) === "", "a missing column name yields an empty string");
  ok(typeof termName(TERMS, c) === "string", "and always a string");
});

// grouping: an unnamed column must be grouped, never dropped
const NO_FN = "\u0000__no_business_function__";
const GROUPED = {};
["ACCOUNT_LONG_NAME_1", "ACCOUNT_TAX_ID", "ACCOUNT_KEY", "BATCH_ID"].forEach((c) => {
  const e = TERMS[c];
  const k = (e && e.business_function) || NO_FN;
  (GROUPED[k] = GROUPED[k] || []).push(c);
});
ok(Object.values(GROUPED).flat().length === 4,
   "every column lands in exactly one group, including the unnamed ones",
   Object.values(GROUPED).flat().length);
ok(GROUPED[NO_FN].length === 2,
   "the two without a term are grouped together, not dropped", GROUPED[NO_FN]);
// localeCompare ignores control characters, so a "\u0000" prefix does NOT
// push the group to the end -- it sorted as "not in the dictionary" and
// landed between Basic Information and Tax. The sentinel is compared, not
// sorted into place.
const order = Object.keys(GROUPED).sort((a, b) =>
  a === NO_FN ? 1 : b === NO_FN ? -1 : a.localeCompare(b));
ok(order[order.length - 1] === NO_FN,
   "the unnamed group sorts last, never into the middle", order);
ok(order[0] === "Basic Information (BI)",
   "and the named groups stay alphabetical", order[0]);
ok(Object.keys(GROUPED).sort((a, b) => a.localeCompare(b)).indexOf(NO_FN)
   !== Object.keys(GROUPED).length - 1,
   "localeCompare alone does NOT put it last -- the reason the comparator "
   + "checks the sentinel instead of relying on the prefix");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nbusiness-catalog assertions pass");
if (bad) process.exit(1);
