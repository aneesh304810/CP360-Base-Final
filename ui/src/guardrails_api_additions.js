// Quality Guardrails — the promotion plane.
//
// Same house rule as seiCrosswalkApi.js: nothing here touches api.js. The
// existing runtime calls (guardrailStats, guardrailAttention, guardrailEvent,
// guardrailBadData) stay where they are; these are additions, and additions
// go in their own file so a pull cannot replace a good api.js with a stale
// one plus them.
//
// TWO PLANES, TWO SETS OF CALLS, on purpose. A gate run belongs to a commit;
// a guardrail event belongs to a run on a business date. sql/67's header
// argues that out. Folding them into one endpoint would mean every caller
// deciding which half of the payload applies to it.

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

async function _get(path, fallback) {
  try {
    const r = await fetch(`${API_BASE}${path}`, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch {
    return fallback();
  }
}

const _qs = (o) => {
  const q = new URLSearchParams();
  Object.entries(o || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.set(k, v);
  });
  const s = q.toString();
  return s ? `?${s}` : "";
};

export const promotionApi = {
  // What each region is FOR, and how it is doing. The three are not the
  // same shape and the fallback keeps that: PROD has no gates, and a zero
  // there is the truth rather than a missing number.
  regions: () =>
    _get("/guardrails/regions",
      () => ({ regions: [], synthetic: null, unreachable: true })),

  releases: () =>
    _get("/guardrails/promotion",
      () => ({ releases: [], count: 0, synthetic: null, unreachable: true })),

  release: (id) =>
    _get(`/guardrails/release/${encodeURIComponent(id)}`,
      () => ({ release: null, gates: [], synthetic: null, unreachable: true })),

  // WHAT IS RUNNING WHERE — the inverse of releases(). That call says
  // how far a release has got; this says what an environment contains,
  // and the newest release is often blocked and therefore deployed
  // nowhere. Two questions, two endpoints.
  environments: () =>
    _get("/guardrails/environments",
      () => ({ environments: [], fallback: true, unreachable: true })),

  deployments: (environment) =>
    _get(`/guardrails/deployments${_qs({ environment })}`,
      () => ({ environments: [], history: [], synthetic: null,
               unreachable: true })),

  // The gap between two environments, both lanes. Named by environment
  // rather than by tag because a tag identifies ONE lane, and the point
  // of the call is that the application and the schema move separately.
  compare: (from_env, to_env) =>
    _get(`/guardrails/compare${_qs({ from_env, to_env })}`,
      () => ({ from: null, to: null,
               app: { releases: [], count: 0 },
               schema: { ahead: [], ahead_count: 0, behind_count: 0 },
               risk: { no_rollback: 0, rollback_not_data_safe: 0,
                       destructive: 0, headline: "" },
               unreachable: true })),

  // The runtime plane, scoped. Region is a filter here, not a different
  // question — PROD is the only region that runs these today, but SIT and
  // UAT will emit them too once their own dbt runs are collected.
  attention: (engine, region) =>
    _get(`/guardrails/attention${_qs({ engine, region })}`,
      () => ({ events: [] })),

  stats: (region) =>
    _get(`/guardrails/stats${_qs({ region })}`,
      () => ({ total: 0, attention: 0, failed: 0, warning: 0, critical: 0,
               by_engine: {} })),
};

// The four CI/CD stages, in pipeline order, with the colour each carries on
// the board. Named once so the region lanes, the stage headings and the gate
// chips cannot disagree about what "security" looks like.
export const STAGE = {
  governance:  { order: 1, label: "Data Engineering Governance", c: "#0f4775" },
  performance: { order: 2, label: "Performance Benchmarking",    c: "#0091bf" },
  testing:     { order: 3, label: "Testing Framework",           c: "#1b6ca8" },
  security:    { order: 4, label: "Cyber & Security Scan",       c: "#10193b" },
  promotion:   { order: 5, label: "Promotion",                   c: "#6d3ac0" },
};

// Gate outcome. `warning` and `failed` are deliberately different colours
// AND different words: a gate that reports and does not block is not a
// smaller version of one that does.
export const GATE_STATUS = {
  passed:  { c: "#159943", bg: "#e8f6ed", label: "passed" },
  failed:  { c: "#c1113a", bg: "#fdeaee", label: "failed" },
  warning: { c: "#b4620f", bg: "#fdf2e3", label: "warning" },
  running: { c: "#0091bf", bg: "#e4f4fb", label: "running" },
  not_run: { c: "#7b8894", bg: "#f1f4f7", label: "not run" },
  skipped: { c: "#7b8894", bg: "#f1f4f7", label: "skipped" },
};

// UAT is called QC in parts of this estate. The alias travels with the
// label rather than replacing it: the code, the schema and every row
// already written use UAT, and renaming the column to match a spoken
// habit would break all of them.
export const REGION = {
  SIT:  { c: "#0f4775", label: "SIT",  sub: "developer region" },
  UAT:  { c: "#b4620f", label: "UAT",  sub: "promotion region", alias: "QC" },
  PROD: { c: "#159943", label: "PROD", sub: "live" },
};

// What a changeset does, and how reversible it is. Two flags rather
// than one "rollbackable": a DROP COLUMN declares a rollback AND cannot
// bring the data back, and collapsing those is how a promotion is
// approved on a rollback that restores an empty column.
export const CHANGE_TYPE = {
  ddl_add:    { label: "add", c: "#159943" },
  ddl_alter:  { label: "alter", c: "#0091bf" },
  ddl_drop:   { label: "drop", c: "#c1113a" },
  index:      { label: "index", c: "#0091bf" },
  constraint: { label: "constraint", c: "#6d3ac0" },
  dml:        { label: "data", c: "#b4620f" },
  other:      { label: "other", c: "#7b8894" },
};

export const LANE = {
  app:    { label: "Application", sub: "dbt + Airflow", c: "#0f4775" },
  schema: { label: "Schema", sub: "Liquibase", c: "#6d3ac0" },
};

export default promotionApi;
