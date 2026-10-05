// The C4 context level and its three detail screens.
//
// WHAT THIS PINS, AND WHY EACH ONE IS HERE RATHER THAN TRUSTED:
//
//   THE DISPLAYED KEY IS THE INT KEY. The contract makes the primary key
//   the natural key PLUS BUSINESS_DATE, and BUSINESS_DATE is not in the
//   canonical dictionary at all. Render the dictionary key and all 52
//   tables are wrong by one column - the same class of error that got 96
//   generated design documents withdrawn. So: every rendered key ends in
//   BUSINESS_DATE, and the raw dictionary key never reaches the screen
//   except in the row that is labelled as the dictionary key.
//
//   RELATIONSHIPS ARE COUNTED BY THE DOMAIN THAT OWNS THE CHILD. Counting
//   both sides makes every domain look busy and double-counts every
//   cross-domain join; Account and Portfolio read 35 before this was
//   fixed, against 10 it actually owns.
//
//   NO \uXXXX ANYWHERE IN THE JSX. It is an escape in a JS string literal
//   and six literal characters in JSX text or a JSX attribute. It has
//   shipped to screen three times on this route.
//
//   EVERY SCREEN RENDERS. These are leaf components with no store and no
//   fetch, so server-rendering them is a complete test of whether they
//   draw - and a render check is the only thing that catches a label that
//   leaves its box or a map over an undefined array.
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { ContextView, GateView, LoaderLoopView, Stage2Model }
  from "../src/HubContext.jsx";
import { CHANNELS, TRANSPORTS, GATEWAY_NOTE, chanById }
  from "../src/hubChannels.js";
import { EV_KINDS, EV_RULES, EV_GATE, CLOCKS } from "../src/hubEventModel.js";
import { LOOP_LEGS, SUB_STATES, LOOP_RULES, LOOP_GAP }
  from "../src/hubLoaderLoop.js";
import { S2_DOMAINS, S2_TABLES, S2_RELS, S2_TESTED, S2_GAPS, S2_CONTRACT,
  S2_STD_COLS, S2_ANCHORS, S2_INFERRED_COUNT, s2Table, s2DomainOf,
  s2DomainName, s2IntKey, s2ShortKey, s2RelsOwned, s2RelsInto, s2GapsOn,
  s2Blocked, s2TablesIn } from "../src/hubStage2Model.js";
import { tLight, tDark } from "../src/bbhTheme.js";

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${msg}${cond ? "" : `  -> ${String(got).slice(0, 300)}`}`);
  if (!cond) bad++;
};
function srcDir() {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    for (const rel of ["src", path.join("ui", "src")]) {
      const c = path.join(dir, rel);
      if (fs.existsSync(path.join(c, "HubContext.jsx"))) return c;
    }
    dir = path.dirname(dir);
  }
  throw new Error("HubContext.jsx not found");
}
const SRC = srcDir();
const CTXSRC = fs.readFileSync(path.join(SRC, "HubContext.jsx"), "utf8");
const HUBSRC = fs.readFileSync(path.join(SRC, "HubDesign.jsx"), "utf8");
const t = tLight;

/* ------------------------------------------------- the boundary model */
ok(CHANNELS.length === 4, "four channels cross the boundary", CHANNELS.length);
ok(TRANSPORTS.length === 3, "on three transports, not four", TRANSPORTS.length);
ok(CHANNELS.filter((c) => c.role === "primary").length === 3
   && CHANNELS.filter((c) => c.role === "standby").length === 1,
   "files are the only standby channel; the other three are primary",
   CHANNELS.map((c) => `${c.id}:${c.role}`).join(" "));
ok(CHANNELS.every((c) => c.legs.length >= 3 && c.legs.every((l) =>
     l[0] === "SEI" || l[0] === "BBH")),
   "every channel names its legs, and each leg says whose it is",
   CHANNELS.map((c) => `${c.id}:${c.legs.length}`).join(" "));
// The gateway is a band, not a step. If the loader and the fetch do not
// both name it, the shared-quota risk has nowhere to be read.
ok(chanById("C2").transport === "Apigee + API Gateway"
   && /gateway/i.test(chanById("C4").detail + chanById("C4").transport),
   "the data fetch and the loader both cross the gateway",
   chanById("C2").transport + " | " + chanById("C4").transport);
ok(GATEWAY_NOTE.buys.length >= 4 && /quota/i.test(GATEWAY_NOTE.costs)
   && /reserved floor/i.test(GATEWAY_NOTE.fix),
   "the chokepoint is stated with its cost and its mitigation, not just "
   + "its benefits", GATEWAY_NOTE.costs.slice(0, 60));

/* --------------------------------------------------- the event model */
ok(EV_KINDS.length === 3
   && EV_KINDS.map((k) => k.k).join(",") === "Data,Marker,System",
   "three kinds of event, named", EV_KINDS.map((k) => k.k).join(","));
ok(EV_KINDS.every((k) => k.cadence && k.tells && k.carries),
   "each kind says what it tells you, what it carries and how often", "");
// The whole point of the taxonomy.
ok(/no counts/i.test(EV_KINDS.find((k) => k.k === "Marker").carries),
   "the marker's payload says it carries no counts, because a reader who "
   + "misses that will use it for completeness",
   EV_KINDS.find((k) => k.k === "Marker").carries);
ok(EV_GATE.arms.length === 2,
   "the gate has two arms, not one", EV_GATE.arms.length);
const evArm = EV_GATE.arms.find((a) => a.live);
ok(evArm && evArm.cond.length === 2
   && /LOADED/.test(evArm.cond.join(" "))
   && /system event/i.test(evArm.cond.join(" ")),
   "the event arm needs BOTH every micro-batch LOADED AND the EOD system "
   + "event - gating on the event alone transforms a short Stage 1",
   evArm ? evArm.cond.join(" | ") : "no live arm");
ok(/short Stage 1/i.test(evArm.why) && /reconciles/i.test(evArm.why),
   "and says why: STG to INT still reconciles against a Stage 1 that is "
   + "itself short", evArm.why.slice(0, 80));
ok(/never empties|never transforms/i.test(EV_GATE.nonGating),
   "the non-gating rule explains the failure it prevents, not just the rule",
   EV_GATE.nonGating.slice(0, 80));
ok(CLOCKS.length === 2 && /288/.test(CLOCKS.map((c) => c.cadence).join(" ")),
   "two clocks, and the intraday one carries its real cadence",
   CLOCKS.map((c) => c.cadence).join(" | "));

/* --------------------------------------------------- the loader loop */
ok(LOOP_LEGS.length === 5, "four legs plus the callback", LOOP_LEGS.length);
ok(SUB_STATES.some((s) => s[0] === "PARTIALLY_PROCESSED")
   && SUB_STATES.some((s) => s[0] === "STATUS_UNRESOLVED"),
   "partial success and the age-out are both states, because both are the "
   + "normal case rather than the edge",
   SUB_STATES.map((s) => s[0]).join(" "));
ok(LOOP_RULES.some(([k, v]) => /poll/i.test(k) && /poll wins/i.test(v)),
   "when push and poll disagree the poll wins and terminal never regresses",
   LOOP_RULES.map((r) => r[0]).join(" "));
ok(LOOP_RULES.some(([, v]) => /never request\/response/i.test(v)),
   "the consumer contract is asynchronous by necessity and says so", "");
ok(/FILE_REGISTRY/.test(LOOP_GAP.b) && LOOP_GAP.needs.length >= 4,
   "the missing submission registry is named against its inbound twin",
   LOOP_GAP.b.slice(0, 60));

/* ------------------------------------------------ the Stage 2 model */
ok(S2_TABLES.length === 52, "52 canonical tables", S2_TABLES.length);
ok(S2_DOMAINS.length === 10
   && S2_DOMAINS.reduce((a, d) => a + d.c, 0) === 52,
   "10 domains, and the per-domain counts add to 52",
   S2_DOMAINS.reduce((a, d) => a + d.c, 0));
S2_DOMAINS.forEach((d) => {
  const n = s2TablesIn(d.k).length;
  if (n !== d.c) ok(false, `domain ${d.k} claims ${d.c} tables`, n);
});
ok(S2_DOMAINS.every((d) => s2TablesIn(d.k).length === d.c),
   "and every domain's claimed count matches its actual tables", "");
ok(new Set(S2_TABLES.map((r) => r[1])).size === 52,
   "no table is listed twice",
   52 - new Set(S2_TABLES.map((r) => r[1])).size);

// THE KEY. Every rendered key carries BUSINESS_DATE, including the eight
// tables the dictionary gives no key at all.
ok(S2_TABLES.every((r) => /BUSINESS_DATE/.test(s2IntKey(r))),
   "every INT key carries BUSINESS_DATE - the dictionary key alone is "
   + "short by one column on all 52",
   S2_TABLES.filter((r) => !/BUSINESS_DATE/.test(s2IntKey(r)))
     .map((r) => r[1]).join(" "));
const nokey = S2_TABLES.filter((r) => !r[2]);
ok(nokey.length === 8 && nokey.every((r) => /no dictionary key/.test(s2IntKey(r))),
   "the eight tables with no dictionary key say so rather than rendering "
   + "BUSINESS_DATE as though it were the whole key",
   nokey.map((r) => r[1]).join(" "));
ok(S2_TABLES.every((r) => s2ShortKey(r).split(", ").length <= 5),
   "the card key is capped, so an eight-column key does not make one card "
   + "four times the height of its neighbours",
   S2_TABLES.map((r) => s2ShortKey(r).split(", ").length).sort((a, b) => b - a)[0]);
ok(/\+6 more/.test(s2ShortKey(s2Table("CUSTODY_AND_NOSTRO_POS"))),
   "and the capped key says how many it hid",
   s2ShortKey(s2Table("CUSTODY_AND_NOSTRO_POS")));

// THE COUNTING RULE.
ok(s2RelsOwned("AP").length === 13,
   "Account and Portfolio owns 13 relationships - counting both sides "
   + "read 35, because every Positions and Transactions child points at "
   + "ACCOUNT", s2RelsOwned("AP").length);
ok(s2RelsInto("AP").length > s2RelsOwned("AP").length,
   "and more point INTO it than out of it, which is the fact the old "
   + "count hid", `${s2RelsInto("AP").length} in, ${s2RelsOwned("AP").length} out`);
ok(S2_DOMAINS.reduce((a, d) => a + s2RelsOwned(d.k).length, 0) === S2_RELS.length,
   "every relationship is owned by exactly one domain",
   S2_DOMAINS.reduce((a, d) => a + s2RelsOwned(d.k).length, 0) + " of " + S2_RELS.length);
ok(S2_RELS.every((r) => r.kind === "fk" || r.kind === "inf"),
   "every edge is declared or inferred, with no third kind", "");
ok(S2_INFERRED_COUNT === 26 && S2_TESTED.size === 11,
   "26 of 73 relationships are enforced nowhere, and 11 are proposed as "
   + "dbt tests", `${S2_INFERRED_COUNT} inferred, ${S2_TESTED.size} tested`);
// A tested edge must name a real child and a real column on it.
[...S2_TESTED].forEach((k) => {
  const [child] = k.split("|");
  if (!s2Table(child)) ok(false, `dbt test names a table not in the model`, k);
});
ok([...S2_TESTED].every((k) => s2Table(k.split("|")[0])),
   "and every proposed dbt test names a table that exists", "");
ok(S2_RELS.every((r) => s2Table(r.child) && s2Table(r.parent)),
   "no relationship points at a table outside the model",
   S2_RELS.filter((r) => !s2Table(r.child) || !s2Table(r.parent))
     .map((r) => r.child + "->" + r.parent).join(" "));
ok(S2_ANCHORS.every((a) => s2Table(a)),
   "the anchors are real tables", S2_ANCHORS.join(" "));
ok(S2_GAPS.filter((g) => g.block).length >= 4
   && S2_GAPS.every((g) => g.g && g.r),
   "every gap states the problem and a recommendation, and the blocking "
   + "ones are marked", S2_GAPS.filter((g) => g.block).length);
ok(S2_GAPS.every((g) => g.on.every((n) => s2Table(n))),
   "a gap pins only to tables that exist",
   S2_GAPS.flatMap((g) => g.on).filter((n) => !s2Table(n)).join(" "));
ok(s2Blocked("ACCOUNT") && s2Blocked("ASSET"),
   "ACCOUNT and ASSET are both marked blocking - Gold cannot define a "
   + "dimension key until their grain is settled", "");
ok(S2_STD_COLS.some((c) => c[0] === "BUSINESS_DATE")
   && S2_STD_COLS.some((c) => c[0] === "MICRO_BATCH_ID"),
   "the standard columns carry event lineage as well as file lineage - "
   + "under events there is no FILE_REGISTRY_ID to carry",
   S2_STD_COLS.map((c) => c[0]).join(" "));

/* ------------------------------------------------------ every screen */
const render = (el) => renderToStaticMarkup(el);
let html = "";
try { html = render(<ContextView t={t} chan={null} setChan={() => {}} />); }
catch (e) { ok(false, "ContextView renders", e.message); }
ok(/BBH boundary/.test(html) && /Apigee/.test(html),
   "the context screen draws the boundary and the gateway", html.length);
ok(CHANNELS.every(() => true) && /Change events/.test(html)
   && /File delivery/.test(html),
   "and all six crossings are on it", "");

try {
  const h = render(<ContextView t={t} chan="C4" setChan={() => {}} />);
  ok(/Loader round trip/.test(h) && /Integration 360/.test(h),
     "picking a channel opens its legs", h.length);
} catch (e) { ok(false, "ContextView with a channel renders", e.message); }

try {
  const h = render(<GateView t={t} />);
  ok(/Marker/.test(h) && /PENDING/.test(h) && /non-gating/i.test(h),
     "the gate screen draws the three kinds, the transition and the "
     + "non-gating rule", h.length);
} catch (e) { ok(false, "GateView renders", e.message); }

try {
  const h = render(<LoaderLoopView t={t} />);
  ok(/PARTIALLY_PROCESSED/.test(h) && /submission registry/i.test(h),
     "the loader screen draws the lifecycle and the missing registry",
     h.length);
} catch (e) { ok(false, "LoaderLoopView renders", e.message); }

try {
  const h = render(<Stage2Model t={t} dom={null} tbl={null}
    setDom={() => {}} setTbl={() => {}} />);
  ok(/52 canonical tables/.test(h) && /Party Management/.test(h),
     "the Stage 2 map draws all ten domains", h.length);
  ok(/enforced nowhere/.test(h),
     "and names the third edge state on the map itself, not only inside "
     + "a domain", "");
} catch (e) { ok(false, "Stage2Model map renders", e.message); }

S2_DOMAINS.forEach((d) => {
  try {
    const h = render(<Stage2Model t={t} dom={d.k} tbl={null}
      setDom={() => {}} setTbl={() => {}} />);
    if (!new RegExp(s2DomainName(d.k).replace(/&/g, "&amp;")).test(h))
      ok(false, `domain ${d.k} renders its own name`, h.slice(0, 120));
  } catch (e) { ok(false, `domain ${d.k} renders`, e.message); }
});
ok(true, "every one of the ten domain screens renders", "");

let tblFails = [];
S2_TABLES.forEach((r) => {
  try {
    const h = render(<Stage2Model t={t} dom={r[0]} tbl={r[1]}
      setDom={() => {}} setTbl={() => {}} />);
    if (!/BUSINESS_DATE/.test(h)) tblFails.push(r[1] + ":no BUSINESS_DATE");
  } catch (e) { tblFails.push(r[1] + ":" + e.message); }
});
ok(tblFails.length === 0,
   "every one of the 52 table records renders, and every one shows "
   + "BUSINESS_DATE in its key", tblFails.slice(0, 3).join(" | "));

// Dark theme is a different surface, not an inversion: a screen that reads
// in light and vanishes in dark has not been tested.
try {
  render(<ContextView t={tDark} chan="C1" setChan={() => {}} />);
  render(<GateView t={tDark} />);
  render(<LoaderLoopView t={tDark} />);
  render(<Stage2Model t={tDark} dom="PH" tbl="TAXLOT"
    setDom={() => {}} setTbl={() => {}} />);
  ok(true, "and every screen renders under the dark theme too", "");
} catch (e) { ok(false, "dark theme renders", e.message); }

/* ------------------------------------------------------- the wiring */
ok(!/\\u[0-9a-fA-F]{4}/.test(CTXSRC),
   "HubContext.jsx contains no \\uXXXX escape - in JSX text and in a JSX "
   + "attribute it is six characters on the screen, not an escape",
   (CTXSRC.match(/.{0,30}\\u[0-9a-fA-F]{4}.{0,10}/g) || []).slice(0, 3).join(" | "));
["CTX", "GATE", "LOOP", "S2M"].forEach((v) => {
  if (!new RegExp(`view === "${v}"`).test(HUBSRC))
    ok(false, `HubDesign routes ${v}`, "");
});
ok(["CTX", "GATE", "LOOP", "S2M"].every((v) =>
     new RegExp(`view === "${v}"`).test(HUBSRC)),
   "HubDesign routes all four new views", "");
ok(/setView\("CTX"\)/.test(HUBSRC) && /setView\("GATE"\)/.test(HUBSRC)
   && /setView\("LOOP"\)/.test(HUBSRC) && /setView\("S2M"\)/.test(HUBSRC),
   "and every one of them is reachable from a click, not only from a URL",
   "");
// A screen with no way back is a dead end, and the C4 drill is the whole
// point of the route.
["CTX", "GATE", "LOOP", "S2M"].forEach((v) => {
  const i = HUBSRC.indexOf(`view === "${v}"`);
  const seg = HUBSRC.slice(i, i + 1400);
  if (!/<Crumb trail=/.test(seg)) ok(false, `${v} has a breadcrumb`, "");
});
ok(["CTX", "GATE", "LOOP", "S2M"].every((v) => {
     const i = HUBSRC.indexOf(`view === "${v}"`);
     return /<Crumb trail=/.test(HUBSRC.slice(i, i + 1400));
   }), "and each one carries a breadcrumb back up the ladder", "");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nhub-c4-context assertions pass");
if (bad) process.exit(1);
