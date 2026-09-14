import React, { useState, useEffect } from "react";
import { SectionHeader } from "./AppShell.jsx";
import { api } from "./api.js";
import LegacyLineage from "./LegacyLineage.jsx";

// =====================================================================
// Lineage — standalone page. Thin wrapper around the LegacyLineage v5
// engine. This wrapper owns:
//   - SEI | Non-SEI scope (SEI arrives with the SWP program)
//   - AddVantage / CRD / STAR system badges (from /legacy-lineage/systems)
//   - the DATA SOURCE row: PB Datawarehouse / IMDS Datawarehouse chips
//     (from /legacy-lineage/data-sources) — the target-warehouse scope
//     the engine filters every fetch by
//   - search / Datapoint 360 deep-links: selection {tab: system, id: code}
//     resolves to a DWH table.column and passes to the engine as focus
// The business-definition popup is retired — definitions render inline
// inside the engine.
// =====================================================================

const SYS_META = {
  ADDVANTAGE: { label: "AddVantage", c: "#6d3ac0", bg: "#efe6fb" },
  CRD: { label: "CRD", c: "#0b7d7d", bg: "#e6f6f6" },
  STAR: { label: "STAR", c: "#b5651d", bg: "#f6ecdf" },
};
const DS_META = {
  PBDW: { label: "PB Datawarehouse", c: "#0f4775" },
  IMDS: { label: "IMDS Datawarehouse", c: "#0b7d9e" },
};
const dsMeta = (d) => DS_META[(d || "").toUpperCase()] ||
  { label: d, c: "#0f4775" };

export default function Lineage({ t, selection }) {
  const [scope, setScope] = useState("nonsei");
  const [systems, setSystems] = useState([]);
  const [curSys, setCurSys] = useState("ADDVANTAGE");
  const [dataSources, setDataSources] = useState([]);
  const [curDs, setCurDs] = useState("PBDW");
  const [focus, setFocus] = useState(null);

  useEffect(() => {
    api.legacySystems().then((d) => {
      const sys = d.systems || [];
      setSystems(sys);
      if (sys.length && !sys.find((s) => s.source_system === curSys))
        setCurSys(sys[0].source_system);
    });
    api.legacyDataSources().then((d) => {
      const list = d.data_sources || [];
      setDataSources(list.length ? list : [{ data_source: "PBDW" }]);
      if (list.length && !list.find((x) => (x.data_source || "").toUpperCase() === curDs))
        setCurDs((list[0].data_source || "PBDW").toUpperCase());
    });
  }, []);

  // deep-link from search / Datapoint 360: selection {tab: system, id: code}
  useEffect(() => {
    if (!selection || !selection.id) return;
    setScope("nonsei");
    if (selection.tab && SYS_META[selection.tab]) setCurSys(selection.tab);
    api.legacyDictionary(selection.tab || curSys, selection.id).then((d) => {
      const hit = (d.definitions || []).find(
        (x) => x.field_code === selection.id || x.field_code_norm === selection.id);
      if (hit && hit.lineage_target) {
        const [table, column] = String(hit.lineage_target).split(".");
        if (table) setFocus({ table, column });
      }
    });
  }, [selection]);

  // cross-warehouse jump from the engine's inline panel
  const switchDataSource = (ds, loc) => {
    setCurDs((ds || "PBDW").toUpperCase());
    if (loc && loc.table) setFocus({ table: loc.table, column: loc.column });
  };

  const scopeBtn = (k, label) => (
    <button key={k} onClick={() => setScope(k)}
      style={{ fontSize: 12, fontWeight: 700, padding: "7px 20px", cursor: "pointer",
               fontFamily: "inherit",
               borderStyle: "solid",
               borderColor: scope === k ? (t.accent || "#0f4775") : (t.panel2 || "#dfe6e9"),
               borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1,
               borderLeftWidth: k === "sei" ? 1 : 0,
               borderRadius: k === "sei" ? "3px 0 0 3px" : "0 3px 3px 0",
               background: scope === k ? (t.accent || "#0f4775") : "#fff",
               color: scope === k ? "#fff" : (t.sub || "#666") }}>{label}</button>);

  return (
    <div>
      <SectionHeader t={t}>Lineage</SectionHeader>
      <div style={{ fontSize: 11.5, color: t.sub || "#666", margin: "-18px 0 6px" }}>
        Legacy end-to-end lineage — SRC → STG1 → STG2 → DWH with business definitions, proof
        values, and dependency views</div>
      <div style={{ display: "flex", margin: "10px 0" }}>
        {scopeBtn("sei", "SEI")}
        {scopeBtn("nonsei", "Non-SEI")}
      </div>

      {scope === "sei" && (
        <div style={{ background: t.panel || "#fff", border: `1px solid ${t.panel2 || "#dfe6e9"}`,
                      borderRadius: 3, padding: 44, textAlign: "center",
                      color: t.muted || "#999", fontSize: 13 }}>
          🧬 SEI lineage — arriving with the SWP program.<br />
          <span style={{ fontSize: 11 }}>Non-SEI (AddVantage) is available now.</span>
        </div>)}

      {scope === "nonsei" && (
        <>
          {/* legacy system badges */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
                        padding: "9px 14px", background: "#fbfcfe",
                        border: `1px solid ${t.panel2 || "#dfe6e9"}`, borderRadius: 3 }}>
            <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase",
                           letterSpacing: 0.5, color: t.muted || "#999" }}>Legacy system</span>
            {Object.entries(SYS_META).map(([k, m]) => {
              const present = systems.find((s) => s.source_system === k);
              const on = curSys === k;
              return (
                <span key={k}
                  onClick={present ? () => setCurSys(k) : undefined}
                  title={present ? `${present.def_count || ""} definitions`
                                 : `${m.label} workbook pending`}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12,
                           fontWeight: 700, padding: "5px 13px", borderRadius: 999,
                           border: `1.5px solid ${on ? m.c : (t.panel2 || "#dfe6e9")}`,
                           background: on ? m.c : "#fff",
                           color: on ? "#fff" : (t.sub || "#666"),
                           opacity: present ? 1 : 0.5,
                           cursor: present ? "pointer" : "not-allowed" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%",
                                 background: on ? "#fff" : m.c }} />
                  {m.label}
                  {present && <span style={{ fontSize: 9, opacity: 0.8 }}>
                    {present.def_count}</span>}
                </span>);
            })}
          </div>

          {/* data source (target warehouse) chips */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
                        padding: "9px 14px", background: "#f7fbfd",
                        border: `1px solid ${t.panel2 || "#dfe6e9"}`, borderRadius: 3 }}>
            <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase",
                           letterSpacing: 0.5, color: t.muted || "#999" }}>
              Data source · lineage target</span>
            {dataSources.map((d) => {
              const key = (d.data_source || "PBDW").toUpperCase();
              const m = dsMeta(key);
              const on = curDs === key;
              return (
                <span key={key} onClick={() => { setCurDs(key); setFocus(null); }}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12,
                           fontWeight: 700, padding: "5px 13px", borderRadius: 999,
                           border: `1.5px solid ${on ? m.c : (t.panel2 || "#dfe6e9")}`,
                           background: on ? m.c : "#fff",
                           color: on ? "#fff" : (t.sub || "#666"), cursor: "pointer" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%",
                                 background: on ? "#fff" : m.c }} />
                  {m.label}
                  {d.field_count != null && (
                    <span style={{ fontSize: 9, opacity: 0.8 }}>{d.field_count} mapped</span>)}
                </span>);
            })}
            <span style={{ marginLeft: "auto", fontSize: 10.5, color: t.muted || "#999" }}>
              {SYS_META[curSys] ? SYS_META[curSys].label : curSys} → {dsMeta(curDs).label} mappings</span>
          </div>

          <LegacyLineage t={t} system={curSys} dataSource={curDs}
            onDataSource={switchDataSource} focus={focus} />
        </>)}
    </div>);
}
