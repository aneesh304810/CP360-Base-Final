# Popup layout — lineage FIRST, description BELOW (human reading order)

In the roomy popup the definition reads top-to-bottom like a story:
  1. the journey (SRC -> STG1 -> STG2 -> DWH with boundary badges)
  2. stage-by-stage proof
  3. also-lands-in / other-warehouse chips
  4. THEN the dictionary: master bar, term, full description
Table-mode inline keeps the side-by-side two-column layout (unchanged).
Two edits in InlineDef — pure reorder, no content changes.

## Edit A — container: stack vertically when roomy
FIND:
    <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "1fr 1.25fr" }}>
REPLACE:
    <div style={{ display: roomy ? "flex" : "grid", flexDirection: "column",
      gridTemplateColumns: compact ? "1fr" : "1fr 1.25fr" }}>

## Edit B — dictionary half moves BELOW the lineage half
FIND:
      <div style={{ borderRight: compact ? "none" : `1px solid ${t.panel2 || "#dfe6e9"}` }}>
REPLACE:
      <div style={{ order: roomy ? 2 : 0,
        borderRight: (compact || roomy) ? "none" : `1px solid ${t.panel2 || "#dfe6e9"}`,
        borderTop: roomy ? `1px solid ${t.panel2 || "#dfe6e9"}` : "none" }}>

Why it works: in the roomy flex column the lineage half keeps default
order 0 and renders first; the dictionary half takes order 2 and drops
below with a divider line. In grid mode (inline / compact) order is
ignored and today's side-by-side stays byte-identical.

## Verify
Popup: journey cards straight across the top at full width (five stages fit
comfortably now that the panel is single-column), proof under it, then the
orange-accented dictionary block with the full description — read top to
bottom like a sentence: where it flows, what we saw, what it means.
Inline in table mode: unchanged side-by-side.
