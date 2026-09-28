// Which columns have a transformation, and how much of one.
//
// This drives the chip on a column row, the colour of its wire and the
// mix bar on a collapsed table — three places that must agree, which is
// why they all read one classifier rather than three regexes.

import { classifyLink, summarise, linkRule, OP_META } from "../src/linkOps.js";

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${msg}${cond ? "" : `  -> ${JSON.stringify(got)}`}`);
  if (!cond) bad++;
};
const L = (o) => ({ col: "T", src: "SRC_FIELD", ...o });

// ---- the classification, on the real rules ------------------------------
const cases = [
  ["a bare field is direct", L({}), "direct", 0, false],
  ["a null transform is still direct", L({ t1: "Not applicable" }), "direct", 0, false],
  ["trim only", L({ logic: "ltrim(rtrim(local_currency_code_47))" }), "trim", 2, true],
  ["substr with trims is derived, not trim",
   L({ logic: "substr(ltrim(rtrim(local_currency_code_47)),1,3)" }), "derived", 3, true],
  ["to_number with nvl is a cast",
   L({ logic: "to_number(nvl(Base_Interest_Receivable_9,0))" }), "cast", 2, true],
  ["to_date with a mask is a cast",
   L({ logic: "to_date(Trade_Date_128,'MM/DD/YYYY')" }), "cast", 1, true],
  ["nvl alone is a cast — it changes what arrives when the input is missing",
   L({ logic: "NVL(FX_Rate_38,0)" }), "cast", 1, true],
  ["decode is its own thing", L({ logic: "decode(SMA_IND,'Y','Y','N')" }), "decode", 1, true],
  ["a branch is derived whatever else it does",
   L({ logic: "IF TRIM(x_1) != 'CASH' THEN\n y := nvl(a_2,0);\nELSE\n y := nvl(b_3,0);" }),
   "derived", null, true],
  ["no source column and a rule is a constant",
   L({ src: null, logic: "pace_package.position_record.position_id" }), "constant", null, true],
  ["no source column and no rule is unmapped",
   L({ src: null, status: "UNMAPPED" }), "unmapped", 0, false],
];
cases.forEach(([msg, link, op, steps, transformed]) => {
  const c = classifyLink(link);
  ok(c.op === op, `${msg} → ${op}`, c.op);
  if (steps !== null) ok(c.steps === steps, `  ${steps} step(s)`, c.steps);
  ok(c.transformed === transformed, `  transformed=${transformed}`, c.transformed);
});

// ---- steps are the density signal ---------------------------------------
const simple = classifyLink(L({ logic: "trim(x)" }));
const complex = classifyLink(L({
  logic: "IF TRIM(Investment_Type_Code_42) != 'CASH' THEN\n"
       + "  book_value := nvl(book_value,0) + to_number(nvl(Base_Amortized_Cost_7,0));\n"
       + "ELSE\n  book_value := nvl(book_value,0) + to_number(nvl(v_Trade_Date_Cash,0));" }));
ok(complex.steps > simple.steps * 3,
   "a five-line branch scores far more steps than trim(x)",
   [simple.steps, complex.steps]);
ok(complex.hasBranch && !simple.hasBranch, "and is flagged as branching");

// a join is noticed and forces derived
const joined = classifyLink(L({ logic:
  "(Taxlot_Qty/QUANTITY_HELD * VALUATION_ACCRUED_INTEREST)\n"
  + "Join Taxlot and End of day positions by Account where as_of_date=<dt>" }));
ok(joined.hasJoin && joined.op === "derived", "a join forces derived", joined);

// ---- the rule text ------------------------------------------------------
ok(linkRule({ logic: "A", t1: "B" }) === "A",
   "the registered rule wins over the hop text");
ok(linkRule({ t1: "a", t2: "", t3: "c" }) === "a\nc",
   "hops join in order, skipping the empty ones", linkRule({ t1:"a", t2:"", t3:"c" }));
ok(linkRule({ t1: "Not applicable" }) === "",
   "'not applicable' is not a rule");
ok(linkRule(null) === "", "a missing link has no rule");

// ---- the table roll-up --------------------------------------------------
const tbl = [
  L({ col:"A" }), L({ col:"B" }),
  L({ col:"C", logic:"trim(x)" }),
  L({ col:"D", logic:"to_number(nvl(y_1,0))" }),
  L({ col:"E", logic:"IF a_1 = 'x' THEN\n z := b_2;\nELSE\n z := c_3;" }),
];
const s = summarise(tbl);
ok(s.total === 5 && s.transformed === 3 && s.direct === 2,
   "three of five columns are transformed", [s.total, s.transformed, s.direct]);
ok(s.pct === 60, "which is 60%", s.pct);
ok(s.branchy === 1, "one of them branches", s.branchy);
ok(s.steps >= 4, "and the step total adds up", s.steps);
ok(s.mix.map((m) => m.op).join(",") === "direct,trim,cast,derived",
   "the mix comes back in a fixed order so the bar never reshuffles",
   s.mix.map((m) => m.op));
ok(s.mix.reduce((a, m) => a + m.n, 0) === s.total,
   "and every column is in exactly one band");

ok(summarise([]).total === 0 && summarise(null).total === 0,
   "an empty table summarises to zero rather than throwing");

// ---- every op has a colour and a note -----------------------------------
s.mix.forEach((m) => ok(OP_META[m.op] && OP_META[m.op].c && OP_META[m.op].note,
  `${m.op} has a colour and an explanation`));

// ---- robustness ----------------------------------------------------------
[null, undefined, {}, { logic: "((((" }, { logic: 42 }, { src: 1, logic: null }]
  .forEach((v, i) => {
    let threw = false, c = null;
    try { c = classifyLink(v); } catch { threw = true; }
    ok(!threw, `classifies ${JSON.stringify(v)} without throwing`);
    if (c) ok(OP_META[c.op] !== undefined && Number.isFinite(c.steps),
      `  and returns a known op with a finite step count`, c);
  });

console.log(bad ? `\n${bad} assertion(s) failed` : "\nall link-ops assertions pass");
