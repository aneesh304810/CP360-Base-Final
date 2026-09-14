import React, { useState, useEffect } from "react";
import { SectionHeader } from "./AppShell.jsx";
import ProjectSwitcher from "./ProjectSwitcher.jsx";
import ProjectBadge from "./ProjectBadge.jsx";
import PiiBadge from "./PiiBadge.jsx";
import { api } from "./api.js";

const TABS = ["By Attribute", "By Module", "By Project"];

export default function PiiExplorer({ t, selection }) {
  const [project, setProject] = useState("all");
  const [tab, setTab] = useState("By Attribute");
  const [stats, setStats] = useState(null);
  const [byAttr, setByAttr] = useState([]);
  const [byMod, setByMod] = useState([]);
  const [byProj, setByProj] = useState([]);

  useEffect(() => { api.piiStats().then(setStats).catch(() => {}); }, []);
  useEffect(() => {
    api.piiByAttribute().then((r) => setByAttr(r.attributes || r.rows || [])).catch(() => {});
    api.piiByModule().then((r) => setByMod(r.modules || r.rows || [])).catch(() => {});
    api.piiByProject().then((r) => setByProj(r.projects || r.rows || [])).catch(() => {});
  }, []);

  const kpi = (n, l, tone) => (
    <div style={{ background: t.panel, border: `1px solid ${t.disabled}`,
      borderRadius: t.radius.md, padding: "15px 20px", minWidth: 120 }}>
      <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.1,
        color: tone === "danger" ? t.danger : tone === "warn" ? t.warning : t.navy }}>{n}</div>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: 0.5, color: t.textMuted, marginTop: 4 }}>{l}</div>
    </div>
  );

  return (
    <div>
      <SectionHeader t={t}>PII Explorer</SectionHeader>
      <ProjectSwitcher t={t} value={project} onChange={setProject} stats={stats?.project_counts} />

      <div style={{ display: "flex", gap: 15, margin: "20px 0 30px", flexWrap: "wrap" }}>
        {kpi(stats?.attributes ?? "\u2014", "PII Attributes")}
        {kpi(stats?.components ?? "\u2014", "Components")}
        {kpi(stats?.affected_fields ?? "\u2014", "Affected Fields", "danger")}
        {kpi(stats?.affected_interfaces ?? "\u2014", "Affected Interfaces", "warn")}
      </div>

      <div style={{ display: "flex", gap: 2, marginBottom: 20,
        borderBottom: `1px solid ${t.disabled}` }}>
        {TABS.map((x) => (
          <button key={x} onClick={() => setTab(x)} style={{ background: "none", border: "none",
            fontFamily: t.font, fontSize: 13, fontWeight: 500, padding: "10px 18px", cursor: "pointer",
            color: tab === x ? t.accent : t.sub,
            borderBottom: `2px solid ${tab === x ? t.accent : "transparent"}`, marginBottom: -1 }}>
            {x}</button>
        ))}
      </div>

      {tab === "By Attribute" && (
        <Table t={t} head={["PII Attribute", "Sensitivity", "Fields", "SEI", "Non-SEI"]}
          rows={byAttr.map((a) => [
            a.pii_attribute || a.attribute,
            <PiiBadge key="b" category={a.sensitivity_category} t={t} />,
            a.field_count ?? a.fields ?? 0, a.sei_count ?? a.sei ?? 0,
            a.non_sei_count ?? a.non_sei ?? 0])} />
      )}
      {tab === "By Module" && (
        <Table t={t} head={["Module", "Matches", "Client", "Account", "Asset"]}
          rows={byMod.map((m) => [m.module, m.total ?? m.count ?? 0,
            m.client ?? 0, m.account ?? 0, m.asset ?? 0])} />
      )}
      {tab === "By Project" && (
        <Table t={t} head={["Project", "Total PII", "Client-Level", "Account-Level", "Asset-Level"]}
          rows={byProj.map((p) => [
            <ProjectBadge key="p" projectId={p.project_id} t={t} />,
            p.total ?? 0, p.client ?? 0, p.account ?? 0, p.asset ?? 0])} />
      )}
    </div>
  );
}

function Table({ t, head, rows }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", background: t.panel,
      border: `1px solid ${t.disabled}`, borderRadius: t.radius.md, overflow: "hidden" }}>
      <thead><tr>{head.map((h) => (
        <th key={h} style={{ background: "#f0f4f5", textAlign: "left", padding: "10px 14px",
          fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4,
          color: t.accent, borderBottom: `1px solid ${t.disabled}` }}>{h}</th>))}</tr></thead>
      <tbody>{rows.map((r, i) => (
        <tr key={i}>{r.map((c, j) => (
          <td key={j} style={{ padding: "10px 14px", fontSize: 13,
            borderBottom: `1px solid ${t.bg}` }}>{c}</td>))}</tr>))}</tbody>
    </table>
  );
}
