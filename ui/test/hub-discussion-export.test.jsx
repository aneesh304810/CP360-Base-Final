// Exporting the review questions with their answers and images.
//
// WHAT THIS PINS:
//
//   SELF-CONTAINED. The file must open on a laptop with no VPN, five years
//   from now. So: no reference to the API, no <script>, every image either
//   embedded or visibly declared missing. A test that only checked "the
//   html mentions the attachment" would pass on a file full of broken
//   images.
//
//   AN ATTACHMENT IS NEVER PASTED IN AS MARKUP. They are sanitised on the
//   way in, but an export travels further than the app and gets opened
//   from the filesystem. <img src="data:..."> cannot run script whatever
//   the SVG contains; <svg> in the document body can.
//
//   ANSWERS ARE ESCAPED. They are free text typed by people.
//
//   THE FILTER IS IN THE FILE. Exporting 12 of 108 and having it read as
//   the whole review is the failure mode worth a test.
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { buildExportHtml, exportFilename, figKeysIn, attIdsIn, esc, para }
  from "../src/hubDiscussionExport.js";
import { FIGS, FIG_NAMES } from "../src/HubAnswerFigs.jsx";
import { QUESTIONS, TOPICS, OWNERS } from "../src/hubQuestions.js";

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
      if (fs.existsSync(path.join(c, "HubDiscussion.jsx"))) return c;
    }
    dir = path.dirname(dir);
  }
  throw new Error("HubDiscussion.jsx not found");
}
const SRC = srcDir();
const DISC = fs.readFileSync(path.join(SRC, "HubDiscussion.jsx"), "utf8");

const topics = [{ no: 1, title: "SEI Data Structure" },
  { no: 2, title: "Stage 2 / INT Layer" }];
const owners = { KB: { name: "Kelley Barnhardt" }, GL: { name: "Glenn Lasrado" } };
const rows = [
  { n: 1, topic: 1, owner: "KB", body: "What does enriched mean?",
    comps: ["15", "40"], status: "resolved" },
  { n: 2, topic: 2, owner: "GL", body: "Where does STG persist?",
    comps: [], status: "open" },
];
const ANS = {
  1: [{ id: "a1", qid: 1, body: "First line.\n\nSecond para.\nSame para.",
        author: "kb", createdAt: "2026-10-01 09:00", accepted: true,
        acceptedBy: "GL", acceptedAt: "2026-10-02 10:00",
        signoff: "I agree this is the design", fig: "layers" }],
  2: [],
};
const answersOf = (n) => ANS[n] || [];

/* ------------------------------------------------------- escaping */
ok(esc('<script>alert(1)</script>') === "&lt;script&gt;alert(1)&lt;/script&gt;",
   "esc neutralises a tag", esc("<script>"));
ok(/<p>a<br>b<\/p>/.test(para("a\nb")),
   "a single newline becomes a line break", para("a\nb"));
ok((para("a\n\nb").match(/<p>/g) || []).length === 2,
   "a blank line starts a new paragraph", para("a\n\nb"));

const evil = [{ n: 9, topic: 1, owner: "KB", comps: [], status: "answered",
  body: '<img src=x onerror="alert(1)">' }];
const evilAns = () => [{ id: "e1", body: "</div><script>alert(2)</script>",
  author: '<b>me</b>', createdAt: "x" }];
const evilHtml = buildExportHtml({ rows: evil, answersOf: evilAns, topics,
  owners, figs: {}, atts: {}, meta: {} });
ok(!/<script/i.test(evilHtml),
   "an answer containing a script tag cannot put one in the file",
   (evilHtml.match(/.{0,40}<script.{0,20}/i) || [])[0]);
// The handler survives as TEXT, which is the point - it is shown, not run.
ok(/&lt;img src=x onerror=/.test(evilHtml) && !/<img src=x/i.test(evilHtml),
   "a question body carrying an inline handler is shown as text, never as "
   + "a live tag", (evilHtml.match(/.{0,50}onerror.{0,25}/i) || [])[0]);
ok(/&lt;b&gt;me&lt;\/b&gt;/.test(evilHtml),
   "the author name is escaped too, not just the bodies", "");

/* ------------------------------------------------- what it contains */
const figs = { layers: renderToStaticMarkup(React.createElement(FIGS.layers)) };
const atts = { a1: [
  { id: "t1", filename: "diagram.svg", kind: "svg",
    dataUrl: "data:image/svg+xml;base64,PHN2Zy8+" },
  { id: "t2", filename: "lost.png", kind: "png", dataUrl: null,
    error: "HTTP 503" }] };
const html = buildExportHtml({ rows, answersOf, topics, owners, figs, atts,
  meta: { at: "2026-10-06 12:00", by: "aneesh", live: true, filtered: false,
    total: 2 } });

ok(/What does enriched mean\?/.test(html) && /Where does STG persist\?/.test(html),
   "every question in the set is in the file", "");
ok(/First line\./.test(html) && /Second para\./.test(html),
   "and every answer body", "");
ok(/Accepted<\/b> by GL/.test(html) && /I agree this is the design/.test(html),
   "an accepted answer carries who accepted it AND the wording they agreed "
   + "to - 'resolved' on its own says only that a button was pressed", "");
ok(/No answer yet/.test(html),
   "a question with no answer says so rather than appearing answered", "");
ok(/<svg/.test(html),
   "the built-in figure is embedded as inline SVG", html.length);
ok(/<img src="data:image\/svg\+xml;base64,/.test(html),
   "an attachment is embedded as a data URI", "");
ok(/lost\.png/.test(html) && /HTTP 503/.test(html)
   && /still on the server/.test(html),
   "and one that could not be fetched becomes a visible note naming the "
   + "reason, not a broken image", "");

// THE SAFETY RULE. An attachment reaches the file only through <img>.
const attBlocks = html.split('class="att"').slice(1);
ok(attBlocks.length > 0 && attBlocks.every((b) =>
     !/<svg/i.test(b.slice(0, b.indexOf("</div>")))),
   "no attachment is pasted into the document as markup - every one goes "
   + "through <img>, which cannot run script whatever the file contains", "");

/* ------------------------------------------------- self-contained */
ok(!/src="https?:/i.test(html) && !/src="\/api/i.test(html),
   "nothing in the file is loaded over the network",
   (html.match(/src="[^"]{0,40}/g) || []).filter((x) => !/data:/.test(x)).join(" "));
ok(!/<script/i.test(html), "and there is no script in it at all", "");
ok(/@media print/.test(html),
   "it carries print rules, because the first thing anyone does with it is "
   + "make a PDF", "");

/* ------------------------------------------------------- the filter */
const part = buildExportHtml({ rows: [rows[0]], answersOf, topics, owners,
  figs: {}, atts: {}, meta: { filtered: true, total: 108,
    filterNote: "owner Kelley Barnhardt" } });
ok(/filtered export/i.test(part) && /1 of 108/.test(part)
   && /owner Kelley Barnhardt/.test(part),
   "a filtered export says so, how many of how many, and which filter",
   (part.match(/.{0,80}filtered export.{0,120}/i) || [])[0]);
ok(/Complete export/.test(html) && !/filtered export/i.test(html),
   "and an unfiltered one says it is complete", "");
const localHtml = buildExportHtml({ rows, answersOf, topics, owners, figs: {},
  atts: {}, meta: { live: false } });
ok(/local copy/.test(localHtml) && /may be missing/.test(localHtml),
   "an export taken while the API is down warns that other people's "
   + "answers may be missing - a review file that is quietly partial is "
   + "worse than one that admits it", "");

/* ------------------------------------------------------- collection */
ok(figKeysIn(rows, answersOf).join(",") === "layers",
   "only the figures actually used are collected",
   figKeysIn(rows, answersOf).join(","));
ok(attIdsIn(rows, answersOf, atts).length === 2,
   "and only the attachments hanging off an exported answer",
   attIdsIn(rows, answersOf, atts).length);
ok(/^cp360-hub-questions-all-\d{4}-\d{2}-\d{2}\.html$/
     .test(exportFilename({ at: "2026-10-06T12:00", filtered: false }))
   && /filtered/.test(exportFilename({ at: "2026-10-06T12:00", filtered: true })),
   "the filename carries the date and whether it was filtered - two files "
   + "in a downloads folder have to be tellable apart",
   exportFilename({ at: "2026-10-06T12:00", filtered: true }));

/* --------------------------------------- every figure, and the real set */
const figFails = [];
FIG_NAMES.forEach((k) => {
  try {
    const m = renderToStaticMarkup(React.createElement(FIGS[k]));
    if (!/<svg/.test(m)) figFails.push(k + ":no svg");
  } catch (e) { figFails.push(k + ":" + e.message); }
});
ok(figFails.length === 0,
   `all ${FIG_NAMES.length} built-in figures render to SVG for the export`,
   figFails.join(" | "));

const allRows = QUESTIONS.map((x) => ({ ...x, comps: [], status: "open" }));
let bigHtml = "";
try {
  bigHtml = buildExportHtml({ rows: allRows, answersOf: () => [], topics: TOPICS,
    owners: OWNERS, figs: {}, atts: {}, meta: { filtered: false } });
} catch (e) { ok(false, "the whole question set exports", e.message); }
ok(bigHtml.length > 20000 && (bigHtml.match(/class="q"/g) || []).length
     === QUESTIONS.length,
   `all ${QUESTIONS.length} questions reach the file, one block each`,
   (bigHtml.match(/class="q"/g) || []).length);
ok((bigHtml.match(/<h2>/g) || []).length
     === new Set(QUESTIONS.map((q) => q.topic)).size,
   "grouped by topic, one heading per topic that has questions",
   (bigHtml.match(/<h2>/g) || []).length);

/* ---------------------------------------------------------- wiring */
ok(/runExport/.test(DISC) && /Export \$\{rows\.length\}/.test(DISC),
   "the control is wired and offers to export what is on screen, by count",
   "");
ok(/await import\("react-dom\/server"\)/.test(DISC),
   "the server renderer is imported on demand - about 40KB nobody needs "
   + "until they press export", "");
ok(/readAsDataURL/.test(DISC),
   "attachments are read into the file rather than linked", "");
ok(/catch \(e\) \{\s*return \{ \.\.\.att, dataUrl: null/.test(DISC),
   "and one that will not fetch is caught per attachment, so a single bad "
   + "image cannot fail the whole export", "");
ok(/finally \{ setExporting\(false\); \}/.test(DISC),
   "the button always comes back, even when the export throws", "");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nhub-discussion-export assertions pass");
if (bad) process.exit(1);
