// The vendored Compare tool, and the three claims CP 360 makes about it.
//
// The Compare screen tells the user, on screen, that nothing they open is
// uploaded anywhere. That is a promise about a file this repository does
// not write by hand — it is pulled from another repository by
// tools/vendor_twinpane.py and overwritten wholesale on every refresh. A
// refresh that brought in a fetch() would make the screen a liar, and
// nobody would notice, because the tool would carry on working perfectly.
//
// So the three things that must stay true are asserted here rather than
// trusted:
//
//   1. the file is where the iframe points;
//   2. it still carries the patches that keep file-system access alive
//      inside the frame — without them "Open folder" silently stops
//      saving back to disk and starts downloading instead;
//   3. it sends nothing anywhere.

import fs from "node:fs";
import path from "node:path";

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${msg}${cond ? "" : `  -> ${String(got)}`}`);
  if (!cond) bad++;
};

function findUi() {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    for (const rel of [".", "ui"]) {
      const c = path.join(dir, rel);
      if (fs.existsSync(path.join(c, "src", "Compare.jsx"))) return c;
    }
    dir = path.dirname(dir);
  }
  throw new Error("could not locate ui/");
}

const UI = findUi();
const SRC = fs.readFileSync(path.join(UI, "src", "Compare.jsx"), "utf8");

// ---- 1. the iframe points at a file that exists -------------------------
const m = SRC.match(/const SRC = "([^"]+)"/);
ok(!!m, "Compare.jsx declares the path it embeds", m);
const served = m ? m[1] : "";
ok(served.startsWith("/"), "it is an absolute, same-origin path — a "
   + "cross-origin frame loses file-system access entirely", served);

const asset = path.join(UI, "public", served.replace(/^\//, ""));
ok(fs.existsSync(asset), `the vendored file exists at public${served}`, asset);
const HTML = fs.existsSync(asset) ? fs.readFileSync(asset, "utf8") : "";

// ---- 2. the patches survived the last vendoring -------------------------
ok(/Vendored from .*Compare/.test(HTML),
   "it carries its provenance banner, naming where it came from");
ok(/python tools\/vendor_twinpane\.py/.test(HTML),
   "and how to refresh it, so nobody hand-edits the copy");

const marks = (HTML.match(/CP360-PATCH/g) || []).length;
ok(marks >= 3, "the CP 360 patches are present", marks);
ok(/const canFS = \(!inFrame \|\| sameOrigin\)/.test(HTML),
   "patch 1: a same-origin frame keeps file-system access — without this "
   + "Open folder silently degrades to download-only");
ok(/window\.top\.location\.origin === location\.origin/.test(HTML),
   "and it is a real same-origin test, not an unconditional override");
ok(!/const canFS = !inFrame &&/.test(HTML),
   "the upstream line it replaces is gone, not merely shadowed");
ok((HTML.match(/err\.name === 'SecurityError'/g) || []).length === 2,
   "patch 2: both pickers fall back to the <input> if the browser refuses, "
   + "so neither button can end up dead",
   (HTML.match(/err\.name === 'SecurityError'/g) || []).length);

// ---- 3. nothing it opens leaves the browser -----------------------------
// The screen says so in as many words. These are the ways a page could
// make that false.
for (const [re, what] of [
  [/\bfetch\s*\(/, "fetch()"],
  [/XMLHttpRequest/, "XMLHttpRequest"],
  [/sendBeacon/, "navigator.sendBeacon"],
  [/new\s+WebSocket/, "WebSocket"],
  [/new\s+EventSource/, "EventSource"],
  [/navigator\.clipboard\.writeText\s*\(\s*JSON/, "a clipboard dump of state"],
  [/<form[^>]+action=/i, "a form post"],
]) {
  ok(!re.test(HTML), `no ${what} — the "nothing is uploaded" claim holds`);
}

// The two requests it IS allowed to make are for code and a font, never
// for content. Both are named on the screen and in the docs; this asserts
// the list has not quietly grown.
const hosts = [...new Set((HTML.match(/https?:\/\/[a-zA-Z0-9.-]+/g) || [])
  .map((u) => u.replace(/^https?:\/\//, "")))]
  .filter((h) => !h.endsWith(".internal") && h !== "github.com");
const EXPECTED = ["cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"];
ok(hosts.sort().join(",") === EXPECTED.join(","),
   "it reaches exactly the hosts the screen and docs disclose", hosts);

// ---- the screen must not sandbox the frame ------------------------------
// `sandbox=`, not the word: the JSX carries a comment explaining why the
// attribute is absent, and a looser pattern matches the explanation.
ok(!/<iframe[^>]*\bsandbox\s*=/.test(SRC),
   "the iframe is not sandboxed — sandboxing strips the file-system access "
   + "the tool exists for");
ok(/vendor_twinpane\.py/.test(SRC),
   "and the screen tells the reader how the file is refreshed");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nvendor-twinpane assertions pass");
if (bad) process.exit(1);
