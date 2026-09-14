# Technical view — smart widths for 10–20 character identifiers
Principle: identifiers are monospace, so size in `ch` units. 20ch guarantees
a 20-character name on ONE line; cards never grow wider than ~26ch, so no
empty slabs; anything longer ellipsizes with the full name on hover (your
title= tooltips already exist). Three edits.

## Edit 1 — Journey stage cards (InlineDef's chain)
FIND:
        <div style={{ flex: "1 1 118px", minWidth: 108, maxWidth: 220, position: "relative",
          padding: "0 5px" }}>
REPLACE:
        <div style={{ flex: "0 1 auto", minWidth: "15ch", maxWidth: "26ch",
          position: "relative", padding: "0 5px" }}>
And in the same Journey, the column name line — stop mid-word breaking
(ugly for 10–20 char names that actually fit):
FIND:    color: t.navy || "#10193b", marginTop: 5, wordBreak: "break-all" }}>{s.col}</div>
REPLACE: color: t.navy || "#10193b", marginTop: 5, overflow: "hidden",
           textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.col}</div>
(and add title={s.col} on that div so hover shows the rare 20+ char name)

## Edit 2 — table-mode chain cards
FIND:    borderRadius: 8, padding: "7px 10px", minWidth: 140, background: "#fff",
REPLACE: borderRadius: 8, padding: "7px 10px", minWidth: "16ch", maxWidth: "28ch",
           background: "#fff",

## Edit 3 — map board columns sized to identifier reality
FIND:
    const rowGrid = { display: "grid", gridTemplateColumns: "1fr 1.3fr 1fr", gap: 44,
      alignItems: "start" };
(or the original `gap: 56` line if spacing patch not yet applied)
REPLACE:
    const rowGrid = { display: "grid",
      gridTemplateColumns: "minmax(22ch, 1fr) minmax(30ch, 1.3fr) minmax(22ch, 1fr)",
      gap: 44, alignItems: "start" };
Why 22ch: table prefix + a 20ch column name fits the DWH card without wrap;
the middle lane gets 30ch for file names; below 1200px the minmax floors
keep cards readable instead of crushing.

## Also (from the roomy patch, refined for 10–20ch values)
In InlineDef the kv value cells and proof cells already fit 20ch at 12.5px
mono inside the popup; no change needed. If a proof VALUE exceeds ~40ch
(your GST EXEMPT strings), it wraps naturally — values wrap, NAMES never do.
That is the arrangement rule in one line: names one line always, values
wrap, cards hug content between 15ch and 28ch.
