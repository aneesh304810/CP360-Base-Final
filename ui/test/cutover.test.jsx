// The cutover view: the IMDS column keeps its transformation, the STAR
// input is replaced by the SEI source. One row per IMDS column.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { tLight } from "../src/bbhTheme.js";
import MappingDocsPanel, { Cutover, ruleLabel } from "../src/MappingDocs.jsx";
import { RULE_STATE, RULE_STATE_ORDER, mappingDocs } from "../src/seiCrosswalkApi.js";

let bad = 0;
const ok = (c, m, got) => { console.log(`${c ? "ok  " : "FAIL"} ${m}${c ? "" : `  -> ${String(got).slice(0, 240)}`}`); if (!c) bad++; };

const cutover = {
  feed: "PEDDIFI1", feeds: [{ feed_family: "PEDDIFI1" }, { feed_family: "ODDDIFI1" }],
  totals: { columns: 3, tables: 1, with_sei: 2, no_sei: 1, kept: 1, rewritten: 1, business_decisions: 1, star_fields: 3,
            by_state: [{ key: "SUBSTITUTED", n: 1 }, { key: "REWRITTEN", n: 1 }, { key: "NO_SEI_RULE", n: 1 }] },
  columns: [
    { row_id: "a", imds_table: "HOLDINGDBO.POSITION", imds_column: "QUANTITY", target_type: "NUMBER(28,12)", target_nullable: "No",
      star: { field: "Lot Quantity", norm: "LOT_QUANTITY", in_layout: "Y", type: "NUM", length: "18", usage_status: "Used", is_used: "Y", doc_usage: "Used" },
      sei: { object: "Taxlot", field: "QUANTITY", source: "Taxlot.QUANTITY", map_kind: "DERIVED", join_logic: "TAXLOT_TYPE_CODE = 2", mapping_status: "CANDIDATE", approval_status: "DRAFT_REVIEW_REQUIRED",
             file: "Taxlot", file_fields: "Taxlot.QUANTITY_HELD", file_status: "VERIFIED_IN_FEED_SPEC" },
      rule: { im_logic: "SUM(lot_qty)", sei_logic: "SUM(Taxlot.QUANTITY)", state: "SUBSTITUTED", evidence_completeness: "BOTH_LOGICS_DOCUMENTED", business_decision: "N", comparison_id: "CMP-1" },
      link_status: "E2E_LINKED", link_class: "E2E", crosswalk_status: "CANDIDATE", has_sei: true, source_document: "pv.xlsx", source_row: 13 },
    { row_id: "b", imds_table: "HOLDINGDBO.POSITION", imds_column: "ENTITY_ID", target_type: "CHAR(8)", target_nullable: "No",
      star: { field: "Entity Number", norm: "ENTITY_NUMBER", in_layout: "Y", usage_status: "Used", is_used: "Y" },
      sei: { object: null, field: null, source: null, map_kind: "NO_MAPPING", mapping_status: "NO_SEI_SOURCE" },
      rule: { im_logic: "substr(entity, 1, 8)", sei_logic: null, state: "NO_SEI_RULE", evidence_completeness: "IM_ONLY_DOCUMENTED", business_decision: "Y", comparison_id: "CMP-2" },
      link_status: "NO_SEI_SOURCE", link_class: "NO_SEI_SOURCE", crosswalk_status: "GAP", has_sei: false, source_document: "pv.xlsx", source_row: 14 },
    { row_id: "c", imds_table: "HOLDINGDBO.POSITION", imds_column: "EFFECTIVE_DATE", target_type: "DATE",
      star: { field: "Accounting Date", norm: "ACCOUNTING_DATE", in_layout: "N", usage_status: "Unused", is_used: "N" },
      sei: { object: null, field: "PROCESSING_DATE", source: "PROCESSING_DATE", map_kind: "SYSTEM_DATE" },
      rule: { im_logic: "to_date(effective_date_2,'MM/DD/YYYY')", sei_logic: "PROCESSING_DATE", state: "REWRITTEN", evidence_completeness: "BOTH_LOGICS_DOCUMENTED", business_decision: "N" },
      link_class: "STAR_NOT_IN_FILE_MAP", has_sei: true, source_document: "pv.xlsx" },
  ],
};

console.log("-- the vocabulary");
ok(RULE_STATE_ORDER.length === 7 && RULE_STATE_ORDER.every((k) => RULE_STATE[k]?.t && RULE_STATE[k]?.hint), "seven rule states, each with a label and a hint");
ok(ruleLabel("SUBSTITUTED") === "same rule, SEI input" && ruleLabel("NO_SEI_RULE") === "no SEI rule" && ruleLabel("X_Y") === "x_y", "labels");
ok(typeof mappingDocs.cutoverLineage === "function", "the client call");

console.log("-- the picture");
const html = renderToStaticMarkup(<Cutover t={tLight} ds="IMDS" feeds={[]} initial={cutover} onOpenColumn={() => {}} />);
ok(/Source · STAR today, SEI after cutover/.test(html) && /Transformation · kept into IMDS/.test(html) && /IMDS column/.test(html), "three column headings, in cutover order");
ok(/line-through/.test(html) && /Lot Quantity/.test(html) && /replaced by ↓/.test(html) && /Taxlot\.QUANTITY/.test(html), "a replaced STAR field is struck through, the SEI source beneath it");
ok(/same rule, SEI input/.test(html) && /SUM\(lot_qty\)/.test(html) && /SUM\(Taxlot\.QUANTITY\)/.test(html), "the rule in the middle, both sides, classed");
ok(/no SEI source/.test(html) && /stays until a SEI source is named/.test(html) && /no SEI rule/.test(html) && /business decision/.test(html), "a column without a SEI source says so, and its rule is the gap");
ok(/⚠/.test(html) && /read by nothing/.test(html), "a STAR field not in the layout and one read by nothing are marked");
ok(/>QUANTITY</.test(html) && /verdict ▸/.test(html) && /HOLDINGDBO\.POSITION/.test(html), "the IMDS column with a way to its verdict");
ok(/file Taxlot\.QUANTITY_HELD/.test(html) && /verified in the feed spec/.test(html), "v4: the SEI feed file the source resolves to, under the source");
ok(/rule kept/.test(html) && /rule changes/.test(html) && /same rule, SEI input · 1/.test(html) && /rewritten · 1/.test(html), "the tiles and the state chips count");
const none = renderToStaticMarkup(<Cutover t={tLight} ds="IMDS" feeds={["PEDDIFI1"]} initial={{ feed: "", feeds: [], columns: [], totals: {} }} />);
ok(/Pick a STAR feed/.test(none) && /PEDDIFI1/.test(none), "no feed picked: the invitation and the feeds");
const panel = renderToStaticMarkup(<MappingDocsPanel t={tLight} dataSource="IMDS" initial={{ register: { docs: [], totals: { documents: 1, s2s_rows: 1 } }, coverage: { total: 1, by_link: [], by_approval: [] }, cutover }} />);
ok(/>Cutover</.test(panel) && /Source · STAR today, SEI after cutover/.test(panel), "Cutover is the panel's first view and the default");

console.log(bad ? `\n${bad} assertion(s) failed` : "\ncutover assertions pass");
if (bad) process.exit(1);
