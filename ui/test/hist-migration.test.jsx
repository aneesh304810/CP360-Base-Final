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
import { HM_RULES, HL_RULES, STATUS_COLOR, STATUS_KINDS, emptySummary, emptyLineageSummary } from "../src/histMigrationApi.js";
import { HistChainFig, LineageTab, MappingTab, RulesTab, DeconTab, QcTab } from "../src/HistLineage.jsx";
import { HistLineageDiagram, HistHopChain, MappingTable, histSources } from "../src/HistLineageFigs.jsx";
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

const lineageSummary = { totals: { lineage: 2270, targetFields: 1180, datFiles: 14, rules: 1507, decon: 212, qc: 9, sharedTargets: 96, matched: 1904, unmatched: 366, blankTarget: 0 },
  byLane: [{ key: "ADDVANTAGE_SEI_HIST", n: 1402 }, { key: "STAR_SEI_HIST", n: 612 }, { key: "UAF_SEI_HIST", n: 256 }], byGroup: [{ key: "Account", n: 900 }], byRuleStatus: [{ key: "Complete", n: 1800 }, { key: "Open", n: 470 }],
  byApproval: [{ key: "DRAFT_REVIEW_REQUIRED", n: 2270 }], byDecon: [{ key: "CURATED", n: 1500 }, { key: "REVIEW_REQUIRED", n: 770 }], byMatch: [{ key: "MATCHED", n: 1904 }, { key: "UNMATCHED", n: 366 }],
  byFile: [{ file: "account-basic.dat", fields: 120, rows: 240, lanes: 3, matched: 200 }], manifest: [{ manifest_key: "WORKBOOK_VERSION", manifest_value: "v12" }] };
const rec = { lineage_id: "HL-0001", catalog_id: "SEI-ACCOUNT-BASIC-001-ACCOUNTNUMBER", functional_group: "Account", source_path: "AddVantage / PB -> SEI", source_system: "AddVantage / PB", lane_id: "ADDVANTAGE_SEI_HIST",
  source_object_field: "SGA_DCON_ACCT.ACCT_NO", decon_dictionary_meaning: "Deconversion account master", decon_business_domain: "Account", decon_dictionary_status: "CURATED", decon_status_text: "Curated", source_dependencies: "",
  transformation_rule_source: "merged catalog", transformation_rule: "TRIM(ACCT_NO)", rule_status: "Complete", target_system: "SEI", target_dat_file: "account-basic.dat", target_field: "ACCOUNT_NUMBER", target_field_norm: "ACCOUNT_NUMBER",
  target_key: "SEI::account-basic.dat::ACCOUNT_NUMBER", target_data_type: "CHAR", target_max_length: "20", mandatory: "Yes", validation_rule: "numeric", source_workbook: "DSR_Mapping.xlsx", source_sheet: "AV_DSR_MAP", source_row: 2,
  recon_key: "AddVantage / PB -> SEI|DSR_Mapping.xlsx|AV_DSR_MAP|2|account-basic.dat|ACCOUNT_NUMBER", match_method: "EXACT_NORMALIZED_FIELD_MATCH", match_status: "MATCHED", approval_status: "DRAFT_REVIEW_REQUIRED" };
const record = { record: rec, rules: [{ rule_id: "R-0001", rule_type: "DIRECT", transformation_rule: "TRIM(ACCT_NO)", validation_rule: "", mapping_status: "Complete", approval_status: "DRAFT_REVIEW_REQUIRED", source_objects_fields: "SGA_DCON_ACCT.ACCT_NO" }],
  decon: [{ technical_object: "SGA_DCON_ACCT", business_meaning: "Deconversion account master", basis_class: "CURATED", dictionary_status: "CURATED", lineage_usage_count: 12, business_domain: "Account" }],
  siblings: [{ lineage_id: "HL-0002", lane_id: "STAR_SEI_HIST", source_object_field: "IM_ACCOUNT.ACCOUNT_ID", rule_status: "Complete", approval_status: "DRAFT_REVIEW_REQUIRED", decon_dictionary_status: "REVIEW_REQUIRED", match_status: "MATCHED" }],
  qc: [{ qc_id: "QC-0002", control_name: "ACCOUNT_NUMBER present in SEI catalog", expected: "1", actual: "1", result: "PASS" }],
  seiInput: [{ input_id: "i1", sei_target_file: "account-basic.dat", sei_field: "Account Number", published_type: "CHAR", mapping_status: "Mapped", upstream_object: "STAR_ACCT", upstream_field: "ACCT_NO" }],
  star: [{ map_id: "m1", src_file_key: "ACDDIFI1", src_source_column: "ACCT_NO", sei_feed: "account", sei_entity: "basic", map_kind: "DIRECT" }],
  imds: [{ lineage_id: "l1", star_map: "m1", src_source_table: "ACDDIFI1", src_source_column: "ACCT_NO", src_to_stg1_transform: "TRIM(ACCT_NO)", stg1_source_table: "STG1_ACCT", stg1_source_column: "ACCT_NO", stg1_to_stg2_transform: "LPAD(ACCT_NO, 12, '0')", stg2_source_table: "STG2_ACCT", stg2_source_column: "ACCOUNT_NUMBER", stg2_to_dwh_transform: "", dwh_target_table: "DIM_ACCOUNT", dwh_target_column: "ACCOUNT_NUMBER", dwh_type: "VARCHAR2", dwh_length: "12", lineage_status: "VERIFIED", source_system: "STAR" }],
  chain: { lane: "ADDVANTAGE_SEI_HIST", sourceObjects: ["SGA_DCON_ACCT"], rule: "R-0001", datFile: "account-basic.dat", targetField: "ACCOUNT_NUMBER", targetKey: "SEI::account-basic.dat::ACCOUNT_NUMBER", seiInput: 1, star: 1, imds: 1,
    statuses: { rule: "Complete", approval: "DRAFT_REVIEW_REQUIRED", dictionary: "CURATED", match: "MATCHED" } } };
const lineage = { summary: lineageSummary, list: { lineage: [rec, { ...rec, lineage_id: "HL-0002", lane_id: "STAR_SEI_HIST", source_object_field: "IM_ACCOUNT.ACCOUNT_ID", decon_dictionary_status: "REVIEW_REQUIRED", common_target_indicator: "Y" }], total: 2 }, record };
const rules = { rules: record.rules.map((r) => ({ ...r, sei_target_file: "account-basic.dat", sei_target_field: "ACCOUNT_NUMBER", rule_source_column: "Other Mapping Logic" })), total: 1507, byType: [{ key: "DIRECT", n: 900 }], byStatus: [], byApproval: [], byFile: [] };
const decon = { objects: record.decon.map((d) => ({ ...d, source_prefix: "SGA_DCON", source_type: "table", migration_function: "account conversion", definition_basis: "Curated", example_target_fields: "ACCOUNT_NUMBER" })), byStatus: [{ key: "CURATED", n: 150 }], byBasis: [{ key: "NAME_DERIVED", n: 62 }], byDomain: [], byPrefix: [{ key: "SGA_DCON", n: 80 }] };
const qc = { controls: [{ qc_id: "QC-0001", control_name: "No blank TARGET_FIELD", applies_to: "FINAL_HIST_MIGRATION_LINEAGE", expected: "0", actual: "0", result: "PASS", detail: "", row: { CONTROL: "No blank TARGET_FIELD", NOTE: "checked on export" } }] };

console.log("-- the lineage diagram and the column chain");
const srcs = histSources(record);
ok(srcs.length === 1 && srcs[0].object === "SGA_DCON_ACCT" && srcs[0].fields.join() === "ACCT_NO" && srcs[0].meaning && srcs[0].meaning.basis_class === "CURATED", "the source objects and fields are read off the row and matched to the decon dictionary", srcs);
const dia = renderToStaticMarkup(<HistLineageDiagram t={tLight} d={record} />);
ok(/HISTORICAL SOURCES/.test(dia) && /TRANSFORMATION RULE/.test(dia) && /SEI TARGET FIELD/.test(dia) && /WHERE IT GOES TODAY/.test(dia) && /SGA_DCON_ACCT/.test(dia) && /· ACCT_NO/.test(dia) && /curated/.test(dia)
   && /TRIM\(ACCT_NO\)/.test(dia) && /ACCOUNT-BASIC\.DAT/.test(dia) && /SEI INPUT LINEAGE/.test(dia) && /STAR CONTRACT FIELD/.test(dia) && /IMDS COLUMN/.test(dia) && /DIM_ACCOUNT\.ACCOUNT_NUMBER/.test(dia) && (dia.match(/<path /g) || []).length >= 5,
   "the lineage diagram in the Data Analysis style: sources, rule, SEI field, downstream, with curved edges");
const hop = renderToStaticMarkup(<HistHopChain t={tLight} d={record} />);
ok(/Column-level transformation chain/.test(hop) && /Historical source/.test(hop) && /SEI target/.test(hop) && /STAR contract/.test(hop) && /Landing/.test(hop) && /Conformed/.test(hop) && /IMDS warehouse/.test(hop)
   && /TRIM\(ACCT_NO\)/.test(hop) && /LPAD\(ACCT_NO, 12, &#x27;0&#x27;\)/.test(hop) && /no rule written/.test(hop) && /src → stg1/.test(hop) && /stg2 → dwh/.test(hop) && /EXACT_NORMALIZED_FIELD_MATCH/.test(hop),
   "the column chain with the rule on every hop: the historical rule, the name match, the three operational transforms, and an empty hop called out");
const hopNone = renderToStaticMarkup(<HistHopChain t={tLight} d={{ ...record, star: [], imds: [] }} />);
ok(/no operational STAR field or IMDS column/.test(hopNone) && !/Landing/.test(hopNone), "a field with no operational path stops at the SEI target and says so");
const mapping = { mapping: [{ lineage_id: "HL-0001", lane_id: "ADDVANTAGE_SEI_HIST", source_object_field: "SGA_DCON_ACCT.ACCT_NO", transformation_rule: "TRIM(ACCT_NO)", rule_status: "Complete", approval_status: "DRAFT_REVIEW_REQUIRED", decon_dictionary_status: "CURATED", target_dat_file: "account-basic.dat", target_field: "ACCOUNT_NUMBER", target_data_type: "CHAR", target_max_length: "20", match_status: "MATCHED", map_id: "m1", src_file_key: "ACDDIFI1", src_source_column: "ACCT_NO", map_kind: "DIRECT", legacy_id: "l1", stg1_source_column: "ACCT_NO", stg2_source_column: "ACCOUNT_NUMBER", dwh_target_table: "DIM_ACCOUNT", dwh_target_column: "ACCOUNT_NUMBER", dwh_type: "VARCHAR2", lineage_status: "VERIFIED" },
  { lineage_id: "HL-0003", lane_id: "UAF_SEI_HIST", source_object_field: "XOS_PARTY.SUB_FIRM_CD", transformation_rule: "", rule_status: "Open", approval_status: "DRAFT_REVIEW_REQUIRED", decon_dictionary_status: null, target_dat_file: "party-basic.dat", target_field: "Sub-Firm", target_data_type: "CHAR", target_max_length: "10", match_status: "UNMATCHED" }], files: [{ key: "account-basic.dat", n: 2 }, { key: "party-basic.dat", n: 1 }] };
const mt = renderToStaticMarkup(<MappingTab t={tLight} initial={mapping} />);
ok(/Lineage mapping/.test(mt) && /2 paths · 1 reach an IMDS column · 1 with no rule written/.test(mt) && /SGA_DCON_ACCT\.ACCT_NO/.test(mt) && /DIM_ACCOUNT/.test(mt) && /XOS_PARTY\.SUB_FIRM_CD/.test(mt) && /no rule written/.test(mt) && /UNMATCHED/.test(mt) && /party-basic\.dat \(1\)/.test(mt),
   "the mapping sub-tab: one row per path with the source column, the rule, the SEI field, the STAR field and the IMDS column, and the counts");
ok(!/NaN|undefined|\[object Object\]/.test(dia + hop + mt) && !/NaN|undefined/.test(renderToStaticMarkup(<MappingTable t={tDark} rows={mapping.mapping} />)), "nothing undefined in the new figures, light or dark");

console.log("-- the lineage package");
const chain = renderToStaticMarkup(<HistChainFig t={tLight} d={record} />);
ok(/HISTORICAL MIGRATION LINEAGE · HL-0001/.test(chain) && /Historical lane/.test(chain) && /Source objects/.test(chain) && /Transformation rule/.test(chain) && /SEI dat file/.test(chain) && /SEI target field/.test(chain) && /SEI input lineage/.test(chain) && /STAR contract field/.test(chain) && /IMDS column/.test(chain)
   && /rule Complete · approval DRAFT_REVIEW_REQUIRED · dictionary CURATED · match MATCHED/.test(chain) && /1 other lane/.test(chain) && (chain.match(/stroke-dasharray="4 3"/g) || []).length === 3,
   "the chain figure: eight boxes left to right, the four statuses apart, the sibling lane named, the operational hops dashed");
for (const [tn, t] of [["light", tLight], ["dark", tDark]]) {
  const parts = [renderToStaticMarkup(<LineageTab t={t} initial={lineage} />), renderToStaticMarkup(<RulesTab t={t} initial={rules} />), renderToStaticMarkup(<DeconTab t={t} initial={decon} />), renderToStaticMarkup(<QcTab t={t} initial={qc} />)];
  ok(parts.every((p) => p.length > 800 && !/NaN|undefined|\[object Object\]/.test(p)), `lineage, rules, decon and QC sub-tabs render cleanly in ${tn}`, parts.map((p) => p.length).join(","));
}
const lt = renderToStaticMarkup(<LineageTab t={tLight} initial={lineage} />);
ok(/2,270/.test(lt) && /1,180/.test(lt) && /fields on 2\+ lanes/.test(lt) && /366/.test(lt) && /the workbook records zero/.test(lt) && /Same target, other lanes/.test(lt) && /HL-0002/.test(lt) && /never merges a PB source/.test(lt)
   && /→ STAR/.test(lt) && /ACDDIFI1/.test(lt) && /DIM_ACCOUNT\.ACCOUNT_NUMBER/.test(lt) && /Reconciliation key/.test(lt) && /CP360-HL-004/.test(lt) && /WORKBOOK_VERSION/.test(lt) && /common<\/span>/.test(lt),
   "the lineage sub-tab: the tiles, the record end to end with its sibling lane, the STAR and IMDS hops, the reconciliation key, the rules and the manifest");
ok(/Transformation rules/.test(renderToStaticMarkup(<RulesTab t={tLight} initial={rules} />)) && /1,507 rules/.test(renderToStaticMarkup(<RulesTab t={tLight} initial={rules} />)) && /Decon source dictionary/.test(renderToStaticMarkup(<DeconTab t={tLight} initial={decon} />)) && /NAME_DERIVED/.test(renderToStaticMarkup(<DeconTab t={tLight} initial={decon} />)) && /checked on export/.test(renderToStaticMarkup(<QcTab t={tLight} initial={qc} />)),
   "rules, decon and QC sub-tabs show their counts, the basis and the row cells");
ok(HL_RULES.length === 8 && STATUS_KINDS.length === 4 && STATUS_COLOR("MATCHED") === "#159943" && STATUS_COLOR("DRAFT_REVIEW_REQUIRED") === "#c96a12" && STATUS_COLOR("UNMATCHED") === "#b42318" && emptyLineageSummary().totals.lineage === 0,
   "eight HL rules, four independent status kinds, and the colours read the status words");
const emptyLin = renderToStaticMarkup(<LineageTab t={tLight} initial={{ summary: emptyLineageSummary(), list: { lineage: [], total: 0 } }} />);
ok(/No lineage loaded/.test(emptyLin) && /sql\/87_hist_lineage\.sql/.test(emptyLin), "the lineage empty state names sql/87 and the load script");

console.log("-- the tab");
for (const [tn, t] of [["light", tLight], ["dark", tDark]]) {
  const parts = ["Overview", "Lineage", "Lineage mapping", "Rules", "Decon dictionary", "QC", "Evidence", "Dictionary", "Loads"].map((sub) => renderToStaticMarkup(<HistMigration t={t} initial={{ sub, summary, lanes, artifacts, dictionary, evidence, batches, lineage, mapping, rules, decon, qc }} />));
  ok(parts.every((p) => p.length > 1200 && !/NaN|undefined|\[object Object\]/.test(p)), `all nine sub-tabs render cleanly in ${tn}`, parts.map((p) => p.length).join(","));
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
