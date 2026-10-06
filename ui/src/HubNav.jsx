// Shared navigation affordances for the Hub drill-down.
//
// THE PROBLEM THIS SOLVES. Half the Hub is clickable and almost none of it
// looked it. A card that opens a screen was drawn exactly like a card that
// is only text, and a box in a diagram that opens a model was drawn
// exactly like a box that is a label. cursor:pointer is not an affordance:
// it appears only once the pointer is already on the thing, so it tells
// you what you have found, never what to look for.
//
// INLINE STYLES CANNOT EXPRESS HOVER, which is why this file exists at
// all. The Hub styles everything inline, and :hover, :focus-visible and
// transitions have no inline form. One small injected stylesheet gives
// three classes - cp-open, cp-hit, cp-row - and everything clickable wears
// one of them. That is the whole mechanism.
//
// THE RULE: ONE AFFORDANCE PER KIND, USED EVERYWHERE.
//   cp-open   a card that opens a screen. Carries a chevron at rest, so
//             it reads as clickable before the pointer arrives.
//   cp-hit    a node in a diagram. Carries a corner chevron at rest and
//             thickens on hover.
//   cp-row    a row in a list. Tints on hover only; a chevron on every
//             row of a 52-row table is noise.
// A reader learns three shapes once instead of guessing on every screen.

import React from "react";

export const NAV_CSS = `
.cp-open{position:relative;transition:border-color .12s,box-shadow .12s,transform .12s;
 cursor:pointer;outline:none}
.cp-open:hover{border-color:var(--cp-accent,#0f4775) !important;
 box-shadow:0 2px 10px rgba(16,25,59,.09);transform:translateY(-1px)}
.cp-open:focus-visible{box-shadow:0 0 0 3px rgba(15,71,117,.28)}
.cp-open .cp-go{position:absolute;right:13px;bottom:11px;font-size:11px;
 font-weight:700;color:var(--cp-accent,#0f4775);opacity:.62;
 transition:opacity .12s,transform .12s;white-space:nowrap}
.cp-open:hover .cp-go{opacity:1;transform:translateX(2px)}
.cp-hit{cursor:pointer;outline:none}
.cp-hit rect.cp-bx,.cp-hit path.cp-bx{transition:stroke-width .12s,stroke .12s}
.cp-hit:hover rect.cp-bx,.cp-hit:hover path.cp-bx{stroke-width:2.6}
.cp-hit:focus-visible rect.cp-bx{stroke-width:3}
.cp-hit text.cp-go{opacity:.5;transition:opacity .12s}
.cp-hit:hover text.cp-go{opacity:1}
.cp-row{cursor:pointer;transition:background .1s}
.cp-row:hover{background:var(--cp-tint,#f2f6fa)}
@media (prefers-reduced-motion:reduce){
 .cp-open,.cp-open .cp-go,.cp-hit rect.cp-bx{transition:none}
 .cp-open:hover{transform:none}
}`;

// Rendered at the top of every screen that uses these classes, so a leaf
// view is self-contained and does not depend on a parent having styled the
// page for it. Two copies on one page are harmless: the rules are
// identical, so whichever wins is the same stylesheet.
export function NavStyles() {
 return <style id="cp-nav-css" dangerouslySetInnerHTML={{ __html: NAV_CSS }} />;
}

/* A card that opens something. The label says WHAT opens, because "open"
   on its own makes the reader click to find out, which is the thing this
   is supposed to prevent. */
export function OpenCard({ onClick, opens, style, children, tabIndex }) {
 const go = (e) => {
  if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
  if (e.type === "keydown") e.preventDefault();
  onClick && onClick(e);
 };
 return (
  <div className="cp-open" onClick={go} onKeyDown={go}
   tabIndex={tabIndex === undefined ? 0 : tabIndex} role="button"
   style={{ paddingBottom: opens ? 30 : undefined, ...style }}>
   {children}
   {opens && <span className="cp-go">{opens} &rarr;</span>}
  </div>);
}

/* The line under a diagram that says it is interactive. A diagram with no
   such line is read as a picture, and nobody clicks a picture. */
export function ClickHint({ children, c }) {
 return (
  <div style={{ fontSize: 11.5, color: c || "#4a5a68", marginTop: 8,
   display: "flex", gap: 7, alignItems: "baseline" }}>
   <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: .5,
    textTransform: "uppercase", color: "#0f4775",
    border: "1px solid #c9d4dc", borderRadius: 999, padding: "1px 8px",
    whiteSpace: "nowrap" }}>Clickable</span>
   <span>{children}</span>
  </div>);
}

/* The corner chevron on a diagram node. This is the whole point of
   cp-hit: it is visible at rest, so a reader scanning the picture can see
   which boxes go somewhere without touching any of them. The node itself
   only needs className="cp-hit" and a rect carrying className="cp-bx". */
export function SvgGo({ x, y, c }) {
 return <text className="cp-go" x={x} y={y} textAnchor="end" fontSize="12"
  fontWeight="700" fill={c || "#0f4775"}>{"›"}</text>;
}

/* One breadcrumb, one shape, never more than four steps. Anything deeper
   than four means the hierarchy is wrong, not that the trail needs to be
   longer. */
export function Trail({ steps, t }) {
 const ink = (t && t.navy) || "#10193b";
 const acc = (t && t.accent) || "#0f4775";
 return (
  <div style={{ display: "flex", alignItems: "center", gap: 7,
   flexWrap: "wrap", marginBottom: 12, fontSize: 11 }}>
   {steps.filter(Boolean).map(([label, go], i) => (
    <span key={label + i} style={{ display: "inline-flex",
     alignItems: "center", gap: 7 }}>
     {i > 0 && <span style={{ color: "#9aa7b2" }}>{"›"}</span>}
     <span onClick={go || undefined} tabIndex={go ? 0 : undefined}
      role={go ? "button" : undefined}
      onKeyDown={go ? (e) => { if (e.key === "Enter") go(); } : undefined}
      style={{ fontWeight: go ? 700 : 800, cursor: go ? "pointer" : "default",
       padding: "5px 12px", borderRadius: 999,
       background: go ? "#eef3f8" : ink, color: go ? acc : "#fff" }}>
      {label}</span>
    </span>))}
  </div>);
}
