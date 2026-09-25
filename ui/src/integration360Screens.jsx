import React from "react";

// =====================================================================
// Integration360 screen designs — the four views that carry the
// observation model. Example data throughout: these are design mockups,
// not live screens. Operational status uses a reserved palette, kept
// distinct from the component-state colours, and every cell carries a
// glyph so colour never carries meaning alone.
// =====================================================================

export const ST = { good: "#0ca30c", warn: "#fab219", serious: "#ec835a", crit: "#d03b3b" };
const MB = [1042, 1043, 1044, 1045, 1046, 1047, 1048, 1049];
const GRID = [
 ["ACCOUNT · P0", "gggggggg"],
 ["ACCOUNT · P1", "ggggggg o"],
 ["ACCOUNT · P2", "gggggx--"],
 ["ACCOUNT · P3", "gggggggg"],
 ["TRANSACTION · P0", "gggggggg"],
 ["TRANSACTION · P1", "ggggggg o"],
 ["CLIENT · P0", "gggggggg"],
];
const LAG = [
 ["ACCOUNT · P0", 14, "0m 38s", ST.good],
 ["ACCOUNT · P1", 22, "1m 04s", ST.good],
 ["ACCOUNT · P2", 100, "4m 12s", ST.crit],
 ["ACCOUNT · P3", 16, "0m 44s", ST.good],
 ["TRANSACTION · P0", 19, "0m 52s", ST.good],
 ["TRANSACTION · P1", 41, "1m 51s", ST.warn],
];
const TASKS = [
 ["build_stg", "ok"], ["test_stg", "ok"], ["build_int", "ok"], ["test_int", "ok"],
 ["build_dim", "ok"], ["test_dim", "ok"], ["build_fact · running 34m", "run"],
 ["test_fact", ""], ["mark_replayed_dq", ""], ["persist_recon", ""],
 ["advance_date_control", ""],
];
const RECON = [
 ["EVENT_TO_STAGED", "418 902", "418 902", "—", 0, ST.good],
 ["STAGED_TO_PULLED", "96 114", "96 092", "22 not found", 0, ST.good],
 ["STG_TO_INT", "96 092", "95 876", "216 source DQ", 0, ST.good],
 ["INT_TO_FACT", "61 430", "61 018", "404 held", 8, ST.warn],
];
const FUNNEL = [
 ["Events received", 100, "418 902", "↓ 322 788 duplicate keys collapsed"],
 ["Distinct keys", 22.9, "96 114", "↓ 22 not-found keys — deletes"],
 ["Rows pulled", 22.9, "96 092", "→ must equal rows pulled"],
 ["Stage 1 rows", 22.9, "96 092", "↓ 216 source-DQ filtered"],
 ["INT rows", 22.8, "95 876", "↓ 404 held · missing dimension · 8 unexplained"],
 ["Gold rows", 14.6, "61 018", null],
];
const EXC = [
 ["1 day", ST.crit, "DQ · INT_TRANSACTIONS", "MISSING_DIMENSION_KEY", "37", "Pipeline · replays on arrival"],
 ["3 days", ST.serious, "DQ · INT_TRANSACTIONS", "MISSING_DIMENSION_KEY", "212", "Pipeline · replays on arrival"],
 ["5 days", ST.warn, "DQ · STG_ACCOUNT", "INCORRECT ACCOUNT_STATUS_CODE", "18", "SWP source · needs reload"],
 ["—", "#b8c4ce", "Hub · quarantine", "Trailer count mismatch", "1 file", "Hub · awaiting correction"],
 ["—", "#b8c4ce", "dbt · test_dim", "Two ACTIVE_IND=1 for one key", "2", "Transformation · code fix"],
 ["—", "#b8c4ce", "Loader · UNIFIED_CASH", "REFERENCE_DATA · unknown fund", "1 500", "Hub · correct and resubmit"],
];

const MONO = "Roboto Mono, monospace";

export default function Integration360Screens({ t, onBack }) {
 const navy = t.navy || "#10193b";
 const panel = t.panel2 || "#dfe6e9";
 const sub = t.sub || "#666";

 const Frame = ({ title, meta, children }) => (
  <div style={{ background: "#fff", border: `1px solid ${panel}`, borderRadius: 10,
   overflow: "hidden", margin: "12px 0 20px" }}>
   <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
    padding: "10px 15px", background: "#f4f8fb", borderBottom: `1px solid ${panel}` }}>
    <b style={{ fontSize: 12.5, color: navy }}>{title}</b>
    <span style={{ fontFamily: MONO, fontSize: 10, color: sub }}>{meta}</span>
    <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 9,
     letterSpacing: ".06em", textTransform: "uppercase", color: sub,
     border: "1px dashed #c0cad1", borderRadius: 20, padding: "2px 9px" }}>
     example data</span>
   </div>
   <div style={{ padding: "14px 15px" }}>{children}</div>
  </div>);

 const Tile = ({ v, l, c }) => (
  <div style={{ border: `1px solid ${panel}`, borderRadius: 7, padding: "9px 12px" }}>
   <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-.02em",
    color: c || navy, lineHeight: 1.1 }}>{v}</div>
   <div style={{ fontSize: 10, color: sub, marginTop: 2 }}>{l}</div>
  </div>);

 const cellStyle = (k) => {
  const map = { g: [ST.good, "✓"], o: [ST.warn, "⧖"], x: [ST.crit, "✕"],
   "-": ["#b8c4ce", "–"] };
  const [col, glyph] = map[k] || map["-"];
  return { col, glyph,
   bg: k === "-" ? "#eef1f4" : `${col}${k === "o" ? "40" : "26"}`,
   fg: k === "o" ? "#7a5400" : k === "-" ? sub : col };
 };

 return (
  <div>
   {onBack}
   <div style={{ fontSize: 11.5, color: sub, maxWidth: 880, marginBottom: 4 }}>
    Four screens carry the observation model. Every one answers completeness,
    timeliness or correctness for one channel and one business date — nothing else
    earns a place. Figures below are example data, drawn to show layout and encoding.
   </div>

   {/* 1 — LIVE FLOW */}
   <div style={{ fontSize: 14.5, fontWeight: 700, color: navy, margin: "20px 0 2px" }}>
    1 · Live flow — the intraday clock</div>
   <div style={{ fontSize: 11, color: sub, maxWidth: 880 }}>
    A stall localises to a row immediately: the difference between “the event channel
    is behind” and “ACCOUNT partition 2 stopped at 04:12”.</div>
   <Frame title="Live flow" meta="last 8 micro-batches · refreshing">
    <div style={{ display: "grid",
     gridTemplateColumns: "repeat(auto-fit,minmax(128px,1fr))", gap: 9,
     marginBottom: 14 }}>
     <Tile v="4m 12s" l="worst partition lag" />
     <Tile v="9" l="batches last hour" />
     <Tile v="1" l="partition stalled" c={ST.crit} />
     <Tile v="1 049" l="latest micro-batch" />
    </div>
    <div style={{ overflowX: "auto" }}>
     <table style={{ width: "100%", minWidth: 620, tableLayout: "fixed",
      borderCollapse: "separate", borderSpacing: 2 }}>
      <thead><tr>
       <th style={{ width: 150, textAlign: "left", fontFamily: MONO, fontSize: 9,
        letterSpacing: ".05em", color: sub, fontWeight: 500, padding: "0 0 3px" }}>
        topic · partition</th>
       {MB.map((m) => (
        <th key={m} style={{ fontFamily: MONO, fontSize: 9, color: sub,
         fontWeight: 500, textAlign: "center", padding: "0 0 3px" }}>{m}</th>))}
      </tr></thead>
      <tbody>
       {GRID.map(([label, pat]) => (
        <tr key={label}>
         <td style={{ fontFamily: MONO, fontSize: 10, color: "#33414d",
          paddingRight: 8, whiteSpace: "nowrap" }}>{label}</td>
         {pat.replace(/ /g, "").split("").map((k, i) => {
          const c = cellStyle(k);
          return (
           <td key={i} style={{ padding: 0 }}>
            <div style={{ display: "flex", alignItems: "center",
             justifyContent: "center", height: 25, borderRadius: 4,
             background: c.bg, color: c.fg, fontSize: 11, fontWeight: 600 }}>
             {c.glyph}</div></td>);
         })}
        </tr>))}
      </tbody>
     </table>
    </div>
    <div style={{ display: "flex", gap: 15, flexWrap: "wrap", margin: "11px 0 14px",
     fontSize: 10.5, color: sub }}>
     {[[ST.good, "✓ boxed & loaded"], [ST.warn, "⧖ open — start, no end"],
       [ST.crit, "✕ failed"], ["#b8c4ce", "– not received"]].map(([c, l]) => (
      <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
       <span style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />{l}
      </span>))}
    </div>
    <div style={{ fontSize: 11.5, fontWeight: 600, color: navy, marginBottom: 5 }}>
     Consumer lag by partition</div>
    {LAG.map(([label, pct, val, col]) => (
     <div key={label} style={{ display: "grid",
      gridTemplateColumns: "142px 1fr 58px", gap: 10, alignItems: "center",
      padding: "3px 0" }}>
      <span style={{ fontFamily: MONO, fontSize: 10, color: "#33414d" }}>{label}</span>
      <span style={{ display: "block", height: 7, background: "#eef1f4",
       borderRadius: 4, overflow: "hidden" }}>
       <span style={{ display: "block", height: "100%", width: `${pct}%`,
        background: col, borderRadius: 4 }} /></span>
      <span style={{ fontFamily: MONO, fontSize: 10, textAlign: "right",
       fontVariantNumeric: "tabular-nums", color: "#33414d" }}>{val}</span>
     </div>))}
   </Frame>

   {/* 2 — BUSINESS DATE */}
   <div style={{ fontSize: 14.5, fontWeight: 700, color: navy, margin: "20px 0 2px" }}>
    2 · Business date — the EOD clock</div>
   <div style={{ fontSize: 11, color: sub, maxWidth: 880 }}>
    Binary, unlike the screen above. The gate opens only when every marker is in and
    every micro-batch is loaded — marker received is not the gate.</div>
   <Frame title="Business date · 2026-09-24" meta="DATE_CONTROL · TRIGGER">
    <div style={{ display: "grid",
     gridTemplateColumns: "repeat(auto-fit,minmax(128px,1fr))", gap: 9,
     marginBottom: 14 }}>
     <Tile v="1 284 / 1 284" l="micro-batches loaded" />
     <Tile v="4 / 4" l="EOD markers received" />
     <Tile v="02:41" l="elapsed since trigger" c={ST.warn} />
     <Tile v="21:58" l="SLA cutoff" />
    </div>
    <div style={{ fontSize: 11.5, fontWeight: 600, color: navy, marginBottom: 5 }}>
     EOD marker by domain</div>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 13 }}>
     {["ACCOUNT 21:04", "TRANSACTION 21:06", "CLIENT 21:02", "ASSETS 21:09"].map((d) => (
      <span key={d} style={{ fontFamily: MONO, fontSize: 9.5, padding: "4px 9px",
       borderRadius: 4, background: `${ST.good}26`, color: ST.good }}>✓ {d}</span>))}
    </div>
    <div style={{ fontSize: 11.5, fontWeight: 600, color: navy, marginBottom: 5 }}>
     Transformation</div>
    <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 13 }}>
     {TASKS.map(([name, st]) => (
      <span key={name} style={{ fontFamily: MONO, fontSize: 9.5, padding: "4px 9px",
       borderRadius: 4,
       background: st === "ok" ? "#eef1f4" : st === "run" ? `${ST.warn}40` : "#eef1f4",
       color: st === "ok" ? ST.good : st === "run" ? "#7a5400" : sub }}>
       {st === "ok" ? "✓ " : st === "run" ? "⧖ " : ""}{name}</span>))}
    </div>
    <div style={{ fontSize: 11.5, fontWeight: 600, color: navy, marginBottom: 5 }}>
     Reconciliation</div>
    <div style={{ overflowX: "auto" }}>
     <table style={{ width: "100%", minWidth: 560, borderCollapse: "collapse",
      fontSize: 11 }}>
      <thead><tr>{["Boundary", "Left", "Right", "Explained", "Difference"].map((h) => (
       <th key={h} style={{ textAlign: "left", fontFamily: MONO, fontSize: 9,
        letterSpacing: ".06em", textTransform: "uppercase", color: sub,
        fontWeight: 500, padding: "5px 10px 5px 0",
        borderBottom: "1px solid #c0cad1" }}>{h}</th>))}</tr></thead>
      <tbody>
       {RECON.map(([b, l, r, e, diff, col]) => (
        <tr key={b}>
         <td style={{ padding: "7px 10px 7px 0", borderBottom: "1px solid #eef1f4",
          fontFamily: MONO, fontSize: 10, color: navy }}>{b}</td>
         {[l, r, e].map((v, i) => (
          <td key={i} style={{ padding: "7px 10px 7px 0",
           borderBottom: "1px solid #eef1f4", color: "#33414d",
           fontVariantNumeric: "tabular-nums" }}>{v}</td>))}
         <td style={{ padding: "7px 10px 7px 0", borderBottom: "1px solid #eef1f4" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5,
           fontWeight: 600, color: "#33414d" }}>
           <span style={{ width: 8, height: 8, borderRadius: "50%", background: col }} />
           {diff} · {diff === 0 ? "pass" : "warning"}</span></td>
        </tr>))}
      </tbody>
     </table>
    </div>
    <div style={{ fontSize: 10.5, color: sub, marginTop: 8 }}>
     Tolerance in force: 0 rows. Stored with the verdict, so this reads the same in
     three weeks.</div>
   </Frame>

   {/* 3 — FUNNEL */}
   <div style={{ fontSize: 14.5, fontWeight: 700, color: navy, margin: "20px 0 2px" }}>
    3 · Funnel — where rows go</div>
   <div style={{ fontSize: 11, color: sub, maxWidth: 880 }}>
    Six numbers for one date, each with its explained deduction. Anything unexplained
    is the number worth looking at.</div>
   <Frame title="Funnel · 2026-09-24 · TRANSACTION" meta="events → Gold">
    {FUNNEL.map(([label, pct, val, ded]) => (
     <div key={label}>
      <div style={{ display: "grid", gridTemplateColumns: "116px 1fr 78px", gap: 11,
       alignItems: "center", padding: "5px 0" }}>
       <span style={{ fontSize: 11 }}>{label}</span>
       <span style={{ display: "block", height: 20, background: "#eef1f4",
        borderRadius: 4, overflow: "hidden" }}>
        <span style={{ display: "block", height: "100%", width: `${pct}%`,
         background: "#7fb8c4", borderRadius: 4 }} /></span>
       <span style={{ fontFamily: MONO, fontSize: 11, textAlign: "right",
        fontVariantNumeric: "tabular-nums", color: navy }}>{val}</span>
      </div>
      {ded && <div style={{ fontSize: 10, color: sub, paddingLeft: 127,
       marginTop: -2, marginBottom: 2 }}>{ded}</div>}
     </div>))}
    <div style={{ fontSize: 10.5, color: sub, marginTop: 10 }}>
     The four event-side boundaries sit in front of the medallion’s existing four, so
     the chain reads as one funnel rather than two disconnected halves.</div>
   </Frame>

   {/* 4 — EXCEPTIONS */}
   <div style={{ fontSize: 14.5, fontWeight: 700, color: navy, margin: "20px 0 2px" }}>
    4 · Exceptions</div>
   <div style={{ fontSize: 11, color: sub, maxWidth: 880 }}>
    One list over three sources with different vocabularies, sorted by days to expiry
    — an OPEN reprocess-eligible row near the INT retention edge is a transaction
    about to be lost permanently.</div>
   <Frame title="Exceptions" meta="open · all sources">
    <div style={{ overflowX: "auto" }}>
     <table style={{ width: "100%", minWidth: 620, borderCollapse: "collapse",
      fontSize: 11 }}>
      <thead><tr>{["Expires", "Source", "Reason", "Rows", "Owner"].map((h) => (
       <th key={h} style={{ textAlign: "left", fontFamily: MONO, fontSize: 9,
        letterSpacing: ".06em", textTransform: "uppercase", color: sub,
        fontWeight: 500, padding: "5px 10px 5px 0",
        borderBottom: "1px solid #c0cad1" }}>{h}</th>))}</tr></thead>
      <tbody>
       {EXC.map(([exp, col, src, reason, rows, owner], i) => (
        <tr key={i}>
         <td style={{ padding: "7px 10px 7px 0", borderBottom: "1px solid #eef1f4" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5,
           fontWeight: 600, color: "#33414d" }}>
           <span style={{ width: 8, height: 8, borderRadius: "50%", background: col }} />
           {exp}</span></td>
         <td style={{ padding: "7px 10px 7px 0", borderBottom: "1px solid #eef1f4",
          fontFamily: MONO, fontSize: 10, color: navy }}>{src}</td>
         <td style={{ padding: "7px 10px 7px 0", borderBottom: "1px solid #eef1f4",
          color: "#33414d" }}>{reason}</td>
         <td style={{ padding: "7px 10px 7px 0", borderBottom: "1px solid #eef1f4",
          fontVariantNumeric: "tabular-nums", color: "#33414d" }}>{rows}</td>
         <td style={{ padding: "7px 10px 7px 0", borderBottom: "1px solid #eef1f4",
          fontSize: 10, color: sub }}>{owner}</td>
        </tr>))}
      </tbody>
     </table>
    </div>
    <div style={{ fontSize: 10.5, color: sub, marginTop: 8 }}>
     Read-only. The Hub owns every lifecycle here; this shows its state and nothing
     more.</div>
   </Frame>

   <div style={{ fontSize: 11, color: "#33414d", background: "#fff",
    border: `1px solid ${panel}`, borderLeft: `3px solid ${ST.warn}`, borderRadius: 8,
    padding: "12px 14px", lineHeight: 1.6, maxWidth: 940 }}>
    <b>The fifth screen — outbound submissions.</b> The mechanism is now settled:
    SEI pushes a notification, BBH polls SEI for reject detail and as backstop. So
    the screen is a submission lifecycle with a status history, each row tagged
    push or poll, and reject detail paginated beneath it. Two columns carry their
    weight only because there are two sources: <i>found by</i>, and <i>notified
    at</i> against <i>polled at</i>. A terminal state with no notification is the
    running measure of SEI’s push channel. What is still open is the grain of the
    reject detail SEI returns — the loader row above is drawn at record level on
    the assumption that it is per record, not per file.
   </div>
  </div>);
}
