// DevOps 360 · the build-status palette, shared by the page and its
// reference cards. One module so neither imports the other.
import React from "react";

export const PAL = (t) => ({
  ink: t.text,
  mut: t.textMuted,
  line: t.border,
  fast: "#0091bf",   // legible on white and on #0f172a
  pin: "#7c3aed",
  ok: t.success,
  no: t.danger,
  wa: t.warning,
});

// Build status as a colour pattern, the same on every figure. The figures
// draw the design; the pattern says how much of it exists today. Built is
// a green stroke on a green tint, partial an amber stroke on an amber tint,
// pending a grey dashed stroke on nothing — and each box also carries the
// word, so the status survives a monochrome print.
export const STATUS_TEXT = {
  built: "runs today",
  partial: "the concern is covered, not the way the design specifies it",
  pending: "nothing yet",
};
export function sp(C, s) {
  if (s === "built") return { fill: "rgba(21,153,67,.10)", stroke: C.ok,
    strokeWidth: 1.8, strokeDasharray: undefined };
  if (s === "partial") return { fill: "rgba(230,126,34,.12)", stroke: C.wa,
    strokeWidth: 1.8, strokeDasharray: undefined };
  return { fill: "none", stroke: C.mut, strokeWidth: 1.2, strokeDasharray: "4 3" };
}
export function SBox({ C, s, x, y, w, h, rx = 3, stroke, strokeWidth }) {
  const p = sp(C, s);
  return (<>
    <rect x={x} y={y} width={w} height={h} rx={rx} fill={p.fill}
      stroke={stroke || p.stroke} strokeWidth={strokeWidth || p.strokeWidth}
      strokeDasharray={p.strokeDasharray} />
    <text x={x + w - 6} y={y + 10} textAnchor="end" fontSize={7.5} fontWeight={800}
      letterSpacing=".4" fill={p.stroke}>{s.toUpperCase()}</text>
  </>);
}
export function Legend({ t, note }) {
  const C = PAL(t);
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap",
      fontSize: 11, color: t.sub, margin: "0 0 8px" }}>
      {["built", "partial", "pending"].map((s) => { const p = sp(C, s); return (
        <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <svg width={26} height={14} aria-hidden="true">
            <rect x={1} y={1} width={24} height={12} rx={2} fill={p.fill}
              stroke={p.stroke} strokeWidth={1.4} strokeDasharray={p.strokeDasharray} /></svg>
          <b style={{ color: p.stroke, fontSize: 9.5, letterSpacing: .4 }}>{s.toUpperCase()}</b>
          <span>{STATUS_TEXT[s]}</span>
        </span>); })}
      {note && <span style={{ color: t.textMuted }}>{note}</span>}
    </div>);
}
