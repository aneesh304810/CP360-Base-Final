# LegacyLineage.jsx — definition popup for cramped contexts · DefModal

Inline-under-the-row stays for TABLE mode (it reads well there).
The RAIL (Dependency View metadata rail) and the MAP board get a centered
modal instead — big, backdropped, scrollable, Esc/click-outside to close.

## Step 1 — add this component ABOVE InlineDef (no new imports needed)

function DefModal({ t, title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(16,25,59,.45)", display: "grid",
        placeItems: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "min(1140px, 94vw)", maxHeight: "86vh",
          display: "flex", flexDirection: "column", background: "#fff",
          borderRadius: 12, overflow: "hidden",
          boxShadow: "0 24px 60px rgba(0,0,0,.38)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10,
          padding: "9px 16px", borderBottom: `1px solid ${t.panel2 || "#dfe6e9"}`,
          background: "#fafcfc", flexShrink: 0 }}>
          <b style={{ fontSize: 12.5, color: t.navy || "#10193b" }}>
            {title || "Business definition"}</b>
          <span style={{ marginLeft: "auto", fontSize: 10.5,
            color: t.muted || "#999" }}>Esc or click outside to close</span>
          <span onClick={onClose} style={{ cursor: "pointer", fontSize: 15,
            color: t.sub || "#666", padding: "0 4px" }}>{"\u2715"}</span>
        </div>
        <div style={{ overflowY: "auto", padding: "10px 14px" }}>{children}</div>
      </div>
    </div>);
}

## Step 2 — MAP mode: the panel becomes the modal
FIND (as shipped; if you applied the spacing patch Edit 3, the FIND is that
edited block instead — the unique anchor either way is `{dOpen && (`
directly after the map row's closing </div>):
                {dOpen && (
                  <div style={{ marginBottom: 11 }}>
                    <InlineDef t={t} system={system} dataSource={ds} code={openDef.code}
                      ctx={openDef.ctx} row={openDef.row} tableName={openDef.table}
                      onDataSource={onDataSource} />
                  </div>)}
REPLACE:
                {dOpen && (
                  <DefModal t={t} onClose={() => click(r, k)}
                    title={`${r._tbl}.${r.dwh_target_column} \u00b7 ${r._master}`}>
                    <InlineDef t={t} system={system} dataSource={ds} code={openDef.code}
                      ctx={openDef.ctx} row={openDef.row} tableName={openDef.table}
                      onDataSource={onDataSource} />
                  </DefModal>)}
(click(r, k) toggles the same key -> closes. The dictionary card's hint text
can change from "definition open below" to "definition open".)

## Step 3 — RAIL (Dependency View): wrap the rail's InlineDef the same way
In the metadata rail where railDef renders (this section is below the part
you shared, so match by pattern): wherever you have
    {railDef && <InlineDef ... compact />}
make it
    {railDef && (
      <DefModal t={t} onClose={() => setRailDef(null)}
        title={railDef.code || "Business definition"}>
        <InlineDef ... />        {/* drop compact — the modal has room */}
      </DefModal>)}
Dropping `compact` matters: in the modal the definition gets the full
two-column layout (dictionary + journey + proof) instead of the squeezed
single column that was unreadable in the rail.

## Step 4 (optional) — TABLE mode stays inline. If you want one behavior
everywhere, wrap its InlineDef the same way with
onClose={() => setOpenDef(null)} — but the under-the-row inline reads well
in table mode and keeps list context; recommended to leave it.

## Verify
- Map: click a dictionary card -> centered popup with the FULL two-column
  definition, journey with boundary badges, proof; Esc closes; board behind
  is dimmed but intact, scroll position preserved.
- Dependency rail: click a column chip -> same popup, no more bottom-of-rail
  squeeze; the chip cloud stays where it was.
