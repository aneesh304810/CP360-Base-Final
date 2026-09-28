import { buildFlowModel, resolveFocus } from "../src/CrosswalkFlow.jsx";

const flow = {
  left: [
    { src: "Account", mid: "STARACCT", verdict: "UNKNOWN", n: 6 },
    { src: "Account", mid: "STARACCT", verdict: "NO_SOURCE", n: 3 },
    { src: "EOD Positions", mid: "STARPOS", verdict: "UNKNOWN", n: 4 },
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
const m = buildFlowModel(flow);
let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${msg}${cond ? "" : `  -> ${JSON.stringify(got)}`}`);
  if (!cond) bad++;
};

// --- nothing selected ---------------------------------------------------
ok(resolveFocus(m, null) === null, "no selection returns null");

// --- an L node: its links, plus one hop onward --------------------------
let f = resolveFocus(m, { kind: "node", id: "no SEI source", col: "L" });
ok(f.total === 29, "L node totals its own left links (20+9)", f.total);
ok(f.primary.size === 2, "L node: 2 primary ribbons", f.primary.size);
ok(f.nodes.has("TBMEIFI7") && f.nodes.has("ACDDIFI1") && f.nodes.has("PEDDIFI1"),
   "L node reaches the warehouse tables one hop on", [...f.nodes]);
ok(JSON.stringify(f.path.filter) === '{"sei_feed":"no SEI source"}',
   "L node drills by sei_feed", f.path.filter);
ok(f.verdicts.length === 1 && f.verdicts[0].k === "NO_SOURCE",
   "L node verdict split", f.verdicts);

// --- an M node: counted from the inbound side only, never doubled -------
f = resolveFocus(m, { kind: "node", id: "STARACCT", col: "M" });
ok(f.total === 29, "M node counts arrivals only (6+3+20), not 29+23", f.total);
ok(f.nodes.has("Account") && f.nodes.has("no SEI source") && f.nodes.has("TBMEIFI7"),
   "M node lights both sides", [...f.nodes]);
ok(JSON.stringify(f.path.filter) === '{"feed":"STARACCT"}', "M drills by feed", f.path.filter);
ok(f.verdicts.map((v) => v.k).join(",") === "NO_SOURCE,UNKNOWN",
   "M verdict split, biggest first", f.verdicts);

// --- an R node: counted from its inbound right links --------------------
f = resolveFocus(m, { kind: "node", id: "TBMEIFI7", col: "R" });
ok(f.total === 23, "R node totals its inbound", f.total);
ok(f.path.table === "TBMEIFI7", "R node offers the lineage jump", f.path);
ok(f.nodes.has("STARACCT"), "R node reaches its contract feed", [...f.nodes]);
ok(f.arcs.size === 1, "R node picks up the bypass arc landing on it", f.arcs.size);

// --- a single left ribbon ------------------------------------------------
const idx = m.ribbons.findIndex((r) => r.side === "left" && r.src === "Taxlot");
f = resolveFocus(m, { kind: "link", i: idx });
ok(f.total === 2, "one ribbon is its own count", f.total);
ok(JSON.stringify(f.path.filter)
   === '{"sei_feed":"Taxlot","feed":"STARPOS","verdict":"DECODE_NEEDED"}',
   "ribbon drills to exactly its columns", f.path.filter);
ok(f.primary.size === 1, "one primary", f.primary.size);
ok(f.onward.size === 2, "both onward links out of STARPOS", f.onward.size);
ok(!f.onward.has(idx), "the selection is not also onward", [...f.onward]);

// --- the bypass arc -------------------------------------------------------
f = resolveFocus(m, { kind: "arc", i: 0 });
ok(f.total === 2, "arc count", f.total);
ok(f.path.kind === "bypass", "arc is labelled a bypass", f.path);
ok(JSON.stringify(f.path.filter) === '{"sei_feed":"Account","table":"TBMEIFI7"}',
   "arc drills source + table", f.path.filter);

// --- nothing is ever both primary and dimmed ------------------------------
[["node","STARPOS","M"],["node","Account","L"],["node","ACDDIFI1","R"]].forEach(([k,id,col])=>{
  const g = resolveFocus(m, { kind: k, id, col });
  const overlap = [...g.primary].filter((i) => g.onward.has(i));
  ok(overlap.length === 0, `${id}: primary and onward are disjoint`, overlap);
  const missing = [...g.primary].filter((i) =>
    !g.nodes.has(m.ribbons[i].from) || !g.nodes.has(m.ribbons[i].to));
  ok(missing.length === 0, `${id}: every primary ribbon's nodes are lit`, missing);
});

// --- out of range selections do not throw --------------------------------
ok(resolveFocus(m, { kind: "link", i: 999 }) === null, "bad link index -> null");
ok(resolveFocus(m, { kind: "arc", i: 999 }) === null, "bad arc index -> null");
ok(resolveFocus(null, { kind: "node", id: "x", col: "L" }) === null, "no model -> null");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nall selection assertions pass");
