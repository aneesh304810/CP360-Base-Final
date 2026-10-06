// The two gap supplements, and the reconciliation against what the Hub
// already models.
//
// WHAT THIS PINS, AND WHY EACH ONE IS A TEST RATHER THAN A HOPE:
//
//   THE RECONCILIATION IS THE POINT. A second design document beside the
//   first is worth nothing unless somebody compares them. Every finding
//   must state BOTH readings and name a decision or explicitly say none
//   is needed - a finding that only says what the supplement says is a
//   quotation, not a reconciliation.
//
//   CONFLICTS ARE NOT RESOLVED HERE. Where the supplement and the
//   baseline disagree, both survive. A test asserts the conflicting
//   baseline facts are still what the baseline modules say, so a later
//   edit that quietly adopts one side breaks this file.
//
//   LOAD_ID IS THE ONE WE GOT WRONG. The supplement makes it the
//   identifier preserved across all four tiers; neither of our column
//   sets has it. The test asserts the finding exists for as long as the
//   hole does.
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { GAP_DOC, GAP_SCOPE, GAP_TIERS, GAP_REGISTER, GAP_IDENTIFIERS,
  GAP_FOUNDATION, GAP_DECISIONS, GAP_ACCEPTANCE, GAP_RECON, GAP_NAMING,
  GAP_HADR_OPEN, GAP_CODE_FINDING, buildStatus, BUILD_SUMMARY, BUILD_LABEL }
  from "../src/hubGapSupplement.js";
import { GW_DOC, GW_GAPS, GW_RISKS, GW_OPERATION, GW_HEADERS,
  GW_TOKEN_TESTS, GW_RUNTIME_OBJECTS, GW_APPROVAL, GW_BLOCKING }
  from "../src/hubGatewayReview.js";
import { RECONCILE, RC_VERDICT, RC_COUNTS, rcBy }
  from "../src/hubGapReconcile.js";
import { GapSupplementView } from "../src/HubContext.jsx";
import { S1_COLS } from "../src/hubStage1Model.js";
import { S2_STD_COLS, S2_TABLES } from "../src/hubStage2Model.js";
import { SEI_STATES } from "../src/seiBaseline.js";
import { PROC_STAGES } from "../src/hubGroups.js";
import { tLight, tDark } from "../src/bbhTheme.js";

let bad = 0;
const ok = (cond, msg, got) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${msg}${cond ? "" : `  -> ${String(got).slice(0, 300)}`}`);
  if (!cond) bad++;
};
function srcDir() {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    for (const rel of ["src", path.join("ui", "src")]) {
      const c = path.join(dir, rel);
      if (fs.existsSync(path.join(c, "HubContext.jsx"))) return c;
    }
    dir = path.dirname(dir);
  }
  throw new Error("src not found");
}
const HUBSRC = fs.readFileSync(path.join(srcDir(), "HubDesign.jsx"), "utf8");
const t = tLight;

/* ------------------------------------------------- the supplements */
ok(GAP_SCOPE.length === 11 && GAP_REGISTER.length === 12,
   "eleven architecture domains and a twelve-row gap register",
   `${GAP_SCOPE.length}/${GAP_REGISTER.length}`);
ok(GAP_REGISTER.every((g) => /^GAP-\d\d$/.test(g.id) && g.g && g.d && g.dom),
   "every gap has an id, a statement, a disposition and an owning domain",
   GAP_REGISTER.filter((g) => !g.dom).map((g) => g.id).join(" "));
ok(GAP_REGISTER.every((g) => GAP_SCOPE.indexOf(g.dom) >= 0),
   "and every owning domain is one of the eleven",
   GAP_REGISTER.filter((g) => GAP_SCOPE.indexOf(g.dom) < 0)
     .map((g) => g.dom).join(" | "));
ok(GAP_DECISIONS.length === 18
   && GAP_DECISIONS.filter((d) => d[2] === "arch").length === 10
   && GAP_DECISIONS.filter((d) => d[2] === "silver").length === 8,
   "eighteen decisions, ten architecture and eight Stage 2",
   GAP_DECISIONS.length);
ok(GAP_ACCEPTANCE.length === 22,
   "twenty-two acceptance criteria", GAP_ACCEPTANCE.length);
ok(GAP_IDENTIFIERS.length === 9
   && GAP_IDENTIFIERS.every((x) => x[1] && x[2]),
   "nine traceability identifiers, each with a scope AND a propagation "
   + "rule - the rule is the part that gets lost", GAP_IDENTIFIERS.length);
ok(GAP_TIERS.length === 4
   && GAP_TIERS.map((x) => x.tier).join(",")
      === "Stage 1,Stage 2,Stage 3,Consumer Movement",
   "four tiers, in order, with Consumer Movement as the fourth",
   GAP_TIERS.map((x) => x.tier).join(","));
ok(GAP_FOUNDATION.filter((f) => !f[2]).length === 3,
   "three foundation entities have no table anywhere",
   GAP_FOUNDATION.filter((f) => !f[2]).map((f) => f[0]).join(", "));
ok(GAP_RECON.length === 7 && GAP_HADR_OPEN.length === 7
   && GAP_NAMING.length === 7,
   "seven reconciliation boundaries, seven HA/DR items, seven naming rules",
   `${GAP_RECON.length}/${GAP_HADR_OPEN.length}/${GAP_NAMING.length}`);
ok(/pre_gold|publish/.test(GAP_CODE_FINDING.fix)
   && GAP_CODE_FINDING.model === "int_bbh_open_trade_star",
   "the code finding names the model and where it should move",
   GAP_CODE_FINDING.fix);

/* -------------------------------------------------- the gateway */
ok(GW_GAPS.length === 9 && GW_RISKS.length === 7 && GW_APPROVAL.length === 12,
   "nine gateway gaps, seven risks, twelve approval criteria",
   `${GW_GAPS.length}/${GW_RISKS.length}/${GW_APPROVAL.length}`);
ok(GW_BLOCKING === 4,
   "four of the nine block production approval", GW_BLOCKING);
ok(GW_GAPS.every((g) => g.sev === "block" || g.sev === "open"),
   "every gateway gap is marked blocking or open, with no third state", "");
// The finding behind R21: no quota field anywhere in the operation contract.
ok(!GW_OPERATION.some((f) => /quota|rate|limit|throttl/i.test(f)),
   "the governed-operation contract has no quota or rate-limit field - "
   + "which is what makes R21 a real finding rather than a quibble",
   GW_OPERATION.join(" "));
ok(GW_OPERATION.indexOf("timeout_policy") >= 0
   && GW_OPERATION.indexOf("circuit_breaker_policy") >= 0,
   "though it does carry timeout and circuit-breaker policy, so the "
   + "omission is specific rather than an empty contract", "");
ok(GW_HEADERS.some(([k]) => /correlation/i.test(k))
   && GW_TOKEN_TESTS.some((x) => /storm/i.test(x)),
   "the header policy owns the correlation identifier and the token tests "
   + "name the refresh storm", "");
ok(GW_RUNTIME_OBJECTS.filter((o) => !o[1]).length === 3,
   "three OpenShift objects are not in place yet",
   GW_RUNTIME_OBJECTS.filter((o) => !o[1]).map((o) => o[0]).join("; "));
ok(/conditional/i.test(GW_DOC.verdict),
   "and the verdict says production approval is conditional rather than "
   + "giving a score", GW_DOC.verdict.slice(0, 60));

/* ------------------------------------------- the reconciliation */
ok(RECONCILE.length === 25,
   "twenty-five findings across both supplements", RECONCILE.length);
ok(new Set(RECONCILE.map((r) => r.id)).size === RECONCILE.length,
   "no finding id is reused", "");
ok(RECONCILE.every((r) => RC_VERDICT[r.v]),
   "every finding carries one of the four verdicts",
   RECONCILE.filter((r) => !RC_VERDICT[r.v]).map((r) => r.id).join(" "));
// A finding that only quotes the supplement is not a reconciliation.
ok(RECONCILE.every((r) => r.sup && r.hub),
   "every finding states BOTH readings - what the supplement says and what "
   + "the Hub holds", RECONCILE.filter((r) => !r.hub).map((r) => r.id).join(" "));
ok(RECONCILE.filter((r) => r.v !== "agrees").every((r) => r.cost),
   "and every one that is not a confirmation says what it costs to leave "
   + "open", RECONCILE.filter((r) => r.v !== "agrees" && !r.cost)
     .map((r) => r.id).join(" "));
ok(RECONCILE.every((r) => typeof r.dec === "string"),
   "each names a decision or explicitly says none is needed", "");
ok(RC_COUNTS.conflict === 6 && RC_COUNTS.closes === 4
   && RC_COUNTS.extends === 11 && RC_COUNTS.agrees === 4,
   "six conflicts, four closures, eleven extensions, four confirmations",
   JSON.stringify(RC_COUNTS));
// "agrees" earns its place: without it the two documents look at war.
ok(RC_COUNTS.agrees > 0,
   "the supplements confirm some of the baseline, and that is recorded - "
   + "a reader who sees only disagreements assumes the documents are at war",
   RC_COUNTS.agrees);

/* -------- the conflicting baseline facts must still be true -------- */
// If a later edit quietly adopts the supplement's reading, these break,
// which is the whole point of recording the conflict rather than resolving
// it.
const s2int = PROC_STAGES.find((p) => p.id === "stage2int");
ok(s2int && /S16/.test(JSON.stringify(s2int.sei)),
   "R2 still stands: the Hub still files DIM under Stage 2 INT, as both "
   + "SEI design documents describe it",
   s2int ? JSON.stringify(s2int.sei) : "stage2int missing");
ok(PROC_STAGES.some((p) => p.id === "stage3" && /warehouse/i.test(p.sub)),
   "R1 still stands: the Hub still calls Stage 3 the warehouse, not "
   + "Pre-Gold", (PROC_STAGES.find((p) => p.id === "stage3") || {}).sub);
const regStates = SEI_STATES.file_registry.rows.map((r) => r[0]);
ok(regStates.indexOf("RECEIVED") >= 0 && regStates.indexOf("DISCOVERED") < 0
   && regStates.indexOf("DUPLICATE_SKIPPED") < 0,
   "R3 still stands: the baseline lifecycle uses RECEIVED and has no "
   + "DISCOVERED or DUPLICATE_SKIPPED", regStates.join(" "));

// R9 - the one we got wrong. This assertion is designed to FAIL the day
// LOAD_ID is added, so the finding cannot outlive the hole.
const cols = S1_COLS.map((c) => c[0]).concat(S2_STD_COLS.map((c) => c[0]));
ok(cols.indexOf("LOAD_ID") < 0 && RECONCILE.some((r) => r.id === "R9"),
   "R9 still stands: neither Stage 1 nor Stage 2 carries LOAD_ID, and the "
   + "finding says so. Adding the column must retire the finding.",
   cols.join(" "));

/* ------------------------------------------------- build status */
ok(BUILD_SUMMARY().implemented === 7 && BUILD_SUMMARY().expand === 4,
   "seven of the 52 canonical models exist, four of them under-mapped",
   JSON.stringify(BUILD_SUMMARY()));
ok(buildStatus("ACCOUNT") === "sample-expand"
   && buildStatus("CLIENT") === "target",
   "build status answers for a real table and defaults to target",
   `${buildStatus("ACCOUNT")} / ${buildStatus("CLIENT")}`);
ok(Object.keys(BUILD_LABEL).every((k) => BUILD_LABEL[k][0] && BUILD_LABEL[k][1]),
   "and every status has a label and an explanation", "");
ok(S2_TABLES.filter((r) => buildStatus(r[1]) !== "target").length === 7,
   "the seven implemented models all resolve against real canonical tables",
   S2_TABLES.filter((r) => buildStatus(r[1]) !== "target").length);

/* ------------------------------------------------------ rendering */
["reconcile", "register", "decisions", "accept", "gateway", "source"]
  .forEach((tab) => {
    try {
      const h = renderToStaticMarkup(
        <GapSupplementView t={t} tab={tab} setTab={() => {}} filter="all"
          setFilter={() => {}} />);
      if (h.length < 400) ok(false, `${tab} renders something`, h.length);
    } catch (e) { ok(false, `${tab} renders`, e.message); }
  });
ok(true, "all six tabs render", "");
try {
  const h = renderToStaticMarkup(<GapSupplementView t={t} tab="reconcile"
    setTab={() => {}} filter="conflict" setFilter={() => {}} />);
  // "Closes a gap" is also a filter chip, so the absence has to be
  // checked on a finding TITLE rather than on the verdict word.
  ok(/Stage 3 names two different things/.test(h)
     && !/outbound submission registry now has a design/.test(h),
     "filtering to conflicts shows the conflicts and drops the closures",
     h.length);
} catch (e) { ok(false, "the filter renders", e.message); }
try {
  renderToStaticMarkup(<GapSupplementView t={tDark} tab="gateway"
    setTab={() => {}} filter="all" setFilter={() => {}} />);
  ok(true, "and the gateway tab renders in dark", "");
} catch (e) { ok(false, "dark renders", e.message); }

ok(/view === "GAPS"/.test(HUBSRC) && /setView\("GAPS"\)/.test(HUBSRC),
   "HubDesign routes the supplements and makes them reachable", "");


/* ------------------------------------------- the design documents */
// The supplement's own required-updates list asks for these, so they are
// asserted rather than eyeballed after a regeneration.
const DOCS_DIR = path.join(path.dirname(srcDir()), "..", "designs-md");
const docs = fs.existsSync(DOCS_DIR)
  ? fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith(".md")) : [];
ok(docs.length >= 100, "the design corpus is present", docs.length);

const read = (f) => fs.readFileSync(path.join(DOCS_DIR, f), "utf8");
const fmOf = (s) => (s.match(/^---\n([\s\S]*?)\n---\n/) || [, ""])[1];

// DUPLICATE FRONT-MATTER KEYS. The generator appended generated: and
// sei_status: on every run without removing the previous pair, so a
// document regenerated three times carried three copies of both. The
// supplement asks for this to be fixed during regeneration.
const dup = docs.filter((f) => {
  const keys = fmOf(read(f)).split("\n")
    .filter((l) => /^[a-z_]+:/.test(l)).map((l) => l.split(":")[0]);
  return new Set(keys).size !== keys.length;
});
ok(dup.length === 0,
   "no document has a duplicate front-matter key - the generator strips "
   + "every key it owns before re-adding it", dup.slice(0, 3).join(" "));

const comps = docs.filter((f) => /^component_id:/m.test(read(f)));
ok(comps.length === 91,
   "ninety-one component documents - the 65 tracked plus the 26 proposals, "
   + "which are the components the supplements have most to say about",
   comps.length);
ok(comps.every((f) => /^architecture_domain:/m.test(read(f))),
   "every one carries an architecture_domain - matching a component to a "
   + "container only by its explicit lane left 23 with none, and those "
   + "silently received none of their domain's gaps",
   comps.filter((f) => !/^architecture_domain:/m.test(read(f))).slice(0, 3).join(" "));
["canonical_tier", "control_entities", "traceability_identifiers",
 "supplement"].forEach((k) => {
  const miss = comps.filter((f) => !new RegExp(`^${k}:`, "m").test(read(f)));
  if (miss.length) ok(false, `every component document carries ${k}`,
                      miss.slice(0, 3).join(" "));
});
ok(["canonical_tier", "control_entities", "traceability_identifiers",
    "supplement"].every((k) =>
     comps.every((f) => new RegExp(`^${k}:`, "m").test(read(f)))),
   "and the other four keys the supplement asks for in front matter", "");
ok(comps.every((f) => /## Gaps and decisions that land here/.test(read(f))),
   "and every one has a section for the gaps and decisions that land on it",
   comps.filter((f) => !/## Gaps and decisions that land here/.test(read(f)))
     .slice(0, 3).join(" "));

// The six new overview documents, and that each carries its own finding.
[["gap-supplement.md", /25 findings|places the supplements/],
 ["gateway-review.md", /no quota or rate-limit field/],
 ["stage1-raw-model.md", /LOAD_ID` is \*\*not\*\* among them|See R9/],
 ["stage2-canonical-model.md", /exist in code/],
 ["feed-to-stage1-map.md", /no Stage 1 landing table named/],
 ["database-model.md", /control plane/]].forEach(([f, re_]) => {
  if (!docs.includes(f)) { ok(false, `${f} exists`, ""); return; }
  if (!re_.test(read(f))) ok(false, `${f} carries its finding`, "");
});
ok(["gap-supplement.md", "gateway-review.md", "stage1-raw-model.md",
    "stage2-canonical-model.md", "feed-to-stage1-map.md", "database-model.md"]
     .every((f) => docs.includes(f)),
   "the six new overview documents are generated", "");
// A document that quotes the supplement without saying what this corpus
// holds is a quotation, not a reconciliation - the same rule as the data.
const gapDoc = read("gap-supplement.md");
ok(/This corpus holds/.test(gapDoc) && /What it costs to leave open/.test(gapDoc),
   "and the gap document states both readings and the cost, not just the "
   + "supplement's side", "");

console.log(bad ? `\n${bad} assertion(s) failed` : "\nhub-gap-supplement assertions pass");
if (bad) process.exit(1);
