// Cyber Security 360 — the application inventory and its scan coverage.
//
// WHAT IT IS FOR. The scan group asked for a complete list of applications
// that do not go through the application scan, and for each, why; where
// there is no technical or other valid constraint, it gets scanned. This
// page is that list, kept by the developers who own the applications:
// the link is handed to every team, each team declares what it runs, what
// is scanned, and why a scan is not required where it is not.
//
// WHERE THE ROWS COME FROM. The starter inventory is every system Interface
// 360 knows, with the owner its interfaces name, plus the applications the
// Application Scans thread listed. A developer edits a row in place or in
// the full form, adds an application, or fills in the downloaded workbook
// and uploads it.
//
// EVERY NUMBER IN THE HEADER IS DERIVED FROM THE ROWS, never stored.
// NO PERSON'S NAME, ADDRESS OR HOST IS ON A ROW: owners are teams, runtime
// is a schedule or platform, and the API refuses anything that looks like
// an address. The identity on a save comes from the session when there is
// one, else the declared name, and the page says which.
//
// `initial` lets a test hand in the state and skip the network.
import React, { useEffect, useMemo, useState } from "react";
import api, { CLASSES, SURFACES, SCAN, CONSTRAINTS, VALID, LIFECYCLE, DEVSECOPS, SCAN_COLOR, VALID_COLOR, DEVSECOPS_COLOR, POLICY,
  blankApp, summarise, unscannedMarkdown, toCsv, applyLocal } from "./cyber360Api.js";

const TABS = ["Inventory", "Not scanned review", "Change log"];
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

const Tile = ({ t, n, label, sub, color }) => (
  <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 6, padding: "10px 14px", minWidth: 104, flex: "1 1 104px" }}>
    <div style={{ fontSize: 24, fontWeight: 800, color: color || t.navy, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{n.toLocaleString()}</div>
    <div style={{ fontSize: 10, color: t.textMuted, textTransform: "uppercase", letterSpacing: ".6px", marginTop: 6 }}>{label}</div>
    {sub && <div style={{ fontSize: 11, color: t.sub, marginTop: 3 }}>{sub}</div>}
  </div>);
const Chip = ({ c, children }) => <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: .4, color: c, border: `1px solid ${c}`, borderRadius: 3, padding: "0 6px", whiteSpace: "nowrap" }}>{children}</span>;
const H = ({ t, children, sub }) => <div style={{ margin: "16px 0 6px" }}><div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{children}</div>{sub && <div style={{ fontSize: 12, color: t.sub, maxWidth: "88ch", lineHeight: 1.55 }}>{sub}</div>}</div>;
const th = (t) => ({ textAlign: "left", fontSize: 9.5, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase", color: t.textMuted, padding: "0 10px 6px 0", borderBottom: `1px solid ${t.border}`, verticalAlign: "bottom", whiteSpace: "nowrap" });
const td = (t) => ({ padding: "7px 10px 7px 0", verticalAlign: "top", borderBottom: `1px solid ${t.bg}`, color: t.sub, fontSize: 12, lineHeight: 1.45 });
const btn = (t, primary) => ({ font: "inherit", fontSize: 12, padding: "5px 11px", borderRadius: 4, cursor: "pointer", border: `1px solid ${primary ? t.accent : t.border}`, background: primary ? t.accent : t.panel, color: primary ? "#fff" : t.text });
const inp = (t) => ({ font: "inherit", fontSize: 12.5, padding: "6px 8px", border: `1px solid ${t.border}`, borderRadius: 4, background: t.panel, color: t.text, width: "100%", boxSizing: "border-box" });
const trunc = (s, n) => { const v = String(s || "").replace(/\s+/g, " ").trim(); return v.length > n ? v.slice(0, n - 1) + "…" : v; };

function Field({ t, label, hint, children, span }) {
  return (
    <label style={{ display: "block", gridColumn: span ? "1 / -1" : undefined }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: .4, marginBottom: 3 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 11, color: t.sub, marginTop: 3, lineHeight: 1.45 }}>{hint}</div>}
    </label>);
}
const Select = ({ t, value, onChange, options }) => (
  <select value={value || ""} onChange={(e) => onChange(e.target.value)} style={inp(t)}>{Object.entries(options).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>);

// ------------------------------------------------------------ the form
// The declaration a developer makes about one application. Four groups:
// the application, the scan declaration, why a scan is not required, the
// DevSecOps integration; the scan group's decision is its own group so a
// developer sees it is not theirs to fill.
export function AppForm({ t, app, onSave, onCancel, saving, error, who }) {
  const [a, setA] = useState({ ...blankApp(), ...app });
  const set = (k) => (v) => setA((x) => ({ ...x, [k]: v }));
  const text = (k, extra = {}) => <input value={a[k] || ""} onChange={(e) => set(k)(e.target.value)} style={inp(t)} {...extra} />;
  const area = (k, rows = 3) => <textarea value={a[k] || ""} onChange={(e) => set(k)(e.target.value)} rows={rows} style={{ ...inp(t), fontFamily: "inherit", resize: "vertical" }} />;
  const unscanned = a.scan_status === "NOT_SCANNED" || a.scan_status === "SERVER_ONLY";
  const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px 14px" };
  const group = (title, sub) => <div style={{ gridColumn: "1 / -1", marginTop: 6 }}><div style={{ fontSize: 12.5, fontWeight: 700, color: t.text, borderBottom: `1px solid ${t.border}`, paddingBottom: 3 }}>{title}</div>{sub && <div style={{ fontSize: 11, color: t.sub, marginTop: 3 }}>{sub}</div>}</div>;
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(a); }} style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 6, padding: "14px 16px", margin: "10px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{a.app_id ? `Declare · ${a.app_name || a.app_id}` : "Add an application"}</div>
        {a.app_id && <span style={{ fontFamily: MONO, fontSize: 11, color: t.textMuted }}>{a.app_id}</span>}
        <span style={{ flex: 1 }} />
        {who && <span style={{ fontSize: 11, color: t.sub }}>saving as <b style={{ color: t.text }}>{who}</b></span>}
      </div>
      <div style={grid}>
        {group("The application")}
        <Field t={t} label="Application name" hint="as the scan group knows it; no hosts, no addresses">{text("app_name", { required: true })}</Field>
        <Field t={t} label="Class"><Select t={t} value={a.app_class} onChange={set("app_class")} options={CLASSES} /></Field>
        <Field t={t} label="Category" hint=".NET utility, Windows service, web application, shell scripts, vendor desktop…">{text("category")}</Field>
        <Field t={t} label="Runtime" hint="RMJ schedule, Tomcat, mainframe terminal, vendor hosted">{text("runtime")}</Field>
        <Field t={t} label="Tech stack">{text("tech_stack")}</Field>
        <Field t={t} label="Surface" hint="what a scanner would see"><Select t={t} value={a.surface} onChange={set("surface")} options={{ "": "—", ...SURFACES }} /></Field>
        <Field t={t} label="Owner team" hint="a team, not a person; Interface 360 fills this where it can">{text("owner_team")}</Field>
        <Field t={t} label="Lifecycle"><Select t={t} value={a.lifecycle} onChange={set("lifecycle")} options={LIFECYCLE} /></Field>

        {group("Scan declaration", "Every application that runs on the web goes through the application scan, APIs and web interfaces included.")}
        <Field t={t} label="Is it scanned?"><Select t={t} value={a.scan_status} onChange={set("scan_status")} options={SCAN} /></Field>
        <Field t={t} label="What the scan covers" hint="web, api, server">{text("scan_types")}</Field>

        {group("If not scanned: why a scan is not required", unscanned ? "The scan group reviews this. A constraint has to be technical or otherwise valid; with none, the application gets scanned." : "Only needed when the application is not scanned.")}
        <Field t={t} label="Constraint"><Select t={t} value={a.constraint_kind} onChange={set("constraint_kind")} options={CONSTRAINTS} /></Field>
        <Field t={t} label="Covering control" hint="what covers it instead, or the scan to schedule">{text("recommended_control")}</Field>
        <Field t={t} label="Why, in your words" span>{area("constraint_text")}</Field>

        {group("DevSecOps integration", "Is the application on the BBH DevSecOps security pipeline (the shared Jenkins library): checkout, unit tests with coverage, Nexus IQ, SonarQube, AppScan SAST, and DAST where there is a web surface.")}
        <Field t={t} label="Integration" hint="integrated: on the shared library with every stage green; partial: some stages or a local pipeline; not applicable: vendor binaries or SaaS"><Select t={t} value={a.devsecops_integration} onChange={set("devsecops_integration")} options={DEVSECOPS} /></Field>
        <Field t={t} label="Pipeline and stages" hint="the Jenkins job and which stages run, e.g. unit tests, Nexus IQ, SonarQube, SAST, DAST">{text("devsecops_detail")}</Field>

        {group("Scan group decision", "Filled by the scan group, not the developer.")}
        <Field t={t} label="Decision on the constraint"><Select t={t} value={a.constraint_valid} onChange={set("constraint_valid")} options={VALID} /></Field>
        <Field t={t} label="Action">{text("action")}</Field>
        <Field t={t} label="Notes" span>{area("notes", 2)}</Field>
      </div>
      {error && <div style={{ color: "#c1113a", fontSize: 12, marginTop: 8 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button type="submit" style={btn(t, true)} disabled={saving}>{saving ? "Saving…" : "Save declaration"}</button>
        <button type="button" style={btn(t)} onClick={onCancel}>Cancel</button>
      </div>
    </form>);
}

// ----------------------------------------------------------- the page
export default function Cyber360({ t, initial }) {
  const [apps, setApps] = useState(initial?.apps || []);
  const [log, setLog] = useState(initial?.log || []);
  const [live, setLive] = useState(initial ? !!initial.live : false);
  const [seeded, setSeeded] = useState(initial ? !!initial.seeded : false);
  const [starter, setStarter] = useState(initial?.starter || null);
  const [loaded, setLoaded] = useState(!!initial);
  const [who, setWho] = useState(initial?.who || { verified: false });
  const [name, setName] = useState(initial?.name || api.reviewerName());
  const [tab, setTab] = useState(initial?.tab || "Inventory");
  const [open, setOpen] = useState(initial?.open || null);       // app_id, "new", or null
  const [filter, setFilter] = useState({ cls: "", scan: "", decision: "", q: "", owner: "" });
  const [msg, setMsg] = useState(initial?.msg || null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [drafts, setDrafts] = useState({});                        // app_id -> the fields changed in the row, unsaved

  useEffect(() => {
    if (initial) return undefined;
    let on = true;
    api.load().then((r) => { if (!on) return; setApps(r.apps); setLog(r.log); setLive(r.live); setSeeded(r.seeded); setStarter(r.starter || null); setLoaded(true); });
    api.whoami().then((w) => { if (on) setWho(w || { verified: false }); });
    const q = (typeof window !== "undefined" ? window.location.hash.split("?")[1] : "") || "";
    const m = /(?:^|&)app=([^&]+)/.exec(q);
    if (m) setOpen(decodeURIComponent(m[1]));
    return () => { on = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const actor = who.verified && who.lanId ? who.lanId : name;
  const sum = useMemo(() => summarise(apps), [apps]);
  const owners = useMemo(() => [...new Set(apps.map((a) => a.owner_team).filter(Boolean))].sort(), [apps]);

  const applyResult = (r) => { if (r && r.apps) { setApps(r.apps); setLog(r.log || []); setSeeded(false); setLive(true); } };
  const needName = () => { if (!actor) { setErr("say who you are first: sign-in is off, so the name you type is recorded with the save"); return true; } api.setReviewerName(name); return false; };
  const saveApp = async (a) => {
    if (needName()) return false;
    setSaving(true); setErr(null);
    if (live && !seeded) {
      const r = await api.save(a, actor);
      setSaving(false);
      if (r.error) { setErr(r.error); return false; }
      applyResult(r); setOpen(null); setMsg(`saved ${a.app_name}`);
      return true;
    }
    if (live && seeded) {
      // the first save on an empty warehouse writes the starter rows first, then this one
      const s = await api.seed(apps, actor);
      if (!s.error) { const r = await api.save(a, actor); setSaving(false); if (r.error) { setErr(r.error); return false; } applyResult(r); setOpen(null); setMsg(`starter inventory saved, then ${a.app_name}`); return true; }
    }
    const next = applyLocal(apps, log, a, actor);
    setApps(next.apps); setLog(next.log); api.saveLocal(next.apps, next.log); setSeeded(false);
    setSaving(false); setOpen(null); setMsg(`saved ${a.app_name} on this browser only`);
    return true;
  };
  const saveSeed = async () => {
    if (needName()) return;
    setErr(null);
    const r = await api.seed(apps, actor);
    if (r.error) { setErr(r.error); return; }
    applyResult(r);
    setMsg(`${r.added} starter applications saved to the warehouse` + ((r.errors || []).length ? `; ${r.errors.length} refused: ` + r.errors.slice(0, 3).map((e) => `${e.app}: ${e.error}`).join("; ") : ""));
  };
  const upload = async (file) => {
    if (!file || needName()) return;
    const buf = await file.arrayBuffer();
    let b = ""; const bytes = new Uint8Array(buf); for (let i = 0; i < bytes.length; i += 1) b += String.fromCharCode(bytes[i]);
    const r = await api.uploadXlsx(file.name, btoa(b), actor);
    if (r.error) { setErr(r.error); return; }
    applyResult(r);
    setMsg(`${file.name}: ${(r.added || []).length} added, ${(r.updated || []).length} updated${(r.errors || []).length ? `, ${r.errors.length} rows refused: ` + r.errors.slice(0, 3).map((e) => `row ${e.row} ${e.error}`).join("; ") : ""}`);
  };
  const download = (data, fname, type) => {
    try { const u = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type })); const el = document.createElement("a"); el.href = u; el.download = fname; el.click(); setTimeout(() => URL.revokeObjectURL(u), 500); } catch { /* not a browser */ }
  };
  const downloadExcel = async () => {
    const blob = await api.exportXlsx(apps);
    if (blob) { download(blob, "cyber-security-360-inventory.xlsx"); setMsg(`workbook with ${apps.length} applications and the dropdowns, ready to share`); return; }
    download(toCsv(apps), "cyber-security-360-inventory.csv", "text/csv"); setMsg("the API did not answer, so this is the CSV without dropdowns");
  };
  const copy = (text, what) => { try { navigator.clipboard.writeText(text); setMsg(`${what} copied`); } catch { setMsg(`could not copy ${what}`); } };

  const rows = apps.filter((a) => (!filter.cls || a.app_class === filter.cls) && (!filter.scan || (a.scan_status || "UNKNOWN") === filter.scan)
    && (!filter.decision || (a.constraint_valid || "TBD") === filter.decision) && (!filter.owner || a.owner_team === filter.owner)
    && (!filter.q || `${a.app_name} ${a.category} ${a.runtime} ${a.tech_stack} ${a.constraint_text} ${a.notes}`.toLowerCase().includes(filter.q.toLowerCase())));
  const current = open === "new" ? blankApp() : apps.find((a) => a.app_id === open);

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 500, color: t.accent, borderBottom: `2px solid ${t.accent}`, paddingBottom: 14, margin: "0 0 8px" }}>Cyber Security 360</h1>
      <p style={{ fontSize: 12.5, color: t.sub, margin: "0 0 10px", maxWidth: "100ch", lineHeight: 1.55 }}>
        The inventory of the applications we run, home-grown, vendor and SaaS, and whether each goes through the application scan. Each owning team declares
        its applications here: what runs, what is scanned, and where it is not, why a scan is not required. The scan group reviews every constraint; with no
        technical or other valid one, the application gets scanned.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 11.5, color: t.sub, marginBottom: 10 }}>
        <Chip c={live ? "#159943" : "#b45309"}>{live ? "live" : "local only"}</Chip>
        {seeded && <span>starter inventory{starter ? `: ${starter.systems} systems from Interface 360 and ${starter.thread} from the Application Scans thread` : " from the Application Scans thread"}, not yet saved</span>}
        {!loaded && <span>loading…</span>}
        <span style={{ flex: 1 }} />
        {who.verified ? <span>you are <b style={{ color: t.text }}>{who.lanId}</b> ({who.source})</span>
          : <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>your name <input value={name} onChange={(e) => setName(e.target.value)} placeholder="team or name" style={{ ...inp(t), width: 160 }} /></label>}
      </div>
      {msg && <div style={{ fontSize: 12, color: t.text, background: t.panel, border: `1px solid ${t.border}`, borderLeft: "3px solid #159943", borderRadius: 4, padding: "6px 10px", marginBottom: 10 }}>{msg}</div>}
      {err && <div style={{ fontSize: 12, color: "#c1113a", background: t.panel, border: "1px solid #c1113a", borderRadius: 4, padding: "6px 10px", marginBottom: 10 }}>{err}</div>}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Tile t={t} n={sum.apps} label="applications" sub={Object.entries(CLASSES).map(([k, v]) => `${sum.byClass[k] || 0} ${v.toLowerCase()}`).join(" · ")} />
        <Tile t={t} n={sum.scanned} label="scanned" color="#159943" />
        <Tile t={t} n={sum.serverOnly} label="server scan only" color="#b45309" />
        <Tile t={t} n={sum.notScanned} label="not scanned" color="#c1113a" />
        <Tile t={t} n={sum.unknown} label="not yet declared" sub="owners to fill in" color="#6b7884" />
        <Tile t={t} n={sum.toReview} label="constraints to review" sub="scan group decision pending" color="#b45309" />
        <Tile t={t} n={sum.toScan} label="to scan" sub="constraint not accepted" color="#c1113a" />
        <Tile t={t} n={sum.retiring} label="retiring" />
      </div>

      <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderLeft: `3px solid ${t.accent}`, borderRadius: 6, padding: "10px 14px", margin: "12px 0" }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase", color: t.textMuted, marginBottom: 4 }}>Scan policy, as stated by the scan group</div>
        {POLICY.map((p) => <div key={p.key} style={{ fontSize: 12.5, color: t.text, lineHeight: 1.55, display: "flex", gap: 8 }}><span style={{ width: 90, flex: "none" }}>{p.covers ? <Chip c={SCAN_COLOR[p.covers]}>{SCAN[p.covers]}</Chip> : <Chip c={t.sub}>review</Chip>}</span><span>{p.text}</span></div>)}
      </div>

      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${t.border}`, marginBottom: 12 }}>
        {TABS.map((v) => <div key={v} role="tab" tabIndex={0} aria-selected={tab === v} onClick={() => setTab(v)}
          style={{ padding: "8px 16px", fontSize: 13, cursor: "pointer", color: tab === v ? t.accent : t.sub, borderBottom: tab === v ? `2px solid ${t.accent}` : "2px solid transparent", marginBottom: -1 }}>{v}</div>)}
      </div>

      {tab === "Inventory" && (<>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "2px 0 10px" }}>
          <button type="button" style={btn(t, true)} onClick={() => { setOpen("new"); setErr(null); }}>Add an application</button>
          {seeded && live && <button type="button" style={btn(t)} onClick={saveSeed}>Save the starter inventory</button>}
          <button type="button" style={btn(t)} onClick={downloadExcel} title="the rows shown, with a dropdown on every listed column, for developers to fill in">Download Excel</button>
          <label style={{ ...btn(t), display: "inline-block" }}>Upload Excel<input type="file" accept=".xlsx" style={{ display: "none" }} onChange={(e) => { upload(e.target.files && e.target.files[0]); e.target.value = ""; }} /></label>
        </div>
        {current && <AppForm t={t} app={current} who={actor} saving={saving} error={err} onCancel={() => { setOpen(null); setErr(null); }} onSave={saveApp} />}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "4px 0 10px" }}>
          <select value={filter.cls} onChange={(e) => setFilter({ ...filter, cls: e.target.value })} style={{ ...inp(t), width: "auto" }}><option value="">every class</option>{Object.entries(CLASSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select value={filter.scan} onChange={(e) => setFilter({ ...filter, scan: e.target.value })} style={{ ...inp(t), width: "auto" }}><option value="">any scan status</option>{Object.entries(SCAN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select value={filter.decision} onChange={(e) => setFilter({ ...filter, decision: e.target.value })} style={{ ...inp(t), width: "auto" }}><option value="">any decision</option>{Object.entries(VALID).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select value={filter.owner} onChange={(e) => setFilter({ ...filter, owner: e.target.value })} style={{ ...inp(t), width: "auto" }}><option value="">any owner</option>{owners.map((o) => <option key={o} value={o}>{o}</option>)}</select>
          <input value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} placeholder="find an application, runtime, stack…" style={{ ...inp(t), width: 260 }} />
          <span style={{ fontSize: 11.5, color: t.sub }}>{rows.length} of {apps.length} · change a row and Save it, or Edit for every field</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead><tr>{["Application", "Runtime", "Scan", "Why not scanned", "Decision", "DevSecOps", "Owner", "Lifecycle"].map((h, i) => <th key={i} style={th(t)}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((a0) => {
              const d = drafts[a0.app_id]; const a = d ? { ...a0, ...d } : a0;
              const edit = (k) => (v) => setDrafts((x) => ({ ...x, [a0.app_id]: { ...(x[a0.app_id] || {}), [k]: v } }));
              const cell = { ...inp(t), width: "auto", minWidth: 96, fontSize: 11.5, padding: "3px 6px" };
              const sel = (k, options) => <select value={a[k] || ""} onChange={(e) => edit(k)(e.target.value)} style={cell}>{Object.entries(options).map(([kk, v]) => <option key={kk} value={kk}>{v}</option>)}</select>;
              return (
              <tr key={a0.app_id} style={{ background: d ? "#fffaf0" : (open === a0.app_id ? t.bg : undefined) }}>
                <td style={{ ...td(t), color: t.text, fontWeight: 600, minWidth: 170 }}>{a.app_name}<div style={{ fontSize: 10.5, color: t.textMuted, fontWeight: 400 }}>{CLASSES[a.app_class] || a.app_class}{a.category ? ` · ${a.category}` : ""}{a.surface ? ` · ${SURFACES[a.surface]}` : ""}</div>
                  <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
                    {d && <button type="button" style={{ ...btn(t, true), padding: "3px 9px", fontSize: 11.5 }} disabled={saving} onClick={() => saveApp(a).then(() => setDrafts((x) => { const n = { ...x }; delete n[a0.app_id]; return n; }))}>Save</button>}
                    {d && <button type="button" style={{ ...btn(t), padding: "3px 9px", fontSize: 11.5 }} onClick={() => setDrafts((x) => { const n = { ...x }; delete n[a0.app_id]; return n; })}>Undo</button>}
                    <button type="button" style={{ ...btn(t), padding: "3px 9px", fontSize: 11.5 }} onClick={() => { setOpen(a0.app_id); setErr(null); }}>Edit</button>
                  </div></td>
                <td style={td(t)}><input value={a.runtime || ""} onChange={(e) => edit("runtime")(e.target.value)} placeholder="runtime" style={{ ...cell, minWidth: 110 }} /><div style={{ fontSize: 10.5, color: t.textMuted }}>{a.tech_stack}</div></td>
                <td style={td(t)}>{sel("scan_status", SCAN)}</td>
                <td style={{ ...td(t), maxWidth: 300 }}>{a.scan_status === "SCANNED" ? "—" : <>{sel("constraint_kind", CONSTRAINTS)}
                  <textarea value={a.constraint_text || ""} onChange={(e) => edit("constraint_text")(e.target.value)} rows={2} placeholder="why a scan is not required" style={{ ...cell, width: "100%", minWidth: 200, marginTop: 4, fontFamily: "inherit", resize: "vertical" }} /></>}</td>
                <td style={td(t)}>{a.scan_status === "SCANNED" ? "—" : <Chip c={VALID_COLOR[a.constraint_valid] || "#b45309"}>{VALID[a.constraint_valid] || VALID.TBD}</Chip>}</td>
                <td style={td(t)}>{sel("devsecops_integration", DEVSECOPS)}</td>
                <td style={td(t)}><input value={a.owner_team || ""} onChange={(e) => edit("owner_team")(e.target.value)} placeholder="owner team" style={{ ...cell, minWidth: 100 }} /></td>
                <td style={td(t)}>{sel("lifecycle", LIFECYCLE)}</td>
              </tr>); })}
              {rows.length === 0 && <tr><td colSpan={11} style={{ ...td(t), padding: 18 }}>No applications match. Add one, import from Interface 360, or upload the workbook.</td></tr>}
            </tbody>
          </table>
        </div>
      </>)}

      {tab === "Not scanned review" && <ReviewTab t={t} apps={apps} onOpen={(id) => { setOpen(id); setTab("Inventory"); }} onCopy={() => copy(unscannedMarkdown(apps), "the not-scanned list")} />}

      {tab === "Change log" && (<>
        <H t={t} sub="Every changed field, who changed it and what it replaced. A decision on a constraint is evidence, so it is never overwritten silently.">Change log</H>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr>{["When", "Application", "Field", "Before", "After", "By"].map((h, i) => <th key={i} style={th(t)}>{h}</th>)}</tr></thead>
          <tbody>{log.map((l) => { const a = apps.find((x) => x.app_id === l.appId); return (
            <tr key={l.id}><td style={{ ...td(t), whiteSpace: "nowrap" }}>{l.at}</td><td style={{ ...td(t), color: t.text }}>{a ? a.app_name : l.appId}</td><td style={{ ...td(t), fontFamily: MONO, fontSize: 11 }}>{l.field}</td>
              <td style={{ ...td(t), maxWidth: 260 }}>{trunc(l.before, 120) || "—"}</td><td style={{ ...td(t), maxWidth: 260, color: t.text }}>{trunc(l.after, 120) || "—"}</td><td style={td(t)}>{l.author}{l.idSource === "none" ? " (declared)" : ""}</td></tr>); })}
            {log.length === 0 && <tr><td colSpan={6} style={{ ...td(t), padding: 18 }}>No changes recorded yet.</td></tr>}
          </tbody>
        </table>
      </>)}
    </div>);
}

// The list the thread asks for: every application not scanned, grouped by
// the constraint behind it, each with the owner's reason, the decision and
// what covers it instead.
export function ReviewTab({ t, apps, onOpen, onCopy }) {
  const rows = apps.filter((a) => (a.scan_status === "NOT_SCANNED" || a.scan_status === "SERVER_ONLY") && a.lifecycle !== "RETIRED");
  const pending = apps.filter((a) => !a.scan_status || a.scan_status === "UNKNOWN");
  return (<>
    <H t={t} sub="For each application not covered by the application scan: why, whether the scan group accepts that, and what covers it instead. No constraint, or one not accepted, means the application gets scanned.">Applications not covered by the application scan · {rows.length}</H>
    {onCopy && <button type="button" style={btn(t)} onClick={onCopy}>Copy this list as Markdown</button>}
    {pending.length > 0 && <div style={{ fontSize: 12, color: "#b45309", marginBottom: 8 }}>{pending.length} application{pending.length === 1 ? "" : "s"} not yet declared by their owners are not in this list.</div>}
    {Object.keys(CONSTRAINTS).map((k) => {
      const g = rows.filter((a) => (a.constraint_kind || "NONE") === k);
      if (!g.length) return null;
      return (
        <div key={k} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, margin: "8px 0 4px" }}>{CONSTRAINTS[k]} <span style={{ color: t.textMuted, fontWeight: 400 }}>· {g.length}</span>
            {k === "NONE" && <span style={{ fontSize: 11.5, color: "#c1113a", marginLeft: 8 }}>no constraint given: these get scanned</span>}</div>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead><tr>{["Application", "Scan today", "Why", "Decision", "Covering control", "DevSecOps", "Action", "Owner"].map((h, i) => <th key={i} style={th(t)}>{h}</th>)}</tr></thead>
            <tbody>{g.map((a) => (
              <tr key={a.app_id} onClick={() => onOpen && onOpen(a.app_id)} style={{ cursor: onOpen ? "pointer" : "default" }}>
                <td style={{ ...td(t), color: t.text, fontWeight: 600 }}>{a.app_name}<div style={{ fontSize: 10.5, color: t.textMuted, fontWeight: 400 }}>{CLASSES[a.app_class]} · {a.runtime}</div></td>
                <td style={td(t)}><Chip c={SCAN_COLOR[a.scan_status]}>{SCAN[a.scan_status]}</Chip></td>
                <td style={{ ...td(t), maxWidth: 340 }}>{a.constraint_text || <span style={{ color: "#c1113a" }}>no reason given</span>}</td>
                <td style={td(t)}><Chip c={VALID_COLOR[a.constraint_valid] || "#b45309"}>{VALID[a.constraint_valid] || VALID.TBD}</Chip></td>
                <td style={{ ...td(t), maxWidth: 280 }}>{a.recommended_control || "—"}</td>
                <td style={td(t)}><Chip c={DEVSECOPS_COLOR[a.devsecops_integration] || "#c1113a"}>{DEVSECOPS[a.devsecops_integration] || DEVSECOPS.NONE}</Chip></td>
                <td style={{ ...td(t), maxWidth: 260 }}>{a.action || "—"}</td>
                <td style={td(t)}>{a.owner_team || <span style={{ color: "#b45309" }}>unowned</span>}</td>
              </tr>))}</tbody>
          </table>
        </div>);
    })}
    {rows.length === 0 && <div style={{ fontSize: 12, color: t.sub }}>Nothing declared as not scanned.</div>}
  </>);
}
