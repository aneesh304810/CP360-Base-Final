// The Source view's reading view, actually rendered.
//
// WHY THIS FILE EXISTS. The reading view makes two claims the picture
// beside it does not, and both are arithmetic:
//
//   "this feed carries N pieces of information"  — distinct SOURCE fields
//   "they fill M warehouse fields"               — column LINKS
//
// The first draft used one number for both, which overstates the feed by
// however many tables it lands in: one field landing in three tables is
// three links and one piece of information. A screen that tells a
// business reader a 10-field extract carries 12 things is worse than no
// screen, because it is quotable.
//
// It also folds repeated families — ACCOUNT_LONG_NAME_1..5 is one thing
// five times — but ONLY when the members agree about what happens to
// them. A family where one member is computed and the rest are carried
// across is not the same thing five times, and folding it would hide the
// single row that will not reconcile. Both halves are asserted here.
//
// Rendering is the test, for the reason event360-render.test.jsx spells
// out: esbuild resolves imports, not identifiers. Note that useEffect
// does not run under renderToStaticMarkup, so this exercises the
// degraded path on purpose — no dictionary, no usage matrix — which is
// exactly what a warehouse without those tables loaded shows.

import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import SourceReading from "../src/SourceReading.jsx";
import { tLight } from "../src/bbhTheme.js";

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${msg}${cond ? "" : `  -> ${String(got).slice(0, 300)}`}`);
  if (!cond) bad++;
};

const col = (o) => ({ col: o.col, src: o.src ?? null, type: "VARCHAR2",
  length: 60, src_type: "CHAR", src_length: 60, stg1: o.stg1 ?? null,
  stg2: o.stg2 ?? null, t1: null, t2: null, t3: null, logic: o.logic ?? null,
  status: o.status ?? "MAPPED", pk: o.pk ?? "N", unit: o.unit ?? null,
  currency: o.currency ?? null, sign: null, code_set: null,
  equivalence: null });

const DATA = {
  src_table: "AV_ACCOUNT_EXTRACT",
  feed: { business_name: "Account master" },
  source_system: "ADDVANTAGE",
  targets: [
    { table: "DIM_ACCOUNT", functional_group: "Accounts", cols: [
      col({ col: "ACCOUNT_ID", src: "Account_Id", pk: "Y" }),
      ...[1, 2, 3, 4, 5].map((i) =>
        col({ col: `ACCOUNT_LONG_NAME_${i}`, src: `Account_Long_Name_${i}` })),
      col({ col: "MARKET_VALUE", src: "Base_Market_Value",
            logic: "ROUND(Base_Market_Value, 2)", unit: "units",
            stg1: "STG_ACCOUNT" }),
      col({ col: "LOAD_TS", src: null, status: "UNMAPPED" }),
      // the family that DISAGREES — one member is computed
      col({ col: "NAME_A_1", src: "Name_A_1" }),
      col({ col: "NAME_A_2", src: "Name_A_2", logic: "UPPER(Name_A_2)" }),
      col({ col: "NAME_A_3", src: "Name_A_3" }),
    ] },
    // the SAME source field landing a second time
    { table: "DIM_POSITION", functional_group: "Positions", cols: [
      col({ col: "ACCOUNT_ID", src: "Account_Id" }),
    ] },
  ],
  column_count: 12,
  diagnostics: { ok: true, missing: [], near_names: [] },
};

let html = "";
try {
  html = renderToStaticMarkup(
    <SourceReading t={tLight} data={DATA} feedName="Account master"
      dataSource="PBDW" onOpenTarget={() => {}} />);
  ok(html.length > 500, "it renders", html.length);
} catch (e) {
  ok(false, "it renders", e && e.stack);
}
const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

// ---- the two numbers are different numbers ---------------------------
// 10 distinct sources (Account_Id once, five long-name variants,
// Base_Market_Value, three Name_A) feeding 12 column links.
ok(/10 pieces of information/.test(text),
   "the lead counts DISTINCT source fields — Account_Id lands twice and counts once",
   text.slice(0, 260));
ok(/12 warehouse fields/.test(text),
   "and counts every place they land separately", text.slice(0, 260));
ok(!/12 pieces of information/.test(text),
   "the two are never the same number", text.slice(0, 260));

// ---- what changes on the way -----------------------------------------
// ROUND() and UPPER(); nothing else.
ok(/\b2 of those are changed on the way/.test(text),
   "the transformed count is the classifier's, not a second opinion",
   text.slice(0, 300));
ok(/changed/.test(html), "and the row carries the chip", "");

// ---- repeats fold, but only when they agree --------------------------
ok(/5 times, one per variant/.test(text),
   "five identical long-name variants fold into one row", text);
ok(/ACCOUNT_LONG_NAME_1 … ACCOUNT_LONG_NAME_5/.test(text),
   "and the folded row names the real first and last columns, not a synthesised stem",
   text);
for (const c of ["NAME_A_1", "NAME_A_2", "NAME_A_3"]) {
  ok(text.includes(c),
     `${c} keeps its own row — one member of that family is computed, so it is not one thing three times`,
     text);
}
ok(!/3 times, one per variant/.test(text),
   "a disagreeing family is never folded", text);

// ---- the sentences ----------------------------------------------------
ok(/arrives, and lands unchanged/.test(text),
   "a carried-across column says so in words", text);
ok(/produced by the warehouse/.test(text),
   "and a column nothing supplies says that instead of showing a blank source",
   text);

// ---- no dictionary loaded: the physical name stands -------------------
ok(text.includes("ACCOUNT_ID"),
   "with no business term the column name is shown rather than a prettified guess",
   text);

// ---- usage is absent, and that is not an error ------------------------
ok(!/nothing reads/.test(text),
   "the unread panel is hidden when the usage matrix has not answered — "
   + "an absent STAR_FIELD_USAGE is a normal state, not a zero",
   text);

// ---- the lookup that cannot be termName -------------------------------
// termName falls back to the column name and so is NEVER falsy, which
// makes `termName(a) || termName(b)` a lookup that silently never reaches
// b. useFieldTerms is also one table, and a feed lands in several.
// The harness bundles to CJS, where import.meta.url is undefined, so the
// source directory is walked up to from the runner's cwd — the same way
// imports.test.jsx finds it.
function findSrc() {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    for (const rel of ["src", path.join("ui", "src")]) {
      const c = path.join(dir, rel);
      if (fs.existsSync(path.join(c, "SourceReading.jsx"))) return c;
    }
    dir = path.dirname(dir);
  }
  throw new Error("could not locate ui/src from " + process.cwd());
}
const SRC = fs.readFileSync(path.join(findSrc(), "SourceReading.jsx"), "utf8");
const code = SRC.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
ok(!/\btermName\s*\(/.test(code),
   "it does not use termName — that helper never returns falsy, so a chain of "
   + "fallbacks through it always stops at the first", code.match(/.*termName.*/g));
ok(!/\buseFieldTerms\s*\(/.test(code),
   "nor useFieldTerms, which answers for one table while a feed lands in several",
   code.match(/.*useFieldTerms.*/g));

// ---- it is actually reachable ----------------------------------------
// This view spent an afternoon written, bundled and mounted nowhere, which
// no render test can see: a component with no caller renders perfectly in
// isolation forever. Under SSR the canvas shows its loading line (the fetch
// has not resolved), so the toggle cannot be rendered here — the wiring is
// asserted against the source instead.
// Comment lines stripped first: a commented-out import still matches a
// regex looking for one, and that is precisely the break this guards.
const CANVAS = fs.readFileSync(path.join(findSrc(), "SourceCanvas.jsx"), "utf8")
  .split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
ok(/import\s+SourceReading\s+from\s+"\.\/SourceReading\.jsx"/.test(CANVAS),
   "SourceCanvas imports the reading view", "");
ok(/mode\s*===\s*"reading"/.test(CANVAS),
   "and has a branch that renders it", "");
ok(/<SourceReading[\s\S]{0,240}data=\{data\}/.test(CANVAS),
   "handed the payload the canvas already fetched — a second fetch is a "
   + "second chance to disagree with the drawing", "");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nsource-reading assertions pass");
if (bad) process.exit(1);
