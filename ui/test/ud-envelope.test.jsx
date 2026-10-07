// The UD envelope panel on the lineage screen.
//
// WHAT THIS LOCKS DOWN. The CLOB's proof used to print as three walls of
// JSON with client values in them. The panel must (1) parse what Oracle
// hands over, including the doubly-quoted form, (2) say per key whether
// the stages agree, so a reader sees variance without reading, (3) mask
// every value to its shape unless revealed, and (4) replace the raw
// block for this column only, leaving every other field's proof as it was.

import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import UdEnvelopePanel, { parseStage, parseProof, keyRows, groupRows, maskValue, isUdClob }
  from "../src/UdEnvelopePanel.jsx";
import { tLight } from "../src/bbhTheme.js";

let bad = 0;
const ok = (c, m, got) => { console.log(`${c ? "ok  " : "FAIL"} ${m}${c ? "" : `  -> ${String(got).slice(0, 240)}`}`); if (!c) bad++; };
function findSrc() {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    for (const rel of ["src", path.join("ui", "src")]) {
      const p = path.join(dir, rel);
      if (fs.existsSync(path.join(p, "LegacyLineage.jsx"))) return p;
    }
    dir = path.dirname(dir);
  }
  throw new Error("src not found");
}
const L = fs.readFileSync(path.join(findSrc(), "LegacyLineage.jsx"), "utf8");

console.log("-- parsing what Oracle hands over");
ok(parseStage('{"UD_1":"2=CLIENT ACCOUNT","ud_14":"TE=TAX EXEMPT"}').keys.UD_14 === "TE=TAX EXEMPT", "keys are upper-cased");
ok(parseStage('"{""UD_1"":""2=CLIENT ACCOUNT""}"').keys.UD_1 === "2=CLIENT ACCOUNT", "the doubly-quoted CSV form is unwrapped");
ok(parseStage("").error === "empty" && parseStage(null).error === "empty", "empty is empty, not an error");
ok(parseStage("[1,2]").error === "not an object" && parseStage("{oops").error === "invalid JSON", "non-objects and bad JSON are named");
ok(parseStage("∅").error === "invalid JSON", "the ∅ placeholder is not parsed as a payload");

console.log("-- verdicts per key");
const proof = [
  { stage: "STG1", field_value: '{"UD_1":"2=CLIENT ACCOUNT","UD_23_1":"000001234","UD_23_2":"PLACEHOLDER","UD_32_1":"LINE ONE","UD_613":"Y"}' },
  { stage: "STG2", field_value: '{"UD_1":"2=CLIENT ACCOUNT","UD_23_1":"000001234","UD_23_2":"PLACEHOLDER","UD_32_1":"LINE ONE ","UD_613":"Y","UD_80":"N"}' },
  { stage: "DWH", field_value: "∅" },
];
const parsed = parseProof(proof);
ok(parsed.order.join(",") === "STG1,STG2,DWH", "stages in pipeline order", parsed.order);
const rows = keyRows(parsed);
const by = Object.fromEntries(rows.map((r) => [r.key, r]));
ok(rows.map((r) => r.key).join(",") === "UD_1,UD_23_1,UD_23_2,UD_32_1,UD_80,UD_613", "keys in numeric order, lines after their parent", rows.map((r) => r.key).join(","));
ok(by.UD_1.verdict === "same", "equal in every parsed stage is same");
ok(by.UD_32_1.verdict === "same", "trailing whitespace does not make a difference");
ok(by.UD_80.verdict === "missing" && by.UD_80.present.join() === "STG2", "a key in one stage but not another is missing");
ok(by.UD_23_1.parent === "UD_23" && by.UD_23_1.seq === 1 && by.UD_1.parent === null, "parent and sequence from the key");
const diff = keyRows(parseProof([{ stage: "STG1", field_value: '{"UD_1":"A"}' }, { stage: "STG2", field_value: '{"UD_1":"B"}' }]));
ok(diff[0].verdict === "differs", "a changed value differs");
ok(!("DWH" in by.UD_1.values), "an unparsed stage contributes no value and no verdict");

console.log("-- blocks");
const groups = groupRows(rows);
ok(groups.map((g) => `${g.id}:${g.block ? g.rows.length : "s"}`).join(",") === "UD_1:s,UD_23:2,UD_32:1,UD_80:s,UD_613:s", "lines fold under their block", groups.map((g) => g.id).join(","));

console.log("-- masking");
ok(maskValue("2=CLIENT ACCOUNT") === "2=<14 chars>", "a code keeps its code, loses its text", maskValue("2=CLIENT ACCOUNT"));
ok(maskValue("000001234") === "000000000 (leading zeros)", "a leading-zero id keeps its zeros only", maskValue("000001234"));
ok(maskValue("5091002413") === "##########", "a plain number becomes hashes");
ok(maskValue("Y") === "Y" && maskValue("") === "blank" && maskValue(null) === "∅", "flags, blanks and nulls stay readable");
ok(maskValue("JOHN SMITH TRUSTEE", { value_class: "TEXT" }) === "<text · 18 chars>", "text becomes its class and length", maskValue("JOHN SMITH TRUSTEE", { value_class: "TEXT" }));
ok(!/ANNUAL MIN = 87500/.test(maskValue("ANNUAL MIN = 87500")), "prose with = is not treated as a code", maskValue("ANNUAL MIN = 87500"));

console.log("-- the panel renders masked");
const html = renderToStaticMarkup(<UdEnvelopePanel t={tLight} field={{ dwh_target_column: "USER_DEFINED_ATTRIBUTE_CLOB", stg2_source_table: "STG2_ACCOUNT_UD_INTRADAY", stg2_source_column: "UD_FLD_NUMBER" }} proof={proof} table="DIM_ACCOUNT_UD" />);
ok(/6<\/b> keys in this sample/.test(html) && /2<\/b> multiline blocks/.test(html), "the header counts keys and blocks", html.slice(0, 300));
ok(/registry not loaded/.test(html), "without the registry it says so");
ok(!/CLIENT ACCOUNT|PLACEHOLDER|LINE ONE|000001234/.test(html), "no value appears unrevealed");
ok(/2=&lt;14 chars&gt;/.test(html) && /000000000 \(leading zeros\)/.test(html), "shapes appear instead");
ok(/1 missing/.test(html) && /missing in a stage/.test(html), "the missing key is counted and flagged");
ok(/STG2_ACCOUNT_UD_INTRADAY\.UD_FLD_NUMBER/.test(html) && /pivoted into the JSON/.test(html), "the envelope's real lineage is stated");
ok(!/Stage-by-stage proof/.test(html) && !/UD_1":"2=/.test(html), "the raw JSON is not printed by default");
const empty = renderToStaticMarkup(<UdEnvelopePanel t={tLight} field={{}} proof={[{ stage: "DWH", field_value: "∅" }]} />);
ok(/No stage of the proof parses/.test(empty) && /DWH: invalid JSON/.test(empty), "an unparseable proof says which stage failed");

console.log("-- wired into the lineage screen, for this column only");
ok(isUdClob({ dwh_target_column: "user_defined_attribute_clob" }) && !isUdClob({ dwh_target_column: "ACCOUNT_NUMBER" }), "the column test is exact");
ok(/import UdEnvelopePanel, \{ isUdClob \} from "\.\/UdEnvelopePanel\.jsx"/.test(L), "LegacyLineage imports the panel");
ok((L.match(/<UdEnvelopePanel /g) || []).length === 2, "both proof blocks (field row and drill-in) use it", (L.match(/<UdEnvelopePanel /g) || []).length);
ok(/\(f\.proof \|\| \[\]\)\.length > 0 && !isUdClob\(f\) &&/.test(L) && /proof\.length > 0 && !isUdClob\(row\) &&/.test(L), "the raw block is kept for every other field");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nud-envelope assertions pass");
if (bad) process.exit(1);
