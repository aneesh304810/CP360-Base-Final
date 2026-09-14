import React, { useState, useEffect } from "react";
import { SectionHeader } from "./AppShell.jsx";
import ProjectSwitcher from "./ProjectSwitcher.jsx";
import ProjectBadge from "./ProjectBadge.jsx";
import PiiBadge from "./PiiBadge.jsx";
import { api } from "./api.js";

const SUBVIEWS = ["Business Flow", "Sources"];
const METHOD_COLOR = { GET: "#159943", POST: "#0091bf", PUT: "#e67e22", DELETE: "#c1113a" };

export default function Api360({ t, selection }) {
  const [project, setProject] = useState("all");
  const [view, setView] = useState("Business Flow");
  const [sources, setSources] = useState([]);
  const [stats, setStats] = useState(null);
  const [deps, setDeps] = useState([]);
  const [flows, setFlows] = useState([]);
  const [activeFlow, setActiveFlow] = useState(null);
  const [bizFlows, setBizFlows] = useState([]);
  const [activeBiz, setActiveBiz] = useState(null);
  const [flowMode, setFlowMode] = useState("Runbooks");
  const [building, setBuilding] = useState(false);
  const [flowSearch, setFlowSearch] = useState("");

  const pid = project === "all" || project === "sei" || project === "non-sei" ? null : project;

  const loadFlows = React.useCallback(() => {
    // Merge BOTH sources: v20 workbook flows (bf_api_flows) AND BA-authored
    // flows saved via the builder (api_business_flows). Saved flows land in the
    // latter, so both must be shown or new flows never appear.
    Promise.all([
      api.bfApiFlows().then((r) => r.flows || []).catch(() => []),
      api.apiBusinessFlows(project).then((r) => r.business_flows || []).catch(() => []),
    ]).then(([wbRaw, baRaw]) => {
      const wf = wbRaw.map((f) => ({
        flow_id: f.flow_id, display_name: f.flow_name || f.flow_id,
        domain: f.business_domain, goal: f.goal,
        step_count: f.step_count, origin: "curated", _src: "bf",
      }));
      const ba = baRaw.map((f) => ({
        flow_id: f.flow_id, display_name: f.display_name,
        domain: f.domain, goal: f.goal, step_count: f.step_count,
        origin: f.origin || "curated", _src: "ba",
      }));
      // BA flows first (newest work on top), then workbook; dedupe by flow_id
      const seen = new Set();
      const merged = [...ba, ...wf].filter((f) => {
        if (seen.has(f.flow_id)) return false;
        seen.add(f.flow_id); return true;
      });
      setBizFlows(merged);
    });
  }, [project]);

  useEffect(() => {
    api.apiSources(project).then((r) => setSources(r.sources || []));
    api.apiStats().then(setStats).catch(() => {});
    api.apiDependencies(pid).then((r) => setDeps(r.dependencies || []));
    api.apiFlows(pid).then((r) => { setFlows(r.flows || []); setActiveFlow((r.flows || [])[0] || null); });
    loadFlows();
  }, [project, pid, loadFlows]);


  const visibleSources = sources;


  return (
    <div>
      <SectionHeader t={t}>API 360</SectionHeader>
      <ProjectSwitcher t={t} value={project} onChange={setProject}
        stats={stats?.project_counts} />

      <div style={{ display: "flex", gap: 2, margin: "20px 0",
        borderBottom: `1px solid ${t.disabled}` }}>
        {SUBVIEWS.map((v) => (
          <button key={v} onClick={() => setView(v)} style={{ background: "none", border: "none",
            fontFamily: t.font, fontSize: 13, fontWeight: 500, padding: "10px 18px", cursor: "pointer",
            color: view === v ? t.accent : t.sub,
            borderBottom: `2px solid ${view === v ? t.accent : "transparent"}`, marginBottom: -1 }}>
            {v}</button>
        ))}
      </div>

      {view === "Sources" && (
        <table style={{ width: "100%", borderCollapse: "collapse", background: t.panel,
          border: `1px solid ${t.disabled}`, borderRadius: t.radius.md, overflow: "hidden" }}>
          <thead><tr>{["Source", "Project", "Feature Group", "Release", "Kind", "Endpoints"].map((h) => (
            <th key={h} style={th(t)}>{h}</th>))}</tr></thead>
          <tbody>{visibleSources.map((s) => (
            <tr key={s.source_id}>
              <td style={td(t)}><b>{s.source_id}</b></td>
              <td style={td(t)}><ProjectBadge projectId={s.project_id} t={t} /></td>
              <td style={td(t)}>{s.feature_group}</td><td style={td(t)}>{s.release_version}</td>
              <td style={td(t)}>{s.kind}</td><td style={td(t)}>{s.endpoint_count}</td>
            </tr>))}</tbody>
        </table>
      )}

      {view === "Business Flow" && (
        <div>
          <div style={{ display: "flex", gap: 2, marginBottom: 18 }}>
            {["Runbooks", "Per-domain"].map((m) => (
              <button key={m} onClick={() => setFlowMode(m)} style={{
                background: "none", border: "none", fontSize: 13, fontWeight: 500,
                padding: "6px 14px", cursor: "pointer", fontFamily: t.font,
                color: flowMode === m ? t.modApi : t.sub,
                borderBottom: `2px solid ${flowMode === m ? t.modApi : "transparent"}` }}>
                {m === "Runbooks" ? "Business Functions" : "Per-domain APIs"}</button>))}
          </div>

          {flowMode === "Runbooks" && (
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              {/* runbook list */}
              <div style={{ width: 280, flexShrink: 0 }}>
                <button onClick={() => setBuilding(true)} style={{
                  width: "100%", padding: "9px 12px", marginBottom: 10, cursor: "pointer",
                  fontFamily: t.font, fontSize: 13, fontWeight: 600, color: "#fff",
                  background: t.modApi, border: "none", borderRadius: 6 }}>
                  + New Flow</button>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: ".5px", color: t.muted, marginBottom: 8 }}>
                  Business functions ({bizFlows.length})</div>
                <input value={flowSearch} onChange={(e) => setFlowSearch(e.target.value)}
                  placeholder="Search business function…"
                  style={{ width: "100%", padding: "8px 11px", marginBottom: 8, fontSize: 12.5,
                    fontFamily: t.font, border: `1px solid ${t.border}`, borderRadius: 6,
                    boxSizing: "border-box" }} />
                <select value={activeBiz?.flow_id || ""}
                  onChange={(e) => { const id = e.target.value; if (!id) return;
                    const f = bizFlows.find((x) => x.flow_id === id); setBuilding(false);
                    f && f._src === "bf"
                      ? api.bfApiFlow(id).then((d) => setActiveBiz(_bfToBiz(d)))
                      : api.apiBusinessFlow(id).then(setActiveBiz); }}
                  style={{ width: "100%", padding: "8px 11px", marginBottom: 10, fontSize: 12.5,
                    fontFamily: t.font, border: `1px solid ${t.border}`, borderRadius: 6,
                    background: t.panel, color: t.navy, boxSizing: "border-box" }}>
                  <option value="">— jump to a business function —</option>
                  {bizFlows.map((f) => <option key={f.flow_id} value={f.flow_id}>{f.display_name}</option>)}
                </select>
                {(() => {
                  const filtered = bizFlows.filter((f) => !flowSearch.trim() ||
                    (f.display_name || "").toLowerCase().includes(flowSearch.toLowerCase()) ||
                    (f.domain || "").toLowerCase().includes(flowSearch.toLowerCase()));
                  const groups = {};
                  filtered.forEach((f) => {
                    const d = f.domain || "Unassigned";
                    (groups[d] = groups[d] || []).push(f);
                  });
                  return Object.keys(groups).sort().map((d) => (
                    <div key={d}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                        letterSpacing: ".5px", color: t.modApi || t.accent, padding: "8px 4px 4px" }}>
                        {d} <span style={{ color: t.muted, fontWeight: 400 }}>({groups[d].length})</span></div>
                      {groups[d].map((f) => (
                        <button key={f.flow_id}
                          onClick={() => { setBuilding(false);
                            f._src === "bf"
                              ? api.bfApiFlow(f.flow_id).then((dd) => setActiveBiz(_bfToBiz(dd)))
                              : api.apiBusinessFlow(f.flow_id).then(setActiveBiz); }}
                          style={{ display: "block", width: "100%", textAlign: "left",
                            padding: "10px 12px", marginBottom: 6, cursor: "pointer", fontFamily: t.font,
                            border: `1px solid ${!building && activeBiz?.flow_id === f.flow_id ? t.modApi : t.border}`,
                            borderRadius: 6, background: !building && activeBiz?.flow_id === f.flow_id ? (t.infobg || "#e0f5fd") : t.panel }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: t.navy }}>{f.display_name}</div>
                          <div style={{ fontSize: 11, color: t.sub, marginTop: 2 }}>
                            {f.step_count} steps
                            {f.origin === "generated" && <span style={{ color: t.muted }}> · auto</span>}
                            {f.origin === "curated" && <span style={{ color: t.success }}> · curated</span>}
                          </div>
                        </button>))}
                    </div>
                  ));
                })()}
              </div>
              {/* builder OR detail */}
              <div style={{ flex: 1 }}>
                {building
                  ? <FlowBuilder t={t} project={project} onSaved={(res) => {
                      setBuilding(false);
                      loadFlows();
                      // open the newly-saved flow
                      if (res && res.flow_id) {
                        api.apiBusinessFlow(res.flow_id).then(setActiveBiz).catch(() => {});
                      }
                    }} onCancel={() => setBuilding(false)} />
                  : activeBiz && <BusinessFlowDetail t={t} flow={activeBiz} />}
              </div>
            </div>
          )}

          {flowMode === "Per-domain" && (
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                {flows.map((f) => (
                  <button key={f.flow_key} onClick={() => setActiveFlow(f)} style={{
                    height: t.height.btnSm, padding: "0 14px", border: `1px solid ${t.border}`,
                    borderRadius: t.radius.pill, cursor: "pointer", fontFamily: t.font, fontSize: 13,
                    background: activeFlow?.flow_key === f.flow_key ? t.modApi : t.panel,
                    color: activeFlow?.flow_key === f.flow_key ? "#fff" : t.text }}>
                    {f.flow_name}</button>))}
              </div>
              {activeFlow && <FlowGraph t={t} flow={activeFlow} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BusinessFlowDetail({ t, flow }) {
  const steps = flow.steps || [];
  const MC = { GET: "#159943", POST: "#0091bf", PUT: "#e67e22", DELETE: "#c1113a" };
  const [epDetail, setEpDetail] = React.useState(null);
  const [epLoading, setEpLoading] = React.useState(false);
  const openStep = (s) => {
    const key = s.endpoint_key || s.operation_id || s.path;
    if (!key) return;
    setEpLoading(true); setEpDetail(null);
    api.endpointDetail(key, { operation_id: s.operation_id, method: s.method, path: s.path })
      .then((d) => { setEpDetail({ ...d, _step: s }); setEpLoading(false); })
      .catch(() => setEpLoading(false));
  };
  return (
    <div>
      <div style={{ marginBottom: 4, fontSize: 18, fontWeight: 600, color: t.navy }}>
        {flow.display_name}
        {flow.origin === "generated" && <span style={{ fontSize: 11, fontWeight: 700,
          color: t.muted, marginLeft: 8, padding: "2px 7px", border: `1px solid ${t.border}`,
          borderRadius: 3 }}>AUTO-GENERATED · BA can edit</span>}
      </div>
      {flow.goal && <div style={{ fontSize: 13, color: t.sub, marginBottom: 2 }}>{flow.goal}</div>}
      {flow.persona && <div style={{ fontSize: 12, color: t.muted, marginBottom: 16 }}>
        Audience: {flow.persona}</div>}

      {/* graph: nodes left-to-right with entity-labeled edges (click a node for Swagger) */}
      <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 4,
        padding: 18, marginBottom: 18, display: "flex", alignItems: "center", flexWrap: "wrap" }}>
        {steps.map((s, i) => (
          <React.Fragment key={s.step_order}>
            <div onClick={() => openStep(s)} title="Click for request/response detail"
              style={{ background: t.bgsoft || "#eef3f3", border: `1px solid ${MC[s.method] || t.border}`,
              borderLeft: `3px solid ${MC[s.method] || t.muted}`, borderRadius: 4, padding: "8px 11px",
              minWidth: 120, cursor: "pointer" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: MC[s.method] || t.muted }}>
                {s.method} · step {s.step_order}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.navy, marginTop: 2 }}>{s.path}</div>
              <div style={{ fontSize: 10, color: t.muted }}>{s.feature_group}</div>
            </div>
            {i < steps.length - 1 && (
              <div style={{ padding: "0 6px", textAlign: "center" }}>
                <div style={{ color: t.muted, fontSize: 16 }}>→</div>
                {steps[i].produces_entity && (
                  <div style={{ fontSize: 9, color: t.modApi, fontWeight: 600 }}>
                    {steps[i].produces_entity}</div>)}
              </div>)}
          </React.Fragment>))}
      </div>

      {epLoading && <div style={{ fontSize: 12, color: t.muted, marginBottom: 16 }}>Loading endpoint detail…</div>}
      {epDetail && <EndpointDetail t={t} ep={epDetail} onClose={() => setEpDetail(null)} MC={MC} />}

      {/* sequence table with metadata */}
      <table style={{ width: "100%", borderCollapse: "collapse", background: t.panel,
        border: `1px solid ${t.border}`, borderRadius: 4, overflow: "hidden" }}>
        <thead><tr>{["#", "Method", "Path", "Operation", "Domain", "Produces", "Consumes", "Purpose"].map((h) => (
          <th key={h} style={{ background: t.bgsoft || "#eef3f3", textAlign: "left", padding: "8px 10px",
            fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: t.accent }}>{h}</th>))}</tr></thead>
        <tbody>
          {steps.map((s) => (
            <tr key={s.step_order}>
              <td style={td2(t)}>{s.step_order}</td>
              <td style={td2(t)}><span style={{ fontSize: 9, fontWeight: 700, color: "#fff",
                background: MC[s.method] || t.muted, padding: "2px 6px", borderRadius: 3 }}>{s.method}</span></td>
              <td style={{ ...td2(t), fontFamily: "monospace", fontSize: 12 }}>{s.path}</td>
              <td style={{ ...td2(t), fontSize: 11, color: t.sub }}>{s.operation_id || "—"}</td>
              <td style={td2(t)}>{s.feature_group || "—"}</td>
              <td style={{ ...td2(t), color: t.modApi, fontSize: 11 }}>{s.produces_entity || "—"}</td>
              <td style={{ ...td2(t), color: t.sub, fontSize: 11 }}>{s.consumes_entity || "—"}</td>
              <td style={{ ...td2(t), fontSize: 12, color: t.sub }}>{s.note || s.endpoint_summary || "—"}</td>
            </tr>))}
        </tbody>
      </table>

      {/* Data points this flow touches -> Datapoint 360 */}
      {(flow.datapoints || []).length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px",
            color: t.datapoint || "#0f4775", marginBottom: 8 }}>
            Data points this flow touches <span style={{ fontWeight: 400, textTransform: "none", color: t.muted }}>→ Datapoint 360</span></div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(flow.datapoints || []).map((dp, i) => (
              <div key={i} style={{ background: t.panel2 || "#eef4f7", border: `1px solid ${t.border}`,
                borderRadius: 16, padding: "5px 12px", fontSize: 12, display: "flex", gap: 7, alignItems: "center" }}>
                <span style={{ fontFamily: "monospace", color: t.navy, fontWeight: 600 }}>{dp.datapoint_normalized}</span>
                {dp.resolved === "N" && <span style={{ fontSize: 9, color: "#fff", background: "#c1113a",
                  borderRadius: 8, padding: "1px 6px" }}>gap</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Batch equivalent — the Data 360 pipelines that do the same job */}
      {(flow.batch_equivalent || []).length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px",
            color: t.info || "#0091bf", marginBottom: 8 }}>
            Batch equivalent <span style={{ fontWeight: 400, textTransform: "none", color: t.muted }}>
              — same business function, run as scheduled pipelines (Data 360)
              {flow.compression_mart && ` · compresses into ${flow.compression_mart.dbt_gold_mart} (${flow.compression_mart.number_of_pipelines} pipelines)`}</span></div>
          <table style={{ width: "100%", borderCollapse: "collapse", background: t.panel, border: `1px solid ${t.border}`, borderRadius: 6, overflow: "hidden" }}>
            <thead><tr>{["Pipeline", "Domain", "Schedule", "SEI Target", "Routing"].map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontSize: 10, fontWeight: 700,
                textTransform: "uppercase", color: t.accent, borderBottom: `1px solid ${t.border}` }}>{h}</th>))}</tr></thead>
            <tbody>{(flow.batch_equivalent || []).map((b, i) => (
              <tr key={i}>
                <td style={{ padding: "7px 10px", fontSize: 12, fontFamily: "monospace", borderBottom: `1px solid ${t.bg}` }}>{b.pipeline_id}</td>
                <td style={{ padding: "7px 10px", fontSize: 12, borderBottom: `1px solid ${t.bg}` }}>{b.business_domain}</td>
                <td style={{ padding: "7px 10px", fontSize: 12, borderBottom: `1px solid ${t.bg}` }}>{b.schedule}</td>
                <td style={{ padding: "7px 10px", fontSize: 12, borderBottom: `1px solid ${t.bg}` }}>{b.sei_target_type} · {b.sei_target_id}</td>
                <td style={{ padding: "7px 10px", fontSize: 11, color: t.sub, borderBottom: `1px solid ${t.bg}` }}>{b.routing_pattern || ""}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const td2 = (t) => ({ padding: "8px 10px", fontSize: 13, borderBottom: `1px solid ${t.bg}` });

function FlowBuilder({ t, project, onSaved, onCancel }) {
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [persona, setPersona] = useState("");
  const [domains, setDomains] = useState([]);
  const [domainFilter, setDomainFilter] = useState("");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [chosen, setChosen] = useState([]);      // ordered endpoint objects
  const [warnings, setWarnings] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);
  const MC = { GET: "#159943", POST: "#0091bf", PUT: "#e67e22", DELETE: "#c1113a" };

  useEffect(() => { api.apiDomains(project).then((r) => setDomains(r.domains || [])); }, [project]);
  useEffect(() => {
    api.apiEndpointPicker({ q: search, domain: domainFilter, project_id: project })
      .then((r) => setResults(r.endpoints || []));
  }, [search, domainFilter, project]);

  const inChosen = (ek) => chosen.some((c) => c.endpoint_key === ek);
  const addEp = (e) => { if (!inChosen(e.endpoint_key)) setChosen([...chosen, e]); };
  const removeEp = (ek) => setChosen(chosen.filter((c) => c.endpoint_key !== ek));
  const move = (i, d) => {
    const j = i + d; if (j < 0 || j >= chosen.length) return;
    const c = [...chosen]; [c[i], c[j]] = [c[j], c[i]]; setChosen(c);
  };
  const autoOrder = async () => {
    const r = await api.apiSuggestOrder(chosen.map((c) => c.endpoint_key));
    const byKey = Object.fromEntries(chosen.map((c) => [c.endpoint_key, c]));
    setChosen((r.ordered || []).map((k) => byKey[k]).filter(Boolean));
    setWarnings(r.warnings || []);
  };
  const save = async () => {
    setSaving(true);
    const r = await api.apiCreateFlow({
      business_name: name, goal, persona,
      domain: chosen[0]?.feature_group, project_id: project === "all" ? "sei" : project,
      steps: chosen.map((c) => ({ endpoint_key: c.endpoint_key })),
    });
    setSaving(false);
    if (r.ok) { setSaved(r); onSaved && onSaved(r); }
    else alert("Save failed: " + (r.error || "unknown"));
  };

  const inp = { width: "100%", padding: "8px 10px", fontSize: 13, fontFamily: t.font,
    border: `1px solid ${t.border}`, borderRadius: 4, marginBottom: 10 };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: t.navy }}>Build a new business flow</div>
        <button onClick={onCancel} style={{ marginLeft: "auto", fontSize: 12, padding: "5px 12px",
          border: `1px solid ${t.border}`, borderRadius: 4, background: t.panel, cursor: "pointer", color: t.sub }}>
          Cancel</button>
      </div>

      <input style={inp} placeholder="Flow name (e.g. Daily Position Reconciliation)"
        value={name} onChange={(e) => setName(e.target.value)} />
      <input style={inp} placeholder="Goal — what business outcome does this achieve?"
        value={goal} onChange={(e) => setGoal(e.target.value)} />
      <input style={inp} placeholder="Audience / persona (optional)"
        value={persona} onChange={(e) => setPersona(e.target.value)} />

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginTop: 6 }}>
        {/* picker */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
            color: t.muted, marginBottom: 6 }}>Pick endpoints</div>
          <input style={inp} placeholder="Search path / operation / summary…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
          <select style={inp} value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)}>
            <option value="">All domains</option>
            {domains.map((d) => <option key={d.domain} value={d.domain}>{d.domain} ({d.c})</option>)}
          </select>
          <div style={{ maxHeight: 300, overflowY: "auto", border: `1px solid ${t.border}`, borderRadius: 4 }}>
            {results.map((e) => (
              <div key={e.endpoint_key} onClick={() => addEp(e)} style={{
                padding: "7px 10px", borderBottom: `1px solid ${t.bg}`, cursor: "pointer",
                opacity: inChosen(e.endpoint_key) ? 0.4 : 1, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", background: MC[e.method] || t.muted,
                  padding: "2px 5px", borderRadius: 3, minWidth: 38, textAlign: "center" }}>{e.method}</span>
                <span style={{ fontFamily: "monospace", fontSize: 12 }}>{e.path}</span>
                <span style={{ fontSize: 10, color: t.muted, marginLeft: "auto" }}>{e.feature_group}</span>
              </div>))}
            {results.length === 0 && <div style={{ padding: 12, color: t.muted, fontSize: 12 }}>No matches.</div>}
          </div>
        </div>

        {/* chosen sequence */}
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: t.muted }}>
              Sequence ({chosen.length})</div>
            <button onClick={autoOrder} disabled={chosen.length < 2} style={{ marginLeft: "auto",
              fontSize: 11, padding: "4px 10px", border: `1px solid ${t.modApi}`, borderRadius: 4,
              background: t.panel, color: t.modApi, cursor: chosen.length < 2 ? "default" : "pointer" }}>
              ⤲ Auto-order</button>
          </div>
          {warnings.length > 0 && (
            <div style={{ background: "#fff7e6", border: "1px solid #e67e22", borderRadius: 4,
              padding: "8px 10px", marginBottom: 8, fontSize: 11, color: "#8a5200" }}>
              ⚠ Missing prerequisites: {warnings.map((w) => w.missing_entity).join(", ")} —
              no chosen step produces these. Add a producer or reorder.
            </div>)}
          <div style={{ border: `1px solid ${t.border}`, borderRadius: 4, minHeight: 120 }}>
            {chosen.length === 0 && <div style={{ padding: 14, color: t.muted, fontSize: 12 }}>
              Click endpoints on the left to add them here.</div>}
            {chosen.map((c, i) => (
              <div key={c.endpoint_key} style={{ padding: "7px 10px", borderBottom: `1px solid ${t.bg}`,
                display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: t.muted, width: 16 }}>{i + 1}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", background: MC[c.method] || t.muted,
                  padding: "2px 5px", borderRadius: 3, minWidth: 38, textAlign: "center" }}>{c.method}</span>
                <span style={{ fontFamily: "monospace", fontSize: 12 }}>{c.path}</span>
                <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                  <button onClick={() => move(i, -1)} style={arrowBtn(t)}>↑</button>
                  <button onClick={() => move(i, 1)} style={arrowBtn(t)}>↓</button>
                  <button onClick={() => removeEp(c.endpoint_key)} style={{ ...arrowBtn(t), color: t.danger }}>✕</button>
                </span>
              </div>))}
          </div>
          <button onClick={save} disabled={!name || chosen.length === 0 || saving} style={{
            marginTop: 12, width: "100%", padding: "10px", fontSize: 14, fontWeight: 600, color: "#fff",
            background: (!name || chosen.length === 0) ? t.muted : t.success, border: "none",
            borderRadius: 6, cursor: (!name || chosen.length === 0 || saving) ? "default" : "pointer" }}>
            {saving ? "Saving…" : saved ? "✓ Saved" : "Save flow to catalog"}</button>
        </div>
      </div>
    </div>
  );
}

const arrowBtn = (t) => ({ border: `1px solid ${t.border}`, borderRadius: 3, background: t.panel,
  cursor: "pointer", fontSize: 11, width: 22, height: 22, color: t.sub, lineHeight: 1 });

function DependencyGraph({ t, deps }) {
  // gather unique endpoints, lay out source column + target column
  const froms = [...new Set(deps.map((d) => d.from_endpoint))];
  const tos = [...new Set(deps.map((d) => d.to_endpoint))];
  const NW = 230, NH = 40, GAP_Y = 18, X1 = 20, X2 = 340;
  const yOf = (arr, i) => 20 + i * (NH + GAP_Y);
  const fromPos = Object.fromEntries(froms.map((e, i) => [e, { x: X1, y: yOf(froms, i) }]));
  const toPos = Object.fromEntries(tos.map((e, i) => [e, { x: X2, y: yOf(tos, i) }]));
  const h = Math.max(yOf(froms, froms.length), yOf(tos, tos.length)) + 20;

  const node = (e, pos, method) => (
    <div key={e} style={{ position: "absolute", left: pos.x, top: pos.y, width: NW, height: NH,
      background: t.panel, border: `1px solid ${t.border}`, borderLeft: `3px solid ${METHOD_COLOR[method] || t.muted}`,
      borderRadius: t.radius.md, display: "flex", alignItems: "center", padding: "0 10px",
      fontSize: 12, boxShadow: t.shadow.reg }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: METHOD_COLOR[method] || t.muted,
        marginRight: 6 }}>{method}</span>
      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {e.replace(/^(GET|POST|PUT|DELETE)\s/, "")}</span>
    </div>
  );

  return (
    <div style={{ position: "relative", height: h, minWidth: X2 + NW + 20 }}>
      <svg width={X2 + NW + 20} height={h} style={{ position: "absolute", top: 0, left: 0 }}>
        <defs><marker id="apidep" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0 0 L6 3 L0 6 Z" fill={t.muted} /></marker></defs>
        {deps.map((d, i) => {
          const a = fromPos[d.from_endpoint], b = toPos[d.to_endpoint];
          const ax = a.x + NW, ay = a.y + NH / 2, bx = b.x, by = b.y + NH / 2, dx = (bx - ax) * 0.5;
          return <path key={i} d={`M${ax} ${ay} C${ax + dx} ${ay} ${bx - dx} ${by} ${bx} ${by}`}
            fill="none" stroke={t.muted} strokeWidth="1.5"
            strokeDasharray={d.dep_type === "calls" ? "none" : "4 3"} markerEnd="url(#apidep)" />;
        })}
      </svg>
      {froms.map((e) => node(e, fromPos[e], deps.find((d) => d.from_endpoint === e)?.method_from))}
      {tos.map((e) => node(e, toPos[e], deps.find((d) => d.to_endpoint === e)?.method_to))}
    </div>
  );
}

function FlowGraph({ t, flow }) {
  return (
    <div style={{ background: t.panel, border: `1px solid ${t.disabled}`,
      borderRadius: t.radius.md, padding: 25 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap" }}>
        {flow.steps.map((s, i) => (
          <React.Fragment key={s.step_order}>
            <div style={{ background: "#f3effd", border: `1px solid ${t.projPivotal}`,
              borderRadius: t.radius.md, padding: "12px 16px", minWidth: 150 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.projPivotal,
                textTransform: "uppercase" }}>Step {s.step_order}</div>
              <div style={{ fontSize: 13, fontWeight: 600, margin: "3px 0" }}>{s.label}</div>
              <div style={{ fontSize: 11, color: t.sub, fontFamily: "monospace" }}>{s.endpoint}</div>
              {s.variable_passed && s.variable_passed !== "-" && (
                <div style={{ fontSize: 10, color: t.modData, marginTop: 4 }}>
                  → {s.variable_passed}</div>)}
            </div>
            {i < flow.steps.length - 1 && (
              <div style={{ color: t.muted, fontSize: 18, padding: "0 8px" }}>▶</div>)}
          </React.Fragment>
        ))}
      </div>
      <div style={{ fontSize: 12, color: t.textMuted, marginTop: 15 }}>
        Variables passed between steps are shown under each call — the chain shows how one API's
        output feeds the next.
      </div>
    </div>
  );
}

const th = (t) => ({ background: "#f0f4f5", textAlign: "left", padding: "10px 14px", fontSize: 11,
  fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: t.accent,
  borderBottom: `1px solid ${t.disabled}` });
const td = (t) => ({ padding: "10px 14px", fontSize: 13, borderBottom: `1px solid ${t.bg}` });

// Adapter: /bf/api-flow/{id} -> the shape BusinessFlowDetail renders.
function EndpointDetail({ t, ep, onClose, MC }) {
  const fields = ep.fields || [];
  const errors = ep.errors || [];
  const reqFields = fields.filter((f) => f.required === "Y" || /request|body|param/i.test(f.field_name || ""));
  const th = { textAlign: "left", padding: "7px 10px", fontSize: 10, fontWeight: 700,
    textTransform: "uppercase", color: t.accent, borderBottom: `1px solid ${t.border}` };
  const td = { padding: "6px 10px", fontSize: 12, borderBottom: `1px solid ${t.bg}` };
  return (
    <div style={{ background: t.panel, border: `1px solid ${t.modApi}`, borderRadius: 6,
      padding: 18, marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: MC[ep.method] || t.muted,
          padding: "2px 8px", borderRadius: 3 }}>{ep.method}</span>
        <span style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 600, color: t.navy }}>{ep.path}</span>
        <span onClick={onClose} style={{ marginLeft: "auto", cursor: "pointer", color: t.muted, fontSize: 18 }}>×</span>
      </div>
      {ep.summary && <div style={{ fontSize: 12.5, color: t.sub, marginBottom: 14 }}>{ep.summary}</div>}

      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: t.muted, margin: "6px 0 6px" }}>
        Request / Response fields</div>
      <table style={{ width: "100%", borderCollapse: "collapse", background: t.panel, border: `1px solid ${t.border}`, borderRadius: 4, overflow: "hidden", marginBottom: 16 }}>
        <thead><tr>{["Field", "Type", "Required", "Business Meaning", "Example", "PII"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{fields.map((f, i) => (
          <tr key={i}>
            <td style={{ ...td, fontFamily: "monospace" }}>{f.field_name}</td>
            <td style={td}>{f.data_type}{f.max_length ? `(${f.max_length})` : ""}</td>
            <td style={td}>{f.required === "Y" ? <span style={{ color: "#c1113a", fontWeight: 700 }}>required</span> : "optional"}</td>
            <td style={td}>{f.description}</td>
            <td style={{ ...td, fontFamily: "monospace", color: t.muted }}>{f.example_value}</td>
            <td style={td}>{f.is_pii === "Y" ? <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", background: "#c1113a", padding: "1px 5px", borderRadius: 3 }}>PII</span> : ""}</td>
          </tr>))}
          {fields.length === 0 && <tr><td colSpan={6} style={{ ...td, color: t.muted }}>No field schema ingested for this endpoint.</td></tr>}</tbody>
      </table>

      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: t.muted, margin: "6px 0 6px" }}>
        Error codes</div>
      <table style={{ width: "100%", borderCollapse: "collapse", background: t.panel, border: `1px solid ${t.border}`, borderRadius: 4, overflow: "hidden" }}>
        <thead><tr>{["HTTP", "Error Code", "Business Exception", "Description"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{errors.map((e, i) => (
          <tr key={i}>
            <td style={{ ...td, fontWeight: 700, color: "#c1113a" }}>{e.http_status}</td>
            <td style={{ ...td, fontFamily: "monospace" }}>{e.error_code}</td>
            <td style={td}>{e.business_exception}</td>
            <td style={{ ...td, color: t.sub }}>{e.error_details}</td>
          </tr>))}
          {errors.length === 0 && <tr><td colSpan={4} style={{ ...td, color: t.muted }}>No error codes ingested for this endpoint.</td></tr>}</tbody>
      </table>
    </div>
  );
}

function _bfToBiz(d) {
  const f = d.flow || {};
  return {
    flow_id: f.flow_id, display_name: f.flow_name || f.flow_id,
    goal: f.goal, persona: f.business_domain, origin: "curated",
    trigger: f.trigger, primary_entity: f.primary_entity,
    steps: (d.steps || []).map((s) => ({ ...s, feature_group: s.operation_id })),
    datapoints: d.datapoints || [],
    batch_equivalent: d.batch_equivalent || [],
    compression_mart: d.compression_mart || null,
  };
}
