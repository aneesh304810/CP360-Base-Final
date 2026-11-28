// Integration 360: the live records Airflow, dbt and the checks post (api/app/
// routers_integration360.py), and how they overlay the illustrative pipelines.
// Self-contained: api.js is not edited.
const API_BASE = import.meta.env.VITE_API_BASE || "/api";

async function _call(path, opts = {}) {
  const r = await fetch(`${API_BASE}${path}`, { headers: { "Content-Type": "application/json", ...(opts.headers || {}) }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json();
}

export const integration360Api = {
  health: () => _call("/integration360/health"),
  pipelines: (days = 14) => _call(`/integration360/pipelines?days=${days}`),
  runs: (dag) => _call(`/integration360/runs/${encodeURIComponent(dag)}`),
  history: (days = 31) => _call(`/integration360/history?days=${days}`),
  search: (q) => _call(`/integration360/search?q=${encodeURIComponent(q)}`),
  findings: (dag, q = {}) => _call(`/integration360/findings/${encodeURIComponent(dag)}${q.business_date ? `?business_date=${q.business_date}` : ""}`),
  badrows: (stg, raw, business_date, cols = []) => _call(`/integration360/badrows?stg=${encodeURIComponent(stg)}&raw=${encodeURIComponent(raw)}&business_date=${business_date}&cols=${encodeURIComponent(cols.join(","))}`),
  note: (n) => _call("/integration360/note", { method: "POST", body: n }),
};

/** The live status word for a dag summary (as /pipelines returns it), or null. */
export const liveStatus = (d) => (d && d.status) || null;

/** The pipelines with live records laid over: status, last run, failed tasks and failing checks. Pure, for tests. */
export function mergeLive(pipelines, live) {
  const dags = (live && live.dags) || {};
  return pipelines.map((p) => {
    const d = p.dag_id ? dags[p.dag_id] : null;
    if (!d) return { ...p, live: null };
    return { ...p, live: { status: d.status, run: d.run, failedTasks: d.failed_tasks || [], failing: d.failing || [], warnings: d.warnings || [], tasksTotal: d.tasks_total, testsTotal: d.tests_total } };
  });
}

/** A live finding as the page's case shape, so the same record and bad-records panels draw it. */
export function caseFromFinding(f, p, view) {
  const taskIdx = (view.dag || []).findIndex(([name]) => f.task_id && name.startsWith(f.task_id));
  const kind = { dbt_test: "Transformation tests", dbt_model: "Transformation tests", dbt_freshness: "Monitoring", great_expectations: "Validation", soda: "Monitoring", loader: "Validation", airflow: "Orchestration" }[f.rule_kind] || "Validation";
  const stepGuess = f.rule_kind === "dbt_freshness" || f.rule_kind === "loader" ? 1 : f.rule_kind && f.rule_kind.startsWith("dbt") ? Math.max(0, (view.flow || []).findIndex(([n]) => /Intermediate/.test(n))) : 3;
  const colId = f.column_name ? (view.graph.nodes.find((n) => n.column.toLowerCase() === String(f.column_name).toLowerCase() && (!f.model_name || n.table.toLowerCase() === String(f.model_name).toLowerCase())) || view.graph.nodes.find((n) => n.column.toLowerCase() === String(f.column_name).toLowerCase()) || {}).id : null;
  const rows = Array.isArray(f.bad_rows) ? f.bad_rows : [];
  const cols = rows.length ? Object.keys(rows[0]) : [];
  return {
    id: f.test_key || f.task_key, live: true, engine: f.rule_kind || "airflow", kind, severity: f.severity === "warn" || f.status === "warn" ? "medium" : "high", status: f.status === "warn" ? "warning" : "failed",
    pipeline: p.name, dag: p.dag_id, rule: f.test_name || f.error_code || f.task_id || "", expectation: f.expected || "", observed: f.observed || (f.failures != null ? `${f.failures} failing rows` : f.error_detail || ""), threshold: f.threshold || "",
    bad: f.failures || 0, total: f.total_rows || 0, message: f.message || f.error_detail || "", cause: "", sample: rows.length ? rows.slice(0, 3) : [{ record: f.model_name || f.task_id || "", status: f.status || f.state || "" }],
    flow: stepGuess, dagTask: taskIdx >= 0 ? taskIdx : Math.min(stepGuess + 1, (view.dag || []).length - 1), column: colId || view.graph.focus, registry: f.run_key ? `run ${f.run_key}` : "", i360: `${f.rule_kind || "airflow"} reported this on ${f.business_date || "the latest run"}.`,
    records: rows.length ? { table: f.model_name || "", registry: f.run_key || "", total: f.total_rows || rows.length, bad: cols.filter((c) => c.toLowerCase() === String(f.column_name || "").toLowerCase()), columns: cols, rows: rows.map((r) => cols.map((c) => r[c])) }
      : { none: f.rule_kind === "dbt_freshness" ? "No rows: the source was not fresh." : "The check did not carry its rows. Turn store_failures on, or post bad_rows with the check." },
  };
}
