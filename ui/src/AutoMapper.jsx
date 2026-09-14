import React, { useState, useEffect } from "react";
import { SectionHeader } from "./AppShell.jsx";
import { api } from "./api.js";

const band = (c) => (c >= 0.9 ? "#159943" : c >= 0.6 ? "#e67e22" : "#c1113a");

export default function AutoMapper({ t }) {
  const [targets, setTargets] = useState([]);
  const [target, setTarget] = useState("");
  const [file, setFile] = useState(null);       // {name, fields[]}
  const [results, setResults] = useState(null); // score response
  const [verdicts, setVerdicts] = useState({}); // field -> ACC/REJ
  const [selField, setSelField] = useState(null);
  const [filt, setFilt] = useState("all");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const say = (m) => { setToast(m); setTimeout(() => setToast(null), 4200); };

  useEffect(() => {
    api.mapperTargets().then((r) => {
      const tg = r.targets || [];
      setTargets(tg);
      if (tg.length && !target) setTarget(tg[0].schema);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onUpload = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const fmt = f.name.toLowerCase().endsWith(".json") ? "json" : "csv";
      api.mapperParse(f.name, String(reader.result), fmt).then((r) => {
        if (r.ok) { setFile({ name: r.name, fields: r.fields }); setResults(null); setVerdicts({}); }
        else say(r.error || "Could not parse the file");
      });
    };
    reader.readAsText(f);
  };

  const runMap = () => {
    if (!file || !target) return;
    setBusy(true);
    api.mapperScore(target, file.fields).then((r) => {
      setBusy(false);
      if (!r.ok) { say(r.error || "Scoring failed"); return; }
      setResults(r);
      setSelField(r.results[0] && r.results[0].field);
      const v = {};
      r.results.forEach((x) => { if (x.best && x.best.confidence >= 0.9) v[x.field] = "ACC"; });
      setVerdicts(v);
    });
  };

  const doCommit = () => {
    const mappings = results.results.map((r) => ({
      field_name: r.field, field_type: r.type,
      target_key: r.best ? r.best.target_key : null,
      confidence: r.best ? r.best.confidence : null,
      parts: r.best ? r.best.parts : null,
      alternatives: (r.alternatives || []).map((a) => ({ key: a.target_key, conf: a.confidence })),
      verdict: verdicts[r.field] || null,
    }));
    api.mapperCommit(file.name, target, mappings).then((r) => {
      if (r.ok) say(`${r.committed} mapping(s) committed to onboarding as Auto-Mapped (pending review) — run ${r.run_id}`);
      else say(r.error || "Commit failed");
    });
  };

  const exportCsv = () => {
    const head = "field_name,field_type,target_key,confidence,verdict";
    const lines = results.results.map((r) =>
      [r.field, r.type, r.best ? r.best.target_key : "",
       r.best ? r.best.confidence : "", verdicts[r.field] || ""].join(","));
    const blob = new Blob([[head, ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(file.name || "mapping").replace(/\.[^.]+$/, "")}_mapping.csv`;
    a.click();
    say(`Mapping exported — ${lines.length} rows`);
  };

  const shown = results ? results.results.filter((r) =>
    filt === "all" ? true
      : filt === "review" ? (r.best && r.best.confidence < 0.9 && !r.unmapped)
      : r.unmapped) : [];
  const selR = results && results.results.find((r) => r.field === selField);

  const card = (children, header) => (
    <div style={{ background: t.panel, border: `1px solid ${t.panel2}`,
      borderRadius: t.radius.md, marginBottom: 14 }}>
      {header && <div style={{ padding: "9px 14px", borderBottom: `1px solid ${t.panel2}`,
        fontSize: 12, fontWeight: 700, color: t.navy }}>{header}</div>}
      {children}
    </div>);

  const chip = (label, on, onClick) => (
    <span onClick={onClick} style={{ fontSize: 10, fontWeight: 700, padding: "4px 11px",
      borderRadius: 999, cursor: "pointer", marginLeft: 6,
      border: `1px solid ${on ? t.accent : t.panel2}`,
      background: on ? t.infoBg : "#fff", color: on ? t.navy : t.sub }}>{label}</span>);

  return (
    <div>
      <SectionHeader t={t}>Auto Mapper</SectionHeader>
      <p style={{ fontSize: 13, color: t.sub, margin: "-18px 0 14px", maxWidth: 960 }}>
        Onboard a new aggregator or data source: upload its schema, choose the CP source
        system to map into, and CP 360 proposes the best-matching column for each field —
        ranked by name, type, embedding and value-profile similarity. Nothing is written
        to the catalog until you commit; commits land as <b>Auto-Mapped (pending review)</b>.
      </p>

      {card(
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16, padding: 16 }}>
          <div>
            <label style={{ display: "block", border: `2px dashed ${t.border}`,
              borderRadius: t.radius.md, padding: 26, textAlign: "center",
              background: "#fafcfc", cursor: "pointer" }}>
              <div style={{ fontSize: 26, color: t.muted }}>⇧</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.navy, marginTop: 6 }}>
                Drop the schema here, or click to browse</div>
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 3 }}>
                CSV or JSON — field name, type, optional description / sample</div>
              <input type="file" accept=".csv,.json,.txt" onChange={onUpload}
                style={{ display: "none" }} />
            </label>
            {file && (
              <div style={{ display: "flex", alignItems: "center", gap: 10,
                background: t.infoBg, border: "1px solid #bfe3f2",
                borderRadius: t.radius.md, padding: "10px 14px", fontSize: 12, marginTop: 12 }}>
                ✔ <b style={{ color: t.navy }}>{file.name}</b> — {file.fields.length} fields parsed
              </div>)}
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase",
              color: t.textMuted, marginBottom: 6 }}>Map into CP source</div>
            {targets.map((tg) => (
              <div key={tg.schema} onClick={() => setTarget(tg.schema)}
                style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                  border: `1px solid ${target === tg.schema ? t.accent : t.panel2}`,
                  background: target === tg.schema ? t.infoBg : "#fff",
                  borderRadius: t.radius.md, padding: "10px 12px", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.navy }}>{tg.schema}</div>
                  <div style={{ fontSize: 10, color: t.textMuted }}>
                    {tg.columns} columns · {tg.tables} tables</div>
                </div>
                {target === tg.schema && <span style={{ marginLeft: "auto",
                  color: t.accent, fontWeight: 800 }}>✓</span>}
              </div>))}
            <button onClick={runMap} disabled={!file || busy}
              style={{ width: "100%", marginTop: 10, height: 38, fontSize: 13,
                fontWeight: 700, borderRadius: t.radius.md, cursor: "pointer",
                border: `1px solid ${t.accent}`, background: file ? t.accent : t.disabled,
                color: "#fff" }}>
              {busy ? "Mapping…" : file
                ? `Auto-map ${file.fields.length} fields into ${target} →`
                : "Upload a schema first"}
            </button>
          </div>
        </div>,
        "1 · Upload structure  ·  2 · Select target source")}

      {results && (
        <>
          <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
            {[[results.summary.high, "High conf ≥90%", "#159943"],
              [results.summary.review, "Review 60–90%", "#e67e22"],
              [results.summary.unmatched, "Unmatched <60%", "#c1113a"],
              [results.target_schema, "Target", t.navy]].map(([n, l, c]) => (
              <div key={l} style={{ background: t.panel, border: `1px solid ${t.panel2}`,
                borderRadius: t.radius.md, padding: "8px 14px" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: c }}>{n}</div>
                <div style={{ fontSize: 9, textTransform: "uppercase", color: t.textMuted }}>{l}</div>
              </div>))}
            <span style={{ marginLeft: "auto" }}>
              {chip(`All ${results.summary.total}`, filt === "all", () => setFilt("all"))}
              {chip(`Needs review ${results.summary.review}`, filt === "review", () => setFilt("review"))}
              {chip(`Unmatched ${results.summary.unmatched}`, filt === "unmatched", () => setFilt("unmatched"))}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: 14, alignItems: "start" }}>
            {card(
              <div>
                {shown.map((r) => {
                  const conf = r.best ? r.best.confidence : 0;
                  const v = verdicts[r.field];
                  return (
                    <div key={r.field} onClick={() => setSelField(r.field)}
                      style={{ display: "grid", gridTemplateColumns: "1fr 24px 1.3fr 105px 125px",
                        gap: 8, alignItems: "center", padding: "9px 14px", cursor: "pointer",
                        borderTop: "1px solid #eef1f4",
                        background: selField === r.field ? t.infoBg : "transparent" }}>
                      <span style={{ fontFamily: "Roboto Mono, monospace", fontSize: 11.5,
                        fontWeight: 600, color: t.navy }}>{r.field}
                        <span style={{ fontSize: 9.5, color: t.textMuted, fontWeight: 400,
                          marginLeft: 6 }}>{r.type}</span></span>
                      <span style={{ textAlign: "center", color: t.muted }}>→</span>
                      <span style={{ fontSize: 11, fontFamily: r.unmapped ? t.font : "Roboto Mono, monospace",
                        fontWeight: 600, color: r.unmapped ? t.danger : t.navy, overflow: "hidden",
                        textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.unmapped ? "⚠ no confident match" : r.best.target_key}</span>
                      <span>
                        <span style={{ display: "inline-block", width: 56, height: 7,
                          background: "#e8edf0", borderRadius: 4, overflow: "hidden",
                          verticalAlign: "middle", marginRight: 6 }}>
                          <span style={{ display: "block", height: "100%",
                            width: `${Math.round(conf * 100)}%`, background: band(conf) }} />
                        </span>
                        <b style={{ fontSize: 11 }}>{Math.round(conf * 100)}%</b>
                      </span>
                      <span onClick={(e) => e.stopPropagation()}>
                        {["ACC", "REJ"].map((k) => (
                          <span key={k} onClick={() => setVerdicts({ ...verdicts, [r.field]: k })}
                            style={{ fontSize: 10, fontWeight: 700, padding: "4px 8px",
                              borderRadius: t.radius.md, cursor: "pointer", marginRight: 4,
                              border: `1px solid ${v === k ? (k === "ACC" ? "#a9dfc0" : "#e6a6a6") : t.panel2}`,
                              background: v === k ? (k === "ACC" ? t.successBg : t.dangerBg) : "#fff",
                              color: v === k ? (k === "ACC" ? t.success : t.danger) : t.sub }}>
                            {k === "ACC" ? "Accept" : "Reject"}</span>))}
                      </span>
                    </div>);
                })}
              </div>,
              "Field mappings · click a row for the score breakdown")}

            {selR && (
              <div style={{ position: "sticky", top: 12 }}>
                {card(
                  <div style={{ padding: "12px 14px", fontSize: 11, color: t.sub, lineHeight: 1.7 }}>
                    <b style={{ fontFamily: "Roboto Mono, monospace", color: t.navy }}>{selR.field}</b>{" "}
                    <span style={{ fontFamily: "Roboto Mono, monospace", color: t.textMuted }}>{selR.type}</span>
                    <div style={{ borderTop: `1px solid ${t.panel2}`, paddingTop: 10, marginTop: 8 }}>
                      <b style={{ color: t.navy }}>{selR.unmapped ? "Best (below threshold):" : "Suggested:"}</b>
                      <div style={{ fontFamily: "Roboto Mono, monospace", fontSize: 11.5,
                        margin: "4px 0", fontWeight: 600,
                        color: selR.unmapped ? t.danger : t.navy }}>
                        {selR.best ? selR.best.target_key : "—"}</div>
                      {selR.best && (
                        <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 38px",
                          gap: "5px 10px", margin: "10px 0", fontSize: 10 }}>
                          {Object.entries({ "Name similarity": "name", "Type/length": "type",
                            "Embedding": "embed", "Value profile": "value" }).map(([lbl, k]) => (
                            <React.Fragment key={k}>
                              <span>{lbl}</span>
                              <span style={{ height: 6, background: "#e8edf0", borderRadius: 3,
                                overflow: "hidden", alignSelf: "center" }}>
                                <span style={{ display: "block", height: "100%",
                                  width: `${Math.round((selR.best.parts[k] || 0) * 100)}%`,
                                  background: t.muted }} /></span>
                              <span>{Math.round((selR.best.parts[k] || 0) * 100)}%</span>
                            </React.Fragment>))}
                        </div>)}
                      {selR.best && selR.best.is_pii && (
                        <div style={{ fontSize: 10, color: t.danger, fontWeight: 700 }}>
                          ⚑ Target column carries PII — NYDFS 500 handling applies.</div>)}
                    </div>
                    {(selR.alternatives || []).length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <b style={{ fontSize: 10.5, color: t.navy }}>Alternatives</b>
                        {selR.alternatives.map((a) => (
                          <div key={a.target_key} style={{ border: `1px solid ${t.panel2}`,
                            borderRadius: t.radius.md, padding: "7px 10px", marginTop: 6,
                            fontFamily: "Roboto Mono, monospace", fontSize: 10.5 }}>
                            {a.target_key} <span style={{ color: t.textMuted }}>
                              ({a.confidence})</span></div>))}
                      </div>)}
                  </div>,
                  `${selR.field} → target`)}
              </div>)}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center",
            background: t.panel, border: `1px solid ${t.panel2}`,
            borderRadius: t.radius.md, padding: "12px 16px" }}>
            <span style={{ fontSize: 12, color: t.sub }}>
              <b style={{ color: t.navy }}>
                {results.summary.total - results.summary.unmatched} of {results.summary.total}
              </b> fields mapped · {Object.values(verdicts).filter((v) => v === "ACC").length} accepted
            </span>
            <span style={{ marginLeft: "auto" }} />
            <span onClick={exportCsv} style={{ fontSize: 12, fontWeight: 700,
              padding: "8px 16px", borderRadius: t.radius.md, cursor: "pointer",
              border: `1px solid ${t.panel2}`, background: "#fff", color: t.navy }}>
              Export mapping (CSV)</span>
            <span onClick={doCommit} style={{ fontSize: 12, fontWeight: 700,
              padding: "8px 16px", borderRadius: t.radius.md, cursor: "pointer",
              border: `1px solid ${t.accent}`, background: t.accent, color: "#fff" }}>
              Commit to onboarding →</span>
          </div>
        </>)}

      {toast && (
        <div style={{ position: "fixed", bottom: 22, right: 22, zIndex: 99,
          background: t.navy, color: "#fff", borderLeft: `3px solid ${t.pop}`,
          borderRadius: t.radius.md, padding: "11px 16px", fontSize: 12,
          boxShadow: t.shadow.lg, maxWidth: 380 }}>{toast}</div>)}
    </div>
  );
}
