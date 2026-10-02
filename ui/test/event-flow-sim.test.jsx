// The Run-through tab: every scenario, every step, actually rendered.
//
// WHY RENDERING ALL OF THEM. The player holds its step index in state, so
// a server render reaches step 0 of one scenario and no further. Five of
// the six scenarios, and 50-odd of the 56 steps, would never be executed
// by a smoke test — and the defects this screen can carry are exactly the
// ones that only appear on the step nobody rendered. That is the same
// failure the Commit boundary tab already shipped once: a bad identifier
// behind a tab, green in a test of the default tab, throwing in the
// browser for anyone who clicked.
//
// THE SILENT ONES MATTER MORE THAN THE THROWS. A step whose `at` names a
// node that does not exist does not throw; the diagram simply never
// lights up for it, and nobody notices because the prose still reads.
// A step citing an answer number that is not in Q renders "SEI answer 9."
// followed by nothing. A closedTopics entry misspelled shows four topics
// closed while the sentence beside it says five. All three are asserted
// against the data, not the markup.
//
// AND THE HONESTY INVARIANT. This is the one tab in Event 360 that is not
// fed from the catalogue, so the banner saying so is load-bearing: strip
// it and the screen starts borrowing the authority of the five tabs
// beside it, which are refusing to render demo data two clicks away.

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import EventFlowSim, { SCENARIOS, NODES, EDGES, TOPICS, Q, KIND,
  Diagram, Current, State, Limits, path } from "../src/EventFlowSim.jsx";

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${msg}${cond ? "" : `  -> ${String(got).slice(0, 300)}`}`);
  if (!cond) bad++;
};

// ---- the graph is consistent with itself ------------------------------
for (const [a, b] of EDGES) {
  ok(NODES[a] && NODES[b], `edge ${a}->${b} joins two real nodes`, [a, b]);
  ok(!/NaN|undefined/.test(path(a, b)), `edge ${a}->${b} has a finite path`,
     path(a, b));
}

// ---- the boxes do not sit on top of each other ------------------------
// Layout maths fails silently: two rects at the same coordinates still
// render, one just covers the other, and the label underneath is simply
// gone. The viewBox is 892 x 262 and every node has to fit inside it.
const VB = { w: 892, h: 262 };
const ids = Object.keys(NODES);
for (const id of ids) {
  const n = NODES[id];
  ok(n.x >= 0 && n.y >= 0 && n.x + n.w <= VB.w && n.y + n.h <= VB.h,
     `${id} is inside the viewBox`, [n.x, n.y, n.w, n.h]);
}
for (let a1 = 0; a1 < ids.length; a1++) {
  for (let b1 = a1 + 1; b1 < ids.length; b1++) {
    const A = NODES[ids[a1]], B = NODES[ids[b1]];
    const hit = A.x < B.x + B.w && B.x < A.x + A.w
             && A.y < B.y + B.h && B.y < A.y + A.h;
    ok(!hit, `${ids[a1]} and ${ids[b1]} do not overlap`,
       [ids[a1], A, ids[b1], B]);
  }
}
// The hub draws five topic bars inside itself, 12px apart from y+38.
// They have to fit under its own label rather than spilling past its edge.
ok(NODES.hub.y + 38 + TOPICS.length * 12 <= NODES.hub.y + NODES.hub.h,
   "the topic bars fit inside the Event Hub box",
   [NODES.hub.h, 38 + TOPICS.length * 12]);

// ---- every step is wired to something that exists ---------------------
let steps = 0, cited = 0, payloads = 0;
for (const sc of SCENARIOS) {
  ok(sc.steps.length > 0, `${sc.k}: has steps`, sc.steps.length);
  for (const st of sc.steps) {
    steps++;
    // A node id that does not exist is the silent one: nothing throws,
    // the diagram just never highlights for that step.
    ok(Boolean(NODES[st.at]),
       `${sc.k} / "${st.h}": lights a node that exists`, st.at);
    ok(Boolean(KIND[st.kind]),
       `${sc.k} / "${st.h}": has a known kind`, st.kind);
    if (st.q != null) {
      cited++;
      ok(Boolean(Q[st.q]),
         `${sc.k} / "${st.h}": cites an answer that is in the source list`, st.q);
    }
    if (st.pay) {
      payloads++;
      ok(JSON.stringify(st.pay).length > 10,
         `${sc.k} / "${st.h}": payload is a real object`, st.pay);
    }
    for (const tp of (st.set && st.set.closedTopics) || []) {
      ok(TOPICS.includes(tp),
         `${sc.k} / "${st.h}": closes a topic that exists — a typo here shows `
         + `fewer closed than the sentence claims`, tp);
    }
  }
}
ok(steps >= 45, "the walk-through is substantial enough to be worth playing", steps);
ok(cited >= 20, "most steps carry the answer they rest on", cited);
ok(payloads >= 3, "the real payload shapes are on the screen", payloads);

// ---- render every step of every scenario ------------------------------
// This is the part a smoke test cannot reach.
for (const sc of SCENARIOS) {
  const seen = new Set();
  const acc = {};
  let html = "";
  try {
    sc.steps.forEach((st, i) => {
      Object.assign(acc, st.set || {});
      html += renderToStaticMarkup(<Current step={st} />);
      html += renderToStaticMarkup(
        <Diagram live={i ? `${sc.steps[i - 1].at}>${st.at}` : null}
          at={st.at} seen={seen} st={acc} reduced={false} playing />);
      html += renderToStaticMarkup(<State st={acc} sk={sc.k} />);
      seen.add(st.at);
    });
    ok(html.length > 0, `${sc.k}: every step renders`, html.length);
  } catch (e) {
    ok(false, `${sc.k}: every step renders`, e && e.stack);
  }
  ok(!/NaN/.test(html), `${sc.k}: no NaN reaches the screen`,
     (html.match(/.{0,60}NaN.{0,60}/) || [])[0]);
  ok(!/undefined/.test(html), `${sc.k}: no undefined reaches the screen`,
     (html.match(/.{0,60}undefined.{0,60}/) || [])[0]);
}

// ---- the whole tab, as Event 360 mounts it ----------------------------
let top = "";
try {
  top = renderToStaticMarkup(<EventFlowSim />);
  ok(top.length > 2000, "the tab renders prop-less, the way Event360 calls it",
     top.length);
} catch (e) {
  ok(false, "the tab renders prop-less, the way Event360 calls it", e && e.stack);
}
ok(!/NaN|undefined/.test(top), "and cleanly", "");

// ---- the honesty invariant -------------------------------------------
ok(/walk-through, not a trace/i.test(top),
   "it says in its own first panel that nothing here came from a running system",
   "");
ok(/illustrative/i.test(top),
   "and calls the numbers illustrative rather than letting them pass as data",
   "");
ok(renderToStaticMarkup(<Limits />).includes("record counts"),
   "the limits panel leads with the one that cannot be worked around", "");

// ---- motion is opt-out ------------------------------------------------
const sheet = (top.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || "";
ok(/@keyframes/.test(sheet), "the animation is a real stylesheet keyframe", sheet);
ok(/prefers-reduced-motion/.test(sheet),
   "and the opt-out ships in the SAME stylesheet — a media query in another "
   + "file can be dropped on its own", sheet);
for (const cls of ["cp360ef-live", "cp360ef-node"]) {
  ok(new RegExp(`prefers-reduced-motion[\\s\\S]*${cls}`).test(sheet),
     `${cls} is disabled under reduced motion`, sheet);
}
// Under SSR there is no matchMedia, so the hook's initial value decides
// what a reader with no JS, or a reader mid-hydration, gets. It must be
// "no motion": starting animated and then stopping is the wrong default.
// Matched as an APPLIED class, not as a bare name: the stylesheet in the
// same markup declares both selectors, so a bare-name search can never
// fail and would be a test that always passes.
ok(!/class="[^"]*cp360ef-(node|live)/.test(top),
   "nothing is animated in the first paint — reduced motion is the initial "
   + "assumption and autoplay is a deliberate post-mount decision", 
   (top.match(/class="[^"]*cp360ef-[^"]*"/) || [])[0]);

// ---- it is reachable from Event 360 -----------------------------------
import fs from "node:fs";
import path2 from "node:path";
function findSrc() {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    for (const rel of ["src", path2.join("ui", "src")]) {
      const c = path2.join(dir, rel);
      if (fs.existsSync(path2.join(c, "EventFlowSim.jsx"))) return c;
    }
    dir = path2.dirname(dir);
  }
  throw new Error("could not locate ui/src from " + process.cwd());
}
const E360 = fs.readFileSync(path2.join(findSrc(), "Event360.jsx"), "utf8")
  .split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
ok(/import\s+EventFlowSim\s+from/.test(E360), "Event360 imports it", "");
ok(/\['run',\s*'Run-through'\]/.test(E360), "and gives it a tab", "");
ok(/tab === 'run' && <EventFlowSim \/>/.test(E360),
   "and renders it with no props — this module's components read the palette "
   + "directly, and the last prop passed to a tab here was an identifier that "
   + "had never existed", "");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nevent-flow-sim assertions pass");
if (bad) process.exit(1);
