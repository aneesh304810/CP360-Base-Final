import React, { useState, useEffect, useMemo } from "react";
import { starUsage, crosswalkApi } from "./seiCrosswalkApi.js";

// SEI crosswalk · STAR field usage.
//
// WHAT THIS ANSWERS THAT NOTHING ELSE DID. STAR_LAYOUT_DETAIL says what a
// feed family publishes. Nothing said what anybody READS, so every
// published field counted as something to account for: a family
// publishing 139 of which 49 are read showed 90 apparent gaps that
// nothing consumes.
//
// IT IS SHOWN SEPARATELY FROM THE VERDICTS ON PURPOSE. Usage is a fact
// about today's consumers, not about the contract, and putting an
// "unused" badge next to a verdict would invite the reader to subtract
// it from the backlog. That subtraction may well be right -- but it is a
// decision about scope that somebody makes and records, not one a screen
// makes by laying two columns side by side.
//
// DECLARED AND COUNTED ARE BOTH SHOWN wherever they differ, because they
// do: one family declares 0 fields against 42 on the layout side,
// another 73 against 74. The workbook ships a reconciliation sheet for
// exactly those rows, and this surfaces it rather than quietly picking a
// side.

const C = {
  used: "#1a8f4c", unused: "#6b7c8a", unknown: "#e8a33d", bad: "#c1113a",
};

const pc = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : null);

export default function StarFieldUsage({ t, dataSource }) {
  const ds = dataSource || "IMDS";
  const [sum, setSum] = useState(null);
  const [health, setHealth] = useState(null);
  const [recon, setRecon] = useState(null);
  const [cov, setCov] = useState(null);
  const [open, setOpen] = useState(null);      // feed_family drilled into
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState("unused");

  useEffect(() => {
    let live = true;
    Promise.all([starUsage.summary(ds), starUsage.health(ds),
                 starUsage.recon(ds), starUsage.coverage(ds)])
      .then(([s, h, r, c]) => {
        if (live) { setSum(s); setHealth(h); setRecon(r); setCov(c); }
      });
    return () => { live = false; };
  }, [ds]);

  useEffect(() => {
    if (!open) { setRows(null); return; }
    let live = true;
    setRows("loading");
    starUsage.fields(ds, open, filter === "all" ? null : filter, 2000)
      .then((r) => { if (live) setRows(r.fields || []); });
    return () => { live = false; };
  }, [ds, open, filter]);

  const fams = (sum && sum.families) || [];
  const tot = (sum && sum.totals) || {};

  // A family whose declared total and counted rows disagree. Sorted to the
  // top of nothing -- the table stays alphabetical -- but marked, because
  // the mark is the reason to look.
  const odd = useMemo(() => {
    const m = new Map();
    ((health && health.disagreements) || []).forEach((d) => m.set(d.feed_family, d));
    return m;
  }, [health]);

  if (sum && !fams.length) {
    return (
      <Empty t={t} health={health} />
    );
  }

  return (
    <div>
      <p style={{ fontSize: 12.5, color: t.sub, margin: "0 0 14px",
                  maxWidth: 820, lineHeight: 1.55 }}>
        Which published STAR fields anybody actually reads, per feed family.
        This is <b>evidence, not a decision</b>: a field nobody reads today is
        still a field the contract publishes. No verdict on this dashboard
        changes because of it.
      </p>

      {health && health.warning && (
        <div style={{ border: `1px solid ${C.bad}`, borderLeft: `4px solid ${C.bad}`,
          background: `${C.bad}12`, borderRadius: t.radius.md,
          padding: "9px 12px", marginBottom: 14, fontSize: 12.5,
          lineHeight: 1.5 }}>
          <b style={{ color: C.bad }}>Unexplained.</b> {health.warning} A
          difference the reconciliation sheet covers is the workbook
          explaining itself; one it does not cover is a finding.
        </div>
      )}

      <div style={{ display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
        gap: 11, marginBottom: 18 }}>
        <Tile t={t} v={tot.published} c={t.accent} label="Published fields"
          sub={`across ${tot.families || 0} feed families`} />
        <Tile t={t} v={tot.used} c={C.used} label="Read by something"
          sub={tot.used_percent == null ? "" : `${tot.used_percent}% of published`} />
        <Tile t={t} v={tot.unused} c={C.unused} label="Read by nothing"
          sub="published, no consumer found" />
        {tot.unknown > 0 && (
          <Tile t={t} v={tot.unknown} c={C.unknown} label="Not stated"
            sub="a usage word nothing recognised" />)}
      </div>

      {cov && <Backlog t={t} cov={cov} />}

      <Table t={t} fams={fams} odd={odd} open={open} setOpen={setOpen} />

      {open && (
        <Drill t={t} family={open} rows={rows} filter={filter}
          setFilter={setFilter} onClose={() => setOpen(null)} />)}

      {recon && recon.by_type && recon.by_type.length > 0 && (
        <Recon t={t} recon={recon} />)}
    </div>
  );
}

// The one number this whole feature exists to produce, and the only place
// it is allowed to touch the crosswalk's own figures: how much of the open
// backlog sits on fields nobody reads. It is SIZED here and decided
// elsewhere -- the button goes to the disposition screen rather than
// quietly moving anything out of the denominator.
function Backlog({ t, cov }) {
  const n = cov.open_items_on_unused_fields;
  const of = cov.open_items;
  if (n === undefined) return null;
  const unknown = n === null;
  const share = (!unknown && of) ? Math.round((n / of) * 100) : null;
  const weak = cov.matched_on === "field_only";
  return (
    <div style={{ background: t.panel, border: `1px solid ${t.border}`,
      borderLeft: `4px solid ${unknown ? "#e8a33d" : t.accent}`,
      borderRadius: t.radius.md, padding: "12px 15px", marginBottom: 18 }}>
      {unknown ? (
        <div style={{ fontSize: 12.5, lineHeight: 1.55, color: t.text }}>
          <b>Not linked to the verdicts yet.</b>{" "}
          <span style={{ color: t.sub }}>{cov.open_items_note}</span>
        </div>
      ) : (
        <div style={{ fontSize: 12.5, lineHeight: 1.6, color: t.text }}>
          <b style={{ fontSize: 17, color: t.accent }}>{n}</b> of{" "}
          <b>{of}</b> open crosswalk items{share != null && ` (${share}%)`} sit
          on a STAR field the usage study found <b>nothing reading</b>.
          <div style={{ color: t.sub, marginTop: 5, fontSize: 11.5 }}>
            Reported, not subtracted. These are still published contract
            fields — to take them out of scope, record a disposition
            against them and the denominator follows.
            {weak && " Matched on the field name alone: the feed names did "
                   + "not line up, so this holds only if no two families "
                   + "share a field name."}
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({ t, v, c, label, sub }) {
  return (
    <div style={{ background: t.panel, border: `1px solid ${t.border}`,
      borderTop: `3px solid ${c}`, borderRadius: t.radius.md, padding: "11px 13px" }}>
      <div style={{ fontSize: 26, fontWeight: 300, color: c, lineHeight: 1.1 }}>
        {v == null ? "—" : v}</div>
      <div style={{ fontSize: 12, color: t.text, marginTop: 3 }}>{label}</div>
      {sub && <div style={{ fontSize: 10.5, color: t.sub, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Bar({ used, unused, unknown }) {
  const n = (used || 0) + (unused || 0) + (unknown || 0);
  if (!n) return <span style={{ fontSize: 11, color: "#999" }}>no rows</span>;
  const seg = (v, c) => v
    ? <span key={c} style={{ width: `${(v / n) * 100}%`, background: c }} /> : null;
  return (
    <span style={{ display: "flex", height: 9, width: 120, borderRadius: 5,
      overflow: "hidden", background: "#eef2f5" }}>
      {seg(used, C.used)}{seg(unused, C.unused)}{seg(unknown, C.unknown)}
    </span>
  );
}

function Table({ t, fams, odd, open, setOpen }) {
  const th = { textAlign: "right", padding: "6px 10px", fontSize: 10.5,
    fontWeight: 700, color: t.sub, textTransform: "uppercase",
    letterSpacing: ".4px", borderBottom: `1px solid ${t.border}` };
  const td = { textAlign: "right", padding: "6px 10px", fontSize: 12.5,
    borderBottom: `1px solid ${t.border}33` };
  return (
    <div style={{ background: t.panel, border: `1px solid ${t.border}`,
      borderRadius: t.radius.md, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: "left" }}>Feed family</th>
            <th style={th}>Published</th>
            <th style={th}>Read</th>
            <th style={th}>Not read</th>
            <th style={{ ...th, textAlign: "left" }}>Split</th>
            <th style={th}>Layout side</th>
            <th style={{ ...th, textAlign: "left" }}></th>
          </tr>
        </thead>
        <tbody>
          {fams.map((f) => {
            const d = odd.get(f.feed_family);
            const on = open === f.feed_family;
            return (
              <tr key={f.feed_family} onClick={() => setOpen(on ? null : f.feed_family)}
                style={{ cursor: "pointer",
                  background: on ? `${t.accent}0d` : "transparent" }}>
                <td style={{ ...td, textAlign: "left", fontWeight: on ? 600 : 400 }}>
                  {f.feed_family}</td>
                <td style={td}>{f.total_fields ?? "—"}</td>
                <td style={{ ...td, color: C.used }}>{f.used_fields ?? "—"}</td>
                <td style={{ ...td, color: C.unused }}>{f.unused_fields ?? "—"}</td>
                <td style={{ ...td, textAlign: "left" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <Bar used={f.matrix_used}
                      unused={(f.matrix_rows || 0) - (f.matrix_used || 0) - (f.matrix_unknown || 0)}
                      unknown={f.matrix_unknown} />
                    <span style={{ fontSize: 11, color: t.sub }}>
                      {f.used_percent == null ? "" : `${f.used_percent}%`}</span>
                  </span>
                </td>
                {/* The layout-side counts the matrix has no rows for. Shown
                    because they are the half of the disagreement that is
                    otherwise invisible. */}
                {/* Published, and how many of those the usage study
                    never reached. The second number is the one with no
                    equivalent anywhere else in the catalogue. */}
                <td style={td}
                  title="fields in STAR_LAYOUT_DETAIL; in red, how many the usage matrix never matched">
                  {f.catalog_layout_fields ?? "—"}
                  {f.matrix_unmatched_layout_fields ? (
                    <span style={{ color: C.bad }}>
                      {" "}&minus;{f.matrix_unmatched_layout_fields}</span>) : null}
                </td>
                <td style={{ ...td, textAlign: "left" }}>
                  {d && (
                    <span title={`declared ${d.declared}, matrix holds ${d.counted}`}
                      style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px",
                        borderRadius: 999, whiteSpace: "nowrap",
                        background: d.explained ? "rgba(232,163,61,.15)" : `${C.bad}15`,
                        color: d.explained ? "#8a6d1f" : C.bad }}>
                      {d.explained ? "reconciled" : "unexplained"}
                    </span>)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Drill({ t, family, rows, filter, setFilter, onClose }) {
  return (
    <div style={{ marginTop: 16, background: t.panel,
      border: `1px solid ${t.border}`, borderRadius: t.radius.md }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9,
        padding: "9px 13px", borderBottom: `1px solid ${t.border}`,
        background: t.bg, flexWrap: "wrap" }}>
        <b style={{ fontSize: 13 }}>{family}</b>
        <span style={{ display: "inline-flex", gap: 2, borderRadius: 999,
          padding: 3, background: "#e9eef3" }}>
          {[["unused", "Not read"], ["used", "Read"], ["unknown", "Not stated"],
            ["all", "All"]].map(([k, label]) => (
            <button key={k} type="button" onClick={() => setFilter(k)}
              aria-pressed={filter === k}
              style={{ font: "inherit", fontSize: 11, padding: "3px 11px",
                borderRadius: 999, border: 0, cursor: "pointer",
                background: filter === k ? "#fff" : "transparent",
                fontWeight: filter === k ? 600 : 400, color: t.text }}>
              {label}</button>))}
        </span>
        <button onClick={onClose} style={{ marginLeft: "auto",
          border: `1px solid ${t.border}`, background: t.panel, fontSize: 11.5,
          borderRadius: t.radius.md, cursor: "pointer", padding: "4px 10px",
          color: t.sub }}>Close</button>
      </div>
      {rows === "loading" && (
        <div style={{ padding: 16, fontSize: 12.5, color: t.sub }}>Loading…</div>)}
      {Array.isArray(rows) && rows.length === 0 && (
        <div style={{ padding: 16, fontSize: 12.5, color: t.sub }}>
          No fields in this family are {filter === "all" ? "listed" : filter}.
        </div>)}
      {/* The workbook resolved a blank cell to "Unused". That is a
          reading of the evidence, and anyone about to drop 90 fields on
          the strength of it should see it said once. */}
      {Array.isArray(rows) && rows.length > 0 && rows[0].notes && (
        <div style={{ padding: "7px 13px", fontSize: 11.5, color: t.sub,
          borderBottom: `1px solid ${t.border}`, lineHeight: 1.45 }}>
          {rows[0].notes}
        </div>)}
      {Array.isArray(rows) && rows.length > 0 && (
        <div style={{ maxHeight: 440, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${t.border}33` }}>
                  <td style={{ padding: "5px 13px" }}>{r.field_name}</td>
                  <td style={{ padding: "5px 10px", width: 90 }}>
                    <span style={{ fontSize: 10, fontWeight: 700,
                      padding: "2px 7px", borderRadius: 999,
                      color: r.is_used === "Y" ? C.used
                           : r.is_used === "N" ? C.unused : C.unknown,
                      background: r.is_used === "Y" ? "rgba(26,143,76,.1)"
                           : r.is_used === "N" ? "#eef2f5" : "rgba(232,163,61,.15)" }}>
                      {r.usage_status || "not stated"}</span>
                  </td>
                  {/* What the mapping document says about the same field
                      (sql/79). Beside the matrix's word, never merged with
                      it: the two disagreeing is the finding. */}
                  {(r.doc_usage_status || r.sei_mapped || r.usage_check) && (
                    <td style={{ padding: "5px 10px", fontSize: 10.5, whiteSpace: "nowrap" }}>
                      {r.doc_usage_status && <span style={{ color: t.sub }}>doc: {r.doc_usage_status}</span>}
                      {r.sei_mapped && <span style={{ marginLeft: 6, fontWeight: 700,
                        color: r.sei_mapped === "Y" ? C.used : C.bad }}>{r.sei_mapped === "Y" ? "SEI source" : "no SEI source"}</span>}
                      {r.usage_check && !/^(AGREE|CONSISTENT)$/i.test(r.usage_check) && (
                        <span style={{ marginLeft: 6, padding: "1px 6px", borderRadius: 999, fontSize: 9.5, fontWeight: 700,
                          color: "#b45309", background: "#fae5d3" }}>{r.usage_check.toLowerCase().replace(/_/g, " ")}</span>)}
                    </td>)}
                  {/* Where the claim came from. An unsourced usage call is
                      an opinion; this names the document and the row. */}
                  <td style={{ padding: "5px 13px", color: t.sub, fontSize: 11,
                    textAlign: "right", whiteSpace: "nowrap" }}>
                    {r.source_document || ""}{r.source_row ? ` · row ${r.source_row}` : ""}
                  </td>
                </tr>))}
            </tbody>
          </table>
        </div>)}
    </div>
  );
}

function Recon({ t, recon }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ marginTop: 18 }}>
      <button onClick={() => setShow((v) => !v)}
        style={{ border: 0, background: "none", cursor: "pointer", padding: 0,
          font: "inherit", fontSize: 12.5, color: t.accent }}>
        {show ? "▾" : "▸"} Why the two sides disagree ({
          recon.by_type.reduce((a, b) => a + (b.n || 0), 0)} rows)
      </button>
      {show && (
        <div style={{ marginTop: 9, background: t.panel,
          border: `1px solid ${t.border}`, borderRadius: t.radius.md,
          padding: "11px 13px" }}>
          <div style={{ fontSize: 12, color: t.sub, lineHeight: 1.5,
            marginBottom: 9 }}>
            The workbook's own reconciliation, stored under its own
            classification rather than renamed — so a row here and a row
            there are the same row.
          </div>
          {recon.by_type.map((g) => (
            <div key={g.recon_type} style={{ fontSize: 12.5, marginBottom: 4 }}>
              <b>{g.n}</b> · {g.recon_type}
            </div>))}
          <div style={{ maxHeight: 260, overflowY: "auto", marginTop: 9 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
              <tbody>
                {recon.rows.slice(0, 300).map((r, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${t.border}33` }}>
                    <td style={{ padding: "4px 8px 4px 0", color: t.sub,
                      whiteSpace: "nowrap" }}>{r.feed_family}</td>
                    <td style={{ padding: "4px 8px" }}>{r.field_name}</td>
                    <td style={{ padding: "4px 0", color: t.sub }}>{r.detail}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>
        </div>)}
    </div>
  );
}

function Empty({ t, health }) {
  const missing = health && health.tables
    && Object.values(health.tables).every((n) => !n);
  return (
    <div style={{ maxWidth: 640, marginTop: 10, fontSize: 13, color: t.sub,
      lineHeight: 1.65 }}>
      <b style={{ color: t.text }}>No STAR field usage loaded.</b>
      <p style={{ margin: "9px 0" }}>
        This reads three sheets of the SEI crosswalk workbook —{" "}
        <code>STAR_FIELD_USAGE_MATRIX</code>,{" "}
        <code>STAR_FIELD_USAGE_SUMMARY</code> and{" "}
        <code>STAR_FIELD_USAGE_RECON</code>. {missing
          ? <>The tables do not exist yet: run <code>sql/65_star_field_usage.sql</code>,
            then re-run the <code>sei_crosswalk</code> ingestion step.</>
          : <>The tables exist but are empty — re-run the{" "}
            <code>sei_crosswalk</code> step against a workbook that has those
            sheets. If it has them and this is still empty, the loader logs
            the header row it actually found.</>}
      </p>
    </div>
  );
}
