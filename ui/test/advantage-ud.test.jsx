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
ok(/import \{ UdStrip, udDetailRows \} from "\.\/AdvantageUd360\.jsx"/.test(D), "Datapoint360 imports the 360");
ok(/curSys === "ADDVANTAGE" && \(cat === UD_CATEGORY \|\| isUdAttribute\(sel\?\.field_code_norm\)\) &&\s*<UdStrip t=\{t\} ov=\{udOv\}/.test(D), "the strip shows only while the UD category is browsed or a UD field is selected");
ok(/advantageUdApi\.attribute\(sel\.field_code_norm\)/.test(D) && /\.\.\.udDetailRows\(t, udAttr\)/.test(D), "the detail rows are spliced for the selected key");
ok(/advantageUdApi\.overview\(\)/.test(D) && /advantageUdApi\.clobShape\(\)/.test(D), "overview and shape are fetched once per system");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nadvantage-ud 360 assertions pass");
if (bad) process.exit(1);

// ---- type variance and schema variants, each its own reading --------------
import { TypeVarianceView, SchemaVarianceView, UdStrip } from "../src/AdvantageUd360.jsx";
import { schemaReading, sourcesLine } from "../src/advantageUd.js";

console.log("-- the schema reading in words");
ok(schemaReading(null) === null && schemaReading({ loaded: false }) === null, "no reading until loaded");
const svx = { loaded: true, key_sets: 12951, rows: 21672, optional_count: 38, families: 24, typed_drift_sets: 410 };
const sr = schemaReading(svx);
ok(/12,951 exact key sets for 21,672 rows, so 60% of rows have a key set of their own/.test(sr), "the ratio is said as a share of rows", sr);
ok(/38 keys are optional/.test(sr) && /each can double/.test(sr) && /fold into 24 families/.test(sr) && /410 sets keep the same keys/.test(sr), "optional keys, families and typed drift are all said");

console.log("-- the views render and say not-loaded");
ok(/not loaded yet/.test(renderToStaticMarkup(<TypeVarianceView t={tLight} tv={{ loaded: false }} />)), "type variance says not loaded");
ok(/not loaded yet/.test(renderToStaticMarkup(<SchemaVarianceView t={tLight} sv={{ loaded: false }} />)), "schema variants says not loaded");
const tv = { loaded: true, attributes: 2, high: 1, reclassified: 1, free_text: 0,
  classes: [{ variance_class: "FLAG_REPRESENTATION_VARIANCE", attributes: 1, what: "a flag written Y/N and also as something else", do: "map the other spellings to Y/N; anything unmapped is a finding" }],
  rows: [{ attribute_name: "UD_80", term: "RULE 11A", variance_class: "FLAG_REPRESENTATION_VARIANCE", dominant_type: "BOOLEAN_FLAG", dominant_type_pct: 94, minority: [["TEXT", 264]], minority_pct: 6, severity: "medium", do: "map the other spellings to Y/N" },
         { attribute_name: "UD_527_1", variance_class: "IDENTIFIER_NUMERIC_COLLISION", dominant_type: "TIMESTAMP", dominant_type_pct: 100, value_class: "IDENTIFIER", type_reclassified: "Y", minority: [], minority_pct: 0.8, severity: "low", do: "IDENTIFIER, VARCHAR" }] };
const th = renderToStaticMarkup(<TypeVarianceView t={tLight} tv={tv} />);
ok(/flag representation variance/.test(th) && /map the other spellings/.test(th), "classes are read in words with the rule");
ok(/RULE 11A/.test(th) && /TEXT 264/.test(th) && /6%/.test(th), "a key shows its name, minority types and share");
ok(/<th[^>]*>Key<\/th><th[^>]*>UD name<\/th><th[^>]*>Dominant<\/th>/.test(th), "the UD name is its own column, after the key");
ok(/no dictionary entry/.test(th), "a key without a dictionary entry says so in that column");
ok(/read as IDENTIFIER/.test(th), "a reclassified key says what it is read as");
ok(th.indexOf("UD_80") < th.indexOf("UD_527_1"), "worst first: the larger minority share is listed before the smaller");
const sh = renderToStaticMarkup(<SchemaVarianceView t={tLight} sv={{ ...svx, singletons: 7000, typed_drift_rows: 900,
  sizes: [{ bucket: "1-5", key_sets: 2, rows: 5500 }], tiers: { core: 2, common: 4, occasional: 8, rare: 2 }, core_keys: ["UD_613", "UD_1"],
  optional_keys: [{ attribute_name: "UD_51", record_presence_pct: 14.3 }],
  top: [{ schema_signature: "x", attribute_count: 8, record_count: 6000, record_pct: 27.7, typed_variant_count: 3, blocks: ["UD_23"], singles: 5, family_label: "household" }] }} />);
ok(/12,951/.test(sh) && /7,000/.test(sh) && /core: UD_613, UD_1/.test(sh), "tiles, long tail and core keys");
ok(/UD_51/.test(sh) && /14\.3%/.test(sh), "optional keys with their presence");
ok(/3 typed/.test(sh) && /household/.test(sh) && !/[0-9]{10}/.test(sh.replace(/style="[^"]*"/g, "")), "typed drift is flagged per set and no value appears in the text");
ok(/By blocks present they fold/.test(schemaReading(svx)), "each clause of the reading starts with a capital");

console.log("-- the strip tabs");
const strip = renderToStaticMarkup(<UdStrip t={tLight} ov={ov} shape={shape} tv={tv} sv={svx} />);
ok(/Type variance · 2/.test(strip) && /Schema variants · 12,951/.test(strip), "tabs carry their counts");
ok(/shapes, never values/.test(strip), "the overview is the default tab");
ok(/not loaded yet/.test(renderToStaticMarkup(<UdStrip t={tLight} ov={{ loaded: false }} />)) , "an unloaded warehouse gets the instruction without tabs");
const D2 = fs.readFileSync(path.join(SRC, "Datapoint360.jsx"), "utf8");
ok(/<UdStrip t=\{t\} ov=\{udOv\} shape=\{udShape\} tv=\{udTv\} sv=\{udSv\} st=\{udSt\} \/>/.test(D2), "Datapoint360 mounts the strip with both analyses and the sources line");
{
  ok(sourcesLine(null) === null, "no status, no line");
  const line = sourcesLine({ profile: { loaded: true, attributes: 284 }, extract: { loaded: true, rows: 21672, quarantined: 2, batch_id: "20261007032517992253" },
    workbook: { loaded: true, tables: 41, links: { STRONGLY_INFERRED: 12, WEAK: 3 } }, trp: { loaded: false } });
  ok(/profile 284 keys · extract 21,672 rows, 2 quarantined · batch 20261007032517992253 · workbook 41 tables · links 12 strongly inferred, 3 weak · TRP not loaded/.test(line), "the sources line names every source and its state", line);
  const html = renderToStaticMarkup(<UdOverview t={tLight} ov={ov} shape={shape} st={{ profile: { loaded: true, attributes: 284 }, extract: { loaded: false }, workbook: { loaded: false }, trp: { loaded: false } }} />);
  ok(/Sources/.test(html) && /extract not loaded/.test(html), "the overview prints the line");
}
ok(/advantageUdApi\.typeVariance\(\)/.test(D2) && /advantageUdApi\.schemaVariance\(\)/.test(D2), "and fetches both once per system");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nadvantage-ud variance assertions pass");
if (bad) process.exit(1);
