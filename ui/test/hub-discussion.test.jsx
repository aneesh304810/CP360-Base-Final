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
  Expanded, sty, onAnswer, Attach, Attachments, canSignOff, SIGNOFF_TEXT }
  from "../src/HubDiscussion.jsx";
import { QUESTIONS, TOPICS, OWNERS, OWNER_TOTALS, compsFor }
  from "../src/hubQuestions.js";
import { emptyStore, attachKindFor } from "../src/hub_discussion_api.js";
import { SEED_ANSWERS, seedRows, materialise, seedId, CONF, SEI_GAP_NOTE }
  from "../src/hubAnswers.js";
import { FIGS } from "../src/HubAnswerFigs.jsx";
import { tLight, tDark } from "../src/bbhTheme.js";
import { DBTDOC_ALIGN, DBTDOC_VERDICTS, DBTDOC_MISSING, DBTDOC_SELF_CONFLICT, DBTDOC_NAME,
  DBTDOC_SOURCE } from "../src/hubDbtDocAlignment.js";
import DocDrill, { docFor } from "../src/DocDrill.jsx";
import { SEI_DOCS, SEI_BOUNDARY, SEI_STAGES, SEI_COMPONENTS, SEI_TABLES,
  SEI_STATES, SEI_OPEN, SEI_ASSUMPTIONS, SEI_NOT_BUILT }
  from "../src/seiBaseline.js";
import { REGISTRY, REG_STATE, BBH_LAYERS, BBH_EXTENSION }
  from "../src/hubComponentRegistry.js";
import { TRACKER_COMPONENTS } from "../src/seiDesignTracker.js";

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
const UI_SRC = DISC;

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

// ---- accepting is a SIGN-OFF, not a click ---------------------------
//
// There is no login on this screen, so the only thing standing between
// an audit trail and "resolved by local.user" is this.
for (const [name, want] of [["Kelley Barnhardt", true], ["Glenn Lasrado", true],
                            ["local.user", false], ["", false], ["   ", false],
                            ["me", false], ["GL", false], ["tester", false],
                            ["unknown", false], ["12345", false]]) {
  ok(canSignOff(name) === want,
     `canSignOff(${JSON.stringify(name)}) is ${want}`, canSignOff(name));
}
let threw = null;
try { acceptAnswer({ a: { z: { qid: 1 } }, q: {}, ev: [] }, 1, "z", "local.user"); }
catch (err) { threw = err; }
ok(threw && /real name/.test(threw.message),
   "acceptAnswer REFUSES the session default — a sign-off by local.user "
   + "looks signed and is not, which is worse than an unsigned one",
   threw && threw.message);

const sg = acceptAnswer({ a: { z: { qid: 1 } }, q: {}, ev: [] }, 1, "z",
                        "  Kelley Barnhardt  ", SIGNOFF_TEXT);
ok(sg.a.z.acceptedBy === "Kelley Barnhardt",
   "the name is trimmed before it is recorded", JSON.stringify(sg.a.z.acceptedBy));
ok(sg.a.z.signoff === SIGNOFF_TEXT,
   "and the WORDING they agreed to is stored on the row, not just the fact "
   + "of a click — if the wording changes later, old rows keep theirs",
   sg.a.z.signoff);
ok(/I accept it as BBH's position/.test(SIGNOFF_TEXT),
   "and that wording actually says they accept it", SIGNOFF_TEXT);
ok(sg.ev[0].actor === "Kelley Barnhardt" && sg.ev[0].note.includes(SIGNOFF_TEXT),
   "the audit event carries the signer and the statement", JSON.stringify(sg.ev[0]));

// Signing off a second answer clears the first one's signature too.
let two = { ...emptyStore(), a: {
  p: { qid: 9, accepted: true, acceptedBy: "Glenn Lasrado", signoff: SIGNOFF_TEXT },
  r: { qid: 9 } } };
two = acceptAnswer(two, 9, "r", "Kelley Barnhardt");
ok(!two.a.p.accepted && !two.a.p.signoff,
   "accepting a different answer withdraws the earlier signature as well as "
   + "the acceptance — a withdrawn acceptance that keeps its sign-off still "
   + "reads as signed", JSON.stringify(two.a.p));

// ---- editing an accepted answer withdraws the acceptance ------------
const after = editAnswer(s, "a1", "one, revised", "G. Middha");
ok(!after.a.a1.accepted && !after.a.a1.acceptedBy,
   "editing an ACCEPTED answer clears the acceptance — the acceptor has to "
   + "look again at what they agreed to", JSON.stringify(after.a.a1));
ok(statusOf(Q, Object.values(after.a), {}) === "answered",
   "so the question drops back to answered", "");
ok(!after.a.a1.signoff,
   "editing also clears the sign-off wording — otherwise the row still "
   + "carries a statement nobody has agreed to about the new text", "");
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

// Every answer declares WHAT IT RESTS ON, and the class is load-bearing
// rather than decorative: a claim read out of a document has to carry
// the sentence it was read from. Without that rule the first answer
// extracted from the SEI PDF arrives looking exactly like one verified
// against a table in this repository.
ok(SEED_ANSWERS.every((a) => a.conf && CONF[a.conf]),
   "every draft declares its evidence class",
   SEED_ANSWERS.filter((a) => !CONF[a.conf]).map((a) => `${a.n}:${a.conf}`));
const fromDoc = SEED_ANSWERS.filter((a) => a.conf === "document");
ok(fromDoc.every((a) => a.quote && a.quote.length > 25),
   "an answer taken FROM A DOCUMENT carries the verbatim sentence it was "
   + "taken from — an uncited document claim is indistinguishable from one "
   + "that was invented, and reads as the vendor's position",
   fromDoc.filter((a) => !a.quote).map((a) => a.n));
ok(SEED_ANSWERS.filter((a) => a.conf === "codebase")
     .every((a) => (a.ev || []).some((e) => /sql\/|\.js|\.jsx|360|Compare/.test(e))),
   "and an answer from the CODEBASE names a file, table or screen, not just "
   + "a topic", SEED_ANSWERS.filter((a) => a.conf === "codebase"
     && !(a.ev || []).some((e) => /sql\/|\.js|\.jsx|360|Compare/.test(e)))
     .map((a) => a.n));
ok(!SEED_ANSWERS.some((a) => a.conf === "no_data" || /^NO DATA$/.test(a.body)),
   "a NO DATA answer is never loaded as a draft — on screen it would read as "
   + "the question having been dealt with, which is worse than showing no "
   + "answer at all",
   SEED_ANSWERS.filter((a) => a.conf === "no_data").map((a) => a.n));

// The prompt in docs/ tells people what JSON to send back. If its field
// names drift from the ones the screen reads, the answers load silently
// missing their quote or their gap.
const PDOC = path.join(ROOT, "docs", "PROMPT-answer-open-questions.md");
if (fs.existsSync(PDOC)) {
  const md = fs.readFileSync(PDOC, "utf8");
  const asked = [...md.matchAll(/^\s*"(\w+)":/gm)].map((m) => m[1]);
  const known = new Set(["n", "conf", "body", "gap", "quote", "ev", "fig"]);
  ok(asked.length >= 5, "the prompt specifies a return shape", asked.join(","));
  ok(asked.every((k) => known.has(k)),
     "and every field it asks for is one the screen actually reads — a field "
     + "the prompt invents is data that arrives and is silently dropped",
     asked.filter((k) => !known.has(k)).join(","));
  for (const k of ["conf", "quote", "gap", "ev"]) {
    ok(asked.includes(k),
       `the prompt asks for ${k}, which the screen renders`, asked.join(","));
  }
  const classes = [...md.matchAll(/^ {2}(document|absence|inference|no_data) {2,}\S/gm)]
    .map((m) => m[1]);
  ok(new Set(classes).size === 4,
     "the prompt defines all four evidence classes, including no_data — the "
     + "one that makes refusing an expected outcome rather than a failure",
     [...new Set(classes)].join(","));
  ok(classes.filter((c) => c !== "no_data").every((c) => CONF[c]),
     "and each class it can return is one the screen can render a badge for",
     classes.filter((c) => c !== "no_data" && !CONF[c]).join(","));
}

// This used to assert that nothing had been extracted yet. The first
// extraction arrived, so it is now the standing rule that replaces it: a
// document answer names WHERE in the document, not just which document.
// "SEI Architecture" is not checkable; "SEI Architecture p.6" is.
ok(fromDoc.every((a) => (a.ev || []).some((e) => /p\.\s?\d|§|page|sheet|tab/i.test(e))),
   "every document answer cites a page or section — a citation nobody can "
   + "turn to is the same as no citation",
   fromDoc.filter((a) => !(a.ev || []).some((e) => /p\.\s?\d|§/i.test(e)))
     .map((a) => a.n));
ok(fromDoc.every((a) => a.quote.length >= 40 && /[a-z]{4}/.test(a.quote)),
   "and the quote is a sentence rather than a fragment", 
   fromDoc.filter((a) => a.quote.length < 40).map((a) => a.n));

// "practice" is a SUGGESTION, and the whole risk of adding it is that it
// stops reading as one. Three rules keep it honest.
const prac = SEED_ANSWERS.filter((a) => a.conf === "practice");
ok(prac.length > 0 && prac.every((a) => !a.quote),
   "no industry-practice answer carries a quote — there is no source text, "
   + "and a quote would make a recommendation look like a citation",
   prac.filter((a) => a.quote).map((a) => a.n));
// A bare "dbt design doc §6.4.1" on a suggestion reads as though the document
// recommended it. Where a practice answer points at a document it is a
// cross-reference, and the parenthetical says so. Q76 had a bare one.
const bare = (e) => /^(dbt design document|SEI |sql\/)/.test(e) && !e.includes("(");
ok(prac.every((a) => !(a.ev || []).some(bare)),
   "its evidence never passes itself off as the source — a document it "
   + "points at is parenthesised as a cross-reference",
   prac.filter((a) => (a.ev || []).some(bare))
     .map((a) => `${a.n}: ${(a.ev || []).filter(bare).join("; ")}`).join(" | "));
// These twenty go in front of a business audience and, through the SEI
// asks, in front of the vendor. Unexplained platform jargon loses that
// reader on the sentence it appears in.
const JARGON = /\b(RWX|ReadWriteMany|ReadWriteOnce|SIGTERM|OOM|kubectl|idempotenc?[ty]|DAG|upsert|dead[- ]letter|exponential backoff)\b/i;
ok(prac.every((a) => !JARGON.test(
     `${a.body} ${a.gap || ""} ${a.seiAsk || ""}`)),
   "no BBH recommendation uses unexplained platform jargon — these are "
   + "read by a business audience, and the SEI asks are read by the "
   + "vendor",
   prac.filter((a) => JARGON.test(`${a.body} ${a.gap || ""} ${a.seiAsk || ""}`))
     .map((a) => `${a.n}: ${(JARGON.exec(a.body + a.gap) || [])[0]}`).join(", "));
ok(prac.every((a) => a.gap && a.gap.length > 30),
   "and every one names what BBH still has to decide — a recommendation "
   + "that hides the choice is worse than no recommendation",
   prac.filter((a) => !a.gap).map((a) => a.n));
ok(CONF.practice && /BBH/.test(CONF.practice.label)
   && /SEI/.test(CONF.practice.label),
   "the badge names both sides: BBH's recommendation, against the SEI "
   + "analysis", CONF.practice && CONF.practice.label);

// The provenance note is ONE constant, not twenty bodies, so it cannot
// drift into twenty slightly different claims about what SEI did.
ok(/Raised by BBH/.test(SEI_GAP_NOTE) && /supersedes/.test(SEI_GAP_NOTE),
   "the standing note says the recommendation is BBH's and that SEI's text "
   + "wins if it covers the point", SEI_GAP_NOTE);
ok(/not .{0,24}statement that SEI omitted/.test(SEI_GAP_NOTE)
   || /not a statement that SEI/.test(SEI_GAP_NOTE),
   "and it does NOT accuse SEI of an omission — these questions were never "
   + "put to the SEI pack, and claiming a gap nobody searched for is how a "
   + "review loses an argument it was winning", SEI_GAP_NOTE);
const accuses = /SEI (does not|fails to|omits|has not|never) /i;
ok(!prac.some((a) => accuses.test(a.body) || accuses.test(a.gap || "")),
   "and no individual recommendation claims the SEI document lacks "
   + "something — the standing note is the only place provenance is "
   + "asserted", prac.filter((a) => accuses.test(a.body)).map((a) => a.n));

const asks = prac.filter((a) => a.seiAsk);
ok(asks.length >= 6 && asks.length < prac.length,
   "some recommendations carry a question for SEI and some do not — if "
   + "every one did, the distinction between a BBH-internal design choice "
   + "and an SEI contract question would be lost",
   `${asks.length} of ${prac.length}`);
ok(asks.every((a) => /\?/.test(a.seiAsk)),
   "and each SEI ask is phrased as a question somebody can put in an "
   + "email", asks.filter((a) => !/\?/.test(a.seiAsk)).map((a) => a.n));
// Asserted on the RENDERED THREAD, not on SEED_ANSWERS. seiAsk was
// dropped by seedRows and by the exporter on the first pass, so the data
// was perfect and the screen showed nothing — a guard that reads the
// corpus would have passed throughout.
const q58 = { ...QUESTIONS.find((x) => x.n === 58),
  comps: compsFor(QUESTIONS.find((x) => x.n === 58)), over: {}, status: "answered" };
const praH = renderToStaticMarkup(
  <Expanded t={tLight} x={q58} S={sty(tLight)} answers={seedRows(emptyStore())}
    actor="tester" store={emptyStore()} commit={() => {}} onClose={() => {}}
    onOpenComponent={() => {}} setStatus={() => {}} addAnswer={() => {}}
    saveQuestionEdit={() => {}} />);
ok(/Raised by BBH/.test(praH),
   "the provenance note reaches the screen — not just the data", "");
ok(/Ask SEI/.test(praH) && /Saturdays/.test(praH),
   "and so does the SEI ask, with its text — seedRows dropped this field "
   + "on the first pass and the corpus looked perfect", "");
ok(/BBH recommendation/.test(praH),
   "and the badge names it a BBH recommendation", "");
ok(/drafted from industry practice/.test(praH)
   && !/drafted from the codebase/.test(praH),
   "its byline says industry practice, not codebase — a byline that "
   + "argues with the badge beside it is the kind of detail a reviewer "
   + "notices and then distrusts the rest", "");
const seedRow58 = seedRows(emptyStore()).find((r) => r.qid === 58);
ok(seedRow58 && seedRow58.seiAsk,
   "seedRows carries seiAsk through — the field has to survive every hop, "
   + "not just exist in the source", JSON.stringify(Object.keys(seedRow58 || {})));

ok(SEED_ANSWERS.filter((a) => a.conf !== "practice").every((a) => !a.seiAsk),
   "only a BBH recommendation carries one — an SEI ask on an answer that "
   + "is already settled from a document is a question already answered",
   SEED_ANSWERS.filter((a) => a.conf !== "practice" && a.seiAsk).map((a) => a.n));

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
const viaAccept = onAnswer(fresh, r107, (st) => acceptAnswer(st, 107, seedId(107), "Glenn Lasrado"));
ok(viaAccept.a[seedId(107)].accepted && viaAccept.a[seedId(107)].qid === 107,
   "accepting a draft straight from an empty store works and keeps the "
   + "question id — this is the first click anyone makes",
   JSON.stringify(viaAccept.a[seedId(107)]));
const viaEdit = onAnswer(fresh, r107, (st) => editAnswer(st, seedId(107), "redone", "K. Barnhardt"));
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

// ---- the list row is a grid, so the counts have to agree ------------
//
// Adding a seventh child to a six-column grid does not error. It puts
// the child on an implicit second row, and every question in the list
// grew a stray answer count dangling underneath it. Nothing in the
// suite noticed, because the markup was valid and the component
// rendered.
const rowSrc = DISC.slice(DISC.indexOf("function Row("),
                          DISC.indexOf("function Row(") + 1600);
const rowKids = (rowSrc.match(/^ {6}<(span|Badge|i|div)/gm) || []).length;
const gridCols = ((DISC.match(/gridTemplateColumns: "([^"]+)"/) || [])[1] || "")
  .trim().split(/\s+/).filter(Boolean).length;
ok(gridCols > 0, "the list row declares a column template", gridCols);
ok(rowKids === gridCols,
   "the list row has exactly as many children as the grid has columns — "
   + "one more and the extra wraps onto a second line under every question",
   `${rowKids} children vs ${gridCols} columns`);

// And the signed-off name shares the status cell rather than claiming
// a column of its own.
const listH = renderToStaticMarkup(
  <HubDiscussion t={tLight} />);
ok(listH.length > 2000, "the list still renders", listH.length);

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
// Q103 is an "absence" answer, chosen deliberately: "from the codebase"
// also appears in the author line, so asserting on THAT label passes with
// the badge deleted. It did.
const q103 = { ...QUESTIONS.find((x) => x.n === 103),
  comps: compsFor(QUESTIONS.find((x) => x.n === 103)), over: {}, status: "answered" };
const absH = renderToStaticMarkup(
  <Expanded t={tLight} x={q103} S={sty(tLight)} answers={seedRows(emptyStore())}
    actor="tester" store={emptyStore()} commit={() => {}} onClose={() => {}}
    onOpenComponent={() => {}} setStatus={() => {}} addAnswer={() => {}}
    saveQuestionEdit={() => {}} />);
ok(/nothing recorded/.test(absH),
   "the evidence class is on screen beside the draft badge, so a reader can "
   + "see what an answer rests on without opening the file it cites", "");
// Lives here, not up with the other byline check: exH is declared on
// the line above, and referencing it earlier gave `undefined` rather
// than throwing, so the assertion failed for the wrong reason.
ok(/drafted from the codebase/.test(exH),
   "a codebase answer still says codebase in its byline", "");
ok((exH.match(/from the codebase/g) || []).length === 2,
   "and a codebase answer shows it twice — once as the author, once as the "
   + "class; one occurrence means the badge is gone",
   (exH.match(/from the codebase/g) || []).length);
ok(/What this does not settle/.test(exH),
   "and its gap is on screen next to it, not in a footnote", "");
ok(/rollback_declared/.test(exH) && /<svg/.test(exH),
   "the figure the draft names is drawn in the thread", "");
ok(/guardrail_changeset/.test(exH),
   "and the evidence it cites is on screen, so the claim is checkable", "");
ok(!/✓ accepted answer/.test(exH),
   "a draft is NOT rendered as an accepted answer", "");
// The sign-off panel, on the rendered screen.
const signH = renderToStaticMarkup(
  <Expanded t={tLight} x={q107} S={sty(tLight)} answers={seedRows(emptyStore())}
    actor="local.user" store={emptyStore()} commit={() => {}} onClose={() => {}}
    own={OWNERS} onOpenComponent={() => {}} setStatus={() => {}}
    addAnswer={() => {}} saveQuestionEdit={() => {}} />);
ok(!/select your name/i.test(signH),
   "the sign-off panel is not shown until accept is clicked", "");
ok(/no login on this screen/i.test(signH) === false,
   "and neither is the note that goes with it", "");

ok(/✎ edit/.test(exH) && /✓ accept/.test(exH),
   "and it is editable and acceptable like any other answer — which is the "
   + "whole point of drafting it rather than writing it into the document",
   "");
ok(!/NaN|undefined/.test(ex(tDark)), "the expanded thread is clean in dark too",
   (ex(tDark).match(/.{0,40}(NaN|undefined)/) || [])[0]);

// ---- the corpus now lives in the database ---------------------------
//
// data/hub_corpus.json is what the Oracle loader reads, generated from
// these two modules. If it drifts, the screen shows one corpus and the
// database holds another, and nothing else notices.
const CORPUS = path.join(ROOT, "data", "hub_corpus.json");
if (fs.existsSync(CORPUS)) {
  const c = JSON.parse(fs.readFileSync(CORPUS, "utf8"));
  ok(c.questions.length === QUESTIONS.length,
     "the exported corpus has the same number of questions as the module it "
     + "was generated from — re-run ui/scripts/export_hub_corpus.mjs",
     `${c.questions.length} vs ${QUESTIONS.length}`);
  ok(c.answers.length === SEED_ANSWERS.length,
     "and the same number of answers — adding a draft without re-exporting "
     + "means it never reaches the database",
     `${c.answers.length} vs ${SEED_ANSWERS.length}`);
  const byId = new Map(c.questions.map((q) => [q.qid, q]));
  ok(QUESTIONS.every((q) => (byId.get(q.n) || {}).body === q.body),
     "every question body matches, character for character",
     QUESTIONS.filter((q) => (byId.get(q.n) || {}).body !== q.body)
       .map((q) => q.n).slice(0, 4));
  const aById = new Map(c.answers.map((a) => [a.qid, a]));
  ok(SEED_ANSWERS.every((a) => (aById.get(a.n) || {}).conf === a.conf),
     "and every answer's evidence class survives the export",
     SEED_ANSWERS.filter((a) => (aById.get(a.n) || {}).conf !== a.conf)
       .map((a) => a.n));
  ok(SEED_ANSWERS.filter((a) => a.seiAsk)
       .every((a) => (aById.get(a.n) || {}).sei_ask),
     "every SEI ask survives the export into Oracle — it was dropped by "
     + "the exporter on the first pass, which would have left the column "
     + "empty in the database while the screen looked right",
     SEED_ANSWERS.filter((a) => a.seiAsk
       && !(aById.get(a.n) || {}).sei_ask).map((a) => a.n));
  ok(SEED_ANSWERS.filter((a) => a.conf === "document")
       .every((a) => (aById.get(a.n) || {}).quote),
     "a document answer keeps its quote through the export — the rule has "
     + "to survive the hop into Oracle, not just hold in the bundle", "");
  ok(c.topics.length === TOPICS.length && c.owners.length === 5,
     "topics and owners are exported too, so the screen does not read "
     + "questions from the database and their grouping from the bundle",
     `${c.topics.length}/${c.owners.length}`);
}

// With the corpus in the database the bundled drafts must NOT also be
// merged, or every draft shows twice. The component decides that on
// whether a corpus came back; this pins the rule it decides by.
ok(/corpus \? \[\] : seedRows\(store\)/.test(UI_SRC)
   || /!corpus[\s\S]{0,40}seedRows/.test(UI_SRC),
   "the bundled drafts are merged only when the database has no corpus — "
   + "otherwise every drafted answer appears twice", "");
ok(/from the database/.test(UI_SRC) && /bundled copy/.test(UI_SRC),
   "and the screen says which corpus it is showing, because a review "
   + "rendered from a stale bundle looks exactly like one rendered from "
   + "the database", "");

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
  // Buckets A and B say "a document should answer this", so a question
  // with a draft has to leave them. Bucket C says "no document answers
  // this; a person decides" — an absence draft there records that the
  // search was done and changes nothing about who decides, so it stays.
  ok(![...buckets[0]].some((n) => answered.has(n)),
     "no question in bucket A already has a draft — the SEI pack is still "
     + "expected to answer those, and a draft there would send someone to "
     + "extract an answer that is already on the screen",
     [...buckets[0]].filter((n) => answered.has(n)).join(","));
  const classOf = (n) => (SEED_ANSWERS.find((x) => x.n === n) || {}).conf;
  const cDrafts = [...buckets[2]].filter((n) => answered.has(n));
  ok(cDrafts.every((n) => classOf(n) === "absence"),
     "a bucket C question may only carry an ABSENCE draft — anything else "
     + "would be answering a decision nobody has made",
     cDrafts.filter((n) => classOf(n) !== "absence").join(","));
  // Bucket B says "a BBH document should answer this". A suggestion does
  // not, so it does not evict the question from the bucket — but nothing
  // stronger may sit there either, or the extraction would be skipped.
  const bDrafts = [...buckets[1]].filter((n) => answered.has(n));
  ok(bDrafts.every((n) => classOf(n) === "practice"),
     "and a bucket B question may only carry an INDUSTRY-PRACTICE draft — "
     + "the BBH design document still has to answer it, and a suggestion "
     + "sitting there must not look like it already did",
     bDrafts.filter((n) => classOf(n) !== "practice")
       .map((n) => `${n}:${classOf(n)}`).join(","));
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
// What replaces `removed === 0`: the Discussion tab was additive and must
// stay that way, so nothing it introduced may be edited out by later work
// on the Hub. Checked by marker rather than by arithmetic.
// This guard has now outlived its brief twice. "No removed lines" was
// right while the only ask was to add a tab; then the C4 was asked to be
// reconciled against the dbt design document, and the last ask was to REDRAW the
// processing band so it matches — which cannot be done by adding lines.
// Bumping a number each time would leave a guard that says nothing, so
// the line-count assertions are gone and the structural ones below take
// over: the tab's edits must survive, and the band must read in the
// design document's layer order.
ok(added > 0, "HubDesign.jsx has changed", `+${added} -${removed}`);
const HUB = strip("ui/src/HubDesign.jsx");
ok(/import HubDiscussion from "\.\/HubDiscussion\.jsx"/.test(HUB)
   && /view === "DISC"/.test(HUB) && /setView\("DISC"\)/.test(HUB),
   "the tab's three edits are the import, the branch and the entry point", "");
ok(/from "\.\/hubDbtDocAlignment\.jsx?"/.test(HUB) && /dbtDocFor\(c\)/.test(HUB),
   "and the design document alignment is read from its own module — the tracker is "
   + "generated from the workbook and must not be edited to carry it", "");
ok(/onOpenComponent=\{\(id\)/.test(HUB) && /setView\("L3"\)/.test(HUB),
   "and a linked component opens in L3 — the loop back to the architecture "
   + "is what makes this a design record rather than a message board", "");

// ---- the C4 against the dbt design document -------------------------------------
//
// This map makes claims about what a document says, which is the same
// risk as a `document` answer in hubAnswers.js and gets the same rules:
// cite the section or it is not checkable, and point at a component that
// exists or it renders nowhere and nobody notices.
//
// The rule underneath all of it: seiDesignTracker.js says at the top of
// itself that it is generated from the workbook. If a design-document name ever
// gets written INTO the tracker, the screen starts disagreeing with the
// thing delivery is tracked against, so that is asserted too.
const TIDS = Object.keys(DBTDOC_ALIGN);
const TRK = new Map(TRACKER_COMPONENTS.map((c) => [c.id, c]));
ok(TIDS.length > 20, "the alignment covers the Hub zone", TIDS.length);
ok(TIDS.every((id) => TRK.has(id)),
   "every alignment entry points at a component that exists in the tracker "
   + "— one that does not renders nowhere and is never seen to be wrong",
   TIDS.filter((id) => !TRK.has(id)).join(","));
ok(TIDS.every((id) => DBTDOC_VERDICTS[DBTDOC_ALIGN[id].v]),
   "and declares a verdict the screen can colour",
   TIDS.filter((id) => !DBTDOC_VERDICTS[DBTDOC_ALIGN[id].v])
     .map((id) => `${id}:${DBTDOC_ALIGN[id].v}`).join(","));
ok(TIDS.every((id) => /\u00a7|Appendix/.test(DBTDOC_ALIGN[id].ev)),
   "every entry cites a section or an appendix — a claim about a document "
   + "with no place in it is the vendor's word against ours",
   TIDS.filter((id) => !/\u00a7|Appendix/.test(DBTDOC_ALIGN[id].ev)).join(","));
ok(TIDS.every((id) => /p\.\s?\d/.test(DBTDOC_ALIGN[id].ev)),
   "and a page, so somebody can turn to it in the PDF",
   TIDS.filter((id) => !/p\.\s?\d/.test(DBTDOC_ALIGN[id].ev)).join(","));
ok(TIDS.every((id) => (DBTDOC_ALIGN[id].note || "").length > 80),
   "and says what the difference IS — a verdict with no body is a colour",
   TIDS.filter((id) => (DBTDOC_ALIGN[id].note || "").length <= 80).join(","));
// A verdict of "same" that carries no document-side name is pointless: the whole
// value of a matching component is showing the name the code will use.
ok(TIDS.every((id) => (DBTDOC_ALIGN[id].name || "").length > 3),
   "every entry names the design document's counterpart, including the matches — the "
   + "name in the document is the name that ends up in the code",
   TIDS.filter((id) => !(DBTDOC_ALIGN[id].name || "").length).join(","));
const conf = TIDS.filter((id) => DBTDOC_ALIGN[id].v === "conflict");
ok(conf.length > 0 && conf.length < TIDS.length,
   "some components conflict and some do not — an alignment where "
   + "everything disagrees is not an alignment, it is an argument",
   `${conf.length} of ${TIDS.length}`);
ok(Object.values(DBTDOC_MISSING).flat().every((m) => /\u00a7|Appendix/.test(m.ev)),
   "and the things the design document has that the C4 does not are cited the same way",
   "");
ok(/\u00a76\.1/.test(DBTDOC_SELF_CONFLICT.ev) && /\u00a72/.test(DBTDOC_SELF_CONFLICT.ev)
   && /section 2/i.test(DBTDOC_SELF_CONFLICT.body),
   "the design document's disagreement with ITSELF cites both sides of it — this is "
   + "the one claim a reviewer will check first", DBTDOC_SELF_CONFLICT.ev);
// WHAT THE COMPONENT MEANS, which is a different question from how it
// differs. The design documents are per-plane and per-layer, so arriving
// at one from a component used to open a document that never names it.
ok(TIDS.every((id) => (DBTDOC_ALIGN[id].what || "").length > 100),
   "every component has a plain definition, not just a verdict — a reader "
   + "who clicks a box is asking what it IS before asking how it differs",
   TIDS.filter((id) => (DBTDOC_ALIGN[id].what || "").length <= 100).join(","));
// A definition that needs the design document open to be understood has not defined
// anything. These go in front of a business reader.
const JARG = /\b(materiali[sz]ed|incremental strategy|ShortCircuitOperator|idempotent|DDL|DML|upsert|tag-based)\b/;
ok(TIDS.every((id) => !JARG.test(DBTDOC_ALIGN[id].what)),
   "and says it without platform jargon — the verdict note below it is "
   + "where the mechanics belong",
   TIDS.filter((id) => JARG.test(DBTDOC_ALIGN[id].what))
     .map((id) => `${id}: ${(JARG.exec(DBTDOC_ALIGN[id].what) || [])[0]}`).join(", "));
// Rendered, not just present: this is the whole point of the change.
const DD15 = renderToStaticMarkup(
  <DocDrill t={tLight} docKey={docFor(TRK.get("15"))} from={TRK.get("15")}
   onBack={() => {}} />);
ok(/WHAT #15/.test(DD15) && /STG is a view/.test(DD15),
   "and opening a component's design document leads with what that "
   + "component is — the documents are per-plane, so one arrived at from "
   + "#15 never used to name #15", "");
ok(/ONE BOX, TWO OBJECTS/.test(DD15) && /Appendix A\.3/.test(DD15),
   "with its verdict and a citation beside it", "");

// PROVENANCE. The title says BBH and the document is SEI's — SEI
// Professional Services is named on its document-control page as author
// and owner. This page asserted the opposite for a while, and it changes
// what every "conflict" below MEANS: not BBH's drawing against BBH's
// spec, but the C4 against SEI's specification of BBH's platform.
// "TDD" is retired. It meant two different SEI documents on this
// screen, it collides with test-driven development, and the reader who
// has to ask what it stands for is the reader this page is for. The
// documents are the BBH dbt Transformation Design Document and the BBH
// File Ingestion Framework Design Document, and the badge on each row
// says "dbt" rather than an acronym.
for (const f of ["ui/src/hubAnswers.js", "ui/src/hubDbtDocAlignment.js",
                 "ui/src/HubDesign.jsx", "ui/src/DocDrill.jsx"]) {
  const src = fs.readFileSync(path.join(ROOT, f), "utf8");
  ok(!/\bTDDs?\b/.test(src),
     `${f} calls them design documents, not TDDs`,
     (src.match(/.{0,40}\bTDDs?\b.{0,20}/g) || []).slice(0, 3).join(" | "));
}
ok(/Design Document/.test(DBTDOC_NAME) && /dbt/.test(DBTDOC_NAME),
   "and the document's own name says what it is", DBTDOC_NAME);

ok(/SEI/.test(DBTDOC_SOURCE),
   "the design document's author is recorded, and it is SEI", DBTDOC_SOURCE);
ok(/SEI/.test(DD15),
   "and travels with the citation on screen, so nobody reads a conflict "
   + "as an internal tidy-up", "");
const ALIGNSRC = strip("ui/src/hubDbtDocAlignment.js");
// Tightened: the claim this guards is "the design documents are BBH's",
// not the words "BBH's own", which appear innocently ("BBH's own tools").
const MISATTRIB = /BBH-side document|BBH's own design document|BBH's own design doc/;
ok(!MISATTRIB.test(ALIGNSRC + HUB),
   "and nothing still attributes a design document to BBH",
   ((ALIGNSRC + HUB).match(MISATTRIB) || []).join(","));
const PROMPTDOC = fs.readFileSync(
  path.join(ROOT, "docs", "PROMPT-review-question-sourcing.md"), "utf8");
ok(!/None of that is SEI's to describe/.test(PROMPTDOC),
   "the sourcing page no longer tells anyone that SEI cannot describe "
   + "DATE_CONTROL and the DAG structure — SEI specified both, down to "
   + "the DDL, and that sentence sent extractions to the wrong document",
   "");
ok(/SEI wrote the dbt design document/.test(PROMPTDOC),
   "and says who wrote it, where the claim used to be", "");

ok(/dbt/i.test(DBTDOC_NAME) && /Design Document/i.test(DBTDOC_NAME)
   && !/\bTDD\b/.test(DBTDOC_NAME),
   "the document is named once, as a constant, so twenty entries cannot "
   + "drift into twenty spellings of it", DBTDOC_NAME);

// The tracker is GENERATED. Carrying the design document's vocabulary into it would
// silently fork it from the workbook it is regenerated from.
const TRKRAW = fs.readFileSync(path.join(ROOT, "ui/src/seiDesignTracker.js"), "utf8");
const TRKSRC = strip("ui/src/seiDesignTracker.js");
ok(/generated from/i.test(TRKRAW),
   "the tracker still declares itself generated from the workbook — that "
   + "line is the reason the alignment is a separate file", "");
ok(!/SWP_RAW|DATE_CONTROL|DQ_VALIDATION_FAILURE|\bINT_|STG_/.test(TRKSRC),
   "and carries none of the design document's table names — the alignment lives in "
   + "its own module precisely so the workbook stays the workbook",
   (TRKSRC.match(/SWP_RAW|DATE_CONTROL|DQ_VALIDATION_FAILURE|\bINT_|STG_/g)
     || []).join(","));

// The L3 row's last cell is 196px and already holds the SEI citation
// chip and the design-doc chip. The first version of the design document indicator
// put the full verdict in there — "dbt \u00b7 ANOTHER DOCUMENT OWNS IT" —
// and it overlapped the status column on screen while looking perfectly
// fine in the source. Nothing about a grid cell errors when its content
// is too wide; it just draws over the neighbour.
const DBTDOCBADGE = /<span title=\{`dbt design document: \$\{[^`]*`\}[\s\S]{0,400}?>([^<]{1,40})<\/span>/
  .exec(HUB);
ok(DBTDOCBADGE, "the L3 row carries a design-document badge", "");
ok(DBTDOCBADGE && DBTDOCBADGE[1].trim().length <= 4,
   "and its visible text is at most four characters — the cell has about "
   + "50px spare and the long version drew over the status chip",
   DBTDOCBADGE && `${DBTDOCBADGE[1].trim().length}: ${DBTDOCBADGE[1].trim()}`);
ok(DBTDOCBADGE && /title=\{`dbt design document: \$\{DBTDOC_VERDICTS\[td\.v\]\[1\]\}/.test(HUB),
   "so the verdict it stands for is on hover, not lost — a four-letter "
   + "badge with no tooltip is decoration", "");
// Scoped to the ROW, not the panel: the expanded panel is full width and
// is exactly where the spelled-out verdict belongs.
const ROWSRC = HUB.slice(
  HUB.indexOf('gridTemplateColumns: "34px minmax(0,1.05fr)'),
  HUB.indexOf("{isX && (", HUB.indexOf('gridTemplateColumns: "34px minmax(0,1.05fr)')));
ok(ROWSRC.length > 400 && ROWSRC.length < 4000,
   "the L3 row markup is found to measure", ROWSRC.length);
ok(!/DBTDOC_VERDICTS\[td\.v\]\[1\]\.toUpperCase\(\)/.test(ROWSRC),
   "the full verdict is never put back into the ROW — it belongs in the "
   + "panel below, which has the width for it", "");

// The two divergences that are visible on the L2 drawing itself, which
// is the half of this a reviewer actually looks at.
// ---- the L2 diagram, rebuilt on SEI's documents ---------------------
//
// The old guards here asserted a seven-box processing band that no
// longer exists. The diagram is now generated from seiBaseline.js, so
// what is worth pinning changed with it: that the boxes ARE the
// baseline, that SEI's and BBH's are visually distinguishable, and
// that the event group stays collapsed by default.
const SB_IDS = [...HUB.matchAll(/<SB id="(S\d+)"/g)].map((m) => m[1]);
const BASE_IDS = new Set(SEI_COMPONENTS.map((c) => c.id));
ok(SB_IDS.length > 0 && SB_IDS.every((id) => BASE_IDS.has(id)),
   "every solid box on the diagram is a baseline component by id — the "
   + "drawing cannot drift from the citations because it does not carry "
   + "its own labels", SB_IDS.filter((id) => !BASE_IDS.has(id)).join(","));
const missingFromDiagram = [...BASE_IDS].filter((id) => !SB_IDS.includes(id));
ok(missingFromDiagram.length === 0,
   "and every baseline component is drawn — a component SEI specified "
   + "that is missing from the picture is the failure this replaces",
   missingFromDiagram.join(","));
// SEI solid, BBH dashed. The whole point of the redraw.
const BBHBOXES = [...HUB.matchAll(/<Box[^>]*id="(B\d+)"[^>]*\sbbh\b/g)]
  .map((m) => m[1]);
ok(BBHBOXES.length === BBH_EXTENSION.length,
   "BBH's own layers are drawn, and drawn dashed",
   `${BBHBOXES.length} of ${BBH_EXTENSION.length}`);
ok(!/<SB [^>]*\sbbh\b/.test(HUB),
   "and no baseline component is ever drawn as BBH's", "");
ok(!/Exadata/.test(HUB),
   "the Exadata tier is gone — it is in neither SEI document",
   (HUB.match(/.{0,40}Exadata.{0,20}/g) || []).join(" | "));
ok(/Pre-Gold/.test(HUB) && /mirror of IMDS and PBDW/.test(HUB),
   "but Pre-Gold survives as what BBH actually described: a mirror of "
   + "IMDS and PBDW, dashed and labelled as BBH's", "");
// The layer naming BBH gave, said on the drawing rather than buried.
ok(/one layer, three names/.test(HUB),
   "the drawing says Stage 2, Silver and Enriched are one layer", "");
ok(/normalised SWP data model/.test(HUB),
   "and that INT, DIM and FACT together are the normalised SWP model", "");
ok(/source DQ check/.test(HUB),
   "and that STG is the in-memory view whose job is the source DQ check", "");
// The seam between the two documents, on the picture.
ok(/only the run whose UPDATE changes one row/.test(HUB),
   "the handoff is drawn, not just described — it is the one place the "
   + "two documents touch", "");
// Events: kept, collapsed, expandable. The ask was explicit.
ok(/const \[evtOpen, setEvtOpen\] = useState\(false\)/.test(HUB),
   "the event group starts COLLAPSED — it used to dominate a diagram it "
   + "is only a proposal within", "");
ok(/setEvtOpen\(!evtOpen\)/.test(HUB) && /evtOpen && \(/.test(HUB),
   "and expands on click", "");

// ---- the C4 drill-down ----------------------------------------------
//
// Context -> containers -> components -> the design record. The value
// is in it being WHOLE: a level that cannot be reached, or one with no
// way back up, is worse than not having the level.
ok(/view === "SEIL3"/.test(HUB) && /view === "SEIL4"/.test(HUB),
   "the drill-down has a container level and a component level", "");
// Every band on the diagram must open something.
const STAGED = [...HUB.matchAll(/stage="([a-z]+)"/g)].map((m) => m[1]);
const STAGEK = new Set(SEI_STAGES.map((x) => x.k));
ok(STAGED.length > 0 && STAGED.every((k) => STAGEK.has(k)),
   "every clickable band names a real stage",
   STAGED.filter((k) => !STAGEK.has(k)).join(","));
ok([...STAGEK].every((k) => STAGED.includes(k)),
   "and every stage is reachable from the diagram — a container with no "
   + "way in is a container nobody opens",
   [...STAGEK].filter((k) => !STAGED.includes(k)).join(","));
ok(/setSeiComp\(id\); setView\("SEIL4"\)/.test(HUB),
   "and every component box opens its own record", "");
// Back up, at every level.
ok(/const Crumb = /.test(HUB)
   && (HUB.match(/<Crumb trail=\{\[/g) || []).length >= 2,
   "both levels carry a breadcrumb — a reader who has to use the "
   + "browser's back button has lost the hierarchy the diagram is for",
   (HUB.match(/<Crumb trail=\{\[/g) || []).length);
// L4 is only worth opening if it assembles something.
for (const [re, what] of [
  [/THE ORACLE OBJECTS IT TOUCHES/, "the Oracle objects"],
  [/STILL OPEN WITH SEI/, "what is still open with SEI"],
  [/WHAT BBH HAS AGAINST IT/, "what BBH has against it"],
  [/design document \u2192|design document →/, "the design document link"],
]) {
  ok(re.test(HUB), `the component record carries ${what}`, "");
}
// The links those sections read must resolve, or the record renders
// empty sections and looks broken rather than incomplete.
const TBLIDS = new Set(SEI_TABLES.map((x) => x.id));
const OPENIDS = new Set(SEI_OPEN.map((x) => x.id));
ok(SEI_COMPONENTS.every((c) => (c.tbl || []).every((x) => TBLIDS.has(x))),
   "every component's table links resolve",
   SEI_COMPONENTS.filter((c) => (c.tbl || []).some((x) => !TBLIDS.has(x)))
     .map((c) => c.id).join(","));
ok(SEI_COMPONENTS.every((c) => (c.open || []).every((x) => OPENIDS.has(x))),
   "and its open-decision links resolve",
   SEI_COMPONENTS.filter((c) => (c.open || []).some((x) => !OPENIDS.has(x)))
     .map((c) => c.id).join(","));
// Most components should touch something; an all-empty record means the
// links were never filled in.
ok(SEI_COMPONENTS.filter((c) => (c.tbl || []).length).length
     >= SEI_COMPONENTS.length * 0.6,
   "most components name the Oracle objects they touch",
   `${SEI_COMPONENTS.filter((c) => (c.tbl || []).length).length} of ${SEI_COMPONENTS.length}`);

// ---- the component registry ------------------------------------------
const REGIDS = Object.keys(REGISTRY);
const BASEALL = new Set([...SEI_COMPONENTS.map((c) => c.id),
                         ...SEI_TABLES.map((x) => x.id)]);
ok(REGIDS.length >= 65, "every tracker component has a registry verdict",
   REGIDS.length);
ok(TRACKER_COMPONENTS.every((c) => REGISTRY[c.id]),
   "and none is missing — a component with no verdict is the silent "
   + "omission this replaces",
   TRACKER_COMPONENTS.filter((c) => !REGISTRY[c.id]).map((c) => c.id).join(","));
ok(REGIDS.every((id) => REG_STATE[REGISTRY[id].st]),
   "each carries a state the screen can render",
   REGIDS.filter((id) => !REG_STATE[REGISTRY[id].st]).join(","));
ok(REGIDS.every((id) => (REGISTRY[id].sei || []).every((x) => BASEALL.has(x))),
   "and every cross-reference points at a real baseline entry",
   REGIDS.filter((id) => (REGISTRY[id].sei || []).some((x) => !BASEALL.has(x)))
     .join(","));
ok(REGIDS.filter((id) => REGISTRY[id].st === "specified")
     .every((id) => (REGISTRY[id].sei || []).length),
   "a SPECIFIED verdict names where in the baseline it is specified — "
   + "without that it is an assertion, not a cross-reference",
   REGIDS.filter((id) => REGISTRY[id].st === "specified"
     && !(REGISTRY[id].sei || []).length).join(","));
ok(REGIDS.filter((id) => REGISTRY[id].st === "absent")
     .every((id) => (REGISTRY[id].why || "").length > 20),
   "and an ABSENT verdict says why, because 'not in SEI' with no reason "
   + "reads as an oversight rather than a finding",
   REGIDS.filter((id) => REGISTRY[id].st === "absent"
     && (REGISTRY[id].why || "").length <= 20).join(","));
ok(REGIDS.filter((id) => REGISTRY[id].st === "differs")
     .every((id) => (REGISTRY[id].why || "").length > 40
       && (REGISTRY[id].sei || []).length),
   "a DIFFERS verdict carries both halves: what SEI does instead, and "
   + "where", REGIDS.filter((id) => REGISTRY[id].st === "differs"
     && !((REGISTRY[id].why || "").length > 40
       && (REGISTRY[id].sei || []).length)).join(","));
const differs = REGIDS.filter((id) => REGISTRY[id].st === "differs");
ok(differs.length >= 3 && differs.length < 20,
   "some components differ and most do not — if everything differed the "
   + "registry would be an argument rather than a reconciliation",
   `${differs.length} of ${REGIDS.length}`);
// BBH's layer model is recorded where it belongs: beside the registry,
// not inside the baseline, because SEI did not write it.
ok(/normalised SWP data model/.test(BBH_LAYERS.note)
   && /mirror of IMDS and PBDW/.test(BBH_LAYERS.beyond),
   "BBH's layer model is recorded in full", "");
ok(/not from either SEI document/.test(BBH_LAYERS.src),
   "and says plainly that it is not from SEI", BBH_LAYERS.src);
const BASESRC = strip("ui/src/seiBaseline.js");
ok(!/mirror of IMDS|Pre-Gold/.test(BASESRC),
   "and does not leak into the baseline — the baseline is SEI's text "
   + "only, and BBH's own reading of the layers is not in it",
   (BASESRC.match(/.{0,30}(mirror of IMDS|Pre-Gold).{0,20}/g) || []).join(" | "));

// ---- the SEI baseline -----------------------------------------------
//
// The instruction was to make SEI's own design the base and set the
// BBH-generated material aside. The value of that is entirely in the
// discipline: if one inferred box creeps in, the page stops being "what
// SEI committed to" and becomes another opinion with better typography.
// So the rules are asserted rather than intended.
const SEIALL = [...SEI_COMPONENTS, ...SEI_TABLES];
ok(SEI_COMPONENTS.length > 15 && SEI_TABLES.length >= 8,
   "the baseline covers both documents end to end",
   `${SEI_COMPONENTS.length} components, ${SEI_TABLES.length} tables`);
ok(SEIALL.every((x) => /\u00a7|Appendix|Glossary|Figure/.test(x.ev)),
   "every entry cites a section, appendix, glossary entry or figure — an "
   + "uncited box on this page is exactly the thing it exists to exclude",
   SEIALL.filter((x) => !/\u00a7|Appendix|Glossary|Figure/.test(x.ev))
     .map((x) => x.id).join(","));
ok(SEIALL.every((x) => /p\.\s?\d/.test(x.ev)),
   "and a page number, so a reader can turn to it",
   SEIALL.filter((x) => !/p\.\s?\d/.test(x.ev)).map((x) => x.id).join(","));
ok(SEI_NOT_BUILT.every((x) => /p\.\s?\d/.test(x.ev)),
   "including the exclusions — 'SEI says they are not building it' is a "
   + "strong claim and needs the strongest citation", "");
// Every component belongs to a stage that exists, or it renders nowhere.
const STK = new Set(SEI_STAGES.map((x) => x.k));
ok(SEI_COMPONENTS.every((c) => STK.has(c.s)),
   "every component sits in a declared stage",
   SEI_COMPONENTS.filter((c) => !STK.has(c.s)).map((c) => c.id).join(","));
ok(SEI_STAGES.every((st) => SEI_COMPONENTS.some((c) => c.s === st.k)),
   "and every stage has at least one, so no empty band renders",
   SEI_STAGES.filter((st) => !SEI_COMPONENTS.some((c) => c.s === st.k))
     .map((st) => st.k).join(","));

// THE RULE THAT MATTERS: no BBH-generated component name may appear.
// Checked against the tracker itself rather than against a list I keep
// in my head, because the tracker is where those names come from.
const BBHNAMES = TRACKER_COMPONENTS
  .map((c) => c.component)
  .filter((n) => n && n.length > 7
    && !/^Gold$|^Oracle|^Splunk|^Airflow/i.test(n));
const blob = JSON.stringify([SEI_COMPONENTS, SEI_TABLES, SEI_NOT_BUILT,
                             SEI_ASSUMPTIONS, SEI_BOUNDARY]);
const leaked = BBHNAMES.filter((n) => blob.includes(n));
ok(leaked.length === 0,
   "no BBH tracker component name appears in the SEI baseline — the two "
   + "models are kept apart on purpose, and the gap between them is a "
   + "later exercise", leaked.slice(0, 5).join(" | "));

// Both documents are SEI's, and the page says so rather than implying it.
ok(Object.values(SEI_DOCS).every((d) => /SEI/.test(d.author)),
   "both design documents name SEI as their author",
   Object.values(SEI_DOCS).map((d) => `${d.id}:${d.author}`).join(", "));
ok(Object.values(SEI_DOCS).every((d) => d.scope && d.hands_over),
   "and each says what it owns AND what it hands over — two documents "
   + "with no stated seam is how a gap goes unnoticed between them", "");
ok(/PENDING/.test(SEI_BOUNDARY.line) && /TRIGGER/.test(SEI_BOUNDARY.line),
   "the seam between them is named as a specific transition, not as a "
   + "vague boundary", SEI_BOUNDARY.line);

// SEI's open items keep SEI's ids: O-something from ingestion, D-something
// from the dbt document. A renumbered list cannot be put back to them.
ok(SEI_OPEN.every((o) => /^[OD]\d+$/.test(o.id)),
   "open decisions keep SEI's own ids, so they can be quoted back",
   SEI_OPEN.filter((o) => !/^[OD]\d+$/.test(o.id)).map((o) => o.id).join(","));
ok(SEI_OPEN.some((o) => o.doc === "ingest") && SEI_OPEN.some((o) => o.doc === "dbt"),
   "and both documents contribute some", "");
ok(SEI_ASSUMPTIONS.every((a) => a.a && a.x),
   "every assumption carries what breaks if it is wrong — an assumption "
   + "with no consequence is a sentence nobody acts on", "");
// The two state machines are the operational heart of the design.
ok(SEI_STATES.date_control.rows.length === 3
   && SEI_STATES.file_registry.rows.length === 7,
   "both state machines are complete: three business-date states and "
   + "seven file lifecycle states",
   `${SEI_STATES.date_control.rows.length} / ${SEI_STATES.file_registry.rows.length}`);
ok(SEI_STATES.file_registry.rows.some(([k]) => k === "ARCHIVE_FAILED"),
   "including ARCHIVE_FAILED — the one that must never reload RAW, and "
   + "the one a simplified lifecycle always drops", "");

// The screen: a branch, and a way in that says what it is.
ok(/view === "SEIBASE"/.test(HUB) && /setView\("SEIBASE"\)/.test(HUB),
   "the baseline has a view and an entry point", "");
ok(/the SEI baseline/.test(HUB),
   "and the way in says whose design it is", "");

// THIRD TIME. \uXXXX is an escape in a JS string and six literal
// characters in JSX text or a JSX attribute, and the two are
// indistinguishable in a diff. It has shipped twice. The file now holds
// real characters everywhere and this says so.
ok(!/\\u[0-9a-fA-F]{4}/.test(HUB),
   "HubDesign.jsx contains no \\uXXXX escape anywhere — in JSX text and "
   + "in a JSX attribute it is not an escape, it is six characters on "
   + "the screen",
   (HUB.match(/.{0,30}\\u[0-9a-fA-F]{4}.{0,10}/g) || []).slice(0, 3).join(" | "));

console.log(bad ? `\n${bad} assertion(s) failed` : "\nhub-discussion assertions pass");
if (bad) process.exit(1);
