# LegacyLineage.jsx — Linkage Map spacing fix · 3 surgical edits
Apply with exact find/replace. No other lines change.

## Edit 1 — rows align to top, slightly tighter wire gap
FIND:
    const rowGrid = { display: "grid", gridTemplateColumns: "1fr 1.3fr 1fr", gap: 56 };
REPLACE:
    const rowGrid = { display: "grid", gridTemplateColumns: "1fr 1.3fr 1fr", gap: 44,
      alignItems: "start" };

Why: grid rows default to stretch — every card in a row inherits the tallest
card's height. alignItems:start lets each card size to its content.

## Edit 2 — cards stop stretching (the giant empty DWH cards)
FIND:
    padding: "9px 12px", position: "relative", cursor: "pointer", height: "100%",
REPLACE:
    padding: "9px 12px", position: "relative", cursor: "pointer",

Why: height:"100%" is what inflated the sparse DWH cards to match the tall
middle cards — the big blank white boxes in your screenshot. The SVG wires
self-correct: draw() reads getBoundingClientRect() live, so they re-anchor
to the new card middles automatically.

## Edit 3 — the opened InlineDef sits cleanly above the wires
FIND:
                {dOpen && (
                  <div style={{ marginBottom: 11 }}>
REPLACE:
                {dOpen && (
                  <div style={{ margin: "2px 0 16px", position: "relative", zIndex: 3,
                    boxShadow: "0 10px 24px rgba(0,0,0,.14)", borderRadius: 9 }}>

Why: the panel now floats visually above the wire layer with clear
separation, instead of the wires appearing to slice through it and the
panel crowding the row above.

(Whitespace note: your file uses single-space indentation in places — if a
FIND string does not match exactly, match on the unique fragments
`gap: 56`, `height: "100%",` and `<div style={{ marginBottom: 11 }}>`.)

## Verify
Linkage Map → Account Master: all three cards in each row hug their content
(no empty white slabs), wires meet card mid-heights, and opening a
dictionary card drops a clearly-separated shadowed panel below the row
without disturbing the rows above it.
