import React, { useState, useRef } from "react";

// =====================================================================
// Auto Mapper — standalone utility (Utilities nav group).
// Onboard a new aggregator/data source: upload its schema (CSV with
// field name / type / description / sample columns), choose the CP
// source to map into (PBDW or IMD), and get a proposed best-matching
// column per field with a 4-signal confidence breakdown. Nothing is
// written to the catalog — review, accept/reject, export as CSV.
//
// Matching here is client-side and heuristic (token expansion + type
// compatibility + trigram name similarity). It mirrors the shape of the
// server-side matcher so a future /mapper API can drop in behind the
// same UI.
// =====================================================================

const TOKEN_EXPANSIONS = {
  acct: "account", nm: "name", cd: "code", dt: "date", amt: "amount",
  val: "value", mkt: "market", qty: "quantity", pos: "position", sec: "security",
  txn: "transaction", num: "number", id: "identifier", desc: "description",
  addr: "address", stat: "status", bal: "balance", curr: "currency",
};

// representative target columns per CP source (name + type family)
const TARGETS = {
  PBDW: [
    ["DIM_ACCOUNT.ACCOUNT_NUMBER", "string"], ["DIM_ACCOUNT.ACCOUNT_SHORT_NAME", "string"],
    ["DIM_ACCOUNT.ACCOUNT_LONG_NAME_1", "string"], ["DIM_ACCOUNT.ACCOUNT_STATUS_CODE", "string"],
    ["DIM_ACCOUNT.ACCOUNT_MAIL_ADDRESS_1", "string"], ["DIM_SECURITY.CUSIP", "string"],
    ["DIM_SECURITY.SECURITY_DESCRIPTION", "string"], ["DIM_SECURITY.ASSET_CLASS_CODE", "string"],
    ["FACT_POSITION.MARKET_VALUE", "number"], ["FACT_POSITION.POSITION_QUANTITY", "number"],
    ["FACT_POSITION.POSITION_DATE", "date"], ["FACT_POSITION.TRADE_DATE", "date"],
    ["FACT_TRANSACTION.TRANSACTION_AMOUNT", "number"], ["FACT_TRANSACTION.TRANSACTION_CODE", "string"],
    ["FACT_TRANSACTION.SETTLEMENT_DATE", "date"], ["DIM_ACCOUNT.TAX_ID", "string"],
  ],
  IMD: [
    ["ACCT_MASTER.ACCT_NUM", "string"], ["ACCT_MASTER.ACCT_NAME", "string"],
    ["ACCT_MASTER.ACCT_STATUS", "string"], ["SEC_MASTER.SEC_ID", "string"],
    ["SEC_MASTER.SEC_DESC", "string"], ["POS_DAILY.MKT_VALUE", "number"],
    ["POS_DAILY.UNITS", "number"], ["POS_DAILY.AS_OF_DATE", "date"],
    ["TXN_HISTORY.TXN_AMT", "number"], ["TXN_HISTORY.TXN_TYPE", "string"],
  ],
};

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const expand = (s) => norm(s).split(" ").map((w) => TOKEN_EXPANSIONS[w] || w).join(" ");

function trigrams(s) {
  const set = new Set();
  const p = `  ${s} `;
  for (let i = 0; i < p.length - 2; i++) set.add(p.slice(i, i + 3));
  return set;
}
function sim(a, b) {
  const A = trigrams(expand(a)), B = trigrams(expand(b));
  let inter = 0;
  A.forEach((g) => { if (B.has(g)) inter++; });
  return A.size + B.size === 0 ? 0 : (2 * inter) / (A.size + B.size);
}
function typeFamily(ty) {
  const s = String(ty || "").toLowerCase();
  if (/date|time/.test(s)) return "date";
  if (/int|dec|num|float|double|money/.test(s)) return "number";
  return "string";
}
function bestMatch(field, targets) {
  const fam = typeFamily(field.type);
  let best = null;
  for (const [col, tfam] of targets) {
    const nameSim = sim(field.name, col.split(".").pop());
    const typeScore = fam === tfam ? 1 : 0.3;
    // description assist: similarity of field description vs the column name
    const descSim = field.desc ? Math.max(nameSim, sim(field.desc, col.split(".").pop()) * 0.9) : nameSim;
    const conf = 0.55 * nameSim + 0.25 * typeScore + 0.2 * descSim;
    if (!best || conf > best.conf) {
      best = { col, conf, parts: { "Name similarity": nameSim, "Type compatibility": typeScore,
        "Description assist": descSim } };
    }
  }
  return best;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const split = (l) => {
    const cells = [];
    let cur = "", inQ = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (inQ) {
        if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ",") { cells.push(cur); cur = ""; }
      else cur += ch;
    }
    cells.push(cur);
    return cells;
  };
  const hdr = split(lines[0]).map((h) => norm(h));
  const fi = (names) => hdr.findIndex((h) => names.includes(h));
  const iName = fi(["field", "field name", "name", "column", "attribute"]);
  const iType = fi(["type", "data type", "datatype"]);
  const iDesc = fi(["description", "desc"]);
  const iSample = fi(["sample", "sample value", "example"]);
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const c = split(lines[i]);
    const name = c[iName >= 0 ? iName : 0];
    if (!name) continue;
    out.push({ name, type: iType >= 0 ? c[iType] : "", desc: iDesc >= 0 ? c[iDesc] : "",
      sample: iSample >= 0 ? c[iSample] : "" });
  }
  return out;
}

export default function Mapper({ t }) {
  const [fields, setFields] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [src, setSrc] = useState("PBDW");
  const [results, setResults] = useState(null);
  const [selId, setSelId] = useState(0);
  const fileRef = useRef(null);

  const onFile = (f) => {
    if (!f) return;
    f.text().then((txt) => {
      const parsed = parseCsv(txt);
      setFields(parsed);
      setFileName(f.name);
      setResults(null);
    });
  };

  const run = () => {
    const targets = TARGETS[src];
    const rows = (fields || []).map((f, i) => {
      const m = bestMatch(f, targets);
      const conf = m ? m.conf : 0;
      return { id: i, fld: f.name, ty: f.type, sample: f.sample, desc: f.desc,
        tgt: m ? `${src}.${m.col}` : null, conf, parts: m ? m.parts : {},
        unmapped: conf < 0.6, verdict: conf >= 0.9 ? "ACC" : null };
    });
    setResults(rows);
    setSelId(0);
  };

  const setVerdict = (id, v) => setResults((r) =>
    r.map((x) => (x.id === id ? { ...x, verdict: x.verdict === v ? null : v } : x)));

  const exportCsv = () => {
    if (!results) return;
    const head = "aggregator_field,type,target,confidence,decision";
    const body = results.map((r) => [r.fld, r.ty, r.unmapped ? "" : r.tgt,
      Math.round(r.conf * 100) + "%", r.verdict || ""].map((c) =>
      `"${String(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([head + "\n" + body], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `mapping_${src.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const band = (c) => (c >= 0.9 ? "#159943" : c >= 0.6 ? "#e67e22" : "#c1113a");
  const hi = results ? results.filter((r) => r.conf >= 0.9).length : 0;
  const mid = results ? results.filter((r) => r.conf >= 0.6 && r.conf < 0.9).length : 0;
  const lo = results ? results.filter((r) => r.conf < 0.6).length : 0;
  const sel = results && results.find((r) => r.id === selId);

  const Card = ({ children, style }) => (
    <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 3,
      overflow: "hidden", ...style }}>{children}</div>);

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 600, color: t.navy }}>
        Auto Mapper <span style={{ fontSize: 12, fontWeight: 400, color: t.muted || t.textMuted }}>
          utility · aggregator onboarding</span></h1>
      <p style={{ fontSize: 12.5, color: t.sub || t.textMuted, margin: "6px 0 16px", maxWidth: 900,
        lineHeight: 1.5 }}>
        Onboard a new aggregator or data source: upload its schema (CSV with field name, type, optional
        description / sample), choose the CP source to map into, and review the proposed best-matching column
        per field. Standalone utility — nothing is written to the catalog until you export.</p>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ padding: "10px 15px", background: "#f2f5f7", borderBottom: `1px solid ${t.border}`,
          fontSize: 12, fontWeight: 700, color: t.navy }}>1 · Upload structure &nbsp;·&nbsp; 2 · Select source
          &nbsp;·&nbsp; 3 · Auto-map</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16, padding: 16 }}>
          <div>
            <div onClick={() => fileRef.current && fileRef.current.click()}
              style={{ border: `2px dashed ${t.border}`, borderRadius: 3, padding: 26, textAlign: "center",
                background: "#fafcfc", cursor: "pointer" }}>
              <div style={{ fontSize: 30, color: "#5f87a7" }}>⇧</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.navy, marginTop: 8 }}>
                Drop the aggregator schema here, or click to browse</div>
              <div style={{ fontSize: 11, color: t.muted || t.textMuted, marginTop: 3 }}>
                CSV — field name, type, and optional description / sample value</div>
              <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: "none" }}
                onChange={(e) => onFile(e.target.files && e.target.files[0])} />
            </div>
            {fields && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#e0f5fd",
                border: "1px solid #bfe3f2", borderRadius: 3, padding: "10px 14px", fontSize: 12,
                marginTop: 12 }}>
                ✔ <b style={{ color: t.navy }}>{fileName}</b> — {fields.length} fields parsed
                <span onClick={() => { setFields(null); setFileName(null); setResults(null); }}
                  style={{ marginLeft: "auto", color: t.muted || t.textMuted, cursor: "pointer" }}>✕</span>
              </div>)}
          </div>
          <div>
            <span style={{ display: "block", marginBottom: 6, fontSize: 9, fontWeight: 800,
              textTransform: "uppercase", letterSpacing: ".5px", color: t.muted || t.textMuted }}>
              Map into CP source</span>
            {[["PBDW", "#0b7d7d", "1,035 columns · 84 tables"], ["IMD", "#6d3ac0", "812 columns · 61 tables"]]
              .map(([k, c, ds]) => (
              <div key={k} onClick={() => setSrc(k)} style={{ display: "flex", alignItems: "center",
                gap: 10, border: `1px solid ${src === k ? t.accent : t.border}`,
                background: src === k ? "#e0f5fd" : t.panel, borderRadius: 3, padding: "11px 13px",
                cursor: "pointer", marginBottom: 8 }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, display: "flex",
                  alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800,
                  color: "#fff", background: c }}>{k[0]}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.navy }}>{k}</div>
                  <div style={{ fontSize: 10, color: t.muted || t.textMuted }}>{ds}</div>
                </div>
                <span style={{ marginLeft: "auto", color: t.accent, fontWeight: 800,
                  opacity: src === k ? 1 : 0 }}>✓</span>
              </div>))}
            <button onClick={run} disabled={!fields}
              style={{ width: "100%", marginTop: 6, height: 38, fontSize: 13, fontWeight: 700,
                borderRadius: 3, border: `1px solid ${fields ? t.accent : t.border}`,
                background: fields ? t.accent : "#f2f5f7",
                color: fields ? "#fff" : (t.muted || t.textMuted),
                cursor: fields ? "pointer" : "not-allowed", fontFamily: t.font }}>
              {fields ? `Auto-map ${fields.length} fields into ${src} →` : "Upload a schema first"}</button>
          </div>
        </div>
      </Card>

      {results && (
        <>
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            {[[hi, "High ≥90%", "#159943"], [mid, "Review 60–90%", "#e67e22"],
              [lo, "Unmatched <60%", "#c1113a"], [src, "Target", t.navy]].map(([n, l, c]) => (
              <div key={l} style={{ background: t.panel, border: `1px solid ${t.border}`,
                borderRadius: 3, padding: "10px 16px" }}>
                <b style={{ fontSize: 22, fontWeight: 800, color: c, display: "block" }}>{n}</b>
                <span style={{ fontSize: 10, color: t.muted || t.textMuted,
                  textTransform: "uppercase" }}>{l}</span>
              </div>))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 14,
            alignItems: "start" }}>
            <Card>
              <div style={{ padding: "10px 15px", background: "#f2f5f7",
                borderBottom: `1px solid ${t.border}`, fontSize: 12, fontWeight: 700, color: t.navy }}>
                Field mappings <span style={{ fontSize: 10, color: t.muted || t.textMuted,
                  fontWeight: 400 }}>aggregator field → {src} column · click for score breakdown</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 24px 1fr 100px 130px", gap: 10,
                padding: "7px 14px", background: "#f7f9fa", fontSize: 8.5, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: ".4px", color: t.muted || t.textMuted }}>
                <span>Aggregator field</span><span></span><span>Column</span>
                <span>Confidence</span><span>Decision</span></div>
              {results.map((r) => (
                <div key={r.id} onClick={() => setSelId(r.id)}
                  style={{ display: "grid", gridTemplateColumns: "1fr 24px 1fr 100px 130px", gap: 10,
                    alignItems: "center", padding: "9px 14px", borderTop: "1px solid #eef1f4",
                    cursor: "pointer", background: selId === r.id ? "#e0f5fd" : t.panel }}>
                  <span style={{ fontFamily: "monospace", fontSize: 11.5, color: t.navy,
                    fontWeight: 600 }}>{r.fld}
                    <span style={{ fontSize: 9.5, color: t.muted || t.textMuted, fontWeight: 400,
                      marginLeft: 6 }}>{r.ty}</span></span>
                  <span style={{ textAlign: "center", color: "#5f87a7" }}>→</span>
                  <span style={{ fontFamily: r.unmapped ? t.font : "monospace", fontSize: 11,
                    color: r.unmapped ? "#c1113a" : t.navy, fontWeight: 600 }}>
                    {r.unmapped ? "⚠ no confident match" : r.tgt}</span>
                  <span>
                    <span style={{ display: "inline-block", width: 54, height: 7,
                      background: "#e8edf0", borderRadius: 4, overflow: "hidden",
                      verticalAlign: "middle", marginRight: 7 }}>
                      <i style={{ display: "block", height: "100%",
                        width: `${Math.round(r.conf * 100)}%`, background: band(r.conf) }} /></span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: t.navy }}>
                      {Math.round(r.conf * 100)}%</span></span>
                  <span onClick={(e) => e.stopPropagation()}>
                    {[["ACC", "Accept", "#d0ebd9", "#159943"], ["REJ", "Reject", "#f3d2d7", "#c1113a"]]
                      .map(([v, label, bg, c]) => (
                      <span key={v} onClick={() => setVerdict(r.id, v)}
                        style={{ fontSize: 10, fontWeight: 700, padding: "4px 8px", borderRadius: 3,
                          border: `1px solid ${r.verdict === v ? c : t.border}`,
                          background: r.verdict === v ? bg : t.panel,
                          color: r.verdict === v ? c : (t.sub || t.textMuted),
                          cursor: "pointer", marginRight: 4 }}>{label}</span>))}
                  </span>
                </div>))}
            </Card>

            <Card>
              <div style={{ padding: "10px 15px", background: "#f2f5f7",
                borderBottom: `1px solid ${t.border}`, fontSize: 12, fontWeight: 700, color: t.navy }}>
                {sel ? `${sel.fld} → target` : "Select a field"}</div>
              {sel && (
                <div style={{ padding: "13px 15px", fontSize: 11, color: t.sub || t.textMuted,
                  lineHeight: 1.7 }}>
                  <b style={{ fontFamily: "monospace", color: t.navy }}>{sel.fld}</b>{" "}
                  <span style={{ fontFamily: "monospace", color: t.muted || t.textMuted }}>{sel.ty}</span>
                  {(sel.sample || sel.desc) && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "7px 0" }}>
                      {sel.sample && <span style={{ fontFamily: "monospace", fontSize: 9.5,
                        background: "#f2f5f7", border: "1px solid #e4eaee", padding: "2px 7px",
                        borderRadius: 3 }}>{sel.sample}</span>}
                      {sel.desc && <span style={{ fontSize: 10 }}>{sel.desc}</span>}
                    </div>)}
                  <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 10, marginTop: 8 }}>
                    <b style={{ color: t.navy }}>{sel.unmapped ? "Best (below threshold):" : "Suggested:"}</b>
                    <div style={{ fontFamily: "monospace", fontSize: 11.5, margin: "4px 0",
                      color: sel.unmapped ? "#c1113a" : t.navy }}>{sel.tgt || "—"}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "130px 1fr 40px",
                      gap: "5px 10px", margin: "10px 0", fontSize: 10 }}>
                      {Object.entries(sel.parts).map(([k, v]) => (
                        <React.Fragment key={k}>
                          <span>{k}</span>
                          <span style={{ height: 6, background: "#e8edf0", borderRadius: 3,
                            overflow: "hidden", alignSelf: "center" }}>
                            <i style={{ display: "block", height: "100%",
                              width: `${Math.round(v * 100)}%`, background: "#5f87a7" }} /></span>
                          <span>{Math.round(v * 100)}%</span>
                        </React.Fragment>))}
                    </div>
                    {sel.unmapped && <div style={{ fontSize: 10.5 }}>
                      No {src} column cleared the 60% threshold — likely a new attribute for this source.
                      Consider proposing a new column during onboarding.</div>}
                  </div>
                </div>)}
            </Card>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", background: t.panel,
            border: `1px solid ${t.border}`, borderRadius: 3, padding: "12px 16px", marginTop: 12 }}>
            <span style={{ fontSize: 12, color: t.sub || t.textMuted }}>
              <b style={{ color: t.navy }}>{results.length - lo} of {results.length}</b> fields mapped ·{" "}
              {results.filter((r) => r.verdict === "ACC").length} accepted · {lo} unmatched</span>
            <button onClick={exportCsv} style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700,
              padding: "8px 16px", borderRadius: 3, cursor: "pointer", fontFamily: t.font,
              border: `1px solid ${t.accent}`, background: t.accent, color: "#fff" }}>
              Export mapping (CSV)</button>
          </div>
        </>
      )}
    </div>
  );
}
