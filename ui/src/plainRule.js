// The transformation, in words a business audience can act on.
//
// The Technical view draws the rule as an operator graph and the Source
// view chips it as `cast` or `decode`. Both are right and neither is
// readable by the person who owns the data. `to_date(BLOCK_DT,'MM/DD/YYYY')`
// tells a developer what happens; it tells an operations lead nothing, and
// the thing they most need to know — that a file written day-first would be
// silently wrong for eleven days of every month — is not in it at all.
//
// ONE PARSE, A THIRD RENDERING. This reads the same graph buildRuleGraph
// produces, for the same reason linkOps.js does: a regex here would be a
// second opinion that drifts, and the sentence would say "trim" while the
// graph drew a branch. Slower by a rounding error, and it cannot disagree
// with the picture.
//
// THE WATCH NOTE IS THE POINT. What a step does is half of it. What it
// costs when the input is not what the rule assumed is the half a business
// reader can act on, and it is the half no expression contains. Each note
// below is a real failure mode of that operation, written as a consequence
// rather than as a caution.

import { buildRuleGraph, isNoRule } from "./ruleGraph.js";

export const STEP_META = {
  direct:   { c: "#7b8894", label: "Copied as-is" },
  trim:     { c: "#00a3a3", label: "Tidied" },
  cast:     { c: "#0091bf", label: "Stored as" },
  decode:   { c: "#7c3aed", label: "Translated" },
  derived:  { c: "#e67e22", label: "Calculated" },
  lookup:   { c: "#7c3aed", label: "Looked up" },
  constant: { c: "#b45309", label: "Set by the system" },
  none:     { c: "#c1113a", label: "Not supplied" },
};

const FN = (n) => String(n.lab || "").replace(/\s*\(.*$/, "").toUpperCase();
const argOf = (g, id) => g.edges.filter(([, to]) => to === id)
  .map(([from]) => g.nodes.find((n) => n.id === from)).filter(Boolean);
const constsOf = (g, id) => argOf(g, id).filter((n) => n.kind === "const")
  .map((n) => String(n.lab).replace(/^'|'$/g, ""));

// One sentence per function, plus what it costs when the input surprises it.
function fnStep(g, node) {
  const f = FN(node);
  const k = constsOf(g, node.id);

  if (f === "TRIM" || f === "LTRIM" || f === "RTRIM") {
    return { op: "trim", what: "Spaces before and after the value are removed.",
             watch: null };
  }
  if (f === "SUBSTR" || f === "SUBSTRING") {
    const n = k.filter((x) => /^\d+$/.test(x));
    const len = n.length >= 2 ? n[1] : n[0];
    return { op: "cast",
             what: len ? `Only the first ${len} characters are kept.`
                       : "Only part of the value is kept.",
             watch: len ? `A value longer than ${len} characters is cut short, and `
                        + "the cut version is what every report downstream shows."
                        : "A longer value is cut short without warning." };
  }
  if (f === "NVL" || f === "COALESCE" || f === "ISNULL") {
    const d = k[0];
    return { op: "cast",
             what: d !== undefined
               ? `If the file supplies nothing, ${d} is used instead.`
               : "If the file supplies nothing, a default is used instead.",
             watch: d === "0"
               ? "A blank and a genuine zero cannot be told apart once in the "
               + "warehouse. A report counting or averaging this treats a "
               + "missing value as a real zero."
               : "A supplied value and a defaulted one look the same downstream." };
  }
  if (f === "TO_DATE") {
    const fmt = k.find((x) => /[DMY]/i.test(x) && x.length >= 6);
    const us = fmt && /^MM/i.test(fmt);
    return { op: "cast",
             what: fmt ? `The date is read in ${us ? "US order — month, then day, "
                          + "then year" : `the pattern ${fmt}`}.`
                       : "The text is read as a date.",
             watch: us
               ? "If a file is ever written day-first, 03/04 is read as 4 March "
               + "instead of 3 April. Nothing fails; the date is simply wrong "
               + "for eleven days of every month."
               : "A value that does not match the pattern stops the load, or "
               + "lands as an empty date." };
  }
  if (f === "TO_NUMBER") {
    return { op: "cast",
             what: "The value is stored as a number rather than as text, so it "
                 + "sorts and totals correctly.",
             watch: "A value that is not a number — a blank, a dash, a comma — "
                  + "will not convert. That is the failure to look for." };
  }
  if (f === "TO_CHAR") {
    return { op: "cast", what: "The value is stored as text.",
             watch: "Stored as text it no longer sorts or totals as a number." };
  }
  if (f === "UPPER" || f === "LOWER" || f === "INITCAP") {
    return { op: "trim",
             what: `The value is changed to ${f === "UPPER" ? "upper" :
                    f === "LOWER" ? "lower" : "title"} case.`,
             watch: null };
  }
  if (f === "DECODE" || f === "CASE" || f === "NVL2") {
    const pairs = k.length >= 2 ? `${k[0]} becomes ${k[1]}` : null;
    return { op: "decode",
             what: pairs ? `Codes are translated — ${pairs}, and anything not `
                         + "listed takes the default."
                         : "Coded values are translated to their meaning.",
             watch: "Only the codes in the list are recognised. A new code "
                  + "introduced upstream takes the default, so the value looks "
                  + "valid while being wrong." };
  }
  if (f === "ROUND" || f === "TRUNC") {
    const d = k.find((x) => /^\d+$/.test(x));
    return { op: "cast",
             what: d ? `The number is ${f === "ROUND" ? "rounded" : "cut"} to `
                     + `${d} decimal place${d === "1" ? "" : "s"}.`
                     : `The number is ${f === "ROUND" ? "rounded" : "cut"}.`,
             watch: "Totals taken after this will not always match totals taken "
                  + "before it." };
  }
  if (f === "CONCAT" || node.lab === "||") {
    return { op: "derived", what: "Several values are joined into one.",
             watch: "If one part is missing the joined value is still produced, "
                  + "just shorter — which is hard to spot in a report." };
  }
  return { op: "derived", what: `The value is put through ${node.lab}.`,
           watch: null };
}

/** Rule text -> ordered plain-English steps.
 *
 *  `{ steps, op, hasBranch, hasJoin, fields }`. `steps` is never empty: a
 *  column with no rule gets the "copied as-is" sentence, because a business
 *  reader asking what happens to a figure deserves an answer either way. */
export function explainRule(rule, { hasSource = true, target = "target" } = {}) {
  const text = String(rule || "");
  if (!hasSource) {
    return { steps: [{ op: "none",
      what: "Nothing in the source feeds this column — the value is produced "
          + "by the warehouse itself, or left empty.",
      watch: "A value nobody supplied should be a decision on the record, not "
           + "a default nobody chose." }], op: "none", hasBranch: false,
      hasJoin: false, fields: [] };
  }
  if (!text || isNoRule(text)) {
    return { steps: [{ op: "direct",
      what: "Carried across exactly as it arrives. Nothing is changed on the "
          + "way.", watch: null }], op: "direct", hasBranch: false,
      hasJoin: false, fields: [] };
  }

  const g = buildRuleGraph(text, { target });
  const steps = [];
  let hasBranch = false, hasJoin = false;

  g.nodes.forEach((n) => {
    if (n.local) return;
    if (n.kind === "branch") {
      hasBranch = true;
      steps.push({ op: "derived",
        what: `The value depends on a condition (${n.lab}): one figure is used `
            + "when it holds and a different one when it does not.",
        watch: "Two different business meanings share one warehouse column. A "
             + "report that does not repeat the condition will mix them." });
    } else if (n.kind === "join") {
      hasJoin = true;
      steps.push({ op: "lookup",
        what: `The value is looked up elsewhere (${n.lab}).`,
        watch: "A row with no match produces no value at all, so the column is "
             + "empty rather than wrong — easy to miss in a count." });
    } else if (n.kind === "fn") {
      steps.push(fnStep(g, n));
    } else if (n.kind === "agg") {
      steps.push({ op: "derived",
        what: `Several rows are combined into one (${n.lab}).`,
        watch: "The warehouse holds the total, not the rows behind it." });
    }
  });

  if (!steps.length) {
    steps.push({ op: "direct",
      what: "Carried across exactly as it arrives. Nothing is changed on the "
          + "way.", watch: null });
  }
  // Collapse the repetition an expression produces naturally — ltrim(rtrim(x))
  // is two nodes and one sentence, and printing it twice reads as a mistake.
  const seen = new Set();
  const out = steps.filter((s) => {
    if (seen.has(s.what)) return false;
    seen.add(s.what);
    return true;
  });

  const op = hasBranch || hasJoin ? "derived"
    : out.some((s) => s.op === "decode") ? "decode"
    : out.some((s) => s.op === "cast") ? "cast"
    : out.every((s) => s.op === "trim") && out.length ? "trim"
    : out.length > 1 ? "derived" : out[0].op;

  return { steps: out, op, hasBranch, hasJoin,
           fields: g.nodes.filter((n) => n.kind === "field").map((n) => n.lab) };
}

export default explainRule;
