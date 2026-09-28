import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FlowDiagram, EvidencePanel, Waffle } from "../src/CrosswalkFlow.jsx";

const t = { panel: "#fff", panel2: "#dfe6e9", navy: "#10193b", sub: "#666", muted: "#999" };

const flow = {
  left: [
    { src: "Account", mid: "STARACCT", verdict: "UNKNOWN", n: 6 },
    { src: "Account", mid: "STARACCT", verdict: "NO_SOURCE", n: 3 },
    { src: "End of Day Positions", mid: "STARPOS", verdict: "UNKNOWN", n: 4 },
    { src: "Taxlot", mid: "STARPOS", verdict: "DECODE_NEEDED", n: 2 },
    { src: "no SEI source", mid: "STARACCT", verdict: "NO_SOURCE", n: 20 },
    { src: "no SEI source", mid: "STARPOS", verdict: "NO_SOURCE", n: 9 },
  ],
  right: [
    { mid: "STARACCT", tgt: "TBMEIFI7", n: 23 },
    { mid: "STARPOS", tgt: "ACDDIFI1", n: 14 },
    { mid: "STARPOS", tgt: "PEDDIFI1", n: 7 },
  ],
  bypass: [{ src: "Account", tgt: "TBMEIFI7", n: 2 }],
};

const ev = {
  headline: "Both sides of a match need schema evidence. 5 of 5 are short.",
  rows: [
    { key: "target", label: "Warehouse target", have: 0, of: 66, pct: 0, unit: "columns",
      state: "none", detail: "Target types come from document.", clears: "ALL_TAB_COLUMNS." },
    { key: "sei", label: "SEI datapoint", have: 3, of: 53, pct: 6, unit: "datapoints",
      state: "partial", detail: "7 SEI feeds are mapped.", clears: "A typed spec." },
  ],
};

const waffle = {
  cells: 29, table_count: 2,
  tables: [
    { table: "BBH_STAR_NAV_TB", lane: "STAR",
      cells: "nudnnnunuuuunnnnnnunnnn".split("").map((ch, i) => ({
        c: `COL_${i}`, v: { n: "NO_SOURCE", u: "UNKNOWN", d: "DECODE_NEEDED" }[ch] })) },
    { table: "RULESDBO.ENTITY", lane: "UAF",
      cells: [..."oooooo"].map((_, i) => ({ c: `E${i}`, v: "OUT_OF_SCOPE" })) },
  ],
};

function check(name, el) {
  const html = renderToStaticMarkup(el);
  const bad = [];
  if (/NaN/.test(html)) bad.push("NaN in output");
  if (/undefined/.test(html)) bad.push("literal 'undefined' in output");
  if (/Infinity/.test(html)) bad.push("Infinity in output");
  console.log(`${bad.length ? "FAIL" : "ok  "} ${name}  (${html.length} bytes)`
    + (bad.length ? "  -> " + bad.join("; ") : ""));
  return html;
}

const h1 = check("FlowDiagram", <FlowDiagram t={t} flow={flow} onPickVerdict={() => {}} />);
check("FlowDiagram (empty)", <FlowDiagram t={t} flow={{ left: [], right: [], bypass: [] }} />);
check("EvidencePanel", <EvidencePanel t={t} ev={ev} />);
check("Waffle", <Waffle t={t} waffle={waffle} onPickColumn={() => {}} />);

// geometry sanity: y coordinates only (a path is "M x y C x y, x y, x y"),
// plus the top and bottom edge of every node box, against the canvas.
const svgH = Number((h1.match(/<svg[^>]*height="(\d+(?:\.\d+)?)"/) || [])[1]);
// each path with its OWN stroke-width — a ribbon's edges are its centreline
// plus and minus half of its own width, not half of the widest one
const strokes = [...h1.matchAll(/ d="([^"]+)" stroke="[^"]*" stroke-width="([\d.]+)"/g)]
  .map((m) => [m[1], Number(m[2])]);
const ys = [];
strokes.forEach(([d, w]) => {
  const n = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  for (let i = 1; i < n.length; i += 2) { ys.push(n[i] - w / 2); ys.push(n[i] + w / 2); }
});
const boxes = [...h1.matchAll(/<rect[^>]*y="([\d.]+)"[^>]*height="([\d.]+)"/g)]
  .map((m) => [Number(m[1]), Number(m[2])]);
boxes.forEach(([y, h]) => { ys.push(y); ys.push(y + h); });
const widths = strokes.map((s) => s[1]);
const lo = Math.min(...ys), hi = Math.max(...ys);
console.log(`     ribbons=${strokes.length} svgH=${svgH.toFixed(0)} `
  + `edges y=[${lo.toFixed(0)}..${hi.toFixed(0)}] `
  + `strokew=[${Math.min(...widths).toFixed(1)}..${Math.max(...widths).toFixed(1)}] `
  + `boxh=[${Math.min(...boxes.map((b) => b[1])).toFixed(0)}..`
  + `${Math.max(...boxes.map((b) => b[1])).toFixed(0)}]`);
console.log(`     ${lo >= -1 && hi <= svgH + 1
  ? "ok   every ribbon edge and box inside the canvas"
  : `FAIL geometry spills: needs ${lo.toFixed(0)}..${hi.toFixed(0)}`}`);

// who spills
strokes.forEach(([d, w]) => {
  const n = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  const yy = n.filter((_, i) => i % 2 === 1);
  const bot = Math.max(...yy) + w / 2, topE = Math.min(...yy) - w / 2;
  if (bot > svgH + 1 || topE < -1)
    console.log(`       spill w=${w.toFixed(1)} y=${yy.map((v)=>v.toFixed(0)).join(",")} -> ${topE.toFixed(0)}..${bot.toFixed(0)}`);
});
boxes.forEach(([y, h]) => { if (y + h > svgH + 1) console.log(`       box spill y=${y.toFixed(0)} h=${h.toFixed(0)}`); });
