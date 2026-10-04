// CP Integration Hub — Discussion.
//
// THE THREE THINGS THIS PINS:
//
//   ADDITIVE. The brief was "don't change anything in the current Hub".
//   HubDesign.jsx must gain lines and lose none — asserted against the
//   committed version, not by eye.
//
//   THE STATUS MODEL. "has replies" is not "answered" and "answered" is
//   not "resolved". Those three collapse into one green tick in every
//   review tool that dies, so statusOf and acceptAnswer are pure and
//   exported and this runs them.
//
//   EDITING AN ACCEPTED ANSWER WITHDRAWS THE ACCEPTANCE. An answer that
//   was agreed and then quietly rewritten is worse than no answer.
//
//   And t.navy is a SURFACE in the dark theme, so it is never ink. I
//   wrote this bug into this very file on the first pass.
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { renderToStaticMarkup } from "react-dom/server";
import HubDiscussion, { statusOf, acceptAnswer, editAnswer, compLabel,
  Expanded, sty, onAnswer, Attach, Attachments } from "../src/HubDiscussion.jsx";
import { QUESTIONS, TOPICS, OWNERS, OWNER_TOTALS, compsFor }
  from "../src/hubQuestions.js";
import { emptyStore, attachKindFor } from "../src/hub_discussion_api.js";
import { SEED_ANSWERS, seedRows, materialise, seedId }
  from "../src/hubAnswers.js";
import { FIGS } from "../src/HubAnswerFigs.jsx";
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
      if (fs.existsSync(path.join(c, "HubDiscussion.jsx"))) return c;
    }
    dir = path.dirname(dir);
  }
  throw new Error("could not locate ui/src from " + process.cwd());
}
const SRC = findSrc();
const ROOT = path.join(SRC, "..", "..");
const strip = (f) => fs.readFileSync(path.join(ROOT, f), "utf8")
  .split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
const DISC = strip("ui/src/HubDiscussion.jsx");

// ---- the corpus matches the review's own published totals -----------
ok(QUESTIONS.length === 108, "all 108 questions are present", QUESTIONS.length);
ok(TOPICS.length === 17, "in 17 topic groups", TOPICS.length);
const nums = QUESTIONS.map((q) => q.n);
ok(nums.every((n, i) => n === i + 1),
   "numbered 1..108 with no gaps — the numbers are how people refer to "
   + "them in the meeting", nums.filter((n, i) => n !== i + 1).slice(0, 5));
const derived = {};
QUESTIONS.forEach((q) => { derived[q.owner] = (derived[q.owner] || 0) + 1; });
for (const [k, n] of Object.entries(OWNER_TOTALS)) {
  ok(derived[k] === n,
     `${OWNERS[k].name}: the summary says ${n} and the rows give ${derived[k]}`,
     `${derived[k]} vs ${n}`);
}
ok(Object.values(derived).reduce((a, b) => a + b, 0) === 108,
   "and they add to 108 — re-assign a question without updating the "
   + "summary and this fails rather than the screen disagreeing with the "
   + "document in everyone's inbox", "");
ok(QUESTIONS.every((q) => compsFor(q).length > 0),
   "every question resolves to at least one component — an unlinked one is "
   + "findable only by scrolling", QUESTIONS.filter((q) => !compsFor(q).length)
     .map((q) => q.n).slice(0, 6));
ok(/Stage 2 Enriched/.test(compLabel("15")) && compLabel("zzz") === "zzz",
   "a chip reads “15 Stage 2 Enriched (dbt)”, and an unknown id degrades to "
   + "the id rather than to undefined", compLabel("15"));

// ---- the status model, RUN not read ---------------------------------
const Q = { n: 62 };
ok(statusOf(Q, [], {}) === "open", "no answers → open", statusOf(Q, [], {}));
ok(statusOf(Q, [{ qid: 62, accepted: false }], {}) === "answered",
   "a reply makes it ANSWERED, not resolved — this is the distinction that "
   + "keeps a thread honest", statusOf(Q, [{ qid: 62 }], {}));
ok(statusOf(Q, [{ qid: 62, accepted: true }], {}) === "resolved",
   "an ACCEPTED answer makes it resolved", "");
ok(statusOf(Q, [{ qid: 61, accepted: true }], {}) === "open",
   "another question's accepted answer does not resolve this one",
   statusOf(Q, [{ qid: 61, accepted: true }], {}));
ok(statusOf(Q, [{ qid: 62, accepted: true }], { status: "blocked" }) === "blocked",
   "a human decision outranks the derived state", "");

// ---- acceptance records a person and a time -------------------------
// a2 starts ALREADY ACCEPTED and a3 belongs to a different question.
// Seeding a2 as unaccepted would let "only one can be accepted" pass with
// the sibling-clearing loop deleted — it did, on the first pass.
let s = { ...emptyStore(), a: {
  a1: { qid: 62, body: "one", author: "GM" },
  a2: { qid: 62, body: "two", author: "SA",
        accepted: true, acceptedBy: "K. Barnhardt", acceptedAt: "2026-01-01" },
  a3: { qid: 61, body: "other", author: "KK",
        accepted: true, acceptedBy: "K. Barnhardt", acceptedAt: "2026-01-01" } } };
s = acceptAnswer(s, 62, "a1", "Glenn Lasrado");
ok(s.a.a1.accepted && s.a.a1.acceptedBy === "Glenn Lasrado" && !!s.a.a1.acceptedAt,
   "accepting records WHO and WHEN — an answer accepted by nobody in "
   + "particular is a comment", JSON.stringify(s.a.a1));
ok(!s.a.a2.accepted && !s.a.a2.acceptedBy && !s.a.a2.acceptedAt,
   "and accepting a1 WITHDRAWS the acceptance a2 already had — two competing "
   + "resolutions on one question is the failure mode this prevents",
   JSON.stringify(s.a.a2));
ok(s.a.a3.accepted && s.a.a3.acceptedBy === "K. Barnhardt",
   "while another question's accepted answer is left alone — the clear is "
   + "scoped to the question, not to the store", JSON.stringify(s.a.a3));
ok(s.ev.length === 1 && s.ev[0].to === "resolved" && s.ev[0].actor === "Glenn Lasrado",
   "the transition is written to the audit trail", JSON.stringify(s.ev));

// ---- editing an accepted answer withdraws the acceptance ------------
const after = editAnswer(s, "a1", "one, revised", "G. Middha");
ok(!after.a.a1.accepted && !after.a.a1.acceptedBy,
   "editing an ACCEPTED answer clears the acceptance — the acceptor has to "
   + "look again at what they agreed to", JSON.stringify(after.a.a1));
ok(statusOf(Q, Object.values(after.a), {}) === "answered",
   "so the question drops back to answered", "");
ok(after.ev.length === 2 && /withdrawn/.test(after.ev[1].note),
   "and the withdrawal is recorded, not silent", JSON.stringify(after.ev[1]));
const plain = editAnswer(s, "a2", "two, revised", "SA");
ok(plain.ev.length === 1,
   "editing a NON-accepted answer writes no withdrawal event", plain.ev.length);
ok(plain.a.a2.updatedAt && plain.a.a2.body === "two, revised",
   "but does stamp updatedAt, which is what renders the “edited” marker", "");

// ---- the drafted answers --------------------------------------------
//
// The danger with seeding answers is not that one is wrong — it is that
// a draft reads as a decision. So: drafts never resolve anything, they
// always say what they do NOT settle, and they never carry a hostname.
const QN = new Set(QUESTIONS.map((x) => x.n));
ok(SEED_ANSWERS.every((a) => QN.has(a.n)),
   "every draft answers a question that exists",
   SEED_ANSWERS.filter((a) => !QN.has(a.n)).map((a) => a.n));
ok(new Set(SEED_ANSWERS.map((a) => a.n)).size === SEED_ANSWERS.length,
   "and no question has two drafts", "");
ok(SEED_ANSWERS.every((a) => a.gap && a.gap.length > 20),
   "EVERY draft states what it does not settle — the gap is the half a "
   + "reader must not mistake for a complete answer",
   SEED_ANSWERS.filter((a) => !a.gap).map((a) => a.n));
ok(SEED_ANSWERS.every((a) => a.ev && a.ev.length),
   "and every draft cites where it came from — an answer with no evidence "
   + "is an opinion in a document that is meant to settle things",
   SEED_ANSWERS.filter((a) => !(a.ev || []).length).map((a) => a.n));

// A draft is an answer, never a resolution.
const fresh = emptyStore();
const seeded = seedRows(fresh);
ok(seeded.length === SEED_ANSWERS.length, "drafts reach the thread",
   seeded.length);
ok(seeded.every((r) => r.draft === true && r.accepted === false),
   "every drafted row is marked draft and NOT accepted", "");
const freshStatus = QUESTIONS.map((x) => statusOf(x, seeded, {}));
ok(!freshStatus.includes("resolved"),
   "so a fresh screen shows ZERO resolved questions — 35 drafts must not "
   + "read as 35 settled decisions",
   freshStatus.filter((v) => v === "resolved").length);
ok(freshStatus.filter((v) => v === "answered").length === SEED_ANSWERS.length,
   "they land on ANSWERED, which is exactly what they are",
   freshStatus.filter((v) => v === "answered").length);

// Nothing in the environment sheet leaks: the sizing numbers are in the
// answers, the hostnames must not be.
const HOST = /\b[a-z0-9-]+\.(?:com|net|org|local)\b|testbbh|\bnjl|\bqcl|\bdvl|\brdl/i;
const leaks = SEED_ANSWERS.filter((a) => HOST.test(a.body + " " + a.gap));
ok(leaks.length === 0,
   "no draft reproduces a hostname from the topology sheet — the capacity "
   + "figures are the answer, the hosts are not",
   leaks.map((a) => a.n));

// Acting on a draft materialises it, and the question id survives.
const mats = materialise(fresh, seeded.find((r) => r.qid === 107));
ok(mats.a[seedId(107)] && mats.a[seedId(107)].qid === 107,
   "materialising a draft keeps its question id — accept and edit both "
   + "read store.a[id] and would otherwise orphan it",
   JSON.stringify(Object.keys(mats.a)));
ok(materialise(mats, seeded.find((r) => r.qid === 107)) === mats,
   "and materialising twice is a no-op, so an edit cannot be reverted by a "
   + "later render", "");
ok(seedRows(mats).every((r) => r.qid !== 107),
   "once materialised the draft is no longer re-emitted — otherwise the "
   + "edited copy and the original would both show",
   seedRows(mats).filter((r) => r.qid === 107).length);

// Both call sites go through onAnswer, so this is the composition the
// screen actually performs — starting from a store where the draft has
// NOT been materialised, which is the state a real first click is in.
const r107 = seeded.find((r) => r.qid === 107);
const viaAccept = onAnswer(fresh, r107, (st) => acceptAnswer(st, 107, seedId(107), "GL"));
ok(viaAccept.a[seedId(107)].accepted && viaAccept.a[seedId(107)].qid === 107,
   "accepting a draft straight from an empty store works and keeps the "
   + "question id — this is the first click anyone makes",
   JSON.stringify(viaAccept.a[seedId(107)]));
const viaEdit = onAnswer(fresh, r107, (st) => editAnswer(st, seedId(107), "redone", "KB"));
ok(viaEdit.a[seedId(107)].body === "redone" && viaEdit.a[seedId(107)].qid === 107,
   "and so does editing one", JSON.stringify(viaEdit.a[seedId(107)]));
ok(statusOf({ n: 107 }, [...Object.entries(viaAccept.a).map(([id, a]) => ({ ...a, id })),
              ...seedRows(viaAccept)], {}) === "resolved",
   "once a human accepts the draft the question IS resolved — a draft is "
   + "not a decision until somebody makes it one", "");

const acc = acceptAnswer(mats, 107, seedId(107), "Glenn Lasrado");
ok(acc.a[seedId(107)].accepted && acc.a[seedId(107)].acceptedBy === "Glenn Lasrado",
   "a draft can be accepted, which is how it becomes the component's "
   + "documentation", JSON.stringify(acc.a[seedId(107)].acceptedBy));
const edt = editAnswer(mats, seedId(107), "rewritten", "K. Barnhardt");
ok(edt.a[seedId(107)].body === "rewritten" && edt.a[seedId(107)].qid === 107
   && edt.a[seedId(107)].updatedAt,
   "and a draft can be edited, keeping its question id and stamping the "
   + "edit", JSON.stringify(edt.a[seedId(107)]));

// Figures.
const figNames = [...new Set(SEED_ANSWERS.filter((a) => a.fig).map((a) => a.fig))];
ok(figNames.length > 0 && figNames.every((f) => FIGS[f]),
   "every figure a draft names exists — a missing one renders nothing and "
   + "the answer silently loses its picture",
   figNames.filter((f) => !FIGS[f]));
const FIGSRC = strip("ui/src/HubAnswerFigs.jsx");
ok(!/t\.navy|t\.accent/.test(FIGSRC),
   "the figures use neither t.navy nor t.accent — both are SURFACES in the "
   + "dark theme", "");
// Labels that collide. Rendered SVG has no layout engine behind it, so
// two <text> elements on the same baseline can overlap and nothing
// complains — which is exactly what happened to the runstate figure: an
// annotation ran straight through the worker_id pill and only a
// screenshot showed it. Width is estimated, so the threshold is
// deliberately slack: this catches a label sitting ON another one, not
// a tight fit.
function overlaps(svg) {
  const out = [];
  const re = /<text([^>]*)>([\s\S]*?)<\/text>/g;
  const items = [];
  let m;
  while ((m = re.exec(svg))) {
    const at = m[1];
    const g = (k) => { const r = new RegExp(`${k}="([^"]*)"`).exec(at); return r && r[1]; };
    const txt = m[2].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    if (!txt) continue;
    const x = Number(g("x")), y = Number(g("y"));
    const fs = Number(g("font-size") || 10);
    const anchor = g("text-anchor") || "start";
    const w = txt.length * fs * 0.5;              // conservative
    const x0 = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
    items.push({ txt, y, x0, x1: x0 + w });
  }
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      if (Math.abs(a.y - b.y) > 5) continue;
      const ov = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      if (ov > 6) out.push(`"${a.txt.slice(0, 22)}" / "${b.txt.slice(0, 22)}" (${ov.toFixed(0)}px)`);
    }
  return out;
}
for (const [name, F] of Object.entries(FIGS)) {
  const h = renderToStaticMarkup(React.createElement(F));
  ok(/<svg/.test(h) && !/NaN|undefined/.test(h), `figure ${name} renders clean`,
     (h.match(/.{0,40}(NaN|undefined)/) || [])[0]);
  const ov = overlaps(h);
  ok(ov.length === 0, `figure ${name} has no labels sitting on top of each other`,
     ov.slice(0, 2).join(" · "));
  const vb = /viewBox="0 0 (\d+) (\d+)"/.exec(h);
  const ys = [...h.matchAll(/<text[^>]*\sy="(\d+(?:\.\d+)?)"/g)].map((r) => Number(r[1]));
  ok(vb && ys.every((y) => y <= Number(vb[2]) - 2),
     `figure ${name} keeps every label inside its viewBox`,
     vb ? `${Math.max(...ys)} vs ${vb[2]}` : "no viewBox");
}

// ---- the dark-theme surface trap ------------------------------------
ok(!/t\.navy/.test(DISC),
   "t.navy is never used in this file — it is #0a0f24 in the dark theme, a "
   + "SURFACE, and renders near-black ink on a near-black panel", "");

// ---- renders in both themes -----------------------------------------
for (const [tn, t] of [["light", tLight], ["dark", tDark]]) {
  const h = renderToStaticMarkup(<HubDiscussion t={t} />);
  ok(h.length > 2000, `renders in ${tn}`, h.length);
  ok(!/NaN|undefined|\[object Object\]/.test(h), `clean in ${tn}`,
     (h.match(/.{0,50}(NaN|undefined).{0,30}/) || [])[0]);
  ok(/108/.test(h) && /Kelley Barnhardt/.test(h),
     `the corpus reaches the screen in ${tn}`, "");
}
const html = renderToStaticMarkup(<HubDiscussion t={tLight} />);
ok(/local only/.test(html),
   "with no API it says it is local to this browser — a shared discussion "
   + "that is quietly private is worse than one that is openly local", "");
ok(/Ask a question/.test(html),
   "anyone can raise one, not just the five review owners", "");
// The thread itself only renders when a question is open, so drive the
// expanded view directly rather than asserting against the collapsed list.
const q107 = { ...QUESTIONS.find((x) => x.n === 107), comps: compsFor({ n: 107,
  topic: 17, comps: ["59", "63", "16"] }), over: {}, status: "answered" };
const ex = (t) => renderToStaticMarkup(
  <Expanded t={t} x={q107} S={sty(t)} answers={seedRows(emptyStore())}
    actor="tester" store={emptyStore()} commit={() => {}} onClose={() => {}}
    onOpenComponent={() => {}} setStatus={() => {}} addAnswer={() => {}}
    saveQuestionEdit={() => {}} />);
const exH = ex(tLight);
ok(/draft · not agreed/.test(exH),
   "a drafted answer is labelled on screen, in words and not only in "
   + "amber — colour alone is not a signal", "");
ok(/What this does not settle/.test(exH),
   "and its gap is on screen next to it, not in a footnote", "");
ok(/rollback_declared/.test(exH) && /<svg/.test(exH),
   "the figure the draft names is drawn in the thread", "");
ok(/guardrail_changeset/.test(exH),
   "and the evidence it cites is on screen, so the claim is checkable", "");
ok(!/✓ accepted answer/.test(exH),
   "a draft is NOT rendered as an accepted answer", "");
ok(/✎ edit/.test(exH) && /✓ accept/.test(exH),
   "and it is editable and acceptable like any other answer — which is the "
   + "whole point of drafting it rather than writing it into the document",
   "");
ok(!/NaN|undefined/.test(ex(tDark)), "the expanded thread is clean in dark too",
   (ex(tDark).match(/.{0,40}(NaN|undefined)/) || [])[0]);

// ---- persistence: every write names an operation --------------------
//
// The UI and the router are different languages, so nothing but a test
// connects them. An op the server does not implement fails with a 400
// the browser swallows, and the only symptom is that a change quietly
// does not persist.
const UI = strip("ui/src/HubDiscussion.jsx");
const uiOps = [...UI.matchAll(/op:\s*"([a-z]+\.[a-z]+)"/g)].map((m) => m[1]);
const PY = fs.readFileSync(path.join(ROOT, "api", "app",
  "routers_hub_discussion.py"), "utf8");
const srvOps = [...PY.matchAll(/o\.op\s*==\s*"([a-z]+\.[a-z]+)"/g)].map((m) => m[1]);
ok(uiOps.length >= 5, "the screen sends named operations, not whole-store saves",
   uiOps.join(","));
ok(srvOps.length >= 5, "and the router implements a set of them", srvOps.join(","));
ok(uiOps.every((o) => srvOps.includes(o)),
   "every operation the screen sends is one the router implements — a typo "
   + "here is a 400 the browser swallows and a change that silently does not "
   + "persist", uiOps.filter((o) => !srvOps.includes(o)).join(","));
ok(/answer\.seed/.test(UI) && srvOps.includes("answer.seed"),
   "including the one that materialises a drafted answer before accepting "
   + "or editing it", "");
ok(!/discussionApi\.save\(next\);\s*return;[\s\S]{0,40}applyOp/.test(UI)
   && /applyOp/.test(UI),
   "the screen reaches for applyOp, not a whole-document PUT", "");

// ---- attachments ----------------------------------------------------
ok(attachKindFor({ name: "a.svg", type: "" }) === "svg"
   && attachKindFor({ name: "a", type: "image/svg+xml" }) === "svg",
   "an SVG is routed to the sanitiser by extension OR by type — a file "
   + "named .txt holding SVG must not reach the image path",
   attachKindFor({ name: "a.svg", type: "" }));
ok(attachKindFor({ name: "a.png", type: "image/png" }) === "image",
   "a raster is routed to the byte path", "");
ok(attachKindFor({ name: "a.pdf", type: "application/pdf" }) === null
   && attachKindFor({}) === null,
   "and anything else is refused before it is read",
   attachKindFor({ name: "a.pdf", type: "application/pdf" }));

const offH = renderToStaticMarkup(
  <Attach t={tLight} S={sty(tLight)} live={false} target={{ qid: 1 }} />);
ok(/Attachments need the API/.test(offH) && !/<input/.test(offH),
   "with no API the control says why instead of offering a button that "
   + "cannot work", offH.slice(0, 160));
const onH = renderToStaticMarkup(
  <Attach t={tLight} S={sty(tLight)} live target={{ qid: 1 }} />);
ok(/<input[^>]*type="file"/.test(onH) && /accept="image\/\*,\.svg"/.test(onH),
   "with an API it offers a file picker for images and SVG", "");
ok(/paste SVG markup/.test(onH),
   "and a paste box, which is the real answer to “convert my image to SVG”: "
   + "export the SVG from the tool that drew it", "");
ok(/stays sharp/.test(onH) && /tracing one to SVG/.test(onH),
   "the control explains why a screenshot is NOT traced, rather than leaving "
   + "a convert button that makes things worse", "");

const att = [{ id: "t1", kind: "svg", filename: "flow.svg", note: "removed <script>" },
             { id: "t2", kind: "image", filename: "shot.png" }];
const attH = renderToStaticMarkup(
  <Attachments t={tLight} S={sty(tLight)} items={att} />);
ok(/<img /.test(attH) && /flow\.svg/.test(attH) && /shot\.png/.test(attH),
   "attachments render", attH.slice(0, 120));
ok(!/dangerouslySetInnerHTML/.test(UI),
   "and NOTHING in this screen injects raw html — an uploaded SVG is drawn "
   + "through <img>, which does not execute script even if the sanitiser "
   + "missed some", "");
ok(/sanitised/.test(attH),
   "an SVG that was altered says so, so a diagram that renders oddly is "
   + "explainable", attH);
ok(/onError|could not load/.test(UI),
   "an attachment that fails to load says so — the browser's broken-image "
   + "glyph cannot distinguish a deleted row from an API that is down, and "
   + "this screen is a record", "");
ok(renderToStaticMarkup(<Attachments t={tLight} S={sty(tLight)} items={[]} />) === "",
   "and no attachments renders nothing at all", "");

// ---- the sourcing document stays in step with the drafts ------------
//
// docs/PROMPT-review-question-sourcing.md buckets every UNANSWERED
// question by who can actually answer it. The moment a draft is written
// the question has to leave those buckets, or the document sends someone
// to extract an answer that already exists. Counting it by hand got the
// bucket sizes wrong twice, so it is counted here instead.
const DOC = path.join(ROOT, "docs", "PROMPT-review-question-sourcing.md");
if (fs.existsSync(DOC)) {
  const md = fs.readFileSync(DOC, "utf8");
  const buckets = md.split("## Bucket").slice(1).map((sec) => {
    const set = new Set();
    sec.split("\n")
      .filter((l) => l.startsWith("|") && !/^\|\s*-/.test(l))
      .forEach((l) => {
        const cells = l.split("|");
        if (cells.length < 4) return;              // questions are column 2
        (cells[2].match(/\b\d{1,3}\b/g) || []).forEach((n) => {
          const v = Number(n);
          if (v >= 1 && v <= 108) set.add(v);
        });
      });
    return set;
  });
  const bucketed = new Set(buckets.flatMap((b) => [...b]));
  const answered = new Set(SEED_ANSWERS.map((a) => a.n));
  const openQs = QUESTIONS.filter((x) => !answered.has(x.n)).map((x) => x.n);
  ok(buckets.length === 3, "the document still has three buckets", buckets.length);
  ok(openQs.every((n) => bucketed.has(n)),
     "every unanswered question is bucketed — an unbucketed one is a question "
     + "nobody has been told how to source",
     openQs.filter((n) => !bucketed.has(n)).join(","));
  ok(![...bucketed].some((n) => answered.has(n)),
     "and no bucketed question already has a draft — otherwise the document "
     + "sends someone to extract an answer that is already on the screen",
     [...bucketed].filter((n) => answered.has(n)).join(","));
  const dup = [];
  for (let i = 0; i < buckets.length; i++)
    for (let j = i + 1; j < buckets.length; j++)
      [...buckets[i]].forEach((n) => { if (buckets[j].has(n)) dup.push(n); });
  ok(dup.length === 0, "the buckets are disjoint — one question, one owner",
     dup.join(","));
  const sizes = buckets.map((b) => b.size);
  const stated = [...md.matchAll(/^## Bucket [ABC][^(]*\((\d+)\)/gm)]
    .map((m) => Number(m[1]));
  ok(stated.length === 3 && stated.every((v, i) => v === sizes[i]),
     "and each heading's count matches the rows under it — I got both of "
     + "these wrong counting by hand", `${stated.join("/")} vs ${sizes.join("/")}`);
}

// ---- ADDITIVE: the existing Hub gains lines and loses none ----------
// Anchored to the commit that INTRODUCED the tab, not to HEAD. The first
// version of this guard diffed against HEAD, which made it vacuous the
// moment the work was committed: added dropped to 0 and the assertion
// failed for the wrong reason, and had it been written as `removed === 0`
// alone it would have passed forever while saying nothing.
const git = (...a) => execFileSync("git", ["-C", ROOT, ...a], { encoding: "utf8" }).trim();
let base = "";
try {
  const adds = git("log", "--diff-filter=A", "--format=%H", "--",
                   "ui/src/HubDiscussion.jsx").split("\n").filter(Boolean);
  if (adds.length) base = `${adds[adds.length - 1]}^`;
} catch { /* not committed yet — fall through to HEAD */ }
const diff = git("diff", base || "HEAD", "--numstat", "--", "ui/src/HubDesign.jsx");
const [added, removed] = diff ? diff.split(/\s+/).map(Number) : [0, 0];
ok(base !== "",
   "the guard is anchored to the commit that introduced the Discussion tab, "
   + "so it keeps meaning something after the work is committed",
   base || "no such commit — falling back to HEAD");
ok(removed === 0,
   "HubDesign.jsx has NO removed lines since before the tab existed — the "
   + "brief was to add a tab, not to change the Hub", `+${added} -${removed}`);
ok(added > 0 && added < 25,
   "and only a handful of added ones: an import, a branch and a pill",
   `+${added}`);
const HUB = strip("ui/src/HubDesign.jsx");
ok(/import HubDiscussion from "\.\/HubDiscussion\.jsx"/.test(HUB)
   && /view === "DISC"/.test(HUB) && /setView\("DISC"\)/.test(HUB),
   "the three edits are the import, the branch and the entry point", "");
ok(/onOpenComponent=\{\(id\)/.test(HUB) && /setView\("L3"\)/.test(HUB),
   "and a linked component opens in L3 — the loop back to the architecture "
   + "is what makes this a design record rather than a message board", "");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nhub-discussion assertions pass");
if (bad) process.exit(1);
