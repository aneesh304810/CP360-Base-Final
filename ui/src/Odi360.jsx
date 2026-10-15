// ODI 360 — what the ODI repository says the warehouse loads do.
//
// First tab: SCD2. One card per dimension that keeps history, written by
// the scd2 ingestion from the ODI export and, when it ran with the
// database, the read-only profile. The screen never invents a card: an
// empty estate says to run the ingestion.
//
// WHAT A READER SHOULD SEE FIRST. The pattern and the confidence mix. A
// table whose rules are all PROVEN can be migrated from the card alone; a
// table with UNKNOWN_TRUNCATED rules needs an untruncated re-export first,
// and the open questions say exactly which task.
import React, { useEffect, useState } from "react";
import { CONF_INFO, PATTERN_INFO, scd2 } from "./scd2Api.js";

const TABS = [["scd2", "SCD2 rule cards"]];

function Chip({ c, children, title }) {
  return <span title={title} style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: .4, color: c, border: `1px solid ${c}`,
    borderRadius: 3, padding: "1px 6px", whiteSpace: "nowrap" }}>{children}</span>;
}
function Tile({ t, label, value, c, sub }) {
  return (
    <div style={{ border: `1px solid ${t.border}`, borderTop: `3px solid ${c || t.accent}`, borderRadius: t.radius.md,
      padding: "8px 12px", background: t.panel, minWidth: 120 }}>
      <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: .4, textTransform: "uppercase", color: t.textMuted }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: c || t.text, fontFamily: "monospace" }}>{value == null ? "—" : value}</div>
      {sub && <div style={{ fontSize: 10.5, color: t.sub }}>{sub}</div>}
    </div>);
}
function Tbl({ t, head, rows }) {
  return (
    <div style={{ overflowX: "auto", marginBottom: 14 }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
        <thead><tr>{head.map((h) => <th key={h} style={{ textAlign: "left", fontSize: 9.5, fontWeight: 800, letterSpacing: .4,
          textTransform: "uppercase", color: t.textMuted, borderBottom: `1px solid ${t.border}`, padding: "0 12px 6px 0" }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={{ padding: "7px 12px 7px 0", verticalAlign: "top",
          borderBottom: `1px solid ${t.bg}`, color: j === 0 ? t.text : t.sub, lineHeight: 1.5 }}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>);
}

// The month bars: versions opened per month, duplicates in a darker band.
export function DupMonths({ t, rows }) {
  if (!rows || !rows.length) return null;
  const max = Math.max(...rows.map((r) => Number(r.versions) || 0), 1);
  const W = 720, H = 120, bw = Math.max(4, Math.floor((W - 40) / rows.length) - 2);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" style={{ width: "100%", maxWidth: W, height: "auto", display: "block" }}
      aria-label={`Versions opened per month for ${rows.length} months; the darker band inside each bar is the duplicate versions. The tallest month has ${max} versions.`}>
      {rows.map((r, i) => {
        const v = Number(r.versions) || 0, d = Number(r.dup_rows) || 0;
        const x = 30 + i * (bw + 2), h = (v / max) * (H - 34), hd = (d / max) * (H - 34);
        return (<g key={r.month}>
          <rect x={x} y={H - 22 - h} width={bw} height={h} fill={t.accent} opacity={.35} />
          <rect x={x} y={H - 22 - hd} width={bw} height={hd} fill={t.danger} />
          {(i === 0 || i === rows.length - 1 || i % Math.ceil(rows.length / 6) === 0) &&
            <text x={x} y={H - 8} fontSize={8} fill={t.textMuted}>{r.month}</text>}
        </g>);
      })}
      <text x={2} y={12} fontSize={8} fill={t.textMuted}>{max}</text>
    </svg>);
}

export function CardDetail({ t, d, onClose }) {
  if (!d) return null;
  const c = d.card || {};
  const P = PATTERN_INFO[c.pattern] || PATTERN_INFO.UNKNOWN;
  const q = (k) => (c[k] == null ? "—" : c[k]);
  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: t.radius.md, background: t.panel, padding: "14px 18px", marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: t.text, fontFamily: "monospace" }}>{d.table}</div>
        <Chip c={P.c} title={P.t}>{P.label}</Chip>
        {c.scan_verdict && <span style={{ fontSize: 11, color: t.sub }}>column scan said {c.scan_verdict}</span>}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10.5, color: t.textMuted }}>run {c.ran_at ? String(c.ran_at).slice(0, 16) : "—"}</span>
        <span onClick={onClose} style={{ cursor: "pointer", fontSize: 10, fontWeight: 800, color: t.sub, border: `1px solid ${t.border}`,
          borderRadius: 4, padding: "3px 9px" }}>✕ close</span>
      </div>
      <div style={{ fontSize: 12, color: t.sub, lineHeight: 1.6, marginBottom: 10 }}>
        <b style={{ color: t.text }}>Writers</b> {c.writers || "—"} · <b style={{ color: t.text }}>surrogate</b> <span style={{ fontFamily: "monospace" }}>{c.surrogate_key || "—"}</span>
        {" · "}<b style={{ color: t.text }}>natural key</b> <span style={{ fontFamily: "monospace" }}>{c.natural_key || "—"}</span>
        {" · "}<b style={{ color: t.text }}>version key</b> <span style={{ fontFamily: "monospace" }}>{c.version_key || "—"}</span>
        {c.partition_col && <> · <b style={{ color: t.text }}>sub-populations</b> <span style={{ fontFamily: "monospace" }}>{c.partition_col}</span>{" "}
          {Object.entries(c.partition_values || {}).map(([v, s]) => `${v} → ${s}`).join(", ")}</>}
      </div>

      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase", color: t.textMuted, margin: "10px 0 6px" }}>The rules</div>
      <Tbl t={t} head={["Id", "Rule", "Confidence", "Evidence"]} rows={(d.rules || []).map((r) => [
        <b style={{ fontFamily: "monospace" }}>{r.rule_id}</b>, r.rule_text,
        <Chip c={(CONF_INFO[r.confidence] || {}).c || t.sub} title={(CONF_INFO[r.confidence] || {}).t}>{r.confidence}</Chip>,
        <span style={{ fontSize: 11 }}>{r.evidence}</span>])} />

      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase", color: t.textMuted, margin: "10px 0 6px" }}>
        Quality {c.row_count == null && <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>· not profiled — run the ingestion with CP_SCD2_WITH_DB=1</span>}</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <Tile t={t} label="rows" value={q("row_count")} />
        <Tile t={t} label="duplicate versions" value={c.dup_rows == null ? null : `${c.dup_rows} (${c.dup_pct}%)`} c={Number(c.dup_pct) >= 5 ? t.danger : t.success} sub={c.dup_keys != null ? `${c.dup_keys} keys` : null} />
        <Tile t={t} label="gaps / overlaps" value={c.gaps == null ? null : `${c.gaps} / ${c.overlaps}`} c={(Number(c.gaps) || Number(c.overlaps)) ? t.warning : t.success} />
        <Tile t={t} label="keys · many open / none" value={c.multiple_open == null ? null : `${c.multiple_open} / ${c.none_open}`} c={Number(c.multiple_open) ? t.danger : t.success} />
        <Tile t={t} label="ACTIVE_IND disagrees" value={c.active_open_not_flagged == null ? null : `${c.active_open_not_flagged} / ${c.active_closed_but_flagged}`}
          c={(Number(c.active_open_not_flagged) || Number(c.active_closed_but_flagged)) ? t.warning : t.success} sub="open not flagged / closed but flagged" />
        <Tile t={t} label="freshness" value={c.freshness_alert ? "alert" : (c.row_count == null ? null : "ok")} c={c.freshness_alert ? t.danger : t.success} sub={c.freshness_alert || null} />
      </div>
      {c.volume_alerts && <div style={{ fontSize: 12, color: t.danger, marginBottom: 8 }}>Volume: {c.volume_alerts}</div>}
      <DupMonths t={t} rows={d.dup_by_month} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginTop: 12 }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase", color: t.textMuted, margin: "0 0 6px" }}>Catalog mapping</div>
          <Tbl t={t} head={["PBDW column", "Data 360 attribute"]} rows={(d.mapping || []).map((m) => [<span style={{ fontFamily: "monospace" }}>{m.pbdw_column}</span>, m.data360_attr])} />
        </div>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase", color: t.textMuted, margin: "0 0 6px" }}>
            Open questions · {(d.open_questions || []).length}</div>
          {(d.open_questions || []).length
            ? <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: t.sub, lineHeight: 1.5 }}>{d.open_questions.map((o) => <li key={o.seq}>{o.question}</li>)}</ol>
            : <div style={{ fontSize: 12, color: t.textMuted }}>none — every rule was read untruncated</div>}
          {d.column_roles && <>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase", color: t.textMuted, margin: "12px 0 6px" }}>Column scan</div>
            <div style={{ fontSize: 12, color: t.sub, lineHeight: 1.6 }}>
              {["surrogate_key", "valid_from", "valid_to", "current_flag", "version", "row_hash", "business_date", "audit_col"].filter((k) => d.column_roles[k]).map((k) => (
                <div key={k}><span style={{ color: t.textMuted }}>{k === "audit_col" ? "audit" : k.replace("_", " ")}</span> <span style={{ fontFamily: "monospace", color: t.text }}>{d.column_roles[k]}</span></div>))}
              {d.column_roles.to_convention && <div><span style={{ color: t.textMuted }}>open row</span> {d.column_roles.to_convention}</div>}
              {d.column_roles.notes && <div style={{ color: t.warning }}>{d.column_roles.notes}</div>}
            </div></>}
        </div>
      </div>
      {c.notes && <div style={{ fontSize: 11.5, color: t.sub, marginTop: 10, borderLeft: `3px solid ${t.warning}`, paddingLeft: 10 }}>{c.notes}</div>}
    </div>);
}

export function Scd2Tab({ t, summary, cards, detail, onOpen, onClose }) {
  const s = summary || {};
  const conf = s.confidence || {};
  const total = (conf.proven || 0) + (conf.inferred || 0) + (conf.unknown || 0);
  return (<>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
      <Tile t={t} label="tables carded" value={s.tables} sub={s.last_run ? `last run ${String(s.last_run).slice(0, 10)}` : "no run yet"} />
      <Tile t={t} label="profiled against the db" value={s.profiled} c={s.profiled ? t.success : t.textMuted} />
      <Tile t={t} label="rules proven" value={total ? `${conf.proven} / ${total}` : null} c={t.success} />
      <Tile t={t} label="truncated · to re-export" value={conf.unknown} c={conf.unknown ? t.danger : t.success} />
      <Tile t={t} label="open questions" value={s.open_questions} c={s.open_questions ? t.warning : t.success} />
      <Tile t={t} label="stale tables" value={s.stale} c={s.stale ? t.danger : t.success} sub="freshness alert" />
    </div>
    {(s.by_pattern || []).length > 0 && (
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", fontSize: 11.5, color: t.sub, marginBottom: 12 }}>
        {s.by_pattern.map((p) => { const P = PATTERN_INFO[p.pattern] || PATTERN_INFO.UNKNOWN; return (
          <span key={p.pattern} style={{ display: "inline-flex", gap: 6, alignItems: "center" }} title={P.t}><Chip c={P.c}>{P.label}</Chip> {p.n}</span>); })}
      </div>)}
    {!cards.length && (
      <div style={{ border: `1px dashed ${t.border}`, borderRadius: t.radius.md, padding: "18px 20px", color: t.sub, fontSize: 12.5, lineHeight: 1.6, maxWidth: "80ch" }}>
        <b style={{ color: t.text }}>No rule cards loaded yet.</b> Put the ODI export under <span style={{ fontFamily: "monospace" }}>local-data/odi_export</span>, then run{" "}
        <span style={{ fontFamily: "monospace" }}>python -m ingestion.run scd2</span>. Add <span style={{ fontFamily: "monospace" }}>CP_SCD2_WITH_DB=1</span> with the PBDW credentials to fill the quality tiles from the warehouse.
      </div>)}
    <CardDetail t={t} d={detail} onClose={onClose} />
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 10 }}>
      {cards.map((c) => { const P = PATTERN_INFO[c.pattern] || PATTERN_INFO.UNKNOWN; const open = detail && detail.table === c.table_name; return (
        <div key={c.table_name} onClick={() => onOpen(c.table_name)} style={{ cursor: "pointer", border: `1px solid ${open ? t.accent : t.border}`,
          borderLeft: `4px solid ${P.c}`, borderRadius: t.radius.md, background: open ? t.bg : t.panel, padding: "10px 13px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <b style={{ fontFamily: "monospace", fontSize: 13, color: t.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{c.table_name}</b>
            <Chip c={P.c} title={P.t}>{P.label}</Chip>
          </div>
          <div style={{ fontSize: 11, color: t.sub, marginTop: 4 }}>
            key <span style={{ fontFamily: "monospace" }}>{c.natural_key || "?"}</span>{c.partition_col ? ` · split by ${c.partition_col}` : ""}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap", fontSize: 10.5 }}>
            <span style={{ color: CONF_INFO.PROVEN.c }}>{c.proven_count || 0} proven</span>
            {c.inferred_count > 0 && <span style={{ color: CONF_INFO.INFERRED.c }}>{c.inferred_count} inferred</span>}
            {c.unknown_count > 0 && <span style={{ color: CONF_INFO.UNKNOWN_TRUNCATED.c }}>{c.unknown_count} truncated</span>}
            {c.open_count > 0 && <span style={{ color: t.warning }}>{c.open_count} open</span>}
            {c.row_count != null && <span style={{ color: Number(c.dup_pct) >= 5 ? t.danger : t.sub }}>{c.dup_pct}% dup</span>}
            {c.freshness_alert && <span style={{ color: t.danger }}>stale</span>}
          </div>
        </div>); })}
    </div>
  </>);
}

export default function Odi360({ t }) {
  const [tab, setTab] = useState("scd2");
  const [summary, setSummary] = useState(null);
  const [cards, setCards] = useState([]);
  const [detail, setDetail] = useState(null);
  useEffect(() => {
    let on = true;
    scd2.summary().then((s) => on && setSummary(s));
    scd2.cards().then((c) => on && setCards(c.cards || []));
    return () => { on = false; };
  }, []);
  const open = (table) => {
    if (detail && detail.table === table) return setDetail(null);
    scd2.card(table).then((d) => setDetail(d));
  };
  return (
    <div style={{ padding: "20px 24px 60px", maxWidth: 1260 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 22, fontWeight: 500, color: t.text }}>ODI 360</div>
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: .5, borderRadius: 999, padding: "2px 9px",
          background: summary && summary.loaded ? "#e8f6ed" : "#f1f4f7", color: summary && summary.loaded ? "#15803d" : "#6b7884" }}>
          {summary && summary.loaded ? "● LOADED" : "○ NO ROWS YET"}</span>
      </div>
      <div style={{ fontSize: 13, color: t.sub, maxWidth: "80ch", lineHeight: 1.6, margin: "4px 0 14px" }}>
        What the ODI repository says the warehouse loads do, read from the export and checked against the warehouse.
        A rule is <b style={{ color: CONF_INFO.PROVEN.c }}>proven</b> when the code says it, <b style={{ color: CONF_INFO.INFERRED.c }}>inferred</b> when the data
        points to it, and <b style={{ color: CONF_INFO.UNKNOWN_TRUNCATED.c }}>truncated</b> when the export cut the code before the rule.
      </div>
      <div style={{ display: "flex", gap: 0, marginBottom: 16 }}>
        {TABS.map(([k, l], i) => (
          <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k} style={{ font: "inherit", fontSize: 11.5, fontWeight: 600, padding: "6px 13px",
            cursor: "pointer", border: `1px solid ${tab === k ? t.accent : t.border}`, borderRadius: i === 0 ? "4px 0 0 4px" : 0,
            background: tab === k ? t.accent : t.panel, color: tab === k ? "#fff" : t.text }}>{l}</button>))}
      </div>
      {tab === "scd2" && <Scd2Tab t={t} summary={summary} cards={cards} detail={detail} onOpen={open} onClose={() => setDetail(null)} />}
    </div>);
}
