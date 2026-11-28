// Integration 360 console: three levels with an address each. The history is
// synthetic until a DAG reports, the dashboard numbers derive from it, search
// finds identifiers, and the run level shows what went wrong, the bad records,
// the folded flow and data, and the notes.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
import Integration360Console from "../src/Integration360Console.jsx";
import { businessDates, syntheticHistory, mergeHistory, kpis, attention, dayBoard, searchAll, gridRows, periodDates, readQuery, writeQuery, levelOf, fmtDur } from "../src/integration360History.js";
import { PIPELINES } from "../src/hubPipelines.js";

let BAD = 0;
const ok = (c, m, got = "") => { console.log((c ? "ok   " : "FAIL ") + m + (c ? "" : `  -> ${String(got).slice(0, 220)}`)); if (!c) BAD += 1; };
const SRC = fs.existsSync("src/HubBusiness.jsx") ? "src" : path.join("ui", "src");
const t = { accent: "#0f4775", navy: "#0f4775", text: "#1a1a1a", sub: "#4a5560", textMuted: "#7a8690", border: "#d9dee3", panel: "#ffffff", bg: "#f4f6f8", radius: { md: 6 } };
const TODAY = "2026-11-27";

console.log("-- dates and the synthetic history");
const dates = businessDates(44, new Date("2026-11-27T12:00:00Z"));
ok(dates.length === 44 && dates[dates.length - 1] === "2026-11-27" && dates[dates.length - 2] === "2026-11-26" && !dates.some((d) => [0, 6].includes(new Date(d + "T00:00:00Z").getUTCDay())), "44 business dates ending today, weekends skipped");
const cash = PIPELINES.find((p) => p.id === "file-cash"), pos = PIPELINES.find((p) => p.id === "file-pos"), txn = PIPELINES.find((p) => p.id === "evt-txn");
const hc = syntheticHistory(cash, dates), hp = syntheticHistory(pos, dates), ht = syntheticHistory(txn, dates);
ok(hc[hc.length - 1].status === "red" && hc[hc.length - 1].cases.join() === "ge-001" && hc[hc.length - 1].bad_rows === 3 && hc[hc.length - 1].closed === "open" && hc.slice(0, -1).every((r) => r.status === "green"), "cash: red on the latest date with its case and three bad rows, green before");
ok(hp[hp.length - 1].status === "red" && hp[hp.length - 2].status === "amber" && hp[hp.length - 2].cases.join() === "dbt-002", "positions: red today, the warning case the day before");
ok(ht.every((r) => r.status === "green" && r.illustrative && r.duration_s > 0 && r.closed), "a healthy pipeline is green every day, with a duration and a close time");
ok(syntheticHistory(cash, dates)[3].duration_s === hc[3].duration_s, "the synthetic history is stable between calls");

console.log("-- live over synthetic");
const liveHist = { dags: { swp_cash_processing: [{ business_date: "2026-11-27", run_key: "swp_cash_processing:r1", state: "failed", status: "red", duration_s: 360, failed_task: "dbt_int", error_code: null, failing_checks: 1, check_names: ["not_null"], warnings: 0, bad_rows: 3, note: true, ended_at: "2026-11-27T22:06:00" }] } };
const merged = mergeHistory(dates, liveHist);
ok(merged["file-cash"].length === 44 && merged["file-cash"][43].illustrative === false && merged["file-cash"][43].closed === "open" && merged["file-cash"][42].status === "none" && merged["file-pos"][43].illustrative === true, "a dag that reported replaces its synthetic history; days it did not report are no run; others stay synthetic");

console.log("-- the dashboard numbers");
const hist = mergeHistory(dates, null);
const month = periodDates("month", TODAY, dates);
const k = kpis(hist, month);
ok(month.length === 20 && month[0] === "2026-11-02" && k.runs === 11 * 20 && k.failed === 6 && k.late === 6 && k.bad === 75 && k.live === 0 && k.planned === 1, "November: 20 business dates, 220 runs, 6 failed, 6 dates open, 75 bad records, nothing live yet", JSON.stringify(k));
ok(periodDates("day", TODAY, dates).length === 1 && periodDates("week", TODAY, dates).length === 5, "day and week periods");
const att = attention(hist, month);
ok(att.length === 7 && att[0].r.business_date === TODAY && att.every((a) => a.r.status !== "green") && att.some((a) => a.p.id === "file-cash" && /NULLs after the FX/.test(a.reason)) && att.some((a) => a.p.id === "file-pos" && a.r.status === "amber"), "needs attention: the six reds and the amber, newest first, each with its reason", att.map((a) => a.p.id + ":" + a.r.status).join());
const board = dayBoard(hist, TODAY);
ok(board.open && board.total === 11 && board.in === 5 && board.outstanding.length === 6 && board.channels.find((c) => c.ch === "file").total === 6, "the day's board: 11 pipelines, 5 in, 6 outstanding");
const g = gridRows(hist, month);
ok(g.length === 12 && g[0].cells.length === 20 && g.find((r) => r.p.id === "api-lookup").cells.every((c) => c.status === "planned"), "the month grid: a row per pipeline, a cell per date, the planned API greyed");

console.log("-- search");
const s1 = searchAll("xpf", hist, dates), s2 = searchAll("cash_balance_usd", hist, dates), s3 = searchAll("TRAILER", hist, dates), s4 = searchAll("swp_fee", hist, dates), s5 = searchAll("2026-11-27", hist, month);
ok(s1.cases.some((x) => x.p.id === "file-cash") && s2.cases.some((x) => /cash_balance_usd/.test(x.c.rule) || /cash_balance_usd/.test(x.c.column)) && s3.runs.length === 0 && s4.pipelines.map((p) => p.id).sort().join() === "file-fee,out-fee" && s5.runs.length === 11, "search finds a case by its words, a column in the lineage, pipelines by DAG id, and runs by business date", `${s1.cases.length} ${s2.cases.length} ${s3.runs.length} ${s4.pipelines.length} ${s5.runs.length}`);

console.log("-- the address");
ok(JSON.stringify(readQuery("#guardrails?p=file-cash&d=2026-11-27&tab=history")) === JSON.stringify({ p: "file-cash", d: "2026-11-27", tab: "history" }) && writeQuery("#guardrails?p=file-cash&d=2026-11-27", { d: null }) === "#guardrails?p=file-cash" && writeQuery("#guardrails", { p: "x", period: "day" }) === "#guardrails?p=x&period=day" && levelOf({}) === "dash" && levelOf({ p: "x" }) === "pipe" && levelOf({ p: "x", d: "y" }) === "run", "the query holds the level; the route before the question mark is untouched");
ok(fmtDur(45) === "45 s" && fmtDur(660) === "11 min" && fmtDur(4000) === "1 h 7 min", "durations read");

console.log("-- the three levels render");
const dash = renderToStaticMarkup(<Integration360Console t={t} initial={{ today: "2026-11-27T12:00:00Z", query: {} }} />);
ok(/data-level="dash"/.test(dash) && /data-kpis/.test(dash) && /data-attention/.test(dash) && /data-board/.test(dash) && /data-grid/.test(dash) && /November 2026/.test(dash) && (dash.match(/data-cell="/g) || []).length === 12 * 20 && /illustrative until the first run reports/.test(dash), "the dashboard: KPIs, needs attention, the day's board, the month grid with 240 cells, marked illustrative");
ok(/aria-pressed="true"[^>]*>month</.test(dash) && /Cash balances/.test(dash) && /Dates still open/.test(dash), "month selected; the reds listed; the KPI labels");
const dashQ = renderToStaticMarkup(<Integration360Console t={t} initial={{ today: "2026-11-27T12:00:00Z", query: { q: "xpf" } }} />);
ok(/data-search-results/.test(dashQ) && /Results for &quot;xpf&quot;/.test(dashQ) && /Cash balances/.test(dashQ), "a search in the address shows its results");
const pipe = renderToStaticMarkup(<Integration360Console t={t} initial={{ today: "2026-11-27T12:00:00Z", query: { p: "file-cash" } }} />);
ok(/data-level="pipe"/.test(pipe) && /data-pipeline-open="file-cash"/.test(pipe) && /data-history-strip/.test(pipe) && /Last 20 business dates/.test(pipe) && /data-history/.test(pipe) && /2026-11-27/.test(pipe) && /dbt_int/.test(pipe) && /Retention 13 months/.test(pipe) && /aria-pressed="true"[^>]*>History</.test(pipe), "the pipeline level: header, the history strip, the history table with the failed run, History tab on");
const about = renderToStaticMarkup(<Integration360Console t={t} initial={{ today: "2026-11-27T12:00:00Z", query: { p: "file-cash", tab: "about" } }} />);
ok(/data-about/.test(about) && /where in the flow/.test(about) && !/data-history"/.test(about), "the About tab: the business line, the flow and the DAG");
const lin = renderToStaticMarkup(<Integration360Console t={t} initial={{ today: "2026-11-27T12:00:00Z", query: { p: "file-cash", tab: "lineage" } }} />);
ok(/data-wires=/.test(lin) && /RAW_REC_CASH_ACTIVITIES/.test(lin), "the Lineage tab: the column wires");
const run = renderToStaticMarkup(<Integration360Console t={t} initial={{ today: "2026-11-27T12:00:00Z", query: { p: "file-cash", d: "2026-11-27" } }} />);
ok(/data-level="run"/.test(run) && /data-record="ge-001"/.test(run) && /data-bad-records="ge-001"/.test(run) && /row 2,114/.test(run) && /data-fold="flow" data-open="true"/.test(run) && /data-fold="data" data-open="false"/.test(run) && /data-notes/.test(run) && /date still open/.test(run) && /26 Nov/.test(run) && /Copy link/.test(run), "the run level: what went wrong, the bad records, the flow open and the data folded, notes, previous date and copy link");
const runOk = renderToStaticMarkup(<Integration360Console t={t} initial={{ today: "2026-11-27T12:00:00Z", query: { p: "file-cash", d: "2026-11-26" } }} />);
ok(/data-healthy="file-cash"/.test(runOk) && !/data-record=/.test(runOk) && /date closed 18:/.test(runOk), "a green day says nothing is wrong and when the date closed");
const liveRun = renderToStaticMarkup(<Integration360Console t={t} initial={{ today: "2026-11-27T12:00:00Z", query: { p: "file-cash", d: "2026-11-27" }, history: liveHist, live: { dags: { swp_cash_processing: { status: "red", run: { run_key: "swp_cash_processing:r1", state: "failed", business_date: "2026-11-27" }, failed_tasks: [{ task_key: "k", task_id: "dbt_int", state: "failed", error_detail: "not_null failed" }], failing: [], warnings: [] } } }, findings: { "swp_cash_processing:2026-11-27": [{ test_key: "tk", run_key: "swp_cash_processing:r1", rule_kind: "dbt_test", model_name: "int_cash_balance", test_name: "not_null", column_name: "cash_balance_usd", status: "fail", failures: 3, total_rows: 15204, bad_rows: [{ FILE_ROW_NUMBER: 2114, ACCOUNT_NUMBER: "ACC-88213", CURRENCY: "XPF" }] }] } }} />);
ok(/LIVE/.test(liveRun) && /not_null/.test(liveRun) && /row 2,114/.test(liveRun) && !/ge-001/.test(liveRun) && / live</.test(liveRun), "with live records the run shows the dbt finding and its rows, not the illustrative case");
const gr = fs.readFileSync(path.join(SRC, "Guardrails.jsx"), "utf8");
ok(/Integration360Console/.test(gr) && /"Pipelines", "Overview"/.test(gr), "Integration 360 - Run opens on the console");
ok(!/testbbh|apps\.ocp|https?:\/\/|CPACC|PBDWHDBT|\.internal/.test(fs.readFileSync(path.join(SRC, "Integration360Console.jsx"), "utf8") + fs.readFileSync(path.join(SRC, "integration360History.js"), "utf8")), "no host, schema owner or link in the console");

if (BAD) { console.log(`\n${BAD} assertion(s) failed`); process.exit(1); }
console.log("\nintegration360-console assertions pass");
