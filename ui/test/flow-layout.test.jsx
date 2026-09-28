// Layout: does the diagram use the width it is given, fit the height it is
// given, and is the uncrossing pass actually worth running?
//
// The last one matters most. Barycentre ordering is easy to write and easy
// to get subtly wrong — a sweep that reads the wrong side of an edge still
// produces a plausible-looking order, just not a better one. So the test
// counts real crossings against size order rather than asserting the code
// ran.

import { buildFlowModel } from "../src/CrosswalkFlow.jsx";

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${msg}${cond ? "" : `  -> ${JSON.stringify(got)}`}`);
  if (!cond) bad++;
};

// Shaped like the real IMDS load: eight sources, three contract feeds,
// seven warehouse tables, one very large "no SEI source" node.
const flow = {
  left: [
    { src: "no SEI source", mid: "PEDDIFI1", verdict: "NO_SOURCE", n: 30 },
    { src: "no SEI source", mid: "TBMEIFI7", verdict: "NO_SOURCE", n: 18 },
    { src: "no SEI source", mid: "unmapped", verdict: "NO_SOURCE", n: 10 },
    { src: "Taxlot", mid: "PEDDIFI1", verdict: "UNKNOWN", n: 10 },
    { src: "Taxlot", mid: "PEDDIFI1", verdict: "NOT_COMPARABLE", n: 8 },
    { src: "End of Day Positions", mid: "PEDDIFI1", verdict: "UNKNOWN", n: 12 },
    { src: "End of Day Positions", mid: "TBMEIFI7", verdict: "DECODE_NEEDED", n: 5 },
    { src: "Account", mid: "TBMEIFI7", verdict: "UNKNOWN", n: 9 },
    { src: "Transaction Header", mid: "unmapped", verdict: "UNKNOWN", n: 3 },
    { src: "Custody And Nostro", mid: "unmapped", verdict: "UNKNOWN", n: 2 },
    { src: "Asset", mid: "TBMEIFI7", verdict: "UNKNOWN", n: 1 },
  ],
  right: [
    { mid: "PEDDIFI1", tgt: "HOLDINGDBO.LOT_LEVEL_HIST", n: 28 },
    { mid: "PEDDIFI1", tgt: "HOLDINGDBO.POSITION_HIST", n: 24 },
    { mid: "TBMEIFI7", tgt: "BBHRPTDBO.BBH_STAR_NAV_TB", n: 23 },
    { mid: "unmapped", tgt: "HOLDINGDBO.POSITION_SUMMARY", n: 14 },
    { mid: "unmapped", tgt: "RULESDBO.ENTITY_HIST", n: 5 },
    { mid: "unmapped", tgt: "RULESDBO.ENTITY", n: 5 },
    { mid: "PEDDIFI1", tgt: "HOLDINGDBO.POSITION_TAX", n: 5 },
  ],
  bypass: [],
};

// ---- crossings ----------------------------------------------------------
// Two links cross when their endpoints are in opposite order on the two
// sides. Weight by the thinner ribbon: a hairline crossing a hairline is
// not the problem a 30-column band crossing a 28-column band is.
function crossings(model, side) {
  const pos = new Map(model.nodes.map((n) => [`${n.col}:${n.id}`, n.y]));
  const es = model.ribbons.filter((r) => r.side === side).map((r) => ({
    a: pos.get(side === "left" ? `L:${r.src}` : `M:${r.mid}`),
    b: pos.get(side === "left" ? `M:${r.mid}` : `R:${r.tgt}`),
    w: r.n }));
  let n = 0;
  for (let i = 0; i < es.length; i++)
    for (let j = i + 1; j < es.length; j++) {
      const p = es[i], q = es[j];
      if ((p.a - q.a) * (p.b - q.b) < 0) n += Math.min(p.w, q.w);
    }
  return n;
}

// Size order is what the code did before: every column sorted by count
// descending, independently. Rebuild that by feeding the model a topology
// whose ordering pass cannot improve on — simpler to just compare against
// the documented previous behaviour, reconstructed here.
function sizeOrderCrossings(model, flowData, side) {
  const tot = new Map();
  const add = (k, v) => tot.set(k, (tot.get(k) || 0) + v);
  flowData.left.forEach((r) => { add(`L:${r.src}`, r.n); add(`M:${r.mid}`, r.n); });
  flowData.right.forEach((r) => { add(`R:${r.tgt}`, r.n); });
  const rank = (col) => {
    const ids = model.nodes.filter((n) => n.col === col)
      .map((n) => n.id)
      .sort((a, b) => (tot.get(`${col}:${b}`) || 0) - (tot.get(`${col}:${a}`) || 0));
    return new Map(ids.map((id, i) => [id, i]));
  };
  const rL = rank("L"), rM = rank("M"), rR = rank("R");
  const es = model.ribbons.filter((r) => r.side === side).map((r) => ({
    a: side === "left" ? rL.get(r.src) : rM.get(r.mid),
    b: side === "left" ? rM.get(r.mid) : rR.get(r.tgt),
    w: r.n }));
  let n = 0;
  for (let i = 0; i < es.length; i++)
    for (let j = i + 1; j < es.length; j++) {
      const p = es[i], q = es[j];
      if ((p.a - q.a) * (p.b - q.b) < 0) n += Math.min(p.w, q.w);
    }
  return n;
}

const m = buildFlowModel(flow);
const before = sizeOrderCrossings(m, flow, "left") + sizeOrderCrossings(m, flow, "right");
const after = crossings(m, "left") + crossings(m, "right");
console.log(`     weighted crossings: size order ${before} -> uncrossed ${after}`);
ok(after < before, "the uncrossing pass reduces weighted crossings", { before, after });
ok(after <= before * 0.75, "and by a worthwhile margin (>=25%)", { before, after });

// deterministic — the picture must not reshuffle between loads
const m2 = buildFlowModel(flow);
ok(JSON.stringify(m.nodes.map((n) => n.id)) === JSON.stringify(m2.nodes.map((n) => n.id)),
   "ordering is deterministic");

// ---- width --------------------------------------------------------------
const narrow = buildFlowModel(flow, { width: 760 });
const wide = buildFlowModel(flow, { width: 1900 });
ok(wide.W === 1900, "canvas takes the width it is given", wide.W);
ok(wide.CW > narrow.CW, "node box grows with the canvas", [narrow.CW, wide.CW]);
ok(wide.CW <= 260, "but is capped", wide.CW);
const longest = "HOLDINGDBO.POSITION_SUMMARY";
const nNarrow = narrow.nodes.find((n) => n.id === longest);
const nWide = wide.nodes.find((n) => n.id === longest);
ok(nNarrow.short.endsWith("…"), "long name truncates in a narrow box", nNarrow.short);
ok(nWide.short === longest, "and fits whole in a wide one", nWide.short);
ok(buildFlowModel(flow, { width: 200 }).W >= 720, "a silly width floors, not breaks");

// ---- height -------------------------------------------------------------
[420, 700, 1100].forEach((h) => {
  const mh = buildFlowModel(flow, { width: 1600, height: h });
  ok(mh.H <= h + 1, `height ${h}: canvas fits`, mh.H);
  ok(mh.H >= h - 60, `height ${h}: and actually fills it`, mh.H);
  const spill = mh.nodes.filter((n) => n.y < 0 || n.y + n.h > mh.H + 1);
  ok(spill.length === 0, `height ${h}: no node outside the canvas`, spill.map((n) => n.id));
  const rib = mh.ribbons.filter((r) => {
    const ys = (r.d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number).filter((_, i) => i % 2 === 1);
    return Math.min(...ys) - r.w / 2 < -1 || Math.max(...ys) + r.w / 2 > mh.H + 1;
  });
  ok(rib.length === 0, `height ${h}: no ribbon outside the canvas`, rib.length);
});

console.log(bad ? `\n${bad} assertion(s) failed` : "\nall layout assertions pass");
