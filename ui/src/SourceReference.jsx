import React, { useState } from "react";
import { SEI_DOCS } from "./seiSourceDocs.js";
import { SEI_CITATIONS, SEI_SOURCE_INDEX, CITE_KIND } from "./seiCitations.js";

// =====================================================================
// SourceReference — the design on the left, the SEI document that
// governs it on the right. Reached from any L3 component row.
//
// The citation map works before the PDFs are ingested: each citation
// carries what that section says, from the review. Ingesting adds the
// source text beneath it. A component with no citation is not an
// oversight — for the 23 additions it is the evidence for the gap.
// =====================================================================

export const citationsFor = (c) =>
  SEI_CITATIONS[c.arId] || SEI_CITATIONS[c.id] || [];

const docById = (id) => SEI_DOCS.find((d) => d.id === id);

const sectionText = (docId, sectionId) => {
  const d = docById(docId);
  if (!d) return null;
  const exact = d.sections.find((s) => s.id === sectionId);
  if (exact) return { doc: d, sec: exact };
  // "6" should also find "6.1" when the document numbers finer than the citation
  const child = d.sections.find((s) => s.id.startsWith(sectionId + "."));
  return child ? { doc: d, sec: child, approximate: true } : null;
};

export default function SourceReference({ t, comp, finding, coverage, onBack }) {
  const [openSec, setOpenSec] = useState(null);
  const navy = t.navy || "#10193b";
  const panel = t.panel2 || "#dfe6e9";
  const sub = t.sub || "#666";
  const cites = citationsFor(comp);
  const ingested = SEI_DOCS.length > 0;

  const chip = (bg, fg, txt) => (
    <span style={{ fontSize: 8.5, fontWeight: 800, padding: "2px 8px",
      borderRadius: 999, background: bg, color: fg, whiteSpace: "nowrap" }}>{txt}</span>);

  const Fld = ({ k, v, tone }) => v ? (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: .4,
        color: tone || sub }}>{k.toUpperCase()}</div>
      <div style={{ fontSize: 11, color: "#33414d", lineHeight: 1.6,
        marginTop: 2 }}>{v}</div>
    </div>) : null;

  return (
    <div>
      {onBack}
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: navy,
        color: "#fff", borderRadius: 10, padding: "13px 20px", marginBottom: 12 }}>
        <span style={{ fontFamily: "Roboto Mono, monospace", fontSize: 12,
          fontWeight: 700, color: "#a9c1de" }}>#{comp.id}</span>
        <div><b>{comp.component}</b>
          <div style={{ fontSize: 10, color: "#a9c1de", marginTop: 2 }}>
            {comp.plane} · side by side with the SEI source</div></div>
        <div style={{ marginLeft: "auto", textAlign: "center", fontSize: 10,
          color: "#a9c1de" }}>
          <b style={{ display: "block", fontSize: 20, color: "#fff" }}>{cites.length}</b>
          {cites.length === 1 ? "citation" : "citations"}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.25fr)",
        gap: 12, alignItems: "start" }}>

        {/* ---------------- left: the design ---------------- */}
        <div style={{ background: "#fff", border: `1px solid ${panel}`,
          borderRadius: 10, padding: "14px 16px", position: "sticky", top: 12 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: .4,
            color: "#1168bd" }}>THE DESIGN</div>
          <Fld k="deliverable" v={comp.deliverable} />
          <Fld k="technology" v={`${comp.technology} · custom build ${comp.custom} · ${comp.priority}`} />
          {comp.isNew && <>
            <Fld k="performance" v={comp.perf} tone="#a8560f" />
            <Fld k="error handling" v={comp.err} tone="#cc3344" />
          </>}
          {finding && <>
            <Fld k={`finding · ${finding.verdict}`} v={finding.finding} tone="#cc3344" />
            <Fld k="action" v={finding.action} tone="#159943" />
          </>}
          {coverage && <>
            <Fld k="recommendation" v={coverage.rec} tone="#0b5e83" />
            {coverage.ask && <Fld k={coverage.owner === "SEI" ? "ask SEI" : "ask — both sides"}
              v={coverage.ask} tone="#6d3ac0" />}
          </>}
        </div>

        {/* ---------------- right: the source ---------------- */}
        <div style={{ display: "grid", gap: 10 }}>
          {!cites.length && (
            <div style={{ background: "#fff", border: `1px solid ${panel}`,
              borderLeft: "3px solid #8a97a3", borderRadius: 10, padding: "14px 16px",
              fontSize: 11, color: "#33414d", lineHeight: 1.65 }}>
              <b style={{ color: navy }}>No citation recorded.</b> Either this component
              is BBH platform work the SEI pack was never going to cover, or the mapping
              has not been written yet. Citations are hand-maintained in{" "}
              <code>ui/src/seiCitations.js</code> — adding one is a four-line entry.
            </div>)}

          {cites.map((c, i) => {
            const [kc, klabel] = CITE_KIND[c.kind];
            const src = SEI_SOURCE_INDEX[c.doc] || { title: c.doc };
            const hit = sectionText(c.doc, c.section);
            const key = `${c.doc}:${c.section}:${i}`;
            const isOpen = openSec === key;
            return (
              <div key={key} style={{ background: "#fff", border: `1px solid ${panel}`,
                borderLeft: `3px solid ${kc}`, borderRadius: 10, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center",
                    flexWrap: "wrap" }}>
                    <b style={{ fontSize: 11.5, color: navy }}>{src.title}</b>
                    {src.version && chip("#eef3f8", "#0f4775", "v" + src.version)}
                    <code style={{ fontFamily: "Roboto Mono, monospace", fontSize: 10,
                      color: "#0f4775" }}>
                      {c.section === "front" ? "whole document" : "§" + c.section}</code>
                    <span style={{ marginLeft: "auto" }}>{chip(kc + "1f", kc,
                      klabel.toUpperCase())}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#33414d", lineHeight: 1.6,
                    marginTop: 7 }}>{c.what}</div>
                  {c.conflict && (
                    <div style={{ fontSize: 11, color: "#33414d", lineHeight: 1.6,
                      marginTop: 8, background: "#fdf1f2", borderRadius: 6,
                      padding: "9px 11px" }}>
                      <b style={{ color: "#cc3344" }}>disagreement: </b>{c.conflict}</div>)}
                </div>

                {hit ? (
                  <div style={{ borderTop: "1px solid #eef1f4" }}>
                    <div onClick={() => setOpenSec(isOpen ? null : key)}
                      style={{ padding: "8px 16px", cursor: "pointer", fontSize: 10.5,
                        fontWeight: 700, display: "flex", gap: 8, alignItems: "center",
                        color: hit.approximate ? "#a8560f" : "#0f4775",
                        background: hit.approximate ? "#fdf6ec" : "#f7fafc" }}>
                      <span>{isOpen ? "−" : "+"}</span>
                      {hit.approximate
                        ? <span>§{c.section} not found — {isOpen ? "hiding" : "showing"}{" "}
                            <b>{hit.sec.label}</b>, the nearest subsection. It may not be
                            the text this citation refers to.</span>
                        : <span>{isOpen ? "hide" : "read"} the source — {hit.sec.label}</span>}
                      <span style={{ marginLeft: "auto", fontWeight: 500, color: sub,
                        whiteSpace: "nowrap" }}>
                        p.{hit.sec.page} · {hit.sec.text.length.toLocaleString()} chars</span>
                    </div>
                    {isOpen && (
                      <pre style={{ margin: 0, padding: "12px 16px 16px",
                        fontFamily: "Roboto Mono, monospace", fontSize: 10.5,
                        lineHeight: 1.65, color: "#22303c", whiteSpace: "pre-wrap",
                        wordBreak: "break-word", maxHeight: 520, overflow: "auto",
                        background: "#fbfdfe" }}>{hit.sec.text}</pre>)}
                  </div>
                ) : (
                  <div style={{ borderTop: "1px solid #eef1f4", padding: "9px 16px",
                    fontSize: 10.5, color: sub, background: "#f7fafc" }}>
                    {ingested
                      ? <>Section <code>{c.section}</code> was not found in the ingested{" "}
                        <b>{src.title}</b>. The heading pattern may differ — the document
                        is still readable whole from the picker below.</>
                      : <>Source text not ingested. Drop <code>{src.expect}</code> into{" "}
                        <code>sei-source/</code> and run{" "}
                        <code>python3 tools/ingest_sei_docs.py</code> to read it here.</>}
                  </div>)}
              </div>);
          })}

          {ingested && (
            <div style={{ background: "#fff", border: `1px solid ${panel}`,
              borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: .4,
                color: sub, marginBottom: 6 }}>INGESTED DOCUMENTS</div>
              {SEI_DOCS.map((d) => (
                <div key={d.id} style={{ fontSize: 10.5, color: "#33414d",
                  padding: "3px 0" }}>
                  <b style={{ color: navy }}>{d.title}</b>
                  {d.version ? ` v${d.version}` : ""} — {d.pages} pages,{" "}
                  {d.sections.length} sections
                </div>))}
            </div>)}
        </div>
      </div>
    </div>);
}
