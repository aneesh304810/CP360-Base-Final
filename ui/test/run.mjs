// Render harness for the crosswalk flow diagram.
//
// There is no test runner in this project and adding one is a bigger change
// than it is worth for three files. esbuild is already a dependency of vite,
// so: bundle each test to CJS, run it under node, fail the process if any of
// them prints FAIL. That is the whole framework.
//
//   node ui/test/run.mjs          (from the repo root, or anywhere)
//
// WHY THIS EXISTS. The flow diagram is layout maths, and layout maths fails
// silently — a ribbon that leaves the canvas still renders, it is just
// invisible below the fold. Three real defects were caught here before they
// shipped: a node sized from one side while ribbons stacked from the other,
// a canvas height derived before the minimum-height floors were applied,
// and a duplicate object key that swallowed an API fallback.

import { execFileSync } from "node:child_process";
import { readdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const ui = join(here, "..");
const esbuild = join(ui, "node_modules", ".bin", "esbuild");
const out = mkdtempSync(join(tmpdir(), "flowtest-"));

let failed = 0;
try {
  for (const f of readdirSync(here).filter((x) => x.endsWith(".test.jsx")).sort()) {
    const bundle = join(out, f.replace(/\.jsx$/, ".cjs"));
    console.log(`\n=== ${f}`);
    try {
      execFileSync(esbuild, [join(here, f), "--bundle", "--format=cjs",
        "--loader:.jsx=jsx", "--platform=node",
        "--define:import.meta.env={}", "--log-level=error", `--outfile=${bundle}`],
        { stdio: ["ignore", "ignore", "inherit"] });
    } catch {
      console.log("FAIL could not bundle"); failed++; continue;
    }
    const res = execFileSync(process.execPath, [bundle], { encoding: "utf8" });
    process.stdout.write(res);
    if (/\bFAIL\b|assertion\(s\) failed|trials failed/.test(res)) failed++;
  }
} finally {
  rmSync(out, { recursive: true, force: true });
}

console.log(failed ? `\n${failed} test file(s) failed` : "\nall flow tests pass");
process.exit(failed ? 1 : 0);
