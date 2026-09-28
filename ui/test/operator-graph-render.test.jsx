// The component, rendered against every real rule.
//
// The parser and the layout are tested on their own; this checks that what
// they produce survives being drawn — no NaN in a style, every node and
// every edge present in the output, and the degenerate cases rendering
// something rather than throwing.

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import OperatorGraph from "../src/OperatorGraph.jsx";
import { buildComparisonGraph } from "../src/ruleGraph.js";

const t = { panel: "#fff", panel2: "#dfe6e9", navy: "#10193b",
            sub: "#666", muted: "#999", bg: "#f5f8f8", accent: "#0f4775" };

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${msg}${cond ? "" : `  -> ${String(got).slice(0,180)}`}`);
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

CASES.forEach(([name, legacy, sei]) => {
  let h = "";
  try {
    h = renderToStaticMarkup(<OperatorGraph t={t} legacyText={legacy}
      seiText={sei} target={name} dataSource="IMDS" />);
  } catch (e) { ok(false, `${name} threw`, e.message); return; }

  ok(h.length > 0, `${name}: renders`);
  ok(!/NaN|undefined|Infinity/.test(h), `${name}: no NaN, undefined or Infinity`,
     (h.match(/.{0,40}(NaN|undefined|Infinity).{0,40}/) || [])[0]);

  const g = buildComparisonGraph(legacy, sei, name);
  // every node's label must appear in the markup — a node laid out and
  // not drawn is the failure this catches
  const missing = g.nodes.filter((n) => {
    const esc = n.lab.replace(/&/g,"&amp;").replace(/</g,"&lt;")
                     .replace(/>/g,"&gt;").replace(/"/g,"&quot;")
                     .replace(/'/g,"&#x27;");
    return !h.includes(esc);
  });
  ok(!missing.length, `${name}: every node is drawn`, missing.map((n) => n.lab));

  const paths = (h.match(/<path /g) || []).length;
  ok(paths >= g.edges.length, `${name}: every edge is drawn`,
     [paths, g.edges.length]);

  ok(h.includes("Today · STAR") && (sei.trim().toLowerCase() === "null"
       || h.includes("Proposed · SEI")),
     `${name}: both track bands are labelled`);
});

// ---- degenerate ---------------------------------------------------------
[["", ""], ["Null", "Null"], [null, undefined]].forEach(([a, b], i) => {
  let threw = false, h = "";
  try { h = renderToStaticMarkup(<OperatorGraph t={t} legacyText={a}
    seiText={b} target="X" dataSource="IMDS" />); } catch { threw = true; }
  ok(!threw, `degenerate case ${i} does not throw`);
  ok(!/NaN/.test(h), `degenerate case ${i} has no NaN`);
});

console.log(bad ? `\n${bad} assertion(s) failed` : "\nall operator-graph render assertions pass");
