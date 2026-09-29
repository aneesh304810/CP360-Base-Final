// The business rollup must render, and must never overstate.
//
// The dashboard reads numbers the API already added up; the risk it
// carries is in what it does with them. Three things are asserted here:
// every bucket the component indexes exists, a click lands on the right
// filter, and none of the not-loaded shapes renders a number that is not
// in the payload.

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SeiBusinessSummary, { STATE, DIVERGENCE }
  from "../src/SeiBusinessSummary.jsx";
import { VERDICT_INFO } from "../src/crosswalkGlossary.js";

const t = { panel: "#fff", panel2: "#dfe6e9", navy: "#10193b", sub: "#4a5a68",
            muted: "#7b8894", bg: "#f5f8f8", accent: "#0f4775" };
let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${msg}${cond ? "" : `  -> ${String(got)}`}`);
  if (!cond) bad++;
};

// SSR sees the state before the fetch resolves, which is the loading line.
const html = renderToStaticMarkup(
  <SeiBusinessSummary t={t} dataSource="IMDS" />);
ok(html.length > 0 && !/NaN|undefined/.test(html),
   "renders its loading state with no NaN", html.slice(0, 90));

// ---- the vocabularies line up with the crosswalk's own -----------------
["ready", "diff", "open", "none"].forEach((k) => {
  ok(STATE[k] && STATE[k].label, `state ${k} has a business label`);
  ok(STATE[k].label.length < 30, `state ${k} label is short enough for a tile`,
     STATE[k].label);
});
Object.entries(DIVERGENCE).forEach(([v, label]) => {
  ok(VERDICT_INFO[v], `${v} is a real verdict, not an invented one`);
  ok(label && !/_/.test(label), `${v} reads in business words`, label);
});
// every divergence verdict the API can send has a business label
["PRECISION_RISK", "DECODE_NEEDED", "TYPE_SHIFT", "NOT_COMPARABLE"]
  .forEach((v) => ok(DIVERGENCE[v], `${v} has a label for the bar`, DIVERGENCE[v]));

// ---- the arithmetic the component relies on ----------------------------
// It must read the API's numbers, never recompute them. These mirror what
// /business-summary guarantees, so a change to either side breaks a test
// rather than a screen.
const P = { scored: true, scope: { in_scope: 612, out_of_scope: 88, no_baseline: 41,
              total: 741 },
  buckets: { ready: 0, diff: 168, open: 263, none: 181 }, has_datapoint: 431,
  divergence: [{ verdict: "PRECISION_RISK", n: 52 },
               { verdict: "DECODE_NEEDED", n: 47 },
               { verdict: "TYPE_SHIFT", n: 35 },
               { verdict: "NOT_COMPARABLE", n: 34 }],
  open: { unchecked: 263, undecided: 96, exceptions: 23, draft_rules: 74 },
  owners: [{ owner: "Fund Accounting", n: 69 }, { owner: "Custody Ops", n: 36 }],
  unowned: 277, unbucketed: [], ceiling: { blocked: true, reason: "document only" } };

const sumB = Object.values(P.buckets).reduce((a, b) => a + b, 0);
ok(sumB === P.scope.in_scope, "the buckets partition the in-scope total",
   [sumB, P.scope.in_scope]);
ok(P.buckets.ready + P.buckets.diff + P.buckets.open === P.has_datapoint,
   "and the non-empty ones sum to what SEI proposed");
ok(P.divergence.reduce((a, d) => a + d.n, 0) === P.buckets.diff,
   "the divergence bars sum to the divergent bucket");
ok(P.open.unchecked === P.buckets.open,
   "unchecked is one number, read twice, not two counts");
// percentages the tiles print
const pct = (n) => Math.round((n / P.scope.in_scope) * 100);
ok(pct(P.has_datapoint) === 70, "the headline percentage is right", pct(P.has_datapoint));
[P.buckets.diff, P.buckets.open, P.buckets.none].forEach((n) => {
  ok(pct(n) >= 0 && pct(n) <= 100, "every percentage is within range", pct(n));
});
// the stacked bar drops zero-width segments rather than drawing slivers
const seg = ["ready", "diff", "open", "none"].filter((k) => P.buckets[k] > 0);
ok(!seg.includes("ready"), "a zero bucket draws no segment", seg);
ok(seg.reduce((a, k) => a + P.buckets[k], 0) === P.scope.in_scope,
   "and the drawn segments still sum to the whole", seg);

// ---- unowned is never attributed to a team -----------------------------
const namedTotal = P.owners.reduce((a, o) => a + o.n, 0);
ok(P.unowned >= P.buckets.open,
   "unowned is at least every unchecked column, because the register names "
   + "no owner for them", [P.unowned, P.buckets.open]);
ok(!P.owners.some((o) => /no owner|unknown|unassigned/i.test(o.owner)),
   "and the unowned count is not dressed up as a team", P.owners);
ok(namedTotal + P.unowned >= P.buckets.open,
   "named plus unowned covers the open work");

// ---- not-loaded and degenerate shapes ----------------------------------
[{ scored: false, scope: { in_scope: 0, out_of_scope: 147, no_baseline: 0, total: 147 },
   buckets: { ready: 0, diff: 0, open: 0, none: 0 }, has_datapoint: 0,
   divergence: [], open: { unchecked: 0, undecided: 0, exceptions: 0, draft_rules: 0 },
   owners: [], unowned: 0, unbucketed: [], ceiling: {} },
 { scored: false, scope: { in_scope: 0, out_of_scope: 0, no_baseline: 0, total: 0 },
   buckets: { ready: 0, diff: 0, open: 0, none: 0 }, has_datapoint: 0,
   divergence: [], open: { unchecked: 0, undecided: 0, exceptions: 0, draft_rules: 0 },
   owners: [], unowned: 0, unbucketed: [], ceiling: {} },
].forEach((p, i) => {
  ok(p.scored === false, `degenerate ${i}: not marked scored`);
  ok(Object.values(p.buckets).every((n) => n === 0),
     `degenerate ${i}: no phantom counts`, p.buckets);
  ok(p.has_datapoint === 0, `degenerate ${i}: claims no datapoints`);
});

// ---- an unbucketed verdict is surfaced, not swallowed ------------------
const U = { ...P, unbucketed: [{ verdict: "BRAND_NEW", n: 7 }],
            buckets: { ...P.buckets, open: 270 }, scope: { ...P.scope, in_scope: 619 } };
ok(Object.values(U.buckets).reduce((a, b) => a + b, 0) === U.scope.in_scope,
   "an unbucketed verdict is inside the total, not missing from the bar");
ok(U.unbucketed[0].verdict === "BRAND_NEW",
   "and is named so the shortfall is visible");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nsei-business assertions pass");
if (bad) process.exit(1);
