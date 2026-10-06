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
import { CHANNELS, LEGS, TRANSPORTS, HELD_TRANSPORTS, GATEWAY_NOTE,
  chanById, legById, legsOf, transportOf } from "../src/hubChannels.js";
import { EV_KINDS, EV_RULES, EV_GATE, CLOCKS } from "../src/hubEventModel.js";
import { LOOP_LEGS, SUB_STATES, LOOP_RULES, LOOP_GAP }
  from "../src/hubLoaderLoop.js";
import { S2_DOMAINS, S2_TABLES, S2_RELS, S2_TESTED, S2_GAPS, S2_CONTRACT,
  S2_STD_COLS, S2_ANCHORS, S2_INFERRED_COUNT, s2Table, s2DomainOf,
  s2DomainName, s2IntKey, s2ShortKey, s2RelsOwned, s2RelsInto, s2GapsOn,
  s2Blocked, s2TablesIn } from "../src/hubStage2Model.js";
import { FILE_CHAIN, FILE_VALIDATIONS, COUNT_RULE, FAIL_MODES, FILE_POSTURE }
  from "../src/hubFileIngestion.js";
import { S1_TABLES, S1_RULES, S1_COLS, S1_CONFLICT, S1_NOT_HERE, s1Both,
  s1ArchOnly } from "../src/hubStage1Model.js";
import { DB_PATH, DB_CONTROL, DB_ABSENT, DB_LINKS, DB_NOTE, dbNode }
  from "../src/hubDbModel.js";
import { FEEDS, RAW_TABLES, RAW_WITHOUT_FEED, FAN_OUT, FEED_SUMMARY }
  from "../src/hubFeedMap.js";
import { Stage1Model, DbModelView, Stage2Erd, Stage2Lineage, Stage2Feeds }
  from "../src/HubContext.jsx";
import { SEI_COMPONENTS, SEI_TABLES, SEI_STATES } from "../src/seiBaseline.js";
import { FileIngestionView } from "../src/HubContext.jsx";
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
// ONE TAXONOMY, THREE LEVELS. There were three and they did not line
// up - four channels, six hand-numbered lanes with one channel owning
// three of them, and three transports - which is why nobody could say
// what "channel 4" meant. A channel is a purpose; a leg is one directed
// hop inside it; a transport is a property of the leg. These assertions
// hold that apart, because the collapse back into one list is gradual
// and each step looks harmless.
ok(CHANNELS.length === 4, "four channels", CHANNELS.length);
ok(CHANNELS.every((c) => /^[A-D]$/.test(c.id)),
   "lettered, so a leg id carries its channel and A2 is unambiguous",
   CHANNELS.map((c) => c.id).join(""));
ok(LEGS.every((l) => chanById(l.ch)),
   "every leg belongs to a channel that exists",
   LEGS.filter((l) => !chanById(l.ch)).map((l) => l.id).join(","));
ok(LEGS.every((l) => l.id === l.ch + l.no),
   "and its id IS its channel and number - no second numbering to drift",
   LEGS.filter((l) => l.id !== l.ch + l.no).map((l) => l.id).join(","));
ok(CHANNELS.every((c) => legsOf(c.id).length > 0),
   "no channel is empty", "");
ok(LEGS.every((l) => l.hops.length >= 2
     && l.hops.every((h) => h[0] === "SEI" || h[0] === "BBH")),
   "every leg names its hops, and each hop says whose it is",
   LEGS.filter((l) => !l.hops || l.hops.length < 2).map((l) => l.id).join(","));

// FOUR TRANSPORTS, AND THE COUNT WAS WRONG IN A WAY THAT MATTERED. The
// old three predated the Kafka and folded a Snowflake driver session
// into "the API", which credited the gateway with controls over the
// primary inbound path that it does not have.
ok(TRANSPORTS.length === 4, "four transports, not three", TRANSPORTS.length);
ok(LEGS.every((l) => transportOf(l)),
   "every leg names a transport that exists",
   LEGS.filter((l) => !transportOf(l)).map((l) => l.id).join(","));
ok(HELD_TRANSPORTS.length === 2
   && HELD_TRANSPORTS.every((x) => /kafka|snowflake/i.test(x.id)),
   "two are held connections - the Kafka consumer and the Snowflake "
   + "session - and both are channel A, the primary inbound path",
   HELD_TRANSPORTS.map((x) => x.id).join(","));
ok(legsOf("A").every((l) => transportOf(l).held),
   "so channel A crosses the gateway nowhere", "");

// Only a leg that crosses the boundary gets a lane on a picture whose
// subject IS the boundary. Drawing the BBH-internal ones there is what
// made one channel own three lanes.
ok(LEGS.every((l) => l.crosses === !!l.y),
   "a leg has a lane position exactly when it crosses the boundary",
   LEGS.filter((l) => l.crosses !== !!l.y).map((l) => l.id).join(","));
ok(LEGS.filter((l) => l.crosses).length === 7
   && LEGS.filter((l) => !l.crosses).length === 2,
   "seven legs cross; the consumer call and the consumer answer do not",
   LEGS.filter((l) => !l.crosses).map((l) => l.id).join(","));
{
  const ys = LEGS.filter((l) => l.crosses).map((l) => l.y).sort((a, b) => a - b);
  ok(ys.every((y, i) => i === 0 || y - ys[i - 1] >= 30),
     "and no two lanes are within 30px - labels collided at 33px pitch "
     + "and it shipped", ys.join(","));
}
// The gateway is a band, not a step. If the loader and the on-demand
// read do not both name it, the shared-quota risk has nowhere to be read.
ok(transportOf(legById("C1")).id === "api"
   && transportOf(legById("D2")).id === "api",
   "the loader submit and the on-demand read share the gateway", "");
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
ok(LEGS.filter((l) => l.crosses).every((l) => html.includes(l.id)),
   "and every crossing leg is labelled on it by id",
   LEGS.filter((l) => l.crosses && !html.includes(l.id))
     .map((l) => l.id).join(","));
ok(/Kafka consumer/.test(html) && /Snowflake session/.test(html),
   "with a box per transport - the read lands on a driver session, not "
   + "on Apigee", "");

try {
  // Picking a leg has to answer at both levels: what this hop does, and
  // which channel it belongs to. One click, two levels - that is the
  // whole reason the leg is the unit the diagram draws.
  const h = render(<ContextView t={t} chan="C2" setChan={() => {}} />);
  ok(/Status back/.test(h) && /Integration 360/.test(h),
     "picking a leg opens that leg", h.length);
  ok(/Loader/.test(h) && /leg 2 of channel C/.test(h),
     "and says which channel it is a leg of", "");
  ok(/C1/.test(h) && /C3/.test(h) && /C4/.test(h),
     "and offers the channel's other legs, so the round trip is reachable "
     + "from any point on it", "");
  const a = render(<ContextView t={t} chan="A2" setChan={() => {}} />);
  ok(/held connection/i.test(a),
     "a leg on a held transport says so - the gateway's controls do not "
     + "reach it and the old model implied they did", "");
} catch (e) { ok(false, "ContextView with a leg renders", e.message); }

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
  render(<ContextView t={tDark} chan="A1" setChan={() => {}} />);
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


/* ------------------------------------------- file-based ingestion */
// This path is the best-specified thing in the pack and the easiest to
// lose once it is labelled "secondary". These pin the parts that stop
// being obvious when it is drawn as one dashed box.
ok(FILE_CHAIN.length === 6
   && FILE_CHAIN.every((f) => f.w && f.tech && f.sei.length > 0),
   "the file chain has all six steps, each with its technology and at "
   + "least one cited component", FILE_CHAIN.length);
ok(FILE_CHAIN.every((f) => f.sei.every((id) =>
     SEI_COMPONENTS.some((c) => c.id === id))),
   "and every component it cites exists in the SEI baseline",
   FILE_CHAIN.flatMap((f) => f.sei)
     .filter((id) => !SEI_COMPONENTS.some((c) => c.id === id)).join(" "));
ok(FILE_CHAIN.every((f) => f.tbl.every((id) =>
     SEI_TABLES.some((x) => x.id === id))),
   "and every table it cites exists too",
   FILE_CHAIN.flatMap((f) => f.tbl)
     .filter((id) => !SEI_TABLES.some((x) => x.id === id)).join(" "));
ok(/one transaction/i.test(FILE_CHAIN.find((f) => f.n === "RAW load").w),
   "the RAW load says one transaction per file - a half-loaded file is the "
   + "state the design refuses to allow", "");
ok(FILE_VALIDATIONS.length === 5
   && FILE_VALIDATIONS.some(([k]) => /zero-row/i.test(k)),
   "all five validations, zero-row among them", FILE_VALIDATIONS.length);
ok(/valid delivery, not an error/i.test(
     FILE_VALIDATIONS.find(([k]) => /zero-row/i.test(k))[1]),
   "and the zero-row rule says it is a valid delivery - treating it as a "
   + "failure stalls the gate on a quiet day", "");
ok(COUNT_RULE.eq === "FILE_ROW_COUNT = TRAILER_ROW_COUNT = RAW_ROW_COUNT",
   "the commit condition is all three counts, named", COUNT_RULE.eq);
ok(/before the commit/i.test(COUNT_RULE.w),
   "and checked before the commit, so a short load cannot reach ARCHIVED",
   COUNT_RULE.w.slice(0, 60));

// THE ONE THAT MATTERS. Three failures, three recoveries, and only one of
// them must never be reloaded.
ok(FAIL_MODES.length === 3
   && FAIL_MODES.map((f) => f.st).join(",")
      === "QUARANTINED,FAILED,ARCHIVE_FAILED",
   "three failure states, named apart", FAIL_MODES.map((f) => f.st).join(","));
const af = FAIL_MODES.find((f) => f.st === "ARCHIVE_FAILED");
ok(/never reload raw/i.test(af.fix) && af.sev === "bad",
   "ARCHIVE_FAILED says never reload RAW, and is marked more severe than "
   + "the other two - a reload here duplicates a business date and nothing "
   + "downstream will tell you", af.fix.slice(0, 70));
ok(FAIL_MODES.filter((f) => /no raw rows|rolled back|unchanged/i.test(f.raw))
     .length === 2,
   "and the two recoverable ones say RAW was not written, which is why "
   + "they are recoverable", FAIL_MODES.map((f) => f.raw).join(" | "));
ok(/generated and held/i.test(FILE_POSTURE.b) && FILE_POSTURE.turns.length >= 3,
   "the live-or-recovery question is stated with what turns on it", "");

try {
  const h = render(<FileIngestionView t={t} onComp={() => {}} />);
  ok(/ARCHIVE_FAILED/.test(h) && /FILE_ROW_COUNT/.test(h)
     && /FILE_SCHEMA_CONFIG/.test(h) && /FILE_REGISTRY/.test(h),
     "the file screen draws the chain, the count rule, both control tables "
     + "and the failure states", h.length);
  ok((h.match(/RECEIVED|VALIDATED|LOADING|QUARANTINED|ARCHIVED/g) || []).length >= 5,
     "and the whole registry lifecycle, read from the baseline rather than "
     + "restated here", "");
  render(<FileIngestionView t={tDark} onComp={() => {}} />);
  ok(true, "and it renders under the dark theme", "");
} catch (e) { ok(false, "FileIngestionView renders", e.message); }

ok(/view === "FILE"/.test(HUBSRC) && /setView\("FILE"\)/.test(HUBSRC),
   "HubDesign routes the file path and makes it clickable", "");
ok(/<Crumb trail=/.test(HUBSRC.slice(HUBSRC.indexOf('view === "FILE"'),
     HUBSRC.indexOf('view === "FILE"') + 1400)),
   "and it carries a breadcrumb", "");
// The gate's file arm is the other place a reader asks "what does that
// path actually do"; a dead end there sends them back to the top.
ok(/onFile=\{\(\) => setView\("FILE"\)\}/.test(HUBSRC),
   "the gate's file arm links straight to it", "");


/* ------------------------------------------ Stage 1 and the database */
// Stage 1's answer to "what does the data look like here" is "unmodelled,
// deliberately". A reader who leaves without knowing that goes looking
// for entities that do not exist.
ok(S1_RULES.length === 5 && S1_RULES.some(([k]) => /append-only/i.test(k))
   && S1_RULES.some(([k]) => /no keys/i.test(k)),
   "Stage 1 states its five rules, append-only and keyless among them",
   S1_RULES.map((r) => r[0]).join(" | "));
ok(S1_NOT_HERE.some((x) => /first normalised model is Stage 2 INT/i.test(x)),
   "and points at where the first normalised model actually is", "");
ok(S1_COLS.length === 4
   && S1_COLS.every(([c]) => /^[A-Z_]+$/.test(c))
   && S1_COLS.some(([c]) => c === "FILE_REGISTRY_ID"),
   "the only four columns Stage 1 adds are named, lineage among them",
   S1_COLS.map((c) => c[0]).join(" "));
// THE FINDING. Seven named, three agreed - four feeds with no
// transformation designed for them.
ok(S1_TABLES.length === 7 && s1Both() === 3 && s1ArchOnly() === 4,
   "seven RAW tables named, three agreed by both sources, four by the "
   + "architecture alone", `${S1_TABLES.length}/${s1Both()}/${s1ArchOnly()}`);
ok(S1_CONFLICT.id === "C1" && /under half/i.test(S1_CONFLICT.why),
   "and the conflict says what it costs, not just that it exists",
   S1_CONFLICT.why.slice(0, 60));

// The database picture: two bands, and nothing dangling.
const dbIds = new Set([...DB_PATH, ...DB_CONTROL].map((x) => x.id));
ok(DB_LINKS.every((l) => dbIds.has(l.from) && dbIds.has(l.to)),
   "every link in the database picture joins two tables that are on it",
   DB_LINKS.filter((l) => !dbIds.has(l.from) || !dbIds.has(l.to))
     .map((l) => l.from + "->" + l.to).join(" "));
ok(DB_PATH.every((p) => p.writes && p.reads)
   && DB_CONTROL.every((c) => c.writes && c.reads),
   "every table says who writes it and who reads it - the property the "
   + "picture exists to show", "");
ok(DB_CONTROL.length === 5 && DB_PATH.length === 6,
   "five control tables under six data-path layers",
   `${DB_CONTROL.length}/${DB_PATH.length}`);
ok(DB_PATH.find((p) => p.id === "stg").kind === "view"
   && /stores nothing/i.test(DB_PATH.find((p) => p.id === "stg").w),
   "STG is drawn as a view, because it stores nothing and every retention "
   + "and replay answer follows from that", "");
ok(DB_ABSENT.length === 2
   && DB_ABSENT.some((a) => /event/i.test(a.route))
   && DB_ABSENT.some((a) => /loader/i.test(a.route)),
   "the two routes with no bookkeeping are ON the picture, not left off "
   + "it - leaving them off makes the database look complete",
   DB_ABSENT.map((a) => a.n).join(" "));
ok(/one writer/i.test(DB_NOTE) && /guarded update/i.test(DB_NOTE),
   "and the one-writer property is stated with why the guarded update "
   + "exists anyway", "");
ok(DB_PATH.filter((p) => p.open).map((p) => p.open).sort().join(",") === "s1,s2",
   "exactly two layers open a model of their own - RAW and INT",
   DB_PATH.filter((p) => p.open).map((p) => p.id).join(" "));

try {
  const h = render(<Stage1Model t={t} />);
  ok(/RAW_CORRECTED_POSITION/.test(h) && /architecture only/.test(h)
     && /append-only/i.test(h),
     "the Stage 1 screen draws the table list, the disagreement and the "
     + "rules", h.length);
  render(<Stage1Model t={tDark} />);
  ok(true, "and renders in dark too", "");
} catch (e) { ok(false, "Stage1Model renders", e.message); }

try {
  const h = render(<DbModelView t={t} pick={null} setPick={() => {}}
    onOpen={() => {}} />);
  ok(/THE DATA PATH/.test(h) && /THE CONTROL PLANE/.test(h)
     && /NOT BUILT/.test(h),
     "the database picture draws all three bands", h.length);
  ok(/DATE_CONTROL/.test(h) && /FILE_REGISTRY/.test(h),
     "with the control tables named on it", "");
  [...DB_PATH, ...DB_CONTROL, ...DB_ABSENT].forEach((n) => {
    const p = render(<DbModelView t={t} pick={n.id} setPick={() => {}}
      onOpen={() => {}} />);
    if (!p.length) ok(false, `selecting ${n.id} renders`, "");
  });
  ok(true, "and every table on it opens a panel without throwing", "");
  render(<DbModelView t={tDark} pick="date" setPick={() => {}} onOpen={() => {}} />);
  ok(true, "dark too", "");
} catch (e) { ok(false, "DbModelView renders", e.message); }

["DBM", "S1M"].forEach((v) => {
  if (!new RegExp(`view === "${v}"`).test(HUBSRC))
    ok(false, `HubDesign routes ${v}`, "");
});
ok(/view === "DBM"/.test(HUBSRC) && /view === "S1M"/.test(HUBSRC)
   && /setView\("DBM"\)/.test(HUBSRC) && /setView\("S1M"\)/.test(HUBSRC),
   "both new models are routed and clickable", "");
// The ask was a box inside Processing, not a link buried on a stage card.
ok(/Data models/.test(HUBSRC)
   && /Stage 2 \/ Silver \/ Enriched data model/.test(HUBSRC)
   && /Stage 1 data model/.test(HUBSRC),
   "Processing carries a data-models band naming Stage 1 and "
   + "Stage 2 / Silver / Enriched", "");
ok(!/canonical tables, 10 domains →/.test(HUBSRC),
   "and the old link on the Stage 2 INT stage card is gone, so there is "
   + "one way in rather than two", "");


/* ------------------------------- the other three Stage 2 perspectives */
// ONE MODEL, FOUR QUESTIONS. If these ever disagree about the numbers
// they are four models, which is the thing the perspective bar exists to
// prevent.
const cross = S2_RELS.filter((r) => {
  const a = s2DomainOf(r.child), b = s2DomainOf(r.parent);
  return a && b && a !== b;
});
ok(cross.length === 36,
   "36 of the 73 relationships cross a domain boundary - the number the "
   + "lineage view is built to show", cross.length);
ok(cross.every((r) => S2_DOMAINS.some((d) => d.k === s2DomainOf(r.child))
     && S2_DOMAINS.some((d) => d.k === s2DomainOf(r.parent))),
   "and every one of them lands in a lane that exists", "");

/* ---- the feed chain ---- */
ok(FEEDS.length === 38,
   "38 SWP feeds, derived from the canonical model's own source-sheet "
   + "column so the two cannot drift apart", FEEDS.length);
ok(FEEDS.reduce((a, f) => a + f.tables.length, 0) === S2_TABLES.length,
   "and between them they account for all 52 canonical tables, once each",
   FEEDS.reduce((a, f) => a + f.tables.length, 0));
ok(FEED_SUMMARY.named + FEED_SUMMARY.likely + FEED_SUMMARY.none === 38
   && FEED_SUMMARY.mapped === FEED_SUMMARY.named + FEED_SUMMARY.likely,
   "every feed carries exactly one confidence and the totals agree",
   JSON.stringify(FEED_SUMMARY));
// THE FINDING, pinned so a later edit cannot quietly soften it.
ok(FEED_SUMMARY.none === 23,
   "23 feeds have no Stage 1 landing table named by either document",
   FEED_SUMMARY.none);
ok(FEED_SUMMARY.anchorsUnmapped.length === 2
   && FEED_SUMMARY.anchorsUnmapped.indexOf("ASSET") >= 0,
   "and two of them are anchors of the Stage 2 model, ASSET among them - "
   + "a domain with no described inbound path",
   FEED_SUMMARY.anchorsUnmapped.join(" "));
ok(FEEDS.every((f) => f.conf === "none" ? !f.raw : !!f.raw),
   "a feed has a RAW table exactly when its confidence is not none", "");
ok(FEEDS.every((f) => !f.raw || RAW_TABLES.indexOf(f.raw) >= 0),
   "and every RAW table a feed names is one the architecture lists",
   FEEDS.filter((f) => f.raw && RAW_TABLES.indexOf(f.raw) < 0)
     .map((f) => f.raw).join(" "));
ok(RAW_WITHOUT_FEED.length === 2
   && RAW_WITHOUT_FEED.every((n) => !FEEDS.some((f) => f.raw === n)),
   "the two correction tables have no feed, and nothing claims they do",
   RAW_WITHOUT_FEED.join(" "));
ok(FAN_OUT[0].feed === "Account" && FAN_OUT[0].tables.length === 7,
   "the biggest fan-out is one feed becoming seven canonical tables - the "
   + "number people get wrong when they size this work",
   `${FAN_OUT[0].feed}:${FAN_OUT[0].tables.length}`);
ok(FEEDS.every((f) => f.tables.every((n) => s2Table(n))),
   "every table a feed claims exists in the model", "");

/* ---- all three render, for every domain ---- */
try {
  S2_DOMAINS.forEach((d) => {
    const h = render(<Stage2Erd t={t} dom={d.k} onPick={() => {}} />);
    if (!/<svg/.test(h)) ok(false, `ERD for ${d.k} draws`, "");
  });
  ok(true, "the ERD draws for all ten domains", "");
  const h = render(<Stage2Erd t={t} dom="PM" onPick={() => {}} />);
  ok(/CLIENT/.test(h) && /declared FK/.test(h),
     "with its entities and a legend for the two edge states", "");
  render(<Stage2Erd t={tDark} dom="TX" onPick={() => {}} />);
  ok(true, "and in dark", "");
} catch (e) { ok(false, "Stage2Erd renders", e.message); }

try {
  const h = render(<Stage2Lineage t={t} onPick={() => {}} />);
  ok(/36 of 73/.test(h) && /Party Management/.test(h),
     "the lineage view draws every lane and states the crossing count",
     h.length);
  render(<Stage2Lineage t={tDark} onPick={() => {}} />);
  ok(true, "and in dark", "");
} catch (e) { ok(false, "Stage2Lineage renders", e.message); }

try {
  const h = render(<Stage2Feeds t={t} onPick={() => {}} />);
  ok(/RAW_ACCOUNT/.test(h) && /No RAW table named/.test(h)
     && /23 of 38/.test(h),
     "the feed view draws the mapped groups, the unmapped group and the "
     + "finding", h.length);
  ok(/RAW_CORRECTED_TRANSACTION/.test(h),
     "and the RAW tables that have no feed at all", "");
  render(<Stage2Feeds t={tDark} onPick={() => {}} />);
  ok(true, "and in dark", "");
} catch (e) { ok(false, "Stage2Feeds renders", e.message); }

// The switcher has to be state the page owns, or a reader loses their
// place every time they open a table.
ok(/const \[s2p, setS2p\] = useState\("domains"\)/.test(HUBSRC)
   && /persp=\{s2p\}/.test(HUBSRC),
   "HubDesign owns which perspective is open", "");
ok(/erd=\{s2erd\}/.test(HUBSRC),
   "and whether a domain shows its ERD or its lists", "");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nhub-c4-context assertions pass");
if (bad) process.exit(1);
