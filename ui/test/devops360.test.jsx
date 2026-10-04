// DevOps 360 — the delivery system as a screen.
//
// WHAT THIS PINS, and why each one can actually fail:
//
//   t.navy IS A SURFACE IN THE DARK THEME. tDark overrides bg, panel,
//   border, text, sub, textMuted and navy — and nothing else. So
//   `color: t.navy` renders near-black ink on a near-black panel, which
//   is a real bug elsewhere in this app. The same trap catches t.accent,
//   which tDark does NOT override: it stays #0f4775 and is unreadable on
//   #0f172a. The diagram accent therefore has to be chosen, not taken
//   from the theme, and this test proves it was.
//
//   A FIGURE WITHOUT AN ARIA LABEL IS A FIGURE THAT DOES NOT EXIST for a
//   reader who cannot see it. Every svg on every panel is checked.
//
//   THIS SCREEN MUST NOT REDRAW THE RELEASE BOARD. The dashboard and the
//   compare panel are real screens reading real rows in Quality
//   Guardrails. A second, hand-drawn copy here would be a picture of a
//   screen — always stale, and indistinguishable from the real one at a
//   glance.
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import DevOps360, { PAL, TABS, NAMING, Context, Containers, Components, Versions,
  Promotion, Pipelines, Deployment } from "../src/DevOps360.jsx";
import { tLight, tDark } from "../src/bbhTheme.js";

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${msg}${cond ? "" : `  -> ${String(got).slice(0, 300)}`}`);
  if (!cond) bad++;
};

function findSrc() {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    for (const rel of ["src", path.join("ui", "src")]) {
      const c = path.join(dir, rel);
      if (fs.existsSync(path.join(c, "DevOps360.jsx"))) return c;
    }
    dir = path.dirname(dir);
  }
  throw new Error("could not locate ui/src from " + process.cwd());
}
const SRC = findSrc();
const ROOT = path.join(SRC, "..", "..");
const strip = (f) => fs.readFileSync(path.join(ROOT, f), "utf8")
  .split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
const JSX = strip("ui/src/DevOps360.jsx");

// ---- the dark-theme ink trap ----------------------------------------
ok(PAL(tDark).ink === tDark.text && PAL(tDark).ink !== tDark.navy,
   "diagram ink is t.text, not t.navy — navy is a SURFACE in the dark theme",
   PAL(tDark).ink);
ok(PAL(tDark).fast !== tDark.accent && PAL(tLight).fast !== tLight.accent,
   "the diagram accent is chosen, not t.accent — tDark does not override "
   + "accent, so it stays #0f4775 and is unreadable on a dark panel",
   PAL(tDark).fast);
ok(PAL(tLight).fast === PAL(tDark).fast && PAL(tLight).pin === PAL(tDark).pin,
   "and it is the same hex in both themes, so one value had to clear both "
   + "surfaces rather than being flipped", PAL(tLight).fast);
ok(!/color:\s*t\.navy|fill=\{t\.navy\}/.test(JSX),
   "t.navy is not used as ink anywhere in this file", "");

// ---- every panel renders, in both themes ----------------------------
const PANELS = { Context, Containers, Components, Versions, Promotion,
                 Pipelines, Deployment };
ok(TABS.length === Object.keys(PANELS).length,
   "every tab has a panel and every panel has a tab",
   `${TABS.length} tabs / ${Object.keys(PANELS).length} panels`);
for (const name of TABS) {
  ok(typeof PANELS[name] === "function", `${name} is wired to a panel`, name);
}
for (const [name, P] of Object.entries(PANELS)) {
  for (const [tn, t] of [["light", tLight], ["dark", tDark]]) {
    const h = renderToStaticMarkup(<P t={t} />);
    ok(h.length > 400, `${name} renders in ${tn}`, h.length);
    ok(!/NaN|undefined|\[object Object\]/.test(h),
       `${name} is clean in ${tn}`, (h.match(/.{0,60}(NaN|undefined).{0,40}/) || [])[0]);
  }
}

// ---- every figure is described --------------------------------------
let svgs = 0, unlabelled = 0;
for (const P of Object.values(PANELS)) {
  const h = renderToStaticMarkup(<P t={tLight} />);
  for (const m of h.matchAll(/<svg\b[^>]*>/g)) {
    svgs++;
    const label = (m[0].match(/aria-label="([^"]*)"/) || [])[1] || "";
    if (!/role="img"/.test(m[0]) || label.length < 60) unlabelled++;
  }
}
ok(svgs >= 8, "every panel that needs a figure has one", svgs);
ok(unlabelled === 0,
   "and each carries role=img with a sentence describing what it shows — a "
   + "diagram with no label is invisible to a reader who cannot see it",
   `${unlabelled} of ${svgs} unlabelled`);

// ---- a wide diagram scrolls in its frame, not the page ---------------
ok(/overflowX: "auto"/.test(JSX) && /minWidth: Math\.min\(vw, 760\)/.test(JSX),
   "figures scroll inside their own frame rather than pushing the page "
   + "sideways on a narrow screen", "");

// ---- the naming rule, as data not prose ------------------------------
const versions = renderToStaticMarkup(<Versions t={tLight} />);
// THE RULE, CHECKED OVER THE ROWS. An environment belongs in a name if
// and only if the thing is re-made per environment. Asserting that the
// panel merely CONTAINS "qc-1201" would also pass on the row that exists
// to show what not to do.
const ENV = /(^|[^a-z])(dev|sit|qc|prod|uat)([^a-z]|$)/i;
for (const n of NAMING) {
  const hasEnv = ENV.test(n.example);
  ok(hasEnv === n.perEnv,
     `${n.thing}: the example ${hasEnv ? "carries" : "carries no"} environment, `
     + `and it is ${n.perEnv ? "" : "not "}re-made per environment`,
     `${n.example} · perEnv=${n.perEnv}`);
}
ok(NAMING.filter((n) => n.perEnv).length === 1,
   "exactly one of the five is re-made per environment — the database tag. "
   + "A second would mean something is being rebuilt rather than promoted",
   NAMING.filter((n) => n.perEnv).map((n) => n.thing).join(", "));
ok(/qc-1201/.test(versions) && /v2026\.10\.01/.test(versions),
   "and both examples reach the screen", "");
ok(/not stored today/.test(versions),
   "the business date is marked as missing rather than quietly shown as if "
   + "it existed", "");

// ---- this screen describes; it does not duplicate the live board -----
const all = Object.values(PANELS)
  .map((P) => renderToStaticMarkup(<P t={tLight} />)).join("");
ok(!/Deployed right now|in flight|Awaiting ARB/i.test(all),
   "the release dashboard is NOT redrawn here — it is a live screen in "
   + "Quality Guardrails, and a hand-drawn copy would be stale the day it "
   + "shipped", "");
const shell = renderToStaticMarkup(<DevOps360 t={tLight} />);
ok(/Quality Guardrails/.test(shell),
   "the header points at the live screens instead", "");

// ---- registered in the app ------------------------------------------
const APP = strip("ui/src/App.jsx");
const NAV = strip("ui/src/AppShell.jsx");
ok(/import DevOps360 from "\.\/DevOps360\.jsx"/.test(APP)
   && /devops360: <DevOps360 t=\{t\} \/>/.test(APP),
   "App.jsx routes it", "");
ok(/\['devops360', 'DevOps 360'/.test(NAV),
   "and AppShell.jsx has a nav entry with the same key — a screen with no "
   + "route is unreachable, and a route with no nav entry is undiscoverable",
   "");

console.log(bad ? `\n${bad} assertion(s) failed` : "\ndevops360 assertions pass");
if (bad) process.exit(1);
