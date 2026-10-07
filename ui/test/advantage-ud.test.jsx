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
