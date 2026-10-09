// The ribbon's second vocabulary: the mapping documents' candidate paths
// drawn on the same diagram as the proposals, in link classes and paths
// instead of verdicts and columns. Nothing about the drawing changes but
// the words and colours, and the default is byte-for-byte what it was.
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { tLight } from "../src/bbhTheme.js";
import { FlowDiagram, buildFlowModel, DEFAULT_VOCAB } from "../src/CrosswalkFlow.jsx";
import { CANDIDATE_VOCAB, LINK_INFO, VERDICT, mappingDocs } from "../src/seiCrosswalkApi.js";

let bad = 0;
const ok = (c, m, got) => { console.log(`${c ? "ok  " : "FAIL"} ${m}${c ? "" : `  -> ${String(got).slice(0, 240)}`}`); if (!c) bad++; };
function findSrc() {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    for (const rel of ["src", path.join("ui", "src")]) {
      const p = path.join(dir, rel);
      if (fs.existsSync(path.join(p, "CrosswalkDashboard.jsx"))) return p;
    }
    dir = path.dirname(dir);
  }
  throw new Error("src not found");
}
const SRC = findSrc();

const cand = {
  left: [
    { src: "Taxlot", mid: "PEDDIFI1", verdict: "E2E", n: 20 },
    { src: "no SEI source", mid: "PEDDIFI1", verdict: "NO_SEI_SOURCE", n: 87 },
    { src: "no SEI source", mid: "PEDDIFI1", verdict: "STAR_NOT_IN_FILE_MAP", n: 1 },
    { src: "no SEI source", mid: "ACDDIFI1", verdict: "NO_SEI_SOURCE", n: 172 },
  ],
  right: [{ mid: "PEDDIFI1", tgt: "HOLDINGDBO.POSITION", n: 108 }, { mid: "ACDDIFI1", tgt: "RULESDBO.ENTITY", n: 172 }],
  bypass: [{ src: "Account", tgt: "HOLDINGDBO.POSITION", n: 30 }],
};
const proposed = {
  left: [{ src: "Taxlot", mid: "PEDDIFI1", verdict: "UNKNOWN", n: 18 }, { src: "no SEI source", mid: "PEDDIFI1", verdict: "NO_SOURCE", n: 24 }],
  right: [{ mid: "PEDDIFI1", tgt: "HOLDINGDBO.LOT_LEVEL_POSITION", n: 42 }],
  bypass: [],
};

console.log("-- the model speaks the vocabulary it is given");
const mc = buildFlowModel(cand, { vocab: CANDIDATE_VOCAB });
const bands = mc.ribbons.filter((r) => r.side === "left");
ok(bands.length === 4 && bands[0].verdict === "E2E" && bands[0].c === LINK_INFO.E2E.c, "left bands stack in link-class order, coloured by link class", bands.map((b) => [b.verdict, b.c]));
ok(bands.find((b) => b.verdict === "NO_SEI_SOURCE").c === LINK_INFO.NO_SEI_SOURCE.c && /87 paths/.test(bands.find((b) => b.verdict === "NO_SEI_SOURCE" && b.n === 87).title), "a band's title counts paths, not columns");
ok(mc.bypassN === 30 && mc.arcs.length === 1 && /SEI straight to IMDS/.test(mc.arcs[0].title), "SEI-direct paths are the dashed bypass arc, named as such", mc.arcs[0]?.title);
ok(mc.nodes.find((n) => n.id === "no SEI source").c === LINK_INFO.NO_SEI_SOURCE.c, "the no-SEI-source node takes the vocabulary's gap colour");
ok(mc.verdicts.map((v) => v.k).join("|") === "E2E|STAR_NOT_IN_FILE_MAP|NO_SEI_SOURCE", "the legend lists the link classes present, in order", mc.verdicts.map((v) => v.k));

const mp = buildFlowModel(proposed);
ok(mp.ribbons[0].c === VERDICT.UNKNOWN.c && /18 columns/.test(mp.ribbons[0].title) && mp.nodes.find((n) => n.id === "no SEI source").c === VERDICT.NO_SOURCE.c,
   "without a vocabulary the model is the verdict one, in columns, as before", mp.ribbons[0].title);
ok(DEFAULT_VOCAB.info === VERDICT && DEFAULT_VOCAB.unit === "columns" && CANDIDATE_VOCAB.unit === "paths" && CANDIDATE_VOCAB.short("E2E").length > 20, "the two vocabularies");

console.log("-- the picture");
const html = renderToStaticMarkup(<FlowDiagram t={tLight} flow={cand} vocab={CANDIDATE_VOCAB} />);
ok(/linked end to end — 20 of 280/.test(html) && /no SEI source — 259 of 280/.test(html), "the legend counts paths per link class", html.match(/— \d+ of \d+/g));
ok(/SEI straight to IMDS, no STAR field \(dashed\) — 30/.test(html), "the bypass legend names what the dashed arc is here");
ok(/20 paths/.test(html) && !/20 columns/.test(html), "the ribbons' tooltips count paths", html.match(/\d+ paths|\d+ columns/g)?.slice(0, 3));
const def = renderToStaticMarkup(<FlowDiagram t={tLight} flow={proposed} />);
ok(/UNKNOWN — 18 of 42/.test(def) && /18 columns/.test(def) && !/paths/.test(def), "the default drawing is unchanged: verdicts, in columns");

console.log("-- wired in");
const dash = fs.readFileSync(path.join(SRC, "CrosswalkDashboard.jsx"), "utf8");
ok(/mappingDocs\.flowCandidates\(ds\)/.test(dash) && /vocab=\{CANDIDATE_VOCAB\}/.test(dash), "the dashboard fetches the candidate flow and hands the ribbon its vocabulary");
ok(/Proposed · with verdicts/.test(dash) && /Mapping documents · candidates \(draft\)/.test(dash) && /hasCand &&/.test(dash), "a toggle, shown only when candidates are loaded");
ok(typeof mappingDocs.flowCandidates === "function", "the client call exists");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nflow-candidates assertions pass");
if (bad) process.exit(1);
