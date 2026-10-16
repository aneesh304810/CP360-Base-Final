// ODI 360 · SCD2: the screen renders from the API shapes and says so when
// nothing is loaded. The fixture is the same synthetic DIM_ACCOUNT card the
// API test uses; no warehouse value appears anywhere.
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { tLight, tDark } from "../src/bbhTheme.js";
import Odi360, { Scd2Tab, CardDetail, DupMonths } from "../src/Odi360.jsx";
import { PATTERN_INFO, CONF_INFO, scd2 } from "../src/scd2Api.js";

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
ok(!/https?:\/\/|testbbh|\.bbh\.com/.test(fs.readFileSync(path.join(SRC, "Odi360.jsx"), "utf8")), "no URL or hostname on the screen");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nodi360 assertions pass");
if (bad) process.exit(1);
