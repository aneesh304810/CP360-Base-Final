// What the FIRST stage of a lineage chain is called, per source system.
//
// THE BUG THIS FIXES. SourceLineage and BizLineage each opened their stage
// strip with a hardcoded constant:
//
//     const STG_META = [ ["🏦", "AddVantage", "nightly file", "#7c3aed"], ... ]
//
// That was true while AddVantage was the only incumbent. It stopped being
// true the moment IMDS arrived: IMDS is fed by STAR and UAF, and both screens
// still announced "AddVantage · nightly file" over STAR data. The label was a
// constant pretending to be a fact.
//
// A UAF message is not a nightly file either — it arrives on MQ and is loaded
// by a command job — so the second stage is per-system too.
//
// Anything not listed falls back to the system's own name rather than to
// another system's, because being vague is recoverable and being wrong is not.

export const LANE_META = {
  ADDVANTAGE: { icon: "🏦", label: "AddVantage", sub: "nightly file",   c: "#6d3ac0",
                stage1: { icon: "📥", label: "Landed", sub: "staging 1" } },
  STAR:       { icon: "📄", label: "STAR",       sub: "nightly extract", c: "#b5651d",
                stage1: { icon: "📥", label: "Landed", sub: "staging 1" } },
  UAF:        { icon: "📨", label: "UAF",        sub: "MQ message",      c: "#0b7d7d",
                stage1: { icon: "⚙️", label: "Job",   sub: "command job" } },
  CRD:        { icon: "🧭", label: "CRD",        sub: "extract",         c: "#2563eb",
                stage1: { icon: "📥", label: "Landed", sub: "staging 1" } },
  SEI:        { icon: "☁️", label: "SEI",        sub: "EOD file",        c: "#0091bf",
                stage1: { icon: "🧬", label: "Canonical", sub: "conformed keys" } },
};

export function laneMeta(system) {
  const k = String(system || "").toUpperCase();
  return LANE_META[k] || {
    icon: "📦", label: k || "Source", sub: "source feed", c: "#5f87a7",
    stage1: { icon: "📥", label: "Landed", sub: "staging 1" },
  };
}

// The four-stage strip both screens draw, with stages 0 and 1 resolved for
// the system in view. Same shape the old STG_META constant had —
// [icon, label, sub, colour] — so callers index it the same way.
export function stageMeta(system) {
  const m = laneMeta(system);
  return [
    [m.icon, m.label, m.sub, m.c],
    [m.stage1.icon, m.stage1.label, m.stage1.sub, "#00a3a3"],
    ["🧼", "Cleaned", "staging 2", "#0091bf"],
    ["🏪", "Warehouse", "", "#0f4775"],
  ];
}

export default stageMeta;
