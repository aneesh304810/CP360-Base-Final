// Event 360's Design tab: the decision record for notify-then-pull.
//
// The tab is data plus a render. The data is what the test checks: every
// risk has a handling and a mark, every operating rule has bullets, the
// questions for SEI exist, and nothing on the page is a hostname. The
// render check exists for the reason event360-render.test.jsx gives: a
// palette read that fails only in the browser.
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import EventDesign, { DESIGN, MARK } from "../src/EventDesign.jsx";

let bad = 0;
const ok = (c, m, got) => { console.log(`${c ? "ok  " : "FAIL"} ${m}${c ? "" : `  -> ${String(got).slice(0, 200)}`}`); if (!c) bad++; };
const SRC = fs.existsSync("src/Event360.jsx") ? "src" : path.join("ui", "src");

const html = renderToStaticMarkup(<EventDesign />);
ok(html.length > 6000 && !/NaN|undefined|\[object Object\]/.test(html), "the tab renders cleanly", html.length);
ok(/THE DESIGN WE ARE GOING WITH/.test(html) && /Notify-then-pull/.test(html), "it states the decision, not a comparison of options");
ok(/role="img"/.test(html) && /aria-label="[^"]{200,}/.test(html), "the path figure carries a sentence a reader without the picture can use");

const marks = Object.keys(MARK);
ok(DESIGN.cons.length >= 7 && DESIGN.cons.every((c) => c.length === 4 && c[2].length > 20 && marks.includes(c[3])),
   "every risk has a handling and one of the three marks", DESIGN.cons.map((c) => c[3]).join(","));
ok(DESIGN.bottlenecks.length === 6 && DESIGN.bottlenecks.every((b) => b[3].length > 20), "six bottlenecks, each with a mitigation");
const topics = DESIGN.rules.map((r) => r[0]);
for (const t of ["Duplicates", "Errors", "Replay", "Deletes and op collisions", "Ordering", "Consistency", "Fan-out", "The gate", "Monitoring and SLAs"]) {
  ok(topics.includes(t), `the operating rules cover ${t}`, topics.join(" | "));
}
ok(DESIGN.rules.every((r) => marks.includes(r[1]) && r[2].length >= 2), "every rule is marked and has at least two bullets");
ok(DESIGN.rules.find((r) => r[0] === "Duplicates")[1] === "DECIDED" && DESIGN.rules.find((r) => r[0] === "Fan-out")[1] === "ASK SEI",
   "duplicates are settled by the idempotency label; fan-out is SEI's to answer");
ok(DESIGN.rules.find((r) => r[0] === "Replay")[2].some((b) => /End timestamp/.test(b)) && DESIGN.rules.find((r) => r[0] === "Errors")[2].some((b) => /dead-letter/.test(b)),
   "replay reads as of the batch's End timestamp; errors go to a dead letter that blocks SUCCESS");
ok(DESIGN.askSei.length >= 5 && DESIGN.askSei.every((q) => /\?$/.test(q)), "the questions for SEI are questions");
ok(DESIGN.pros.length >= 6 && DESIGN.components.length >= 6, "pros and components are listed");
ok(DESIGN.listener.length === 6 && /LISTENED/.test(DESIGN.listener[0][1]) && /SUCCESS/.test(DESIGN.listener[5][1]) && /after the downstream load succeeds/.test(DESIGN.listener[5][2]),
   "the listener has six steps, from mark LISTENED to mark SUCCESS, and SUCCESS waits for downstream");
ok(DESIGN.checkpoint.map((c) => c[0]).join() === "partition_id,offset,microbatch_id,processing_status" && DESIGN.staging.length === 7,
   "the checkpoint and staging models carry the deck's fields");
ok(DESIGN.builds.length === 6 && DESIGN.registry.rows.every((r) => r.length === 3) && /deterministic only while/.test(DESIGN.registry.rule),
   "six BBH builds, and the composite-key registry with its ordering rule");
ok(DESIGN.consumer.length === 5 && /Bound values only/.test(DESIGN.consumer[3][2]) && /dead letter/.test(DESIGN.consumer[1][2]) && /IN-list/.test(DESIGN.consumer[2][2]),
   "the consumer has five steps: bound values, allowlist to the dead letter, keys grouped per view");
ok(/The listener, step by step/.test(html) && /The consumer, step by step/.test(html) && /Composite keys and the registry/.test(html) && /What BBH builds/.test(html) && /The window\./.test(html),
   "the new sections render");

const src = fs.readFileSync(path.join(SRC, "EventDesign.jsx"), "utf8");
ok(!/https?:\/\/|\.com\b|testbbh|apps\.ocp/.test(src), "no URL or hostname on the page");
ok(/not stored here/.test(src), "the page says the deck is SEI material and is not stored in the repo");
const e360 = fs.readFileSync(path.join(SRC, "Event360.jsx"), "utf8");
ok(/import EventDesign from '\.\/EventDesign\.jsx'/.test(e360) && /\['dsn', 'Design'\]/.test(e360) && /tab === 'dsn' && <EventDesign \/>/.test(e360),
   "Event 360 carries the tab");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nevent-design assertions pass");
if (bad) process.exit(1);
