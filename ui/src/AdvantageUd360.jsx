// AddVantage UD 360: what the envelope looks like and what one key is.
//
// Two exports, both fed by /advantage-ud (sql/75, sql/76):
//   UdOverview     the strip above the Non-SEI list: size of the envelope,
//                  how it splits, the families, and the SHAPE of a payload.
//   udDetailRows   extra [label, node] rows for the Datapoint 360 detail
//                  pane when the selected field is a UD key.
//
// NOTHING HERE SHOWS A VALUE. The example payload is built from the
// registry's shapes (lengths, classes, masks) and the code dictionary, so
// the reader sees how the JSON is built without an account, a household
// or a person ever leaving the database.

import React from "react";
import { presenceReading, typeReading, parseDistribution, pct, SOURCE_LABEL, SEVERITY, schemaReading, sourcesLine } from "./advantageUd.js";

const mono = { fontFamily: "Roboto Mono, monospace" };

const Tile = ({ t, n, label, sub }) => (
  <div style={{ flex: "1 1 120px", minWidth: 120, padding: "10px 14px", background: "#fff",
    border: `1px solid ${t.border || "#dfe6e9"}`, borderRadius: 3 }}>
    <div style={{ fontSize: 20, fontWeight: 800, color: t.navy || "#10193b", lineHeight: 1.1 }}>{n ?? "—"}</div>
    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px",
      color: t.muted || "#7b8894", marginTop: 3 }}>{label}</div>
    {sub && <div style={{ fontSize: 10.5, color: t.sub || "#4a5a68", marginTop: 2 }}>{sub}</div>}
  </div>);

const Bar = ({ t, rows, total, color }) => (
  <div>
    {rows.map(([k, v]) => (
      <div key={k} style={{ display: "grid", gridTemplateColumns: "150px 1fr 56px", gap: 8,
        alignItems: "center", fontSize: 11, padding: "2px 0" }}>
        <span style={{ ...mono, color: t.text || "#333", overflow: "hidden", textOverflow: "ellipsis" }}>{k}</span>
        <div style={{ height: 8, background: "#eef2f5", borderRadius: 4 }}>
          <div style={{ width: `${total ? Math.max(2, (100 * v) / total) : 0}%`, height: 8,
            background: color || t.accent || "#0f4775", borderRadius: 4 }} />
        </div>
        <span style={{ textAlign: "right", color: t.muted || "#7b8894" }}>{v}</span>
      </div>))}
  </div>);

/* The JSON drawn as the profiler saw it, with shapes for values. */
export function ClobExample({ t, example }) {
  const keys = Object.keys(example || {});
  if (!keys.length) return null;
  return (
    <pre style={{ ...mono, fontSize: 11, lineHeight: 1.55, margin: 0, padding: "10px 14px",
      background: "#10193b", color: "#dfe6ee", borderRadius: 4, overflowX: "auto" }}>
      {"{\n"}
      {keys.map((k, i) => (
        <span key={k}>{"  "}<span style={{ color: "#8fd3ff" }}>"{k}"</span>: <span
          style={{ color: k.endsWith("_…") ? "#9aa7b2" : "#ffd58a" }}>"{example[k]}"</span>
          {i < keys.length - 1 ? "," : ""}{"\n"}</span>))}
      {"}"}
    </pre>);
}

export function UdOverview({ t, ov, shape, st }) {
  if (!ov) return null;
  if (!ov.loaded) {
    return (
      <div style={{ border: "1px dashed #c9d4dc", borderRadius: 3, padding: "12px 16px", marginBottom: 14,
        fontSize: 12, color: t.sub || "#4a5a68", background: "#fbfcfe" }}>
        <b style={{ color: t.navy || "#10193b" }}>AddVantage UD 360 · not loaded yet.</b> Drop the profiler
        outputs in <span style={mono}>local-data/advantage-ud/profile/</span> and run{" "}
        <span style={mono}>python -m ingestion.run advantage_ud_profile advantage_ud_dictionary</span>.
        Until then the field list below is the dictionary alone.
      </div>);
  }
  const run = ov.run || {};
  const rows = run.source_rows ?? null;
  const dom = Object.entries(ov.by_domain || {}).sort((a, b) => b[1] - a[1]);
  const cls = Object.entries(ov.by_class || {}).sort((a, b) => b[1] - a[1]);
  const buckets = Object.entries(shape?.key_count_buckets || {});
  const bTotal = buckets.reduce((s, [, v]) => s + v, 0);
  return (
    <div style={{ marginBottom: 16 }}>
      {sourcesLine(st) && <div style={{ fontSize: 10.5, color: t.sub || "#4a5a68", marginBottom: 8 }}>
        <b style={{ color: t.muted || "#7b8894", textTransform: "uppercase", letterSpacing: ".4px", fontSize: 9.5 }}>Sources · </b>{sourcesLine(st)}</div>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <Tile t={t} n={rows != null ? Number(rows).toLocaleString() : null} label="account rows"
          sub={run.parse_success_pct != null ? `${pct(run.parse_success_pct)} parse as JSON` : "in the extract"} />
        <Tile t={t} n={ov.attributes} label="UD keys"
          sub={`${ov.by_structure?.SINGLE || 0} single · ${ov.by_structure?.MULTIPART || 0} lines of ${ov.parents?.length || 0} blocks`} />
        <Tile t={t} n={ov.coded_attributes} label="coded fields" sub="values split into a dictionary" />
        <Tile t={t} n={ov.variance_attributes} label="with type variance"
          sub={ov.reclassified ? `${ov.reclassified} reclassified as identifiers` : "mixed representations"} />
        <Tile t={t} n={ov.family_count} label="schema families"
          sub={run.schema_variants != null ? `from ${Number(run.schema_variants).toLocaleString()} exact key sets` : "by blocks present"} />
        <Tile t={t} n={ov.gold_candidates} label="gold candidates" sub="none promoted yet" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 14 }}>
        <div style={{ background: "#fff", border: `1px solid ${t.border || "#dfe6e9"}`, borderRadius: 3, padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".4px",
            color: t.muted || "#7b8894", marginBottom: 6 }}>How the CLOB looks · shapes, never values</div>
          <ClobExample t={t} example={shape?.example} />
          {buckets.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, color: t.muted || "#7b8894", marginBottom: 3 }}>keys per payload · account rows</div>
              <Bar t={t} rows={buckets} total={bTotal} color="#6d3ac0" />
            </div>)}
        </div>
        <div style={{ background: "#fff", border: `1px solid ${t.border || "#dfe6e9"}`, borderRadius: 3, padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".4px",
            color: t.muted || "#7b8894", marginBottom: 6 }}>Keys by domain · hypothesis until the workbook confirms</div>
          <Bar t={t} rows={dom} total={ov.attributes} />
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".4px",
            color: t.muted || "#7b8894", margin: "10px 0 6px" }}>Keys by value class</div>
          <Bar t={t} rows={cls} total={ov.attributes} color="#1baf7a" />
        </div>
        <div style={{ background: "#fff", border: `1px solid ${t.border || "#dfe6e9"}`, borderRadius: 3, padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".4px",
            color: t.muted || "#7b8894", marginBottom: 6 }}>Schema families · which blocks an account carries</div>
          {(ov.families || []).slice(0, 8).map((f) => (
            <div key={f.family_id} style={{ display: "grid", gridTemplateColumns: "1fr 70px", gap: 8,
              fontSize: 11, padding: "3px 0", borderTop: "1px solid #f0f3f6" }}>
              <span style={{ color: t.text || "#333" }}>{f.family_label}
                <span style={{ color: t.muted || "#7b8894" }}> · {f.variant_count} key sets</span></span>
              <span style={{ textAlign: "right", color: t.muted || "#7b8894" }}>
                {Number(f.record_count).toLocaleString()}</span>
            </div>))}
          {ov.conflicts && Object.keys(ov.conflicts).length > 0 && (
            <div style={{ marginTop: 10, fontSize: 10.5, color: t.sub || "#4a5a68" }}>
              Code conflicts: {Object.entries(ov.conflicts).map(([k, v]) => `${v} ${k.toLowerCase().replace(/_/g, " ")}`).join(" · ")}
            </div>)}
        </div>
      </div>
    </div>);
}

const pill = (bg, c) => ({ fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 999,
  background: bg, color: c, marginRight: 5, whiteSpace: "nowrap" });

/* Rows for the detail pane. Returns [] until the registry is loaded, so
   the pane is unchanged on a warehouse without sql/76. */
export function udDetailRows(t, a) {
  const r = a?.registry;
  if (!a || !a.loaded || !r) return [];
  const dist = parseDistribution(r.type_distribution);
  const rows = [];
  rows.push(["Key structure", <span key="ks">
    {r.key_structure === "MULTIPART"
      ? <>line <b>{r.sequence_number}</b> of block <span style={mono}>{r.parent_attribute}</span>
        {a.parent?.structure_role ? ` · ${a.parent.structure_role.toLowerCase().replace(/_/g, " ")}` : ""}</>
      : a.parent ? <>block of {a.siblings?.length || a.parent.max_children} lines · {a.parent.structure_role?.toLowerCase().replace(/_/g, " ")}</>
      : "single value"}
  </span>]);
  rows.push(["Presence", <span key="pr">
    <b>{Number(r.occurrence_count || 0).toLocaleString()}</b> account rows · {pct(r.record_presence_pct)} · {presenceReading(r)}
    {Number(r.null_or_blank_count) > 0 && <span style={{ color: t.muted || "#7b8894" }}> · {r.null_or_blank_count} blank</span>}
  </span>]);
  rows.push(["Values", <span key="va">
    {Number(r.distinct_value_count || 0).toLocaleString()} distinct · length {r.min_value_length ?? "?"}–{r.max_value_length ?? "?"}
    {Number(r.max_value_length) > 32 && <span style={{ color: "#c1113a" }}> · over the 32-char line, not a type-3 text field</span>}
  </span>]);
  rows.push(["Type", <span key="ty">
    {typeReading(r)}
    {dist.length > 1 && <div style={{ marginTop: 4 }}>
      {dist.map(([k, v]) => <span key={k} style={pill("#eef2f5", "#4a5a68")}>{k} {v}</span>)}</div>}
  </span>]);
  rows.push(["Shape", <span key="sh" style={{ ...mono, color: t.navy || "#10193b" }}>"{r.attribute_name}": "{a.shape}"</span>]);
  rows.push(["Domain · Silver", <span key="dm">
    <span style={pill("#efe6fb", "#6d3ac0")}>{r.domain || "UNKNOWN"}</span>
    {r.silver_entity && <span style={pill("#e0f5fd", "#0b5e83")}>{r.silver_entity}</span>}
    {r.gold_candidate === "Y" && <span style={pill("#fff3d6", "#b26b00")}>GOLD CANDIDATE</span>}
    <span style={{ color: t.muted || "#7b8894", fontSize: 11 }}> {SOURCE_LABEL[r.class_source] || r.class_source}</span>
  </span>]);
  if (a.siblings?.length) {
    rows.push([a.parent?.line_names ? "Block lines" : "Block lines · meaning unknown", <table key="sb" style={{ borderCollapse: "collapse", fontSize: 11 }}><tbody>
      {a.siblings.map((s) => (
        <tr key={s.attribute_name} style={{ background: s.attribute_name === r.attribute_name ? "#f2f6fa" : "transparent" }}>
          <td style={{ ...mono, padding: "1px 12px 1px 0", whiteSpace: "nowrap" }}>{s.attribute_name}</td>
          <td style={{ padding: "1px 12px 1px 0", color: t.muted || "#7b8894" }}>{s.value_class}</td>
          <td style={{ ...mono, padding: "1px 12px 1px 0", color: t.sub || "#4a5a68" }}>{s.shape}</td>
          <td style={{ padding: "1px 0", color: t.muted || "#7b8894", whiteSpace: "nowrap" }}>{Number(s.occurrence_count || 0).toLocaleString()} rows</td>
        </tr>))}
      {a.parent?.missing_sequences && <tr><td colSpan={4} style={{ paddingTop: 4, color: "#b26b00" }}>
        lines never seen: {a.parent.missing_sequences} · a blanked line, not a schema change</td></tr>}
    </tbody></table>]);
  }
  if (a.conflicts?.length) {
    rows.push(["Code conflicts", <span key="cf">
      {a.conflicts.map((c) => <div key={c.code_value} style={{ fontSize: 11 }}>
        <span style={mono}>{c.code_value}</span> · {c.description_count} descriptions ·{" "}
        <span style={pill(c.conflict_class === "TRUE_CONFLICT" ? "#f3d2d7" : "#eef2f5",
          c.conflict_class === "TRUE_CONFLICT" ? "#c1113a" : "#4a5a68")}>{c.conflict_class.replace(/_/g, " ")}</span>
      </div>)}
    </span>]);
  }
  return rows;
}

/* ---- type_variance.csv, read as its own analysis ---------------------- */

const Sec = ({ t, title, children, style }) => (
  <div style={{ background: "#fff", border: `1px solid ${t.border || "#dfe6e9"}`, borderRadius: 3, padding: "10px 14px", ...style }}>
    <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".4px",
      color: t.muted || "#7b8894", marginBottom: 6 }}>{title}</div>
    {children}
  </div>);

export function TypeVarianceView({ t, tv }) {
  if (!tv || !tv.loaded) return <div style={{ fontSize: 12, color: t.muted || "#7b8894" }}>type_variance.csv not loaded yet.</div>;
  const total = tv.attributes || 1;
  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <Tile t={t} n={tv.attributes} label="keys with type variance" sub="values not all one type" />
        <Tile t={t} n={tv.high} label="high" sub="10% or more of values are the minority type" />
        <Tile t={t} n={tv.reclassified} label="profiler's, not the data's" sub="10-digit ids read as timestamps" />
        <Tile t={t} n={tv.free_text} label="in narrative blocks" sub="'=' inside prose, no split" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 14 }}>
        <Sec t={t} title="By variance class · what it is, what the load does">
          {tv.classes.map((c) => (
            <div key={c.variance_class} style={{ padding: "5px 0", borderTop: "1px solid #f0f3f6", fontSize: 11 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 40px", gap: 8 }}>
                <span style={{ ...mono, fontWeight: 700 }}>{c.variance_class.toLowerCase().replace(/_/g, " ")}</span>
                <span style={{ textAlign: "right", color: t.muted || "#7b8894" }}>{c.attributes}</span>
              </div>
              <div style={{ height: 6, background: "#eef2f5", borderRadius: 3, margin: "3px 0" }}>
                <div style={{ width: `${Math.max(2, (100 * c.attributes) / total)}%`, height: 6, background: "#eb6834", borderRadius: 3 }} />
              </div>
              <div style={{ color: t.sub || "#4a5a68" }}>{c.what}</div>
              <div style={{ color: t.accent || "#0f4775", fontWeight: 600 }}>→ {c.do}</div>
            </div>))}
        </Sec>
        <Sec t={t} title="Every key, worst first">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead><tr style={{ color: t.muted || "#7b8894", textAlign: "left" }}>
              <th style={{ padding: "2px 6px" }}>Key</th><th style={{ padding: "2px 6px" }}>UD name</th><th style={{ padding: "2px 6px" }}>Dominant</th>
              <th style={{ padding: "2px 6px" }}>Minority types</th><th style={{ padding: "2px 6px" }}>Class</th><th style={{ padding: "2px 6px" }}>Do</th></tr></thead>
            <tbody>
              {[...tv.rows].sort((a, b) => (b.minority_pct || 0) - (a.minority_pct || 0)).map((r) => {
                const [bg, c] = SEVERITY[r.severity] || SEVERITY.low;
                return (
                  <tr key={r.attribute_name} style={{ borderTop: "1px solid #f0f3f6" }}>
                    <td style={{ ...mono, padding: "3px 6px", whiteSpace: "nowrap" }}>{r.attribute_name}</td>
                    <td style={{ padding: "3px 6px", fontWeight: 600, color: t.navy || "#10193b" }}>
                      {r.term || <span style={{ fontWeight: 400, color: t.muted || "#7b8894" }}>{r.parent_attribute ? `line of ${r.parent_attribute}` : "no dictionary entry"}</span>}</td>
                    <td style={{ padding: "3px 6px", whiteSpace: "nowrap" }}>{r.dominant_type} <span style={{ color: t.muted || "#7b8894" }}>{pct(r.dominant_type_pct)}</span>
                      {r.type_reclassified === "Y" && <div style={{ fontSize: 10, color: "#b26b00" }}>read as {r.value_class}</div>}</td>
                    <td style={{ padding: "3px 6px" }}>
                      <span style={pill(bg, c)}>{r.minority_pct != null ? `${r.minority_pct}%` : "?"}</span>
                      {(r.minority || []).map(([k, v]) => <span key={k} style={pill("#eef2f5", "#4a5a68")}>{k} {v}</span>)}</td>
                    <td style={{ padding: "3px 6px", fontSize: 10, color: t.sub || "#4a5a68" }}>{r.variance_class.toLowerCase().replace(/_/g, " ")}</td>
                    <td style={{ padding: "3px 6px", fontSize: 10, color: t.accent || "#0f4775" }}>{r.do}</td>
                  </tr>);
              })}
            </tbody>
          </table>
        </Sec>
      </div>
    </div>);
}

/* ---- schema_variants.csv, read as its own analysis -------------------- */
export function SchemaVarianceView({ t, sv }) {
  if (!sv || !sv.loaded) return <div style={{ fontSize: 12, color: t.muted || "#7b8894" }}>schema_variants.csv not loaded yet.</div>;
  const rowsTotal = sv.rows || 1;
  const tiers = sv.tiers || {};
  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <Tile t={t} n={Number(sv.key_sets).toLocaleString()} label="exact key sets" sub={`for ${Number(sv.rows).toLocaleString()} rows`} />
        <Tile t={t} n={sv.optional_count} label="optional keys" sub="on 1% to 99% of rows · each can double the sets" />
        <Tile t={t} n={sv.families} label="families" sub="by blocks present" />
        <Tile t={t} n={Number(sv.singletons).toLocaleString()} label="one-row key sets" sub="the long tail" />
        <Tile t={t} n={sv.typed_drift_sets} label="typed drift" sub={`same keys, other types · ${Number(sv.typed_drift_rows || 0).toLocaleString()} rows`} />
      </div>
      <div style={{ fontSize: 12, color: t.text || "#333", marginBottom: 10, lineHeight: 1.5 }}>{schemaReading(sv)}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.4fr", gap: 14 }}>
        <Sec t={t} title="Keys per payload · key sets and rows">
          {(sv.sizes || []).map((b) => (
            <div key={b.bucket} style={{ display: "grid", gridTemplateColumns: "48px 1fr 110px", gap: 8, alignItems: "center", fontSize: 11, padding: "2px 0" }}>
              <span style={mono}>{b.bucket}</span>
              <div style={{ height: 8, background: "#eef2f5", borderRadius: 4 }}>
                <div style={{ width: `${Math.max(2, (100 * b.rows) / rowsTotal)}%`, height: 8, background: "#6d3ac0", borderRadius: 4 }} /></div>
              <span style={{ textAlign: "right", color: t.muted || "#7b8894" }}>{b.key_sets} sets · {Number(b.rows).toLocaleString()}</span>
            </div>))}
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".4px", color: t.muted || "#7b8894", margin: "10px 0 4px" }}>Key presence tiers</div>
          {[["core", "≥99% of rows"], ["common", "50–99%"], ["occasional", "5–50%"], ["rare", "<5%"]].map(([k, d]) => (
            <div key={k} style={{ display: "grid", gridTemplateColumns: "80px 1fr 36px", gap: 8, fontSize: 11, padding: "1px 0" }}>
              <span><b>{k}</b> <span style={{ color: t.muted || "#7b8894" }}>{d}</span></span>
              <div style={{ height: 6, background: "#eef2f5", borderRadius: 3, marginTop: 5 }}>
                <div style={{ width: `${Math.max(1, (100 * (tiers[k] || 0)) / Math.max(1, Object.values(tiers).reduce((a, b) => a + b, 0)))}%`, height: 6, background: "#1baf7a", borderRadius: 3 }} /></div>
              <span style={{ textAlign: "right", color: t.muted || "#7b8894" }}>{tiers[k] || 0}</span>
            </div>))}
          {sv.core_keys?.length > 0 && <div style={{ ...mono, fontSize: 10, color: t.sub || "#4a5a68", marginTop: 4 }}>core: {sv.core_keys.join(", ")}</div>}
        </Sec>
        <Sec t={t} title="The optional keys · what multiplies the sets">
          {(sv.optional_keys || []).slice(0, 30).map((k) => (
            <div key={k.attribute_name} style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 50px", gap: 8, alignItems: "center", fontSize: 11, padding: "1px 0" }}>
              <span style={mono}>{k.attribute_name}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: t.text || "#333" }}>{k.term || ""}</span>
              <div style={{ height: 6, background: "#eef2f5", borderRadius: 3 }}>
                <div style={{ width: `${Math.max(1, k.record_presence_pct || 0)}%`, height: 6, background: "#0f4775", borderRadius: 3 }} /></div>
              <span style={{ textAlign: "right", color: t.muted || "#7b8894" }}>{pct(k.record_presence_pct)}</span>
            </div>))}
          {(sv.optional_keys || []).length > 30 && <div style={{ fontSize: 10, color: t.muted || "#7b8894" }}>… {sv.optional_keys.length - 30} more</div>}
        </Sec>
        <Sec t={t} title="The most common key sets">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead><tr style={{ color: t.muted || "#7b8894", textAlign: "left" }}>
              <th style={{ padding: "2px 6px" }}>Rows</th><th style={{ padding: "2px 6px" }}>Keys</th><th style={{ padding: "2px 6px" }}>Blocks</th><th style={{ padding: "2px 6px" }}>Family</th><th style={{ padding: "2px 6px" }}>Typed</th></tr></thead>
            <tbody>
              {(sv.top || []).map((s) => (
                <tr key={s.schema_signature} style={{ borderTop: "1px solid #f0f3f6" }}>
                  <td style={{ padding: "3px 6px", whiteSpace: "nowrap" }}>{Number(s.record_count).toLocaleString()} <span style={{ color: t.muted || "#7b8894" }}>{pct(s.record_pct)}</span></td>
                  <td style={{ padding: "3px 6px" }}>{s.attribute_count}</td>
                  <td style={{ ...mono, padding: "3px 6px", fontSize: 10 }}>{s.blocks.length ? s.blocks.join(" ") : "—"}</td>
                  <td style={{ padding: "3px 6px", fontSize: 10 }}>{s.family_label}</td>
                  <td style={{ padding: "3px 6px" }}>{s.typed_variant_count > 1 ? <span style={pill("#fae5d3", "#e67e22")}>{s.typed_variant_count} typed</span> : <span style={{ color: t.muted || "#7b8894" }}>1</span>}</td>
                </tr>))}
            </tbody>
          </table>
        </Sec>
      </div>
    </div>);
}

/* The strip with its three readings. */
export function UdStrip({ t, ov, shape, tv, sv, st }) {
  const [tab, setTab] = React.useState("overview");
  if (!ov) return null;
  if (!ov.loaded) return <UdOverview t={t} ov={ov} shape={shape} />;
  const tabs = [["overview", "Overview"], ["type", `Type variance · ${tv?.attributes ?? "…"}`], ["schema", `Schema variants · ${sv?.key_sets != null ? Number(sv.key_sets).toLocaleString() : "…"}`]];
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {tabs.map(([k, l]) => (
          <span key={k} onClick={() => setTab(k)} role="button" tabIndex={0}
            style={{ fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 3, cursor: "pointer",
              border: `1px solid ${tab === k ? (t.accent || "#0f4775") : (t.border || "#c9d4dc")}`,
              background: tab === k ? (t.accent || "#0f4775") : "#fff", color: tab === k ? "#fff" : (t.accent || "#0f4775") }}>{l}</span>))}
      </div>
      {tab === "overview" && <UdOverview t={t} ov={ov} shape={shape} st={st} />}
      {tab === "type" && <TypeVarianceView t={t} tv={tv} />}
      {tab === "schema" && <SchemaVarianceView t={t} sv={sv} />}
    </div>);
}
