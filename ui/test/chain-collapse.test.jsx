// Collapsing the chain must never lose a rule.
//
// A STAR extract lands in IMDS directly, so STG1 and STG2 are empty on
// most rows and the four-box chain spent half its width saying nothing
// happens. Dropping them is right. Dropping the EXPRESSIONS that sat on
// the hops into and out of them is not — and the first version of this
// did exactly that, carrying rules forward to a node whose hop is never
// rendered because it is last. A rule that is not shown reads as a rule
// that does not exist, which is the one failure this screen cannot have.

import { collapseChain } from "../src/ChainRules.jsx";

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${msg}${cond ? "" : `  -> ${JSON.stringify(got)}`}`);
  if (!cond) bad++;
};
// [stage, table, column, type, length, outgoingRule]
const S = (stage, table, column, rule) =>
  [stage, table, column, "T", null, rule];

const rulesOf = (live) => live.map((n) => n.rule).filter(Boolean).join("\n");
const allRules = (stages) => stages.map((s) => s[5]).filter(Boolean);

// ---- the STAR case: no staging at all -----------------------------------
let stages = [
  S("SRC", "PEDDIFI1", "Base_Amortized_Cost_7", "trim"),
  S("STG1", null, null, "to_number"),
  S("STG2", null, null, "round(x,6)"),
  S("DWH", "HOLDINGDBO.POSITION_DETAIL", "book_value", null),
];
let live = collapseChain(stages);
ok(live.length === 2, "two boxes when there is no staging", live.map((n) => n.stage));
ok(live[0].stage === "SRC" && live[1].stage === "DWH",
   "and they are the two ends", live.map((n) => n.stage));
allRules(stages).forEach((r) =>
  ok(rulesOf(live).includes(r), `rule survives the collapse: ${r}`, rulesOf(live)));
ok(live[0].rule.split("\n").length === 3,
   "all three land on the one surviving hop", live[0].rule);
ok(!live[1].rule,
   "and none on the last node, whose hop is never drawn", live[1].rule);

// ---- one middle stage present -------------------------------------------
stages = [
  S("SRC", "F", "a", "r1"),
  S("STG1", "STG1_T", "b", "r2"),
  S("STG2", null, null, "r3"),
  S("DWH", "W", "c", null),
];
live = collapseChain(stages);
ok(live.length === 3, "three boxes", live.map((n) => n.stage));
ok(live[0].rule === "r1", "the kept hop keeps its own rule", live[0].rule);
ok(live[1].rule === "r2\nr3",
   "the dropped stage's rule joins the hop before it", live[1].rule);
allRules(stages).forEach((r) =>
  ok(rulesOf(live).includes(r), `rule survives: ${r}`));

// ---- nothing dropped ----------------------------------------------------
stages = [S("SRC","F","a","r1"), S("STG1","G","b","r2"),
          S("STG2","H","c","r3"), S("DWH","W","d",null)];
live = collapseChain(stages);
ok(live.length === 4, "a full chain is left alone", live.length);
ok(live.map((n) => n.rule).join("|") === "r1|r2|r3|",
   "with every rule on its own hop", live.map((n) => n.rule));

// ---- the ends are never dropped, even when empty ------------------------
live = collapseChain([S("SRC", null, null, null), S("STG1", null, null, null),
                      S("STG2", null, null, null), S("DWH", null, null, null)]);
ok(live.length === 2 && live[0].stage === "SRC" && live[1].stage === "DWH",
   "an entirely empty chain still shows its two ends", live.map((n) => n.stage));

// ---- a stage counts as present on a column alone ------------------------
live = collapseChain([S("SRC","F","a","r1"), S("STG1", null, "b", "r2"),
                      S("STG2", null, null, null), S("DWH","W","d",null)]);
ok(live.length === 3 && live[1].stage === "STG1",
   "a stage with a column but no table is still a stage", live.map((n) => n.stage));

// ---- robustness ---------------------------------------------------------
let threw = false;
try { collapseChain([]); collapseChain([S("SRC",null,null,null)]); }
catch { threw = true; }
ok(!threw, "empty and single-stage input do not throw");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nall chain-collapse assertions pass");
