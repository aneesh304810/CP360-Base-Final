// The parser that turns a rule into operations.
//
// ruleParse only had to answer "what does this mention". This has to answer
// "what feeds what", and the two expressions `to_number(nvl(x,0))` and
// `nvl(to_number(x),0)` have identical token sets and different behaviour —
// so nesting is the thing to get right, and the thing to test.
//
// Every rule below is transcribed from LOT_LEVEL_POSITION_MAP.

import { buildRuleGraph, buildComparisonGraph, tokenize, isNoRule }
  from "../src/ruleGraph.js";

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${msg}${cond ? "" : `  -> ${JSON.stringify(got)}`}`);
  if (!cond) bad++;
};

const BOOK = `v_Trade_Date_Cash := Base_Market_Value_10;
IF TRIM(Investment_Type_Code_42) != 'CASH' THEN
  book_value := nvl(book_value,0) + to_number(nvl(Base_Amortized_Cost_7,0));
ELSE
  book_value := nvl(book_value,0) + to_number(nvl(v_Trade_Date_Cash,0));`;

const SEI_ACCRUED = `Pro-rate receivables based on Taxlot Qty.
If DEBIT_CREDIT_FLAG_6 = 'C'
(Taxlot_Qty/QUANTITY_HELD * VALUATION_ACCRUED_INTEREST)
Else
If DEBIT_CREDIT_FLAG_6 = 'D'
(Taxlot_Qty/QUANTITY_HELD * VALUATION_ACCRUED_INTEREST)*-1
Join Taxlot and End of day positions by Account, Portfolio, Instrument_id
where as_of_date=<processing_dt>`;

const CURRENCY = "substr(ltrim(rtrim(local_currency_code_47)),1,3);";
const ACCRUED_LEGACY = "to_number(nvl(Base_Interest_Receivable_9,0));";

const of = (g, kind) => g.nodes.filter((n) => n.kind === kind);
const byLab = (g, lab) => g.nodes.find((n) => n.lab === lab);
const feeds = (g, a, b) => g.edges.some(([x, y]) => x === a && y === b);
const inputsOf = (g, id) => g.edges.filter(([, y]) => y === id).map(([x]) => x);

// ---- nesting is the whole point -----------------------------------------
let g = buildRuleGraph(CURRENCY, { target: "CURRENCY" });
const rtrim = byLab(g, "rtrim( )"), ltrim = byLab(g, "ltrim( )"),
      substr = byLab(g, "substr( )"), fld = byLab(g, "local_currency_code_47");
ok(rtrim && ltrim && substr && fld, "all four operations appear",
   g.nodes.map((n) => n.lab));
ok(feeds(g, fld.id, rtrim.id), "the field feeds rtrim, the innermost call");
ok(feeds(g, rtrim.id, ltrim.id), "rtrim feeds ltrim");
ok(feeds(g, ltrim.id, substr.id), "ltrim feeds substr");
ok(feeds(g, substr.id, g.targetId), "substr feeds the target");
ok(!feeds(g, fld.id, substr.id),
   "and the field does NOT feed substr directly — nesting is respected");
ok(inputsOf(g, substr.id).length === 3,
   "substr takes three inputs: the trimmed value, 1 and 3",
   inputsOf(g, substr.id).length);

// the same tokens in a different nesting must give a different graph
const a = buildRuleGraph("to_number(nvl(x,0))", { target: "T" });
const b = buildRuleGraph("nvl(to_number(x),0)", { target: "T" });
const shape = (x) => x.edges.map(([p, q]) => {
  const n = (i) => x.nodes.find((z) => z.id === i).lab;
  return `${n(p)}>${n(q)}`;
}).sort().join("|");
ok(shape(a) !== shape(b),
   "identical tokens, different nesting, different graph", [shape(a), shape(b)]);

// ---- ordinals -----------------------------------------------------------
g = buildRuleGraph(ACCRUED_LEGACY, { target: "ACCRUED_INCOME" });
const bir = byLab(g, "Base_Interest_Receivable_9");
ok(bir && bir.ordinal === 9 && bir.base === "Base_Interest_Receivable",
   "a field carries its base name and ordinal", bir);
ok(of(g, "const").length === 1, "the 0 is a const node", of(g, "const").length);

// ---- branches -----------------------------------------------------------
g = buildRuleGraph(BOOK, { target: "BOOK_VALUE" });
const br = of(g, "branch").filter((n) => n.sub === "two legs");
ok(br.length === 1, "one IF becomes one branch node", br.map((n) => n.lab));
ok(/CASH/.test(br[0].lab), "labelled with its condition", br[0].lab);
const legs = g.edges.filter(([x, , l]) => x === br[0].id && l);
ok(legs.length === 2, "two legs leave it", legs);
ok(legs.some(([, , l]) => l === "then") && legs.some(([, , l]) => l === "else"),
   "labelled then and else", legs.map((e) => e[2]));
const vlocal = byLab(g, "v_Trade_Date_Cash");
ok(vlocal && vlocal.kind === "fn" && vlocal.local,
   "a v_ prefixed name is a local, not a source field", vlocal);
ok(of(g, "field").every((n) => !/^v_/i.test(n.lab)),
   "so no local is drawn as a field", of(g, "field").map((n) => n.lab));

// ---- the SEI side: prose, joins and pseudo-code in one cell -------------
g = buildRuleGraph(SEI_ACCRUED, { track: "sei", target: "ACCRUED_INCOME" });
const join = of(g, "join");
ok(join.length === 1, "the Join line becomes one join node", join.length);
ok(/Taxlot/.test(join[0].lab) && /⋈/.test(join[0].lab),
   "naming both objects", join[0].lab);
ok(/Instrument_id/.test(join[0].sub) && /as_of_date/.test(join[0].sub),
   "with its keys and its predicate kept apart from the objects", join[0].sub);
ok(of(g, "field").every((f) => feeds(g, join[0].id, f.id)),
   "and the join feeds every field, because no join means no rows");

const prose = of(g, "prose");
ok(prose.length >= 1, "the sentence is kept as a prose node", prose.map((n) => n.lab));
ok(prose.some((n) => /Pro-rate/.test(n.lab)),
   "verbatim, not dropped", prose.map((n) => n.lab));
ok(g.unparsed >= 1, "and counted as unparsed", g.unparsed);
ok(byLab(g, "÷") && byLab(g, "×"),
   "the arithmetic becomes operator nodes", g.nodes.map((n) => n.lab));
const dcf = byLab(g, "DEBIT_CREDIT_FLAG_6");
ok(dcf && dcf.ordinal === 6, "the flag keeps its ordinal", dcf);

// ---- no rule ------------------------------------------------------------
["Null", "", "  ", "N/A"].forEach((v) => {
  const e = buildRuleGraph(v, { target: "X" });
  ok(e.empty === true, `${JSON.stringify(v)} is no rule`, e.empty);
  ok(e.nodes.length === 1 && e.nodes[0].kind === "target",
     "  and produces only the target", e.nodes.map((n) => n.kind));
});
ok(isNoRule("Null") && !isNoRule("nvl(x,0)"), "isNoRule agrees");

// ---- the comparison ------------------------------------------------------
const c = buildComparisonGraph(ACCRUED_LEGACY, SEI_ACCRUED, "ACCRUED_INCOME");
const lab = (id) => c.nodes.find((n) => n.id === id).lab;
ok(c.onlySei.map(lab).some((x) => /⋈/.test(x)),
   "the join is marked as SEI-only", c.onlySei.map(lab));
ok(c.onlyLegacy.map(lab).includes("Base_Interest_Receivable_9"),
   "the dropped field is marked as legacy-only", c.onlyLegacy.map(lab));
ok(!c.onlyLegacy.includes(c.legacy.targetId)
   && !c.onlySei.includes(c.sei.targetId),
   "the target is on both sides and is never ringed");
ok(new Set(c.nodes.map((n) => n.id)).size === c.nodes.length,
   "ids are unique across the two tracks");
c.edges.forEach(([x, y]) => {
  const nx = c.nodes.find((n) => n.id === x), ny = c.nodes.find((n) => n.id === y);
  ok(nx && ny && nx.track === ny.track,
     "no edge crosses tracks", [x, y]);
});

// a rule compared with itself has nothing marked
const same = buildComparisonGraph(CURRENCY, CURRENCY, "CURRENCY");
ok(same.onlyLegacy.length === 0 && same.onlySei.length === 0,
   "a rule compared with itself rings nothing",
   [same.onlyLegacy.length, same.onlySei.length]);

// ---- robustness ----------------------------------------------------------
["((((", "1 +", "f(", ")", "a := ", "IF THEN ELSE", "-- just a comment",
 "x := y := z;", null, undefined, 42, "IF a = 'x' THEN\ny := 1;"].forEach((v) => {
  let threw = false, r = null;
  try { r = buildRuleGraph(v, { target: "T" }); } catch { threw = true; }
  ok(!threw, `parses ${JSON.stringify(v)} without throwing`);
  if (r) {
    ok(r.nodes.every((n) => n.id && n.kind && typeof n.lab === "string"),
       "  every node is well formed");
    const ids = new Set(r.nodes.map((n) => n.id));
    ok(r.edges.every(([x, y]) => ids.has(x) && ids.has(y)),
       "  and every edge connects nodes that exist", r.edges);
  }
});
ok(tokenize(null).length === 0, "tokenising null gives nothing");

// no edge may point at itself, and none may be duplicated
[BOOK, SEI_ACCRUED, CURRENCY, ACCRUED_LEGACY].forEach((r, i) => {
  const x = buildRuleGraph(r, { target: "T" });
  ok(x.edges.every(([p, q]) => p !== q), `rule ${i}: no self-edge`);
  const seen = new Set();
  const dup = x.edges.filter(([p, q]) => {
    const k = `${p}>${q}`;
    if (seen.has(k)) return true;
    seen.add(k); return false;
  });
  ok(dup.length === 0, `rule ${i}: no duplicate edge`, dup);
});

console.log(bad ? `\n${bad} assertion(s) failed` : "\nall rule-graph assertions pass");
