// The source-system badge has to narrow the files.
//
// WHAT BROKE. /legacy-lineage/sources took a `system` parameter and used it
// only to steer the group resolver — the file list itself was every file in
// the warehouse. The UI then never sent the parameter at all, so the
// endpoint fell back to its own default. Two independent reasons the badge
// could not work, and the visible result was that IMDS, which receives no
// AddVantage feed, answered an AddVantage request with its STAR feeds.
//
// AND A GUARD THAT WAS RIGHT ABOUT THE WRONG CASE. SourceLineage filtered
// client-side on the lane scope and then said:
//
//     // A filter that removes everything is a failed join, not an answer.
//     if (!files.length) return srcsRaw;
//
// Usually true. Not true for AddVantage on IMDS, where zero IS the answer —
// so the guard converted the correct result into the whole warehouse. The
// fix is not to delete the guard, which still protects against a genuinely
// failed join; it is to let the server answer from the register, which can
// tell "none for this system" from "cannot say".
//
// These are source-level assertions because that is where the defects live:
// a parameter that is never sent, and a branch that returns the wrong
// variable. Both render perfectly.

import fs from "node:fs";
import path from "node:path";

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${msg}${cond ? "" : `  -> ${String(got).slice(0, 300)}`}`);
  if (!cond) bad++;
};
function findSrc() {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    for (const rel of ["src", path.join("ui", "src")]) {
      const c = path.join(dir, rel);
      if (fs.existsSync(path.join(c, "SourceLineage.jsx"))) return c;
    }
    dir = path.dirname(dir);
  }
  throw new Error("could not locate ui/src from " + process.cwd());
}
const SRC = findSrc();
const API_DIR = path.join(SRC, "..", "..", "api", "app");
const strip = (f, d) => fs.readFileSync(path.join(d || SRC, f), "utf8")
  .split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|#|--)/.test(l)).join("\n");

const SL = strip("SourceLineage.jsx");
const CLIENT = strip("lineage_api_additions.js");
const SRCS = strip("routers_legacy_source.py", API_DIR);
const LANE = strip("routers_sei_crosswalk.py", API_DIR);

// ---- the parameter is sent, and the fetch re-runs when it changes -----
ok(/lineageSources: \(data_source, spine, system\)/.test(CLIENT),
   "the client accepts a system", "");
ok(/_qs\(\{ data_source, spine, system \}\)/.test(CLIENT),
   "and puts it on the query string — omitting it is what made the badge a "
   + "label", "");
ok(/lineageSources\(ds, undefined, system\)/.test(SL),
   "SourceLineage passes the selected system", "");
ok(/\}, \[ds, system\]\);/.test(SL),
   "and refetches when it changes — a cached list for the old system is the "
   + "same bug one render later", "");

// ---- the endpoint filters the FILES, not just the grouping ------------
ok(/source_system\) = :sys/.test(SRCS),
   "/sources looks the system up in the feed register", "");
ok(/sys_keys/.test(SRCS) && /files = kept/.test(SRCS),
   "and drops the files that do not belong to it", "");
ok(/_peel_feed_key\(k\) in sys_keys/.test(SRCS),
   "matching on the peeled feed key too, as the dataset lookup already does",
   "");

// ---- but never empties a screen it cannot speak for -------------------
// legacy_source_file is optional. If it holds nothing for this warehouse,
// filtering to zero would be a claim the register cannot support.
ok(/filter_on = bool\(register_rows\) and bool\(sysname\)/.test(SRCS),
   "the filter only applies when the register has rows for this warehouse",
   "");
ok(/"applied": filter_on/.test(SRCS),
   "and the payload says whether it did", "");
ok(/"register_rows": register_rows/.test(SRCS) && /"excluded": excluded/.test(SRCS),
   "with the evidence: how much the register holds, and how much it removed",
   "");
ok(/:ds IS NULL/.test(SRCS) === false,
   "no untyped NULL bind compared with IS NULL — _safe would turn a driver "
   + "complaint into “this system sends nothing”", "");

// ---- none-for-this-system reads differently from none-at-all ----------
ok(/sends no files into/.test(SL),
   "the empty list says the system sends nothing HERE", "");
ok(/This is an answer, not a\s+gap/.test(SL),
   "and says it is an answer rather than sending the reader after an "
   + "ingestion problem that does not exist", "");
ok(/check ingestion for this warehouse/.test(SL),
   "while the genuine could-not-say case still says that", "");

// ---- declared is not observed -----------------------------------------
// IMDS listed AddVantage because a register row says so. The badge gave no
// way to tell that from a system with real lineage behind it.
ok(/"evidence": \("lineage" if v else "declaration_only"\)/.test(LANE),
   "lane-systems grades each system by whether any column backs it", "");
ok(/"routes": by_system\.get\(k, \[\]\)/.test(LANE),
   "and names which signal attributed it, per system rather than per call — "
   + "a union across all systems cannot be traced to a row", "");
const LH = strip("LineageHome.jsx");
ok(/evidence === "declaration_only"/.test(LH),
   "the picker reads that grade", "");
ok(/declaredOnly/.test(LH) && /borderStyle: declaredOnly/.test(LH),
   "and draws a declared-only system differently from an observed one", "");
ok(/check the lane and/.test(LH),
   "and points at the registers to fix, rather than just looking wrong", "");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nsource-system-filter assertions pass");
if (bad) process.exit(1);
