// ODI 360 · SCD2: the screen renders from the API shapes and says so when
// nothing is loaded. The fixture is the same synthetic DIM_ACCOUNT card the
// API test uses; no warehouse value appears anywhere.
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { tLight, tDark } from "../src/bbhTheme.js";
import Odi360, { Scd2Tab, CardDetail, DupMonths, TABS as TABSX } from "../src/Odi360.jsx";
import { PATTERN_INFO, CONF_INFO, scd2 } from "../src/scd2Api.js";
import { OverviewTab, ProcessesTab, TablesTab, VariablesTab, ObjectsTab, MappingFig, ProcessFig, RepoTabs } from "../src/OdiRepoTabs.jsx";
import { odi, TASK_TYPE } from "../src/odiApi.js";

let bad = 0;
const ok = (c, m, got) => { console.log(`${c ? "ok  " : "FAIL"} ${m}${c ? "" : `  -> ${String(got).slice(0, 220)}`}`); if (!c) bad++; };
const SRC = fs.existsSync("src/Odi360.jsx") ? "src" : path.join("ui", "src");

const summary = { loaded: true, tables: 3, profiled: 1, stale: 1, open_questions: 3, last_run: "2026-10-15T10:00:00", review: { confirmed: 5, rejected: 1, reviewers: 2 },
  confidence: { proven: 14, inferred: 1, unknown: 2 }, by_pattern: [{ pattern: "MERGE_SCD2", n: 2 }, { pattern: "TRUNCATE_APPEND_HIST", n: 1 }] };
const cards = [
  { table_name: "DIM_ACCOUNT", pattern: "MERGE_SCD2", natural_key: "ACCOUNT_NUMBER", partition_col: "MASTER_IND", proven_count: 7, inferred_count: 1, unknown_count: 0, open_count: 1, row_count: 272373, dup_pct: 0.1, freshness_alert: "stale", confirmed_count: 5, rejected_count: 1 },
  { table_name: "DIM_IP_RELATIONSHIP", pattern: "TRUNCATE_APPEND_HIST", natural_key: null, proven_count: 1, unknown_count: 2, open_count: 2 },
];
const detail = { table: "DIM_ACCOUNT", loaded: true,
  card: { ...cards[0], scan_verdict: "SCD2", writers: "SCN_DIM_ACCOUNT, SCN_DIM_MASTER_ACCOUNT", surrogate_key: "ACCOUNT_KEY", version_key: "ACCOUNT_NUMBER, START_DATE",
    partition_values: { N: "SCN_DIM_ACCOUNT", Y: "SCN_DIM_MASTER_ACCOUNT" }, dup_rows: 275, dup_keys: 3, gaps: 0, overlaps: 0, multiple_open: 0, none_open: 12,
    active_open_not_flagged: 4000, active_closed_but_flagged: 0, freshness_alert: "latest version is 20 days behind the control date", ran_at: "2026-10-15T10:00:00" },
  rules: [{ rule_id: "R2", rule_text: "Prior open version closed with END_DATE = new START_DATE -1 day", confidence: "PROVEN", evidence: "SCN_DIM_ACCOUNT step 14 task 10 — PRC_ACCOUNT_EDM_END_DATE",
            business_meaning: "When an account changes, yesterday's record is closed the day before the new one starts.", confirmed: "Y", reviewer: "A. Reviewer", reviewed_at: "2026-10-16T09:00:00", rule_changed_since: "N" },
          { rule_id: "R8", rule_text: "Versions open on real change", confidence: "INFERRED", evidence: "db dup_summary: 0.1%", confirmed: "N", reviewer: "B. Reviewer", reviewer_note: "one feed re-sends unchanged rows", rule_changed_since: "Y" },
          { rule_id: "R9", rule_text: "Unreviewed rule", confidence: "PROVEN", evidence: "x" }],
  mapping: [{ pbdw_column: "ACTIVE_IND", data360_attr: "IS_CURRENT (unreliable)" }],
  open_questions: [{ seq: 1, question: "re-export untruncated: SCN_DIM_ACCOUNT step 9 task 50" }],
  dup_by_month: [{ month: "2025-12", versions: 400, dup_rows: 10 }, { month: "2026-01", versions: 409, dup_rows: 20 }, { month: "2026-02", versions: 6, dup_rows: 0 }],
  column_roles: { valid_from: "START_DATE", valid_to: "END_DATE", current_flag: "ACTIVE_IND", surrogate_key: "ACCOUNT_KEY", audit_col: "LOAD_DATE", to_convention: "high date = open (NOT NULL)" } };

console.log("-- the tab");
for (const [tn, t] of [["light", tLight], ["dark", tDark]]) {
  const h = renderToStaticMarkup(<Scd2Tab t={t} summary={summary} cards={cards} detail={detail} onOpen={() => {}} onClose={() => {}} />);
  ok(h.length > 4000 && !/NaN|undefined|\[object Object\]/.test(h), `renders cleanly in ${tn}`, (h.match(/.{0,40}(NaN|undefined).{0,30}/) || [])[0] || h.length);
}
const h = renderToStaticMarkup(<Scd2Tab t={tLight} summary={summary} cards={cards} detail={detail} onOpen={() => {}} onClose={() => {}} />);
ok(/tables carded/.test(h) && />3</.test(h) && /14 \/ 17/.test(h) && /truncated · to re-export/.test(h), "the tiles: tables, proven share, truncated count");
ok(/SCD2 · merge/.test(h) && /truncate \+ history/.test(h), "pattern chips use the human labels");
ok(/DIM_ACCOUNT/.test(h) && /split by MASTER_IND/.test(h) && /7 proven/.test(h) && /2 truncated/.test(h) && /0.1% dup/.test(h) && /stale/.test(h), "a card shows its key, split, confidence mix, dup rate and staleness");
ok(/PRC_ACCOUNT_EDM_END_DATE/.test(h) && />PROVEN</.test(h) && />INFERRED</.test(h) && /IS_CURRENT \(unreliable\)/.test(h) && /task 50/.test(h), "the detail: rules with evidence and confidence, the mapping, the open question");
ok(/272373/.test(h) && /275 \(0.1%\)/.test(h) && /4000 \/ 0/.test(h) && /20 days behind/.test(h), "the quality tiles carry the profile");
ok(/rules confirmed/.test(h) && /5 \/ 17/.test(h) && /1 rejected/.test(h) && /✓ 5 confirmed/.test(h) && /✗ 1 rejected/.test(h), "the sign-off counts on the tile and the card");
ok(/>CONFIRMED</.test(h) && /A\. Reviewer · 2026-10-16/.test(h) && /record is closed the day before/.test(h), "a confirmed rule shows its reviewer and business meaning");
ok(/>REJECTED</.test(h) && /one feed re-sends unchanged rows/.test(h) && /the rule changed since this review/.test(h) && /not reviewed/.test(h),
   "a rejected rule shows the reason and the drift flag; an unreviewed rule says so");
ok(/role="img"/.test(h) && /Versions opened per month for 3 months/.test(h), "the month bars carry a sentence");
ok(/open row<\/span> high date = open/.test(h) && /START_DATE/.test(h) && />audit<\/span> <span[^>]*>LOAD_DATE/.test(h), "the column scan's roles and convention are shown, audit under its plain name");

console.log("-- the repository tabs");
const S = { loaded: true, scenarios: 41, tasks: 1230, truncated_tasks: 212, variables: 18, tables: 97, objects: 34, edges: 160, scd2_cards: 12, load_plans: 3,
  by_pattern: [{ k: "merge", n: 12 }, { k: "truncate", n: 20 }, { k: "unknown", n: 9 }], by_layer: [{ k: "DIM", n: 20 }, { k: "FACT", n: 30 }], by_object_type: [{ k: "PROCEDURE", n: 14 }, { k: "INDEX", n: 20 }] };
const SCN = [{ scenario: "SCN_DIM_ACCOUNT", load_pattern: "merge", writes_list: ["DIM_ACCOUNT(MERGE)"], reads_list: ["STG2_ACCOUNT", "DIM_CONTROL_DATES"], step_count: 14, task_count: 42, truncated_tasks: 6, load_plans_list: ["LP_EDM"], jobs_list: ["J_EDM_ACCOUNT"] }];
const SD = { scenario: "SCN_DIM_ACCOUNT", loaded: true, head: { ...SCN[0], procedures_list: ["PRC_ACCOUNT_EDM_END_DATE"], kms_list: ["IKM SQL Control Append"] },
  steps: [{ step_no: 9, tasks: [{ step_no: 9, task_no: 50, task_name1: "Load data", task_name2: "LKM SQL to Oracle", task_type: "C", reads: "STG2_ACCOUNT", writes: "I$_DIM_ACCOUNT(INSERT)", code_chars: 29237, code_preview: "select ACCOUNT_NUMBER from STG2_ACCOUNT where", truncated: "Y" }] },
          { step_no: 14, tasks: [{ step_no: 14, task_no: 10, task_name1: "PRC_ACCOUNT_EDM_END_DATE", task_type: "S", reads: "", writes: "DIM_ACCOUNT(UPDATE)", code_chars: 400, code_preview: "UPDATE DIM_ACCOUNT SET END_DATE = ...", truncated: "N" }] }],
  variables: [{ name: "V_PBDW_BATCH_ID", datatype: "Numeric", refresh_lschema: "PBDWAPP", refresh_sql: "SELECT MAX(BATCH_ID) FROM BATCH_CONTROL" }], edges: [], objects: [{ object_type: "PROCEDURE", name: "PRC_ACCOUNT_EDM_END_DATE", on_table: "DIM_ACCOUNT" }] };
const TB = [{ table_name: "DIM_ACCOUNT", layer: "DIM", scd2_pattern: "MERGE_SCD2", writers: ["SCN_DIM_ACCOUNT", "SCN_DIM_MASTER_ACCOUNT"], reader_count: 1, operations: ["MERGE", "UPDATE"] },
            { table_name: "STG2_ACCOUNT", layer: "STG2", scan_verdict: "NONE", writers: ["SCN_STG2_ACCOUNT"], reader_count: 3, operations: ["INSERT"] }];
const TD = { table: "DIM_ACCOUNT", loaded: true, head: { ...TB[0], readers: ["SCN_FACT_POS"], index_list: ["PK_DIM_ACCOUNT"] }, sources: ["STG2_ACCOUNT", "DIM_CONTROL_DATES"],
  tasks: [{ scenario: "SCN_DIM_ACCOUNT", step_no: 14, task_no: 10, task_name1: "Insert/Update customize", task_type: "C", reads: "I$_DIM_ACCOUNT", writes: "DIM_ACCOUNT(MERGE)", code_chars: 14091, code_preview: "merge into DIM_ACCOUNT", truncated: "Y" }],
  inbound: [{ src: "STG2_ACCOUNT", relation: "feeds", dst: "DIM_ACCOUNT", detail: "SCN_DIM_ACCOUNT" }], outbound: [], objects: [{ object_type: "PROCEDURE", name: "PRC_ACCOUNT_EDM_END_DATE", columns: "", used_by: "SCN_DIM_ACCOUNT" }],
  scd2: { pattern: "MERGE_SCD2", natural_key: "ACCOUNT_NUMBER", partition_col: "MASTER_IND", proven_count: 7, inferred_count: 1, unknown_count: 0, open_count: 1, row_count: 272373, dup_pct: 0.1 },
  column_roles: { verdict: "SCD2", confidence: "high", valid_from: "START_DATE", valid_to: "END_DATE", current_flag: "ACTIVE_IND", surrogate_key: "ACCOUNT_KEY", audit_col: "BATCH_ID", to_convention: "NULL = open" } };
const noop = () => {};
for (const [tn, t] of [["light", tLight], ["dark", tDark]]) {
  const parts = [
    renderToStaticMarkup(<OverviewTab t={t} s={S} />),
    renderToStaticMarkup(<ProcessesTab t={t} rows={SCN} loaded q="" setQ={noop} pattern="" setPattern={noop} patterns={["merge"]} detail={SD} onOpen={noop} onClose={noop} onTable={noop} />),
    renderToStaticMarkup(<TablesTab t={t} rows={TB} loaded q="" setQ={noop} layer="" setLayer={noop} layers={["DIM"]} detail={TD} onOpen={noop} onClose={noop} onScenario={noop} onScd2={noop} />),
    renderToStaticMarkup(<VariablesTab t={t} rows={[{ name: "V_PBDW_BATCH_ID", datatype: "Numeric", refresh_lschema: "PBDWAPP", used_by_scenarios: 12, refresh_sql: "SELECT MAX(BATCH_ID) FROM BATCH_CONTROL" }]} loaded q="" setQ={noop} />),
    renderToStaticMarkup(<ObjectsTab t={t} rows={[{ object_type: "PROCEDURE", name: "PRC_ACCOUNT_EDM_END_DATE", on_table: "DIM_ACCOUNT", used_by_list: ["SCN_DIM_ACCOUNT"] }]} loaded q="" setQ={noop} type="" setType={noop} types={["PROCEDURE"]} />),
  ];
  ok(parts.every((p) => p.length > 800 && !/NaN|undefined|\[object Object\]/.test(p)), `all five repository tabs render cleanly in ${tn}`, parts.map((p) => p.length).join(","));
}
const ov = renderToStaticMarkup(<OverviewTab t={tLight} s={S} />);
ok(/role="img"/.test(ov) && /How an ODI scenario runs, in six stages/.test(ov) && /refresh variables/.test(ov) && /drop work tables/.test(ov), "the overview draws the process figure with a sentence");
ok(/212 cut by the export/.test(ov) && /212 task\(s\) were cut by the export/.test(ov) && /re-export/.test(ov), "and says how many tasks the export cut, and what to do");
ok(/>merge</.test(ov) && />DIM</.test(ov) && />PROCEDURE</.test(ov), "pattern, layer and object-type chips");
const pr = renderToStaticMarkup(<ProcessesTab t={tLight} rows={SCN} loaded q="" setQ={noop} pattern="" setPattern={noop} patterns={["merge"]} detail={SD} onOpen={noop} onClose={noop} onTable={noop} />);
ok(/SCN_DIM_ACCOUNT/.test(pr) && /STEP 9/.test(pr) && /STEP 14/.test(pr) && /Load data \/ LKM SQL to Oracle/.test(pr) && /PRC_ACCOUNT_EDM_END_DATE/.test(pr), "a scenario lists its steps and tasks in order");
ok(/29237 chars/.test(pr) && /cut by the export — re-export this scenario/.test(pr) && /<pre/.test(pr) && /select ACCOUNT_NUMBER from STG2_ACCOUNT/.test(pr), "a task's code preview is shown and marked when the export cut it");
ok(/>flow</.test(pr) && />procedure</.test(pr) && /LP_EDM/.test(pr) && /J_EDM_ACCOUNT/.test(pr) && /IKM SQL Control Append/.test(pr), "task kinds in plain words, the load plan, the job and the knowledge module");
ok(/14 · 42/.test(pr) && /6 cut/.test(pr), "the list row shows steps · tasks and the cut count");
const tb = renderToStaticMarkup(<TablesTab t={tLight} rows={TB} loaded q="" setQ={noop} layer="" setLayer={noop} layers={["DIM"]} detail={TD} onOpen={noop} onClose={noop} onScenario={noop} onScd2={noop} />);
ok(/Mapping for DIM_ACCOUNT: 2 source tables feed 2 writer scenarios/.test(tb) && /sources read · 2/.test(tb) && /read by · 1/.test(tb), "the mapping figure: sources → writers → table → readers, with a sentence");
ok(/open the SCD2 card →/.test(tb) && /split by <span[^>]*>MASTER_IND/.test(tb) && /7 proven · 1 inferred/.test(tb) && /NULL = open/.test(tb), "a table links to its rule card and shows the scan's history columns");
ok(/Insert\/Update customize/.test(tb) && /14091 chars/.test(tb) && /PK_DIM_ACCOUNT/.test(tb) && /feeds/.test(tb), "the writing tasks, indexes and lineage edges");
ok(/SCD2 · merge/.test(tb) && />STG2</.test(tb) && />NONE</.test(tb), "the list: pattern chip when carded, the scan verdict when not");
const em = renderToStaticMarkup(<OverviewTab t={tLight} s={{ loaded: false }} />);
ok(/Nothing loaded yet/.test(em) && /ingestion\.run odi_repo/.test(em) && /83_odi_repo\.sql/.test(em), "an empty estate says which script and step to run");
ok(renderToStaticMarkup(<RepoTabs t={tLight} tab="overview" onScd2={noop} />).length > 100, "the fetching shell renders before any call resolves");
ok(["summary", "scenarios", "scenario", "tables", "table", "variables", "objects", "edges"].every((k) => typeof odi[k] === "function") && Object.keys(TASK_TYPE).length === 6, "the client exposes eight calls and the six task kinds");
ok(TABSX.length === 6 && TABSX[0][0] === "overview" && TABSX[5][0] === "scd2", "six tabs, overview first, the rule cards last");
ok(!/https?:\/\/|testbbh|\.bbh\.com/.test(fs.readFileSync(path.join(SRC, "OdiRepoTabs.jsx"), "utf8")) && !/https?:\/\/|testbbh|\.bbh\.com/.test(fs.readFileSync(path.join(SRC, "odiApi.js"), "utf8")),
   "no URL or hostname in the repository tabs or their client");

console.log("-- empty");
const e = renderToStaticMarkup(<Scd2Tab t={tLight} summary={{ loaded: false, confidence: {} }} cards={[]} detail={null} onOpen={() => {}} onClose={() => {}} />);
ok(/No rule cards loaded yet/.test(e) && /ingestion\.run scd2/.test(e) && /CP_SCD2_WITH_DB=1/.test(e), "an empty estate says which command to run");
ok(renderToStaticMarkup(<CardDetail t={tLight} d={null} onClose={() => {}} />) === "" && renderToStaticMarkup(<DupMonths t={tLight} rows={[]} />) === "",
   "no detail and no months draw nothing");
ok(/ODI 360/.test(renderToStaticMarkup(<Odi360 t={tLight} />)) && /NO ROWS YET/.test(renderToStaticMarkup(<Odi360 t={tLight} />)), "the shell renders before any fetch resolves");

console.log("-- wiring");
ok(typeof scd2.summary === "function" && typeof scd2.cards === "function" && typeof scd2.card === "function", "the client exposes three calls");
ok(Object.keys(PATTERN_INFO).length === 6 && PATTERN_INFO.SCD2_UNVERIFIED && Object.keys(CONF_INFO).length === 3, "pattern and confidence vocabularies — six patterns, SCD2_UNVERIFIED for a writer the export cut");
const APP = fs.readFileSync(path.join(SRC, "App.jsx"), "utf8"), NAV = fs.readFileSync(path.join(SRC, "AppShell.jsx"), "utf8");
ok(/import Odi360 from "\.\/Odi360\.jsx"/.test(APP) && /odi360: <Odi360 t=\{t\} \/>/.test(APP), "App.jsx routes it");
ok(/\['odi360', 'ODI 360'/.test(NAV), "AppShell.jsx has the nav entry");
const groupOf = (key) => { const i = NAV.indexOf(`['${key}'`); const before = NAV.slice(0, i); const m = [...before.matchAll(/group: '([^']+)'/g)]; return m.length ? m[m.length - 1][1] : null; };
ok(groupOf("odi360") === "Catalog" && groupOf("devops360") === "Architecture", "and it sits under Catalog, not Architecture", groupOf("odi360"));
ok(!/https?:\/\/|testbbh|\.bbh\.com/.test(fs.readFileSync(path.join(SRC, "Odi360.jsx"), "utf8")), "no URL or hostname on the screen");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nodi360 assertions pass");
if (bad) process.exit(1);
