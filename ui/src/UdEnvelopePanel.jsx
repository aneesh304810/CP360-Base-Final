// The UD envelope on the lineage screen: the CLOB read as structure.
//
// WHAT THIS REPLACES. The stage-by-stage proof for USER_DEFINED_ATTRIBUTE_CLOB
// printed the whole JSON per stage: a wall of a hundred keys with client
// values in it, unreadable and unsafe to leave on a screen. This panel
// parses the same proof and shows the envelope as what it is: keys grouped
// into blocks (UD_23 household, UD_32 billing lines) and singles, each
// with its dictionary name, domain and value class from the UD registry,
// and a per-stage verdict (same / differs / missing) instead of three
// copies of the text. Values are masked to their shape by default; the
// reader reveals them deliberately.
//
// The registry comes from /advantage-ud (sql/76). Without it the panel
// still structures the JSON by key and says the registry is not loaded.

import React, { useEffect, useMemo, useState } from "react";
import { advantageUdApi } from "./advantageUd.js";

export const UD_CLOB_COLUMN = "USER_DEFINED_ATTRIBUTE_CLOB";
export const isUdClob = (f) => String(f?.dwh_target_column || "").toUpperCase() === UD_CLOB_COLUMN;

const STAGES = ["SRC", "STG1", "STG2", "DWH"];
const STAGE_C = { SRC: "#b0642a", STG1: "#0b6a8a", STG2: "#6d3ac0", DWH: "#159943" };
const mono = { fontFamily: "Roboto Mono, monospace" };

/* One stage's proof text -> {keys: {UD_1: "..."}, error}. Oracle CLOB
   proofs sometimes arrive doubly quoted ("{""UD_1"":...}"); unwrap once. */
export function parseStage(text) {
  if (text == null || text === "") return { keys: null, error: "empty" };
  let s = String(text).trim();
  if (s.length > 1 && s[0] === '"' && s[s.length - 1] === '"' && s.includes('""')) {
    s = s.slice(1, -1).replace(/""/g, '"');
  }
  try {
    const o = JSON.parse(s);
    if (!o || typeof o !== "object" || Array.isArray(o)) return { keys: null, error: "not an object" };
    const keys = {};
    Object.keys(o).forEach((k) => { keys[String(k).trim().toUpperCase()] = o[k]; });
    return { keys, error: null };
  } catch (e) {
    return { keys: null, error: "invalid JSON" };
  }
}

/* proof rows -> {stages: {STG1: {keys, error}}, order: [stages seen]} */
export function parseProof(proof) {
  const stages = {};
  (proof || []).forEach((p) => { if (p && p.stage) stages[p.stage] = parseStage(p.field_value); });
  return { stages, order: STAGES.filter((s) => stages[s]) };
}

const splitKey = (k) => {
  const m = /^UD_(\d+)(?:_(\d+))?$/.exec(k);
  if (!m) return { n: null, parent: null, seq: null };
  return { n: Number(m[1]), parent: m[2] ? `UD_${m[1]}` : null, seq: m[2] ? Number(m[2]) : null };
};

/* All keys across stages, each with its per-stage values and a verdict. */
export function keyRows(parsed) {
  const all = new Set();
  parsed.order.forEach((s) => Object.keys(parsed.stages[s].keys || {}).forEach((k) => all.add(k)));
  const rows = [...all].map((k) => {
    const vals = {};
    parsed.order.forEach((s) => { const ks = parsed.stages[s].keys; if (ks && k in ks) vals[s] = ks[k]; });
    const present = parsed.order.filter((s) => parsed.stages[s].keys && s in vals);
    const parsedStages = parsed.order.filter((s) => parsed.stages[s].keys);
    const distinct = new Set(present.map((s) => String(vals[s] ?? "").trim()));
    let verdict = "same";
    if (present.length < parsedStages.length) verdict = "missing";
    else if (distinct.size > 1) verdict = "differs";
    const sk = splitKey(k);
    return { key: k, ...sk, values: vals, present, verdict };
  });
  rows.sort((a, b) => (a.n ?? 1e9) - (b.n ?? 1e9) || (a.seq ?? 0) - (b.seq ?? 0) || a.key.localeCompare(b.key));
  return rows;
}

/* Group rows into blocks (by parent) and singles, in key order. */
export function groupRows(rows) {
  const groups = [];
  const byParent = new Map();
  rows.forEach((r) => {
    if (r.parent) {
      if (!byParent.has(r.parent)) { byParent.set(r.parent, { id: r.parent, block: true, rows: [] }); groups.push(byParent.get(r.parent)); }
      byParent.get(r.parent).rows.push(r);
    } else groups.push({ id: r.key, block: false, rows: [r] });
  });
  return groups;
}

/* The shape of a value, never the value. */
export function maskValue(v, reg) {
  if (v == null) return "∅";
  const s = String(v);
  if (s === "") return "blank";
  if (/^[YN]$/i.test(s)) return s.toUpperCase();
  const eq = s.indexOf("=");
  if (eq > 0 && eq <= 12 && !/\s/.test(s.slice(0, eq))) return `${s.slice(0, eq)}=<${s.length - eq - 1} chars>`;
  if (/^\d+$/.test(s)) return s[0] === "0" && s.length > 1 ? `${"0".repeat(s.length)} (leading zeros)` : "#".repeat(s.length);
  return `<${reg?.value_class ? reg.value_class.toLowerCase() : "text"} · ${s.length} chars>`;
}

const VERDICT = {
  same: ["#d0ebd9", "#159943", "same across stages"],
  differs: ["#fae5d3", "#e67e22", "differs between stages"],
  missing: ["#f3d2d7", "#c1113a", "missing in a stage"],
};

let _regCache = null;
function loadRegistry() {
  if (!_regCache) _regCache = advantageUdApi.registry().then((r) => {
    const m = {};
    (r.attributes || []).forEach((a) => { m[a.attribute_name] = a; });
    return m;
  }).catch(() => ({}));
  return _regCache;
}

export default function UdEnvelopePanel({ t, field, proof, table }) {
  const [reg, setReg] = useState(null);
  const [reveal, setReveal] = useState(false);
  const [raw, setRaw] = useState(false);
  const [only, setOnly] = useState("all");        // all | differs | missing
  useEffect(() => { let live = true; loadRegistry().then((m) => { if (live) setReg(m); }); return () => { live = false; }; }, []);

  const parsed = useMemo(() => parseProof(proof), [proof]);
  const rows = useMemo(() => keyRows(parsed), [parsed]);
  const groups = useMemo(() => groupRows(rows), [rows]);
  const loaded = reg && Object.keys(reg).length > 0;
  const nDiff = rows.filter((r) => r.verdict === "differs").length;
  const nMiss = rows.filter((r) => r.verdict === "missing").length;
  const blocks = groups.filter((g) => g.block).length;
  const domains = new Set(rows.map((r) => reg?.[r.key]?.domain).filter(Boolean));
  const unknown = loaded ? rows.filter((r) => !reg[r.key]).length : null;
  const stg2 = field?.stg2_source_table ? `${field.stg2_source_table}.${field.stg2_source_column || "?"}` : null;

  const lab = (txt) => <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase",
    letterSpacing: 0.4, color: t.sub || "#666", marginBottom: 4 }}>{txt}</div>;
  const chip = (bg, c, txt, key) => <span key={key} style={{ fontSize: 9, fontWeight: 800, padding: "1px 7px",
    borderRadius: 999, background: bg, color: c, marginRight: 4, whiteSpace: "nowrap" }}>{txt}</span>;
  const btn = (on, txt, fn) => <span onClick={fn} role="button" tabIndex={0}
    style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 3, cursor: "pointer", marginLeft: 6,
      border: `1px solid ${on ? (t.accent || "#0f4775") : (t.border || "#c9d4dc")}`,
      background: on ? (t.accent || "#0f4775") : "#fff", color: on ? "#fff" : (t.accent || "#0f4775") }}>{txt}</span>;

  if (!rows.length) {
    return <div style={{ marginTop: 8, fontSize: 11, color: t.muted || "#999" }}>
      {lab("UD envelope")}No stage of the proof parses as a JSON object{parsed.order.map((s) => parsed.stages[s].error ? ` · ${s}: ${parsed.stages[s].error}` : "").join("")}.</div>;
  }

  const shown = groups.map((g) => ({ ...g, rows: g.rows.filter((r) => only === "all" || r.verdict === only) })).filter((g) => g.rows.length);

  return (
    <div style={{ marginTop: 8 }}>
      {lab("UD envelope · the CLOB read as structure")}
      <div style={{ fontSize: 11, color: t.text || "#333", lineHeight: 1.6, marginBottom: 6 }}>
        <b>{rows.length}</b> keys in this sample · <b>{blocks}</b> multiline blocks · {rows.length - rows.filter((r) => r.parent).length} singles
        {loaded ? <> · <b>{domains.size}</b> domains{unknown ? <span style={{ color: "#b26b00" }}> · {unknown} keys not in the registry</span> : null}</>
          : <span style={{ color: t.muted || "#999" }}> · registry not loaded, names and domains absent (run advantage_ud_profile)</span>}
        {" · "}{chip(VERDICT.same[0], VERDICT.same[1], `${rows.length - nDiff - nMiss} same`, "s")}
        {nDiff > 0 && chip(VERDICT.differs[0], VERDICT.differs[1], `${nDiff} differ`, "d")}
        {nMiss > 0 && chip(VERDICT.missing[0], VERDICT.missing[1], `${nMiss} missing`, "m")}
      </div>
      {stg2 && <div style={{ fontSize: 10.5, color: t.sub || "#666", marginBottom: 6 }}>
        Each key is one row of <span style={mono}>{stg2}</span> at STG2, pivoted into the JSON at DWH.
        The envelope's lineage is per key, not per CLOB; the registry carries it.</div>}
      <div style={{ marginBottom: 6 }}>
        {btn(only === "all", "all keys", () => setOnly("all"))}
        {btn(only === "differs", "differ", () => setOnly("differs"))}
        {btn(only === "missing", "missing", () => setOnly("missing"))}
        {btn(reveal, reveal ? "values shown" : "shapes only", () => setReveal(!reveal))}
        {btn(raw, "raw JSON", () => setRaw(!raw))}
      </div>
      {raw && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          {(proof || []).map((p) => (
            <div key={p.stage} style={{ minWidth: 0, maxWidth: "100%", border: `1px solid ${t.panel2 || "#dfe6e9"}`,
              borderRadius: 6, padding: "4px 9px", background: "#fff" }}>
              <div style={{ fontSize: 8, fontWeight: 800, textTransform: "uppercase", color: STAGE_C[p.stage] || "#999" }}>{p.stage}</div>
              <div style={{ ...mono, fontSize: 10, color: t.navy || "#10193b", wordBreak: "break-word", maxHeight: 160, overflow: "auto" }}>
                {p.field_value == null ? "∅" : (reveal ? String(p.field_value) : `<${String(p.field_value).length} chars · reveal to read>`)}</div>
            </div>))}
        </div>)}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead><tr style={{ color: t.sub || "#666", textAlign: "left" }}>
          <th style={{ padding: "3px 6px", fontSize: 9, textTransform: "uppercase" }}>Key</th>
          <th style={{ padding: "3px 6px", fontSize: 9, textTransform: "uppercase" }}>Means</th>
          {parsed.order.map((s) => <th key={s} style={{ padding: "3px 6px", fontSize: 9, textTransform: "uppercase", color: STAGE_C[s] }}>{s}</th>)}
          <th style={{ padding: "3px 6px", fontSize: 9, textTransform: "uppercase" }}>Verdict</th>
        </tr></thead>
        <tbody>
          {shown.map((g) => (
            <React.Fragment key={g.id}>
              {g.block && (
                <tr style={{ background: "#f5f7fa" }}>
                  <td colSpan={3 + parsed.order.length} style={{ padding: "4px 6px", fontWeight: 800, fontSize: 10.5 }}>
                    <span style={mono}>{g.id}</span> · block of {g.rows.length} line{g.rows.length === 1 ? "" : "s"}
                    {reg?.[g.rows[0].key]?.domain && chip("#efe6fb", "#6d3ac0", reg[g.rows[0].key].domain, "d")}
                    {reg?.[g.rows[0].key]?.silver_entity && chip("#e0f5fd", "#0b5e83", reg[g.rows[0].key].silver_entity, "s")}
                  </td></tr>)}
              {g.rows.map((r) => {
                const rr = reg?.[r.key];
                const [bg, c, title] = VERDICT[r.verdict];
                return (
                  <tr key={r.key} style={{ borderTop: "1px solid #eef0f4" }}>
                    <td style={{ ...mono, padding: "3px 6px", whiteSpace: "nowrap", paddingLeft: r.parent ? 18 : 6 }}>{r.key}</td>
                    <td style={{ padding: "3px 6px", color: t.text || "#333" }}>
                      {rr ? <>
                        {rr.term && <b>{rr.term} · </b>}
                        <span style={{ color: t.muted || "#7b8894" }}>{rr.value_class}{rr.domain && !r.parent ? ` · ${rr.domain}` : ""}</span>
                        {rr.gold_candidate === "Y" && chip("#fff3d6", "#b26b00", "GOLD?", "g")}
                      </> : <span style={{ color: t.muted || "#999" }}>{loaded ? "not in registry" : "—"}</span>}
                    </td>
                    {parsed.order.map((s) => (
                      <td key={s} style={{ ...mono, padding: "3px 6px", color: s in r.values ? (t.navy || "#10193b") : "#c1113a", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        title={reveal && s in r.values ? String(r.values[s]) : undefined}>
                        {!(s in r.values) ? (parsed.stages[s].keys ? "missing" : "—") : reveal ? String(r.values[s]) : maskValue(r.values[s], rr)}
                      </td>))}
                    <td style={{ padding: "3px 6px" }}>{chip(bg, c, title, "v")}</td>
                  </tr>);
              })}
            </React.Fragment>))}
        </tbody>
      </table>
    </div>);
}
