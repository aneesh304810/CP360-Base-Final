// Interface 360 · the Ecosystem tab.
//
// WHAT THIS LOCKS DOWN. The map is built from the filtered rows, so it must
// aggregate correctly: one node per system with the project it is most
// often filed under, one edge per (source, target) pair carrying the count,
// PII and Replace tallies, and a role column that follows from degree, not
// from a name list. And the tab must be wired into the screen that was
// also brought up to the client-side-filtering version.

import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import EcosystemView, { buildEcosystem } from "../src/InterfaceEcosystem.jsx";
import { tLight } from "../src/bbhTheme.js";

let bad = 0;
const ok = (c, m, got) => { console.log(`${c ? "ok  " : "FAIL"} ${m}${c ? "" : `  -> ${String(got).slice(0, 240)}`}`); if (!c) bad++; };
function findSrc() {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    for (const rel of ["src", path.join("ui", "src")]) {
      const p = path.join(dir, rel);
      if (fs.existsSync(path.join(p, "Interface360.jsx"))) return p;
    }
    dir = path.dirname(dir);
  }
  throw new Error("src not found");
}
const I = fs.readFileSync(path.join(findSrc(), "Interface360.jsx"), "utf8");

const rows = [
  { interface_id: "1", source_system: "SEI SWP", source_project_id: "sei", target_system: "CP Hub", target_project_id: "internal", integration_name: "Accounts", feed_type: "File", carries_pii: "Y", migration_flag: "N" },
  { interface_id: "2", source_system: "SEI SWP", source_project_id: "sei", target_system: "CP Hub", target_project_id: "internal", integration_name: "Positions", feed_type: "File", carries_pii: "N", migration_flag: "N" },
  { interface_id: "3", source_system: "CP Hub", source_project_id: "internal", target_system: "Pivotal", target_project_id: "pivotal", integration_name: "Accounts", feed_type: "API", carries_pii: "Y", migration_flag: "N" },
  { interface_id: "4", source_system: "AddVantage", source_project_id: "addvantage", target_system: "PBDW", target_project_id: "internal", integration_name: "EOD", feed_type: "File", carries_pii: "N", migration_flag: "Y" },
  { interface_id: "5", source_system: "PBDW", source_project_id: "internal", target_system: "Pivotal", target_project_id: "pivotal", integration_name: "Holdings", feed_type: "File", carries_pii: "N", migration_flag: "Y" },
  { interface_id: "6", source_system: "CP Hub", source_project_id: "sei", target_system: "PBDW", target_project_id: "internal", integration_name: "Prices", feed_type: "Event", carries_pii: "N", migration_flag: "N" },
];

console.log("-- the model");
const eco = buildEcosystem(rows);
const n = Object.fromEntries(eco.nodes.map((x) => [x.id, x]));
ok(eco.nodes.length === 5 && eco.edges.length === 5, "one node per system, one edge per source-target pair", [eco.nodes.length, eco.edges.length]);
ok(n["SEI SWP"].role === 0 && n["CP Hub"].role === 1 && n["PBDW"].role === 1 && n["Pivotal"].role === 2 && n["AddVantage"].role === 0,
   "role follows degree: producer, broker, consumer", eco.nodes.map((x) => `${x.id}:${x.role}`));
ok(n["CP Hub"].proj === "internal", "a system filed under two projects takes the commoner one (internal 3, sei 1)", n["CP Hub"].projs);
ok(n["CP Hub"].in === 2 && n["CP Hub"].out === 2 && n["CP Hub"].pii === 2 && n["Pivotal"].mig === 1, "degree, PII and Replace tallies per system");
const e = Object.fromEntries(eco.edges.map((x) => [x.key, x]));
ok(e["SEI SWP|CP Hub"].n === 2 && e["SEI SWP|CP Hub"].pii === 1 && e["SEI SWP|CP Hub"].types.File === 2, "an edge carries count, PII and feed types", e["SEI SWP|CP Hub"]);
ok(e["AddVantage|PBDW"].mig === e["AddVantage|PBDW"].n, "an edge whose interfaces are all Replace is detectable (drawn dashed)");
ok(eco.edges[0].n === 2, "edges are ordered busiest first");
ok(eco.roles.join(",") === "2,2,1", "two producers, two brokers, one consumer, counted not columned", eco.roles);
ok(eco.nodes.map((x) => x.id).join(",") === "AddVantage,CP Hub,PBDW,Pivotal,SEI SWP", "ring order: by project, then busiest, so a project is one arc", eco.nodes.map((x) => x.id));
ok(eco.nodes.every((x) => Number.isFinite(x.x) && Number.isFinite(x.y) && Math.abs(Math.hypot(x.x - eco.cx, x.y - eco.cy) - eco.r) < 0.01), "every system sits on the ring");
ok(eco.nodes[0].y < eco.cy && Math.abs(eco.nodes[0].x - eco.cx) < 0.01, "the first system is at twelve o'clock");
ok(eco.width > 2 * eco.r && eco.height > 2 * eco.r, "the canvas leaves room for the cards outside the ring");
ok(buildEcosystem([]).nodes.length === 0, "no rows, no nodes");

console.log("-- the picture");
const html = renderToStaticMarkup(<EcosystemView t={tLight} rows={rows} />);
ok(/5<\/b> systems/.test(html) && /5<\/b> connections/.test(html) && /6<\/b> interfaces/.test(html), "the header counts systems, connections and interfaces");
ok(/5 SYSTEMS · 2 producers · 2 brokers · 1 consumers/.test(html), "the caption under the ring counts systems by role");
ok(/broker · 2 in · 2 out/.test(html) && /producer · 2 out/.test(html) && /consumer · 2 in/.test(html), "each card says its role and degree");
ok((html.match(/<path d="M [^"]*" fill="none"/g) || []).length === 5 && /stroke-dasharray="6,4"/.test(html), "five chords (the arrow marker is not one), the all-Replace one dashed", (html.match(/<path d="M [^"]*" fill="none"/g) || []).length);
ok(/stroke="#c1113a"/.test(html), "a PII edge is red");
ok(/width = interfaces · dashed = all Replace · red = carries PII/.test(html), "the legend says what the marks mean");
ok(/No interfaces match/.test(renderToStaticMarkup(<EcosystemView t={tLight} rows={[]} />)), "an empty filter result says so");

console.log("-- wired into Interface 360, which is now the client-side-filtering version");
ok(/import EcosystemView from '\.\/InterfaceEcosystem\.jsx'/.test(I), "imported");
ok(/\['Table', 'Matrix', 'Routing Paths', 'Explorer', 'Ecosystem'\]/.test(I), "fifth tab");
ok(/view === 'Ecosystem' && <EcosystemView t=\{t\} rows=\{filtered\} onSelect=\{setSel\} \/>/.test(I), "draws the filtered rows and opens the drawer");
ok(/api\.interfaces\(\)\.then/.test(I) && /const filtered = useMemo/.test(I) && /const dynamicFacets = useMemo/.test(I), "fetch once, filter client-side, cascading facets");
ok(/<MatrixView t=\{t\} rows=\{filtered\} \/>/.test(I) && /resultCount=\{filtered\.length\}/.test(I), "every view and the result count use the filtered set");

console.log(bad ? `\n${bad} assertion(s) failed` : "\ninterface-ecosystem assertions pass");
if (bad) process.exit(1);
