// Release delivery — its own screen, under Governance.
//
// IT MOVED OUT OF DEVOPS 360 FOR ONE REASON. DevOps 360 is the design of
// the delivery system: C4 maps, pipelines, what a version is. This is the
// operational answer to "what is live where", which is a governance
// question asked by people who never open an architecture page. Two
// audiences, two screens; DevOps 360 keeps the map and links here.
//
// DEMO IS OPT-IN AND LABELLED. The live screen stays empty when
// guardrail_deployment has no rows, because empty is the honest state.
// But empty is indistinguishable from broken to anyone seeing the
// dashboard for the first time, so a demo toggle fills it with rows shaped
// to the naming standard - with a banner that never goes away while it is
// on, and figures that nobody can mistake for live.

import React, { useEffect, useState } from "react";
import { Dashboard } from "./DevOps360.jsx";
import promotionApi from "./guardrails_api_additions.js";
import { DEMO_ENVS, DEMO_HIST, DEMO_RELS, DEMO_NOTE } from "./releaseDemoData.js";

export default function ReleaseDelivery({ t }) {
  const [envs, setEnvs] = useState([]);
  const [hist, setHist] = useState([]);
  const [rels, setRels] = useState([]);
  const [live, setLive] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    let on = true;
    promotionApi.deployments().then((d) => {
      if (!on) return;
      setEnvs(d.environments || []);
      setHist(d.history || []);
      setLive(!d.unreachable && (d.history || []).length > 0);
      setLoaded(true);
    });
    promotionApi.releases().then((d) => { if (on) setRels(d.releases || []); });
    return () => { on = false; };
  }, []);

  // Demo never overlays live rows. If the table has data, the toggle is
  // not offered at all - there is nothing worse than a dashboard where
  // some rows are real and some are not.
  const canDemo = loaded && !live;
  const showDemo = canDemo && demo;
  const vEnvs = showDemo ? DEMO_ENVS : envs;
  const vHist = showDemo ? DEMO_HIST : hist;
  const vRels = showDemo ? DEMO_RELS : rels;

  return (
    <div style={{ padding: "20px 24px 60px", maxWidth: 1260 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10,
        flexWrap: "wrap" }}>
        <div style={{ fontSize: 22, fontWeight: 500, color: t.text }}>
          Release Delivery</div>
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: .5,
          borderRadius: 999, padding: "2px 9px",
          background: showDemo ? "#fdf2e3" : live ? "#e8f6ed" : "#f1f4f7",
          color: showDemo ? "#a8560f" : live ? "#15803d" : "#6b7884" }}>
          {showDemo ? "◐ DEMO ROWS" : live ? "● LIVE" : "○ NO ROWS YET"}</span>
        {canDemo && (
          <span onClick={() => setDemo(!demo)} style={{ cursor: "pointer",
            fontSize: 10.5, fontWeight: 700, padding: "4px 11px",
            borderRadius: 999, border: `1px solid ${t.border}`,
            color: t.accent, background: t.panel }}>
            {demo ? "show the real (empty) table" : "fill with demo rows"}</span>)}
      </div>

      <div style={{ fontSize: 13, color: t.sub, maxWidth: "80ch",
        lineHeight: 1.6, margin: "4px 0 14px" }}>
        What is deployed where, and how it got there. The rows are{" "}
        <b style={{ color: t.text }}>guardrail_deployment</b>, filtered and
        exportable as CSV. For the delivery system itself — the pipelines,
        what a version is, how promotion works — see{" "}
        <b style={{ color: t.text }}>DevOps 360</b>; for the gate matrix and
        the changeset compare, <b style={{ color: t.text }}>Quality
        Guardrails → Releases</b>.
      </div>

      {showDemo && (
        <div style={{ background: "#fdf7f0", border: "1px solid #e8c9a6",
          borderLeft: "3px solid #e67e22", borderRadius: "0 6px 6px 0",
          padding: "10px 14px", marginBottom: 14, fontSize: 12.5,
          color: "#33414d", lineHeight: 1.6, maxWidth: "88ch" }}>
          <b style={{ color: "#a8560f" }}>Demo rows.</b> {DEMO_NOTE.replace(
            "Demo rows. ", "")} They are shaped deliberately: PROD sits two
          releases behind QC, which is the normal state rather than a backlog;
          one environment has schema ahead of code, the direction
          expand-and-contract makes safe; one release is blocked on a CVE and
          one deployment was rolled back, because a dashboard that is only
          ever green teaches nobody what red looks like.
        </div>)}

      <Dashboard t={t} live={showDemo ? false : live} envs={vEnvs}
        hist={vHist} rels={vRels} onPick={() => {}} />
    </div>);
}
