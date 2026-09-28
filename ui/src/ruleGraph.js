// A transformation rule, parsed into the operations it performs.
//
// ruleParse.js answers "what does this rule mention" — fields, functions,
// branches, joins. That is enough to compare two rules structurally and not
// enough to draw one, because it says nothing about what feeds what.
// `to_number(nvl(x,0))` and `nvl(to_number(x),0)` have identical token sets
// and different behaviour.
//
// So: a tokeniser and a recursive-descent parser over what these cells
// actually contain —
//
//     v_Trade_Date_Cash := Base_Market_Value_10;
//     IF TRIM(Investment_Type_Code_42) != 'CASH' THEN
//       book_value := nvl(book_value,0) + to_number(nvl(Base_Amortized_Cost_7,0));
//     ELSE
//       book_value := nvl(book_value,0) + to_number(nvl(v_Trade_Date_Cash,0));
//
// — producing nodes and edges. Nested calls become nested nodes; a binary
// operator becomes a node fed by both sides; an IF becomes a branch node fed
// by its condition and feeding each leg.
//
// WHAT CANNOT BE PARSED IS KEPT, NOT DROPPED. The SEI side mixes prose with
// pseudo-code — "Pro-rate receivables based on Taxlot Qty." is a sentence,
// not an expression. A line that does not parse becomes a `prose` node
// rather than disappearing, because a rule rendered with a line missing is
// a different rule that still looks complete. `unparsed` counts them so the
// caller can say how much of the cell the picture actually covers.

const KEYWORDS = new Set(["IF", "THEN", "ELSE", "ELSIF", "ELSEIF", "END",
  "AND", "OR", "NOT", "JOIN", "WHERE", "BY", "ON", "USING", "IS", "NULL"]);

const FUNCS = new Set(["NVL", "NVL2", "TO_NUMBER", "TO_DATE", "TO_CHAR",
  "TRIM", "LTRIM", "RTRIM", "SUBSTR", "COALESCE", "DECODE", "SUM", "MAX",
  "MIN", "ROUND", "ABS", "GREATEST", "LEAST", "INSTR", "REPLACE", "CAST",
  "LENGTH", "UPPER", "LOWER"]);

const OP_LABEL = { "+": "+", "-": "−", "*": "×", "/": "÷",
                   "||": "concatenate" };

const NULLISH = new Set(["", "NULL", "N/A", "NA", "NONE", "-", "TBD"]);
export const isNoRule = (t) =>
  NULLISH.has(String(t == null ? "" : t).trim().toUpperCase());

// ------------------------------------------------------------- tokenise
export function tokenize(src) {
  const s = String(src || "");
  const out = [];
  let i = 0;
  const push = (type, value) => out.push({ type, value });
  while (i < s.length) {
    const c = s[i];
    if (c === "\n") { push("nl", "\n"); i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === "-" && s[i + 1] === "-") {          // -- line comment
      const j = s.indexOf("\n", i);
      push("comment", s.slice(i + 2, j < 0 ? s.length : j).trim());
      i = j < 0 ? s.length : j; continue;
    }
    if (c === "'") {                               // 'CASH'
      let j = i + 1;
      while (j < s.length && s[j] !== "'") j++;
      push("str", s.slice(i + 1, j)); i = j + 1; continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      push("num", s.slice(i, j)); i = j; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < s.length && /[A-Za-z0-9_.]/.test(s[j])) j++;
      let w = s.slice(i, j);
      // a trailing dot is sentence punctuation, not a qualifier
      while (w.endsWith(".")) { w = w.slice(0, -1); j--; }
      push(KEYWORDS.has(w.toUpperCase()) ? "kw" : "id", w);
      i = j; continue;
    }
    // ':=' and the two-character comparisons before their single forms
    for (const op of [":=", "!=", "<>", "<=", ">=", "||"]) {
      if (s.startsWith(op, i)) { push("op", op); i += op.length; }
    }
    if (out.length && out[out.length - 1].type === "op"
        && out[out.length - 1].value.length === 2
        && s.startsWith(out[out.length - 1].value, i - 2)) continue;
    if ("+-*/=<>(),;".includes(c)) { push("op", c); i++; continue; }
    push("other", c); i++;
  }
  return out;
}

// --------------------------------------------------------------- parse
// Precedence climbing. Only the operators these cells use.
const PREC = { "=": 1, "!=": 1, "<>": 1, "<": 1, ">": 1, "<=": 1, ">=": 1,
               "+": 2, "-": 2, "||": 2, "*": 3, "/": 3 };

function parseExpr(tk, pos, minPrec = 0) {
  let [node, p] = parseAtom(tk, pos);
  if (!node) return [null, pos];
  for (;;) {
    const t = tk[p];
    if (!t || t.type !== "op" || !(t.value in PREC)) break;
    const prec = PREC[t.value];
    if (prec < minPrec) break;
    const [rhs, p2] = parseExpr(tk, p + 1, prec + 1);
    if (!rhs) break;
    node = { t: "op", op: t.value, args: [node, rhs] };
    p = p2;
  }
  return [node, p];
}

function parseAtom(tk, pos) {
  let p = pos;
  const t = tk[p];
  if (!t) return [null, pos];
  if (t.type === "op" && t.value === "-") {          // unary minus
    const [inner, p2] = parseAtom(tk, p + 1);
    if (!inner) return [null, pos];
    return [{ t: "op", op: "*", args: [inner, { t: "const", value: "-1" }] }, p2];
  }
  if (t.type === "op" && t.value === "(") {
    const [inner, p2] = parseExpr(tk, p + 1);
    if (tk[p2] && tk[p2].type === "op" && tk[p2].value === ")") {
      return [inner, p2 + 1];
    }
    return [inner, p2];
  }
  if (t.type === "num") return [{ t: "const", value: t.value }, p + 1];
  if (t.type === "str") return [{ t: "const", value: `'${t.value}'` }, p + 1];
  if (t.type === "id") {
    const next = tk[p + 1];
    if (next && next.type === "op" && next.value === "(") {
      const args = [];
      p += 2;
      if (tk[p] && tk[p].type === "op" && tk[p].value === ")") {
        return [{ t: "call", name: t.value, args }, p + 1];
      }
      for (;;) {
        const [a, p2] = parseExpr(tk, p);
        if (!a) break;
        args.push(a); p = p2;
        if (tk[p] && tk[p].type === "op" && tk[p].value === ",") { p++; continue; }
        break;
      }
      if (tk[p] && tk[p].type === "op" && tk[p].value === ")") p++;
      return [{ t: "call", name: t.value, args }, p];
    }
    return [{ t: "ref", name: t.value }, p + 1];
  }
  return [null, pos];
}

// ------------------------------------------------------- line grammar
// These cells are line-oriented. A statement never usefully spans a line
// except across IF/THEN/ELSE, which the classifier tracks by itself.
function classify(text) {
  // A join's WHERE sits on its own line in these cells:
  //
  //     Join Taxlot and End of day positions by Account, Portfolio, Instrument_id
  //     where as_of_date=<processing_dt>
  //
  // Two lines, one clause. Read separately the predicate became a prose
  // node and the join lost the condition that makes it a precondition —
  // the most important half of it.
  const merged = [];
  String(text || "").split(/\r?\n/).forEach((raw) => {
    const line = raw.trim();
    if (!line) return;
    if (merged.length && /^(where|and|on|using)\b/i.test(line)
        && /^join\b/i.test(merged[merged.length - 1])) {
      merged[merged.length - 1] += " " + line;
      return;
    }
    merged.push(line);
  });

  return merged.map((line) => {
    const tk = tokenize(line);
    const kw = (n) => tk[n] && tk[n].type === "kw" ? tk[n].value.toUpperCase() : null;

    if (/^join\b/i.test(line)) return { k: "join", line, tk };
    if (kw(0) === "ELSE" && !kw(1)) return { k: "else", line };
    if (kw(0) === "END") return { k: "end", line };
    if (kw(0) === "IF" || kw(0) === "ELSIF" || kw(0) === "ELSEIF"
        || (kw(0) === "ELSE" && kw(1) === "IF")) {
      const from = (kw(0) === "ELSE" && kw(1) === "IF") ? 2 : 1;
      const [cond] = parseExpr(tk, from);
      return { k: "if", line, cond, chained: kw(0) !== "IF" || from === 2 };
    }
    // assignment: <id> := <expr>
    const asg = tk.findIndex((x) => x.type === "op" && x.value === ":=");
    if (asg > 0) {
      const [val] = parseExpr(tk, asg + 1);
      return { k: "assign", line, lhs: tk[asg - 1].value, val };
    }
    // IS THIS CODE OR IS IT A SENTENCE? The first attempt asked whether
    // the line contained an operator, and "Pro-rate receivables based on
    // Taxlot Qty." contains a hyphen — so an English sentence parsed as
    // Pro minus rate and was drawn as arithmetic. Operators are no test
    // at all on a cell that mixes prose with pseudo-code.
    //
    // A line is code when it does something only code does: assigns,
    // calls a function, or opens with a parenthesis. A bare qualified
    // name on its own line — Taxlot.LOCAL_CURRENCY — is the third case,
    // and it is code because there is nothing else it could be.
    const hasCall = tk.some((x, i) => x.type === "id" && tk[i + 1]
      && tk[i + 1].type === "op" && tk[i + 1].value === "(");
    const startsParen = tk[0] && tk[0].type === "op" && tk[0].value === "(";
    const bareRef = tk.length === 1 && tk[0].type === "id";
    if (!hasCall && !startsParen && !bareRef) return { k: "prose", line };

    const [val] = parseExpr(tk, 0);
    if (val && (val.t === "call" || val.t === "op" || val.t === "ref")) {
      return { k: "value", line, val };
    }
    return { k: "prose", line };
  });
}

// --------------------------------------------------------------- build
const ORD = /^(.*?)_(\d{1,4})$/;

/** Parse one rule into nodes and edges.
 *
 *  `track` prefixes every id so the legacy and proposed graphs can share
 *  operator names without colliding. `target` is the warehouse column the
 *  rule writes; it always gets a node, because a rule with no visible
 *  destination is not a chain.
 */
export function buildRuleGraph(text, { track = "legacy", target = "target" } = {}) {
  const nodes = [];
  const edges = [];
  const fieldIds = new Map();      // one node per distinct field in a track
  let seq = 0;
  const nid = () => `${track}:${++seq}`;

  const add = (kind, lab, sub, extra) => {
    const id = nid();
    nodes.push({ id, track, kind, lab, sub: sub || "", ...(extra || {}) });
    return id;
  };
  const link = (from, to, lab) => {
    if (from && to) edges.push(lab ? [from, to, lab] : [from, to]);
  };

  const fieldNode = (name) => {
    const key = name.toUpperCase();
    if (fieldIds.has(key)) return fieldIds.get(key);
    const m = ORD.exec(name);
    const local = /^v_/i.test(name);
    const id = add(local ? "fn" : "field", name,
      local ? "local variable" : (m ? `field ${m[2]}` : ""),
      { base: m ? m[1] : name, ordinal: m ? Number(m[2]) : null, local });
    fieldIds.set(key, id);
    return id;
  };

  // an expression tree -> nodes, returning the id of its root
  const walk = (n) => {
    if (!n) return null;
    if (n.t === "const") return add("const", n.value, "literal");
    if (n.t === "ref") return fieldNode(n.name);
    if (n.t === "call") {
      const args = n.args.map(walk);
      const known = FUNCS.has(n.name.toUpperCase());
      const id = add("fn", `${n.name}( )`, known ? "" : "not a known function");
      args.forEach((a) => link(a, id));
      return id;
    }
    if (n.t === "op") {
      const args = n.args.map(walk);
      const id = add(n.op in PREC && PREC[n.op] === 1 ? "branch" : "fn",
                     OP_LABEL[n.op] || n.op, "");
      args.forEach((a) => link(a, id));
      return id;
    }
    return null;
  };

  const targetId = add("target", target, "");
  // "Null" is the most common entry on the SEI side and it means no rule,
  // not a rule that writes null. Running it through the parser turned N/A
  // into a division and Null into a sentence, so the check comes first.
  if (isNoRule(text)) {
    return { nodes, edges, unparsed: 0, empty: true, targetId };
  }
  const stmts = classify(text);
  let unparsed = 0;
  let pendingBranch = null;        // the IF whose legs are being collected
  let leg = null;                  // "then" | "else"
  let lastJoin = null;
  const feedsTarget = [];

  stmts.forEach((st) => {
    if (st.k === "join") {
      // "Join A and B by k1, k2 where x = y" — the objects, the keys and
      // the predicate are three different things and the cell runs them
      // together. Split so the precondition reads as one.
      const m = /^join\s+(.*?)(?:\s+(?:by|on|using)\s+(.*?))?(?:\s+where\s+(.*))?$/i
        .exec(st.line);
      const objs = m ? (m[1] || "").replace(/\s+and\s+/gi, " ⋈ ").trim() : st.line;
      const keys = m && m[2] ? m[2].trim() : "";
      const pred = m && m[3] ? m[3].trim() : "";
      lastJoin = add("join", objs,
        [keys && `on ${keys}`, pred && `where ${pred}`].filter(Boolean).join(" · "),
        { keys, pred });
      return;
    }
    if (st.k === "prose") { unparsed++; add("prose", st.line, "not an expression"); return; }
    if (st.k === "end") return;
    if (st.k === "if") {
      const condRoot = walk(st.cond);
      const label = st.cond ? exprText(st.cond) : st.line;
      pendingBranch = add("branch", label, "two legs");
      link(condRoot, pendingBranch);
      leg = "then";
      return;
    }
    if (st.k === "else") { leg = "else"; return; }

    // assign | value
    const root = walk(st.k === "assign" ? st.val : st.val);
    if (!root) { unparsed++; return; }
    if (pendingBranch) {
      link(pendingBranch, root, leg === "else" ? "else" : "then");
    }
    feedsTarget.push(root);
  });

  // Every join feeds the fields it made reachable. Drawn the other way
  // round the join looks like an afterthought instead of the precondition
  // it is: no join, no rows, no value.
  if (lastJoin) {
    nodes.filter((n) => n.kind === "field").forEach((f) => link(lastJoin, f.id));
  }

  // Anything with no outgoing edge, other than the target, is a root of the
  // computation and lands on the target.
  const hasOut = new Set(edges.map(([a]) => a));
  nodes.forEach((n) => {
    if (n.id === targetId || n.kind === "prose") return;
    if (!hasOut.has(n.id)) link(n.id, targetId);
  });
  feedsTarget.forEach((r) => {
    if (!edges.some(([a, b]) => a === r && b === targetId)) link(r, targetId);
  });

  return { nodes, edges, unparsed, empty: isNoRule(text), targetId };
}

/** Re-render a parsed condition as short text for a branch label. */
function exprText(n) {
  if (!n) return "";
  if (n.t === "const") return n.value;
  if (n.t === "ref") return n.name;
  if (n.t === "call") return `${n.name}(${n.args.map(exprText).join(", ")})`;
  if (n.t === "op") return `${exprText(n.args[0])} ${n.op} ${exprText(n.args[1])}`;
  return "";
}

/** Both tracks, plus which nodes have no counterpart on the other one.
 *
 *  "Counterpart" is deliberately shallow: same kind and same label, with
 *  fields compared on their base name so Base_Market_Value_10 and
 *  BASE_MARKET_VALUE match. A deeper equivalence test would be guessing,
 *  and a wrong ring is worse than no ring. */
export function buildComparisonGraph(legacyText, seiText, target) {
  const L = buildRuleGraph(legacyText, { track: "legacy", target });
  const S = buildRuleGraph(seiText, { track: "sei", target });
  const key = (n) => `${n.kind}:${(n.base || n.lab || "").toUpperCase()}`;
  const lk = new Set(L.nodes.map(key));
  const sk = new Set(S.nodes.map(key));
  const skip = (n) => n.kind === "target" || n.kind === "prose";
  return {
    nodes: [...L.nodes, ...S.nodes],
    edges: [...L.edges, ...S.edges],
    legacy: L, sei: S,
    onlyLegacy: L.nodes.filter((n) => !skip(n) && !sk.has(key(n))).map((n) => n.id),
    onlySei: S.nodes.filter((n) => !skip(n) && !lk.has(key(n))).map((n) => n.id),
    unparsed: L.unparsed + S.unparsed,
  };
}

export default buildRuleGraph;
