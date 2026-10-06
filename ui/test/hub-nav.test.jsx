// Clickability, as a property of the markup rather than of the pointer.
//
// WHAT WENT WRONG, AND WHY A TEST HOLDS IT. Half the Hub was clickable and
// almost none of it looked it: a card that opened a screen was drawn
// exactly like a card that was only text, and a box in a diagram that
// opened a model was drawn exactly like a box that was a label. The only
// cue was cursor:pointer, which appears once the pointer is already on the
// thing - it tells a reader what they have found, never what to look for.
//
// So every interactive surface now wears one of three classes, and the
// chevron that makes a node readable at rest is in the DOM at render time,
// not conditional on hover. A test is the only thing that catches the
// regression, because the regression renders perfectly: the screen still
// works, it just stops advertising that it does.
//
//   cp-open  a card that opens a screen. Carries its own "what opens"
//            chevron, so the label is part of the affordance.
//   cp-hit   a node in a diagram. Needs a rect.cp-bx to thicken and a
//            text.cp-go to show at rest - a cp-hit with neither is a
//            silent node wearing the class.
//   cp-row   a row in a list. Tints only; a chevron on each of 73 edge
//            rows is noise, which is the whole reason this third class
//            exists rather than reusing cp-open.
//
// A ClickHint under a diagram is the sentence version of the same thing.
// A diagram with no hint reads as a picture, and nobody clicks a picture.
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { NAV_CSS, NavStyles, OpenCard, ClickHint, SvgGo, Trail }
  from "../src/HubNav.jsx";
import { ContextView, Stage2Model, DbModelView, Stage2Erd, Stage2Lineage,
  Stage2Feeds, Stage2Atlas, GatewayView, SdcEndToEnd, NetworkView }
  from "../src/HubContext.jsx";
import { NET_ZONES, NET_LINKS, NET_STATE, NET_WORK, NET_UNKNOWN, NET_DNS,
  NET_SETTLED, NET_COUNTS, NET_FLOWS, netZone } from "../src/hubNetwork.js";
import { GW_LAYERS, GW_VANTAGE, GW_AD3 } from "../src/hubGatewayLayers.js";
import { LANES } from "../src/hubGroups.js";
import { SDC_LEGS, SDC_OPEN, SDC_PATHS, SDC_ENVS, SDC_NET_FACTS,
  SDC_TRANSPORT_NOTE } from "../src/hubSdcNetwork.js";
import { S2_DOMAINS, S2_TABLES, S2_RELS, s2TablesIn, s2DomainOf }
  from "../src/hubStage2Model.js";
import { DB_PATH, DB_CONTROL, DB_ABSENT } from "../src/hubDbModel.js";
import { tLight } from "../src/bbhTheme.js";

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
      if (fs.existsSync(path.join(c, "HubNav.jsx"))) return c;
    }
    dir = path.dirname(dir);
  }
  throw new Error("HubNav.jsx not found");
}
const SRC = srcDir();
const NAVSRC = fs.readFileSync(path.join(SRC, "HubNav.jsx"), "utf8");
const CTXSRC = fs.readFileSync(path.join(SRC, "HubContext.jsx"), "utf8");
const HUBSRC = fs.readFileSync(path.join(SRC, "HubDesign.jsx"), "utf8");
const t = tLight;
const render = (el) => renderToStaticMarkup(el);
const count = (h, re) => (h.match(re) || []).length;

/* ---------------------------------------------- the stylesheet itself */
// Inline styles cannot express :hover - that is the entire reason this
// file exists. If the three classes ever lose their hover rules the
// affordance is gone and every other assertion here still passes.
for (const sel of [".cp-open:hover", ".cp-hit:hover", ".cp-row:hover"])
  ok(NAV_CSS.includes(sel), `${sel} is defined - an inline style cannot be`, "");
ok(/\.cp-open:focus-visible/.test(NAV_CSS) && /\.cp-hit:focus-visible/.test(NAV_CSS),
   "and both carry a focus ring - a keyboard reader gets the same cue", "");
ok(/prefers-reduced-motion/.test(NAV_CSS),
   "with the motion dropped for anyone who asked for that", "");
ok(/\.cp-open \.cp-go\{[^}]*opacity:\.6/.test(NAV_CSS.replace(/\s+/g, "")
     .replace(/\.cp-open\.cp-go\{/, ".cp-open .cp-go{"))
   || /\.cp-open \.cp-go\{[\s\S]*?opacity:\.62/.test(NAV_CSS),
   "the chevron is visible at rest, not revealed on hover - a cue that "
   + "needs the pointer is the problem, not the fix", "");

ok(render(<NavStyles />).includes("cp-nav-css"),
   "NavStyles renders the sheet under a stable id", "");

/* ------------------------------------------------------ the three parts */
{
  const h = render(<OpenCard onClick={() => {}} opens="the ERD">body</OpenCard>);
  ok(/class="cp-open"/.test(h), "OpenCard wears cp-open", h);
  ok(/cp-go/.test(h) && h.includes("the ERD"),
     "and names what opens - \"open\" alone makes the reader click to find out",
     h);
  ok(/role="button"/.test(h) && /tabindex="0"/i.test(h),
     "and is reachable and announced to a keyboard", h);
  ok(/onKeyDown/.test(NAVSRC) && /e\.key !== "Enter"/.test(NAVSRC),
     "with Enter and Space actually bound, not just the role claimed", "");
}
ok(/Clickable/i.test(render(<ClickHint>anything</ClickHint>)),
   "ClickHint carries the pill as well as the sentence", "");
{
  const h = render(<SvgGo x={10} y={10} />);
  ok(/class="cp-go"/.test(h), "SvgGo is the class the hover rule targets", h);
}
{
  const h = render(<Trail steps={[["containers", () => {}], ["Processing", null]]} t={t} />);
  ok(h.includes("containers") && h.includes("Processing"),
     "Trail draws every step", h);
  ok(count(h, /role="button"/g) === 1,
     "and only the steps that go somewhere are buttons - the one you are "
     + "on is not a link back to itself", h);
}
// One breadcrumb, not two that drift apart. HubDesign had its own copy.
ok(/const Crumb = \(\{ trail \}\) => <Trail/.test(HUBSRC),
   "HubDesign's Crumb is the shared Trail, not a second implementation", "");
ok(!/const Crumb = \(\{ trail \}\) => \(\s*<div style=\{\{ display: "flex"/.test(HUBSRC),
   "and the old inline copy is gone, not merely unused", "");

/* --------------------------------------- every diagram node advertises */
{
  const h = render(<ContextView t={t} chan={null} setChan={() => {}} />);
  ok(count(h, /class="cp-hit"/g) === 6,
     "all six boundary channels are marked, not the two that were obvious",
     count(h, /class="cp-hit"/g));
  ok(count(h, /class="cp-go"/g) === 6,
     "each with a chevron drawn at rest", count(h, /class="cp-go"/g));
  ok(/Clickable/i.test(h), "and the picture says it is one", "");
  ok(h.includes("cp-nav-css"),
     "the leaf carries its own stylesheet - it knows nothing about how it "
     + "was reached", "");
}
{
  const h = render(<DbModelView t={t} pick={null} setPick={() => {}} onOpen={() => {}} />);
  const n = DB_PATH.length + DB_CONTROL.length + DB_ABSENT.length;
  ok(count(h, /class="cp-hit"/g) === n,
     `all ${n} tables open, the two that do not exist yet included`,
     count(h, /class="cp-hit"/g));
  ok(count(h, /class="cp-bx"/g) === n,
     "and each has the rect the hover rule thickens - a cp-hit with no "
     + "cp-bx looks identical and responds to nothing",
     count(h, /class="cp-bx"/g));
  ok(count(h, /class="cp-go"/g) === n, "and a chevron at rest",
     count(h, /class="cp-go"/g));
}
{
  const dom = S2_DOMAINS[0].k;
  const h = render(<Stage2Erd t={t} dom={dom} onPick={() => {}} />);
  const boxes = count(h, /class="cp-hit"/g);
  ok(boxes >= s2TablesIn(dom).length,
     "every ERD entity opens, the outside ones included", boxes);
  ok(count(h, /class="cp-go"/g) === boxes,
     "each marked at rest", count(h, /class="cp-go"/g));
  ok(/Clickable/i.test(h), "and the ERD says so under the legend", "");
}
{
  const h = render(<Stage2Lineage t={t} onPick={() => {}} />);
  ok(count(h, /class="cp-hit"/g) === S2_DOMAINS.length,
     "every lane in the swimlane opens its domain",
     count(h, /class="cp-hit"/g));
}

/* ----------------------------------------------- cards, rows and hints */
{
  const h = render(<Stage2Model t={t} dom={null} tbl={null} setDom={() => {}}
    setTbl={() => {}} persp="domains" setPersp={() => {}} />);
  ok(count(h, /class="cp-open"/g) === S2_DOMAINS.length,
     "all ten domain cards are cards that open",
     count(h, /class="cp-open"/g));
  ok(count(h, /class="cp-go"/g) === S2_DOMAINS.length,
     "each saying so before the pointer arrives", count(h, /class="cp-go"/g));
  ok(h.includes("ERD and tables"),
     "and saying what it opens, not just that it opens", "");
  ok(!/\d+relationships/.test(h),
     "no word run into a number - JSX drops the newline after an expression",
     (h.match(/.{14}relationships/) || [""])[0]);
}
{
  // One pill per screen. Two CLICKABLE pills on one screen teaches the
  // reader that the pill means nothing.
  const dom = S2_DOMAINS[0].k;
  const erd = render(<Stage2Model t={t} dom={dom} tbl={null} setDom={() => {}}
    setTbl={() => {}} erd={true} setErd={() => {}} />);
  ok(count(erd, />Clickable</g) === 1,
     "a domain showing its ERD has exactly one hint", count(erd, />Clickable</g));
  const list = render(<Stage2Model t={t} dom={dom} tbl={null} setDom={() => {}}
    setTbl={() => {}} erd={false} setErd={() => {}} />);
  ok(count(list, />Clickable</g) === 1,
     "and so does the same domain showing its lists",
     count(list, />Clickable</g));
  ok(count(list, /class="cp-row"/g) > 0,
     "where the relationship rows tint rather than growing 73 chevrons",
     count(list, /class="cp-row"/g));
}
{
  const h = render(<Stage2Feeds t={t} onPick={() => {}} />);
  ok(count(h, /class="cp-row"/g) > 0,
     "and the feed map's table pills are rows too", count(h, /class="cp-row"/g));
}

/* ------------------------------- no node wears the class and does nothing */
// A cp-hit without an onClick is a box that thickens under the pointer and
// then does nothing, which is worse than no affordance at all.
ok(!/className="cp-hit"(?![\s\S]{0,220}onClick)/.test(CTXSRC),
   "every cp-hit in HubContext has a click bound within its own tag", "");
ok(!/className="cp-hit"(?![\s\S]{0,260}onClick)/.test(HUBSRC),
   "and every cp-hit in HubDesign", "");

// The C4 picture is the first screen anyone sees, so the containers, the
// lanes inside them and the stage chain all have to respond.
for (const [re, what] of [
  [/className="cp-hit"[\s\S]{0,180}setGrp\(id\)/, "the container shells"],
  [/const Lane = \(\{ l, x, y, w, h \}\) => \(\s*<g className="cp-hit"/, "the lanes on them"],
  [/const Stage = \(\{ st, x, y, w \}\) => \(\s*<g className="cp-hit"/, "the stage chain"],
])
  ok(re.test(HUBSRC), `${what} respond in the C4 picture`, "");
ok(/<SectionHeader t=\{t\}>CP Integration Hub<\/SectionHeader>\s*\n\s*<NavStyles \/>/.test(HUBSRC),
   "and the sheet rides on the section header, so no view can be missed", "");

// The guard that has caught this three times already.
ok(!/\\u[0-9a-fA-F]{4}/.test(CTXSRC) && !/\\u[0-9a-fA-F]{4}/.test(NAVSRC),
   "no escaped unicode - six literal characters in JSX text", "");

/* ------------------------------------------- the atlas: all 52 at once */
// The whole claim of this screen is that it shows every table and every
// relationship. A layout that quietly loses an edge still looks correct -
// it just draws a model nobody has, which is the exact failure the
// domain-by-domain views were built to avoid.
{
  const h = render(<Stage2Atlas t={t} onPick={() => {}} onDomain={() => {}} />);
  const refDoms = {};
  S2_RELS.forEach((r) => {
    (refDoms[r.parent] = refDoms[r.parent] || new Set()).add(s2DomainOf(r.child));
  });
  const spine = Object.keys(refDoms).filter((k) => refDoms[k].size > 1);
  const rows = S2_TABLES.filter((r) => spine.indexOf(r[1]) < 0).length;

  ok(count(h, /class="cp-hit"/g) === rows + S2_DOMAINS.length + spine.length,
     `every one of the ${S2_TABLES.length} tables, plus ${S2_DOMAINS.length} `
     + "domain headers, is its own target", count(h, /class="cp-hit"/g));
  for (const r of S2_TABLES)
    if (!h.includes(">" + r[1] + "<") && !h.includes(r[1].slice(0, 39) + "."))
      ok(false, `${r[1]} is on the page`, "");
  ok(true, "no table is missing from the atlas", "");

  // The spine is derived, never listed. Hard-code it and the picture stops
  // agreeing with the model the moment a relationship is added.
  ok(/function atlasShape/.test(CTXSRC)
     && /refDoms\[r\.parent\]/.test(CTXSRC),
     "the shared entities are derived from the edges, not a hand-kept list", "");
  ok(spine.length === 6 && spine.indexOf("ACCOUNT") >= 0,
     "which today is six entities, ACCOUNT among them", spine.join(","));

  // Every edge is accounted for: drawn to the spine, drawn inside a panel,
  // or named in the footnote. The totals have to add up to all of them.
  const paths = count(h, /<path /g);
  const named = count(h, /class="cp-row"/g);
  ok(paths + named === S2_RELS.length,
     `${S2_RELS.length} relationships, all drawn or all named - nothing is `
     + "dropped quietly", `${paths} drawn + ${named} named`);
  ok(named === 3 && /Named, not drawn/i.test(h),
     "the three that cross a boundary without a shared entity are listed, "
     + "with the reason they are not wired", named);
  for (const r of S2_RELS.filter((x) => s2DomainOf(x.child) !== s2DomainOf(x.parent)
        && spine.indexOf(x.parent) < 0))
    ok(h.includes(r.parent) && h.includes(r.child),
       `${r.child} to ${r.parent} is named in full`, "");

  // A self-reference is a point joined to itself; the generic edge path
  // collapses to a flat stub that reads as an edge to somewhere offscreen.
  const self = S2_RELS.filter((r) => r.child === r.parent);
  ok(self.length > 0 && /r\.child === r\.parent/.test(CTXSRC),
     `the ${self.length} self-reference(s) get a loop, not a collapsed line`,
     self.map((r) => r.child).join(","));
  ok(/e\.child === e\.parent/.test(CTXSRC),
     "and so do they in the per-domain ERD, which had the same collapse", "");

  // Order matters here and is invisible in a static read: an arc drawn in
  // a panel's own gutter before the panel background is painted over by it.
  const pi = h.indexOf("the edges a domain owns outright");
  ok(/then the panel backgrounds[\s\S]{0,400}then the edges a domain owns outright/
     .test(CTXSRC),
     "panel backgrounds are painted before the arcs that sit in them", "");
  ok(/cross-domain lines first[\s\S]{0,300}toSpine\.map/.test(CTXSRC),
     "and the cross-domain lines before both, so they run behind", "");
}

/* ------------------------------- the gateway, as two layers not two options */
// AD-3 sat open for months because nobody had written down that SEI's
// "BBH runs an Apigee proxy" and BBH's "API Gateway / Data Plane" are the
// same door seen from two sides. The cost of getting this wrong is not
// cosmetic: drawn as one box there is nowhere to put the trust boundary,
// and the trust boundary is where the blocking readiness gap lives.
{
  const h = render(<GatewayView t={t} onReview={() => {}} onComp={() => {}} />);
  ok(GW_LAYERS.length === 2 && GW_LAYERS.map((l) => l.reg).join() === "12,11",
     "two layers, mapped to the two tracked components",
     GW_LAYERS.map((l) => l.reg).join());
  ok(GW_LAYERS[0].isolates.length > 0 && GW_LAYERS[1].isolates.length === 0,
     "the wrapper hides things and the thing behind it hides nothing - "
     + "a symmetric pair would be two proxies, not a wrapper", "");
  ok(count(h, /class="cp-hit"/g) === 2,
     "both layers open their component record", count(h, /class="cp-hit"/g));
  ok(/ISOLATED FROM THE CONSUMER/.test(h) && /What SEI names as one proxy/.test(h),
     "the picture states the vantage point rather than leaving it inferred", "");
  ok(GW_VANTAGE.length === 3
     && GW_VANTAGE.some((v) => /SEI/.test(v.who) && /Apigee/.test(v.sees)),
     "and the table says what SEI sees, which is the half that read as a conflict",
     "");
  ok(/GW-GAP-01/.test(h),
     "the question AD-3 was standing in for is named, not dropped with it", "");

  // The whole point is that the two documents stop being identical.
  const d11 = fs.readFileSync(path.join(SRC, "..", "..", "designs-md",
    "11_Apigee_Proxy_Design.md"), "utf8");
  const d12 = fs.readFileSync(path.join(SRC, "..", "..", "designs-md",
    "12_API_Gateway_DataPlane_Design.md"), "utf8");
  const body = (x) => (x.split("## How this works")[1] || "").split("## Open against")[0];
  ok(body(d11) && body(d12) && body(d11) !== body(d12),
     "the Apigee and API Gateway documents have different bodies - keyed by "
     + "container they were byte-identical", "");
  ok(/Header policy/.test(d12) && !/Header policy/.test(d11),
     "the readiness review lands on the wrapper, not on the proxy behind it", "");
  ok(!/Landing Zone contract/.test(d11) && !/Landing Zone contract/.test(d12),
     "and the landing-zone contract is out of both - it is a different lane",
     "");
  ok(/Landing Zone contract/.test(fs.readFileSync(path.join(SRC, "..", "..",
      "designs-md", "08_Landing_Zone_Transport_Design.md"), "utf8")),
     "but still in the landing document, where it belongs", "");

  // A stale "open" somewhere else re-opens the question for whoever reads it.
  const TRK = fs.readFileSync(path.join(SRC, "seiDesignTracker.js"), "utf8");
  ok(!/Is Apigee a decision or a placeholder\? \(AD-3\)/.test(TRK),
     "no component still asks AD-3 as an open question", "");
  for (const [f, re] of [["hubArchitectReview.js", /Settle AD-3/],
                         ["seiCitations.js", /is open as AD-3/]])
    ok(!re.test(fs.readFileSync(path.join(SRC, f), "utf8")),
       `${f} no longer carries AD-3 as unresolved`, "");
}

// A lane that opens a screen of its own has to be routed, or the lane is a
// dead click that silently falls through to its container.
{
  const laneViews = Object.values(LANES).flat().filter((l) => l.view);
  ok(laneViews.length > 0, "at least one lane owns a screen", "");
  for (const l of laneViews) {
    ok(new RegExp(`view === "${l.view}"`).test(HUBSRC),
       `the ${l.id} lane's view (${l.view}) is a route HubDesign answers`, "");
    ok(/if \(l\.view\) \{ setView\(l\.view\); return; \}/.test(HUBSRC),
       "and the lane click honours it before falling back to the container", "");
  }
}

/* ------------------ SDC end to end: the logical path and its network */
// Every other screen draws the event path as actors and messages, and
// apart from the network it looks finished. Together with SEI's network
// page it is not: the primary inbound path depends on a BBH pod opening
// a session into a Snowflake account whose policy admits SEI subnets and
// VPN only. That sentence only exists when both are on one page, which
// is what this screen is for and what these assertions protect.
{
  const h = render(<SdcEndToEnd t={t} pick={null} setPick={() => {}}
    onGate={() => {}} />);

  ok(SDC_LEGS.every((l) => l.short && l.net && l.w),
     "every leg says what it does AND what network it runs on - a leg "
     + "with no network line is the omission this screen exists to fix",
     SDC_LEGS.filter((l) => !l.net).map((l) => l.n).join(","));
  ok(SDC_LEGS.every((l) => l.st === "settled" || l.ask),
     "and an unfinished leg names the question, so a dashed box is never "
     + "an alarm with no message",
     SDC_LEGS.filter((l) => l.st !== "settled" && !l.ask).map((l) => l.n).join(","));
  // Agreed-and-unbuilt is not the same as nobody-has-said-how, and a
  // screen that draws them alike makes the network look either finished
  // or hopeless depending on which colour it picked.
  ok(new Set(SDC_LEGS.map((l) => l.st)).size >= 2
     && SDC_LEGS.some((l) => l.st === "design"),
     "the legs distinguish agreed-but-unbuilt from no-mechanism-agreed",
     [...new Set(SDC_LEGS.map((l) => l.st))].join(","));
  for (const l of SDC_LEGS.filter((x) => x.ask))
    ok(SDC_OPEN.some((o) => o.id === l.ask),
       `leg ${l.n} points at a question that exists (${l.ask})`, "");
  ok(count(h, /class="cp-hit"/g) === SDC_LEGS.length,
     "all nine legs open", count(h, /class="cp-hit"/g));
  // renderToStaticMarkup escapes the apostrophe in "SEI's".
  const esc = (x) => x.replace(/&/g, "&amp;").replace(/'/g, "&#x27;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  // The SEI column is 214px and holds three boxes; its legs carry their
  // network line in the panel rather than on the box. Every BBH leg has
  // room and must show it on the diagram - clipping leg 5 to fit lost the
  // clause that names the refusal, which is the finding.
  const onDiagram = SDC_LEGS.filter((l) => l.side === "BBH");
  ok(onDiagram.every((l) => h.includes(esc(l.short))),
     "every BBH leg's network line is on the diagram in full, not clipped",
     onDiagram.filter((l) => !h.includes(esc(l.short))).map((l) => l.n).join(","));
  ok(SDC_LEGS.every((l) => {
       const o = render(<SdcEndToEnd t={t} pick={l.n} setPick={() => {}} />);
       return o.includes(esc(l.net));
     }),
     "and opening any leg, SEI's included, gives the full network text", "");

  // The whole finding, in one assertion: the legs that cross into SEI's
  // network are the ones with no agreed network.
  const reaches = SDC_LEGS.filter((l) => l.side === "BBH" && l.reach === "sei");
  const inside = SDC_LEGS.filter((l) => l.side === "BBH" && l.reach === "bbh");
  ok(SDC_LEGS.every((l) => l.reach),
     "whether a leg crosses into SEI's network is a field, not something "
     + "inferred from its prose - the prose changes every time a fact "
     + "lands and a regex over it quietly stops testing anything", "");
  ok(reaches.length > 0 && reaches.every((l) => l.st !== "settled"),
     "every BBH leg that reaches into SEI's network is still unfinished",
     reaches.map((x) => `${x.n}:${x.st}`).join(" "));
  ok(inside.length > 0 && inside.every((l) => l.st === "settled"),
     "and every BBH leg that stays inside BBH is settled - the split is "
     + "exactly the organisation boundary, which is the finding",
     inside.map((x) => `${x.n}:${x.st}`).join(" "));

  // Path 3 is the one that passes every test and then fails.
  const p3 = SDC_PATHS.find((x) => x.n === 3);
  ok(/large result set/i.test(p3.carries) && /blob/i.test(p3.via + p3.t),
     "the second Private Link is recorded as serving large result sets "
     + "from blob, not just PUT and GET", "");
  ok(/test/i.test(p3.lose),
     "and says why it is missed: the connectivity tests all pass without it",
     p3.lose);
  ok(SDC_OPEN.some((o) => o.id === "Q3" && o.sev === "block"),
     "it is a blocking question, not a note", "");

  ok(SDC_ENVS.length === 3 && /environment is part of the connection identity/i
     .test(SDC_NET_FACTS.map((f) => f.m).join(" ")),
     "three paired accounts, and the screen says environment is part of "
     + "the connection identity rather than a parameter", "");
  ok(/fourth/.test(SDC_TRANSPORT_NOTE) && /cross/.test(SDC_TRANSPORT_NOTE),
     "and the fourth transport is named - the context screen's three "
     + "transports do not cover a held connection", "");

  // SEI's slide is SEI's property and nothing identifying is recorded.
  const NETSRC = fs.readFileSync(path.join(SRC, "hubSdcNetwork.js"), "utf8");
  for (const [re, what] of [
    [/\b\d{1,3}(\.\d{1,3}){3}\b/, "an IP address"],
    [/\b[a-z0-9-]+\.(snowflakecomputing|azure|windows|core)\.[a-z.]+/i, "a hostname"],
    [/\b(privatelink|subscription-id|tenant-id)\s*[:=]/i, "an identifier"],
  ])
    ok(!re.test(NETSRC), `no ${what} is recorded from SEI's network page`,
       (NETSRC.match(re) || [""])[0]);
  ok(/structure and metadata only/i.test(NETSRC)
     && /not committed/i.test(NETSRC),
     "and the file says the slide is SEI's and is not committed", "");
}

/* --------------- the network view, for the infrastructure teams */
// This one leaves the programme: it is sent to security, infrastructure
// and network engineering, who will act on it without being in the room.
// So it has to be checkable on its own terms - every link a firewall
// request could be written from, every state distinguishable, and nothing
// from SEI's documents reproduced that should not be.
{
  const h = render(<NetworkView t={t} zone={null} setZone={() => {}} />);
  ok(count(h, /class="cp-hit"/g) === NET_ZONES.length,
     "every zone opens", count(h, /class="cp-hit"/g));
  ok(NET_LINKS.every((l) => netZone(l.from) && netZone(l.to)),
     "every link joins two zones that exist - a dangling link is a "
     + "firewall request to nowhere", "");
  for (const f of ["mech", "proto", "dir", "owner", "note"])
    ok(NET_LINKS.every((l) => l[f]),
       `every link states its ${f} - the table is the deliverable, and a `
       + "blank column is a question the reader has to come back with",
       NET_LINKS.filter((l) => !l[f]).map((l) => l.id).join(","));
  ok(NET_LINKS.every((l) => NET_STATE[l.st]),
     "and a state that is one of the three", "");
  // An unbuilt link has to be traceable to something: the open question
  // it waits on, the component that owns it, or the decision that has to
  // be taken first. "Not built" with no reference is a line item nobody
  // can pick up.
  const traced = (l) => l.u
    || /\b(M\d+|U\d|Q\d|GW-(GAP|RISK)-\d+|DEC-GAP-\d+|SILVER-DEC-\d+)\b/
         .test(l.note + l.mech);
  const untraced = NET_LINKS.filter((l) => l.st !== "live" && !traced(l));
  ok(untraced.length === 0,
     "every unbuilt link cites the question, component or decision it "
     + "waits on", untraced.map((l) => l.id).join(","));
  // A question id resolves against one of the two lists: the event
  // path's Qs or this screen's Us. An id that resolves against neither
  // is a reference to a question nobody is tracking.
  const resolves = (id) => SDC_OPEN.some((o) => o.id === id)
    || NET_UNKNOWN.some((u) => u.id === id);
  ok(NET_LINKS.filter((l) => l.u).every((l) => resolves(l.u)),
     "a link's question id resolves against the event path's list or "
     + "this screen's, so the two cannot drift apart",
     NET_LINKS.filter((l) => l.u && !resolves(l.u))
       .map((l) => `${l.id}->${l.u}`).join(","));
  ok(NET_LINKS.every((l) => h.includes(l.id)),
     "every link id is on the page, so the picture indexes into the table",
     "");

  // Three states, because agreed-and-unbuilt and nobody-has-said-how get
  // escalated to different people.
  ok(Object.keys(NET_STATE).length === 3
     && Object.values(NET_STATE).every((x) => x.n && x.w && x.c),
     "three states, each with a label and an explanation", "");

  // What the user settled this session, held as settled rather than
  // quietly left in the open list.
  const settled = NET_SETTLED.map((x) => x.t + " " + x.w).join(" ");
  for (const [re, what] of [
    [/Kafka/i, "the Kafka is the event transport"],
    [/dedicated|shared cluster/i,
     "it is a dedicated queue on SEI's shared cluster, not a BBH build"],
    [/Private Link/i, "Private Link is how BBH reaches it"],
    [/tag/i, "the tag selects the Snowflake target"],
    [/three|DEV.*IMPS.*Prod/i, "there are three environments"],
  ])
    ok(re.test(settled), `recorded as settled: ${what}`, "");
  ok(NET_COUNTS.open === 0,
     "nothing is left in no-mechanism-agreed - the gap is build now",
     JSON.stringify(NET_COUNTS));

  // The two that are easy to conflate and expensive to.
  ok(/route/i.test(JSON.stringify(NET_UNKNOWN)) &&
     /admission|allow-list/i.test(JSON.stringify(NET_UNKNOWN)),
     "a route and an admission are held apart - Private Link gives the "
     + "first and the Snowflake network policy decides the second", "");
  ok(/ADVERTISED|advertised/.test(JSON.stringify(NET_LINKS)),
     "and the Kafka link says every advertised broker, not the bootstrap "
     + "address - the rule most often written wrong from a connection string",
     "");
  ok(/private DNS/i.test(NET_DNS.t + NET_DNS.w) && NET_DNS.checks.length >= 4,
     "the private-DNS failure is called out: a private endpoint without "
     + "its zone is a public route that succeeds", "");

  // Flows, so a team can isolate the path it owns. Nineteen links read
  // as one wall of text otherwise.
  ok(NET_LINKS.every((l) => NET_FLOWS.some((f) => f.k === l.flow)),
     "every link belongs to a flow that exists",
     NET_LINKS.filter((l) => !NET_FLOWS.some((f) => f.k === l.flow))
       .map((l) => l.id).join(","));
  ok(NET_FLOWS.every((f) => NET_LINKS.some((l) => l.flow === f.k)),
     "and every flow has links - an empty filter pill is a dead control",
     "");

  // The file path was one link and is now the four things infrastructure
  // actually has to provision.
  const files = NET_LINKS.filter((l) => l.flow === "file");
  const fileText = JSON.stringify(files);
  for (const [re, what] of [
    [/SFTP/i, "SFTP"], [/Momentum/i, "Momentum"],
    [/mounted|mount/i, "the mount into the worker pods"],
    [/Archive|Quarantine/i, "Archive and Quarantine"],
  ])
    ok(re.test(fileText), `the file flow names ${what}`, "");
  ok(NET_ZONES.some((z) => z.id === "store"),
     "shared storage is its own zone - an external writer and internal "
     + "readers both touch it, which makes its protocol and mount an "
     + "infrastructure question", "");
  ok(/which side initiates|which side opens/i.test(fileText),
     "and the Momentum link flags which side opens the connection as "
     + "unstated, because that decides the direction of the rule", "");

  // The loader round trip is five legs and two of them were missing from
  // every network picture.
  const loader = NET_LINKS.filter((l) => l.flow === "loader");
  ok(loader.some((l) => /BBH to consumer/i.test(l.dir)),
     "the loader flow includes the Hub calling the consumer back - the "
     + "direction nobody draws, because consumers are assumed to call in",
     loader.map((l) => l.dir).join(" | "));
  ok(files.some((l) => /error.detail/i.test(l.w)),
     "and the error-detail file coming back, which is a file path the "
     + "loader flow depends on", "");
  ok(files.some((l) => /must NOT join|never empties/i.test(l.note)),
     "with the rule that keeps it out of the expected daily set - in it, "
     + "the inbound business date never transforms", "");
  ok(loader.filter((l) => /BBH to SEI/i.test(l.dir)).length === 2,
     "data fetch and loader submit are separate links - they share a "
     + "quota and compete, which one link hides",
     loader.filter((l) => /BBH to SEI/i.test(l.dir)).map((l) => l.id).join(","));

  // Four teams, each with work they can actually start.
  ok(NET_WORK.length >= 4 && NET_WORK.every((g) => g.team && g.items.length),
     "every team named has a list", NET_WORK.map((g) => g.team).join(","));
  ok(NET_UNKNOWN.every((u) => u.blocks),
     "and every open question says what it blocks", "");

  // Same discipline as the SDC module: this leaves the building.
  const NETSRC2 = fs.readFileSync(path.join(SRC, "hubNetwork.js"), "utf8");
  for (const [re, what] of [
    [/\b\d{1,3}(\.\d{1,3}){3}\b/, "an IP address"],
    [/\b[a-z0-9-]+\.(snowflakecomputing|azure|windows|core)\.[a-z.]+/i, "a hostname"],
    [/\/\d{1,2}\b(?!\d)/, "a CIDR mask"],
  ])
    ok(!re.test(NETSRC2.replace(/https?:\/\/\S+/g, "")),
       `no ${what} is recorded`, (NETSRC2.match(re) || [""])[0]);
  ok(/to confirm/.test(NETSRC2),
     "ports are flagged as protocol defaults to confirm, not observed", "");
}

console.log(bad ? `\n${bad} assertion(s) failed` : "\nhub-nav assertions pass");
if (bad) process.exit(1);
