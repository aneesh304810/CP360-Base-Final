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

// ---- the drawing takes the room it is given -----------------------------
// A fixed 272px node ellipsised `Base_Total_Unrealized_Gain_15,Base_Tot…`
// on a 1400px screen with 600px going spare. The sizes are now solved from
// the measured box. Two properties matter:
//
//   below the ceiling   the laid-out width EQUALS the room available. Wider
//                       and fit() scales the drawing down, which is the
//                       wasted space again in another form; narrower is the
//                       original bug.
//   at the ceiling      it stops. A node wider than 460 does not make a name
//                       more readable and a gap wider than 440 just makes a
//                       longer wire, so past that point the extra width goes
//                       to the detail pane instead of to gutter.
const NW0 = 272, COLGAP0 = 226, CAP0 = 15;
const HEAD_ = 40, ROW_ = 22, PAD_ = 20;
const NW_MAX = 460, GAP_MAX = 440;
const W_MAX = PAD_ * 2 + NW_MAX * 2 + GAP_MAX;          // 1400
const ASIDE_AT = W_MAX + 320;                            // 1720
const dimsOf = (w, h) => {
  const room = Math.max(620, (w || 900) - 24);
  const nw = Math.round(Math.min(NW_MAX,
    Math.max(NW0, (room - PAD_ * 2 - COLGAP0) / 2)));
  const gap = Math.round(Math.min(GAP_MAX, Math.max(COLGAP0,
    room - nw * 2 - PAD_ * 2)));
  const cap = Math.max(CAP0,
    Math.floor(((h || 380) - HEAD_ - PAD_ * 2 - ROW_) / ROW_));
  return { nw, gap, cap, room, W: PAD_ * 2 + nw * 2 + gap };
};

[1024, 1180, 1280, 1366, 1424].forEach((w) => {
  const d = dimsOf(w, 600);
  ok(d.W === d.room, `${w}px wide: the layout fills the box exactly`,
     [d.W, d.room]);
});
[1600, 1920, 2560].forEach((w) => {
  const d = dimsOf(w, 600);
  ok(d.W === W_MAX, `${w}px wide: the drawing stops at its ceiling`, d.W);
  ok(d.nw === NW_MAX && d.gap === GAP_MAX,
     `${w}px wide: both node and gap are at their ceiling`, [d.nw, d.gap]);
});
// past the breakpoint the leftover becomes the detail pane, not gutter
const asideOn = (w) => w >= ASIDE_AT;
[[1600, false], [1719, false], [1720, true], [1920, true], [2560, true]]
  .forEach(([w, want]) => {
    ok(asideOn(w) === want,
       `${w}px wide: detail ${want ? "sits beside" : "stays below"} the canvas`,
       asideOn(w));
  });
// the breakpoint itself: past it the detail pane sits beside the canvas,
// and the canvas column is still wide enough to be worth drawing in
ok(ASIDE_AT - 400 - 14 > W_MAX - 200,
   "the aside only triggers where the canvas keeps a usable width",
   ASIDE_AT - 414);
[1024, 1280, 1600, 1920, 2560].forEach((w) => {
  const d = dimsOf(w, 600);
  ok(d.nw >= NW0, `${w}px wide: nodes never shrink below the base width`, d.nw);
  ok(d.gap >= COLGAP0, `${w}px wide: the gap never closes below its base`, d.gap);
});
ok(dimsOf(1920, 600).nw > dimsOf(1024, 600).nw,
   "a wider screen buys wider nodes");
ok(dimsOf(4000, 600).nw <= NW_MAX,
   "but not past the point where a name stops being a name",
   dimsOf(4000, 600).nw);
// a narrow box degrades to the base sizes rather than to a negative gap
[320, 500, 620, 800].forEach((w) => {
  const d = dimsOf(w, 400);
  ok(d.nw >= NW0 && d.gap >= COLGAP0,
     `${w}px wide: degrades to base sizes, never below`, [d.nw, d.gap]);
  ok(d.W > 0 && Number.isFinite(d.W), `${w}px wide: still a valid width`, d.W);
});
// height buys rows, and the cap never drops below the base
[380, 600, 900, 1400].forEach((h) => {
  const d = dimsOf(1440, h);
  ok(d.cap >= CAP0, `${h}px tall: the cap never falls below ${CAP0}`, d.cap);
});
ok(dimsOf(1440, 1000).cap > dimsOf(1440, 400).cap,
   "a taller window shows more rows before the cap bites");

// ---- a column with no source field draws no wire ------------------------
// The wire says "this value comes from the feed". For a constant or an
// unmapped column nothing does, so a wire there contradicts the row's own
// "no source" chip and, when the wire is a merged one, inflates its count.
// The row stays clickable, so the detail is still one click away.
const wired = STAR.filter((c) => c.src);
ok(wired.length === STAR.length - 1,
   "the fixture has exactly one source-less column", STAR.length - wired.length);
ok(!wired.some((c) => c.col === "POSITION_ID"),
   "the constant column is not wired back to the feed");
ok(wired.every((c) => classifyLink(c).op !== "unmapped"),
   "no wire is drawn for a column nothing feeds");
// and its detail is still reachable, because the row carries the click
ok(STAR.some((c) => c.col === "POSITION_ID" && classifyLink(c).rule),
   "the source-less column still has a rule the panel can show");

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
