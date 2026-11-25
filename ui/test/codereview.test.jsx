// Code Review 360: the page renders from handed-in payloads, the numbers
// derive from the rows, the detail shows findings and the Copilot steps,
// the standards tab lists the rules, and nothing on the page is a host or
// an address.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
import CodeReview360 from "../src/CodeReview360.jsx";
import { counts, SEVERITIES } from "../src/codeReviewApi.js";

let BAD = 0;
const ok = (c, m, got = "") => { console.log((c ? "ok   " : "FAIL ") + m + (c ? "" : `  -> ${String(got).slice(0, 220)}`)); if (!c) BAD += 1; };
const tLight = { accent: "#0f4775", navy: "#0f4775", text: "#1a1a1a", sub: "#4a5560", textMuted: "#7a8690", border: "#d9dee3", panel: "#ffffff", bg: "#f4f6f8", radius: { md: 6 } };
const tDark = { ...tLight, text: "#eef2f5", sub: "#b7c0c8", textMuted: "#8793a0", border: "#2b3640", panel: "#1b232b", bg: "#121820" };

const reviews = [
  { id: "cr1", repo: "acme/hub", ref: "feature/CP-12-fanout", kind: "pr", number: 12, verdict: "REQUEST_CHANGES", status: "awaiting_copilot", source: "rules", findings_n: 9, created_at: "2026-11-25 10:00" },
  { id: "cr2", repo: "acme/hub", ref: "feature/CP-9", kind: "pr", number: 9, verdict: "APPROVE", status: "final", source: "rules+copilot", findings_n: 1, created_at: "2026-11-24 09:00" },
];
const findings = [
  { rule: "CP360-CR-AF-001", severity: "blocker", file: "dags/eod.py", line: 18, title: "Gate and ingest tasks never retry", message: "default_args sets retries=3 for every task.", fix: "retries=0 in default_args.", source: "rule" },
  { rule: "CP360-CR-PY-005", severity: "high", file: "hub/poll.py", line: 14, title: "Outbound calls have a timeout and a circuit breaker", message: "requests.get() without a timeout.", fix: "timeout=(connect, read).", source: "rule" },
  { rule: "CP360-CR-GEN-004", severity: "medium", file: "dags/eod.py", line: null, title: "Reviewer finding", message: "No design component named in the module docstring.", fix: "Add the component number.", source: "copilot" },
];
const detail = { review: { id: "cr1", repo: "acme/hub", ref: "feature/CP-12-fanout", number: 12, verdict: "REQUEST_CHANGES", status: "awaiting_copilot", source: "rules", summary: "", report_md: "# CP 360 code review · acme/hub\n\n**Verdict: REQUEST_CHANGES**" }, findings };
const standards = { areas: { AF: "Airflow DAGs", DBT: "dbt models" }, rules: [
  { id: "CP360-CR-AF-001", area: "AF", sev: "blocker", auto: true, title: "Gate and ingest tasks never retry", text: "retries=0 on every gate task.", ref: "18 Airflow DAG fan-out, AD-9" },
  { id: "CP360-CR-DBT-007", area: "DBT", sev: "medium", auto: false, title: "Bitemporal columns stay behind the facade", text: "Consumers see is_current='Y' shapes only.", ref: "16 Gold dbt" }] };

console.log("-- numbers");
const c = counts(findings);
ok(c.blocker === 1 && c.high === 1 && c.medium === 1 && c.low === 0 && SEVERITIES.length === 5, "counts derive from the findings", JSON.stringify(c));

console.log("-- the page");
const page = renderToStaticMarkup(<CodeReview360 t={tLight} initial={{ reviews, health: { githubToken: true, webhookSecret: true, llm: "none", post: true }, open: "cr1", detail }} />);
ok(/Code Review 360/.test(page) && /judgement by Copilot/.test(page) && /webhook secret set/.test(page), "the page says what it is and what is configured");
ok(/>2<\/div>/.test(page) && /awaiting Copilot/.test(page) && /request changes/.test(page), "the tiles derive from the list");
ok(/feature\/CP-12-fanout/.test(page) && /Request changes/.test(page) && /Rules done · awaiting Copilot/.test(page) && /rules\+copilot/.test(page), "the list shows repository, change, verdict, status and source");
ok(/Download the Copilot pack/.test(page) && /copilot-prompt-cr1\.md/.test(page) && /answer in the output contract/.test(page) && /Paste Copilot&#x27;s answer|Paste Copilot's answer/.test(page) && /Build the final report/.test(page), "the detail carries the pack download, the Copilot instruction and the paste box");
ok(/CP360-CR-AF-001/.test(page) && /dags\/eod\.py:18/.test(page) && /retries=3/.test(page) && /No design component named/.test(page) && /copilot</.test(page), "findings with rule, place, message and who found them");
ok(/The report as posted/.test(page) && /Verdict: REQUEST_CHANGES/.test(page), "the posted Markdown is there to read");
const std = renderToStaticMarkup(<CodeReview360 t={tDark} initial={{ reviews: [], tab: "Standards", standards }} />);
ok(/Airflow DAGs/.test(std) && /CP360-CR-AF-001/.test(std) && /18 Airflow DAG fan-out, AD-9/.test(std) && />rule</.test(std) && />reviewer</.test(std), "the standards tab lists rules with their design and whether a rule or the reviewer enforces them");
const how = renderToStaticMarkup(<CodeReview360 t={tLight} initial={{ reviews: [], tab: "How it works" }} />);
ok(/GitHub calls the webhook/.test(how) && /Copilot writes the judgement half/.test(how) && /CR_WEBHOOK_SECRET/.test(how), "how it works, in five steps, with the setup");
const empty = renderToStaticMarkup(<CodeReview360 t={tLight} initial={{ reviews: [] }} />);
ok(/No reviews yet/.test(empty) && /Review a pull request now/.test(empty), "the empty state says what to do");
ok(!/NaN|undefined|\[object Object\]/.test(page + std + how + empty), "nothing undefined, light or dark");
ok(!/[\w.+-]+@[\w-]+\.[\w.-]+/.test(page + std + how) && !/testbbh|\.bbh\.com/i.test(page + std + how), "no address and no host on any screen");

console.log("-- wired in");
const SRC = fs.existsSync("src/CodeReview360.jsx") ? "src" : path.join("ui", "src");
const shell = fs.readFileSync(path.join(SRC, "AppShell.jsx"), "utf8"), app = fs.readFileSync(path.join(SRC, "App.jsx"), "utf8"), client = fs.readFileSync(path.join(SRC, "codeReviewApi.js"), "utf8");
ok(/\['codereview', 'Code Review 360'/.test(shell) && /group: 'Governance'[\s\S]*?codereview/.test(shell), "Code Review 360 sits under Governance");
ok(/import CodeReview360 from "\.\/CodeReview360\.jsx"/.test(app) && /codereview: <CodeReview360 t=\{t\} \/>/.test(app), "and routes to the page");
ok(!/from "\.\/api\.js"/.test(client), "the client is self-contained");
const root = path.join(SRC, "..", "..");
ok(fs.existsSync(path.join(root, "codereview", "standards.py")) && fs.existsSync(path.join(root, "sql", "89_codereview.sql")) && fs.existsSync(path.join(root, "docs", "CODE_REVIEW.md")), "the package, the SQL and the guide are in the repository");

console.log();
if (BAD) { console.log(`${BAD} assertion(s) failed`); process.exit(1); }
console.log("codereview assertions pass");
