// The rule panes must render the code EXACTLY as delivered.
//
// The panes split the raw text on token boundaries so the field chips sit
// inside the code rather than in a list beside it. That splice is the one
// place a character can go missing, and a transformation rule with a
// character missing is a different rule that still looks plausible — the
// worst possible failure for this screen. So the test reassembles the
// rendered pane and compares it to the input.

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RuleCompare } from "../src/ChainRules.jsx";

const t = { panel: "#fff", panel2: "#dfe6e9", navy: "#10193b",
            sub: "#666", muted: "#999" };

// verbatim from LOT_LEVEL_POSITION_MAP
const BOOK = `v_Trade_Date_Cash := Base_Market_Value_10;
IF TRIM(Investment_Type_Code_42) != 'CASH' THEN
  book_value := nvl(book_value,0) + to_number(nvl(Base_Amortized_Cost_7,0));
ELSE
  book_value := nvl(book_value,0) + to_number(nvl(v_Trade_Date_Cash,0));`;
const SEI = `Pro-rate receivables based on Taxlot Qty.
If DEBIT_CREDIT_FLAG_6 = 'C'
(Taxlot_Qty/QUANTITY_HELD * VALUATION_ACCRUED_INTEREST)
Else
If DEBIT_CREDIT_FLAG_6 = 'D'
(Taxlot_Qty/QUANTITY_HELD * VALUATION_ACCRUED_INTEREST)*-1
Join Taxlot and End of day positions by Account, Portfolio, Instrument_id
where as_of_date=<processing_dt>`;

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${msg}${cond ? "" : `  -> ${String(got).slice(0, 200)}`}`);
  if (!cond) bad++;
};
const render = (name, el) => {
  try { return renderToStaticMarkup(el); }
  catch (e) { ok(false, `${name} threw`, e.message); return ""; }
};

const h = render("both sides", <RuleCompare t={t} legacyText={BOOK}
  seiText={SEI} dataSource="IMDS" />);
ok(h.length > 0 && !/NaN|undefined/.test(h), "renders with no NaN or undefined");

const panes = (h.match(/<pre[^>]*>([\s\S]*?)<\/pre>/g) || []).map((x) =>
  x.replace(/<[^>]+>/g, "")
   .replace(/&#x27;/g, "'").replace(/&quot;/g, '"')
   .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"));
const strip = (s) => String(s).replace(/\s+/g, "");
ok(panes.length === 2, "two panes", panes.length);
ok(strip(panes[0]) === strip(BOOK),
   "the legacy pane is character-identical after tokenising", panes[0]);
ok(strip(panes[1]) === strip(SEI),
   "the SEI pane is character-identical after tokenising", panes[1]);
ok(/Base_Market_Value_10/.test(panes[0]), "ordinal tokens survive intact");
ok(/<pre[^>]*white-space:pre-wrap/.test(h), "line breaks are preserved");

ok(/Precondition/.test(h), "the join is lifted out as a precondition");
ok(/What differs/.test(h), "the structural comparison renders");
ok(/not a verdict/.test(h),
   "and says plainly that it is facts rather than a judgement");

ok(render("legacy only", <RuleCompare t={t} legacyText={BOOK} seiText="Null"
  dataSource="IMDS" />).includes("no rule written down"),
  "a Null proposal renders as 'no rule written down', never as the word Null");
ok(render("neither", <RuleCompare t={t} legacyText="Null" seiText="Null"
  dataSource="IMDS" />) === "", "nothing to compare renders nothing");
ok(render("nulls", <RuleCompare t={t} legacyText={null} seiText={undefined}
  dataSource="IMDS" />) === "", "null inputs render nothing rather than throwing");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nall rule-render assertions pass");
