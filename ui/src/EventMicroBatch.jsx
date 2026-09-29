// Micro-batch markers: the commit boundary, and how to consume it.
//
// These are not catalog events and the specification says so in its own
// column. They carry ids 1000 and 1001, clear of the catalog's 1..105, and
// they arrive on every subscribed domain topic rather than on one. What
// they are FOR is the thing prose keeps failing to convey: a Snowflake
// commit is atomic across topics, and a consumer that reads one topic to
// its end marker and declares itself consistent has read a third of a
// transaction.
//
// So the diagram is the point of this screen, not decoration. Three lanes,
// time left to right, and the one line that carries the meaning: the batch
// is complete when the LAST topic gets its end marker, not the first. The
// table underneath is the same four rows the workbook holds, led by what a
// consumer should do rather than by what the marker is called.

import React, { useEffect, useState } from "react";
import { evt360 } from "./event360_api_additions.js";

// Event 360's own palette, imported rather than re-declared, so this tab
// cannot drift from the five beside it. Marker green is TC.Marker — the
// same hue the estate uses for a Marker event, validated all-pairs there.
//
// From eventPalette, NOT from Event360: Event360 imports this file, so
// importing back from it is a cycle, and reading P at module top level
// then hits the temporal dead zone at runtime.
import { P, TC } from "./eventPalette.js";

const MONO = P.mono;

/* ------------------------------------------------------------- diagram */
// Depicts the mechanism the four rows describe between them: markers open
// and close a boundary per topic, a topic may carry no data events at all,
// and consistency is only claimable once every subscribed topic has closed.
function Lifecycle() {
      // One hue carries the claim — where the batch actually becomes complete.
  const gate = P.danger;
    const mk = TC.Marker;

  const LANES = [
    { y: 64,  name: "positions",    events: [232, 286, 340], end: 420 },
    { y: 122, name: "transactions", events: [252],           end: 500 },
    { y: 180, name: "reference",    events: [],              end: 392 },
  ];
  const X0 = 150, START = 176, DONE = 500;

  return (
    <figure style={{ margin: "0 0 14px" }}>
      <svg viewBox="0 0 700 240" role="img"
        style={{ width: "100%", maxWidth: "100%", height: "auto",
                 display: "block", color: P.ink }}
        aria-label={"Three subscribed topics receive a start marker for the same "
          + "micro-batch key. Data events follow on two of them; the reference "
          + "topic receives none, which is still a valid complete topic. Each "
          + "topic closes with its own end marker, and the batch is only "
          + "complete once the last topic has closed."}>
        <defs>
          <marker id="mbArrow" viewBox="0 0 8 8" refX="7" refY="4"
            markerWidth="7" markerHeight="7" orient="auto">
            <polygon points="0,1 8,4 0,7" fill={P.sub} />
          </marker>
        </defs>

        {/* time */}
        <line x1={X0} y1={216} x2={660} y2={216} stroke={P.sub}
          strokeWidth="1" markerEnd="url(#mbArrow)" />
        <text x={X0} y={232} fontSize="10.5" fill={P.sub}>time</text>

        {/* the region in which nothing may be declared consistent */}
        <rect x={START} y={40} width={DONE - START} height={160}
          fill={gate} opacity="0.05" />

        {LANES.map((l) => (
          <g key={l.name}>
            <text x={X0 - 10} y={l.y + 4} fontSize="11.5" textAnchor="end"
              fill={P.ink}>{l.name}</text>
            <line x1={X0} y1={l.y} x2={660} y2={l.y} stroke={P.rule}
              strokeWidth="1" />
            {/* start marker */}
            <rect x={START - 5} y={l.y - 11} width="10" height="22" rx="2"
              fill={mk} />
            {/* data events */}
            {l.events.map((x) => (
              <circle key={x} cx={x} cy={l.y} r="5" fill={P.accent} />))}
            {!l.events.length && (
              <text x={START + 34} y={l.y + 4} fontSize="10.5" fill={P.sub}
                fontStyle="italic">no data events — still a complete topic</text>)}
            {/* end marker */}
            <rect x={l.end - 5} y={l.y - 11} width="10" height="22" rx="2"
              fill={mk} />
          </g>))}

        {/* the claim */}
        <line x1={DONE} y1={30} x2={DONE} y2={204} stroke={gate}
          strokeWidth="2" strokeDasharray="5 3" />
        <text x={DONE + 8} y={34} fontSize="11.5" fontWeight="700" fill={gate}>
          batch complete</text>
        <text x={DONE + 8} y={49} fontSize="10.5" fill={P.sub}>
          last topic closed</text>

        <text x={START} y={28} fontSize="10.5" fill={mk} textAnchor="middle"
          fontWeight="700">1000</text>
        <text x={START} y={14} fontSize="10" fill={P.sub} textAnchor="middle">
          start</text>
        <text x={392} y={202} fontSize="10.5" fill={mk} textAnchor="middle"
          fontWeight="700">1001</text>
        <text x={392} y={215} fontSize="10" fill={P.sub} textAnchor="middle">
          end (this topic only)</text>
      </svg>
      <figcaption style={{ fontSize: 11.5, color: P.sub,
        lineHeight: 1.6, marginTop: 4 }}>
        One micro-batch key, three subscribed topics. Every topic opens with
        marker <b>1000</b> and closes with <b>1001</b>. The reference topic
        carries no data events, which is a complete topic and not a gap. The
        batch is consistent only at the red line — when the <i>last</i> topic
        closes. A consumer that declares itself done at its own end marker
        has read part of a transaction.
      </figcaption>
    </figure>);
}

/* --------------------------------------------------------------- panel */
export default function EventMicroBatch() {
  const [d, setD] = useState(null);

  useEffect(() => {
    let live = true;
    evt360.microBatch().then((r) => { if (live) setD(r); });
    return () => { live = false; };
  }, []);

  const card = { background: P.panel,
    border: `1px solid ${P.rule}`, borderRadius: 8,
    padding: "16px 18px", marginBottom: 14 };
  const muted = P.sub, sub = P.sub;
  const eyebrow = { fontSize: 9.5, fontWeight: 800, letterSpacing: 0.6,
    textTransform: "uppercase", color: muted };

  if (!d) return <div style={{ padding: 20, fontSize: 12, color: muted }}>
    Loading the commit boundary…</div>;

  return (
    <div>
      <div style={card}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500,
          color: P.ink }}>The commit boundary</h3>
        <p style={{ fontSize: 13, color: sub, lineHeight: 1.6,
          margin: "7px 0 14px", maxWidth: "76ch" }}>
          A Snowflake commit can touch several topics at once. Markers 1000
          and 1001 bracket one commit on one topic, and the same micro-batch
          key appears on every topic the commit touched — so the markers are
          how a consumer knows it has the <i>whole</i> change and not part of
          one. They are not catalog events and never appear in the event
          count.
        </p>
        <Lifecycle />
      </div>

      {/* NOT LOADED IS NOT THE SAME AS NONE. The table comes from sql/63 and
          the workbook's Micro_Batch_Markers sheet; either can be absent, and
          saying "no markers" would be a claim about the specification. */}
      {!d.loaded ? (
        <div style={{ ...card, borderLeft: `3px solid ${P.warn}` }}>
          <div style={eyebrow}>Not loaded</div>
          <p style={{ fontSize: 12.5, color: sub, margin: "6px 0 0",
            lineHeight: 1.6, maxWidth: "76ch" }}>
            The marker table is empty or absent, so this page cannot say what
            the markers are — which is different from there being none. Run{" "}
            <span style={{ fontFamily: MONO }}>sql/63_micro_batch_markers.sql</span>,
            check the workbook has a{" "}
            <span style={{ fontFamily: MONO }}>Micro_Batch_Markers</span> sheet,
            then{" "}
            <span style={{ fontFamily: MONO }}>python -m ingestion.run event360</span>.
            The diagram above is the specification and stands either way.
          </p>
        </div>
      ) : (<>
        <div style={card}>
          <div style={{ ...eyebrow, marginBottom: 10 }}>
            The markers · {d.markers.length}</div>
          {d.markers.map((m) => (
            <div key={m.entry_key} style={{ display: "flex", gap: 14,
              alignItems: "flex-start", padding: "11px 0",
              borderTop: `1px solid ${P.rule}` }}>
              <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700,
                color: TC.Marker, minWidth: 46, flexShrink: 0 }}>
                {m.marker_id}</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                  {m.marker_name}</div>
                <div style={{ fontSize: 12.5, color: sub, marginTop: 2 }}>
                  {m.purpose}</div>
                {/* What to DO leads over what it is called. A marker nobody
                    acts on is a message, not a boundary. */}
                {m.consumer_handling && (
                  <div style={{ fontSize: 12.5, marginTop: 7, padding: "7px 11px",
                    background: P.page, borderRadius: 4,
                    borderLeft: `2px solid ${P.accent}`,
                    color: sub, lineHeight: 1.55 }}>
                    <b style={{ color: P.accent, fontSize: 9.5,
                      letterSpacing: 0.5, textTransform: "uppercase" }}>
                      What to do</b>{" "}{m.consumer_handling}</div>)}
                <div style={{ fontSize: 11, color: muted, marginTop: 6 }}>
                  Published on {m.published_where} · payload{" "}
                  <span style={{ fontFamily: MONO }}>{m.payload_fields}</span>
                  {m.catalog_event === "N" && " · not a catalog event"}</div>
              </span>
            </div>))}
        </div>

        {d.rules.length > 0 && (
          <div style={card}>
            <div style={{ ...eyebrow, marginBottom: 4 }}>
              Rules · {d.rules.length}</div>
            <p style={{ fontSize: 11.5, color: muted, margin: "0 0 8px" }}>
              Conditions a consumer has to satisfy before declaring a batch
              complete. These are not markers and arrive on no topic.</p>
            {d.rules.map((r) => (
              <div key={r.entry_key} style={{ padding: "11px 0",
                borderTop: `1px solid ${P.rule}` }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                  {r.marker_name}</div>
                <div style={{ fontSize: 12.5, color: sub, marginTop: 2 }}>
                  {r.purpose}</div>
                {r.consumer_handling && (
                  <div style={{ fontSize: 12.5, marginTop: 7, padding: "7px 11px",
                    background: P.page, borderRadius: 4,
                    borderLeft: `2px solid ${P.danger}`, color: sub,
                    lineHeight: 1.55 }}>
                    <b style={{ color: P.danger, fontSize: 9.5,
                      letterSpacing: 0.5, textTransform: "uppercase" }}>
                      What to do</b>{" "}{r.consumer_handling}</div>)}
                <div style={{ fontSize: 11, color: muted, marginTop: 6 }}>
                  Applies to {r.published_where} · keyed on{" "}
                  <span style={{ fontFamily: MONO }}>{r.payload_fields}</span></div>
              </div>))}
          </div>)}

        {/* A contract statement with no citation is an assertion. */}
        {(d.sources || []).length > 0 && (
          <div style={{ fontSize: 11, color: muted, lineHeight: 1.6 }}>
            Source: {d.sources.join(" · ")}
          </div>)}
      </>)}
    </div>);
}
