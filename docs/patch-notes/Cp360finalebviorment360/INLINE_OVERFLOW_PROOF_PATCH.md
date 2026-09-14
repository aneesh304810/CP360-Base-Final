# PATCH 7 — inline InlineDef overflow: grid blowout + proof wrap
Fixes what your three screenshots show in TABLE and BIZ modes (the inline
panel): the lineage half spilling past its column, journey cards colliding,
and the proof values running together into one unreadable line.
Root cause 1: grid children default to min-width:auto — content FORCES the
track wider than the panel. Root cause 2: the proof is a horizontal table
whose four 30+ char values can never fit half a panel.

## Edit A — stop the grid blowout (the one-line core fix)
Both halves of the InlineDef grid get minWidth:0 so they can never be
pushed wider than their track; overflow then wraps instead of colliding.

A1 · dictionary half opener.
IF you applied PATCH 5, FIND:
      <div style={{ order: roomy ? 2 : 0,
        borderRight: (compact || roomy) ? "none" : `1px solid ${t.panel2 || "#dfe6e9"}`,
        borderTop: roomy ? `1px solid ${t.panel2 || "#dfe6e9"}` : "none" }}>
REPLACE (adds minWidth:0):
      <div style={{ order: roomy ? 2 : 0, minWidth: 0,
        borderRight: (compact || roomy) ? "none" : `1px solid ${t.panel2 || "#dfe6e9"}`,
        borderTop: roomy ? `1px solid ${t.panel2 || "#dfe6e9"}` : "none" }}>
IF NOT yet patched, the FIND is the original:
      <div style={{ borderRight: compact ? "none" : `1px solid ${t.panel2 || "#dfe6e9"}` }}>
→ add `minWidth: 0,` inside the style object the same way.

A2 · lineage half opener.
IF you applied PATCH 3, FIND:
      <div style={{ padding: roomy ? "16px 22px" : "10px 14px" }}>
ELSE FIND:
      <div style={{ padding: "10px 14px" }}>
REPLACE (either way): add `minWidth: 0, overflow: "hidden",` into the style.

## Edit B — proof becomes wrap-safe stage blocks (kills the value collision)
Replace the horizontal proof TABLE with flex-wrapping blocks: stage label on
top, value beneath, values allowed to wrap. Apply to BOTH occurrences.

B1 · inside InlineDef. FIND (the whole block):
                  <table style={{ borderCollapse: "collapse", fontSize: 11 }}><tbody>
                    <tr>{proof.map((p) => (
                      <th key={p.stage} style={{ textAlign: "left", padding: "2px 16px 2px 0",
                        fontSize: 8, textTransform: "uppercase",
                        color: STAGE_C[p.stage] || (t.muted || "#999") }}>{p.stage}</th>))}</tr>
                    <tr>{proof.map((p) => (
                      <td key={p.stage} style={{ padding: "2px 16px 2px 0",
                        fontFamily: "Roboto Mono, monospace", color: t.navy || "#10193b" }}>
                        {p.field_value == null ? "∅" : String(p.field_value)}</td>))}</tr>
                  </tbody></table>
REPLACE:
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {proof.map((p) => (
                      <div key={p.stage} style={{ minWidth: 0, maxWidth: "100%",
                        border: `1px solid ${t.panel2 || "#dfe6e9"}`, borderRadius: 6,
                        padding: "4px 9px", background: "#fff" }}>
                        <div style={{ fontSize: 8, fontWeight: 800,
                          textTransform: "uppercase",
                          color: STAGE_C[p.stage] || (t.muted || "#999") }}>{p.stage}</div>
                        <div style={{ fontFamily: "Roboto Mono, monospace", fontSize: 10.5,
                          color: t.navy || "#10193b", wordBreak: "break-word" }}>
                          {p.field_value == null ? "∅" : String(p.field_value)}</div>
                      </div>))}
                  </div>
(NOTE: if PATCH 3 was applied, the FIND has `fontSize: roomy ? 12.5 : 11` on
the table — match on the surrounding proof.map lines, keep the same
replacement, and you may add fontSize roomy?12:10.5 on the value div.)

B2 · table-mode chain proof (the f.proof block in the caret expansion) —
same table shape with `f.proof.map`; apply the identical replacement using
f.proof instead of proof.

## Edit C — map + biz collisions (screenshots 2 and 3)
Those two scenes are the contexts PATCH 1 (map cards stop stretching) and
PATCH 2 (DefModal popup for map) exist for — apply them and the def leaves
the crowded board entirely. BIZ mode inline benefits from Edits A+B above
automatically (same InlineDef).

## Verify against your three screenshots
1 (table inline): journey cards wrap cleanly inside the right half, proof
  shows as four labeled blocks, GST values wrap instead of colliding.
2 (map): def opens as a centered popup — no third-column collision possible.
3 (biz): passport def contained; proof blocks wrap; nothing exits the panel.
