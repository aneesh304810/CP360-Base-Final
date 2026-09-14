import React, { useState, useEffect, useCallback } from "react";
import { SectionHeader } from "./AppShell.jsx";
import { api } from "./api.js";

const SEV = { HIGH: "#c1113a", MED: "#e67e22", LOW: "#5f6f8f" };
const SEV_BG = { HIGH: "#f3d2d7", MED: "#fae5d3", LOW: "#e8edf2" };
const ST = { NEW: ["#e0f5fd", "#0091bf"], ACK: ["#fae5d3", "#e67e22"],
             RESOLVED: ["#d0ebd9", "#159943"], SUPPRESSED: ["#e8edf2", "#5f6f8f"] };
const SRC = { IMD: ["#efe6fb", "#6d3ac0"], PBDW: ["#e6f6f6", "#0b7d7d"],
              FEED: ["#fae5d3", "#e67e22"] };

export default function ImpactAnalysis({ t }) {
  const [tab, setTab] = useState("drift");
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [sources, setSources] = useState([]);
  const [selId, setSelId] = useState(null);
  const [toast, setToast] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [blastCols, setBlastCols] = useState([]);
  const [blastCol, setBlastCol] = useState("");
  const [blast, setBlast] = useState(null);

  const say = (msg) => { setToast(msg); setTimeout(() => setToast(null), 4200); };

  const reload = useCallback(() => {
    api.impactStats().then(setStats);
    api.impactFindings("NEW,ACK").then((r) => {
      const f = r.findings || [];
      setRows(f);
      setSelId((s) => (f.some((x) => x.finding_id === s) ? s : (f[0] && f[0].finding_id)));
    });
    api.impactScanSources().then((r) => setSources(r.sources || []));
  }, []);
  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    api.impactBlastColumns("").then((r) => {
      const cols = r.columns || [];
      setBlastCols(cols);
      if (cols.length && !blastCol) setBlastCol(cols[0]);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!blastCol) { setBlast(null); return; }
    api.impactBlast(blastCol).then(setBlast);
  }, [blastCol]);

  const runScan = () => {
    setScanning(true);
    api.impactScan().then((r) => {
      setScanning(false);
      if (r.ok) { say(`Scan complete — ${r.findings} finding(s)`); reload(); }
      else say(r.hint || r.error || "Scan could not run");
    });
  };

  const setStatus = (fid, status) => {
    api.impactSetStatus(fid, status).then((r) => {
      if (r.ok) {
        say(status === "RESOLVED"
          ? `Resolved — evidence closed under ${sel && sel.evidence_tag}`
          : `${status === "ACK" ? "Acknowledged" : status} — owners notified`);
        reload();
      } else say(r.error || "Update failed");
    });
  };

  const sel = rows.find((r) => r.finding_id === selId);

  const pill = (txt, bg, fg) => (
    <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 8px",
      borderRadius: 999, background: bg, color: fg }}>{txt}</span>);

  const kpi = (n, l, c) => (
    <div style={{ background: t.panel, border: `1px solid ${t.panel2}`,
      borderRadius: t.radius.md, padding: "10px 16px", minWidth: 100 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: c || t.navy }}>{n}</div>
      <div style={{ fontSize: 9, textTransform: "uppercase", color: t.textMuted }}>{l}</div>
    </div>);

  const btn = (label, onClick, primary) => (
    <span onClick={onClick} style={{ fontSize: 11, fontWeight: 700,
      padding: "6px 12px", borderRadius: t.radius.md, cursor: "pointer",
      border: `1px solid ${primary ? t.accent : t.panel2}`,
      background: primary ? t.accent : "#fff",
      color: primary ? "#fff" : t.navy, marginRight: 6 }}>{label}</span>);

  return (
    <div>
      <SectionHeader t={t}>Impact Analysis</SectionHeader>
      <p style={{ fontSize: 13, color: t.sub, margin: "-18px 0 14px", maxWidth: 960 }}>
        Schema and feed-file drift with blast radius to feeds and systems.
        Severity = consumers × PII × change kind. Every finding carries an
        NYDFS evidence tag and an acknowledge / resolve workflow.
      </p>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
        background: t.panel, border: `1px solid ${t.panel2}`,
        borderRadius: t.radius.md, padding: "8px 14px", marginBottom: 14 }}>
        {sources.map((s) => (
          <span key={s.source} style={{ display: "flex", gap: 6, alignItems: "center",
            background: "#f2f5f7", border: `1px solid ${t.panel2}`,
            borderRadius: t.radius.md, padding: "4px 10px", fontSize: 11 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: t.success }} />
            <b style={{ color: t.navy }}>{s.source}</b>
            <span style={{ color: t.sub }}>{s.taken_at || "no snapshot"} · {s.col_count ?? "—"} cols</span>
          </span>))}
        <span style={{ marginLeft: "auto" }}>
          {btn(scanning ? "Scanning…" : "Run scan now", scanning ? undefined : runScan, true)}
        </span>
      </div>

      {stats && (
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          {kpi(stats.open, "Open", SEV.HIGH)}
          {kpi(stats.high, "High", SEV.HIGH)}
          {kpi(stats.med, "Med", SEV.MED)}
          {kpi(stats.suppressed, "Suppressed")}
          {kpi(stats.resolved, "Resolved", t.success)}
        </div>)}

      <div style={{ display: "flex", gap: 8, borderBottom: `1px solid ${t.panel2}`, marginBottom: 14 }}>
        {[["drift", `Schema Drift (${rows.length})`], ["blast", "Blast Radius"]].map(([k, l]) => (
          <span key={k} onClick={() => setTab(k)} style={{ fontSize: 12.5, fontWeight: 600,
            padding: "8px 16px", cursor: "pointer", marginBottom: -1,
            color: tab === k ? t.accent : t.sub,
            borderBottom: `2px solid ${tab === k ? t.accent : "transparent"}` }}>{l}</span>))}
      </div>

      {tab === "drift" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: 14, alignItems: "start" }}>
          <div style={{ background: t.panel, border: `1px solid ${t.panel2}`, borderRadius: t.radius.md }}>
            <div style={{ padding: "9px 14px", borderBottom: `1px solid ${t.panel2}`,
              fontSize: 12, fontWeight: 700, color: t.navy }}>
              Drift findings <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 400 }}>
                · dictionary diff + feed files</span>
            </div>
            {rows.length === 0 && (
              <div style={{ padding: 22, fontSize: 12, color: t.sub }}>
                No open findings. Run a scan after the next ingestion to compare snapshots.
              </div>)}
            {rows.map((r) => (
              <div key={r.finding_id} onClick={() => setSelId(r.finding_id)}
                style={{ display: "grid", gridTemplateColumns: "52px 56px 1fr 70px",
                  gap: 10, alignItems: "center", padding: "9px 14px", cursor: "pointer",
                  borderTop: `1px solid #eef1f4`,
                  background: selId === r.finding_id ? t.infoBg : "transparent" }}>
                {pill(r.severity, SEV_BG[r.severity], SEV[r.severity])}
                {pill(r.source_kind, ...(SRC[r.source_kind] || ["#eef1f4", t.sub]))}
                <div>
                  <div style={{ fontFamily: "Roboto Mono, monospace", fontSize: 11.5,
                    fontWeight: 600, color: t.navy }}>{r.object_key}</div>
                  <div style={{ fontSize: 10, color: t.sub }}>
                    {r.drift_kind} · {r.downstream_feeds} feeds · {(r.downstream_systems || []).join(", ") || "—"}
                  </div>
                </div>
                {pill(r.status, ...(ST[r.status] || ST.NEW))}
              </div>))}
          </div>

          {sel && (
            <div style={{ position: "sticky", top: 12, background: t.panel,
              border: `1px solid ${t.panel2}`, borderRadius: t.radius.md }}>
              <div style={{ padding: "9px 14px", borderBottom: `1px solid ${t.panel2}`,
                fontSize: 12, fontWeight: 700, color: t.navy }}>
                Finding · {sel.drift_kind}
                <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 400 }}> · {sel.found_at}</span>
              </div>
              <div style={{ padding: "12px 14px", fontSize: 11.5, color: t.sub, lineHeight: 1.7 }}>
                <b style={{ fontFamily: "Roboto Mono, monospace", color: t.navy }}>{sel.object_key}</b>
                <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "7px 0",
                  fontFamily: "Roboto Mono, monospace", fontSize: 11.5 }}>
                  {sel.was_value && <span style={{ background: t.dangerBg, color: t.danger,
                    textDecoration: "line-through", padding: "2px 8px",
                    borderRadius: t.radius.md }}>{sel.was_value}</span>}
                  <span style={{ color: t.textMuted }}>→</span>
                  <span style={{ background: t.successBg, color: t.success, fontWeight: 700,
                    padding: "2px 8px", borderRadius: t.radius.md }}>{sel.now_value || "DROPPED"}</span>
                </div>
                {sel.detail}
                <div style={{ margin: "8px 0", fontSize: 10.5 }}>
                  <b style={{ color: t.navy }}>{sel.downstream_feeds}</b> feed(s) ·{" "}
                  <b style={{ color: t.navy }}>{(sel.downstream_systems || []).join(" · ") || "no systems resolved"}</b>
                </div>
                {(sel.owners || []).length > 0 && (
                  <div style={{ background: "#f8fafb", border: `1px dashed ${t.panel2}`,
                    borderRadius: t.radius.md, padding: "7px 10px", fontSize: 10, margin: "6px 0" }}>
                    🔔 Routed to <b>{sel.owners.join(", ")}</b>
                  </div>)}
                <div style={{ margin: "6px 0" }}>
                  {pill(sel.evidence_tag, t.infoBg, t.info)}{" "}
                  {pill(sel.scan_id, t.infoBg, t.info)}
                </div>
                <div style={{ marginTop: 10 }}>
                  {btn("Ack", () => setStatus(sel.finding_id, "ACK"))}
                  {btn("Resolve", () => setStatus(sel.finding_id, "RESOLVED"), true)}
                  {btn("Suppress", () => setStatus(sel.finding_id, "SUPPRESSED"))}
                </div>
              </div>
            </div>)}
        </div>)}

      {tab === "blast" && (
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: t.sub }}>Trace impact from:</span>
            <select value={blastCol} onChange={(e) => setBlastCol(e.target.value)}
              style={{ height: 32, border: `1px solid ${t.panel2}`, borderRadius: t.radius.md,
                padding: "0 10px", fontSize: 12, fontFamily: "Roboto Mono, monospace", minWidth: 320 }}>
              {blastCols.map((c) => <option key={c}>{c}</option>)}
            </select>
            <span style={{ marginLeft: "auto", fontSize: 10.5, color: t.textMuted }}>
              column → mappings → tables → feeds → systems</span>
          </div>
          {blast && (
            <div style={{ background: t.panel, border: `1px solid ${t.panel2}`,
              borderRadius: t.radius.md, padding: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 0 }}>
                {[["Column", [blast.column], true], ["Mappings", blast.mappings],
                  ["Tables", blast.tables], ["Feeds", blast.feeds],
                  ["Systems", blast.systems, false, true]].map(([lbl, items, origin, hot]) => (
                  <div key={lbl} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 8.5, fontWeight: 800, textTransform: "uppercase",
                      color: t.textMuted, marginBottom: 6 }}>{lbl} {items.length > 1 ? `(${items.length})` : ""}</div>
                    {(items.length ? items.slice(0, 8) : ["—"]).map((it, i) => (
                      <div key={i} style={{ background: origin ? t.infoBg : hot ? t.dangerBg : "#fff",
                        border: `1px solid ${hot ? "#e6a6a6" : origin ? t.accent : t.panel2}`,
                        borderRadius: t.radius.md, padding: "6px 8px", margin: "5px 8px",
                        fontFamily: hot ? t.font : "Roboto Mono, monospace",
                        fontSize: 10.5, fontWeight: origin || hot ? 700 : 600,
                        color: hot ? t.danger : t.navy, overflow: "hidden",
                        textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={it}>{it}</div>))}
                    {items.length > 8 && <div style={{ fontSize: 9, color: t.textMuted }}>+{items.length - 8} more</div>}
                  </div>))}
              </div>
              <div style={{ fontSize: 11, color: t.sub, borderTop: `1px solid ${t.panel2}`,
                paddingTop: 12, marginTop: 10 }}>
                <b>{blast.column}</b> reaches <b>{blast.systems.length}</b> system(s) through{" "}
                <b>{blast.feeds.length}</b> feed(s).
                {blast.owners.length > 0 && <> Coordinate with {blast.owners.join(", ")} before a change lands.</>}
              </div>
            </div>)}
        </div>)}

      {toast && (
        <div style={{ position: "fixed", bottom: 22, right: 22, zIndex: 99,
          background: t.navy, color: "#fff", borderLeft: `3px solid ${t.pop}`,
          borderRadius: t.radius.md, padding: "11px 16px", fontSize: 12,
          boxShadow: t.shadow.lg, maxWidth: 380 }}>{toast}</div>)}
    </div>
  );
}
