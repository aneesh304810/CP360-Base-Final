// The SEI crosswalk in three questions instead of nine verdicts.
//
// Does SEI have a datapoint for this field, would the value arrive the
// same, and who still has to decide. The nine verdicts are not replaced —
// they are added up, and every drill-down names the verdict a field
// carries, because a rollup nobody can trace back to the rule that
// produced it is a rollup nobody can act on.
//
// THE ARITHMETIC IS NOT HERE. /business-summary adds it up once, so the
// tiles, the bar and the panels cannot disagree with each other or with
// the list behind them. This component reads numbers; it does not compute
// them.
//
// COLOUR IS COMPUTED, NOT CHOSEN. The app's own status green (#159943) and
// orange (#e67e22) sit 2.7 ΔE apart under protanopia — a red-green
// colourblind reader cannot separate "ready" from "would arrive different"
// in the one bar that shows the whole estate. These steps were run through
// the palette validator and re-stepped to 11.3, with dark stepped
// separately against the dark surface rather than flipped. Every swatch
// carries a text label, so identity never rests on colour alone.

import React, { useEffect, useState } from "react";
import { crosswalkApi } from "./seiCrosswalkApi.js";
import { VERDICT_INFO } from "./crosswalkGlossary.js";

const C_LIGHT = { ready: "#1a8f4c", diff: "#e8a33d", open: "#6b7c8a",
                  none: "#c1113a", has: "#0091bf" };
const C_DARK = { ready: "#2ba05f", diff: "#e2a83a", open: "#7f8f9e",
                 none: "#df5a70", has: "#4fb8e8" };

// What each state is called in business words, and what it means.
export const STATE = {
  ready: { label: "Ready", blurb: "proven against the database" },
  diff:  { label: "Would arrive different",
           blurb: "rounded, cut, recoded or retyped" },
  open:  { label: "Not yet checked", blurb: "a fact the check needs is missing" },
  none:  { label: "SEI has nothing", blurb: "arrives empty on cutover day" },
};

// The four divergence reasons, in business words. The verdict itself is
// kept beside each one so the drill-down and the glossary still line up.
export const DIVERGENCE = {
  PRECISION_RISK: "The value would lose detail",
  DECODE_NEEDED:  "A code needs translating",
  TYPE_SHIFT:     "It changes kind",
  NOT_COMPARABLE: "Several things become one",
};

const isDark = () => {
  try {
    return typeof window !== "undefined" && window.matchMedia
      && window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch { return false; }
};

export default function SeiBusinessSummary({ t, dataSource, onDrill, onGlossary }) {
  const ds = (dataSource || "IMDS").toUpperCase();
  const [d, setD] = useState(null);
  const [showScope, setShowScope] = useState(false);
  const [dark, setDark] = useState(isDark);

  useEffect(() => {
    let live = true;
    setD(null);
    crosswalkApi.businessSummary(ds).then((r) => { if (live) setD(r); });
    return () => { live = false; };
  }, [ds]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const m = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => setDark(m.matches);
    m.addEventListener?.("change", on);
    return () => m.removeEventListener?.("change", on);
  }, []);

  const C = dark ? C_DARK : C_LIGHT;
  const muted = t.muted || "#7b8894", sub = t.sub || "#4a5a68";
  const panel = { background: t.panel || "#fff",
                  border: `1px solid ${t.panel2 || "#dfe6e9"}`,
                  borderRadius: 6, padding: "14px 16px" };

  if (!d) {
    return <div style={{ padding: 20, fontSize: 12, color: muted }}>
      Loading the crosswalk…</div>;
  }
  const total = d.scope.in_scope;
  if (!d.scored || !total) {
    return (
      <div style={{ ...panel, maxWidth: "66ch", marginBottom: 16 }}>
        <div style={{ fontSize: 12.5, fontWeight: 500 }}>Nothing scored here</div>
        <p style={{ margin: "6px 0 0", fontSize: 12.5, color: sub }}>
          {d.scope.out_of_scope} field{d.scope.out_of_scope === 1 ? "" : "s"} arrive
          on this warehouse and none is scored — the lane is not being replaced.
          Scoring it would report 100% “SEI has nothing” against something nobody
          is touching.</p>
      </div>);
  }

  const pct = (n) => Math.round((n / total) * 100);
  const b = d.buckets;
  const TILES = [
    ["has",  d.has_datapoint, "SEI has a datapoint", `${pct(d.has_datapoint)}% of fields in scope`],
    ["diff", b.diff, STATE.diff.label, STATE.diff.blurb],
    ["open", b.open, STATE.open.label,
     `${d.open.undecided} undecided · ${d.open.exceptions} exceptions`],
    ["none", b.none, STATE.none.label, STATE.none.blurb],
  ];
  const SEG = ["ready", "diff", "open", "none"]
    .map((k) => [k, b[k]]).filter(([, n]) => n > 0);
  const dmax = Math.max(...d.divergence.map((x) => x.n), 1);
  const omax = Math.max(...d.owners.map((x) => x.n), d.unowned, 1);

  // A bucket maps to the verdicts behind it, so a click lands on exactly
  // those columns and the list can name the rule each one carries.
  const VERDICTS = { ready: ["PROVEN_MATCH"], none: ["NO_SOURCE"],
    diff: ["NOT_COMPARABLE", "DECODE_NEEDED", "PRECISION_RISK", "TYPE_SHIFT"],
    open: ["UNKNOWN"] };
  const drillBucket = (k) => {
    if (k === "has" || (VERDICTS[k] || []).length > 1) {
      // No single verdict filter covers these, so the list is opened
      // unfiltered with the states named in its title rather than
      // pretending one verdict stands for four.
      onDrill?.({}, k === "has" ? "Every field SEI has proposed a datapoint for"
                                : STATE[k].label);
    } else {
      onDrill?.({ verdict: VERDICTS[k][0] }, STATE[k].label);
    }
  };

  const Bars = ({ rows, color }) => (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(92px,auto) 1fr auto",
      gap: "7px 10px", alignItems: "center", fontSize: 12 }}>
      {rows.map((r) => (
        <React.Fragment key={r.key}>
          <button type="button" onClick={r.onClick} title={r.title}
            style={{ font: "inherit", fontSize: 12, textAlign: "left", background: "none",
              border: 0, padding: 0, color: sub, cursor: r.onClick ? "pointer" : "default",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {r.label}</button>
          <span style={{ height: 12, background: t.bg || "#eef3f5", borderRadius: 3,
            overflow: "hidden" }}>
            <i style={{ display: "block", height: 12, borderRadius: "0 3px 3px 0",
              width: `${(r.n / r.max) * 100}%`, background: r.color || color }} /></span>
          <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 500,
            textAlign: "right", color: t.navy || "#10193b" }}>{r.n}</span>
        </React.Fragment>))}
    </div>);

  return (
    <div style={{ marginBottom: 16 }}>
      {/* The ceiling, in one line. It is the reason "ready" reads zero, and
          a dashboard that buries it invites the wrong conclusion. */}
      <div style={{ display: "flex", gap: 9, alignItems: "baseline", fontSize: 11.5,
        color: sub, background: t.panel || "#fff",
        border: `1px solid ${t.panel2 || "#dfe6e9"}`, borderLeft: `3px solid ${C.diff}`,
        borderRadius: 4, padding: "9px 13px", marginBottom: 14, lineHeight: 1.55 }}>
        <b style={{ color: C.diff, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6,
          textTransform: "uppercase", flexShrink: 0 }}>Note</b>
        <span>Nothing can read “ready” yet. The target's shape comes from a data
          dictionary, and a document describing a database cannot prove what it
          holds — one column-list extract lifts that for every field at once.
          {onGlossary && <> <button type="button" onClick={() => onGlossary("PROVEN_MATCH")}
            style={{ font: "inherit", fontSize: 11.5, background: "none", border: 0,
              padding: 0, color: t.accent || "#0f4775", cursor: "pointer",
              textDecoration: "underline" }}>what the tags mean</button></>}</span>
      </div>

      <div style={{ display: "grid", gap: 10, marginBottom: 14,
        gridTemplateColumns: "repeat(auto-fit,minmax(168px,1fr))" }}>
        {TILES.map(([k, n, label, note]) => (
          <button key={k} type="button" onClick={() => drillBucket(k)}
            style={{ ...panel, padding: "13px 15px", textAlign: "left", font: "inherit",
              color: "inherit", cursor: "pointer", position: "relative",
              overflow: "hidden" }}>
            <i style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
              background: C[k] }} />
            <div style={{ fontSize: 29, fontWeight: 500, letterSpacing: "-.025em",
              lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{n}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12,
              marginTop: 3 }}>
              <i style={{ width: 9, height: 9, borderRadius: 2, background: C[k],
                flexShrink: 0 }} />{label}</div>
            <div style={{ fontSize: 11, color: muted, marginTop: 3 }}>{note}</div>
          </button>))}
      </div>

      <div style={{ display: "grid", gap: 12, marginBottom: 12,
        gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,290px),1fr))" }}>
        <div style={panel}>
          <div style={{ fontSize: 12.5, fontWeight: 500 }}>
            Where the {total} fields stand</div>
          <div style={{ fontSize: 11, color: muted, marginBottom: 11 }}>
            One field, one state — the first rule that stopped it</div>
          <div style={{ display: "flex", height: 30, gap: 2, marginBottom: 9 }}>
            {SEG.map(([k, n], i) => (
              <button key={k} type="button" onClick={() => drillBucket(k)}
                title={`${STATE[k].label} — ${n} fields, ${pct(n)}%`}
                style={{ border: 0, padding: 0, cursor: "pointer", flex: n,
                  minWidth: 4, background: C[k], position: "relative",
                  borderRadius: i === 0 ? "4px 0 0 4px"
                    : i === SEG.length - 1 ? "0 4px 4px 0" : 0 }}>
                {pct(n) >= 8 && <b style={{ position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, color: "#fff",
                  fontVariantNumeric: "tabular-nums" }}>{n}</b>}
              </button>))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "7px 15px",
            fontSize: 11, color: sub, alignItems: "center" }}>
            {["ready", "diff", "open", "none"].map((k) => (
              <span key={k}><i style={{ display: "inline-block", width: 9, height: 9,
                borderRadius: 2, marginRight: 6, verticalAlign: -1,
                background: C[k] }} />{STATE[k].label} {b[k]}</span>))}
          </div>
        </div>

        <div style={panel}>
          <div style={{ fontSize: 12.5, fontWeight: 500 }}>Why they would differ</div>
          <div style={{ fontSize: 11, color: muted, marginBottom: 11 }}>
            {b.diff} fields SEI can supply, differently</div>
          {d.divergence.length ? (
            <Bars color={C.diff} rows={d.divergence.map((x) => ({
              key: x.verdict, n: x.n, max: dmax,
              label: DIVERGENCE[x.verdict] || x.verdict,
              title: (VERDICT_INFO[x.verdict] || {}).short || "",
              onClick: () => onDrill?.({ verdict: x.verdict },
                DIVERGENCE[x.verdict] || x.verdict) }))} />
          ) : <div style={{ fontSize: 12, color: muted }}>
                Nothing diverges on this lane.</div>}
        </div>
      </div>

      <div style={panel}>
        <div style={{ fontSize: 12.5, fontWeight: 500 }}>Who it waits on</div>
        <div style={{ fontSize: 11, color: muted, marginBottom: 11 }}>
          Open items by the team named against them</div>
        <Bars color={t.accent || "#0f4775"} rows={[
          ...d.owners.map((o) => ({ key: o.owner, label: o.owner, n: o.n, max: omax })),
          // Not attributed to the nearest team. SEI_VERIFY has no owner
          // column, so an unchecked field genuinely has nobody named
          // against it, and that is a finding rather than a rounding.
          ...(d.unowned ? [{ key: "__none", label: "No owner named", n: d.unowned,
            max: omax, color: C.none,
            title: "Mostly unchecked columns — the register records no owner "
                 + "for them", onClick: () => drillBucket("open") }] : []),
        ]} />
      </div>

      {Boolean(d.scope.out_of_scope || d.scope.no_baseline) && (
        <div style={{ marginTop: 10 }}>
          <button type="button" onClick={() => setShowScope((v) => !v)}
            style={{ font: "inherit", fontSize: 11, background: "none", border: 0,
              padding: 0, color: t.accent || "#0f4775", cursor: "pointer",
              textDecoration: "underline" }}>
            {showScope ? "Hide what is excluded"
              : `Show what is excluded (${d.scope.out_of_scope + d.scope.no_baseline})`}
          </button>
          {showScope && (
            <div style={{ ...panel, marginTop: 8 }}>
              <Bars color={muted} rows={[
                { key: "oos", label: "Out of scope", n: d.scope.out_of_scope,
                  max: Math.max(d.scope.out_of_scope, d.scope.no_baseline, 1),
                  onClick: () => onDrill?.({ verdict: "OUT_OF_SCOPE" }, "Out of scope") },
                { key: "nb", label: "No baseline", n: d.scope.no_baseline,
                  max: Math.max(d.scope.out_of_scope, d.scope.no_baseline, 1),
                  onClick: () => onDrill?.({ verdict: "NO_BASELINE" }, "No baseline") },
              ]} />
              <p style={{ fontSize: 11, color: muted, margin: "9px 0 0" }}>
                On a lane nobody is replacing, or with nothing feeding the column
                today either. Neither is a SEI finding, and both are counted here
                rather than dropped from the denominator.</p>
            </div>)}
        </div>)}

      {/* A verdict the register grew that nobody has bucketed. Named rather
          than quietly missing from the bar. */}
      {(d.unbucketed || []).length > 0 && (
        <p style={{ fontSize: 11, color: muted, marginTop: 10 }}>
          Counted under “not yet checked” because no bucket claims them yet:{" "}
          {d.unbucketed.map((u) => `${u.verdict} (${u.n})`).join(", ")}.</p>)}
    </div>);
}
