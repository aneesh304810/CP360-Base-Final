// The UD code list on Datapoint 360.
//
// WHAT THIS LOCKS DOWN. The workbook describes every one of the 300 UD
// fields the same way ("User-Defined Text. Up to 300 fields available."),
// so the pane said nothing about UD_1. The meaning is in its values, and
// those come from a second table through a second client. Three things
// can silently undo that: the pane stops calling the client, the client
// is called for fields that have no codes (one wasted round trip per
// click on 2,759 fields), or the summary line claims a verified lookup
// for values that were merely observed. Each is asserted on the source,
// because a pane that renders without the row still renders.

import React from "react";
import fs from "node:fs";
import path from "node:path";
import { isUdAttribute, codedSummary, advantageUdApi } from "../src/advantageUd.js";

let bad = 0;
const ok = (c, m, got) => { console.log(`${c ? "ok  " : "FAIL"} ${m}${c ? "" : `  -> ${String(got).slice(0, 200)}`}`); if (!c) bad++; };

function findSrc() {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    for (const rel of ["src", path.join("ui", "src")]) {
      const p = path.join(dir, rel);
      if (fs.existsSync(path.join(p, "Datapoint360.jsx"))) return p;
    }
    dir = path.dirname(dir);
  }
  throw new Error("src not found");
}
const SRC = findSrc();
const D = fs.readFileSync(path.join(SRC, "Datapoint360.jsx"), "utf8");

console.log("-- which fields have codes");
for (const c of ["UD_1", "ud_1", "UD_23_1", "UD_503"]) ok(isUdAttribute(c), `${c} is a UD attribute`);
for (const c of ["BI_2_1", "UD", "UD_1_", "ACCOUNT_NUMBER", "", null]) ok(!isUdAttribute(c), `${JSON.stringify(c)} is not`);

console.log("-- the summary line says where the values came from");
ok(codedSummary([]) === null && codedSummary(null) === null, "no codes, no line");
const obs = [{ code_value: "2", source: "OBSERVED", link_status: "OBSERVED" },
             { code_value: "6", source: "OBSERVED", link_status: "OBSERVED" }];
ok(/2 values/.test(codedSummary(obs)) && /not yet confirmed/.test(codedSummary(obs)),
   "observed values are called observed, not defined", codedSummary(obs));
ok(!/verified/.test(codedSummary(obs)), "and never verified");
const both = [...obs, { code_value: "7", source: "TABLES", link_status: "VERIFIED" }];
ok(/lookup table and observed/.test(codedSummary(both)) && /verified/.test(codedSummary(both)),
   "a verified table link is said", codedSummary(both));
ok(/1 value /.test(codedSummary([obs[0]])), "singular for one");

console.log("-- the pane is wired");
ok(/import \{[^}]*advantageUdApi[^}]*\} from "\.\/advantageUd\.js"/.test(D), "Datapoint360 imports the client");
ok(/advantageUdApi\.codes\(sel\.field_code_norm\)/.test(D), "and asks for the selected field's codes");
ok(/curSys !== "ADDVANTAGE" \|\| !isUdAttribute\(sel\.field_code_norm\)/.test(D),
   "but only for a UD field on AddVantage; everything else gets no round trip");
ok(/\["Code values", codes\.length > 0 &&/.test(D), "a Code values row renders when there are codes");
ok(/codedSummary\(codes\)/.test(D), "the description carries the summary line");
ok(!/import .*api\.js.*advantageUd/.test(D) && !fs.readFileSync(path.join(SRC, "api.js"), "utf8").includes("advantage-ud"),
   "api.js is untouched");
ok(typeof advantageUdApi.codes === "function" && typeof advantageUdApi.codedAttributes === "function", "the client exposes both calls");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nadvantage-ud assertions pass");
if (bad) process.exit(1);

// ---- the 360 ------------------------------------------------------------
import { renderToStaticMarkup } from "react-dom/server";
import { presenceReading, typeReading, parseDistribution, pct } from "../src/advantageUd.js";
import { UdOverview, udDetailRows, ClobExample } from "../src/AdvantageUd360.jsx";
import { tLight } from "../src/bbhTheme.js";

console.log("-- readings say what a number means");
ok(presenceReading({ record_presence_pct: 99.5 }) === "on every account", "99.5% is every account");
ok(presenceReading({ record_presence_pct: 70 }) === "on most accounts", "70% is most");
ok(presenceReading({ record_presence_pct: 0.4 }) === "rare", "0.4% is rare");
ok(presenceReading(null) === null && presenceReading({}) === null, "no figure, no reading");
ok(pct(99.23456) === "99.2%" && pct(null) === null, "pct rounds to one decimal");
const recl = typeReading({ value_class: "IDENTIFIER", dominant_type: "TIMESTAMP", type_reclassified: "Y", dominant_type_pct: 100 });
ok(/profiled as TIMESTAMP, read as IDENTIFIER/.test(recl), "a reclassified type says both", recl);
const lz = typeReading({ value_class: "IDENTIFIER_LEADING_ZERO", dominant_type: "IDENTIFIER_LEADING_ZERO", leading_zero_count: 15200 });
ok(/leading zeros, kept as text/.test(lz), "leading zeros are called out", lz);
const varr = typeReading({ value_class: "DATE", dominant_type: "DATE", dominant_type_pct: 97.2, type_variance_ind: "Y", variance_class: "DATE_FORMAT_OR_TEXT_VARIANCE" });
ok(/97\.2% of values/.test(varr) && /date format or text variance/.test(varr), "variance is read in words", varr);
ok(JSON.stringify(parseDistribution('{"TEXT": 20787, "CODE_DESCRIPTION": 2}')) === '[["TEXT",20787],["CODE_DESCRIPTION",2]]', "distribution parsed and sorted");
ok(parseDistribution("not json").length === 0, "bad json is an empty distribution");

console.log("-- the overview renders, and says not-loaded honestly");
const notLoaded = renderToStaticMarkup(<UdOverview t={tLight} ov={{ loaded: false }} shape={null} />);
ok(/not loaded yet/.test(notLoaded) && /advantage_ud_profile/.test(notLoaded), "an unloaded warehouse gets the instruction, not empty charts");
ok(renderToStaticMarkup(<UdOverview t={tLight} ov={null} />) === "", "no overview, nothing drawn");
const ov = { loaded: true, attributes: 284, run: { source_rows: 21672, parse_success_pct: 100, schema_variants: 12951 },
  by_structure: { SINGLE: 200, MULTIPART: 84 }, by_domain: { UNKNOWN: 250, HOUSEHOLD: 6 }, by_class: { TEXT: 200 },
  parents: [{ parent_attribute: "UD_23" }], families: [{ family_id: "f1", family_label: "household + billing instruction", variant_count: 40, record_count: 9000 }],
  family_count: 12, coded_attributes: 40, variance_attributes: 90, reclassified: 3, gold_candidates: 13, conflicts: { PARAMETERIZED_VALUE: 5 } };
const shape = { example: { UD_1: "2=CLIENT ACCOUNT", UD_23_1: "000000000  (leading zeros kept)" }, key_count_buckets: { "1-5": 5500, "6-20": 9000 } };
const html = renderToStaticMarkup(<UdOverview t={tLight} ov={ov} shape={shape} />);
ok(/21,672/.test(html) && /284/.test(html) && /12,951 exact key sets/.test(html), "tiles carry the run figures", html.slice(0, 200));
ok(/household \+ billing instruction/.test(html), "families are listed by label");
ok(/&quot;UD_23_1&quot;/.test(html) && /leading zeros kept/.test(html), "the CLOB example is drawn from shapes");
ok(/shapes, never values/.test(html), "and says so");
ok(/5 parameterized value/.test(html), "conflicts are summarised by class");

console.log("-- the detail rows");
ok(udDetailRows(tLight, null).length === 0 && udDetailRows(tLight, { loaded: false }).length === 0, "no registry, no rows: the pane is unchanged");
const a = { loaded: true, attribute: "UD_23_2", shape: "<text ≤32 chars>",
  registry: { attribute_name: "UD_23_2", key_structure: "MULTIPART", parent_attribute: "UD_23", sequence_number: 2,
    occurrence_count: 15200, record_presence_pct: 70.1, distinct_value_count: 3900, null_or_blank_count: 0,
    min_value_length: 3, max_value_length: 32, dominant_type: "TEXT", value_class: "TEXT", dominant_type_pct: 100,
    type_distribution: '{"TEXT": 15200}', domain: "HOUSEHOLD", silver_entity: "ACCOUNT_HOUSEHOLD", class_source: "RULE", gold_candidate: "N" },
  parent: { structure_role: "HOUSEHOLD", missing_sequences: "", line_names: "household_id, household_name" },
  siblings: [{ attribute_name: "UD_23_1", value_class: "IDENTIFIER_LEADING_ZERO", shape: "000000000  (leading zeros kept)", occurrence_count: 15200 },
             { attribute_name: "UD_23_2", value_class: "TEXT", shape: "<text ≤32 chars>", occurrence_count: 15200 }],
  conflicts: [] };
const rows = udDetailRows(tLight, a);
const labels = rows.map((r) => r[0]);
ok(labels.join("|") === "Key structure|Presence|Values|Type|Shape|Domain · Silver|Block lines", "rows in reading order", labels.join("|"));
const rh = renderToStaticMarkup(<div>{rows.map(([k, v]) => <div key={k}>{v}</div>)}</div>);
ok(/line <b>2<\/b> of block/.test(rh) && /household/.test(rh), "a line says which block it is in");
ok(/15,200/.test(rh) && /on most accounts/.test(rh), "presence in words");
ok(/hypothesis from the brief, not yet confirmed/.test(rh), "a RULE classification says it is a hypothesis");
ok(!/WHITMAN|[0-9]{10}/.test(rh), "no value and no 10-digit number anywhere in the rows");
const wide = udDetailRows(tLight, { ...a, registry: { ...a.registry, max_value_length: 40 } });
ok(/over the 32-char line/.test(renderToStaticMarkup(<div>{wide[2][1]}</div>)), "a value over 32 chars is flagged as not type-3 text");

console.log("-- the pane is wired for the 360");
ok(/import \{ UdOverview, udDetailRows \} from "\.\/AdvantageUd360\.jsx"/.test(D), "Datapoint360 imports the 360");
ok(/curSys === "ADDVANTAGE" && <UdOverview t=\{t\} ov=\{udOv\} shape=\{udShape\} \/>/.test(D), "the overview strip is AddVantage only");
ok(/advantageUdApi\.attribute\(sel\.field_code_norm\)/.test(D) && /\.\.\.udDetailRows\(t, udAttr\)/.test(D), "the detail rows are spliced for the selected key");
ok(/advantageUdApi\.overview\(\)/.test(D) && /advantageUdApi\.clobShape\(\)/.test(D), "overview and shape are fetched once per system");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nadvantage-ud 360 assertions pass");
if (bad) process.exit(1);
