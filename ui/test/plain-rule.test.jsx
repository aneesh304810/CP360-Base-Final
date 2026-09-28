// The transformation, in words a business audience can act on.
//
// Run against the rule text the workbooks actually deliver, not against
// invented SQL. Three things must hold for every one of them: a sentence
// comes out, it is English rather than a restatement of the expression,
// and where the operation has a real failure mode the watch note names the
// consequence rather than the syntax.

import { explainRule, STEP_META } from "../src/plainRule.js";
import { buildRuleGraph } from "../src/ruleGraph.js";

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${msg}${cond ? "" : `  -> ${String(got)}`}`);
  if (!cond) bad++;
};

// Rules taken from the delivered cells, plus the shapes around them.
const CASES = [
  ["ltrim(rtrim(Account_Number_1))", "trim", /spaces/i],
  ["to_number(nvl(Base_Interest_Receivable_9,0))", "cast", /number/i],
  ["to_date(Trade_Date_128,'MM/DD/YYYY')", "cast", /month, then day/i],
  ["decode(SMA_IND,'Y','Y','N')", "decode", /translated/i],
  ["substr(ltrim(rtrim(local_currency_code_47)),1,3)", "cast", /first 3 characters/i],
  ["NVL(FX_Rate_38,0)", "cast", /nothing, 0 is used/i],
  ["upper(trim(ACCT_ID))", "trim", /upper case/i],
  ["round(Base_Market_Value_10,2)", "cast", /2 decimal places/i],
];

CASES.forEach(([rule, wantOp, wantText]) => {
  const r = explainRule(rule);
  ok(r.steps.length > 0, `"${rule.slice(0, 34)}…": produces a sentence`);
  ok(r.op === wantOp, `"${rule.slice(0, 34)}…": classified ${wantOp}`, r.op);
  ok(r.steps.some((s) => wantText.test(s.what)),
     `"${rule.slice(0, 34)}…": says it in English`,
     r.steps.map((s) => s.what).join(" | "));
});

// ---- every sentence must be English, not the expression restated -------
const ALL = CASES.map(([r]) => r);
ALL.forEach((rule) => {
  explainRule(rule).steps.forEach((s) => {
    ok(typeof s.what === "string" && s.what.length > 20,
       `"${rule.slice(0, 24)}…": a real sentence`, s.what);
    ok(/[.!?]$/.test(s.what.trim()), `"${rule.slice(0, 24)}…": ends as a sentence`,
       s.what);
    ok(!/[(){};]|:=|\bnvl\b|\bto_date\b|\bsubstr\b/i.test(s.what),
       `"${rule.slice(0, 24)}…": no SQL leaks into the sentence`, s.what);
    ok(STEP_META[s.op], `"${rule.slice(0, 24)}…": op "${s.op}" has a label`);
    if (s.watch) {
      ok(s.watch.length > 40, "a watch note says something specific", s.watch);
      // Parentheses and := are the SQL tells. A semicolon is ordinary
      // punctuation -- "Nothing fails; the date is simply wrong" is prose.
      ok(!/[(){}]|:=|\bselect\b/i.test(s.watch), "and stays out of SQL", s.watch);
    }
  });
});

// ---- the watch notes that carry the value ------------------------------
// Each of these is the reason the view exists: the failure is invisible in
// the expression and obvious in the sentence.
const watchOf = (rule) => explainRule(rule).steps.map((s) => s.watch || "").join(" ");
ok(/eleven days of every month/i.test(watchOf("to_date(D,'MM/DD/YYYY')")),
   "a US date format warns about the day-first case");
ok(/zero/i.test(watchOf("to_number(nvl(X,0))")),
   "defaulting to zero warns that a blank becomes a real zero");
ok(/new code/i.test(watchOf("decode(F,'Y','Y','N')")),
   "a decode warns about a code that is not in the list");
ok(/cut short/i.test(watchOf("substr(X,1,80)")),
   "a substring warns that a longer value is truncated");
ok(/two different business meanings/i.test(
     watchOf("IF TRIM(Investment_Type_Code_42) != 'CASH' THEN a := X; ELSE a := Y;")),
   "a branch warns that one column carries two meanings",
   watchOf("IF TRIM(Investment_Type_Code_42) != 'CASH' THEN a := X; ELSE a := Y;"));

// ---- no rule, and no source --------------------------------------------
["", null, undefined, "N/A", "Null", "not applicable", "  "].forEach((r) => {
  const e = explainRule(r);
  ok(e.steps.length === 1 && e.op === "direct",
     `no rule (${JSON.stringify(r)}): one "carried across" sentence`, e.op);
  ok(/carried across/i.test(e.steps[0].what), "and it says so plainly");
  ok(e.steps[0].watch === null, "with nothing to watch for");
});
const ns = explainRule("", { hasSource: false });
ok(ns.op === "none", "no source: classified none", ns.op);
ok(/nothing in the source/i.test(ns.steps[0].what), "and says nothing feeds it");
ok(Boolean(ns.steps[0].watch), "and flags a value nobody supplied");

// ---- it agrees with the graph, which is the whole design ---------------
// A sentence that says "translated" while the graph draws a branch is the
// failure this shares a parser to avoid.
ALL.concat(["IF a != 'CASH' THEN x := A; ELSE x := B;"]).forEach((rule) => {
  const e = explainRule(rule);
  const g = buildRuleGraph(rule, { target: "T" });
  const graphBranch = g.nodes.some((n) => n.kind === "branch");
  ok(e.hasBranch === graphBranch,
     `"${rule.slice(0, 30)}…": branch agrees with the graph`,
     [e.hasBranch, graphBranch]);
  const graphFields = g.nodes.filter((n) => n.kind === "field").length;
  ok(e.fields.length === graphFields,
     `"${rule.slice(0, 30)}…": the same fields as the graph`,
     [e.fields.length, graphFields]);
});

// ---- repetition an expression produces naturally -----------------------
const dbl = explainRule("ltrim(rtrim(X))");
ok(dbl.steps.length === 1,
   "ltrim(rtrim(x)) is two nodes and one sentence, not the same line twice",
   dbl.steps.map((s) => s.what));

// ---- nothing throws, whatever it is handed -----------------------------
["((((", "select * from", "1 + ", "'unterminated", "🙂", "a".repeat(3000)]
  .forEach((junk) => {
    let threw = null;
    try { explainRule(junk); } catch (e) { threw = e; }
    ok(!threw, `junk input does not throw: ${junk.slice(0, 14)}`, threw);
  });

console.log(bad ? `\n${bad} assertion(s) failed` : "\nplain-rule assertions pass");
if (bad) process.exit(1);
