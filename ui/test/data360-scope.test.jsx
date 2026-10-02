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
import { LEGACY_SYS_D360, D360_TABS, D360_TAB_DEFAULT,
  NotLoadedForSystem } from "../src/Data360.jsx";
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

// ---- Compression and the Lineage Graph are gone, in every scope -------
const tabs = D360_TABS();
for (const gone of ["Compression", "Lineage Graph"]) {
  ok(!tabs.includes(gone), `${gone} is not a tab`, tabs);
  // A removed tab must also stop RENDERING. Dropping the button while
  // leaving the panel mounted is the half-fix that looks right.
  ok(!new RegExp(`d360tab === "${gone}"`).test(D360),
     `and its panel is gone too, not merely unreachable`, "");
}
// AND its machinery. The graph fetched /data360/graph and column-lineage on
// every Data 360 mount regardless of tab; leaving that behind a deleted tab
// is two API calls a page load that nothing can render.
for (const dead of ["LineageCanvas", "layoutNodes", "LAYER_STRIPE", "PLANES",
                    "colAnchor", "setColEdges"]) {
  ok(!new RegExp(`\\b${dead}\\b`).test(D360),
     `${dead} went with it — dead code that still does network I/O is worse `
     + `than dead code`, (D360.match(new RegExp(`.*\\b${dead}\\b.*`)) || [])[0]);
}
ok(!/api\.graph\(|api\.columnLineage\(/.test(D360),
   "Data 360 no longer fetches the platform graph on mount", "");

for (const kept of ["Pipelines", "Inbound Feeds", "Loaders", "Interdependency"]) {
  ok(tabs.includes(kept), `${kept} is kept`, tabs);
}
ok(tabs[tabs.length - 1] === "Pipelines", "Pipelines is the last tab", tabs);
ok(D360_TAB_DEFAULT === tabs[0],
   "and the default is the first tab, not a tab that moved to the end",
   D360_TAB_DEFAULT);
ok(/if \(!D360_TABS\(\)\.includes\(d360tab\)\) setD360tab\(D360_TAB_DEFAULT\)/.test(D360),
   "a deep link naming a removed tab lands on a real one", "");

// ---- one scope toggle, and no dead project dropdown -------------------
// There were two stacked All/SEI/Non-SEI rows: this screen's own, bound to
// `scope`, and ProjectSwitcher's, bound to `project`. Identical to look at,
// different state underneath. The dropdown beside it never received a
// project list, so it only ever offered "All projects".
ok(!/<ProjectSwitcher/.test(D360), "ProjectSwitcher is not rendered here", "");
// The import, specifically: the prose above the toggle still names
// ProjectSwitcher to explain what was removed and why, and a bare-name
// search would read that explanation as the bug.
ok(!/^import .*ProjectSwitcher/m.test(D360), "and not imported", "");
ok((D360.match(/\["all", "All"\], \["sei", "SEI"\], \["nonsei", "Non-SEI"\]/g) || []).length === 1,
   "exactly one scope toggle is declared", "");
ok(!/\bsetProject\b/.test(D360), "the project state went with the dropdown", "");

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

// ---- an empty list explains itself ------------------------------------
// SEI scope on business pipelines shows nothing, and "0 OF 444" cannot tell
// a reader whether the rows failed to load, were filtered, or cannot exist.
ok(/function NoPipelinesInScope/.test(D360),
   "an empty pipeline list says why in words, not as the number 0", "");
ok(/bf_pipelines/.test(D360),
   "and names the register, so the SEI case reads as by-construction rather "
   + "than as a gap", "");
ok(/const shown = P && inScope\(P\) \? P : null;/.test(D360),
   "the detail pane obeys the scope — the list read 0 of 444 while the pane "
   + "beside it still showed an excluded pipeline", "");
ok(/\{shown && \(/.test(D360), "and renders on that, not on the raw fetch", "");
ok(/\}, \[pipes, scope, curSys\]\)/.test(D360),
   "changing scope re-opens the first pipeline the new scope admits", "");

console.log(bad ? `\n${bad} assertion(s) failed` : "\ndata360-scope assertions pass");
if (bad) process.exit(1);
