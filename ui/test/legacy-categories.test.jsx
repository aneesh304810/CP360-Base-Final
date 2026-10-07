// Browse by category on the Non-SEI dictionary.
//
// WHAT THIS LOCKS DOWN. The rail is built from the dictionary's own group,
// with one exception that is the point of the feature: every UD code is
// one category whatever group the workbook filed it under, and inside it
// the order is numeric (UD/2 before UD/10), not the string order a
// database gives. A field with no group falls back to its master, never
// to a guess. And the pane must filter the list it already has rather
// than refetch, so the search box and the category compose.

import React from "react";
import fs from "node:fs";
import path from "node:path";
import { categoryOf, categorize, inCategory, udOrder, UD_CATEGORY } from "../src/legacyCategories.js";

let bad = 0;
const ok = (c, m, got) => { console.log(`${c ? "ok  " : "FAIL"} ${m}${c ? "" : `  -> ${String(got).slice(0, 240)}`}`); if (!c) bad++; };
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
const D = fs.readFileSync(path.join(findSrc(), "Datapoint360.jsx"), "utf8");

const defs = [
  { field_code_norm: "BI_1", business_function: "Basic Information (BI)", master_name: "Account Master", is_pii: "N", lineage_count: 3 },
  { field_code_norm: "BI_2_1", business_function: "Basic Information (BI)", master_name: "Account Master", is_pii: "Y", lineage_count: 0 },
  { field_code_norm: "TX_4", business_function: "Tax (TX)", master_name: "Account Master", lineage_count: 1 },
  { field_code_norm: "UD_10", business_function: "User-Defined Group", master_name: "Account Master" },
  { field_code_norm: "UD_2", business_function: "Some Other Group", master_name: "Account Master" },
  { field_code_norm: "UD_23_2", business_function: "User-Defined Group", master_name: "Account Master" },
  { field_code_norm: "UD_23_1", business_function: "", master_name: "Account Master" },
  { field_code_norm: "ZZ_9", business_function: "", master_name: "Security Issue Master · Account Master" },
  { field_code_norm: "ZZ_10", business_function: null, master_name: null },
];

console.log("-- one category for every UD code");
ok(categoryOf(defs[3]) === UD_CATEGORY && categoryOf(defs[4]) === UD_CATEGORY, "a UD code is User-Defined whatever its workbook group");
ok(categoryOf(defs[0]) === "Basic Information (BI)", "other codes keep the dictionary's group");
ok(categoryOf(defs[7]) === "Security Issue Master", "no group falls back to the first master");
ok(categoryOf(defs[8]) === "Uncategorised", "no group and no master is Uncategorised, not a guess");

console.log("-- the rail");
const cats = categorize(defs);
ok(cats[0].category === UD_CATEGORY && cats[0].count === 4 && cats[0].ud === true, "the UD set comes first with its count", cats[0]);
ok(cats.map((c) => c.category).join("|") === `${UD_CATEGORY}|Basic Information (BI)|Security Issue Master|Tax (TX)|Uncategorised`,
   "then largest first, ties alphabetical, Uncategorised last", cats.map((c) => c.category).join("|"));
const bi = cats.find((c) => c.category === "Basic Information (BI)");
ok(bi.pii === 1 && bi.mapped === 1, "PII and in-lineage counts per category", bi);

console.log("-- inside the UD category, numeric order");
ok(udOrder("UD_2")[0] === 2 && udOrder("UD_23_1")[1] === 1 && udOrder("BI_1") === null, "udOrder parses number and sequence");
ok(inCategory(defs, UD_CATEGORY).map((d) => d.field_code_norm).join(",") === "UD_2,UD_10,UD_23_1,UD_23_2",
   "UD_2 before UD_10, lines in sequence", inCategory(defs, UD_CATEGORY).map((d) => d.field_code_norm).join(","));
ok(inCategory(defs, null).length === defs.length, "no category is everything");
ok(inCategory(defs, "Tax (TX)").length === 1, "a group filters to its fields");

console.log("-- the pane composes category with the loaded list");
ok(/import \{ categorize, inCategory, UD_CATEGORY \} from "\.\/legacyCategories\.js"/.test(D), "Datapoint360 imports the helper");
ok(/\(!cat \|\| cat === UD_CATEGORY\) &&\s*<UdStrip/.test(D), "the UD 360 strip hides while another category is open");
ok(/const shown = inCategory\(defs, cat\);/.test(D) && /\{shown\.map\(\(d\) => \(/.test(D), "the list renders the filtered set, not the full one");
ok(/Browse by category \(\{cats\.length\}\)/.test(D), "the rail is labelled with its count");
ok(/const \[view, setView\] = useState\("all"\);/.test(D), "the default view is All, the plain list");
ok(/\[\["all", "All Data Points"\], \["category", "Browse by Category"\]\]/.test(D), "two tabs, the same control as the SEI side");
ok(/\{view === "category" && <div style=\{\{ maxHeight: 520/.test(D), "the rail exists only on the category tab");
ok(/gridTemplateColumns: view === "category" \? "230px 320px 1fr" : "320px 1fr"/.test(D), "the list keeps its full width on All");
ok(/const pickView = \(v\) => \{ setView\(v\); if \(v === "all"\) pickCat\(null\); \};/.test(D), "going back to All clears the category");
ok(/useEffect\(\(\) => \{ setCat\(null\); \}, \[curSys\]\);/.test(D), "switching legacy system clears the category");
ok(/Nothing in this category\./.test(D), "an empty category says so rather than 'No definitions'");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nlegacy-categories assertions pass");
if (bad) process.exit(1);
