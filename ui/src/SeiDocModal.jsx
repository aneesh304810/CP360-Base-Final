import React, { useEffect, useMemo, useRef, useState } from "react";
import { SEI_DOCS } from "./seiSourceDocs.js";
import { SEI_SOURCE_INDEX } from "./seiCitations.js";

// =====================================================================
// SeiDocModal — the SEI document in a popup, opened at a cited section.
//
// Works in three degrees, best available first:
//   1. the section text, with the whole document navigable beside it
//   2. the PDF itself at the right page, when one has been published
//      (tools/ingest_sei_docs.py --publish)
//   3. neither, in which case it says what to run rather than showing
//      an empty panel
// =====================================================================

export const hasSeiDoc = (docId) => SEI_DOCS.some((d) => d.id === docId);

/** A hyperlink that opens the document popup at a section. */
export function DocLink({ doc, section, children, onOpen, tone = "#0f4775" }) {
  return (
    <a href="#" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpen(doc, section); }}
      style={{ color: tone, textDecoration: "underline",
        textDecorationStyle: hasSeiDoc(doc) ? "solid" : "dotted",
        textUnderlineOffset: 2, cursor: "pointer", fontWeight: 600 }}
      title={hasSeiDoc(doc) ? "Open the document here" : "Not ingested yet — opens the citation"}>
      {children}
    </a>);
}

export default function SeiDocModal({ t, docId, sectionId, onClose }) {
  const doc = SEI_DOCS.find((d) => d.id === docId);
  const meta = SEI_SOURCE_INDEX[docId] || { title: docId };
  const [active, setActive] = useState(sectionId);
  const [q, setQ] = useState("");
  const bodyRef = useRef(null);

  useEffect(() => { setActive(sectionId); setQ(""); }, [docId, sectionId]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev; };
  }, [onClose]);

  // resolve the cited section, falling back to the nearest subsection
  const resolved = useMemo(() => {
    if (!doc) return null;
    const exact = doc.sections.find((s) => s.id === active);
    if (exact) return { sec: exact, approximate: false };
    const child = doc.sections.find((s) => s.id.startsWith(active + "."));
    return child ? { sec: child, approximate: true } : null;
  }, [doc, active]);

  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; }, [active]);

  const navy = t.navy || "#10193b";
  const panel = t.panel2 || "#dfe6e9";
  const sub = t.sub || "#666";

  const matches = useMemo(() => {
    if (!doc || q.trim().length < 2) return null;
    const needle = q.trim().toLowerCase();
    return doc.sections.filter((s) =>
      s.label.toLowerCase().includes(needle) || s.text.toLowerCase().includes(needle));
  }, [doc, q]);

  const list = matches || (doc ? doc.sections : []);

  const highlight = (text) => {
    if (!q.trim() || q.trim().length < 2) return text;
    const needle = q.trim();
    const parts = text.split(new RegExp(`(${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
    return parts.map((p, i) =>
      p.toLowerCase() === needle.toLowerCase()
        ? <mark key={i} style={{ background: "#fff2a8", color: "inherit" }}>{p}</mark>
        : p);
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(16,25,59,.55)", display: "flex",
        alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true"
        style={{ background: "#fff", borderRadius: 12, width: "min(1120px,100%)",
          height: "min(780px,100%)", display: "flex", flexDirection: "column",
          overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,.34)" }}>

        {/* header */}
        <div style={{ background: navy, color: "#fff", padding: "13px 18px",
          display: "flex", alignItems: "center", gap: 12, flex: "0 0 auto" }}>
          <div style={{ minWidth: 0 }}>
            <b style={{ fontSize: 13 }}>{meta.title}</b>
            {meta.version && <span style={{ fontSize: 10, color: "#a9c1de",
              marginLeft: 8 }}>v{meta.version}</span>}
            <div style={{ fontSize: 10, color: "#a9c1de", marginTop: 2 }}>
              {resolved
                ? <>{resolved.sec.label} · page {resolved.sec.page}
                    {resolved.approximate &&
                      <span style={{ color: "#ffc477" }}> · §{active} not found, nearest subsection</span>}</>
                : doc ? <>§{active} not found in this document</>
                      : <>not ingested</>}
            </div>
          </div>
          {doc && (
            <input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search this document…"
              style={{ marginLeft: "auto", fontSize: 11, padding: "6px 10px",
                borderRadius: 5, border: "1px solid #2c3a63", background: "#0b1230",
                color: "#fff", width: 220, fontFamily: "inherit" }} />)}
          {doc && doc.pdfUrl && resolved && (
            <a href={`${doc.pdfUrl}#page=${resolved.sec.page}`} target="_blank" rel="noreferrer"
              style={{ fontSize: 10, fontWeight: 800, padding: "6px 12px", borderRadius: 999,
                background: "#31bced", color: "#06263a", textDecoration: "none",
                whiteSpace: "nowrap" }}>
              open the PDF at p.{resolved.sec.page} ↗</a>)}
          <span onClick={onClose} title="Close (Esc)"
            style={{ cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "0 4px",
              color: "#a9c1de", marginLeft: doc ? 0 : "auto" }}>×</span>
        </div>

        {/* body */}
        {!doc ? (
          <div style={{ padding: 28, fontSize: 12, color: "#33414d", lineHeight: 1.7 }}>
            <b style={{ color: navy, fontSize: 13 }}>This document has not been ingested.</b>
            <p style={{ marginTop: 10 }}>
              The citation still stands — it points at <b>{meta.title}</b>
              {meta.version ? ` v${meta.version}` : ""}, <code>§{active}</code>. To read the
              words here, drop the file in and run the ingester:
            </p>
            <pre style={{ background: "#f4f8fb", borderRadius: 8, padding: "12px 14px",
              fontSize: 11, fontFamily: "Roboto Mono, monospace", overflowX: "auto" }}>
{`cp "${meta.expect || docId + ".pdf"}" sei-source/
python3 tools/ingest_sei_docs.py --publish`}</pre>
            <p style={{ color: sub, fontSize: 11 }}>
              {meta.covers}
            </p>
            <p style={{ color: sub, fontSize: 11 }}>
              <code>--publish</code> also copies the PDF where the browser can reach it, which
              turns the header into a direct link to the right page.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "236px minmax(0,1fr)",
            flex: "1 1 auto", minHeight: 0 }}>

            {/* section rail */}
            <div style={{ borderRight: `1px solid ${panel}`, overflowY: "auto",
              background: "#fafcfe" }}>
              <div style={{ padding: "9px 12px 6px", fontSize: 8.5, fontWeight: 800,
                letterSpacing: .4, color: sub, position: "sticky", top: 0,
                background: "#fafcfe" }}>
                {matches ? `${list.length} MATCHING SECTIONS` : `${list.length} SECTIONS`}
              </div>
              {list.map((s) => {
                const on = resolved && s.id === resolved.sec.id;
                return (
                  <div key={s.id} onClick={() => setActive(s.id)}
                    style={{ padding: "7px 12px", fontSize: 10.5, cursor: "pointer",
                      borderLeft: `3px solid ${on ? "#1168bd" : "transparent"}`,
                      background: on ? "#eaf3fb" : undefined,
                      color: on ? navy : "#33414d", fontWeight: on ? 700 : 400 }}>
                    {s.label}
                    <span style={{ float: "right", fontSize: 9, color: sub }}>p.{s.page}</span>
                  </div>);
              })}
              {!list.length && (
                <div style={{ padding: "10px 12px", fontSize: 10.5, color: sub }}>
                  Nothing matches “{q}”.</div>)}
            </div>

            {/* section text */}
            <div ref={bodyRef} style={{ overflowY: "auto", padding: "16px 20px 24px" }}>
              {resolved ? (
                <>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: navy,
                    marginBottom: 8 }}>{resolved.sec.label}</div>
                  {resolved.approximate && (
                    <div style={{ background: "#fdf6ec", borderLeft: "3px solid #a8560f",
                      borderRadius: 6, padding: "9px 12px", fontSize: 10.5,
                      color: "#33414d", marginBottom: 12, lineHeight: 1.6 }}>
                      The citation names <b>§{active}</b>, which this document does not
                      contain under that heading. This is <b>{resolved.sec.label}</b>, the
                      nearest subsection — it may not be the text the citation refers to.
                    </div>)}
                  <pre style={{ margin: 0, fontFamily: "Roboto Mono, monospace",
                    fontSize: 11, lineHeight: 1.7, color: "#22303c",
                    whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {highlight(resolved.sec.text)}</pre>
                </>
              ) : (
                <div style={{ fontSize: 11.5, color: "#33414d", lineHeight: 1.7 }}>
                  <b style={{ color: "#a8560f" }}>§{active} is not in this document.</b>
                  <p>The ingester splits on numbered clauses and appendix headings. If this
                  document numbers its headings differently, the section is still here —
                  pick it from the rail, or search for a phrase you expect to find in it.</p>
                  <p style={{ color: sub }}>
                    {doc.sections.length} sections were found across {doc.pages} pages
                    using the <b>{doc.backend}</b> backend.</p>
                </div>)}
            </div>
          </div>)}

        {/* footer */}
        <div style={{ flex: "0 0 auto", borderTop: `1px solid ${panel}`,
          padding: "8px 18px", fontSize: 10, color: sub, display: "flex", gap: 14 }}>
          <span>Esc or click outside to close</span>
          {doc && <span>{doc.sourceFile} · {doc.pages} pages · extracted with {doc.backend}</span>}
          <span style={{ marginLeft: "auto" }}>
            Citations are maintained in <code>ui/src/seiCitations.js</code></span>
        </div>
      </div>
    </div>);
}
