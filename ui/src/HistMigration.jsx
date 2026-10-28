// Data Analysis · Historical migration: the four HIST_* sheets of the SEI
// crosswalk workbook, read back. The lanes into SEI, the artifacts the
// evidence rests on, the evidence itself (one row per populated mapping
// cell, 214,622 of them in the first workbook) with filters and the
// original row reassembled on click, the column dictionary, and every
// load with its CP360-HM rule results.
//
// `initial` lets a test hand in the payloads and skip the network.
import React, { useEffect, useState } from "react";
import { histMigrationApi as api, emptySummary, HM_RULES, LEVEL_COLOR } from "./histMigrationApi.js";
import { LineageTab, MappingTab, RulesTab, DeconTab, QcTab } from "./HistLineage.jsx";
import HistCanvas from "./HistCanvas.jsx";

const SUB = ["Overview", "Lineage picture", "Lineage", "Lineage mapping", "Rules", "Decon dictionary", "QC", "Evidence", "Dictionary", "Loads"];
const mono = { fontFamily: "ui-monospace, monospace" };

const Tile = ({ t, n, label, sub, color }) => (
  <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: t.radius.md, padding: "12px 16px", minWidth: 140 }}>
    <div style={{ fontSize: 24, fontWeight: 800, color: color || t.navy, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{typeof n === "number" ? n.toLocaleString() : n}</div>
    <div style={{ fontSize: 10, color: t.textMuted, textTransform: "uppercase", letterSpacing: ".6px", marginTop: 6 }}>{label}</div>
    {sub && <div style={{ fontSize: 11, color: t.sub, marginTop: 3 }}>{sub}</div>}
  </div>);
const H = ({ t, children, sub }) => <div style={{ margin: "18px 0 6px" }}><div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{children}</div>{sub && <div style={{ fontSize: 12, color: t.sub, maxWidth: "80ch", lineHeight: 1.55 }}>{sub}</div>}</div>;
const Chip = ({ c, children }) => <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: .4, color: c, border: `1px solid ${c}`, borderRadius: 3, padding: "0 6px", whiteSpace: "nowrap" }}>{children}</span>;
function Tbl({ t, head, rows, small }) {
  return (
    <div style={{ overflowX: "auto", margin: "6px 0 12px" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: small ? 11.5 : 12.5 }}>
        <thead><tr>{head.map((h, i) => <th key={i} style={{ textAlign: "left", fontSize: 9.5, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase", color: t.textMuted, padding: "0 12px 6px 0", borderBottom: `1px solid ${t.border}`, verticalAlign: "bottom" }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={{ padding: "6px 12px 6px 0", verticalAlign: "top", borderBottom: `1px solid ${t.bg}`, color: j === 0 ? t.text : t.sub, fontWeight: j === 0 ? 600 : 400, lineHeight: 1.5 }}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>);
}
const Bars = ({ t, rows, onPick, label }) => {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div style={{ margin: "4px 0 10px" }}>
      {label && <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase", color: t.textMuted, marginBottom: 4 }}>{label}</div>}
      {rows.map((r) => (
        <div key={r.key} role={onPick ? "button" : undefined} tabIndex={onPick ? 0 : undefined} onClick={onPick ? () => onPick(r.key) : undefined}
          style={{ display: "grid", gridTemplateColumns: "minmax(160px, 34%) 1fr 80px", gap: 8, alignItems: "center", fontSize: 12, padding: "2px 0", cursor: onPick ? "pointer" : "default" }}>
          <span style={{ color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.key}>{r.key}</span>
          <span style={{ height: 8, background: t.bg, borderRadius: 4 }}><span style={{ display: "block", height: 8, width: `${Math.round((1000 * r.n) / max) / 10}%`, background: t.accent, borderRadius: 4 }} /></span>
          <span style={{ color: t.sub, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{r.n.toLocaleString()}{r.unresolved ? <span style={{ color: "#c96a12" }} title="rows whose lane is not a registered lane"> · {r.unresolved}</span> : null}</span>
        </div>))}
      {rows.length === 0 && <div style={{ fontSize: 12, color: t.textMuted }}>nothing loaded</div>}
    </div>);
};

function Checks({ t, checks }) {
  if (!checks || !checks.length) return <div style={{ fontSize: 12, color: t.textMuted }}>No load yet, so no rule results.</div>;
  return <Tbl t={t} small head={["Rule", "Sheet", "Result", "Count", "Detail"]} rows={checks.map((c) => [c.rule, c.sheet, <Chip c={LEVEL_COLOR[c.level] || t.sub}>{c.level}</Chip>, (c.n || 0).toLocaleString(), c.detail])} />;
}

function Overview({ t, sum, lanes, artifacts, onFilter }) {
  const tot = sum.totals || {};
  return (<>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <Tile t={t} n={tot.lineage || 0} label="lineage rows" sub="historical source to SEI field" />
      <Tile t={t} n={tot.rules || 0} label="transformation rules" />
      <Tile t={t} n={tot.lanes || 0} label="lanes into SEI" />
      <Tile t={t} n={tot.artifacts || 0} label="registered artifacts" />
      <Tile t={t} n={tot.dictionary || 0} label="dictionary columns" />
      <Tile t={t} n={tot.unresolvedLanes || 0} label="unresolved lanes" sub="CP360-HM-007" color={tot.unresolvedLanes ? "#c96a12" : undefined} />
      {tot.evidence > 0 && <Tile t={t} n={tot.evidence || 0} label="evidence rows" sub="one per populated mapping cell" />}
      {tot.sourceRows > 0 && <Tile t={t} n={tot.sourceRows || 0} label="source rows" sub="workbook · sheet · row" />}
    </div>
    {!sum.loaded && <div style={{ fontSize: 12.5, color: t.sub, margin: "12px 0", maxWidth: "80ch", lineHeight: 1.6, border: `1px solid ${t.border}`, borderLeft: "3px solid #c96a12", borderRadius: 6, padding: "10px 14px", background: t.panel }}>
      <b style={{ color: t.text }}>Nothing loaded yet.</b>{" "}
      {sum.reason === "no_table" ? <>The tables are not in the warehouse: apply <span style={mono}>sql/86_hist_migration.sql</span>, then run the step.</>
        : sum.reason === "no_rows" ? <>The tables exist and are empty: run <span style={mono}>python -m ingestion.run sei_crosswalk</span> (the catalog, then the HIST_* sheets of the same CP_SEI_XLSX workbook) or <span style={mono}>python -m ingestion.run hist_migration</span>. If the log says "has no HIST_* sheet", the sheet names in the workbook do not match HIST_MIGRATION_LANES, HIST_SOURCE_REGISTER, HIST_MAPPING_EVIDENCE and HIST_HEADER_DICTIONARY; the log lists the names it found.</>
        : sum.reason && sum.reason.startsWith("error") ? <>The warehouse answered with an error: <span style={mono}>{sum.reason.slice(7)}</span>.</>
        : <>The API did not answer: restart it so the new route is mounted, then reload. The four HIST_* sheets ride the SEI crosswalk workbook named by CP_SEI_XLSX; run <span style={mono}>python -m ingestion.run sei_crosswalk</span> after applying sql/86.</>}
    </div>}
    <H t={t} sub="The historical migration lanes into SEI: the legacy source, what the lane is for, the evidence it rests on, and how it sits against the operational STAR to IMDS lineage.">Lanes</H>
    <Tbl t={t} head={["Lane", "Source system", "Target", "Purpose", "Primary evidence", "Reference artifacts", "Domain", "Relationship to operational lineage", "Status"]}
      rows={(lanes || []).map((l) => [<span style={mono}>{l.historical_lane_id}</span>, l.historical_source_system, l.target_system, l.migration_purpose, l.primary_mapping_evidence, l.reference_artifacts, l.data_domain, l.relationship_to_operational_lineage, l.status])} />
    <H t={t} sub="The mapping workbooks, dictionaries and specifications the evidence comes from. A reference artifact is read for interpretation; it is not an operational feed (CP360-HM-008).">Source register</H>
    <Tbl t={t} head={["Artifact", "Type", "Class", "Role", "Supported lanes", "CP 360 treatment", "Notes"]}
      rows={(artifacts || []).map((a) => [<span style={mono}>{a.source_artifact}</span>, a.artifact_type, <Chip c={a.artifact_class === "REFERENCE" ? "#7c3aed" : a.artifact_class === "MAPPING" ? "#0f4775" : t.sub}>{a.artifact_class || "—"}</Chip>, a.historical_migration_role, a.supported_lanes, a.cp_360_treatment, a.notes])} />
    <H t={t} sub="Where the evidence sits. Click a bar to open the evidence filtered to it.">Evidence by lane, domain, source system and category</H>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
      <Bars t={t} label="by lane" rows={sum.byLane || []} onPick={(k) => onFilter({ lane: k })} />
      <Bars t={t} label="by domain" rows={sum.byDomain || []} onPick={(k) => onFilter({ domain: k })} />
      <Bars t={t} label="by source system" rows={sum.bySourceSystem || []} onPick={(k) => onFilter({ system: k })} />
      <Bars t={t} label="by evidence category" rows={sum.byCategory || []} onPick={(k) => onFilter({ category: k })} />
    </div>
    <H t={t} sub="The analyst workbooks and sheets the evidence was lifted from, with how many source rows each contributed.">By source workbook and sheet</H>
    <Tbl t={t} small head={["Workbook", "Sheet", "Source rows", "Evidence cells"]} rows={(sum.bySheet || []).map((s) => [<span role="button" tabIndex={0} style={{ ...mono, color: t.accent, cursor: "pointer" }} onClick={() => onFilter({ workbook: s.workbook, sheet: s.sheet })}>{s.workbook}</span>, s.sheet, (s.rows || 0).toLocaleString(), (s.n || 0).toLocaleString()])} />
    <H t={t} sub="The latest load and what the loader found against the sheet specification's rules.">Latest load · rule checks</H>
    {sum.latest && <div style={{ fontSize: 12, color: t.sub, marginBottom: 6 }}>Batch <span style={mono}>{sum.latest.batchId}</span> · {sum.latest.sourceFile} · {sum.latest.loadedAt} · {sum.latest.skipped} blank cells skipped</div>}
    <Checks t={t} checks={sum.latest ? sum.latest.checks : []} />
  </>);
}

function Evidence({ t, sum, filter, setFilter, initial }) {
  const [data, setData] = useState(initial || null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState(filter.q || "");
  const [open, setOpen] = useState(null);
  const [rowData, setRowData] = useState(initial && initial.row ? initial.row : null);
  useEffect(() => {
    if (initial) return undefined;
    let on = true;
    api.evidence({ ...filter, page, size: 50 }).then((d) => { if (on) setData(d); });
    return () => { on = false; };
  }, [JSON.stringify(filter), page]); // eslint-disable-line react-hooks/exhaustive-deps
  const sel = (label, key, options) => (
    <label style={{ fontSize: 11.5, color: t.sub, display: "inline-flex", gap: 4, alignItems: "center" }}>{label}
      <select value={filter[key] || ""} onChange={(e) => { setPage(1); setFilter({ ...filter, [key]: e.target.value }); }} style={{ font: "inherit", fontSize: 11.5, padding: "3px 6px", border: `1px solid ${t.border}`, borderRadius: 4, background: t.panel, color: t.text, maxWidth: 220 }}>
        <option value="">all</option>{(options || []).map((o) => <option key={o.key} value={o.key}>{o.key} ({o.n.toLocaleString()})</option>)}</select></label>);
  const openRow = async (r) => {
    const key = `${r.source_mapping_workbook}|${r.source_mapping_sheet}|${r.source_mapping_row}`;
    if (open === key) { setOpen(null); return; }
    setOpen(key);
    if (!initial) setRowData(await api.row(r.source_mapping_workbook, r.source_mapping_sheet, r.source_mapping_row));
  };
  const rows = (data && data.evidence) || [];
  const total = (data && data.total) || 0;
  const pages = Math.max(1, Math.ceil(total / 50));
  return (<>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", margin: "6px 0 10px" }}>
      {sel("lane", "lane", sum.byLane)}{sel("domain", "domain", sum.byDomain)}{sel("source system", "system", sum.bySourceSystem)}{sel("category", "category", sum.byCategory)}{sel("attribute", "attribute", sum.byAttribute)}
      <label style={{ fontSize: 11.5, color: t.sub, display: "inline-flex", gap: 4, alignItems: "center" }}>unresolved lane
        <input type="checkbox" checked={filter.unresolved === "1"} onChange={(e) => { setPage(1); setFilter({ ...filter, unresolved: e.target.checked ? "1" : "" }); }} /></label>
      <input aria-label="search evidence" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); setFilter({ ...filter, q }); } }}
        placeholder="search attribute, column or logic, Enter" style={{ font: "inherit", fontSize: 11.5, padding: "3px 8px", border: `1px solid ${t.border}`, borderRadius: 4, background: t.panel, color: t.text, minWidth: 240 }} />
      {(filter.workbook || filter.sheet) && <Chip c={t.accent}>{filter.workbook} · {filter.sheet}</Chip>}
      {Object.keys(filter).length > 0 && <span role="button" tabIndex={0} style={{ fontSize: 11.5, color: t.accent, cursor: "pointer" }} onClick={() => { setQ(""); setPage(1); setFilter({}); }}>clear</span>}
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: 11.5, color: t.textMuted }}>{total.toLocaleString()} rows · page {page} of {pages}</span>
      <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} style={{ font: "inherit", fontSize: 11, padding: "2px 8px" }}>prev</button>
      <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} style={{ font: "inherit", fontSize: 11, padding: "2px 8px" }}>next</button>
    </div>
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11.5 }}>
        <thead><tr>{["Workbook · sheet · row", "Lane", "Domain", "Category", "Attribute", "Evidence value", "Original column", ""].map((h, i) => <th key={i} style={{ textAlign: "left", fontSize: 9.5, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase", color: t.textMuted, padding: "0 10px 6px 0", borderBottom: `1px solid ${t.border}` }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r) => { const key = `${r.source_mapping_workbook}|${r.source_mapping_sheet}|${r.source_mapping_row}`; return (
          <React.Fragment key={key + r.original_source_column_number}>
            <tr>
              <td style={{ padding: "5px 10px 5px 0", verticalAlign: "top", borderBottom: `1px solid ${t.bg}` }}><span role="button" tabIndex={0} style={{ ...mono, color: t.accent, cursor: "pointer" }} onClick={() => openRow(r)} title="open every cell of this source row">{r.source_mapping_workbook} · {r.source_mapping_sheet} · {r.source_mapping_row}</span></td>
              <td style={{ padding: "5px 10px 5px 0", verticalAlign: "top", borderBottom: `1px solid ${t.bg}`, color: t.sub }}>{r.historical_migration_lane}{r.lane_resolved === "N" && <> <Chip c="#c96a12">unresolved</Chip></>}</td>
              <td style={{ padding: "5px 10px 5px 0", verticalAlign: "top", borderBottom: `1px solid ${t.bg}`, color: t.sub }}>{r.historical_migration_domain}</td>
              <td style={{ padding: "5px 10px 5px 0", verticalAlign: "top", borderBottom: `1px solid ${t.bg}`, color: t.sub }}>{r.evidence_category}</td>
              <td style={{ padding: "5px 10px 5px 0", verticalAlign: "top", borderBottom: `1px solid ${t.bg}`, color: t.text, fontWeight: 600 }}>{r.evidence_attribute}</td>
              <td style={{ padding: "5px 10px 5px 0", verticalAlign: "top", borderBottom: `1px solid ${t.bg}`, color: t.text, whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxWidth: 520, ...mono, fontSize: 11 }}>{r.evidence_value}{r.truncated && <span style={{ color: t.textMuted }}> … ({r.evidence_length} characters; open the row)</span>}</td>
              <td style={{ padding: "5px 10px 5px 0", verticalAlign: "top", borderBottom: `1px solid ${t.bg}`, color: t.textMuted, ...mono, fontSize: 10.5 }}>{r.original_source_column} · {r.original_source_column_number}</td>
              <td style={{ padding: "5px 0", verticalAlign: "top", borderBottom: `1px solid ${t.bg}`, color: t.textMuted, fontSize: 10.5 }}>{r.evidence_length}</td>
            </tr>
            {open === key && rowData && (
              <tr><td colSpan={8} style={{ padding: "6px 0 10px" }}>
                <div role="region" aria-label={`source row ${key}`} style={{ border: `1px solid ${t.border}`, borderLeft: `3px solid ${t.accent}`, borderRadius: 6, background: t.bg, padding: "10px 14px" }}>
                  <div style={{ fontSize: 12, color: t.text, fontWeight: 700 }}>Source row {r.source_mapping_row} of {r.source_mapping_sheet} in {r.source_mapping_workbook}</div>
                  <div style={{ fontSize: 11.5, color: t.sub, marginBottom: 6 }}>{rowData.lane} · {rowData.domain} · {rowData.system}{rowData.group ? ` · ${rowData.group}` : ""} · {(rowData.cells || []).length} populated cells, in the workbook's column order</div>
                  <Tbl t={t} small head={["#", "Original column", "Attribute", "Category", "Value"]} rows={(rowData.cells || []).map((c) => [c.original_source_column_number, <span style={mono}>{c.original_source_column}</span>, c.evidence_attribute, c.evidence_category, <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", ...mono, fontSize: 11 }}>{c.evidence_value}</span>])} />
                </div>
              </td></tr>)}
          </React.Fragment>); })}</tbody>
      </table>
      {rows.length === 0 && <div style={{ fontSize: 12, color: t.textMuted, padding: "10px 0" }}>{data ? "No evidence matches." : "Loading…"}</div>}
    </div>
  </>);
}

function Dictionary({ t, columns }) {
  return (<>
    <H t={t} sub="The CP 360 column names the evidence table uses, what each means and where it comes from. Loaded as schema documentation (CP360-HM-009).">Header dictionary</H>
    <Tbl t={t} head={["Column", "Definition", "Source or derivation"]} rows={(columns || []).map((c) => [<span style={mono}>{c.meaningful_column_name}</span>, c.definition, c.source_or_derivation])} />
    <H t={t} sub="The rules the loader applies, from the sheet specification. Each load's results against them are on the Overview and Loads sub-tabs.">Ingestion rules</H>
    <Tbl t={t} small head={["Rule", "Applies to", "Category", "Detail", "Severity"]} rows={HM_RULES.map(([id, a, c, d, s]) => [id, a, c, d, <Chip c={LEVEL_COLOR[s] || t.sub}>{s}</Chip>])} />
  </>);
}

function Loads({ t, batches }) {
  return (<>
    <H t={t} sub="Every load of the sheets, newest first. A workbook whose hash matches the last load is skipped; CP_HIST_MIGRATION_FORCE=1 reloads it.">Loads</H>
    {(batches || []).length === 0 && <div style={{ fontSize: 12, color: t.textMuted }}>No loads yet.</div>}
    {(batches || []).map((b) => (
      <div key={b.batchId} style={{ border: `1px solid ${t.border}`, borderRadius: 6, background: t.panel, padding: "10px 14px", margin: "8px 0" }}>
        <div style={{ fontSize: 12.5, color: t.text }}><b style={mono}>{b.batchId}</b> · {b.sourceFile} · {b.loadedAt}</div>
        <div style={{ fontSize: 11.5, color: t.sub, margin: "2px 0 6px" }}>{(b.evidence || 0).toLocaleString()} evidence · {b.lanes} lanes · {b.artifacts} artifacts · {b.dictionary} dictionary · {b.skipped} blank cells skipped · hash <span style={mono}>{(b.sourceHash || "").slice(0, 12)}</span></div>
        <Checks t={t} checks={b.checks} />
      </div>))}
  </>);
}

// The picture: a dat file picked at the top, the canvas under it.
function PictureTab({ t, initial }) {
  const [file, setFile] = useState(initial?.file || "");
  const [lane, setLane] = useState("");
  const [files, setFiles] = useState(initial?.files || null);
  useEffect(() => { if (initial) return undefined; let on = true; api.lineageSummary().then((d) => { if (on) setFiles((d.byFile || []).map((f) => ({ key: f.file, n: f.rows }))); }); return () => { on = false; }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const sel = { font: "inherit", fontSize: 11.5, padding: "3px 6px", border: `1px solid ${t.border}`, borderRadius: 4, background: t.panel, color: t.text, maxWidth: 280 };
  return (<>
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "4px 0 10px" }}>
      <label style={{ fontSize: 11.5, color: t.sub, display: "inline-flex", gap: 4, alignItems: "center" }}>SEI dat file
        <select value={file} onChange={(e) => setFile(e.target.value)} style={sel}><option value="">all dat files</option>{(files || []).map((f) => <option key={f.key} value={f.key}>{f.key} ({f.n})</option>)}</select></label>
      <label style={{ fontSize: 11.5, color: t.sub, display: "inline-flex", gap: 4, alignItems: "center" }}>lane
        <select value={lane} onChange={(e) => setLane(e.target.value)} style={sel}><option value="">all lanes</option>{["ADDVANTAGE_SEI_HIST", "STAR_SEI_HIST", "UAF_SEI_HIST", "COMMON", "CONFIG", "UNCLASSIFIED"].map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
      <span style={{ fontSize: 11, color: t.textMuted }}>left to right: historical lane and its source columns → SEI dat file and its target fields, the rule on the wire → the IMDS table the field reaches today. Click a node to open it, a wire for its rule; Table reads the same rows.</span>
    </div>
    <HistCanvas t={t} file={file} lane={lane} initial={initial?.canvas} onPickFile={(f) => setFile(f)} />
  </>);
}

export default function HistMigration({ t, initial }) {
  const [sub, setSub] = useState(initial?.sub || "Overview");
  const [sum, setSum] = useState(initial?.summary || null);
  const [lanes, setLanes] = useState(initial?.lanes || null);
  const [artifacts, setArtifacts] = useState(initial?.artifacts || null);
  const [dict, setDict] = useState(initial?.dictionary || null);
  const [batches, setBatches] = useState(initial?.batches || null);
  const [filter, setFilter] = useState(initial?.filter || {});
  useEffect(() => {
    if (initial) return undefined;
    let on = true;
    api.summary().then((d) => { if (on) setSum(d); });
    api.lanes().then((d) => { if (on) setLanes(d.lanes); });
    api.artifacts().then((d) => { if (on) setArtifacts(d.artifacts); });
    api.dictionary().then((d) => { if (on) setDict(d.columns); });
    api.batches().then((d) => { if (on) setBatches(d.batches); });
    return () => { on = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const s = sum || emptySummary();
  return (
    <div>
      <p style={{ fontSize: 12.5, color: t.sub, margin: "0 0 10px", maxWidth: "90ch", lineHeight: 1.55 }}>
        The historical data migration into SEI as a multi-entity package: the AddVantage/PB, STAR/IM and UAF lanes, the final lineage from each historical source through its transformation rule to the SEI target field, the decon source dictionary that gives the source objects their meaning, the rule inventory, the target-field QC, the analyst mapping workbooks the evidence rests on, and every populated cell of the consolidated catalog kept exactly as written. The SEI target field is where it joins the operational SEI to STAR to IMDS lineage, by exact normalised name.
      </p>
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${t.border}`, marginBottom: 12 }}>
        {SUB.map((v) => <div key={v} role="tab" tabIndex={0} aria-selected={sub === v} onClick={() => setSub(v)}
          style={{ padding: "6px 14px", fontSize: 12.5, cursor: "pointer", color: sub === v ? t.accent : t.sub, borderBottom: sub === v ? `2px solid ${t.accent}` : "2px solid transparent", marginBottom: -1 }}>{v}</div>)}
      </div>
      {sub === "Overview" && <Overview t={t} sum={s} lanes={lanes} artifacts={artifacts} onFilter={(f) => { setFilter(f); setSub("Evidence"); }} />}
      {sub === "Lineage picture" && <PictureTab t={t} initial={initial?.picture} />}
      {sub === "Lineage" && <LineageTab t={t} initial={initial?.lineage} />}
      {sub === "Lineage mapping" && <MappingTab t={t} initial={initial?.mapping} />}
      {sub === "Rules" && <RulesTab t={t} initial={initial?.rules} />}
      {sub === "Decon dictionary" && <DeconTab t={t} initial={initial?.decon} />}
      {sub === "QC" && <QcTab t={t} initial={initial?.qc} />}
      {sub === "Evidence" && <Evidence t={t} sum={s} filter={filter} setFilter={setFilter} initial={initial?.evidence} />}
      {sub === "Dictionary" && <Dictionary t={t} columns={dict} />}
      {sub === "Loads" && <Loads t={t} batches={batches} />}
    </div>);
}
