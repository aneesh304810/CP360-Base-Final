// A transformation rule drawn as the operations it performs.
//
// The text panes in ChainRules show the two rules side by side and leave
// the reader to hold both in their head. That works for a one-liner. For
// eleven operations against four, with a join on one side and a branch on
// the other, the difference is a SHAPE, and a shape is what a picture is
// for.
//
// Three decisions carry the design:
//
//   Colour is the operator KIND, never the track. Field, function, branch,
//   join, aggregate, target; the track is a background band. Colouring by
//   track would make two identical rules look different, which is exactly
//   backwards for a comparison.
//
//   A node with no counterpart on the other track is ringed. That is the
//   whole comparison, drawn: everything ringed is where the two rules stop
//   having the same shape.
//
//   Prose is kept. The SEI cells mix sentences with pseudo-code, and a
//   line that will not parse is parked to the right as commentary rather
//   than dropped. A rule drawn with a line missing is a different rule
//   that still looks complete.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { buildComparisonGraph } from "./ruleGraph.js";
import { layoutGraph } from "./dagLayout.js";
import { crosswalkApi } from "./seiCrosswalkApi.js";

const MONO = "'Roboto Mono', ui-monospace, Menlo, monospace";

const KIND_C = { field: "#6d3ac0", const: "#7b8894", fn: "#00a3a3",
                 branch: "#e67e22", join: "#7c3aed", agg: "#0091bf",
                 target: "#0f4775", prose: "#7b8894" };
const KIND_LABEL = { field: "field", const: "const", fn: "function",
                     branch: "branch", join: "join", agg: "aggregate",
                     target: "target", prose: "note" };
const TRACK = {
  legacy: { band: "#fdf6ef", edge: "#b5651d", label: "Today · STAR → IMDS" },
  sei:    { band: "#f1f8fc", edge: "#0091bf", label: "Proposed · SEI" },
};
const RES_LABEL = {
  "name+ordinal": "name and ordinal both match — confirmed",
  name: "name matches, ordinal does not — likely",
  ordinal: "ordinal only — a guess",
};
const RES_C = { "name+ordinal": "#159943", name: "#0091bf", ordinal: "#e67e22" };

export default function OperatorGraph({ t, legacyText, seiText, target,
                                        dataSource }) {
  const graph = useMemo(
    () => buildComparisonGraph(legacyText, seiText, target || "target"),
    [legacyText, seiText, target]);
  const view = useMemo(() => layoutGraph(graph), [graph]);

  const [sel, setSel] = useState(null);
  const [diffOnly, setDiffOnly] = useState(false);
  const [res, setRes] = useState(null);
  const [z, setZ] = useState({ k: 1, x: 0, y: 0 });
  const box = useRef(null);
  const drag = useRef(null);

  // Field tokens resolve against the 434 published STAR layout fields, so
  // a node can say WHICH field it reads rather than only what it is
  // called. Batched: one call for every token in both graphs.
  const tokens = useMemo(() => [...new Set(
    graph.nodes.filter((n) => n.kind === "field" && !n.local).map((n) => n.lab)
  )], [graph]);
  useEffect(() => {
    if (!tokens.length) { setRes(null); return; }
    let live = true;
    crosswalkApi.resolveTokens(tokens, dataSource).then((r) => {
      if (!live) return;
      const m = {};
      (r.tokens || []).forEach((x) => { m[x.token] = x; });
      setRes(m);
    });
    return () => { live = false; };
  }, [tokens.join("|"), dataSource]);   // eslint-disable-line react-hooks/exhaustive-deps

  const fit = () => {
    const el = box.current;
    if (!el || !view.W) return;
    const r = el.getBoundingClientRect();
    const k = Math.max(0.3, Math.min((r.width - 24) / view.W,
                                     (r.height - 24) / view.H, 1.15));
    setZ({ k, x: (r.width - view.W * k) / 2, y: (r.height - view.H * k) / 2 });
  };
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!view.nodes.length) return null;
  const ringed = new Set([...graph.onlyLegacy, ...graph.onlySei]);
  const keep = (n) => !diffOnly || ringed.has(n.id)
    || ["target", "branch", "join"].includes(n.kind);

  const onDown = (e) => {
    if (e.target.closest("[data-node]") || e.target.closest("[data-ctl]")) return;
    drag.current = { x: e.clientX - z.x, y: e.clientY - z.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    if (!drag.current) return;
    setZ((s) => ({ ...s, x: e.clientX - drag.current.x,
                          y: e.clientY - drag.current.y }));
  };
  const onUp = () => { drag.current = null; };
  const onWheel = (e) => {
    e.preventDefault();
    const r = box.current.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    setZ((s) => {
      const k = Math.max(0.3, Math.min(2, s.k * (e.deltaY < 0 ? 1.08 : 1 / 1.08)));
      return { k, x: mx - (mx - s.x) * (k / s.k), y: my - (my - s.y) * (k / s.k) };
    });
  };

  const ctl = { background: t.panel || "#fff", font: "inherit", fontSize: 10.5,
    border: `1px solid ${t.panel2 || "#dfe6e9"}`, borderRadius: 3,
    padding: "3px 9px", cursor: "pointer", color: t.accent || "#0f4775" };

  const selNode = view.nodes.find((n) => n.id === sel);

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", gap: 9, alignItems: "baseline",
        flexWrap: "wrap", marginBottom: 7 }}>
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
          textTransform: "uppercase", color: t.muted || "#999" }}>
          The rule, as operations</span>
        <span style={{ fontSize: 10, color: t.muted || "#999" }}>
          {graph.legacy.nodes.length - 1} legacy · {graph.sei.nodes.length - 1} proposed
          {graph.unparsed ? ` · ${graph.unparsed} line${
            graph.unparsed === 1 ? "" : "s"} kept as a note` : ""}</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 5 }}>
          <button type="button" data-ctl onClick={() => setDiffOnly((v) => !v)}
            style={{ ...ctl, ...(diffOnly
              ? { background: t.accent || "#0f4775", color: "#fff",
                  borderColor: t.accent || "#0f4775" } : {}) }}>
            differences only</button>
          <button type="button" data-ctl onClick={fit} style={ctl}>fit</button>
        </span>
      </div>

      <div ref={box} onPointerDown={onDown} onPointerMove={onMove}
        onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}
        style={{ position: "relative", overflow: "hidden", height: 330,
          background: t.bg || "#f5f8f8", borderRadius: 4,
          border: `1px solid ${t.panel2 || "#dfe6e9"}`,
          cursor: drag.current ? "grabbing" : "grab", touchAction: "none" }}>
        <div style={{ position: "absolute", inset: 0, transformOrigin: "0 0",
          transform: `translate(${z.x}px,${z.y}px) scale(${z.k})` }}>
          {view.bands.map((b) => (
            <React.Fragment key={b.track}>
              <div style={{ position: "absolute", left: 0, top: b.y,
                width: view.W, height: b.h, borderRadius: 5,
                border: `1px dashed ${t.panel2 || "#dfe6e9"}`,
                background: TRACK[b.track].band }} />
              <div style={{ position: "absolute", left: 8, top: b.y - 9,
                fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6,
                textTransform: "uppercase", padding: "2px 7px", borderRadius: 3,
                color: "#fff", background: TRACK[b.track].edge }}>
                {TRACK[b.track].label}</div>
            </React.Fragment>))}

          <svg width={view.W} height={view.H} aria-hidden="true"
            style={{ position: "absolute", left: 0, top: 0,
              pointerEvents: "none", overflow: "visible" }}>
            {graph.edges.map(([a, b, lab], i) => {
              const A = view.nodes.find((n) => n.id === a);
              const B = view.nodes.find((n) => n.id === b);
              if (!A || !B) return null;
              const x1 = A.x + A.w, y1 = A.y + A.h / 2, x2 = B.x, y2 = B.y + B.h / 2;
              const mx = (x1 + x2) / 2;
              const lit = !sel || sel === a || sel === b;
              const vis = keep(A) && keep(B);
              const op = !vis ? 0.1 : lit ? 0.85 : 0.2;
              const c = TRACK[A.track].edge;
              return (
                <g key={i}>
                  <path d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                    fill="none" stroke={c} strokeWidth={lit && sel ? 2.1 : 1.4}
                    opacity={op} />
                  <circle cx={x2 - 2} cy={y2} r="2.6" fill={c} opacity={op} />
                  {lab && <text x={mx} y={(y1 + y2) / 2 - 5} textAnchor="middle"
                    fill={c} opacity={op} fontFamily={MONO} fontSize="9"
                    fontWeight="700">{lab}</text>}
                </g>);
            })}
          </svg>

          {view.nodes.map((n) => {
            const c = KIND_C[n.kind] || "#5f87a7";
            const on = sel === n.id;
            const r = res && res[n.lab];
            return (
              <button key={n.id} type="button" data-node
                onClick={() => setSel(on ? null : n.id)}
                title={`${KIND_LABEL[n.kind]} · ${n.lab}`
                  + (n.sub ? `\n${n.sub}` : "")
                  + (r && r.field ? `\n${r.field.feed_family} field ${r.field.ordinal}`
                      + ` · ${r.field.field_name}` : "")}
                style={{ position: "absolute", left: n.x, top: n.y,
                  width: n.w, height: n.h, textAlign: "left",
                  display: "flex", flexDirection: "column",
                  justifyContent: "center", padding: "5px 8px",
                  background: n.kind === "prose" ? "transparent" : (t.panel || "#fff"),
                  border: n.kind === "prose"
                    ? `1px dashed ${t.panel2 || "#dfe6e9"}`
                    : `1px solid ${on ? c : (t.panel2 || "#dfe6e9")}`,
                  borderLeft: n.kind === "prose" ? undefined : `3px solid ${c}`,
                  borderRadius: 4, cursor: "pointer", font: "inherit",
                  opacity: keep(n) ? 1 : 0.26,
                  boxShadow: on ? `0 0 0 2px ${c}` : "0 1px 2px rgba(16,25,59,.06)",
                  outline: ringed.has(n.id) ? "1.5px dashed #c1113a" : "none",
                  outlineOffset: 3 }}>
                <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 0.5,
                  textTransform: "uppercase", color: c }}>
                  {KIND_LABEL[n.kind]}</span>
                <span style={{ fontFamily: n.kind === "prose" ? "inherit" : MONO,
                  fontSize: n.kind === "prose" ? 9.5 : 10.5,
                  color: t.navy || "#10193b", overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.lab}</span>
                <span style={{ fontSize: 9, color: r ? (RES_C[r.confidence]
                    || (t.muted || "#999")) : (t.muted || "#999"),
                  overflow: "hidden", textOverflow: "ellipsis",
                  whiteSpace: "nowrap" }}>
                  {r && r.field
                    ? `${r.field.feed_family} · ${r.field.ordinal}`
                    : n.sub}</span>
              </button>);
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: 11, flexWrap: "wrap", marginTop: 8,
        fontSize: 9.5, color: t.sub || "#666" }}>
        {Object.keys(KIND_LABEL).map((k) => (
          <span key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <i style={{ width: 9, height: 9, borderRadius: 2,
              background: KIND_C[k] }} />{KIND_LABEL[k]}</span>))}
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <i style={{ width: 9, height: 9, borderRadius: 2,
            border: "1.5px dashed #c1113a" }} />only on one track</span>
      </div>

      {selNode && (
        <div style={{ marginTop: 9, border: `1px solid ${t.panel2 || "#dfe6e9"}`,
          borderLeft: `3px solid ${KIND_C[selNode.kind]}`, borderRadius: 3,
          padding: "8px 11px", background: "#f7fafc", fontSize: 11,
          lineHeight: 1.6, color: t.sub || "#666" }}>
          <b className="mono" style={{ fontFamily: MONO, fontSize: 11.5,
            color: t.navy || "#10193b" }}>{selNode.lab}</b>
          {" — "}{KIND_LABEL[selNode.kind]} on the{" "}
          {selNode.track === "legacy" ? "legacy" : "proposed"} side.
          {selNode.sub ? ` ${selNode.sub}.` : ""}
          {res && res[selNode.lab] && res[selNode.lab].field && (
            <div style={{ color: RES_C[res[selNode.lab].confidence] }}>
              {res[selNode.lab].field.feed_family} field{" "}
              {res[selNode.lab].field.ordinal} ·{" "}
              {res[selNode.lab].field.field_name} —{" "}
              {RES_LABEL[res[selNode.lab].confidence]}</div>)}
          {ringed.has(selNode.id) && (
            <div style={{ color: "#c1113a" }}>
              No operation on the other track corresponds to this one.</div>)}
        </div>)}
    </div>);
}
