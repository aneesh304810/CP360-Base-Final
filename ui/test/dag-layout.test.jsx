// The layout, against every graph the parser produces from the real rules.
//
// Layout maths fails silently: a node outside its band still renders, it
// is just somewhere nobody looks, and an edge running right to left still
// draws — it just makes the picture lie about which way the data moves.

import { buildRuleGraph, buildComparisonGraph } from "../src/ruleGraph.js";
import { layoutGraph, depths, NODE_W, NODE_H } from "../src/dagLayout.js";

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

const CASES = [
  ["ACCRUED_INCOME", "to_number(nvl(Base_Interest_Receivable_9,0));", SEI_ACCRUED],
  ["BOOK_VALUE", BOOK, "Null"],
  ["CURRENCY", "substr(ltrim(rtrim(local_currency_code_47)),1,3);",
   "Taxlot.LOCAL_CURRENCY"],
  ["TRADE_DATE",
   "pace_package.lot_level_position_record.trade_date := to_date(Trade_Date_128,'MM/DD/YYYY');",
   "Taxlot.TRADE_DATE"],
];

// ---- depth is the LONGEST path ------------------------------------------
// a diamond: A feeds B and C, both feed D. D must be at 2, not 1.
const dd = depths(
  [{id:"A"},{id:"B"},{id:"C"},{id:"D"}],
  [["A","B"],["A","C"],["B","D"],["C","D"]]);
ok(dd.get("A") === 0 && dd.get("D") === 2,
   "a diamond puts the join at depth 2, not 1", [...dd]);
// a long and a short path to the same node — the long one wins
const dl = depths([{id:"A"},{id:"B"},{id:"C"},{id:"Z"}],
  [["A","B"],["B","C"],["C","Z"],["A","Z"]]);
ok(dl.get("Z") === 3, "the longest path decides, not the shortest", [...dl]);
// a cycle must terminate rather than hang
let hung = false;
try { depths([{id:"A"},{id:"B"}], [["A","B"],["B","A"]]); } catch { hung = true; }
ok(!hung, "a cycle terminates instead of recursing forever");

// ---- every real graph lays out cleanly ----------------------------------
CASES.forEach(([name, legacy, sei]) => {
  const g = buildComparisonGraph(legacy, sei, name);
  const L = layoutGraph(g);
  const pos = new Map(L.nodes.map((n) => [n.id, n]));

  const nan = L.nodes.filter((n) => ![n.x, n.y, n.w, n.h].every(Number.isFinite));
  ok(!nan.length, `${name}: no NaN geometry`, nan.map((n) => n.lab));

  const out = L.nodes.filter((n) =>
    n.x < 0 || n.y < 0 || n.x + n.w > L.W + 1 || n.y + n.h > L.H + 1);
  ok(!out.length, `${name}: nothing outside the canvas`, out.map((n) => n.lab));

  let ov = 0;
  for (let i = 0; i < L.nodes.length; i++) {
    for (let j = i + 1; j < L.nodes.length; j++) {
      const A = L.nodes[i], B = L.nodes[j];
      if (A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h) ov++;
    }
  }
  ok(ov === 0, `${name}: no two nodes overlap`, ov);

  const back = g.edges.filter(([a, b]) => {
    const A = pos.get(a), B = pos.get(b);
    return A && B && A.x >= B.x;
  });
  ok(!back.length, `${name}: every edge runs left to right`,
     back.map(([a, b]) => `${pos.get(a).lab}>${pos.get(b).lab}`));

  const dangling = g.edges.filter(([a, b]) => !pos.has(a) || !pos.has(b));
  ok(!dangling.length, `${name}: no edge points at a node that was not placed`,
     dangling);

  // a node must sit inside its own track's band
  L.nodes.forEach((n) => {
    const b = L.bands.find((x) => x.track === n.track);
    if (!b) { ok(false, `${name}: ${n.lab} has no band`, n.track); return; }
    if (n.y < b.y - 1 || n.y + n.h > b.y + b.h + 1) {
      ok(false, `${name}: ${n.lab} sits outside its track band`,
         [n.y, n.h, b.y, b.h]);
    }
  });
  ok(true, `${name}: every node inside its track band`);

  // prose is parked at the right, never in the flow
  const prose = L.nodes.filter((n) => n.kind === "prose");
  prose.forEach((p) => {
    const flow = L.nodes.filter((n) => n.track === p.track && n.kind !== "prose");
    ok(flow.every((n) => n.x <= p.x),
       `${name}: prose sits to the right of the computation`, [p.lab, p.x]);
  });
});

// ---- degenerate input ----------------------------------------------------
ok(layoutGraph(null).nodes.length === 0, "null graph lays out to nothing");
ok(layoutGraph({ nodes: [], edges: [] }).W === 0, "empty graph has no width");
const one = layoutGraph(buildRuleGraph("Null", { target: "X" }));
ok(one.nodes.length === 1 && Number.isFinite(one.W) && one.H > 0,
   "a lone target still gets a band", [one.nodes.length, one.W, one.H]);

console.log(bad ? `\n${bad} assertion(s) failed` : "\nall dag-layout assertions pass");
