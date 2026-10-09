// The SEI mapping documents panel: its headline model, the picture, the wiring.
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { tLight } from "../src/bbhTheme.js";
import MappingDocsPanel, { headlineOf, LinkStack } from "../src/MappingDocs.jsx";
import { LINK_INFO, LINK_ORDER, COMPLETENESS_INFO, mappingDocs } from "../src/seiCrosswalkApi.js";

let bad = 0;
const ok = (c, m, got) => { console.log(`${c ? "ok  " : "FAIL"} ${m}${c ? "" : `  -> ${String(got).slice(0, 240)}`}`); if (!c) bad++; };
function findSrc() {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    for (const rel of ["src", path.join("ui", "src")]) {
      const p = path.join(dir, rel);
      if (fs.existsSync(path.join(p, "CrosswalkDashboard.jsx"))) return p;
    }
    dir = path.dirname(dir);
  }
  throw new Error("src not found");
}
const SRC = findSrc();

const register = { docs: [
  { feed_family: "PEDDIFI1", feed_key: "PEDDIFI1", source_document: "STAR_Portfolio_Valuation.xlsx", sei_star_rows: 141, sei_star_mapped: 127, open_dependencies: 15,
    imds_targets: "LOT_LEVEL_POSITION;POSITION", imds_stage_rows: 499, new_comparison_rows: 338, already_in_catalog: 161, loaded: { s2s_rows: 141, e2e_rows: 499, stage_rows: 499, imds_tables: ["POSITION"] }, agrees: true },
  { feed_family: "ODDDIFI1", feed_key: "ODDDIFI1", source_document: "STAR_Open_Dividends.xlsx", sei_star_rows: 57, sei_star_mapped: 40, open_dependencies: 4,
    imds_targets: "HOLDINGDBO.BBH_OPEN_DIVIDENDS", imds_stage_rows: 47, new_comparison_rows: 47, already_in_catalog: 0, loaded: { s2s_rows: 50, e2e_rows: 47, stage_rows: 47, imds_tables: ["HOLDINGDBO.BBH_OPEN_DIVIDENDS"] }, agrees: false },
], totals: { documents: 7, s2s_rows: 479, s2s_mapped: 384, s2s_mapped_pct: 80.2, e2e_rows: 1121, imds_tables: 14, open_dependencies: 43, disagreements: 1 },
  by_mapping_status: [], by_map_kind: [], headline: "7 mapping documents · 479 STAR fields, 384 with a SEI source · 1121 end-to-end paths over 14 IMDS tables · everything DRAFT_REVIEW_REQUIRED" };
const coverage = { total: 1121, covered: 342, coverage_pct: 30.5,
  by_link: [{ key: "E2E", n: 99, label: "l" }, { key: "SEI_DIRECT", n: 243, label: "d" }, { key: "STAR_NOT_IN_FILE_MAP", n: 8, label: "n" }, { key: "NO_SEI_SOURCE", n: 771, label: "x" }],
  by_status: [], by_approval: [{ key: "DRAFT_REVIEW_REQUIRED", n: 1121 }],
  tables: [{ name: "TRADESDBO.BBH_OPEN_TRADE_STAR", rows: 46, links: { E2E: 20, SEI_DIRECT: 26 }, e2e: 20, sei_direct: 26, no_sei_source: 0, not_in_file_map: 0, gap: 0, covered: 46, coverage_pct: 100 },
           { name: "RULESDBO.ENTITY", rows: 180, links: { E2E: 2, SEI_DIRECT: 5, NO_SEI_SOURCE: 173 }, e2e: 2, sei_direct: 5, no_sei_source: 173, not_in_file_map: 0, gap: 173, covered: 7, coverage_pct: 3.9 }],
  feeds: [], headline: "342 of 1121 paths reach IMDS from a SEI source (30.5%)" };
const rows = [{ xwalk_row_id: "r1", feed_family: "CGDEIFI1", sei_source: "PROCESSING_DATE", map_kind: "SYSTEM_DATE", sei_star_logic: "", star_field: "Accounting Date", star_in_layout: "Y",
  imds_table: "TRADESDBO.BBH_DISPOSAL_LOTS_CURRENCY", imds_column: "EFFECTIVE_DATE", star_imds_logic: "to_date(effective_date_2,'MM/DD/YYYY')", sei_imds_logic: "PROCESSING_DATE",
  link_status: "E2E_LINKED", link_class: "E2E", crosswalk_status: "CANDIDATE", approval_status: "DRAFT_REVIEW_REQUIRED", source_document: "STAR CGDEIFI1 mapping.xlsx" }];

console.log("-- the headline model");
const H = headlineOf(register, coverage);
ok(H.documents === 7 && H.s2sRows === 479 && H.s2sPct === 80.2 && H.e2eRows === 1121 && H.coveragePct === 30.5 && H.tables === 14, "counts from the register and the coverage", H);
ok(H.noSei === 771 && H.notInMap === 8 && H.drafts === 1121 && H.loaded === true, "the gap numbers and the draft count");
ok(headlineOf({ totals: {} }, { total: 0, by_link: [], by_approval: [] }).loaded === false, "nothing loaded is known");
ok(LINK_ORDER.length === 5 && Object.keys(LINK_INFO).length === 5 && Object.keys(COMPLETENESS_INFO).includes("IM_ONLY_DOCUMENTED"), "vocabularies, the new completeness value included");
ok(typeof mappingDocs.e2eRows === "function" && typeof mappingDocs.usageExceptions === "function", "the client has the seven calls");

console.log("-- the picture");
const stack = renderToStaticMarkup(<LinkStack links={{ E2E: 2, NO_SEI_SOURCE: 6 }} total={8} />);
ok((stack.match(/width:25%/g) || []).length === 1 && (stack.match(/width:75%/g) || []).length === 1, "a stacked bar in proportion", stack);
const html = renderToStaticMarkup(<MappingDocsPanel t={tLight} dataSource="IMDS" initial={{ register, coverage, table: "RULESDBO.ENTITY", rows }} />);
ok(/Every row here is a draft/.test(html) && /1121 rows carry DRAFT_REVIEW_REQUIRED/.test(html), "the draft warning, with the count");
ok(/RULESDBO\.ENTITY/.test(html) && /3\.9%/.test(html) && /TRADESDBO\.BBH_OPEN_TRADE_STAR/.test(html) && /100%/.test(html), "coverage per IMDS table");
ok(/EFFECTIVE_DATE/.test(html) && /Accounting Date/.test(html) && /linked end to end/.test(html) && /verdict ▸/.test(html) === false, "the drill rows draw SEI → STAR → IMDS; no verdict link without a handler");
ok(/no SEI source · 771/.test(html) && /STAR field not in map · 8/.test(html), "link class pills with counts");
const docs = renderToStaticMarkup(<MappingDocsPanel t={tLight} dataSource="IMDS" initial={{ register, coverage, view: "Documents" }} />);
ok(/STAR_Portfolio_Valuation\.xlsx/.test(docs) && /141 fields · 499 paths ✓/.test(docs) && /50 fields · 47 paths ≠ declared/.test(docs), "the register says which loads agree with what was declared", docs.match(/\d+ fields · \d+ paths[^<]*/g));
const empty = renderToStaticMarkup(<MappingDocsPanel t={tLight} dataSource="IMDS" initial={{ register: { docs: [], totals: {} }, coverage: { total: 0, by_link: [], by_approval: [] } }} />);
ok(empty === "", "nothing loaded: the panel renders nothing, so the dashboard looks as it did");

console.log("-- wired in");
const dash = fs.readFileSync(path.join(SRC, "CrosswalkDashboard.jsx"), "utf8");
ok(/import MappingDocsPanel from "\.\/MappingDocs\.jsx"/.test(dash) && /<MappingDocsPanel t=\{t\} dataSource=\{ds\} onOpenColumn=\{openCol\} \/>/.test(dash), "mounted on the crosswalk dashboard with the column opener");
const usage = fs.readFileSync(path.join(SRC, "StarFieldUsage.jsx"), "utf8");
ok(/r\.doc_usage_status/.test(usage) && /r\.sei_mapped/.test(usage) && /r\.usage_check/.test(usage), "the usage drill shows what the mapping document says");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nmapping-docs assertions pass");
if (bad) process.exit(1);
