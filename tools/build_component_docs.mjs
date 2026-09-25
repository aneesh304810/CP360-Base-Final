#!/usr/bin/env node
// Regenerate one design document per component in designs-md/.
//
//   node tools/build_component_docs.mjs            # write
//   node tools/build_component_docs.mjs --check    # report only
//
// Covers all 90 components: the 65 in the tracker and the 25 the events-primary
// review adds. Every section is composed from a single source of truth — the
// tracker register plus the review modules — so nothing here is hand-typed
// prose that can drift from the UI.
//
// This OVERWRITES the component documents restored by tools/export_design_docs.py.
// The originals are in git at the commit before this tool first ran. The five
// pack-level documents (architecture, l2-planes, l3-stages, l3-errors,
// openshift-platform) are not component docs and are left alone.
//
// One-time generation: after this runs, the .md files are the artefact and are
// hand-maintained. Re-running overwrites hand edits.

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "ui", "src");
const OUT = join(ROOT, "designs-md");
const CHECK = process.argv.includes("--check");

const {
  TRACKER_COMPONENTS,
} = await import(join(SRC, "seiDesignTracker.js"));
const { HUB_EVENT_COMPONENTS } = await import(join(SRC, "hubEventComponents.js"));
const {
  AR_FINDINGS, AR_COVERAGE, AR_BOTTLENECKS, AR_ERRORS, AR_PLANE_REC,
  AR_MISSING, AR_SEI_COVER, AR_OWNER, AR_RULE_EXTERNALISATION,
} = await import(join(SRC, "hubArchitectReview.js"));
const { SEI_CITATIONS, SEI_SOURCE_INDEX, CITE_KIND } = await import(join(SRC, "seiCitations.js"));
const { FM_TABLES, FM_REC } = await import(join(SRC, "hubFoundationModel.js"));

// ---------------------------------------------------------------- indexes
const ALL = [...TRACKER_COMPONENTS, ...HUB_EVENT_COMPONENTS];
const FIND = Object.fromEntries(AR_FINDINGS.map((f) => [f.id, f]));
const COV = Object.fromEntries(AR_COVERAGE.map((c) => [c.id, c]));
const MISS = Object.fromEntries(AR_MISSING.map((m) => [m.id, m]));
const keyOf = (c) => c.arId || c.id;
const cite = (c) => SEI_CITATIONS[c.arId] || SEI_CITATIONS[c.id] || [];
const cov = (c) => COV[c.arId] || COV[c.id];
const hits = (list, c) =>
  list.filter((x) => (x.comp || []).some((k) => k === c.id || k === c.arId));

// existing filenames, so links and the compiler keep working
let existingName = {};
let existingFm = {};
try {
  const js = readFileSync(join(SRC, "designDocsData.js"), "utf8");
  const arr = JSON.parse(js.match(/export const DESIGN_DOCS = (\[[\s\S]*\]);\s*$/)[1]);
  for (const d of arr) {
    const id = (d.component_ids || [])[0];
    if (id && d.src) existingName[id] = d.src;
    if (id && d.fm_raw) {
      const keep = {};
      for (const line of d.fm_raw.split("\n")) {
        const [k, ...rest] = line.split(":");
        const key = k.trim();
        if (["architecture_decisions", "pipeline_tiers", "tags", "last_updated"].includes(key))
          keep[key] = rest.join(":").trim();
      }
      if (Object.keys(keep).length) existingFm[id] = keep;
    }
  }
} catch { /* first run, or data not present */ }

const slug = (s) => s.replace(/&/g, "and").replace(/[^A-Za-z0-9]+/g, "_")
  .replace(/^_|_$/g, "").replace(/__+/g, "_");
const fileFor = (c) =>
  existingName[c.id] || `${String(c.id).padStart(2, "0")}_${slug(c.component)}_Design.md`;

const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n+/g, " ").trim();
const bullets = (xs) => xs.filter(Boolean).map((x) => `- ${x}`).join("\n");

// ---------------------------------------------------------------- sections
function frontMatter(c) {
  const cv = cov(c);
  return [
    "---",
    "cp360_type: design_document",
    `component_id: ${c.id}`,
    `component_name: ${c.component}`,
    `zone: ${c.zone}`,
    `plane: ${c.plane}`,
    `priority: ${c.priority || "TBD"}`,
    `technology: ${c.technology || "TBD"}`,
    `custom_build: ${c.custom || "None"}`,
    `depends_on: [${c.depends && c.depends !== "-" ? c.depends : ""}]`,
    `status: ${c.status || "Not Started"}`,
    `owner: ${c.owner || "TBD"}`,
    ...Object.entries(existingFm[c.id] || {}).map(([k, v]) => `${k}: ${v}`),
    `origin: ${c.isNew ? "events-primary architect review" : "SEI-BBH component tracker"}`,
    `sei_coverage: ${cv ? cv.sei : "unassessed"}`,
    `gap_owner: ${cv ? cv.owner : "unassessed"}`,
    `in_scope: true`,
    "---",
  ].join("\n");
}

function sPurpose(c) {
  const m = MISS[c.arId];
  const out = [`**${c.deliverable}**`, ""];
  if (m) {
    out.push(m.why, "",
      `This component does not exist in the SEI design pack and has no entry in the original ` +
      `65-component tracker. It is required by one substituted assumption: **SDC events are the ` +
      `primary ingestion path**, with everything from Stage 1 onward exactly as the pack specifies it.`);
  } else {
    out.push(`Scope as recorded in the component tracker: ${c.scope || "not stated"}.`);
  }
  return out.join("\n");
}

function sContext(c) {
  const rows = [];
  if (c.depends && c.depends !== "-") rows.push(`Depends on components: ${c.depends}`);
  if (c.technology) rows.push(`Technology: ${c.technology}`);
  if (c.custom) rows.push(`Custom build: ${c.custom} — High means a design document is mandatory before code.`);
  if (c.source) rows.push(`Source of record: ${c.source}`);
  const pr = AR_PLANE_REC[
    { "Ingress/Egress": "IE", Processing: "PROC", Orchestration: "ORCH",
      "Data Quality": "DQ", Foundation: "FND" }[c.plane]];
  const out = [bullets(rows)];
  if (pr) {
    out.push("", `### The ${pr.title} plane`, "",
      `**What the pack has.** ${pr.has}`, "",
      `**What it does not.** ${pr.lacks}`, "",
      `**Plane verdict:** ${pr.verdict}.`);
  }
  return out.join("\n");
}

function sDecisions(c) {
  const f = FIND[c.id];
  const cv = cov(c);
  const out = [];
  if (f) out.push(`**Review verdict: ${f.verdict}.** ${f.finding}`);
  else if (c.isNew) out.push("No prior design decisions exist — this component has never been specified.");
  else out.push("No review finding against this component: the events-primary substitution does not change it.");
  if (cv && cv.rec) out.push("", `**Direction.** ${cv.rec}`);
  if (["15", "16", "M24", "M25"].includes(keyOf(c))) {
    const R = AR_RULE_EXTERNALISATION;
    out.push("", `### ${R.title}`, "", R.problem, "",
      `**Principle.** ${R.principle}`, "",
      "| Ownership | Covers |", "| --- | --- |",
      ...R.owns.map(([who, , what]) => `| **${who}** | ${esc(what)} |`));
  }
  return out.join("\n");
}

function sDetailed(c) {
  const m = MISS[c.arId];
  const out = [];
  if (m) out.push(`**Deliverable.** ${m.deliverable}`, "", `**Technology.** ${m.tech}`);
  else out.push(`**Deliverable.** ${c.deliverable}`);

  if (["15", "16", "M24", "M25"].includes(keyOf(c))) {
    const R = AR_RULE_EXTERNALISATION;
    out.push("", "### Rule registry data model", "",
      "| Table | Grain | Columns |", "| --- | --- | --- |",
      ...R.rules.map((r) => `| \`${r.name}\` | ${esc(r.grain)} | ${esc(r.cols)} |`),
      "", ...R.rules.map((r) => `- **${r.name}** — ${r.note}`),
      "", "### Authoring to production", "",
      "| Step | Stage | What happens |", "| --- | --- | --- |",
      ...R.flow.map(([n, stage, what]) => `| ${n} | ${esc(stage)} | ${esc(what)} |`),
      "", `**Scope boundary.** ${R.scope}`);
  }
  if (c.plane === "Foundation" && !c.isNew) {
    const owned = FM_TABLES.filter((t) =>
      (c.component.match(/Error/i) && t.area === "ERROR") ||
      (c.component.match(/Reconcil|Audit/i) && t.area === "DQ") ||
      (c.component.match(/Metadata|Config/i) && t.area === "GUARD"));
    if (owned.length) {
      out.push("", "### Framework tables this component needs", "",
        "| Table | State | Purpose |", "| --- | --- | --- |",
        ...owned.map((t) => `| \`${t.name}\` | ${t.state} | ${esc(t.purpose)} |`));
    }
  }
  return out.join("\n");
}

function sDqRecon(c) {
  const out = [];
  if (c.plane === "Data Quality") {
    out.push("Gates G0, G1 and G3 are row-level and run per micro-batch. G2, G4 and G5 are " +
      "set-level aggregates and run at the EOD gate only — running them per box is 288 full " +
      "passes a day. G6 is the outbound gate and blocks a submission rather than warning.");
  }
  if (["30", "M23", "M10"].includes(keyOf(c))) {
    out.push("", "Twelve reconciliation boundaries are required, against the three the pack specifies:", "",
      "| Group | Boundaries |", "| --- | --- |",
      "| Event | `EVENTS_TO_KEYS` · `KEYS_TO_PULLED` · `PULLED_TO_STAGE1` · `STAGE1_TO_MICROBATCH` |",
      "| Pipeline | `STG_TO_INT` · `INT_TO_DIM` · `INT_TO_FACT` |",
      "| Outbound | `GENERATED_TO_VALIDATED` · `VALIDATED_TO_SUBMITTED` · `SUBMITTED_TO_ACKED` · `ACKED_TO_ACCEPTED` · `ACCEPTED_TO_REJECTED` |");
  }
  if (["16", "M24"].includes(keyOf(c))) {
    out.push("", "Every Gold row carries `RULE_SET_VERSION`. A figure produced three months ago is " +
      "explainable by reading the ruleset that was effective that night, not by finding the commit " +
      "that happened to be deployed.");
  }
  if (!out.length) out.push("No DQ, reconciliation or lineage obligation specific to this component " +
    "beyond the estate-wide framework.");
  return out.join("\n");
}

function sPerf(c) {
  const m = MISS[c.arId];
  const bs = hits(AR_BOTTLENECKS, c);
  const out = [];
  if (m) out.push(m.perf);
  if (bs.length) {
    out.push("", ...bs.map((b) =>
      `### ${b.id} · ${b.title} (${b.sev})\n\n${b.body}\n\n**What to do.** ${b.fix}`));
  }
  if (!out.filter(Boolean).length) out.push("No performance concern identified for this component " +
    "under the events-primary assumption.");
  return out.filter(Boolean).join("\n");
}

function sErrors(c) {
  const m = MISS[c.arId];
  const es = hits(AR_ERRORS, c);
  const out = [];
  if (m) out.push(m.err);
  if (es.length) {
    out.push("", ...es.map((e) =>
      `### ${e.id} · ${e.title} (${e.sev})\n\n${e.body}\n\n**Who owns it today.** ${e.owner}`));
  }
  if (!out.filter(Boolean).length) out.push("No unowned error path identified for this component.");
  return out.filter(Boolean).join("\n");
}

function sSecurity(c) {
  const out = ["Estate defaults apply: a dedicated read-only account for any consumer, business keys " +
    "masked on read rather than at rest, and secrets from the platform secret store."];
  if (c.plane === "Foundation" || c.id === "32") {
    out.push("", "**Open.** A12 grants the loader DML on RAW plus the registry, and DML-only on Gold. " +
      "No consumer grant is described anywhere in the pack, so a read-only role gets improvised at " +
      "connection time — which in practice means reusing the loader's account. The masking policy for " +
      "the 786 PII fields in SDC scope is unapproved.");
  }
  if (["M24", "M25", "15", "16"].includes(keyOf(c))) {
    out.push("", "**Rule authoring is a privileged action.** A derivation on `fact_transactions` is a " +
      "change to the firm's books. Draft-to-active on a ruleset carries `REQUIRES_APPROVAL` and a " +
      "four-eyes flow; the BA authors, someone else approves, and both are recorded.");
  }
  return out.join("\n");
}

function sCoverage(c) {
  const cs = cite(c);
  const cv = cov(c);
  const out = [];
  if (cv) {
    out.push(`**SEI pack coverage: ${cv.sei}** — ${AR_SEI_COVER[cv.sei][1]}.`,
      `**Who answers for the gap: ${cv.owner}** — ${AR_OWNER[cv.owner][1]}.`);
  } else {
    out.push("Not assessed against the SEI pack.");
  }
  if (cs.length) {
    out.push("", "| Document | Section | Kind | What it says |", "| --- | --- | --- | --- |",
      ...cs.map((x) => {
        const src = SEI_SOURCE_INDEX[x.doc] || { title: x.doc };
        const sec = x.section === "front" ? "whole document" : `§${x.section}`;
        return `| ${esc(src.title)}${src.version ? " v" + src.version : ""} | ${sec} | ${CITE_KIND[x.kind][1]} | ${esc(x.what)} |`;
      }));
    const conflicts = cs.filter((x) => x.conflict);
    if (conflicts.length) {
      out.push("", ...conflicts.map((x) =>
        `**Disagreement with §${x.section}.** ${x.conflict}`));
    }
  } else {
    out.push("", "No citation recorded. Either this is BBH platform work the pack was never going to " +
      "cover, or the mapping has not been written yet.");
  }
  return out.join("\n");
}

function sGaps(c) {
  const m = MISS[c.arId];
  const f = FIND[c.id];
  const cs = cite(c);
  const absent = cs.filter((x) => x.kind === "absent");
  const out = [];
  if (m) {
    out.push("### What is missing", "",
      `This component does not exist. ${m.why}`, "",
      `**Priority ${m.pri}, custom build ${m.build}.**`);
  } else if (f) {
    out.push("### What is missing", "", f.finding);
  } else {
    out.push("### What is missing", "", "Nothing identified. The component is specified and the " +
      "events-primary substitution does not change it.");
  }
  const bs = hits(AR_BOTTLENECKS, c), es = hits(AR_ERRORS, c);
  out.push("", "### Risk", "");
  const risks = [
    ...bs.map((b) => `**${b.sev.toUpperCase()} · performance (${b.id}).** ${b.title}.`),
    ...es.map((e) => `**${e.sev.toUpperCase()} · error path (${e.id}).** ${e.title}.`),
  ];
  out.push(risks.length ? bullets(risks) : "No ranked bottleneck or unowned error path touches this component.");
  out.push("", "### Gap against the SEI pack", "");
  out.push(absent.length
    ? bullets(absent.map((x) => {
        const src = SEI_SOURCE_INDEX[x.doc] || { title: x.doc };
        const where = x.section === "front" ? "no section \u2014 the whole document"
                                            : `\u00a7${x.section}`;
        return `${x.what} *(nearest counterpart: ${src.title}, ${where})*`;
      }))
    : (cov(c) && cov(c).sei === "covered"
        ? "The pack specifies this component. The gap is not in the documentation."
        : "No absent-coverage citation recorded."));
  return out.join("\n");
}

function sRecommendation(c) {
  const cv = cov(c);
  const f = FIND[c.id];
  const out = [];
  if (cv && cv.rec) out.push(cv.rec);
  else if (f && f.action) out.push(f.action);
  else out.push("No change recommended.");
  if (f && f.action && cv && cv.rec && f.action !== cv.rec) out.push("", `**Action.** ${f.action}`);
  if (["15", "16", "M24", "M25"].includes(keyOf(c))) {
    out.push("", `**On externalising the rules.** ${AR_RULE_EXTERNALISATION.risk}`);
  }
  if (c.plane === "Foundation" && !c.isNew) {
    out.push("", `**Foundation-wide.** ${FM_REC.body}`);
  }
  return out.join("\n");
}

function sQuestions(c) {
  const cv = cov(c);
  const out = ["### Open questions", ""];
  const qs = [];
  if (cv && cv.ask) qs.push(`**${cv.owner === "SEI" ? "For SEI" : "For both sides"}.** ${cv.ask}`);
  if (c.questions && c.questions !== "-" && !c.isNew) qs.push(`**From the tracker.** ${c.questions}`);
  out.push(qs.length ? bullets(qs) : "None outstanding.");
  out.push("", "### Acceptance criteria", "");
  out.push(bullets([
    "The deliverable above exists and is reviewed.",
    cv && cv.ask ? "The open question above has a written answer from the named owner." : null,
    hits(AR_ERRORS, c).length ? "Each unowned error path above has a named owner and a disposition in `ERROR_CATALOG`." : null,
    hits(AR_BOTTLENECKS, c).length ? "The bottleneck above has a measured figure at production volume, not an estimate." : null,
    c.isNew ? "The component appears in the tracker with a status other than Not Started." : null,
  ]));
  return out.join("\n");
}

const SECTIONS = [
  ["1. Purpose & Scope", sPurpose],
  ["2. Context & Dependencies", sContext],
  ["3. Design Decisions", sDecisions],
  ["4. Detailed Design", sDetailed],
  ["5. Data Quality, Reconciliation & Lineage", sDqRecon],
  ["6. Performance & Scale", sPerf],
  ["7. Error Handling, Failure & Replay", sErrors],
  ["8. Security & Access Control", sSecurity],
  ["9. SEI Source Coverage", sCoverage],
  ["10. Gaps, Risks & What Is Missing", sGaps],
  ["11. Recommendation", sRecommendation],
  ["12. Open Questions & Acceptance Criteria", sQuestions],
];

// ---------------------------------------------------------------- write
if (!CHECK && !existsSync(OUT)) mkdirSync(OUT, { recursive: true });
let n = 0, chars = 0;
const names = new Set();
for (const c of ALL) {
  const file = fileFor(c);
  if (names.has(file)) { console.log(`  ! duplicate filename ${file} for #${c.id}`); continue; }
  names.add(file);
  const body = [frontMatter(c), "", `# ${c.component}`, ""];
  for (const [h, fn] of SECTIONS) body.push(`## ${h}`, "", fn(c).trim(), "");
  const text = body.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
  chars += text.length;
  if (!CHECK) writeFileSync(join(OUT, file), text, "utf8");
  n++;
}
console.log(`${CHECK ? "would write" : "wrote"} ${n} component documents to designs-md/ — ${chars.toLocaleString()} chars`);
console.log(`  ${TRACKER_COMPONENTS.length} from the tracker · ${HUB_EVENT_COMPONENTS.length} from the review`);
console.log("  pack-level docs (architecture, l2-planes, l3-stages, l3-errors, openshift-platform) untouched");
