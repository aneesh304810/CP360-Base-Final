// The rule parser, against the real cells from LOT_LEVEL_POSITION_MAP.
//
// These are transcribed from the delivered sheet, because a parser tested
// only on tidy input is a parser that works only on tidy input — and none
// of this is tidy. Multi-line PL/SQL, prose mixed with pseudo-code, a
// literal "Null" meaning no mapping, and join conditions sharing a cell
// with a value expression.

import { parseRule, compareRules, isNoRule, ruleTokens }
  from "../src/ruleParse.js";

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${msg}${cond ? "" : `  -> ${JSON.stringify(got)}`}`);
  if (!cond) bad++;
};

// BOOK_VALUE, as delivered
const BOOK_VALUE = `v_Trade_Date_Cash := Base_Market_Value_10;
IF TRIM(Investment_Type_Code_42) != 'CASH' THEN
  book_value := nvl(book_value,0) + to_number(nvl(Base_Amortized_Cost_7,0));
ELSE
  book_value := nvl(book_value,0) + to_number(nvl(v_Trade_Date_Cash,0));`;

// ACCRUED_INCOME, SEI side, as delivered
const SEI_ACCRUED = `Pro-rate receivables based on Taxlot Qty.
If DEBIT_CREDIT_FLAG_6 = 'C'
(Taxlot_Qty/QUANTITY_HELD * VALUATION_ACCRUED_INTEREST)
Else
If DEBIT_CREDIT_FLAG_6 = 'D'
(Taxlot_Qty/QUANTITY_HELD * VALUATION_ACCRUED_INTEREST)*-1
Join Taxlot and End of day positions by Account, Portfolio, Instrument_id
where as_of_date=<processing_dt>`;

const LEGACY_ACCRUED = `to_number(nvl(Base_Interest_Receivable_9,0));`;

// ---- the literal Null ---------------------------------------------------
ok(isNoRule("Null"), "a literal Null is no rule, not a rule that writes null");
ok(isNoRule(""), "blank is no rule");
ok(isNoRule("  N/A "), "N/A is no rule");
ok(!isNoRule("nvl(x,0)"), "an actual rule is not no-rule");

// ---- ordinals -----------------------------------------------------------
const p = parseRule(BOOK_VALUE);
const byBase = Object.fromEntries(p.tokens.map((t) => [t.base.toUpperCase(), t]));
ok(byBase.BASE_MARKET_VALUE && byBase.BASE_MARKET_VALUE.ordinal === 10,
   "Base_Market_Value_10 splits into a name and ordinal 10", byBase.BASE_MARKET_VALUE);
ok(byBase.INVESTMENT_TYPE_CODE.ordinal === 42, "…_42 too", byBase.INVESTMENT_TYPE_CODE);
ok(byBase.BASE_AMORTIZED_COST.ordinal === 7, "…_7 too", byBase.BASE_AMORTIZED_COST);
ok(p.locals.some((t) => t.raw === "v_Trade_Date_Cash"),
   "a v_ prefixed name is a local, not a source field", p.locals);
ok(!p.tokens.some((t) => /^v_/i.test(t.raw)),
   "and locals stay out of the field list", p.tokens.map((t) => t.raw));

// ---- structure ----------------------------------------------------------
ok(p.branches.length === 1 && /Investment_Type_Code_42/.test(p.branches[0]),
   "the IF condition is captured", p.branches);
ok(p.hasElse, "the ELSE is noticed");
ok(p.handlesNull, "nvl() counts as null handling");
ok(p.functions.includes("NVL") && p.functions.includes("TO_NUMBER")
   && p.functions.includes("TRIM"), "functions are listed", p.functions);
ok(p.lineCount === 5, "five lines", p.lineCount);

const s = parseRule(SEI_ACCRUED);
ok(s.joins.length >= 1 && /Instrument_id/.test(s.joins.join(" ")),
   "the join line is separated from the value expression", s.joins);
ok(s.branches.length === 2, "both If branches", s.branches);
ok(s.tokens.some((t) => t.base.toUpperCase() === "DEBIT_CREDIT_FLAG"
                     && t.ordinal === 6), "DEBIT_CREDIT_FLAG_6 resolves", s.tokens);
ok(s.tokens.some((t) => t.base.toUpperCase() === "QUANTITY_HELD"
                     && t.ordinal === null),
   "a field with no ordinal has ordinal null, not 0", s.tokens);
ok(!s.tokens.some((t) => ["IF", "ELSE", "JOIN", "WHERE", "AND", "BY"]
     .includes(t.raw.toUpperCase())), "keywords are not fields",
   s.tokens.map((t) => t.raw));

// ---- the comparison -----------------------------------------------------
const c = compareRules(LEGACY_ACCRUED, SEI_ACCRUED);
const kinds = c.findings.map((f) => f.k);
ok(kinds.includes("join-added"),
   "a join the legacy rule does not need is flagged", kinds);
ok(kinds.includes("branch-added") || kinds.includes("branch-differs"),
   "the proposal branching where legacy does not is flagged", kinds);
ok(kinds.includes("null-handling-lost"),
   "legacy nvl() with no equivalent on the proposal is flagged", kinds);
ok(kinds.includes("fields-dropped"),
   "Base_Interest_Receivable being dropped is flagged", kinds);
ok(c.risk >= 2, "and the risky ones are counted as risk", c.risk);

const none = compareRules("to_number(nvl(x_1,0));", "Null");
ok(none.findings.some((f) => f.k === "sei-empty"),
   "a Null proposal is reported as no replacement, not as a match",
   none.findings.map((f) => f.k));
ok(compareRules("Null", "Null").findings[0].k === "both-empty",
   "neither side documented is its own finding");

// ---- robustness ---------------------------------------------------------
[null, undefined, "", "   ", "x", "((((", "1 + 1", "\\n\\n\\n"].forEach((v) => {
  let threw = false;
  try { parseRule(v); compareRules(v, v); } catch { threw = true; }
  ok(!threw, `parses ${JSON.stringify(v)} without throwing`);
});
ok(ruleTokens(null).length === 0, "null tokenises to nothing");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nall rule-parse assertions pass");
