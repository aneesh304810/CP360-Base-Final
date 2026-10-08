// Interface 360 · the Ecosystem tab, built for 819 interfaces and 107 names.
//
// WHAT THIS LOCKS DOWN. Three reductions make the estate readable and each
// must be exact: names merged by case and spacing only; a zone keeps its
// busiest systems and folds the rest into one node whose links aggregate;
// a floor on interfaces per link that picks itself to leave about forty
// lines. Stores are told apart by name and drawn as cylinders. And the tab
// stays wired into the client-side-filtering Interface 360.

import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import EcosystemView, { aggregate, layout, autoFloor, canonName, isStore, routeLines } from "../src/InterfaceEcosystem.jsx";
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

const row = (id, s, sp, tg, tp, dom, extra = {}) => ({ interface_id: String(id), source_system: s, source_project_id: sp, target_system: tg, target_project_id: tp,
  domain: dom, integration_name: `I${id}`, feed_type: "File", carries_pii: "N", migration_flag: "N", ...extra });
const rows = [
  row(1, "AddVantage", "addvantage", "PB Data Warehouse", "internal", "Private Banking", { carries_pii: "Y" }),
  row(2, "AddVantage", "addvantage", "PB Data Warehouse", "internal", "Private Banking"),
  row(3, "AddVantage", "addvantage", "Pivotal CRM", "pivotal", "Private Banking", { migration_flag: "Y" }),
  row(4, "AUM", "internal", "PB Data Warehouse", "internal", "Private Banking"),
  row(5, "AUm", "internal", "PB Data Warehouse", "internal", "Private Banking"),
  row(6, "Bloomberg AIM", "bloomberg", "IM Datamart", "internal", "Investment Management"),
  row(7, "Star", "internal", "IM Datamart", "internal", "Investment Management"),
  row(8, "UAF", "internal", "Star", "internal", "Investment Management"),
  row(9, "PB Data Warehouse", "internal", "IM Datamart", "internal", "Investment Management"),
  row(10, "Tiny A", "internal", "Tiny B", "internal", "Private Banking"),
  row(11, "Tiny C", "internal", "Tiny D", "internal", "Private Banking"),
  row(12, "Tiny E", "internal", "PB Data Warehouse", "internal", "Private Banking"),
];

console.log("-- aggregation");
const agg = aggregate(rows);
const by = Object.fromEntries(agg.systems.map((s) => [s.id, s]));
ok(canonName("  AUm ") === "aum" && canonName("PB  Data Warehouse") === "pb data warehouse", "names canonicalise by case and spacing");
ok(!("AUm" in by) && by["AUM"] && by["AUM"].out === 2 && agg.merged === 1, "AUM and AUm are one system, the commoner spelling shown, the merge counted", Object.keys(by));
ok(by["AddVantage"] && !by["AddVantage - API"], "nothing else is merged: a different name stays a different system");
ok(by["PB Data Warehouse"].zone === "Private Banking" && by["IM Datamart"].zone === "Investment Management", "a system's zone is the domain its interfaces are filed under", [by["PB Data Warehouse"].zone, by["IM Datamart"].zone]);
ok(by["PB Data Warehouse"].store && by["IM Datamart"].store && !by["AddVantage"].store && isStore("Client DB") && !isStore("Addepar"), "stores are told apart by name");
ok(by["PB Data Warehouse"].role === "broker" && by["AddVantage"].role === "producer" && by["Pivotal CRM"].role === "consumer", "roles from degree");
const link = Object.fromEntries(agg.links.map((l) => [l.key, l]));
ok(link["addvantage|pb data warehouse"].n === 2 && link["addvantage|pb data warehouse"].pii === 1, "one link per pair, with counts");

console.log("-- the floor picks itself");
ok(autoFloor(agg.links) === 1, "few links: everything drawn");
const many = Array.from({ length: 200 }, (_, i) => ({ n: (i % 7) + 1 }));
const f = autoFloor(many, 40);
ok(f >= 2 && many.filter((l) => l.n >= f).length <= 40 + 29, "many links: the floor rises so that about forty remain", [f, many.filter((l) => l.n >= f).length]);

console.log("-- layout, folding and zones");
const lay = layout(agg, { perZone: 3, floor: 1 });
ok(lay.zones.map((z) => z.name).join("|") === "Private Banking|Investment Management", "zones ordered by interface ends, busiest first", lay.zones.map((z) => z.name));
const pb = lay.zones[0];
ok(pb.kept.map((s) => s.id).join(",") === "PB Data Warehouse,AddVantage,AUM" && pb.folded.length === 6, "a zone keeps its three busiest and folds the rest", [pb.kept.map((s) => s.id), pb.folded.length]);
ok(lay.nodes.has("__fold__Private Banking") && lay.nodes.get("__fold__Private Banking").id === "+6 other systems", "the fold is one node that says how many it holds");
const foldLines = lay.allLines.filter((l) => l.from === "__fold__Private Banking" || l.to === "__fold__Private Banking");
ok(foldLines.length === 2 && foldLines.some((l) => l.from === "addvantage" && l.to === "__fold__Private Banking" && l.n === 1)
   && foldLines.some((l) => l.from === "__fold__Private Banking" && l.to === "pb data warehouse" && l.n === 1),
   "links to and from folded systems re-point to the fold; the two links inside the fold are not drawn", foldLines.map((l) => `${l.from}>${l.to}:${l.n}`));
ok(layout(agg, { perZone: 3, floor: 1, unfolded: new Set(["Private Banking"]) }).zones[0].folded.length === 0, "an unfolded zone shows every system");
const im = lay.zones[1];
ok(im.folded.length === 0 && im.kept.length === 4, "a zone within one of the limit is not folded for one system");
const pbw = lay.nodes.get("pb data warehouse"), addv = lay.nodes.get("addvantage");
ok(pbw.y > addv.y, "the store sits on the bottom row of its zone, below the applications", [pbw.y, addv.y]);
ok(lay.zones.every((z) => z.x >= 0 && z.w > 0 && z.h > 0) && lay.height > 0, "every zone has a place and a size");
const floored = layout(agg, { perZone: 3, floor: 2 });
ok(floored.shownCount < lay.shownCount && floored.hidden === lay.lineCount - floored.shownCount, "the floor hides thin links and says how many");

console.log("-- the picture");
const html = renderToStaticMarkup(<EcosystemView t={tLight} rows={rows} defaultOpen />);
ok(/13<\/b> systems in <b[^>]*>2<\/b> zones/.test(html) && /12<\/b> interfaces/.test(html), "the header counts systems, zones and interfaces", html.slice(0, 400));
ok(/1 name variants merged/.test(html), "the merge is said on screen");
ok(/Private Banking<\/text>/.test(html) && /Investment Management<\/text>/.test(html), "zones are drawn as labelled panels");
ok(/<ellipse /.test(html), "a store is drawn as a cylinder");
ok(!/other systems/.test(html), "nine systems in a zone with a limit of eight are all shown: folding one system would hide nothing");
const dense = renderToStaticMarkup(<EcosystemView t={tLight} defaultOpen rows={[...rows, ...Array.from({ length: 6 }, (_, i) => row(100 + i, `Extra ${i}`, "internal", "PB Data Warehouse", "internal", "Private Banking"))]} />);
ok(/\+\d+ other systems/.test(dense) && /click to unfold/.test(dense), "with more systems than the limit, a fold node is drawn and says what to do");
ok(/stroke-dasharray="6,4"/.test(html) && /stroke="#c1113a"/.test(html), "an all-Replace link is dashed and a PII link is red");
ok(/systems per zone/.test(html) && /draw links with ≥/.test(html) && /\(auto\)/.test(html), "the two reductions are controls, the floor says it is automatic");
ok(/No interfaces match/.test(renderToStaticMarkup(<EcosystemView t={tLight} rows={[]} />)), "an empty filter result says so");

console.log("-- wired into Interface 360");
ok(/import EcosystemView from '\.\/InterfaceEcosystem\.jsx'/.test(I) && /\['Overview', 'Table', 'Matrix', 'Routing Paths', 'Explorer'\]/.test(I) && /useState\('Overview'\)/.test(I), "imported, the Overview tab comes first and is the default");
ok(/view === 'Overview' && <EcosystemView t=\{t\} rows=\{filtered\} onSelect=\{setSel\} \/>/.test(I), "draws the filtered rows and opens the drawer");

console.log(bad ? `\n${bad} assertion(s) failed` : "\ninterface-ecosystem assertions pass");
if (bad) process.exit(1);

// ---- the zone-level landing ---------------------------------------------
console.log("-- landing: every zone one box, one flow per zone pair");
const land = layout(agg, { perZone: 8, floor: 1, expanded: new Set() });
ok(land.landing === true && land.zones.every((z) => !z.open), "with nothing expanded, the layout is the landing and every zone is closed");
ok([...land.nodes.keys()].sort().join("|") === "__zone__Investment Management|__zone__Private Banking", "one node per zone, nothing else", [...land.nodes.keys()]);
const zpb = land.nodes.get("__zone__Private Banking");
ok(zpb.zoneBox && zpb.systems === 9 && zpb.stores === 1 && zpb.pii === 2, "a zone box carries its system, store and PII counts", zpb);
ok(zpb.internal === 8, "interfaces that stay inside the zone are counted on the box, not drawn", zpb.internal);
ok(land.lineCount === 1 && land.lines[0].from === "__zone__Private Banking" && land.lines[0].to === "__zone__Investment Management" && land.lines[0].n === 1,
   "one flow between the zones, carrying the one cross-zone interface", land.lines);
const one = layout(agg, { perZone: 8, floor: 1, expanded: new Set(["Private Banking"]) });
ok(one.zones.find((z) => z.name === "Private Banking").open && !one.zones.find((z) => z.name === "Investment Management").open, "expanding one zone opens it and leaves the other closed");
ok(one.nodes.has("pb data warehouse") && one.nodes.has("__zone__Investment Management") && !one.nodes.has("__zone__Private Banking"),
   "the open zone shows its systems; the closed one is still a box");
ok(one.lines.some((l) => l.from === "pb data warehouse" && l.to === "__zone__Investment Management"), "a cross-zone link now runs from the system to the closed zone's box");
ok(layout(agg, { perZone: 8, floor: 1, expanded: null }).zones.every((z) => z.open), "expanded = null is the full system map");

console.log("-- orthogonal routing: lines live in the gutters and never cross a box");
// an axis-aligned segment that passes through the inside of a box it does not start or end on
const crosses = (p, q, n) => {
  const x0 = n.x + 1, y0 = n.y + 1, x1 = n.x + n.w - 1, y1 = n.y + n.h - 1;
  if (Math.abs(p.y - q.y) < 0.01) { const y = p.y; return y > y0 && y < y1 && Math.max(p.x, q.x) > x0 && Math.min(p.x, q.x) < x1; }
  const x = p.x; return x > x0 && x < x1 && Math.max(p.y, q.y) > y0 && Math.min(p.y, q.y) < y1;
};
const audit = (lay) => {
  const boxes = [...lay.nodes.values()], bad = [];
  lay.lines.forEach((l) => {
    if (!l.pts) { bad.push(`${l.key}: not routed`); return; }
    for (let i = 1; i < l.pts.length; i++) {
      const p = l.pts[i - 1], q = l.pts[i];
      if (Math.abs(p.x - q.x) > 0.01 && Math.abs(p.y - q.y) > 0.01) bad.push(`${l.key}: diagonal step`);
      boxes.forEach((n) => { if (n.key !== l.from && n.key !== l.to && crosses(p, q, n)) bad.push(`${l.key} through ${n.key}`); });
      // open zones are boxes too: a line may only cross a zone's edge, not run along the inside of another zone it has no end in
    }
    const first = l.pts[0], last = l.pts[l.pts.length - 1], a = lay.nodes.get(l.from), b = lay.nodes.get(l.to);
    const onEdge = (pt, n) => Math.abs(pt.x - n.x) < 0.01 || Math.abs(pt.x - n.x - n.w) < 0.01 || Math.abs(pt.y - n.y) < 0.01 || Math.abs(pt.y - n.y - n.h) < 0.01;
    if (!onEdge(first, a) || !onEdge(last, b)) bad.push(`${l.key}: does not start and end on the box edges`);
  });
  return bad;
};
const open2 = layout(agg, { perZone: 3, floor: 1, expanded: null });
ok(open2.zones.every((z) => z.y === 0) && open2.zones[1].x >= open2.zones[0].x + open2.zones[0].w, "zones sit in one row across the width, never wrapped", open2.zones.map((z) => [z.x, z.y]));
ok(audit(open2).length === 0, "fixture, all open: every line is orthogonal, starts and ends on a box edge, crosses no box", audit(open2).slice(0, 5));
const half = layout(agg, { perZone: 3, floor: 1, expanded: new Set(["Private Banking"]) });
const zi = half.nodes.get("__zone__Investment Management");
ok(zi.h === half.rowH && zi.w > 200 && Array.isArray(zi.top) && zi.top[0].id === "IM Datamart", "a closed zone is a card as tall as the row, carrying its busiest systems", [zi.h, half.rowH, zi.top?.[0]?.id]);
ok(audit(half).length === 0, "fixture, one zone open: lines into the closed zone's card cross nothing", audit(half).slice(0, 5));
// a dense synthetic estate: four zones, 90 names, 600 interfaces, every combination of open and closed
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const DOMS = ["Private Banking", "PB Data Platform", "Investment Management", "Shared Services"];
const names = Array.from({ length: 90 }, (_, i) => [i % 9 === 0 ? `Mart ${i}` : `App ${i}`, DOMS[i % 4]]);
const big = [];
for (let i = 0; i < 600; i++) {
  const dom = DOMS[Math.floor(rnd() * 4)], pool = names.filter((x) => x[1] === dom);
  const a = pool[Math.floor(rnd() * pool.length)];
  const cross = rnd() < 0.3, pool2 = cross ? names.filter((x) => x[1] !== dom) : pool;
  let b = pool2[Math.floor(rnd() * pool2.length)]; if (b[0] === a[0]) b = pool2[(pool2.indexOf(b) + 1) % pool2.length];
  big.push(row(1000 + i, a[0], "internal", b[0], "internal", dom, { carries_pii: rnd() < 0.2 ? "Y" : "N", migration_flag: rnd() < 0.3 ? "Y" : "N" }));
}
const bagg = aggregate(big);
const combos = [null, new Set(), new Set([DOMS[0]]), new Set([DOMS[0], DOMS[2]]), new Set([DOMS[1], DOMS[3]]), new Set(DOMS)];
const problems = combos.map((e) => audit(layout(bagg, { perZone: 8, floor: autoFloor(bagg.links), expanded: e }))).flat();
ok(problems.length === 0, "dense estate, six open/closed combinations: no line crosses a box", problems.slice(0, 6));
const dl = layout(bagg, { perZone: 8, floor: autoFloor(bagg.links), expanded: null });
ok(dl.lines.length >= 40 && dl.lines.every((l) => l.d && typeof l.lx === "number"), "every drawn line has a path and a label point", dl.lines.length);
const sameGutter = dl.lines.filter((l) => l.pts.length >= 3);
ok(sameGutter.length > 0 && new Set(sameGutter.map((l) => l.pts[1].y.toFixed(1) + "/" + l.pts[1].x.toFixed(1))).size === sameGutter.length, "lines sharing a gutter take distinct lanes");

console.log("-- the landing renders with counted flows and an invitation");
const lhtml = renderToStaticMarkup(<EcosystemView t={tLight} rows={rows} />);
ok(/zone-to-zone flows/.test(lhtml) && /click a zone to open it/.test(lhtml), "the header says it is the landing");
ok(/Open zone ▸/.test(lhtml) && /Busiest systems/.test(lhtml) && />8<\/div><div[^>]*>internal interfaces</.test(lhtml) && />9<\/div><div[^>]*>systems</.test(lhtml),
   "zone cards carry the hero count, a busiest-systems preview and an open affordance");
ok(/PB Data Warehouse/.test(lhtml) && /<ellipse /.test(lhtml) && !/>Tiny E</.test(lhtml.split("Busiest systems")[1] || ""), "the preview lists the busiest five, a store with its cylinder glyph", lhtml.match(/Busiest systems[\s\S]{0,400}/)?.[0]);
ok(/Zone-to-zone flow/.test(lhtml) && /open both ▸/.test(lhtml) && /Private Banking <span[^>]*>→<\/span> Investment Management/.test(lhtml), "the ledger lists each flow with a way to open both ends");
ok(!/systems per zone/.test(lhtml) && !/draw links with/.test(lhtml), "the system-level controls are hidden on the landing");
ok(/<path d="M [\d.]+ 0 C [\d.]+ [\d.]+, [\d.]+ [\d.]+, [\d.]+ 0" fill="none"/.test(lhtml) && /<rect x="[\d.]+" y="[\d.]+" width="[\d.]+" height="18" rx="9"/.test(lhtml), "flows are arcs between the cards with a count label");
const single = renderToStaticMarkup(<EcosystemView t={tLight} rows={rows.filter((r) => r.domain === "Private Banking")} />);
ok(!/zone-to-zone flows/.test(single) && /systems per zone/.test(single), "with one zone there is nothing to land on: straight to the system map");

console.log(bad ? `\n${bad} assertion(s) failed (landing)` : "\ninterface-ecosystem landing assertions pass");
if (bad) process.exit(1);
