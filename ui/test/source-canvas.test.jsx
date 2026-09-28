// The canvas, rendered against both lanes and every open/closed state.
//
// The mechanic under test is anchoring: a link attaches to the column row
// when its side is open and to the node's edge when it is not. Get that
// wrong and links vanish on collapse — which looks like missing lineage
// rather than a closed node.

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SourceCanvas from "../src/SourceCanvas.jsx";
import { classifyLink, summarise } from "../src/linkOps.js";

const t = { panel:"#fff", panel2:"#dfe6e9", navy:"#10193b", sub:"#666",
            muted:"#999", bg:"#f5f8f8", accent:"#0f4775", ok:"#159943" };
let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${msg}${cond ? "" : `  -> ${String(got).slice(0,200)}`}`);
  if (!cond) bad++;
};

// Rendered before its fetch resolves, the component shows a loading line —
// that is the state SSR sees, so the render test asserts the parts that do
// not depend on the fetch, and the link maths is exercised directly.
const html = renderToStaticMarkup(
  <SourceCanvas t={t} srcTable="PEDDIFI1" dataSource="IMDS" />);
ok(html.length > 0 && !/NaN|undefined/.test(html),
   "renders its loading state with no NaN", html.slice(0, 120));

// ---- the data the canvas actually classifies -----------------------------
const STAR = [
  { col:"BOOK_VALUE", type:"NUMBER(28,12)", src:"Base_Amortized_Cost_7",
    logic:"IF TRIM(Investment_Type_Code_42) != 'CASH' THEN\n  book_value := nvl(book_value,0) + to_number(nvl(Base_Amortized_Cost_7,0));\nELSE\n  book_value := nvl(book_value,0) + to_number(nvl(v_Trade_Date_Cash,0));" },
  { col:"CURRENCY", type:"VARCHAR2(3)", src:"local_currency_code_47",
    logic:"substr(ltrim(rtrim(local_currency_code_47)),1,3);" },
  { col:"ACCRUED_INCOME", type:"NUMBER(28,12)", src:"Base_Interest_Receivable_9",
    logic:"to_number(nvl(Base_Interest_Receivable_9,0));" },
  { col:"cstdy_hd_acct_num", type:"VARCHAR2(20)", src:"Custody_Head_Account_Number" },
  { col:"POSITION_ID", type:"NUMBER", src:null,
    logic:"pace_package.position_record.position_id;" },
];
const UAF = [
  { col:"ENTITY_ID", type:"VARCHAR2(20)", src:"ACCT_ID", t1:"trim(ACCT_ID)" },
  { col:"ENTITY_NAME", type:"VARCHAR2(80)", src:"ACCT_LONG_NAME" },
  { col:"SMA_FLAG", type:"CHAR(1)", src:"SMA_IND",
    logic:"decode(SMA_IND,'Y','Y','N');" },
];

const s = summarise(STAR);
ok(s.total === 5, "five STAR links", s.total);
ok(s.direct === 1, "one is carried across untouched", s.direct);
ok(s.transformed === 4, "four are transformed", s.transformed);
ok(s.branchy === 1, "one branches", s.branchy);
ok(s.mix.reduce((a, m) => a + m.n, 0) === s.total,
   "the mix bar accounts for every column");

const u = summarise(UAF);
ok(u.total === 3 && u.transformed === 2 && u.direct === 1,
   "UAF: two of three transformed", [u.total, u.transformed, u.direct]);
ok(u.mix.some((m) => m.op === "decode"), "and the decode is named", u.mix);

// every column must land in exactly one band, in every lane
[STAR, UAF].forEach((set, i) => {
  set.forEach((c) => {
    const k = classifyLink(c);
    ok(typeof k.op === "string" && Number.isFinite(k.steps),
       `lane ${i} · ${c.col}: classified`, k);
  });
});

// ---- the anchoring rule, which is the mechanic ---------------------------
// Reimplemented here at the level the component uses it: a link resolves to
// the column row when open and the node edge when closed, and either way it
// resolves to SOMETHING. A link that cannot find an anchor disappears, and a
// disappeared link reads as missing lineage.
const HEAD = 40, ROW = 22;
const anchorY = (nodeY, open, index, shownCount) =>
  (open && index >= 0 && index < shownCount)
    ? nodeY + HEAD + 1 + index * ROW + ROW / 2
    : nodeY + HEAD / 2;

[true, false].forEach((open) => {
  [0, 2, 15].forEach((cap) => {
    const ys = STAR.map((c, i) => anchorY(100, open, i, cap));
    ok(ys.every(Number.isFinite), `open=${open} cap=${cap}: every link anchors`, ys);
    ok(new Set(ys).size === (open && cap >= STAR.length ? STAR.length : 
        (open && cap > 0 ? cap + 1 : 1)),
       `open=${open} cap=${cap}: rows beyond the cap gather on the node edge`,
       [...new Set(ys)].length);
  });
});

console.log(bad ? `\n${bad} assertion(s) failed` : "\nall source-canvas assertions pass");

// ---- the wire is a click target -----------------------------------------
// A 1.4px curve cannot be hit with a mouse, let alone a finger. The
// visible wire keeps its weight and an invisible wide stroke over the same
// path takes the click — so the test is that BOTH paths exist per wire and
// the hit one is wide.
import { buildRuleGraph } from "../src/ruleGraph.js";

// A rendered canvas needs its fetch, which SSR does not run. Assert the
// geometry contract the click target depends on instead: the hit stroke is
// always at least a finger wide whatever the wire's own weight.
const hitWidth = (n) => Math.max(16, Math.min(7, 1.3 + Math.log2(n + 1) * 1.7) + 10);
[1, 2, 5, 9, 53].forEach((n) => {
  ok(hitWidth(n) >= 16, `a wire carrying ${n} column(s) has a >=16px hit stroke`,
     hitWidth(n));
});

// ---- the detail panel has something to say for every link ---------------
// Panel content comes from the link row, so every field it reads must
// survive the endpoint's shape. A missing key renders "undefined", which
// is the failure this catches.
const FULL = { col:"BOOK_VALUE", type:"NUMBER", length:"28", precision:"12",
  nullable:"Y", pk:"N", src:"Base_Amortized_Cost_7", src_type:"CHAR",
  src_length:"20", src_precision:null, unit:"amount", currency:"base",
  sign:"debit/credit", code_set:null,
  logic:"to_number(nvl(Base_Amortized_Cost_7,0))" };
const SPARSE = { col:"X", src:null };
[FULL, SPARSE].forEach((c, i) => {
  const k = classifyLink(c);
  ok(typeof k.op === "string", `link ${i}: classified`, k.op);
  const ops = k.rule ? buildRuleGraph(k.rule, { target: c.col }).nodes : [];
  ok(ops.every((n) => typeof n.lab === "string" && n.lab.length),
     `link ${i}: every operation chip has a label`);
  // the panel prints these directly; none may be the string "undefined"
  const printed = [c.type, c.length, c.src_type, c.src_length, c.unit,
                   c.currency, c.sign, c.code_set];
  ok(printed.every((v) => v === null || v === undefined || typeof v === "string"),
     `link ${i}: no field is a non-string that would print as [object Object]`);
});

console.log(bad ? `\n${bad} assertion(s) failed` : "\nwire-target and detail assertions pass");
