// Every component a file renders must be imported or defined in it.
//
// WHY THIS EXISTS. A mount was added to CrosswalkDashboard and its import
// was not: the edit that should have added the import line searched for
// text that did not match and silently did nothing. `npm test` passed and
// so did an esbuild bundle, because esbuild is a bundler, not a checker —
// an unresolved *import* is an error, but an undefined *identifier* is
// left alone, since at build time it might be a global. The screen threw
// "SeiBusinessSummary is not defined" on mount, in the browser, for the
// user.
//
// So this walks the source and checks the one thing that class of bug
// turns on: a capitalised tag in JSX resolves to something the file can
// actually see.

import fs from "node:fs";
import path from "node:path";

// The harness bundles these to CJS, where import.meta.url is undefined, so
// the source directory is found by walking up from wherever the runner
// happens to start rather than from this file's own URL.
function findSrc() {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    for (const rel of ["src", path.join("ui", "src")]) {
      const c = path.join(dir, rel);
      if (fs.existsSync(path.join(c, "CrosswalkDashboard.jsx"))) return c;
    }
    dir = path.dirname(dir);
  }
  throw new Error("could not locate ui/src from " + process.cwd());
}
const SRC = findSrc();
let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${msg}${cond ? "" : `  -> ${String(got)}`}`);
  if (!cond) bad++;
};

// Tags React itself provides, or that are lower-case host elements.
const BUILTIN = new Set(["React", "Fragment"]);

const files = fs.readdirSync(SRC).filter((f) => /\.jsx$/.test(f)).sort();
ok(files.length > 0, "found components to check", files.length);

files.forEach((f) => {
  const src = fs.readFileSync(path.join(SRC, f), "utf8");

  // NO STRIPPING. The first version removed comments and strings first, and
  // an apostrophe in ordinary prose ("does not" written with one) paired
  // with the next apostrophe hundreds of lines away and swallowed real
  // declarations between them -- so the checker reported components that
  // were defined a few lines below as missing. Both sides are read from the
  // raw source instead, and the only concession to comments is skipping
  // lines that are plainly one.
  const lines = src.split("\n");
  const codeLines = lines.filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l));
  const code = codeLines.join("\n");

  const seen = new Set(BUILTIN);
  for (const m of src.matchAll(/import\s+([\s\S]*?)\s+from\s+/g))
    for (const n of m[1].matchAll(/[A-Z][A-Za-z0-9_]*/g)) seen.add(n[0]);
  for (const m of src.matchAll(/(?:function|class)\s+([A-Z][A-Za-z0-9_]*)/g))
    seen.add(m[1]);
  for (const m of src.matchAll(/(?:const|let|var)\s+([A-Z][A-Za-z0-9_]*)/g))
    seen.add(m[1]);
  for (const m of src.matchAll(/[{,]\s*([A-Z][A-Za-z0-9_]*)\s*[,}=:]/g))
    seen.add(m[1]);

  const used = new Set();
  for (const m of code.matchAll(/<([A-Z][A-Za-z0-9_.]*)[\s/>]/g)) used.add(m[1]);

  const missing = [...used].filter((n) => !seen.has(n) && !seen.has(n.split(".")[0]));
  ok(missing.length === 0,
     `${f}: every component it renders is imported or defined`, missing.join(", "));
});

// ---- import cycles ----------------------------------------------------
// The second runtime-only failure a clean build missed. Event360 imported
// the Commit boundary tab; the tab imported the palette back from
// Event360 and read it at module top level. Whichever module the bundler
// evaluates first, the other's constants are still in the temporal dead
// zone -- "Cannot access 'P' before initialization", in the browser, on
// mount. esbuild resolves the cycle happily and says nothing.
//
// Not every cycle breaks: it only bites when the importing module reads
// the value while the other is still evaluating. But a cycle between two
// UI modules is never load-bearing here, and forbidding them outright is
// cheaper than reasoning about evaluation order every time.
const localImports = (file) => {
  // Comment lines are skipped: several modules document their own usage
  // with a sample `import ... from "./ThisFile"`, and counting that as an
  // edge reported two files as importing themselves.
  const src = fs.readFileSync(path.join(SRC, file), "utf8")
    .split("\n").filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join("\n");
  const out = [];
  for (const m of src.matchAll(/^\s*(?:import|export)[^\n]*?from\s+["'](\.\/[^"']+)["']/gm)) {
    let target = m[1].replace(/^\.\//, "");
    if (!/\.(jsx?|mjs)$/.test(target)) {
      for (const ext of [".js", ".jsx"]) {
        if (fs.existsSync(path.join(SRC, target + ext))) { target += ext; break; }
      }
    }
    if (fs.existsSync(path.join(SRC, target))) out.push(target);
  }
  return out;
};

const all = fs.readdirSync(SRC).filter((f) => /\.(jsx?|mjs)$/.test(f));
const graph = new Map(all.map((f) => [f, localImports(f)]));
const cycles = [];
all.forEach((start) => {
  const seen = new Set();
  const walk = (node, trail) => {
    if (node === start && trail.length) {
      cycles.push([...trail, start].join(" -> "));
      return;
    }
    if (seen.has(node)) return;
    seen.add(node);
    (graph.get(node) || []).forEach((n) => walk(n, [...trail, node]));
  };
  (graph.get(start) || []).forEach((n) => walk(n, [start]));
});
// One entry per cycle rather than one per rotation of it.
const uniq = [...new Set(cycles.map((c) => {
  const parts = c.split(" -> ").slice(0, -1).sort();
  return parts.join(" + ");
}))];
ok(uniq.length === 0, "no module imports itself in a circle",
   uniq.join(" | "));

// The specific regression, named, so it cannot come back unnoticed.
const cw = fs.readFileSync(path.join(SRC, "CrosswalkDashboard.jsx"), "utf8");
ok(/<SeiBusinessSummary[\s/>]/.test(cw) ===
   /^import\s+SeiBusinessSummary\s+from/m.test(cw),
   "CrosswalkDashboard renders SeiBusinessSummary only if it imports it");

ok(!/from\s+["']\.\/Event360\.jsx["']/.test(
     fs.readFileSync(path.join(SRC, "EventMicroBatch.jsx"), "utf8")),
   "EventMicroBatch takes the palette from eventPalette, not back from Event360");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nimport assertions pass");
if (bad) process.exit(1);

// ---------------------------------------------------------------------
// WHAT THIS DOES NOT CATCH, AND WHY IT IS NOT TRIED HERE.
//
// The check above walks JSX TAGS. It would not have caught the next bug of
// the same family: `BC` — a colour map — was read in three places in
// Event360.jsx and defined nowhere. The commit that lifted that palette
// into its own module carried P and TC across with `export` and carried BC
// across WITHOUT it, so the constant existed, privately, in a module
// nothing could reach. "BC is not defined", on mount, on the Estate tab.
//
// A bare-identifier version of this check was written and thrown away.
// Three passes:
//   * every SCREAMING_CASE word   -> ~100 false positives, acronyms out of
//                                    JSX prose (SEI, PII, INBOUND...)
//   * narrowed to `NAME[`         -> 6, from `var a=1,B=2`, `import X, {Y}`
//                                    and regex literals
//   * those three gaps closed     -> 1, a regex literal the stripper could
//                                    not lex
// The last one is not a gap to patch. A regular expression cannot tokenize
// JavaScript, so each pass trades one class of false positive for another,
// and a check that cries wolf is a check the next person skips — including
// the part above, which is reliable because a capitalised JSX tag is
// unambiguous.
//
// The right tool is `eslint` with `no-undef`, which does real scope
// analysis. That is a dependency and a config, not a regex, and it is
// worth adding the day somebody wants it. Until then this file guards
// tags, and says plainly that it does not guard constants.
