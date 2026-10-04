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
import HubDiscussion, { statusOf, acceptAnswer, editAnswer, compLabel }
  from "../src/HubDiscussion.jsx";
import { QUESTIONS, TOPICS, OWNERS, OWNER_TOTALS, compsFor }
  from "../src/hubQuestions.js";
import { emptyStore } from "../src/hub_discussion_api.js";
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

// ---- ADDITIVE: the existing Hub gains lines and loses none ----------
const diff = execFileSync("git",
  ["-C", ROOT, "diff", "HEAD", "--numstat", "--", "ui/src/HubDesign.jsx"],
  { encoding: "utf8" }).trim();
const [added, removed] = diff ? diff.split(/\s+/).map(Number) : [0, 0];
ok(removed === 0,
   "HubDesign.jsx has NO removed lines — the brief was to add a tab, not to "
   + "change the Hub", `+${added} -${removed}`);
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
