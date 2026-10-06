// Release Delivery, moved out of DevOps 360 into Governance.
//
// WHAT THIS PINS:
//
//   DEMO NEVER OVERLAYS LIVE. A dashboard where some rows are real and
//   some are invented is worse than an empty one, so the toggle is only
//   offered when the table has no rows at all.
//
//   DEMO IS ALWAYS LABELLED. While it is on, the status pill says DEMO
//   and a banner stands above the table. Nothing about it can be read as
//   live, including the "live" flag handed to the dashboard.
//
//   THE DEMO OBEYS THE NAMING STANDARD. A demo that invents its own
//   formats teaches the wrong ones to everybody who sees it first.
//
//   THE MODULE IS REGISTERED. A route the nav can show but sec_module has
//   never heard of is invisible the moment enforcement is switched on.
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { DEMO_ENVS, DEMO_HIST, DEMO_RELS, DEMO_NOTE }
  from "../src/releaseDemoData.js";
import { NAMING } from "../src/DevOps360.jsx";
import { tLight, tDark } from "../src/bbhTheme.js";

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${msg}${cond ? "" : `  -> ${String(got).slice(0, 300)}`}`);
  if (!cond) bad++;
};
function root() {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, "ui", "src", "ReleaseDelivery.jsx"))) return dir;
    if (fs.existsSync(path.join(dir, "src", "ReleaseDelivery.jsx")))
      return path.dirname(dir);
    dir = path.dirname(dir);
  }
  throw new Error("repo root not found");
}
const R = root();
const rd = (p) => fs.readFileSync(path.join(R, p), "utf8");
const RD = rd("ui/src/ReleaseDelivery.jsx");
const DO = rd("ui/src/DevOps360.jsx");
const NAV = rd("ui/src/AppShell.jsx");
const APP = rd("ui/src/App.jsx");
const SEC = rd("sql/64_security.sql");

/* ---------------------------------------------------- it actually moved */
ok(/\['release', 'Release Delivery'/.test(NAV),
   "the nav carries a Release Delivery item", "");
const gov = NAV.slice(NAV.indexOf("group: 'Governance'"), NAV.indexOf("group: 'Admin'"));
ok(/'release'/.test(gov),
   "and it sits under Governance, not Architecture",
   gov.match(/\['[a-z0-9]+'/g).join(" "));
ok(/release: <ReleaseDelivery t=\{t\} \/>/.test(APP),
   "App routes it", "");
ok(!/<Dashboard t=\{t\} live=\{live\}/.test(DO),
   "DevOps 360 no longer renders the dashboard itself", "");
ok(/Governance &rarr; Release\s+Delivery/.test(DO) || /has\s+moved/.test(DO),
   "and says where it went rather than just dropping it", "");
// A route the nav can show but sec_module has never heard of disappears
// the moment enforcement goes on.
ok(/'release','Release Delivery','Governance'/.test(SEC),
   "sec_module registers the new module under Governance", "");
ok(/'devops360','DevOps 360','Architecture'/.test(SEC),
   "and DevOps 360, which was never registered at all - under enforcement "
   + "that made it unreachable rather than merely ungranted", "");

/* ------------------------------------------------------- the demo rows */
ok(DEMO_ENVS.length === 4
   && DEMO_ENVS.map((e) => e.environment).join(",") === "DEV,SIT,UAT,PROD",
   "four environments in promotion order",
   DEMO_ENVS.map((e) => e.environment).join(","));
// Every value has to obey the published format, or the demo teaches the
// wrong one to whoever sees the screen first.
const appFmt = /^v20\d\d\.\d\d\.\d\d$/;
ok(DEMO_ENVS.every((e) => appFmt.test(e.app.app_tag)),
   "every app tag is v + date, as the naming standard says",
   DEMO_ENVS.map((e) => e.app.app_tag).join(" "));
ok(DEMO_ENVS.every((e) =>
     new RegExp(`^${e.environment.toLowerCase().replace("uat", "qc")}-\\d{4}$`)
       .test(e.schema.db_tag)),
   "and every database tag is env + build, per environment",
   DEMO_ENVS.map((e) => e.schema.db_tag).join(" "));
ok(DEMO_HIST.every((r) => r.lane === "app" ? appFmt.test(r.app_tag) : !!r.db_tag),
   "each history row carries the tag for its own lane and not the other's",
   DEMO_HIST.filter((r) => r.lane === "app" && !appFmt.test(r.app_tag))
     .map((r) => r.deployment_id).join(" "));
ok(NAMING.some((n) => n.example === "v2026.10.01")
   && DEMO_HIST.some((r) => r.app_tag === "v2026.10.01"),
   "the demo uses the standard's own worked example, so the two cannot "
   + "drift apart unnoticed", "");

// Shape, not noise. Each of these is a state somebody has to recognise.
const prod = DEMO_ENVS.find((e) => e.environment === "PROD");
const uat = DEMO_ENVS.find((e) => e.environment === "UAT");
ok(prod.app.app_tag < uat.app.app_tag,
   "PROD sits behind QC, which the reference tab calls the normal state",
   `${prod.app.app_tag} vs ${uat.app.app_tag}`);
ok(DEMO_ENVS.filter((e) => !e.lanes_aligned).length === 1,
   "exactly one environment is out of step", "");
ok(!uat.lanes_aligned && uat.schema.deployed_at > uat.app.deployed_at,
   "and it is schema AHEAD of code - the direction expand-and-contract "
   + "makes safe, not the dangerous one",
   `${uat.schema.deployed_at} vs ${uat.app.deployed_at}`);
ok(DEMO_RELS.filter((r) => r.status === "blocked").length === 1
   && DEMO_HIST.filter((r) => r.status === "rolled_back").length === 1,
   "one blocked release and one rollback - a dashboard that is only ever "
   + "green teaches nobody what red looks like", "");
ok(DEMO_HIST.find((r) => r.status === "rolled_back").notes.length > 20,
   "and the rollback says what went wrong, because that is the row anyone "
   + "shown this screen will ask about",
   DEMO_HIST.find((r) => r.status === "rolled_back").notes);
ok(DEMO_HIST.every((r) => r.deployment_id && r.deployed_at && r.status),
   "every row is complete enough for the CSV export", "");
ok(new Set(DEMO_HIST.map((r) => r.deployment_id)).size === DEMO_HIST.length,
   "no deployment id is reused", "");

/* --------------------------------------------- it cannot pass for live */
ok(/const canDemo = loaded && !live/.test(RD),
   "the toggle is offered only when the table is genuinely empty - demo "
   + "rows never sit beside real ones", "");
ok(/live=\{showDemo \? false : live\}/.test(RD),
   "and the dashboard is told it is NOT live while demo is on, so nothing "
   + "inside it can claim otherwise", "");
ok(/DEMO ROWS/.test(RD) && /showDemo && \(/.test(RD),
   "the status pill and a banner both say so while it is on", "");
ok(/Demo rows\./.test(DEMO_NOTE) && /never to be counted|Nothing here came from/
     .test(DEMO_NOTE),
   "and the note says the rows are to be looked at, not counted",
   DEMO_NOTE.slice(0, 70));

console.log(bad ? `\n${bad} assertion(s) failed` : "\nrelease-delivery assertions pass");
if (bad) process.exit(1);
