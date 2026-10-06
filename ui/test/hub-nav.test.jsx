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
  Stage2Feeds } from "../src/HubContext.jsx";
import { S2_DOMAINS, s2TablesIn } from "../src/hubStage2Model.js";
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

console.log(bad ? `\n${bad} assertion(s) failed` : "\nhub-nav assertions pass");
if (bad) process.exit(1);
