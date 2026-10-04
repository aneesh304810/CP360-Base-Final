// Emit the review corpus as JSON for the Oracle loader.
//
// ONE SOURCE, TWO CONSUMERS. The corpus is authored in JS because that
// is where it is tested and where the drafted answers are written with
// their figures and evidence. The loader is Python. Rather than have
// Python parse JS, or have the corpus typed out twice, this writes the
// JSON both agree on, and it is committed so the loader never needs
// node.
//
// Run: node ui/scripts/export_hub_corpus.mjs
import fs from "node:fs";
import path from "node:path";
import { OWNERS, OWNER_TOTALS, TOPICS, QUESTIONS, compsFor }
  from "../src/hubQuestions.js";
import { SEED_ANSWERS, seedId, SEED_AUTHOR } from "../src/hubAnswers.js";

const out = {
  generated_from: "ui/src/hubQuestions.js + ui/src/hubAnswers.js",
  owners: Object.entries(OWNERS).map(([code, o]) => ({
    owner_code: code, name: o.name, focus: o.focus,
    declared_total: OWNER_TOTALS[code] ?? null,
  })),
  topics: TOPICS.map((t, i) => ({
    topic_no: t.no, title: t.title, comps: (t.comps || []).join(","),
    sort_order: i + 1,
  })),
  questions: QUESTIONS.map((q) => ({
    qid: q.n, source: "review", seeded: "Y", topic: q.topic,
    owner_code: q.owner, body: q.body,
    comps: compsFor(q).join(","), note: q.note || null,
  })),
  answers: SEED_ANSWERS.map((a) => ({
    answer_id: seedId(a.n), qid: a.n, body: a.body, author: SEED_AUTHOR,
    is_draft: "Y", conf: a.conf, gap: a.gap || null, quote: a.quote || null,
    fig: a.fig || null, ev: (a.ev || []).join(" | "),
  })),
};

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
const dest = path.join(root, "data", "hub_corpus.json");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 1) + "\n");
console.log(`${dest}: ${out.questions.length} questions, `
  + `${out.answers.length} answers, ${out.topics.length} topics, `
  + `${out.owners.length} owners`);
