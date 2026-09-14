# InlineDef — roomy text spacing when shown in the DefModal popup

One new prop (`roomy`), seven find/replace edits inside InlineDef, then the
two DefModal call sites pass roomy. Inline (table-mode) rendering keeps its
compact sizing — only the popup breathes.

## Edit 1 — signature
FIND:    onJump, compact = false }) {
REPLACE: onJump, compact = false, roomy = false }) {

## Edit 2 — the kv grid (labels + values get room)
FIND:
  const kv = { display: "grid", gridTemplateColumns: "130px 1fr", gap: 8, padding: "6px 14px",
    fontSize: 11, borderTop: "1px solid #f0f3f6" };
  const kk = { fontSize: 8.5, fontWeight: 700, textTransform: "uppercase",
    color: t.muted || "#999", paddingTop: 2 };
REPLACE:
  const kv = { display: "grid", gridTemplateColumns: roomy ? "160px 1fr" : "130px 1fr",
    gap: roomy ? 12 : 8, padding: roomy ? "10px 20px" : "6px 14px",
    fontSize: roomy ? 12.5 : 11, lineHeight: roomy ? 1.7 : 1.5,
    borderTop: "1px solid #f0f3f6" };
  const kk = { fontSize: roomy ? 9.5 : 8.5, fontWeight: 700, textTransform: "uppercase",
    color: t.muted || "#999", paddingTop: 2 };

## Edit 3 — master header bar
FIND:    <div style={{ fontSize: 11, fontWeight: 800, color: "#fff", padding: "7px 14px",
REPLACE: <div style={{ fontSize: roomy ? 12.5 : 11, fontWeight: 800, color: "#fff",
           padding: roomy ? "10px 20px" : "7px 14px",

## Edit 4 — the business term title
FIND:    <div style={{ fontSize: 14, fontWeight: 700, color: t.navy || "#10193b",
           padding: "10px 14px 4px" }}>
REPLACE: <div style={{ fontSize: roomy ? 18 : 14, fontWeight: 700, color: t.navy || "#10193b",
           padding: roomy ? "16px 20px 6px" : "10px 14px 4px" }}>

## Edit 5 — description line-height (the big readability win)
FIND:    <b style={{ fontWeight: 400, whiteSpace: "pre-line", lineHeight: 1.55 }}>
REPLACE: <b style={{ fontWeight: 400, whiteSpace: "pre-line",
           lineHeight: roomy ? 1.8 : 1.55 }}>

## Edit 6 — the lineage half padding
FIND:    <div style={{ padding: "10px 14px" }}>
           {row ? (
REPLACE: <div style={{ padding: roomy ? "16px 22px" : "10px 14px" }}>
           {row ? (

## Edit 7 — proof table sizing (both occurrences in InlineDef)
FIND:    <table style={{ borderCollapse: "collapse", fontSize: 11 }}><tbody>
REPLACE: <table style={{ borderCollapse: "collapse", fontSize: roomy ? 12.5 : 11 }}><tbody>

## Call sites — pass roomy in the popups only
In the MAP mode DefModal (from DEF_MODAL_PATCH step 2) and the RAIL DefModal
(step 3), add `roomy` to the InlineDef:
    <InlineDef t={t} ... onDataSource={onDataSource} roomy />
Table-mode inline InlineDef: unchanged, no roomy.

## Verify
Open a definition from the map or the rail: title reads at 18px, description
at 12.5/1.8 with clear paragraph air, kv labels no longer touching values,
proof values comfortably readable. Open one inline in table mode: identical
to before.
