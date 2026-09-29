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

// The specific regression, named, so it cannot come back unnoticed.
const cw = fs.readFileSync(path.join(SRC, "CrosswalkDashboard.jsx"), "utf8");
ok(/<SeiBusinessSummary[\s/>]/.test(cw) ===
   /^import\s+SeiBusinessSummary\s+from/m.test(cw),
   "CrosswalkDashboard renders SeiBusinessSummary only if it imports it");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nimport assertions pass");
if (bad) process.exit(1);
