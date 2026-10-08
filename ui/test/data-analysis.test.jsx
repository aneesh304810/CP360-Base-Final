// Utilities · Data Analysis: the lineage model, the picture, the wiring.
//
// WHAT THIS LOCKS DOWN. The page draws what ingest wrote; the one thing it
// builds itself is the lineage model (sources grouped by system, the rule,
// the SEI field, the downstream targets). A model that dropped a source or
// put a crosswalk among the sources would draw a wrong picture that still
// renders, so the model is pinned on a detail shaped like /field, then the
// picture is rendered and read for its boxes, then the nav and route.

import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { tLight } from "../src/bbhTheme.js";
import DataAnalysis, { LineageDiagram } from "../src/DataAnalysis.jsx";
import { buildLineage, describeRule, RULE_CLASSES, SYSTEMS, ruleColor } from "../src/seiMigrationApi.js";

let bad = 0;
const ok = (c, m, got) => { console.log(`${c ? "ok  " : "FAIL"} ${m}${c ? "" : `  -> ${String(got).slice(0, 240)}`}`); if (!c) bad++; };
function findSrc() {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    for (const rel of ["src", path.join("ui", "src")]) {
      const p = path.join(dir, rel);
      if (fs.existsSync(path.join(p, "AppShell.jsx"))) return p;
    }
    dir = path.dirname(dir);
  }
  throw new Error("src not found");
}
const SRC = findSrc();

const detail = {
  field: {
    catalog_id: "SEI-ACCOUNT-BASIC-002", functional_group: "Static Data", source_object: "account-basic.dat", seq: 2,
    source_attribute: "ACCOUNT_NUMBER", data_type: "Alpha Numeric", max_length: "14", max_decimal: "", domicile: "All",
    mandatory_class: "ALWAYS", rule_class: "DERIVED", rule_side: "BBH", status_class: "COMPLETE", status_detail: "",
    rule_text: "Use StarId from IM_ACCOUNT_CLASSIFICATION to match Entity_number from IM_ACCOUNT_DETAIL",
    other_mapping_logic: "Use StarId from IM_ACCOUNT_CLASSIFICATION to match Entity_number from IM_ACCOUNT_DETAIL",
    processing_logic: "", validations: "1. May only contain a-z A-Z 0-9 - _", acceptable_values: "", remarks: "The external number by which the client knows the account.",
    function_category: "Account Basic", note: "", emp_dsr_logic: "", team_dsr_logic: "", source_workbook: "catalog.xlsx", source_sheet: "acct-basic",
  },
  sources: [
    { source_table: "IM_ACCOUNT_CLASSIFICATION", source_field: "-", system_class: "IM", role: "SOURCE", how: "TABLES" },
    { source_table: "IM_ACCOUNT_DETAIL", source_field: "CUSTODY_HEAD_ACCOUNT_NUMBER", system_class: "IM", role: "SOURCE", how: "RULE" },
    { source_table: "IM_UAF_PACE_ACCOUNT", source_field: "BBH_ACCOUNT_NUMBER", system_class: "UAF", role: "SOURCE", how: "RULE" },
    { source_table: "XOS_HOUSE_ACCOUNT_MAP", source_field: "-", system_class: "CONVERSION", role: "CROSSWALK", how: "TABLES" },
    { source_table: "AV_DEFAULTS", source_field: "-", system_class: "ADDVANTAGE", role: "CROSSWALK", how: "TABLES" },
  ],
  targets: [
    { target_kind: "OUTBOUND", target_object: "Accounts", target_field: "ACCOUNT_NUMBER", transformation: "" },
    { target_kind: "BOXI", target_object: "Client and Account Characteristics>>Account Characteristics", target_field: "Account Number", transformation: "" },
    { target_kind: "ADE_CAS", target_object: "Account Basic", target_field: "-", transformation: "" },
  ],
  prev: "SEI-ACCOUNT-BASIC-001", next: "SEI-ACCOUNT-BASIC-003", findings: [],
};

console.log("-- the lineage model");
const lin = buildLineage(detail);
ok(lin.sources.map((g) => g.system).sort().join("|") === "IM|UAF", "sources grouped by system, crosswalks kept out of the source column", lin.sources.map((g) => g.system));
const im = lin.sources.find((g) => g.system === "IM");
ok(im.tables.length === 2 && im.tables.find((x) => x.table === "IM_ACCOUNT_DETAIL").fields[0].name === "CUSTODY_HEAD_ACCOUNT_NUMBER", "a table carries its named fields; '-' is no field", im.tables);
ok(lin.rule.cls === "DERIVED" && lin.rule.aids.length === 2 && lin.rule.aids.every((a) => a.role === "CROSSWALK"), "the rule node carries the crosswalks it uses", lin.rule.aids);
ok(lin.target.file === "account-basic.dat" && lin.target.field === "ACCOUNT_NUMBER" && lin.target.mandatory === "ALWAYS", "the SEI field");
ok(lin.downstream.map((d) => d.kind).join("|") === "OUTBOUND|BOXI|ADE_CAS" && lin.downstream[1].items[0].field === "Account Number", "downstream in kind order", lin.downstream);
ok(!lin.empty.sources && !lin.empty.downstream, "nothing empty here");
const bare = buildLineage({ field: { ...detail.field, rule_class: "SET_NULL", rule_text: "Set to Null" }, sources: [], targets: [] });
ok(bare.empty.sources && bare.empty.downstream && bare.sources.length === 0, "a set-to-null field has no sources and says so");
ok(buildLineage(null) === null && buildLineage({}) === null, "no detail, no model");
ok(describeRule(detail.field) === "Derived" && describeRule({ rule_class: "LOOKUP", rule_side: "SEI" }).includes("SEI's logic"), "the one-line rule description");
ok(Object.keys(RULE_CLASSES).length === 10 && Object.keys(SYSTEMS).includes("CONVERSION") && ruleColor(tLight, "NOT_MAPPED") === tLight.danger, "vocabularies");

console.log("-- the picture");
const svg = renderToStaticMarkup(<LineageDiagram t={tLight} lin={lin} />);
ok(/BBH SOURCES/.test(svg) && /BBH MAPPING RULE/.test(svg) && /SEI LOAD-FILE FIELD/.test(svg) && /WHERE IT GOES NEXT/.test(svg), "four column headings");
ok(/IM_ACCOUNT_DETAIL/.test(svg) && /CUSTODY_HEAD_ACCOUNT_NUMBER/.test(svg) && /IM_UAF_PACE_ACCOUNT/.test(svg), "source tables and fields drawn");
ok(/XOS_HOUSE_ACCOUNT_MAP/.test(svg) && /crosswalk/.test(svg), "the crosswalks sit on the rule node");
ok(/ACCOUNT-BASIC\.DAT/.test(svg) && />ACCOUNT_NUMBER</.test(svg), "the SEI field is named with its file");
ok(/STANDARD OUTBOUND FILE/.test(svg) && /BOXI REPORT/.test(svg) && /ADE-CAS/.test(svg), "downstream boxes labelled by kind");
const edges = (svg.match(/<path d="M [^"]*" fill="none"/g) || []).length;
ok(edges === 3 + 1 + 3, "one edge per source table, one for the rule, one per downstream target", edges);
const empty = renderToStaticMarkup(<LineageDiagram t={tLight} lin={bare} />);
ok(/no BBH source named/.test(empty) && /the rule needs none/.test(empty), "an empty source column explains itself for a constant or null");

console.log("-- the page");
const page = renderToStaticMarkup(<DataAnalysis t={tLight} initial={{ tab: "Lineage", detail, overview: { totals: { fields: 6 }, by_file: [{ source_object: "account-basic.dat" }] }, status: { fields: 6, sources: 12, targets: 9 } }} />);
ok(/Data Analysis/.test(page) && /SEI is the target/.test(page), "the page says what it is and which side is the target");
for (const tab of ["Overview", "Fields", "Lineage", "Sources", "Findings", "Lookups"]) ok(new RegExp(`>${tab}<`).test(page), `tab ${tab}`);
ok(/BBH mapping rule/.test(page) && /Use StarId from IM_ACCOUNT_CLASSIFICATION/.test(page) && /SEI processing logic/.test(page), "the rule text panels");
ok(/previous/.test(page) && /next ▸/.test(page), "step through the file");
const emptyPage = renderToStaticMarkup(<DataAnalysis t={tLight} initial={{ overview: { totals: { fields: 0 }, by_file: [] }, status: { fields: 0 } }} />);
ok(/nothing loaded yet/.test(emptyPage) && /load\.ps1 sei_migration/.test(emptyPage), "an empty warehouse says how to load");

console.log("-- wired in");
const shell = fs.readFileSync(path.join(SRC, "AppShell.jsx"), "utf8");
const app = fs.readFileSync(path.join(SRC, "App.jsx"), "utf8");
ok(/\['dataanalysis', 'Data Analysis'/.test(shell) && /group: 'Utilities'[\s\S]*?dataanalysis[\s\S]*?\]\s*\}/.test(shell), "Data Analysis sits under Utilities in the nav");
ok(/import DataAnalysis from "\.\/DataAnalysis\.jsx"/.test(app) && /dataanalysis: <DataAnalysis t=\{t\} \/>/.test(app), "and routes to the page");
ok(!/from ['"]\.\/api\.js['"]/.test(fs.readFileSync(path.join(SRC, "seiMigrationApi.js"), "utf8")), "the client never touches api.js");

console.log(bad ? `\n${bad} assertion(s) failed` : "\ndata-analysis assertions pass");
if (bad) process.exit(1);
