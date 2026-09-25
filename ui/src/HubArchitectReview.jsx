import React, { useState } from "react";
import {
  AR_SUMMARY, AR_ASSUMPTIONS, AR_MISSING, AR_BOTTLENECKS, AR_ERRORS,
  AR_FINDINGS, AR_VERDICTS, AR_SEV,
} from "./hubArchitectReview.js";

// =====================================================================
// HubArchitectReview — the independent architect pass over the Hub
// design, run with one assumption substituted: SDC events are the
// primary ingestion path, everything from Stage 1 onward per the SEI
// pack. Six tabs: the chain, what is missing, what is slow, what has
// no error owner, the findings mapped onto the 65, and the assumptions.
// =====================================================================

const TABS = [
  ["FLOW", "The chain", "where the missing pieces sit"],
  ["MISS", "Missing", `${AR_MISSING.length} components`],
  ["PERF", "Bottlenecks", `${AR_BOTTLENECKS.length} ranked`],
  ["ERR", "Error paths", `${AR_ERRORS.length} unowned`],
  ["MAP", "Component map", `${AR_FINDINGS.length} of 65 affected`],
  ["ASSUME", "Assumptions", "5 changed, 3 held"],
];

export default function HubArchitectReview({ t, onBack }) {
  const [tab, setTab] = useState("FLOW");
  const [open, setOpen] = useState(null);

  const navy = t.navy || "#10193b";
  const panel = t.panel2 || "#dfe6e9";
  const sub = t.sub || "#666";
  const card = { background: "#fff", border: `1px solid ${panel}`, borderRadius: 10 };

  const pill = (bg, fg, txt, key) => (
    <span key={key} style={{ fontSize: 8.5, fontWeight: 800, padding: "2px 8px",
      borderRadius: 999, background: bg, color: fg, whiteSpace: "nowrap" }}>{txt}</span>);
  const sevPill = (s) => pill(`${AR_SEV[s]}1f`, AR_SEV[s], s.toUpperCase());
  const verPill = (v) => {
    const [c] = AR_VERDICTS[v] || ["#5c7c94"];
    return pill(`${c}1f`, c, v.toUpperCase());
  };

  /* ---------------- the chain diagram ---------------- */
  const Chain = () => {
    const W = 140, H = 56;
    const col = (i) => 24 + i * 158;

    // kind: "have" (in the 65) | "miss" (not designed) | "ext" (SEI-owned)
    const Box = ({ x, y, label, tag, kind, w = W, h = H }) => {
      const fill = kind === "miss" ? "#fdf1f2" : kind === "ext" ? "#f3eefb" : "#fff";
      const stroke = kind === "miss" ? "#cc3344" : kind === "ext" ? "#6d3ac0" : "#1168bd";
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} rx="7" fill={fill} stroke={stroke}
            strokeWidth={kind === "miss" ? 1.8 : 1.3}
            strokeDasharray={kind === "miss" ? "6 4" : undefined} />
          <text x={x + w / 2} y={y + 23} fontSize="10.5" fontWeight="700" fill="#10193b"
            textAnchor="middle">{label}</text>
          <text x={x + w / 2} y={y + 40} fontSize="8.5"
            fill={kind === "miss" ? "#cc3344" : "#5c7c94"} textAnchor="middle">{tag}</text>
        </g>);
    };
    const Arr = ({ d, dash, label, lx, ly, tone }) => (
      <g>
        <path d={d} fill="none" stroke={tone || "#5c7c94"} strokeWidth="1.3"
          strokeDasharray={dash ? "4 4" : undefined} markerEnd="url(#arRv)" />
        {label && <text x={lx} y={ly} fontSize="8" fontStyle="italic" fill={tone || "#5c7c94"}
          textAnchor="middle">{label}</text>}
      </g>);

    return (
      <div style={{ ...card, padding: 16, overflowX: "auto" }}>
        <svg viewBox="0 0 1240 580" style={{ minWidth: 980, display: "block" }}>
          <defs>
            <marker id="arRv" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7"
              markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#5c7c94" /></marker>
          </defs>

          {/* SEI source views, read by the puller */}
          <Box x={col(5)} y={22} w={W} h={46} kind="ext"
            label="SEI source views" tag="current state only" />
          <Arr d={`M${col(5) + W / 2},68 L${col(5) + W / 2},108`} />
          <text x={col(5) + W / 2 + 66} y={92} fontSize="8" fontStyle="italic"
            fill="#6d3ac0" textAnchor="middle">set-based read</text>

          {/* row 1 — the ingestion chain */}
          <text x="24" y="100" fontSize="9.5" fontWeight="800" fill="#0f4775">
            INGESTION · events primary</text>
          <Box x={col(0)} y={110} kind="ext" label="SDC Event Hub" tag="4-field envelope" />
          <Box x={col(1)} y={110} kind="miss" label="Listener + G0" tag="M1 · M11 missing" />
          <Box x={col(2)} y={110} kind="miss" label="Event Staging" tag="M12 missing" />
          <Box x={col(3)} y={110} kind="miss" label="Key-Set Collapse" tag="M4 missing" />
          <Box x={col(4)} y={110} kind="miss" label="Domain Sequencer" tag="M7 missing" />
          <Box x={col(5)} y={110} kind="miss" label="Set-Based Puller" tag="M5 missing" />
          <Box x={col(6)} y={110} kind="have" label="Stage 1 RAW" tag="#14 · amend" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Arr key={i} d={`M${col(i) + W},138 L${col(i + 1)},138`} />))}

          {/* row 2 — control plane */}
          <text x="24" y="228" fontSize="9.5" fontWeight="800" fill="#0f4775">
            CONTROL PLANE · none of it exists</text>
          <Box x={col(0)} y={238} kind="miss" label="Consumer Lag" tag="M16 missing" />
          <Box x={col(1)} y={238} kind="miss" label="Event Quarantine" tag="M15 missing" />
          <Box x={col(2)} y={238} kind="miss" label="Micro-Batch Registry" tag="M13 missing" />
          <Box x={col(3)} y={238} kind="miss" label="Idempotency" tag="M14 missing" />
          <Box x={col(4)} y={238} kind="miss" label="Sequence Gaps" tag="M10 missing" />
          <Box x={col(6)} y={238} kind="miss" label="Gate Evaluator" tag="M8 missing" />
          {[0, 1, 2, 3, 4, 6].map((i) => (
            <Arr key={`c${i}`} dash d={`M${col(i) + W / 2},166 L${col(i) + W / 2},236`} />))}

          {/* Stage 1 wraps round to the transformation, clear of both rows */}
          <Arr d="M1100,166 L1100,198 L1196,198 L1196,342 L94,342 L94,368"
            label="Stage 1 → transformation · unchanged from the SEI pack" lx={640} ly={334} />

          {/* row 3 — transformation and the outbound loop */}
          <text x="24" y="360" fontSize="9.5" fontWeight="800" fill="#0f4775">
            TRANSFORMATION + OUTBOUND</text>
          <Box x={col(0)} y={370} kind="have" label="STG (a view)" tag="#15 · bottleneck B2" />
          <Box x={col(1)} y={370} kind="have" label="INT (Silver)" tag="7-day · B6" />
          <Box x={col(2)} y={370} kind="have" label="DIM then FACT" tag="#16 · schema risk" />
          <Box x={col(3)} y={370} kind="have" label="Outbound Producers" tag="#10" />
          <Box x={col(4)} y={370} kind="miss" label="Submission Registry" tag="M3 missing" />
          <Box x={col(5)} y={370} kind="miss" label="Receiver + Poller" tag="M2 · M9 missing" />
          <Box x={col(6)} y={370} kind="ext" label="SEI PS-Orch" tag="push + poll" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Arr key={`t${i}`} d={`M${col(i) + W},398 L${col(i + 1)},398`} />))}

          {/* Gold down to consumers */}
          <Box x={col(2)} y={470} kind="have" label="PBDW · IMDS · Pivotal" tag="#37–#39" h={46} />
          <Arr d={`M${col(2) + W / 2},426 L${col(2) + W / 2},468`} />

          {/* legend */}
          <g>
            <rect x="24" y="542" width="16" height="12" rx="3" fill="#fff" stroke="#1168bd" />
            <text x="46" y="552" fontSize="8.5" fill="#5c6b7a">in the 65</text>
            <rect x="130" y="542" width="16" height="12" rx="3" fill="#fdf1f2" stroke="#cc3344"
              strokeDasharray="4 3" />
            <text x="152" y="552" fontSize="8.5" fill="#5c6b7a">not designed anywhere</text>
            <rect x="308" y="542" width="16" height="12" rx="3" fill="#f3eefb" stroke="#6d3ac0" />
            <text x="330" y="552" fontSize="8.5" fill="#5c6b7a">SEI-owned</text>
            <text x="418" y="552" fontSize="8.5" fontStyle="italic" fill="#8a97a3">
              dashed vertical = the control record that component should be writing</text>
          </g>
        </svg>

        <div style={{ fontSize: 11, color: "#33414d", lineHeight: 1.65, marginTop: 12,
          maxWidth: 960 }}>
          <b>Read the picture this way.</b> Everything from Stage 1 rightward exists and is
          specified. Everything to its left does not exist in any document — that is the whole
          ingestion path under the new assumption. The control plane beneath it is empty, which
          matters more than it looks: without the micro-batch registry there is no completeness
          statement, without the staging store there is no lag or gap detection, and without a
          quarantine a single bad envelope stops a partition permanently.
        </div>
      </div>);
  };

  /* ---------------- cost multiplier table ---------------- */
  const Multiplier = () => (
    <div style={{ ...card, overflow: "hidden", marginTop: 14 }}>
      <div style={{ padding: "12px 16px 0" }}>
        <b style={{ fontSize: 12.5, color: navy }}>What the substitution multiplies</b>
        <div style={{ fontSize: 10.5, color: sub, marginTop: 2 }}>
          a five-minute cadence is 288 cycles a day; the pack was written for one
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11,
        marginTop: 10 }}>
        <thead>
          <tr style={{ background: "#f4f8fb" }}>
            {["Work item", "Daily file cycle", "Events at 5 min", "Consequence"].map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "8px 16px", fontSize: 9.5,
                color: sub, fontWeight: 800, letterSpacing: .3 }}>{h.toUpperCase()}</th>))}
          </tr>
        </thead>
        <tbody>
          {[
            ["STG view recomputation", "1×", "288×", "Each one scans Stage 1. The largest single cost the change introduces."],
            ["Airflow DAG runs + mapped tasks", "~1×", "~288×", "Scheduler and its metadata database were never sized for this."],
            ["G2 / G4 / G5 set-level aggregates", "1×", "288× if naive", "Must move to the EOD gate; only row-level gates run per micro-batch."],
            ["INT incremental MERGE", "1×", "288× into a growing partition", "The 6pm run is materially slower than the 6am one."],
            ["DIM-before-FACT ordering", "1×", "288×", "Paid even on boxes holding one domain. Order conditionally."],
            ["Splunk signal volume", "13 events", "13 × 288 × domains", "Ingest is metered. Decide the rollup before the contract."],
            ["SEI retrieval queries", "n/a", "cadence × views", "Not account count — accounts do not appear in the formula."],
          ].map((r) => (
            <tr key={r[0]} style={{ borderTop: "1px solid #eef1f4" }}>
              <td style={{ padding: "9px 16px", fontWeight: 600, color: navy }}>{r[0]}</td>
              <td style={{ padding: "9px 16px", color: "#5c7c94" }}>{r[1]}</td>
              <td style={{ padding: "9px 16px", fontWeight: 700, color: "#a8560f" }}>{r[2]}</td>
              <td style={{ padding: "9px 16px", color: "#33414d" }}>{r[3]}</td>
            </tr>))}
        </tbody>
      </table>
    </div>);

  /* ---------------- expandable card list ---------------- */
  const CardList = ({ rows, render }) => (
    <div style={{ display: "grid", gap: 8 }}>
      {rows.map((r) => {
        const isOpen = open === r.id;
        return (
          <div key={r.id} style={{ ...card, overflow: "hidden" }}>
            <div onClick={() => setOpen(isOpen ? null : r.id)}
              style={{ padding: "11px 16px", cursor: "pointer", display: "flex",
                alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: "Roboto Mono, monospace", fontSize: 10,
                fontWeight: 700, color: sub, minWidth: 30 }}>{r.id}</span>
              <b style={{ fontSize: 12, color: navy, flex: 1 }}>{r.title || r.name}</b>
              {r.sev && sevPill(r.sev)}
              {r.verdict && verPill(r.verdict)}
              {r.pri && pill("#0f47751f", "#0f4775", r.pri)}
              <span style={{ fontSize: 11, color: sub }}>{isOpen ? "−" : "+"}</span>
            </div>
            {isOpen && (
              <div style={{ padding: "0 16px 14px", borderTop: "1px solid #eef1f4" }}>
                {render(r)}
              </div>)}
          </div>);
      })}
    </div>);

  const Field = ({ k, v, tone }) => (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: .4,
        color: tone || sub }}>{k.toUpperCase()}</div>
      <div style={{ fontSize: 11, color: "#33414d", lineHeight: 1.6, marginTop: 2 }}>{v}</div>
    </div>);

  /* ---------------- render ---------------- */
  return (
    <div>
      {onBack}
      <div style={{ ...card, padding: "14px 18px", marginBottom: 12,
        borderLeft: "3px solid #cc3344" }}>
        <b style={{ fontSize: 14, color: navy }}>{AR_SUMMARY.title}</b>
        <div style={{ fontSize: 11.5, color: "#33414d", lineHeight: 1.65, marginTop: 5,
          maxWidth: 980 }}>{AR_SUMMARY.line}</div>
        <div style={{ display: "flex", gap: 18, marginTop: 10, flexWrap: "wrap" }}>
          {[["18", "components missing"], ["10", "bottlenecks"], ["12", "unowned error paths"],
            ["25", "of 65 affected"], ["40", "unaffected"]].map(([n, l]) => (
            <div key={l}>
              <div style={{ fontSize: 19, fontWeight: 800, color: navy,
                lineHeight: 1 }}>{n}</div>
              <div style={{ fontSize: 9.5, color: sub, marginTop: 2 }}>{l}</div>
            </div>))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {TABS.map(([k, label, note]) => (
          <span key={k} onClick={() => { setTab(k); setOpen(null); }}
            style={{ padding: "7px 14px", borderRadius: 6, cursor: "pointer",
              fontSize: 11, fontWeight: 700,
              background: tab === k ? navy : "#eef3f8",
              color: tab === k ? "#fff" : t.accent || "#0f4775" }}>
            {label}
            <span style={{ fontSize: 9, opacity: .72, marginLeft: 6,
              fontWeight: 600 }}>{note}</span>
          </span>))}
      </div>

      {tab === "FLOW" && (<div><Chain /><Multiplier /></div>)}

      {tab === "MISS" && (
        <div>
          <div style={{ fontSize: 11, color: "#33414d", marginBottom: 10, maxWidth: 960,
            lineHeight: 1.6 }}>
            Eighteen components with no entry in the 65 and no section in the SEI pack. Twelve
            of them are the event path itself; the rest are the outbound loop and the two
            registries that make lateness and schema change detectable.
          </div>
          <CardList rows={AR_MISSING} render={(r) => (<>
            <Field k="plane · technology" v={`${r.plane} · ${r.tech} · custom build ${r.build}`} />
            <Field k="deliverable" v={r.deliverable} />
            <Field k="performance" v={r.perf} tone="#a8560f" />
            <Field k="error handling" v={r.err} tone="#cc3344" />
            <Field k="why it is missing" v={r.why} />
          </>)} />
        </div>)}

      {tab === "PERF" && (
        <div>
          <div style={{ fontSize: 11, color: "#33414d", marginBottom: 10, maxWidth: 960,
            lineHeight: 1.6 }}>
            Ranked by what fails first at real volume. None of these are defects in the pack —
            every one is a design decision that was correct for a daily file cycle and stops
            being correct at 288 cycles a day.
          </div>
          <CardList rows={AR_BOTTLENECKS} render={(r) => (<>
            <Field k="what happens" v={r.body} />
            <Field k="what to do" v={r.fix} tone="#159943" />
            <Field k="components" v={r.comp.join(" · ")} />
          </>)} />
        </div>)}

      {tab === "ERR" && (
        <div>
          <div style={{ fontSize: 11, color: "#33414d", marginBottom: 10, maxWidth: 960,
            lineHeight: 1.6 }}>
            Failure modes with no component that owns them. The first four are the ones that
            lose data silently — no alert fires, no count disagrees, and nothing in the existing
            reconciliation can see them.
          </div>
          <CardList rows={AR_ERRORS} render={(r) => (<>
            <Field k="what happens" v={r.body} />
            <Field k="who owns it today" v={r.owner} tone="#cc3344" />
            <Field k="components" v={r.comp.join(" · ")} />
          </>)} />
        </div>)}

      {tab === "MAP" && (
        <div>
          <div style={{ fontSize: 11, color: "#33414d", marginBottom: 10, maxWidth: 960,
            lineHeight: 1.6 }}>
            Twenty-five of the sixty-five change. The other forty — platform, runtime,
            deployment, consumers — are unaffected by how the data arrives.
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            {Object.entries(AR_VERDICTS).map(([k, [c, note]]) => (
              <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6,
                fontSize: 10, color: sub }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
                <b style={{ color: c }}>{k}</b> — {note}
              </span>))}
          </div>
          <CardList rows={AR_FINDINGS.map((f) => ({ ...f, title: `#${f.id} ${f.name}` }))}
            render={(r) => (<>
              <Field k="finding" v={r.finding} />
              <Field k="action" v={r.action} tone="#159943" />
            </>)} />
        </div>)}

      {tab === "ASSUME" && (
        <div style={{ ...card, overflow: "hidden" }}>
          {AR_ASSUMPTIONS.map((a) => (
            <div key={a.id} style={{ display: "grid",
              gridTemplateColumns: "44px 96px minmax(0,1fr)", gap: 12,
              padding: "12px 16px", borderTop: "1px solid #eef1f4", alignItems: "start" }}>
              <span style={{ fontFamily: "Roboto Mono, monospace", fontSize: 10,
                fontWeight: 700, color: sub }}>{a.id}</span>
              <span>{a.holds === "changed"
                ? pill("#cc33441f", "#cc3344", "CHANGED")
                : pill("#1599431f", "#159943", "HELD")}</span>
              <div>
                <b style={{ fontSize: 11.5, color: navy }}>{a.what}</b>
                <div style={{ fontSize: 11, color: "#33414d", lineHeight: 1.6,
                  marginTop: 3 }}>{a.detail}</div>
                <div style={{ fontSize: 9.5, color: sub, marginTop: 4 }}>
                  source: {a.src}</div>
              </div>
            </div>))}
        </div>)}
    </div>);
}
