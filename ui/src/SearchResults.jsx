import React, { useState, useEffect } from "react";
import { SectionHeader } from "./AppShell.jsx";
import { api } from "./api.js";

// =====================================================================
// SearchResults v2 — the dedicated results screen for the global search.
//   - query-understanding bar (field code / filters / plain terms)
//   - INSTANT ANSWER card when the query is a field code: every master's
//     definition for that code + everywhere it lands (per warehouse)
//   - kind facets (live counts) + module counts preserved
//   - ranked cards with kind/master/PII pills, SCORE (when Oracle Text
//     is ranking), and an explicit destination line
// Reads #search?q=… exactly as before; clicking opens via onOpen(nav).
// =====================================================================

const MODULE_META = {
  api: { label: "API 360", color: "#159943" },
  data: { label: "Data 360", color: "#0091bf" },
  datapoint: { label: "Datapoint 360", color: "#0f4775" },
  interface: { label: "Interface 360", color: "#b8528a" },
  loader: { label: "Data 360 → Loaders", color: "#7c3aed" },
  pii: { label: "PII Explorer", color: "#c1113a" },
  lineage: { label: "Lineage", color: "#6d3ac0" },
};
const KIND_COLOR = {
  legacy_def: "#6d3ac0", datapoint: "#0091bf", field: "#0b5e83", canonical: "#0b5e83",
  feed: "#a8560f", loader: "#7c3aed", loader_attr: "#7c3aed", api: "#3f51b5",
  api_field: "#3f51b5", api_error: "#3f51b5", flow: "#3f51b5", pipeline: "#159943",
  dataset: "#159943", pii: "#c1113a",
};
const MASTER_C = {
  "Account Master": "#0f4775", "Master Account Master": "#b5651d",
  "Interested Party Master": "#0b7d7d", "Security Issue Master": "#6d3ac0",
};
const DS_C = { PBDW: "#0f4775", IMDS: "#0b7d9e" };

function Hl({ text, q }) {
  const t = String(text || ""), i = q ? t.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <>{t}</>;
  return <>{t.slice(0, i)}<mark style={{ background: "#fff3bf", padding: 0 }}>
    {t.slice(i, i + q.length)}</mark>{t.slice(i + q.length)}</>;
}

function InstantAnswer({ t, code, codeNorm, onOpen }) {
  const [defs, setDefs] = useState(null);
  const [used, setUsed] = useState([]);
  useEffect(() => {
    let dead = false;
    Promise.all([
      api.legacyBusinessDef(code, "ADDVANTAGE"),
      api.legacyWhereUsed(code),
    ]).then(([d, w]) => {
      if (dead) return;
      const all = [];
      if (d && d.definition) all.push(d.definition);
      (d && d.others ? d.others : []).forEach((o) => all.push(o));
      setDefs(all);
      setUsed((w && w.locations) || []);
    }).catch(() => !dead && setDefs([]));
    return () => { dead = true; };
  }, [code]);
  if (defs === null)
    return <div style={{ fontSize: 11, color: t.muted || "#999", margin: "6px 0 14px" }}>
      Resolving field code {code}…</div>;
  if (!defs.length) return null;
  const top = defs[0];
  const mc = MASTER_C[top.master_name] || "#6d3ac0";
  const jump = (id) => onOpen && onOpen({ module: "lineage", tab: "ADDVANTAGE",
    id, extra: code });
  return (
    <div style={{ border: `2px solid ${mc}`, borderRadius: 10, background: "#fff",
                  margin: "4px 0 16px", overflow: "hidden" }}>
      <div style={{ background: mc, color: "#fff", padding: "7px 15px", fontSize: 10.5,
                    fontWeight: 800, display: "flex", gap: 8, alignItems: "center" }}>
        INSTANT ANSWER · field code {code}
        <span style={{ marginLeft: "auto", fontWeight: 400, opacity: 0.9 }}>
          {defs.length} definition{defs.length !== 1 ? "s" : ""} — identity is (master + code)</span>
      </div>
      <div style={{ padding: "11px 15px" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.navy || "#10193b" }}>
          {top.business_term || top.asset_name}</div>
        <div style={{ fontSize: 10.5, color: t.sub || "#666", margin: "6px 0 4px" }}>
          One code, one meaning <b>per master</b> — pick a master to open its definition in Lineage:</div>
        <div>
          {defs.map((d) => (
            <span key={d.master_name || d.source_system}
              onClick={() => jump(codeNorm || code)}
              title={d.business_term || ""}
              style={{ display: "inline-block", fontSize: 9.5, fontWeight: 800, color: "#fff",
                       background: MASTER_C[d.master_name] || "#6d3ac0", borderRadius: 999,
                       padding: "3px 11px", margin: "2px 5px 0 0", cursor: "pointer" }}>
              {d.master_name || d.source_system}{d.business_term ? ` — ${d.business_term}` : ""}</span>))}
        </div>
        {used.length > 0 && (
          <div style={{ fontSize: 10.5, color: t.sub || "#666", marginTop: 9 }}>
            <b style={{ fontSize: 8.5, textTransform: "uppercase", color: t.muted || "#999" }}>
              Lands in&nbsp;</b>
            {used.slice(0, 8).map((u) => (
              <span key={u.data_source + u.dwh_target_table + u.dwh_target_column}
                onClick={() => jump(codeNorm || code)}
                style={{ display: "inline-block", fontFamily: "Roboto Mono, monospace",
                         fontSize: 9.5, margin: "2px 6px 0 0", padding: "2px 8px",
                         borderRadius: 3, background: "#f2f7fa", cursor: "pointer",
                         border: `1px solid ${DS_C[(u.data_source || "PBDW").toUpperCase()] || "#cfe6f2"}` }}>
                {u.dwh_target_table}.{u.dwh_target_column}
                <b style={{ marginLeft: 5,
                    color: DS_C[(u.data_source || "PBDW").toUpperCase()] || "#0f4775" }}>
                  {(u.data_source || "PBDW").toUpperCase()}</b></span>))}
          </div>)}
      </div>
    </div>);
}

export default function SearchResults({ t, onOpen }) {
  const initial = decodeURIComponent(
    (window.location.hash.split("?q=")[1] || "").split("&")[0] || "");
  const [q, setQ] = useState(initial);
  const [data, setData] = useState(null);
  const [kindFilter, setKindFilter] = useState(null);

  useEffect(() => {
    const h = () => setQ(decodeURIComponent(
      (window.location.hash.split("?q=")[1] || "").split("&")[0] || ""));
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  useEffect(() => {
    setKindFilter(null);
    if (q && q.length >= 2) api.search(q).then(setData);
    else setData(null);
  }, [q]);

  const results = (data && data.results) || [];
  const und = data && data.understood;
  const hlq = und && und.terms && und.terms.length ? und.terms[0] : q;
  const shown = kindFilter ? results.filter((r) => r.kind === kindFilter) : results;
  const kinds = {};
  results.forEach((r) => { kinds[r.kind] = (kinds[r.kind] || 0) + 1; });

  const destination = (r) => {
    if (r.kind === "legacy_def")
      return <>opens <b>Lineage → {(r.nav && r.nav.tab) || "AddVantage"}</b> with the inline
        definition panel open</>;
    const m = MODULE_META[r.module] || { label: r.module };
    return <>opens <b>{m.label}</b></>;
  };

  return (
    <div>
      <SectionHeader t={t}>Search</SectionHeader>
      <div style={{ fontSize: 17, fontWeight: 700, color: t.navy || "#10193b", margin: "4px 0" }}>
        Results for “{q}”</div>

      {/* query understanding */}
      {und && (und.code || Object.keys(und.filters || {}).length > 0) && (
        <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap",
                      margin: "6px 0", fontSize: 11, color: t.sub || "#666" }}>
          Understood as:
          {und.code && <span style={{ fontSize: 10, fontWeight: 800, color: "#6d3ac0",
            border: "1.5px solid #6d3ac0", borderRadius: 999, padding: "3px 11px" }}>
            # field code {und.code} → {und.code_norm}</span>}
          {Object.entries(und.filters || {}).map(([k, v]) => (
            <span key={k} style={{ fontSize: 10, fontWeight: 800,
              color: k === "is" ? "#c1113a" : (t.accent || "#0f4775"),
              border: `1.5px solid ${k === "is" ? "#c1113a" : (t.accent || "#0f4775")}`,
              borderRadius: 999, padding: "3px 11px" }}>{k}: {v}</span>))}
        </div>)}
      <div style={{ fontSize: 10.5, color: t.muted || "#999", marginBottom: 12 }}>
        {results.length} results
        {data && (data.full_text
          ? " · ranked by Oracle Text SCORE · exact-name boost"
          : " · unranked (LIKE fallback — run sql/30 + CTXAPP grant for ranking)")}
        {" · name + subtitle + body text"}</div>

      {und && und.code && <InstantAnswer t={t} code={und.code} codeNorm={und.code_norm}
        onOpen={onOpen} />}

      {q.length < 2 ? (
        <div style={{ fontSize: 12, color: t.muted || "#999" }}>Type at least 2 characters.</div>
      ) : !data ? (
        <div style={{ fontSize: 12, color: t.muted || "#999" }}>Searching…</div>
      ) : results.length === 0 ? (
        <div style={{ background: "#fff", border: `1px dashed ${t.panel2 || "#dfe6e9"}`,
                      borderRadius: 10, padding: 30, textAlign: "center" }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: t.navy || "#10193b" }}>No matches</div>
          <div style={{ fontSize: 11, color: t.muted || "#999", marginTop: 7, lineHeight: 1.7 }}>
            Search covers names, subtitles and full body text — this usually means a typo,
            or a term that isn't in the estate yet. Field codes work directly (BI/2-1);
            filters: is:pii · master:ip · ds:imds.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "185px 1fr", gap: 18,
                      alignItems: "start" }}>
          {/* facets */}
          <div style={{ background: "#fff", border: `1px solid ${t.panel2 || "#dfe6e9"}`,
                        borderRadius: 8, overflow: "hidden", position: "sticky", top: 70 }}>
            <div style={{ padding: "8px 13px", background: "#f2f5f7", fontSize: 9.5,
                          fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5,
                          color: t.muted || "#999" }}>Kind</div>
            <div onClick={() => setKindFilter(null)}
              style={{ display: "flex", padding: "7px 13px", fontSize: 11.5, cursor: "pointer",
                       borderTop: "1px solid #f0f3f6",
                       background: !kindFilter ? "#e9f2fa" : "#fff",
                       fontWeight: !kindFilter ? 700 : 400,
                       color: !kindFilter ? (t.accent || "#0f4775") : (t.sub || "#666") }}>
              All<span style={{ marginLeft: "auto", fontSize: 9.5, color: t.muted || "#999",
                fontFamily: "Roboto Mono, monospace" }}>{results.length}</span></div>
            {Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
              <div key={k} onClick={() => setKindFilter(kindFilter === k ? null : k)}
                style={{ display: "flex", padding: "7px 13px", fontSize: 11.5, cursor: "pointer",
                         borderTop: "1px solid #f0f3f6",
                         background: kindFilter === k ? "#e9f2fa" : "#fff",
                         fontWeight: kindFilter === k ? 700 : 400,
                         color: kindFilter === k ? (t.accent || "#0f4775") : (t.sub || "#666") }}>
                {k.replace(/_/g, " ")}
                <span style={{ marginLeft: "auto", fontSize: 9.5, color: t.muted || "#999",
                  fontFamily: "Roboto Mono, monospace" }}>{n}</span></div>))}
          </div>
          {/* result cards */}
          <div>
            {shown.map((r) => (
              <div key={r.artifact_key}
                onClick={() => onOpen && onOpen(r.nav || r)}
                style={{ background: "#fff", border: `1px solid ${t.panel2 || "#dfe6e9"}`,
                         borderLeft: `4px solid ${KIND_COLOR[r.kind] || "#dfe6e9"}`,
                         borderRadius: 8, padding: "10px 15px", marginBottom: 9,
                         cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 8, fontWeight: 800, textTransform: "uppercase",
                                 padding: "2px 7px", borderRadius: 3,
                                 background: "#f0f3f6", color: KIND_COLOR[r.kind] || "#556" }}>
                    {String(r.kind || "").replace(/_/g, " ")}</span>
                  {r.is_pii === "Y" && <span style={{ fontSize: 8, fontWeight: 800,
                    color: "#c1113a", background: "#f3d2d7", borderRadius: 3,
                    padding: "2px 7px" }}>PII</span>}
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: t.navy || "#10193b" }}>
                    <Hl text={r.name} q={hlq} /></span>
                  {data.full_text && <span style={{ marginLeft: "auto", fontSize: 8.5,
                    fontFamily: "Roboto Mono, monospace", color: t.muted || "#999" }}>
                    SCORE {Math.round(r.score || 0)}</span>}
                </div>
                <div style={{ fontSize: 10.5, color: t.sub || "#666", marginTop: 3 }}>
                  <Hl text={r.subtitle} q={hlq} /></div>
                <div style={{ fontSize: 9, color: t.muted || "#999", marginTop: 5 }}>
                  ↳ <span style={{ color: t.accent || "#0f4775" }}>{destination(r)}</span></div>
              </div>))}
          </div>
        </div>)}
    </div>);
}
