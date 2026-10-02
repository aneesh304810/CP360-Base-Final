// Data 360's Non-SEI scope: the legacy badge has to change the rows.
//
// THE BUG THIS LOCKS DOWN. Data360 held `scope` and `legacySys` in state,
// drew a row of legacy-system chips from them, and then passed neither to
// four of its six tabs. Inbound Feeds, Loaders, Interdependency and
// Compression rendered identically whatever was selected. Picking STAR and
// being shown the SWP Account feed is not a filter that failed — it is the
// SEI answer wearing a legacy badge, which is worse than no answer because
// it reads as one, and a reader has no way to tell.
//
// AND IT WAS NOT A FILTER TO BEGIN WITH. /data360/inbound-feeds reads
// datasets WHERE object_type='FEED', i.e. SWP_EOD_Data_Feeds.xlsx. That
// table holds no AddVantage, STAR or UAF row and never will: they are the
// incumbent systems the SEI programme replaces. legacy_source_file is the
// only table in the schema carrying SOURCE_SYSTEM, so Non-SEI reads that
// one instead. A test that only checked "a system param is sent" would
// have passed against the wrong table.
//
// The prop wiring is asserted against the source because that IS the
// defect: a tab rendered with the right data but the wrong props still
// renders, which is exactly why this shipped.

import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { LEGACY_SYS_D360, D360_TABS, NotLoadedForSystem } from "../src/Data360.jsx";
import { tLight } from "../src/bbhTheme.js";

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
      if (fs.existsSync(path.join(c, "Data360.jsx"))) return c;
    }
    dir = path.dirname(dir);
  }
  throw new Error("could not locate ui/src from " + process.cwd());
}
const SRC = findSrc();
const strip = (f) => fs.readFileSync(path.join(SRC, f), "utf8")
  .split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
const D360 = strip("Data360.jsx");

// ---- the two SEI-only tabs are gone from Non-SEI ----------------------
const nonsei = D360_TABS("nonsei");
for (const gone of ["Compression", "Lineage Graph"]) {
  ok(!nonsei.includes(gone),
     `Non-SEI does not offer ${gone} — it is an SEI statement with no legacy equivalent`,
     nonsei);
}
for (const kept of ["Pipelines", "Inbound Feeds", "Loaders", "Interdependency"]) {
  ok(nonsei.includes(kept), `Non-SEI keeps ${kept}`, nonsei);
}
for (const sc of ["all", "sei"]) {
  ok(D360_TABS(sc).includes("Compression") && D360_TABS(sc).includes("Lineage Graph"),
     `${sc} scope keeps both — removing them there would delete a working feature`,
     D360_TABS(sc));
}
// A tab dropped from the bar must also stop RENDERING. Hiding the button
// while leaving the panel mounted is the half-fix that looks right.
for (const gone of ["Compression", "Lineage Graph"]) {
  ok(new RegExp(`d360tab === "${gone}" && scope !== "nonsei"`).test(D360),
     `the ${gone} panel is gated on scope too, not just its button`, "");
}
ok(/if \(!D360_TABS\(scope\)\.includes\(d360tab\)\) setD360tab\("Pipelines"\)/.test(D360),
   "switching scope off a tab that no longer exists reselects a real one", "");

// ---- UAF exists here, as it already does in Lineage 360 ---------------
ok(Boolean(LEGACY_SYS_D360.UAF),
   "UAF is one of the systems — Lineage 360 has carried it since it was found "
   + "feeding IMDS, and this screen silently decided it did not exist",
   Object.keys(LEGACY_SYS_D360));
for (const k of ["ADDVANTAGE", "CRD", "STAR", "UAF"]) {
  ok(LEGACY_SYS_D360[k] && LEGACY_SYS_D360[k].label && LEGACY_SYS_D360[k].c,
     `${k} has a label and a colour`, LEGACY_SYS_D360[k]);
}

// ---- every tab that reads the toggle is actually HANDED it ------------
for (const [tab, comp] of [["Inbound Feeds", "InboundFeedsView"],
                           ["Loaders", "LoadersView"],
                           ["Interdependency", "InterdependencyTab"]]) {
  const m = new RegExp(`d360tab === "${tab}" && <${comp}[\\s\\S]{0,220}?/>`).exec(D360);
  ok(Boolean(m), `${tab} mounts ${comp}`, "");
  if (m) {
    ok(/scope=\{scope\}/.test(m[0]),
       `${comp} is handed scope — without it the legacy chips are decorative`, m[0]);
    ok(/legacySys=\{legacySys\}/.test(m[0]),
       `${comp} is handed legacySys`, m[0]);
  }
}

// ---- Non-SEI reads the legacy register, not the SWP dictionary --------
ok(/function LegacyFeedsView/.test(D360), "there is a legacy feeds view", "");
ok(/scope === "nonsei"\) return <LegacyFeedsView/.test(D360),
   "Inbound Feeds routes Non-SEI to it rather than filtering the SWP table", "");
const legacyView = (D360.match(/function LegacyFeedsView[\s\S]*?\nfunction /) || [""])[0];
ok(/legacyFeedApi\./.test(legacyView),
   "and it reads legacy_source_file through its own client", "");
ok(!/\bapi\.inboundFeeds\b/.test(legacyView),
   "it never calls the SWP EOD feed endpoint — that table has no legacy row in it",
   legacyView.slice(0, 200));

// ---- the client never falls back to mock ------------------------------
const CLIENT = strip("data360_api_additions.js");
ok(!/mockData|MOCK/.test(CLIENT),
   "the legacy client has no mock fallback — a system with nothing ingested "
   + "has to look empty, which is the entire fix", CLIENT.match(/.*MOCK.*/));
ok(!/from ["']\.\/api\.js["']/.test(CLIENT),
   "and it does not touch api.js, per the rule seiCrosswalkApi.js sets out", "");
for (const fn of ["systems", "feeds", "fields"]) {
  ok(new RegExp(`${fn}:`).test(CLIENT), `the client exposes ${fn}`, "");
}

// ---- the empty state names the table, so it is actionable -------------
for (const sys of Object.keys(LEGACY_SYS_D360)) {
  let h = "";
  try {
    h = renderToStaticMarkup(
      <NotLoadedForSystem t={tLight} sys={sys} what="inbound feeds"
        table="legacy_source_file" run="run the ingestion" />);
    ok(h.includes(LEGACY_SYS_D360[sys].label),
       `the ${sys} empty state names the system`, h.slice(0, 160));
  } catch (e) {
    ok(false, `the ${sys} empty state renders`, e && e.stack);
  }
  ok(h.includes("legacy_source_file"),
     `the ${sys} empty state names the table the answer would come from — `
     + `"nothing loaded" and "nothing exists" are different claims`, "");
  ok(!/undefined|NaN/.test(h), `the ${sys} empty state is clean`, h);
}

// ---- Lineage 360: an unanswered question is not a list of answers -----
// IMDS offered AddVantage because lane-systems could not attribute anything
// and the picker read that silence as permission to show everything.
const LH = strip("LineageHome.jsx");
ok(/const attributed = Boolean\(dsSystems && dsSystems\.includes\(k\)\)/.test(LH),
   "the picker distinguishes a system the warehouse's own data attributes "
   + "from one merely listed", "");
ok(/This is not a statement that each one feeds/.test(LH),
   "and says so on screen when nothing could be attributed", "");
ok(/laneInfo && laneInfo\.route/.test(LH),
   "it surfaces WHICH signal attributed a system — the only way a wrong "
   + "register row becomes findable rather than just wrong", "");

console.log(bad ? `\n${bad} assertion(s) failed` : "\ndata360-scope assertions pass");
if (bad) process.exit(1);
