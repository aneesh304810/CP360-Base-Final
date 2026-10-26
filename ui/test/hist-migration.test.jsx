// Data Analysis · Historical migration: the tab renders from handed-in
// payloads in both themes, the rules are on it, the evidence table shows a
// row with its reassembled source row, and the Data Analysis page carries
// the tab. No NaN, no undefined, no client data.
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { tLight, tDark } from "../src/bbhTheme.js";
import HistMigration from "../src/HistMigration.jsx";
import { HM_RULES, emptySummary } from "../src/histMigrationApi.js";
import DataAnalysis from "../src/DataAnalysis.jsx";

let bad = 0;
const ok = (c, m, got) => { console.log(`${c ? "ok  " : "FAIL"} ${m}${c ? "" : `  -> ${String(got).slice(0, 220)}`}`); if (!c) bad++; };

const summary = { loaded: true, totals: { lanes: 3, artifacts: 4, evidence: 214622, dictionary: 14, sourceRows: 15880, unresolvedLanes: 1203 },
  byLane: [{ key: "AddVantage / PB to SEI", n: 120000, unresolved: 0 }, { key: "Historical source to SEI", n: 1203, unresolved: 1203 }],
  byDomain: [{ key: "Static", n: 150000, unresolved: 0 }, { key: "Financial", n: 64622, unresolved: 1203 }],
  bySourceSystem: [{ key: "AddVantage / PB", n: 120000, unresolved: 0 }], byCategory: [{ key: "Source-Specific Mapping Attribute", n: 90000, unresolved: 0 }],
  byAttribute: [{ key: "Source-Specific Attribute 5", n: 9000, unresolved: 0 }], bySheet: [{ workbook: "DSR_Mapping.xlsx", sheet: "AV_DSR_MAP", n: 50000, rows: 4000 }],
  latest: { batchId: "hm1", sourceFile: "STAR_IMDS_SEI_Lineage_Catalog.xlsx", loadedAt: "2026-10-26 09:00", skipped: 3100, evidence: 214622, lanes: 3, artifacts: 4, dictionary: 14,
    checks: [{ rule: "CP360-HM-007", level: "Warning", sheet: "evidence", n: 1203, detail: "1203 evidence rows name a lane that is not a registered lane" }, { rule: "CP360-HM-008", level: "Pass", sheet: "artifacts", n: 0, detail: "reference artifacts" }] } };
const lanes = [{ historical_lane_id: "ADDVANTAGE_SEI_HIST", historical_source_system: "AddVantage / PB", target_system: "SEI", migration_purpose: "Historical deconversion source-to-target mapping", primary_mapping_evidence: "Consolidated_Catalog_Static_and_Financial.xlsx", reference_artifacts: "DCONCUS10_20210727.docx", data_domain: "Static and Financial", relationship_to_operational_lineage: "Upstream of the existing SEI to STAR to IMDS lineage", status: "Added" }];
const artifacts = [{ source_artifact: "DCONCUS10_20210727.docx", artifact_type: "Deconversion specification", artifact_class: "REFERENCE", historical_migration_role: "Interpretation", supported_lanes: "AddVantage/PB to SEI", cp_360_treatment: "Reference", notes: "" }];
const dictionary = [{ meaningful_column_name: "Evidence Value", definition: "The original cell", source_or_derivation: "Source cell" }];
const evidence = { evidence: [{ source_mapping_workbook: "DSR_Mapping.xlsx", source_mapping_sheet: "AV_DSR_MAP", source_mapping_row: 2, original_source_column_number: 5, historical_migration_domain: "Static", historical_source_system: "AddVantage / PB", historical_migration_lane: "AddVantage / PB to SEI", evidence_category: "Source-Specific Mapping Attribute", evidence_attribute: "Source-Specific Attribute 5", evidence_value: "Subfirm Logic", evidence_length: 13, original_source_column: "Column_1", lane_resolved: "Y", truncated: false },
  { source_mapping_workbook: "Fin_Mapping.xlsx", source_mapping_sheet: "FIN_MAP", source_mapping_row: 9, original_source_column_number: 2, historical_migration_domain: "Financial", historical_source_system: "Unclassified Historical Source", historical_migration_lane: "Historical source to SEI", evidence_category: "Mapping Logic", evidence_attribute: "Rule", evidence_value: "x".repeat(4000), evidence_length: 6200, original_source_column: "Column_9", lane_resolved: "N", truncated: true }], total: 2, page: 1, size: 50,
  row: { lane: "AddVantage / PB to SEI", domain: "Static", system: "AddVantage / PB", group: "Static Merge", cells: [{ original_source_column_number: 5, original_source_column: "Column_1", evidence_attribute: "Source-Specific Attribute 5", evidence_category: "Source-Specific Mapping Attribute", evidence_value: "Subfirm Logic" }] } };
const batches = [summary.latest];

console.log("-- the tab");
for (const [tn, t] of [["light", tLight], ["dark", tDark]]) {
  const parts = ["Overview", "Evidence", "Dictionary", "Loads"].map((sub) => renderToStaticMarkup(<HistMigration t={t} initial={{ sub, summary, lanes, artifacts, dictionary, evidence, batches }} />));
  ok(parts.every((p) => p.length > 1200 && !/NaN|undefined|\[object Object\]/.test(p)), `all four sub-tabs render cleanly in ${tn}`, parts.map((p) => p.length).join(","));
}
const ov = renderToStaticMarkup(<HistMigration t={tLight} initial={{ sub: "Overview", summary, lanes, artifacts, dictionary, evidence, batches }} />);
ok(/214,622/.test(ov) && /15,880/.test(ov) && /unresolved lanes/.test(ov) && /ADDVANTAGE_SEI_HIST/.test(ov) && /DCONCUS10_20210727\.docx/.test(ov) && /REFERENCE/.test(ov) && /CP360-HM-007/.test(ov) && /Warning/.test(ov),
   "overview: the totals, the lane, the reference artifact, the latest batch's checks");
const ev = renderToStaticMarkup(<HistMigration t={tLight} initial={{ sub: "Evidence", summary, lanes, artifacts, dictionary, evidence, batches }} />);
ok(/Subfirm Logic/.test(ev) && /unresolved/.test(ev) && /6200 characters; open the row/.test(ev) && /2 rows · page 1 of 1/.test(ev) && /search evidence/.test(ev), "evidence: the rows, the unresolved chip, the truncation note, the paging and the search");
const empty = renderToStaticMarkup(<HistMigration t={tLight} initial={{ sub: "Overview", summary: emptySummary(), lanes: [], artifacts: [], dictionary: [], evidence: { evidence: [], total: 0 }, batches: [] }} />);
ok(/Nothing loaded yet/.test(empty) && /API did not answer/.test(empty) && /sql\/86/.test(empty) && !/NaN/.test(empty), "the empty state with no answer says to restart the API");
const noTable = renderToStaticMarkup(<HistMigration t={tLight} initial={{ sub: "Overview", summary: { ...emptySummary(), reason: "no_table" }, lanes: [], artifacts: [], dictionary: [], evidence: { evidence: [], total: 0 }, batches: [] }} />);
const noRows = renderToStaticMarkup(<HistMigration t={tLight} initial={{ sub: "Overview", summary: { ...emptySummary(), reason: "no_rows" }, lanes: [], artifacts: [], dictionary: [], evidence: { evidence: [], total: 0 }, batches: [] }} />);
ok(/apply <span[^>]*>sql\/86_hist_migration\.sql/.test(noTable) && /tables exist and are empty/.test(noRows) && /has no HIST_\* sheet/.test(noRows), "the empty state names the cause: tables missing, or tables empty with the sheet-name hint");
const dict = renderToStaticMarkup(<HistMigration t={tLight} initial={{ sub: "Dictionary", summary, lanes, artifacts, dictionary, evidence, batches }} />);
ok(HM_RULES.length === 11 && HM_RULES[0][0] === "CP360-HM-001" && HM_RULES[10][0] === "CP360-HM-011" && /CP360-HM-010/.test(dict) && /Evidence Value/.test(dict), "the eleven rules and the dictionary are on the Dictionary sub-tab");
const scrubbed = (ov + ev + dict).replace(/DCONCUS10_20210727\.docx/g, "");
ok(!/@[a-z0-9-]+\.[a-z]{2,}/i.test(scrubbed) && !/\b\d{7,}\b/.test(scrubbed), "no address or long identifier on the tab (the deconversion spec's dated file name aside)");

console.log("-- wiring");
const page = renderToStaticMarkup(<DataAnalysis t={tLight} initial={{ tab: "Historical data migration", overview: { totals: { fields: 0 }, by_file: [] }, status: { fields: 0 }, hist: { sub: "Overview", summary, lanes, artifacts, dictionary, evidence, batches } }} />);
ok(/Historical data migration/.test(page) && /aria-selected="true"/.test(page) && /214,622/.test(page), "Data Analysis carries the tab and renders it");
const SRC = fs.existsSync("src/HistMigration.jsx") ? "src" : path.join("ui", "src");
const api = fs.readFileSync(path.join(SRC, "histMigrationApi.js"), "utf8");
ok(/\/hist-migration/.test(api) && !/from ["']\.\/api\.js["']/.test(api) && !/api\.js/.test(fs.readFileSync(path.join(SRC, "HistMigration.jsx"), "utf8")), "the client is self-contained: api.js untouched");
const ps1 = fs.readFileSync(path.join(SRC, "..", "..", "local", "load-all.ps1"), "utf8");
ok(/hist_migration/.test(ps1) && /CP_HIST_MIGRATION_FORCE/.test(ps1), "load-all.ps1 says the sheets ride the crosswalk workbook");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nhist migration assertions pass");
if (bad) process.exit(1);
