// Data Analysis · Historical data migration: the lineage picture, read as
// sentences. The same payload the canvas draws, in words a business
// reader can act on: what each historical source column becomes on the
// SEI side, what changes on the way, which rows still want approval, and
// which SEI fields nothing in the operational lineage carries today.
//
// Mirrors SourceReading.jsx for the operational catalog: a lead paragraph
// with the counts as a sentence, the things to act on as cards that
// filter, a find box, and one row per field with its journey underneath.
// The verb on each row comes from the same classifier and the same
// explainer the picture uses, so the two cannot disagree.
import React, { useMemo, useState } from "react";
import { classifyLink, summarise, linkRule } from "./linkOps.js";
import { explainRule } from "./plainRule.js";
import { LANE_LABEL, STATUS_COLOR, classifyRule } from "./histMigrationApi.js";

const C = { ink: "#233240", sub: "#5b6773", faint: "#8793a0", rule: "#d9e0e6", panel: "#fff", accent: "#0f4775",
            same: "#1a8f4c", changed: "#8a6d1f", changedBg: "#fdf1dc", open: "#9e5a12", openBg: "#fdebd9", unmatched: "#9e1130", unmatchedBg: "#fdeaee", lane: "#5b3fa6", laneBg: "#ece6f8" };
const pc = (n, d) => (d ? Math.round((n / d) * 100) : 0);
const MONO = "ui-monospace, Menlo, monospace";

function sentenceFor(c) {
  const ex = explainRule(linkRule(c), { hasSource: !!c.src, target: c.col });
  const real = (ex.steps || []).filter((s) => s.op && s.op !== "direct");
  if (!c.src) return "has no historical source named — the SEI field is produced or left empty";
  if (!real.length) return "arrives from the historical source, and lands in SEI unchanged";
  if (real.length === 1) {
    const first = String(real[0].what || "").replace(/\s+/g, " ").trim().split(". ")[0].replace(/\.$/, "");
    return `arrives, then ${first.charAt(0).toLowerCase()}${first.slice(1)}`;
  }
  return `arrives, then passes through ${real.length} steps before it lands in SEI`;
}

export default function HistReading({ t, data, file }) {
  const [q, setQ] = useState("");
  const [only, setOnly] = useState("all");   // all | changed | unmatched | review
  const [open, setOpen] = useState(null);
  const rows = useMemo(() => {
    const out = [];
    (data?.targets || []).forEach((tg) => (tg.cols || []).forEach((c) => {
      const link = { ...c, logic: classifyRule(c.t1) };
      const op = c.__op || classifyLink(link);
      out.push({ ...link, __op: op, table: tg.table, group: LANE_LABEL[c.lane] || c.lane || "unclassified", name: c.col, sentence: sentenceFor(link), id: c.lineage_id || `${tg.table}.${c.col}` });
    }));
    return out;
  }, [data]);
  const sum = useMemo(() => summarise(rows), [rows]);
  const srcCount = useMemo(() => new Set(rows.map((r) => r.src).filter(Boolean)).size, [rows]);
  const laneCount = useMemo(() => new Set(rows.map((r) => r.lane).filter(Boolean)).size, [rows]);
  const fileCount = useMemo(() => new Set(rows.map((r) => r.table)).size, [rows]);
  const unmatched = rows.filter((r) => String(r.match || "").toUpperCase() === "UNMATCHED").length;
  const review = rows.filter((r) => /REVIEW|DRAFT|PENDING/i.test(r.approval || "") || !r.approval).length;
  const reaches = rows.filter((r) => r.sei && r.sei.has).length;
  const grouped = useMemo(() => {
    const by = new Map();
    rows.forEach((r) => { if (!by.has(r.group)) by.set(r.group, []); by.get(r.group).push(r); });
    const out = [...by.entries()].map(([g, items]) => [g, items.sort((a, b) => `${a.table}${a.col}`.localeCompare(`${b.table}${b.col}`))]);
    out.sort((a, b) => a[0].localeCompare(b[0]));
    return out;
  }, [rows]);
  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return grouped.map(([g, items]) => [g, items.filter((r) => {
      if (only === "changed" && !r.__op.transformed) return false;
      if (only === "unmatched" && String(r.match || "").toUpperCase() !== "UNMATCHED") return false;
      if (only === "review" && !(/REVIEW|DRAFT|PENDING/i.test(r.approval || "") || !r.approval)) return false;
      if (!s) return true;
      return `${r.name} ${r.col} ${r.src || ""} ${r.table} ${(r.sei && r.sei.source) || ""}`.toLowerCase().includes(s);
    })]).filter(([, items]) => items.length);
  }, [grouped, q, only]);
  const shown = visible.reduce((a, [, i]) => a + i.length, 0);
  if (!data) return null;
  return (
    <div style={{ fontFamily: t.font, color: C.ink }}>
      <p style={{ fontSize: 14.5, lineHeight: 1.65, maxWidth: 840, margin: "0 0 18px" }}>
        {file ? <b style={{ fontFamily: MONO }}>{file}</b> : <b>{fileCount} SEI dat file{fileCount === 1 ? "" : "s"}</b>}{file ? " is" : " are"} filled from{" "}
        <b>{srcCount} historical source column{srcCount === 1 ? "" : "s"}</b> on {laneCount} lane{laneCount === 1 ? "" : "s"}, into{" "}
        <b>{sum.total} SEI target field{sum.total === 1 ? "" : "s"}</b>. <b>{sum.transformed}</b> of those {sum.transformed === 1 ? "is" : "are"} changed on the way{sum.total ? ` (${pc(sum.transformed, sum.total)}%)` : ""}.{" "}
        <b>{reaches}</b> reach an IMDS column today by exact name; <b>{unmatched}</b> match nothing in the operational SEI lineage. <b>{review}</b> still want approval.
      </p>
      <div style={{ display: "grid", gap: 14, marginBottom: 20, gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))" }}>
        <Act n={sum.transformed} c={C.changed} bg="#fffdf7" title="change on the way" body="The value that lands in SEI is not the value that left the historical source. If you reconcile SEI against AddVantage, STAR or UAF, these are the ones that will not tie out." on={only === "changed"} onClick={() => setOnly(only === "changed" ? "all" : "changed")} />
        <Act n={unmatched} c={C.unmatched} bg="#fffafb" title="match nothing today" body="No row of the operational SEI input lineage carries this field name. Either the field is new to SEI, or the name differs and the match needs a hand." on={only === "unmatched"} onClick={() => setOnly(only === "unmatched" ? "all" : "unmatched")} />
        <Act n={review} c={C.open} bg="#fffaf5" title="still want approval" body="The rule may be written and even complete, and the mapping is still a draft until someone approves it. Rule status and approval are different controls." on={only === "review"} onClick={() => setOnly(only === "review" ? "all" : "review")} />
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <label htmlFor="hr-find" style={{ fontSize: 12.5, color: C.sub }}>Find</label>
        <input id="hr-find" value={q} onChange={(e) => setQ(e.target.value)} placeholder="a SEI field, a source column, a dat file…" style={{ font: "inherit", fontSize: 13, padding: "7px 11px", width: 300, border: `1px solid ${C.rule}`, borderRadius: 3, background: "#fff" }} />
        {only !== "all" && <button type="button" onClick={() => setOnly("all")} style={{ font: "inherit", fontSize: 12, padding: "6px 12px", border: `1px solid ${C.accent}`, background: "#fff", color: C.accent, borderRadius: 3, cursor: "pointer" }}>Showing {only === "changed" ? "changed" : only === "unmatched" ? "unmatched" : "awaiting approval"} only — clear</button>}
        <span style={{ marginLeft: "auto", fontSize: 11.5, color: C.faint }}>{shown} of {sum.total}</span>
      </div>
      {visible.map(([group, items]) => (
        <section key={group} style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".6px", color: C.sub, margin: "0 0 7px" }}>
            {group}<span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: C.faint }}> · {items.length} {items.length === 1 ? "field" : "fields"}</span></h3>
          <div style={{ background: C.panel, border: `1px solid ${C.rule}`, borderRadius: 4, overflow: "hidden" }}>
            {items.map((r, i) => <Row key={r.id} r={r} last={i === items.length - 1} open={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} showFile={!file} />)}
          </div>
        </section>))}
      {!visible.length && <div style={{ padding: 26, textAlign: "center", color: C.sub, fontSize: 13, background: C.panel, border: `1px solid ${C.rule}`, borderRadius: 4 }}>
        Nothing matches. {only !== "all" && <button type="button" onClick={() => setOnly("all")} style={{ font: "inherit", border: 0, background: "none", color: C.accent, cursor: "pointer", padding: 0, textDecoration: "underline" }}>Show everything</button>}</div>}
      <p style={{ fontSize: 11.5, color: C.faint, lineHeight: 1.6, maxWidth: 820, marginTop: 20 }}>
        What each field does on the way is read from the same rules the picture draws, so the two cannot disagree. The operational side (STAR field, IMDS column) is joined by exact normalised name and is evidence of where the SEI field goes today, not part of the historical mapping.
      </p>
    </div>);
}

function Act({ n, c, bg, title, body, on, onClick }) {
  return (
    <div style={{ background: bg, border: `1px solid ${on ? c : C.rule}`, borderLeft: `4px solid ${c}`, borderRadius: 4, padding: "14px 17px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}><b style={{ fontSize: 25, fontWeight: 400, color: c }}>{n}</b><span style={{ fontSize: 13.5, fontWeight: 600 }}>{title}</span></div>
      <p style={{ margin: "6px 0 10px", fontSize: 12.5, lineHeight: 1.55, color: "#4a5560" }}>{body}</p>
      <button type="button" onClick={onClick} aria-pressed={on} style={{ font: "inherit", fontSize: 12.5, padding: "6px 13px", border: `1px solid ${c}`, background: on ? c : "#fff", color: on ? "#fff" : c, borderRadius: 3, cursor: "pointer" }}>{on ? "Showing these" : "Show only these"}</button>
    </div>);
}
const Chip = ({ bg, fg, children, title }) => <span title={title} style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: bg, color: fg, whiteSpace: "nowrap" }}>{children}</span>;

function Row({ r, last, open, onToggle, showFile }) {
  const changed = r.__op.transformed;
  const unmatched = String(r.match || "").toUpperCase() === "UNMATCHED";
  const review = /REVIEW|DRAFT|PENDING/i.test(r.approval || "") || !r.approval;
  return (
    <div style={{ borderBottom: last ? "none" : `1px solid ${C.rule}66` }}>
      <button type="button" onClick={onToggle} aria-expanded={open} style={{ font: "inherit", textAlign: "left", width: "100%", border: 0, background: open ? "#f2f7fb" : "transparent", padding: "11px 16px", cursor: "pointer", color: C.ink }}>
        <span style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" }}>
          <b style={{ fontSize: 14 }}>{showFile ? `${r.table} · ` : ""}{r.name}</b>
          {changed && <Chip bg={C.changedBg} fg={C.changed}>changed</Chip>}
          {r.sei && r.sei.has && <Chip bg="#e3f3e8" fg={C.same} title={`today the SEI field reaches ${r.sei.fields.map((f) => `${f.file}.${f.field}`).join("; ")}${r.sei.source ? ` via STAR ${r.sei.source}` : ""}`}>IMDS today → {r.sei.fields[0].file}</Chip>}
          {unmatched && <Chip bg={C.unmatchedBg} fg={C.unmatched} title="no operational SEI input lineage row carries this field name">unmatched</Chip>}
          {review && <Chip bg={C.openBg} fg={C.open} title={`approval: ${r.approval || "not recorded"}`}>awaiting approval</Chip>}
          {r.mandatory && /^(Y|YES|ALWAYS)/i.test(r.mandatory) && <Chip bg="#e3eefb" fg="#0f4775" title="mandatory on the SEI load file">mandatory</Chip>}
          <span style={{ fontSize: 12.5, color: "#4a5560" }}>{r.sentence}</span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: C.accent }}>{open ? "hide" : "the journey"}</span>
        </span>
        <span style={{ display: "block", fontSize: 11, color: C.faint, marginTop: 3, fontFamily: MONO }}>{r.src || "—"} → {r.table}.{r.col}</span>
      </button>
      {open && <Journey r={r} />}
    </div>);
}

function Journey({ r }) {
  const ex = explainRule(linkRule(r), { hasSource: !!r.src, target: r.col });
  const stops = [
    { label: "Arrives", name: r.src || "— nothing supplies it", note: `From the ${LANE_LABEL[r.lane] || r.lane || "historical"} lane${r.src_system ? `, ${r.src_system}` : ""}.`, c: C.lane },
    { label: "Transformation", name: r.t1 ? r.t1 : "nothing written", note: r.rule_status ? `Rule ${r.rule_status}; approval ${r.approval || "not recorded"}.` : "No rule status on the row.", c: C.accent, mono: true },
    { label: "SEI target", name: `${r.table}.${r.col}`, note: `${r.type ? `Stored as ${r.type}${r.length ? `(${r.length})` : ""}. ` : ""}${r.dictionary ? `Dictionary ${r.dictionary}.` : ""}`, c: "#0091bf" },
    r.sei && r.sei.has ? { label: "Today", name: r.sei.fields.map((f) => `${f.file}.${f.field}`).join("; "), note: `${r.sei.source ? `Via STAR ${r.sei.source}. ` : ""}Joined by exact normalised field name.`, c: C.same }
      : { label: "Today", name: r.match ? r.match.toLowerCase() : "not checked", note: "No operational SEI input lineage row carries this field name yet.", c: C.unmatched },
  ].map((s, i) => ({ ...s, n: i + 1 }));
  return (
    <div style={{ padding: "2px 16px 18px", background: "#fbfdfe" }}>
      <div style={{ display: "grid", gap: 11, marginTop: 8, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        {stops.map((s) => (
          <div key={s.n} style={{ border: `1px solid ${C.rule}`, borderTop: `3px solid ${s.c}`, borderRadius: 3, padding: "10px 12px", background: "#fff" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", color: C.sub }}>{s.n} · {s.label}</div>
            <div style={{ fontSize: 12.5, marginTop: 5, color: C.ink, fontFamily: MONO, whiteSpace: s.mono ? "pre-wrap" : "normal", overflowWrap: "anywhere", maxHeight: 120, overflow: "auto" }}>{s.name}</div>
            <div style={{ fontSize: 11.5, color: "#4a5560", marginTop: 3, lineHeight: 1.45 }}>{s.note}</div>
          </div>))}
      </div>
      {(ex.steps || []).filter((s) => s.watch).map((s, i) => (
        <div key={i} style={{ marginTop: 11, fontSize: 12.5, lineHeight: 1.55, background: "#f4f7f9", borderRadius: 3, padding: "10px 13px", color: "#4a5560" }}><b style={{ color: C.ink }}>Worth knowing.</b> {s.watch}</div>))}
      <div style={{ marginTop: 9, fontSize: 11.5, color: C.sub, display: "flex", gap: 12, flexWrap: "wrap" }}>
        {[["rule", r.rule_status], ["approval", r.approval], ["dictionary", r.dictionary], ["match", r.match]].map(([k, v]) => <span key={k}>{k} <b style={{ color: STATUS_COLOR(v) }}>{v || "—"}</b></span>)}
        {r.lineage_id && <span style={{ fontFamily: MONO, color: C.faint }}>{r.lineage_id}</span>}
      </div>
    </div>);
}
