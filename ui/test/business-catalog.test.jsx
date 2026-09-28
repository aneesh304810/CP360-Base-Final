// The catalogue must improve the screen when it is loaded and change
// nothing when it is not.
//
// WHY. The Business view showed DIM_ACCOUNT because nothing read
// BUSINESS_CATALOG. The fix has to be safe in the other direction too: a
// warehouse with no catalogue, a table missing from it, or a service that
// does not answer must all render exactly what the screen rendered before
// — the physical name — never a blank heading.

import { bizName, bizEntry } from "../src/businessCatalog.js";

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

console.log(bad ? `\n${bad} assertion(s) failed` : "\nbusiness-catalog assertions pass");
if (bad) process.exit(1);
