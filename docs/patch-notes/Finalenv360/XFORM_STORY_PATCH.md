# Popup — "what is happening" transformation graphic above the description

A horizontal three-segment story band between the journey/proof and the
dictionary: one segment per hop, icon + plain-language action + the actual
expression. Amber segment = something changes on that hop; grey = carried
as-is. Renders only in the roomy popup. Two steps.

## Step 1 — add this component above InlineDef (uses your existing isNA + canon)

function XformStory({ t, row }) {
  const friendly = (xf) => {
    if (!xf || isNA(xf)) return null;
    const u = String(xf).toUpperCase();
    if (u.includes("RTRIM") || u.includes("TRIM")) return "extra spaces removed";
    if (u.includes("TO_DATE")) return "text turned into a real date";
    if (u.includes("TO_NUMBER")) return "text turned into a number";
    if (u.includes("DECODE") || u.includes("CASE")) return "code translated to a value";
    if (u.includes("SUBSTR")) return "cut to size";
    if (u.includes("UPPER") || u.includes("LOWER")) return "letter case normalized";
    return String(xf).split("(")[0].toLowerCase() + " applied";
  };
  const physicalized = row.src_source_column && row.stg1_source_column &&
    row.src_source_column !== row.stg1_source_column &&
    canon(row.src_source_column) === canon(row.stg1_source_column);
  const renamed = row.stg1_source_column && row.stg2_source_column &&
    canon(row.stg1_source_column) !== canon(row.stg2_source_column);
  const segs = [
    { icon: "\u{1F4E5}", head: friendly(row.src_to_stg1_transform) || "arrives as delivered",
      ex: !isNA(row.src_to_stg1_transform) && row.src_to_stg1_transform
        ? row.src_to_stg1_transform
        : `${row.src_source_column || "\u2014"} \u2192 ${row.stg1_source_column || "\u2014"}`,
      note: physicalized ? "same field \u00b7 database-legal name" : "no change to the value",
      hot: !!friendly(row.src_to_stg1_transform) },
    { icon: "\u{1F9FC}", head: friendly(row.stg1_to_stg2_transform) || "carried through",
      ex: !isNA(row.stg1_to_stg2_transform) && row.stg1_to_stg2_transform
        ? row.stg1_to_stg2_transform : "direct move",
      note: renamed ? `takes its business name: ${row.stg2_source_column}` : "value unchanged",
      hot: !!friendly(row.stg1_to_stg2_transform) },
    { icon: "\u{1F3EA}", head: friendly(row.stg2_to_dwh_transform) || "stored in the warehouse",
      ex: !isNA(row.stg2_to_dwh_transform) && row.stg2_to_dwh_transform
        ? row.stg2_to_dwh_transform : "direct move",
      note: `what you query in ${row.dwh_target_table}`,
      hot: !!friendly(row.stg2_to_dwh_transform) },
  ];
  return (
    <div style={{ borderTop: `1px solid ${t.panel2 || "#dfe6e9"}`,
      padding: "12px 20px 14px" }}>
      <div style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase",
        letterSpacing: 0.4, color: t.sub || "#666", marginBottom: 9 }}>
        What happens to this column \u2014 in plain terms</div>
      <div style={{ display: "flex", alignItems: "stretch", gap: 0 }}>
        {segs.map((sg, i) => (
          <React.Fragment key={i}>
            {i > 0 && <div style={{ alignSelf: "center", padding: "0 10px",
              color: t.muted || "#999", fontSize: 15, fontWeight: 700 }}>
              {"\u2192"}</div>}
            <div style={{ flex: 1, borderRadius: 9, padding: "10px 13px",
              textAlign: "center",
              background: sg.hot ? (t.warningBg || "#fae5d3") : "#f4f7f9",
              border: `1.5px solid ${sg.hot ? "#f0cba8" : (t.panel2 || "#dfe6e9")}` }}>
              <div style={{ fontSize: 19 }}>{sg.icon}</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 3,
                color: sg.hot ? "#8a5a1e" : (t.navy || "#10193b") }}>{sg.head}</div>
              <div style={{ fontFamily: "Roboto Mono, monospace", fontSize: 10,
                marginTop: 4, color: t.sub || "#666",
                overflow: "hidden", textOverflow: "ellipsis",
                whiteSpace: "nowrap" }} title={sg.ex}>{sg.ex}</div>
              <div style={{ fontSize: 10.5, color: t.sub || "#666",
                marginTop: 3 }}>{sg.note}</div>
            </div>
          </React.Fragment>))}
      </div>
    </div>);
}

## Step 2 — insert it above the description (requires lineage-first patch)
FIND (the dictionary half opener from LINEAGE_FIRST_PATCH Edit B, plus the
next line):
        borderTop: roomy ? `1px solid ${t.panel2 || "#dfe6e9"}` : "none" }}>
        {!def ? (
REPLACE:
        borderTop: roomy ? `1px solid ${t.panel2 || "#dfe6e9"}` : "none" }}>
        {roomy && row && <XformStory t={t} row={row} />}
        {!def ? (

## Result — popup reading order, top to bottom
  1. Lineage journey + proof (where it flows, what we saw)
  2. WHAT IS HAPPENING band (three icons, plain words, real expressions)
  3. Full dictionary description (what it means)
Table-mode inline: untouched (roomy is false there).
