// Does this column have a transformation, and how much of one?
//
// The question the Source view could not answer. "Where it lands" gave a
// percentage mapped per table, which says how many columns arrive and
// nothing about what happens to them — and a column carried across
// untouched and a column assembled from a branch over two feeds are very
// different risks wearing the same badge.
//
// ONE CLASSIFIER, NOT TWO. The obvious shortcut is to match `trim` in the
// transform text here and be done. But the operator graph already parses
// these expressions properly, and a regex here would be a second opinion
// that drifts from it — the chip would say `trim` while the graph drew a
// branch. So this counts nodes in the graph the real parser produced.
// Slower by a rounding error, and it cannot disagree with the picture.
//
// STEPS ARE THE DENSITY SIGNAL. `trim(x)` and a five-line branch are both
// "transformed", and treating them alike wastes the one thing the screen
// can show at a glance. Steps is how many operations stand between the
// source field and the target column, so a table's worth of them adds up
// to an honest measure of how computed that table is.

import { buildRuleGraph, isNoRule } from "./ruleGraph.js";

const TRIMS = ["TRIM", "LTRIM", "RTRIM"];
const CASTS = ["TO_NUMBER", "TO_DATE", "TO_CHAR", "CAST"];
const DECODES = ["DECODE", "CASE", "NVL2"];

export const OP_ORDER = ["direct", "trim", "cast", "decode", "derived",
                         "constant", "unmapped"];

export const OP_META = {
  direct:   { c: "#7b8894", label: "direct",
              note: "Carried across untouched." },
  trim:     { c: "#00a3a3", label: "trim",
              note: "Padding removed. Length can change; the value does not." },
  cast:     { c: "#0091bf", label: "cast",
              note: "Converted to another type. A value that will not convert "
                  + "is the failure to look for." },
  decode:   { c: "#7c3aed", label: "decode",
              note: "A coded value translated. Needs a complete code set or it "
                  + "produces a valid-looking wrong value." },
  derived:  { c: "#e67e22", label: "derived",
              note: "Computed. The rule is the risk, not the type." },
  constant: { c: "#b45309", label: "constant",
              note: "No source column — the value is produced rather than "
                  + "carried. Legitimate, but it should be a decision on the "
                  + "record rather than a default nobody chose." },
  unmapped: { c: "#c1113a", label: "no source",
              note: "Nothing feeds this column." },
};

/** The rule text for a link: the registered transformation where the
 *  transformation layer has one, else the hops joined in order. The
 *  registered rule is richer and is what the comparison sheet compares. */
export function linkRule(link) {
  if (!link) return "";
  if (link.logic && !isNoRule(link.logic)) return String(link.logic);
  return [link.t1, link.t2, link.t3]
    .filter((x) => x && !isNoRule(x) && !/not applicable/i.test(x))
    .join("\n");
}

/** Classify one source-column → target-column link. */
export function classifyLink(link) {
  const rule = linkRule(link);
  const hasSrc = Boolean(link && link.src && String(link.src).trim());
  const status = String((link && link.status) || "").toUpperCase();

  if (!hasSrc && (status === "UNMAPPED" || !rule)) {
    return { op: hasSrc ? "direct" : (rule ? "constant" : "unmapped"),
             steps: 0, transformed: Boolean(rule), rule,
             hasBranch: false, hasJoin: false, fields: [] };
  }
  if (!rule) {
    return { op: "direct", steps: 0, transformed: false, rule: "",
             hasBranch: false, hasJoin: false,
             fields: hasSrc ? [link.src] : [] };
  }

  const g = buildRuleGraph(rule, { target: (link && link.col) || "target" });
  const kinds = g.nodes.map((n) => n.kind);
  const fns = g.nodes.filter((n) => n.kind === "fn" && !n.local)
    .map((n) => String(n.lab).replace(/\s*\(.*$/, "").toUpperCase());
  const hasBranch = kinds.includes("branch");
  const hasJoin = kinds.includes("join");
  const steps = g.nodes.filter((n) =>
    ["fn", "branch", "join", "agg"].includes(n.kind) && !n.local).length;

  let op;
  if (!hasSrc) op = "constant";
  else if (hasBranch || hasJoin) op = "derived";
  else if (fns.some((f) => DECODES.includes(f))) op = "decode";
  else if (fns.length && fns.every((f) => TRIMS.includes(f))) op = "trim";
  else if (fns.length && fns.every((f) => TRIMS.includes(f) || CASTS.includes(f)
           || f === "NVL" || f === "COALESCE")
           && fns.some((f) => CASTS.includes(f))) op = "cast";
  else if (fns.length && fns.every((f) => f === "NVL" || f === "COALESCE")) op = "cast";
  else if (steps === 0) op = "direct";
  else op = "derived";

  return { op, steps, transformed: op !== "direct" && op !== "unmapped",
           rule, hasBranch, hasJoin,
           fields: g.nodes.filter((n) => n.kind === "field").map((n) => n.lab) };
}

/** Roll a table's links up into the mix that its meter draws.
 *
 *  A stacked proportion, not an average: "eleven of nineteen columns are
 *  computed" is a fact, and a mean number of steps is a number nobody can
 *  act on. */
export function summarise(links) {
  const by = {};
  let steps = 0, transformed = 0, branchy = 0;
  (links || []).forEach((l) => {
    const c = l.__op || classifyLink(l);
    by[c.op] = (by[c.op] || 0) + 1;
    steps += c.steps;
    if (c.transformed) transformed++;
    if (c.hasBranch || c.hasJoin) branchy++;
  });
  const total = (links || []).length;
  return {
    total, transformed, branchy, steps,
    direct: total - transformed,
    mix: OP_ORDER.filter((k) => by[k]).map((k) => ({ op: k, n: by[k] })),
    pct: total ? Math.round((transformed / total) * 100) : 0,
  };
}

export default classifyLink;
