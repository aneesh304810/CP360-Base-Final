// Reading a transformation rule as structure rather than as a string.
//
// WHAT THE REAL RULES LOOK LIKE. Not one-liners. The STAR side is
// procedural, multi-line, with branches:
//
//     v_Trade_Date_Cash := Base_Market_Value_10;
//     IF TRIM(Investment_Type_Code_42) != 'CASH' THEN
//       book_value := nvl(book_value,0) + to_number(nvl(Base_Amortized_Cost_7,0));
//     ELSE
//       book_value := nvl(book_value,0) + to_number(nvl(v_Trade_Date_Cash,0));
//
// and the SEI side is prose, pseudo-code and a join condition in one cell:
//
//     Pro-rate receivables based on Taxlot Qty.
//     If DEBIT_CREDIT_FLAG_6 = 'C'
//     (Taxlot_Qty/QUANTITY_HELD * VALUATION_ACCRUED_INTEREST)
//     Else ... *-1
//     Join Taxlot and End of day positions by Account, Portfolio, Instrument_id
//     where as_of_date=<processing_dt>
//
// WHY NOT A TEXT DIFF. Two rules written differently can compute the same
// value and two rules written similarly can compute different ones. A
// character diff of those two cells is pages of noise with the finding
// buried in it. What can be checked mechanically is STRUCTURE: which
// fields each side reads, what each branches on, whether either joins,
// whether nulls are handled. Every one of those is a fact, and where they
// differ it is a question worth asking a person.
//
// THE NUMERIC SUFFIX IS AN ORDINAL. Base_Market_Value_10 is field 10 of
// the STAR layout. That makes the token resolvable — STAR_LAYOUT_DETAIL
// carries ORDINAL and FIELD_NAME — so an expression stops being opaque
// and becomes navigable. Where the name AND the ordinal both match, the
// resolution is confirmed rather than guessed, and the UI says which.

const FUNCS = ["NVL", "NVL2", "TO_NUMBER", "TO_DATE", "TO_CHAR", "TRIM",
  "LTRIM", "RTRIM", "SUBSTR", "COALESCE", "DECODE", "CASE", "SUM", "MAX",
  "MIN", "ROUND", "ABS", "GREATEST", "LEAST", "INSTR", "REPLACE"];

// A literal "Null" in these cells means no mapping, not a null value. It
// is the single most common entry on the SEI side and rendering it as the
// word Null reads as "the rule is to write null", which is a different
// and much more confident claim than "nobody has written a rule".
const NULLISH = new Set(["", "NULL", "N/A", "NA", "NONE", "-", "TBD"]);

export function isNoRule(text) {
  return NULLISH.has(String(text == null ? "" : text).trim().toUpperCase());
}

/** Identifier tokens, with the trailing ordinal split off where there is
 *  one. Keywords, function names and pure numbers are not tokens. */
export function ruleTokens(text) {
  const out = new Map();
  const skip = new Set([...FUNCS, "IF", "THEN", "ELSE", "ELSIF", "END", "AND",
    "OR", "NOT", "WHERE", "JOIN", "ON", "BY", "SELECT", "FROM", "IS", "IN",
    "THE", "USING", "WHEN", "ADDED", "FOR", "VALUE", "BASED", "SEE"]);
  const re = /\b([A-Za-z_][A-Za-z0-9_]*)\b/g;
  let m;
  while ((m = re.exec(String(text || ""))) !== null) {
    const raw = m[1];
    if (skip.has(raw.toUpperCase())) continue;
    if (/^\d+$/.test(raw)) continue;
    if (raw.length < 3) continue;
    const ord = /^(.*?)_(\d{1,4})$/.exec(raw);
    const key = raw.toUpperCase();
    if (!out.has(key)) {
      out.set(key, { raw,
        base: ord ? ord[1] : raw,
        ordinal: ord ? Number(ord[2]) : null,
        // a v_ prefix is a local variable in the STAR procedural style,
        // not a source field — counting it as an input would overstate
        // what the rule reads
        local: /^v_/i.test(raw) });
    }
  }
  return [...out.values()];
}

/** Everything structural about one rule. */
export function parseRule(text) {
  const raw = String(text == null ? "" : text);
  const empty = isNoRule(raw);
  const lines = raw.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim());

  const branches = [];
  const joins = [];
  lines.forEach((l) => {
    const b = /\b(?:IF|ELSIF)\b\s+(.+?)(?:\s+\bTHEN\b|$)/i.exec(l);
    if (b && b[1].trim()) branches.push(b[1].trim());
    if (/\bjoin(?:s|ing)?\b/i.test(l) || /\bwhere\b.*=/i.test(l)) joins.push(l.trim());
  });

  const up = raw.toUpperCase();
  const functions = FUNCS.filter((f) => new RegExp(`\\b${f}\\s*\\(`).test(up));
  const tokens = empty ? [] : ruleTokens(raw);

  return {
    empty, raw, lines, branches, joins, functions,
    tokens: tokens.filter((t) => !t.local),
    locals: tokens.filter((t) => t.local),
    // nvl/coalesce around a field is the rule saying what happens when it
    // is missing. Its ABSENCE on one side and presence on the other is a
    // real difference in behaviour, not a style preference.
    handlesNull: /\b(NVL|NVL2|COALESCE)\s*\(/i.test(raw),
    hasElse: /\bELSE\b/i.test(raw),
    lineCount: lines.length,
  };
}

/** What differs, structurally, between two rules. Every item is a fact
 *  that can be checked; none of them is a claim about equivalence. */
export function compareRules(legacyText, seiText) {
  const a = parseRule(legacyText);
  const b = parseRule(seiText);
  const findings = [];

  const names = (p) => new Set(p.tokens.map((t) => t.base.toUpperCase()));
  const A = names(a), B = names(b);

  if (a.empty && b.empty) {
    findings.push({ k: "both-empty", severity: "gap",
      text: "Neither side has a rule written down. Nothing to compare." });
  } else if (b.empty) {
    findings.push({ k: "sei-empty", severity: "gap",
      text: "No SEI rule is proposed. The legacy rule has no replacement." });
  } else if (a.empty) {
    findings.push({ k: "legacy-empty", severity: "gap",
      text: "The legacy rule is not documented, so there is no baseline to "
          + "compare the proposal against." });
  }

  if (!a.empty && !b.empty) {
    const onlyA = [...A].filter((x) => !B.has(x));
    const onlyB = [...B].filter((x) => !A.has(x));
    if (onlyA.length) findings.push({ k: "fields-dropped", severity: "check",
      text: `Read by the legacy rule and not by the proposal: ${onlyA.join(", ")}.`,
      items: onlyA });
    if (onlyB.length) findings.push({ k: "fields-added", severity: "check",
      text: `Read by the proposal and not by the legacy rule: ${onlyB.join(", ")}.`,
      items: onlyB });

    // Branching on different things is the difference most likely to
    // change a value while both rules look reasonable in isolation.
    if (a.branches.length && b.branches.length) {
      const ab = a.branches.join(" | ").toUpperCase();
      const bb = b.branches.join(" | ").toUpperCase();
      const shared = [...A].filter((x) => ab.includes(x) && bb.includes(x));
      if (!shared.length) findings.push({ k: "branch-differs", severity: "risk",
        text: `Both branch, on different things — legacy on `
            + `${a.branches.join("; ")}, the proposal on ${b.branches.join("; ")}.` });
    } else if (a.branches.length && !b.branches.length) {
      findings.push({ k: "branch-lost", severity: "risk",
        text: `The legacy rule branches (${a.branches.join("; ")}) and the `
            + "proposal does not. Either a case was dropped or it is handled "
            + "upstream — which, is the question." });
    } else if (!a.branches.length && b.branches.length) {
      findings.push({ k: "branch-added", severity: "check",
        text: `The proposal branches (${b.branches.join("; ")}) where the `
            + "legacy rule does not." });
    }

    if (a.handlesNull && !b.handlesNull) findings.push({
      k: "null-handling-lost", severity: "risk",
      text: "The legacy rule defaults nulls; the proposal does not say what "
          + "happens when an input is missing." });

    if (b.joins.length && !a.joins.length) findings.push({
      k: "join-added", severity: "risk",
      text: `The proposal needs a join the legacy rule does not: `
          + `${b.joins.join(" ")}. A join is a precondition — if it misses, `
          + "the value is wrong rather than absent." });

    if (a.lineCount > 1 && b.lineCount === 1 && !b.joins.length) findings.push({
      k: "shape", severity: "check",
      text: `The legacy rule is ${a.lineCount} lines and the proposal is one. `
          + "Worth confirming the proposal is complete rather than summarised." });
  }

  return { legacy: a, sei: b, findings,
           risk: findings.filter((f) => f.severity === "risk").length,
           checks: findings.filter((f) => f.severity === "check").length };
}

export default parseRule;
