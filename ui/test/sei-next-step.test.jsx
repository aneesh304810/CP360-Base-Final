// The step after STAR -> IMDS on the source view: for one STAR feed, the
// SEI feed files that replace its fields after cutover. Drawn under the
// file's picture, only for STAR, only when a mapping document covers it.
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { tLight } from "../src/bbhTheme.js";
import SeiNextStep from "../src/SeiNextStep.jsx";
import { mappingDocs } from "../src/seiCrosswalkApi.js";

let bad = 0;
const ok = (c, m, got) => { console.log(`${c ? "ok  " : "FAIL"} ${m}${c ? "" : `  -> ${String(got).slice(0, 240)}`}`); if (!c) bad++; };
function findSrc() {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    for (const rel of ["src", path.join("ui", "src")]) {
      const p = path.join(dir, rel);
      if (fs.existsSync(path.join(p, "SourceLineage.jsx"))) return p;
    }
    dir = path.dirname(dir);
  }
  throw new Error("src not found");
}
const SRC = findSrc();

const data = {
  feed: "PEDDIFI1",
  headline: "2 of 4 fields of PEDDIFI1 have a SEI source, in 2 SEI feed files; 2 have none yet",
  totals: { star_fields: 4, with_sei: 2, without: 2, files: 2, verified: 1, from_layout: 1, open_dependencies: 1 },
  by_file_status: [{ key: "VERIFIED_IN_FEED_SPEC", n: 1 }, { key: "SYSTEM_OR_CONSTANT", n: 1 }, { key: "NO_SEI_SOURCE", n: 2 }],
  files: [
    { file: "Taxlot", fields: 1, verified: 1, star_fields: ["Lot Quantity"], imds_tables: ["HOLDINGDBO.LOT_LEVEL_POSITION", "HOLDINGDBO.POSITION"], domain: "taxlots", frequency: "EOD", grain: "One Taxlot record", in_register: true },
    { file: "SYSTEM (job run)", fields: 1, verified: 0, star_fields: ["Accounting Date"], imds_tables: ["HOLDINGDBO.POSITION"], domain: null, frequency: null, in_register: false },
  ],
  fields: [
    { star_field: "Accounting Date", norm: "ACCOUNTING_DATE", in_layout: "Y", usage: "Used", is_used: null, from_layout: false, sei_files: ["SYSTEM (job run)"], sei_source: "SYSTEM (job run).PROCESSING_DATE", map_kind: "SYSTEM_DATE", mapping_status: "CANDIDATE", open_dependency: "N", file_status: "SYSTEM_OR_CONSTANT", join_logic: null, has_sei: true, imds_columns: [] },
    { star_field: "Lot Quantity", norm: "LOT_QUANTITY", in_layout: "Y", usage: "Used", is_used: "Y", from_layout: false, sei_files: ["Taxlot"], sei_source: "Taxlot.QUANTITY_HELD", map_kind: "DERIVED", mapping_status: "CANDIDATE", open_dependency: "N", file_status: "VERIFIED_IN_FEED_SPEC", join_logic: "TAXLOT_TYPE_CODE = 2", has_sei: true, imds_columns: ["HOLDINGDBO.LOT_LEVEL_POSITION.QUANTITY", "HOLDINGDBO.POSITION.QUANTITY"] },
    { star_field: "Entity Number", norm: "ENTITY_NUMBER", in_layout: "Y", usage: "Used", is_used: null, from_layout: false, sei_files: [], sei_source: null, map_kind: "NO_MAPPING", mapping_status: "NO_SEI_SOURCE", open_dependency: "Y", file_status: "NO_SEI_SOURCE", join_logic: null, has_sei: false, imds_columns: ["HOLDINGDBO.POSITION.ENTITY_ID"] },
    { star_field: "Entity Name", norm: "ENTITY_NAME", in_layout: "N", usage: "Unused", is_used: "N", from_layout: true, sei_files: [], sei_source: null, map_kind: "NO_MAPPING", mapping_status: "NO_SEI_SOURCE", open_dependency: "N", file_status: "NO_SEI_SOURCE", join_logic: null, has_sei: false, imds_columns: [] },
  ],
};

console.log("-- the step");
const html = renderToStaticMarkup(<SeiNextStep t={tLight} feed="PEDDIFI1" ds="IMDS" initial={{ ...data, open: true }} onOpenColumn={() => {}} />);
ok(/SEI feed files/.test(html) && /after cutover · replaces PEDDIFI1/.test(html), "the next node on the spine, named for the feed it replaces");
ok(/2 of 4 fields of PEDDIFI1 have a SEI source/.test(html) && /50% of fields have a SEI source/.test(html) && /verified in the feed spec · 1/.test(html),
   "the sentence, the share, the resolution pills");
ok(/1 of the fields are in the published layout but no mapping document mentions them/.test(html) && /1 carry an open dependency/.test(html) && /draft until an approved crosswalk/.test(html),
   "layout-added fields and open dependencies named; every mapping a draft");
ok(/>Taxlot</.test(html) && /taxlots · EOD/.test(html) && /1 verified in the feed spec/.test(html) && /HOLDINGDBO\.LOT_LEVEL_POSITION · HOLDINGDBO\.POSITION/.test(html)
   && /not in the SEI feed register/.test(html), "one card per SEI feed file: what the register says it is, how many fields, where they reach");
ok(/PEDDIFI1 field today/.test(html) && /SEI feed file · field after cutover/.test(html) && /Taxlot\.QUANTITY_HELD/.test(html) && /TAXLOT_TYPE_CODE = 2/.test(html),
   "the field table reads STAR field -> SEI file.field, with the join logic");
ok(/no SEI source yet/.test(html) && /open dependency/.test(html) && /read by nothing/.test(html) && /unmentioned by any document/.test(html) && /⚠/.test(html),
   "a field without a SEI source says so; usage, layout and dependency marks");
ok(/HOLDINGDBO\.POSITION\.ENTITY_ID/.test(html) && /verdict ▸/.test(html) && /no IMDS column/.test(html), "where each field lands, with a way to the verdict");
const closed = renderToStaticMarkup(<SeiNextStep t={tLight} feed="PEDDIFI1" ds="IMDS" initial={data} />);
ok(/See which SEI field replaces each of the 4 fields/.test(closed) && !/PEDDIFI1 field today/.test(closed), "the field table opens on demand");
const none = renderToStaticMarkup(<SeiNextStep t={tLight} feed="UAF Account Detail" ds="IMDS" initial={{ fields: [], files: [], totals: {} }} />);
ok(none === "", "a feed no mapping document covers draws nothing");
ok(typeof mappingDocs.feedSeiFiles === "function", "the client call");

console.log("-- wired in");
const src = fs.readFileSync(path.join(SRC, "SourceLineage.jsx"), "utf8");
ok(/import SeiNextStep from "\.\/SeiNextStep\.jsx"/.test(src) && /\(system \|\| ""\)\.toUpperCase\(\) === "STAR" && \(/.test(src) && /<SeiNextStep t=\{t\} feed=\{file\} ds=\{ds\}/.test(src),
   "the source view draws the step under a STAR file's picture, and only for STAR");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nsei-next-step assertions pass");
if (bad) process.exit(1);
