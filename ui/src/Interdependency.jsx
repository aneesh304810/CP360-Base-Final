import React, { useState, useEffect } from "react";
import { api } from "./api.js";

// Feed / Loader interdependency — swimlane flow + hub view toggle.
// Backed by /data360/feed-graph and /data360/loader-graph (shared-key edges
// with business descriptions + match/mismatch validation).

const DOM_COLORS = ["#0091bf", "#159943", "#7c3aed", "#0f4775", "#e67e22", "#0d9488", "#c1113a", "#5f87a7"];
function domColor(domains, d) {
  const i = domains.indexOf(d);
  return DOM_COLORS[i % DOM_COLORS.length] || "#5f6f8f";
}
const NW = 158, NH = 40;

export default function Interdependency({ t, kind = "feed" }) {
  const [graph, setGraph] = useState({ nodes: [], edges: [], hubs: [] });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("swim"); // swim | hub
  const [domFilter, setDomFilter] = useState(null);
  const [sel, setSel] = useState(null);     // {type:'feed'|'edge'|'hub', ...}
  const [hubFocus, setHubFocus] = useState(null);
  const [full, setFull] = useState(false);
  const [collapsedLanes, setCollapsedLanes] = useState({});
  const [showWithin, setShowWithin] = useState(false);

  useEffect(() => {
    setLoading(true);
    const fn = kind === "loader" ? api.loaderGraph : api.feedGraph;
    fn(domFilter).then((g) => {
      setGraph(g && g.nodes ? g : { nodes: [], edges: [], hubs: [] });
      setLoading(false);
    });
    setSel(null); setHubFocus(null);
  }, [kind, domFilter]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setFull(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const domains = [...new Set(graph.nodes.map((n) => n.domain))];
  const nodeById = (id) => graph.nodes.find((n) => n.id === id);
  const label = kind === "loader" ? "loaders" : "feeds";

  const wrapStyle = full
    ? { position: "fixed", inset: 0, zIndex: 200, background: t.panel }
    : { position: "relative", background: t.panel, border: `1px solid ${t.border}`, borderRadius: t.radius.md };

  return (
    <div>
      <p style={{ fontSize: 13, color: t.sub, margin: "0 0 12px", maxWidth: 1000 }}>
        How inbound {label} relate through shared <b>key fields</b> (account_number, portfolio_id, client_id, form_id…).
        Toggle <b>Swimlane</b> (flow by domain) and <b>Hub</b> (keys as hubs). Click a {kind}, edge, or hub to see the
        connection story and the linking field's business meaning.
      </p>

      {/* toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>VIEW:</span>
        <Chip t={t} active={view === "swim"} onClick={() => { setView("swim"); setSel(null); setHubFocus(null); }} label="Swimlane flow" />
        <Chip t={t} active={view === "hub"} onClick={() => { setView("hub"); setSel(null); setHubFocus(null); }} label="Hub view" />
        <span style={{ width: 1, height: 20, background: t.border, margin: "0 4px" }} />
        <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>DOMAIN:</span>
        <Chip t={t} active={!domFilter} onClick={() => setDomFilter(null)} label="All" />
        {domains.map((d) => (
          <Chip key={d} t={t} active={domFilter === d} onClick={() => setDomFilter(d)}
            dot={domColor(domains, d)} label={d} />
        ))}
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div style={{ ...wrapStyle, flex: 1, minWidth: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
            borderBottom: `1px solid ${t.border}`, background: t.bg }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", color: t.sub }}>
              {view === "swim" ? `${label} flow — swimlanes by domain`
                : hubFocus ? `Hub: ${hubFocus}` : "Key hubs — overview"}
            </span>
            {view === "swim" && (
              <span style={{ marginLeft: 14, display: "inline-flex", gap: 6 }}>
                <button onClick={() => setCollapsedLanes(Object.fromEntries(domains.map((d) => [d, true])))}
                  style={{ border: `1px solid ${t.border}`, background: t.panel, borderRadius: t.radius.md,
                    cursor: "pointer", fontSize: 11, padding: "3px 9px", color: t.sub }}>Collapse all</button>
                <button onClick={() => setCollapsedLanes({})}
                  style={{ border: `1px solid ${t.border}`, background: t.panel, borderRadius: t.radius.md,
                    cursor: "pointer", fontSize: 11, padding: "3px 9px", color: t.sub }}>Expand all</button>
                <button onClick={() => setShowWithin((s) => !s)}
                  style={{ border: `1px solid ${showWithin ? t.accent : t.border}`,
                    background: showWithin ? t.accent : t.panel, borderRadius: t.radius.md,
                    cursor: "pointer", fontSize: 11, padding: "3px 9px",
                    color: showWithin ? "#fff" : t.sub }}>
                  {showWithin ? "Hide" : "Show"} within-domain</button>
              </span>
            )}
            <button onClick={() => setFull((f) => !f)} style={{ marginLeft: "auto",
              border: `1px solid ${t.border}`, background: t.panel, borderRadius: t.radius.md,
              cursor: "pointer", fontSize: 12, padding: "4px 10px", color: t.sub }}>
              {"\u26F6"} {full ? "Exit" : "Full screen"}</button>
          </div>
          <div style={{ height: full ? "calc(100vh - 45px)" : 560, overflow: "auto" }}>
            {loading && <div style={{ padding: 30, color: t.textMuted, fontSize: 13 }}>Loading interdependency graph…</div>}
            {!loading && graph.nodes.length === 0 && (
              <div style={{ padding: 30, color: t.textMuted, fontSize: 13 }}>
                No shared-key relationships found for {label}. Ensure key fields are populated in the columns table (see /diag).
              </div>
            )}
            {!loading && graph.nodes.length > 0 && view === "swim" && (
              <Swimlane t={t} graph={graph} domains={domains} domFilter={domFilter}
                sel={sel} setSel={setSel} nodeById={nodeById}
                collapsed={collapsedLanes} showWithin={showWithin}
                toggleLane={(d) => setCollapsedLanes((c) => ({ ...c, [d]: !c[d] }))} />
            )}
            {!loading && graph.nodes.length > 0 && view === "hub" && (
              <HubView t={t} graph={graph} domains={domains} domFilter={domFilter}
                hubFocus={hubFocus} setHubFocus={setHubFocus} sel={sel} setSel={setSel} />
            )}
          </div>
        </div>

        {/* inspector */}
        <div style={{ width: 320, flexShrink: 0, background: t.panel, border: `1px solid ${t.border}`,
          borderRadius: t.radius.md, padding: 16, maxHeight: 610, overflowY: "auto" }}>
          <Inspector t={t} sel={sel} graph={graph} domains={domains} nodeById={nodeById}
            setSel={setSel} setView={setView} setHubFocus={setHubFocus} />
        </div>
      </div>
    </div>
  );
}

// ---- Swimlane ----
function Swimlane({ t, graph, domains, domFilter, sel, setSel, nodeById, collapsed, toggleLane, showWithin }) {
  const W = 1160, NODE_GAP = 8, LANE_PAD = 26, HEADER = 22;
  // tiering by connectivity (how many edges touch a node) -> 4 columns
  const inDeg = {}; graph.nodes.forEach((n) => { inDeg[n.id] = 0; });
  graph.edges.forEach((e) => { inDeg[e.a] = (inDeg[e.a] || 0) + 1; inDeg[e.b] = (inDeg[e.b] || 0) + 1; });
  const sorted = [...graph.nodes].sort((a, b) => (inDeg[b.id] || 0) - (inDeg[a.id] || 0));
  const tierOf = {}; sorted.forEach((n, i) => { tierOf[n.id] = Math.min(3, Math.floor(i / Math.max(1, Math.ceil(sorted.length / 4)))); });
  const tierX = [40, 320, 610, 900];

  // nodes per domain
  const byDom = {}; domains.forEach((d) => { byDom[d] = []; });
  graph.nodes.forEach((n) => { (byDom[n.domain] = byDom[n.domain] || []).push(n); });

  // lay out lanes top-to-bottom; each lane's height depends on collapsed state
  // and (when expanded) the max number of nodes stacked in any one tier column.
  const laneY = {}; const laneHt = {}; let cursor = 12;
  domains.forEach((d) => {
    laneY[d] = cursor;
    if (collapsed[d]) {
      laneHt[d] = HEADER + NH + LANE_PAD; // one summary node
    } else {
      const perTier = [0, 0, 0, 0];
      byDom[d].forEach((n) => { perTier[tierOf[n.id]] += 1; });
      const rows = Math.max(1, ...perTier);
      laneHt[d] = HEADER + rows * (NH + NODE_GAP) + LANE_PAD;
    }
    cursor += laneHt[d] + 6;
  });
  const height = cursor + 10;

  // position each node (expanded lanes only)
  const pos = {}; const perLaneTier = {};
  domains.forEach((d) => {
    if (collapsed[d]) return;
    byDom[d].forEach((n) => {
      const key = `${d}:${tierOf[n.id]}`;
      const idx = (perLaneTier[key] = (perLaneTier[key] || 0)); perLaneTier[key] += 1;
      pos[n.id] = { x: tierX[tierOf[n.id]], y: laneY[d] + HEADER + idx * (NH + NODE_GAP) };
    });
  });
  // collapsed lane summary anchor (center of the lane) for edge routing
  const summaryAnchor = (d) => ({ x: tierX[1], y: laneY[d] + HEADER, w: 220 });

  const paths = []; const labels = []; const nodes = [];

  // edges: skip when either endpoint's lane is collapsed (summarized instead).
  // Bundling: route parallel edges between the same lane-pair through a shared
  // vertical "waist" so they converge into cables instead of a spray.
  // laneMid = vertical center of each lane, used as the bundle control point.
  const laneMid = {}; domains.forEach((d) => { laneMid[d] = laneY[d] + (laneHt[d] / 2); });
  graph.edges.forEach((e, i) => {
    const na = nodeById(e.a), nb = nodeById(e.b); if (!na || !nb) return;
    if (collapsed[na.domain] || collapsed[nb.domain]) return; // hidden while collapsed
    const cross = na.domain !== nb.domain;
    if (!cross && !showWithin) return; // hide within-domain edges by default
    const A = pos[e.a], B = pos[e.b]; if (!A || !B) return;
    const hlEdge = sel && sel.type === "edge" && sel.i === i;
    const hlNode = sel && sel.type === "feed" && (e.a === sel.id || e.b === sel.id);
    const dim = sel && !hlEdge && !hlNode;
    const mismatch = e.match === "mismatch";
    let col = mismatch ? "#ca8a04" : (cross ? "#c1113a" : "#9fb0c4");
    if (hlEdge || hlNode) col = "#0091bf";
    const x1 = A.x + NW, y1 = A.y + NH / 2, x2 = B.x, y2 = B.y + NH / 2;
    // bundle: curve from source into a shared lane-pair "waist", then out to
    // target — parallel edges share the waist and visually merge into a cable.
    const mx = (x1 + x2) / 2;
    const waistY = (laneMid[na.domain] + laneMid[nb.domain]) / 2;
    const wx = mx; // waist x at horizontal midpoint
    paths.push(
      <path key={`p${i}`}
        d={`M${x1},${y1} Q${(x1 + wx) / 2},${y1} ${wx},${waistY} Q${(wx + x2) / 2},${y2} ${x2},${y2}`}
        stroke={col} strokeWidth={hlEdge || hlNode ? 2.5 : (cross ? 1.5 : 1.1)} fill="none"
        opacity={dim ? 0.06 : (cross ? 0.55 : 0.35)} strokeDasharray={mismatch ? "5,4" : undefined}
        style={{ cursor: "pointer" }} onClick={() => setSel({ type: "edge", i })} />
    );
    if (hlEdge || (cross && hlNode)) {
      labels.push(
        <g key={`l${i}`} style={{ cursor: "pointer" }} onClick={() => setSel({ type: "edge", i })}>
          <rect x={wx - 32} y={waistY - 8} width={64} height={15} rx={7} fill="#fff"
            stroke={hlEdge ? "#0091bf" : (mismatch ? "#ca8a04" : "#f0d0d5")} />
          <text x={wx} y={waistY + 3} fontSize={8} fontFamily="monospace"
            fill={hlEdge ? "#0091bf" : (mismatch ? "#a16207" : "#c1113a")} textAnchor="middle">
            {e.key}{mismatch ? " \u26A0" : ""}</text>
        </g>
      );
    }
  });

  // nodes (expanded lanes)
  graph.nodes.forEach((n) => {
    const p = pos[n.id]; if (!p) return;
    const hl = sel && ((sel.type === "feed" && sel.id === n.id)
      || (sel.type === "edge" && (graph.edges[sel.i]?.a === n.id || graph.edges[sel.i]?.b === n.id)));
    const dim = sel && !hl;
    const c = domColor(domains, n.domain);
    nodes.push(
      <g key={n.id} style={{ cursor: "pointer" }} opacity={dim ? 0.3 : 1} onClick={() => setSel({ type: "feed", id: n.id })}>
        <rect x={p.x} y={p.y} width={NW} height={NH} rx={7} fill="#fff" stroke={hl ? "#0091bf" : c} strokeWidth={hl ? 2.5 : 1.5} />
        <rect x={p.x} y={p.y} width={4} height={NH} rx={2} fill={c} />
        <text x={p.x + 14} y={p.y + 24} fontSize={11.5} fontWeight={600} fill="#10193b">
          {n.name.length > 19 ? n.name.slice(0, 18) + "\u2026" : n.name}</text>
      </g>
    );
  });

  return (
    <svg width={W} height={height} style={{ display: "block" }}>
      {domains.map((d, i) => {
        const y = laneY[d]; const h = laneHt[d]; const dim = domFilter && domFilter !== d;
        const c = domColor(domains, d);
        const count = byDom[d].length;
        const isColl = collapsed[d];
        // count cross-domain edges for the collapsed summary
        const extEdges = graph.edges.filter((e) => {
          const na = nodeById(e.a), nb = nodeById(e.b);
          return na && nb && (na.domain === d || nb.domain === d) && na.domain !== nb.domain;
        }).length;
        return (
          <g key={d} opacity={dim ? 0.45 : 1}>
            <rect x={0} y={y} width={W} height={h} fill={i % 2 ? "#f7fafb" : "#ffffff"} />
            <rect x={0} y={y} width={5} height={h} fill={c} />
            {/* clickable lane header = collapse toggle */}
            <g style={{ cursor: "pointer" }} onClick={() => toggleLane(d)}>
              <text x={16} y={y + 15} fontSize={7} fill={c}>{isColl ? "\u25B6" : "\u25BC"}</text>
              <text x={28} y={y + 16} fontSize={10} fontWeight={700} fill={c}>
                {d.toUpperCase()} ({count})</text>
            </g>
            {/* collapsed summary node */}
            {isColl && (
              <g style={{ cursor: "pointer" }} onClick={() => toggleLane(d)}>
                <rect x={tierX[1]} y={y + HEADER} width={240} height={NH} rx={7}
                  fill={c} opacity={0.12} stroke={c} strokeWidth={1.5} />
                <text x={tierX[1] + 14} y={y + HEADER + 18} fontSize={11} fontWeight={700} fill={c}>
                  {count} feeds {"\u00b7"} collapsed</text>
                <text x={tierX[1] + 14} y={y + HEADER + 31} fontSize={8.5} fill="#8a97a3">
                  {extEdges} cross-domain link{extEdges === 1 ? "" : "s"} {"\u00b7"} click to expand</text>
              </g>
            )}
          </g>
        );
      })}
      {paths}{labels}{nodes}
    </svg>
  );
}

// ---- Hub view ----
function HubView({ t, graph, domains, domFilter, hubFocus, setHubFocus, sel, setSel }) {
  const hubs = graph.hubs || [];
  const nodeById = (id) => graph.nodes.find((n) => n.id === id);
  if (!hubFocus) {
    const W = 1160, cols = 4, cw = W / cols, ch = 250;
    const vis = hubs.filter((h) => !domFilter || h.feeds.some((f) => (nodeById(f) || {}).domain === domFilter));
    return (
      <svg width={W} height={Math.max(540, Math.ceil(vis.length / cols) * ch + 20)} style={{ display: "block" }}>
        {vis.map((h, i) => {
          const cx = cw * (i % cols) + cw / 2, cy = ch * Math.floor(i / cols) + ch / 2 + 10;
          const members = h.feeds.map(nodeById).filter(Boolean).filter((f) => !domFilter || f.domain === domFilter);
          const R = 20 + Math.min(members.length * 4, 40);
          let ang = -Math.PI / 2; const total = members.length || 1;
          const spokes = members.map((f, j) => {
            const x = cx + Math.cos(ang) * (R + 16), y = cy + Math.sin(ang) * (R + 16);
            const line = (
              <g key={j}>
                <line x1={cx} y1={cy} x2={x} y2={y} stroke={domColor(domains, f.domain)} strokeWidth={1.2} opacity={0.55} />
                <circle cx={x} cy={y} r={3} fill={domColor(domains, f.domain)} />
              </g>
            );
            ang += (2 * Math.PI) / total; return line;
          });
          return (
            <g key={h.key} style={{ cursor: "pointer" }} onClick={() => { setHubFocus(h.key); setSel({ type: "hub", k: h.key }); }}>
              {spokes}
              <circle cx={cx} cy={cy} r={R} fill="#10193b" stroke="#0091bf" strokeWidth={2} />
              <text x={cx} y={cy - 1} fill="#fff" fontSize={10} fontFamily="monospace" fontWeight={700} textAnchor="middle">
                {h.key.length > 13 ? h.key.slice(0, 12) + "\u2026" : h.key}</text>
              <text x={cx} y={cy + 12} fill="#7fd4ef" fontSize={9} textAnchor="middle">{members.length}</text>
            </g>
          );
        })}
      </svg>
    );
  }
  // focused star
  const W = 1160, H = 540, cx = W / 2, cy = H / 2;
  const h = hubs.find((x) => x.key === hubFocus);
  const members = (h ? h.feeds : []).map(nodeById).filter(Boolean).filter((f) => !domFilter || f.domain === domFilter);
  const byDom = {}; members.forEach((f) => { (byDom[f.domain] = byDom[f.domain] || []).push(f); });
  const doms = Object.keys(byDom); const gap = 0.14; let start = -Math.PI / 2;
  const positions = []; const domLabels = [];
  doms.forEach((dom) => {
    const frac = byDom[dom].length / (members.length || 1);
    const sector = frac * (2 * Math.PI - doms.length * gap); const a0 = start + gap / 2;
    byDom[dom].forEach((f, j) => {
      const a = a0 + sector * ((j + 0.5) / byDom[dom].length);
      positions.push({ f, x: cx + Math.cos(a) * 160, y: cy + Math.sin(a) * 160, dom });
    });
    const amid = a0 + sector / 2;
    domLabels.push({ dom, x: cx + Math.cos(amid) * 232, y: cy + Math.sin(amid) * 232 });
    start += sector + gap;
  });
  return (
    <svg width={W} height={H} style={{ display: "block" }}>
      {domLabels.map((d) => (
        <text key={d.dom} x={d.x} y={d.y} fill={domColor(domains, d.dom)} fontSize={11} fontWeight={700} textAnchor="middle">{d.dom}</text>
      ))}
      {positions.map((p, i) => {
        const hl = sel && sel.type === "feed" && sel.id === p.f.id;
        return <line key={`ln${i}`} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={domColor(domains, p.dom)} strokeWidth={hl ? 2.5 : 1.3} opacity={hl ? 1 : 0.55} />;
      })}
      {positions.map((p, i) => {
        const hl = sel && sel.type === "feed" && sel.id === p.f.id;
        return (
          <g key={`nd${i}`} style={{ cursor: "pointer" }} onClick={() => setSel({ type: "feed", id: p.f.id })}>
            <circle cx={p.x} cy={p.y} r={hl ? 7 : 5} fill={domColor(domains, p.dom)} stroke="#fff" strokeWidth={1.5} />
            <text x={p.x} y={p.y - 10} fill="#10193b" fontSize={9} textAnchor="middle">{p.f.name.slice(0, 18)}</text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={44} fill="#10193b" stroke="#0091bf" strokeWidth={2.5} />
      <text x={cx} y={cy - 3} fill="#fff" fontSize={11} fontFamily="monospace" fontWeight={700} textAnchor="middle">
        {hubFocus.length > 14 ? hubFocus.slice(0, 13) + "\u2026" : hubFocus}</text>
      <text x={cx} y={cy + 12} fill="#7fd4ef" fontSize={9} textAnchor="middle">{members.length} {"\u2192"}</text>
    </svg>
  );
}

// ---- Inspector ----
function Inspector({ t, sel, graph, domains, nodeById, setSel, setView, setHubFocus }) {
  if (!sel) {
    return <div style={{ color: t.textMuted, fontSize: 12, textAlign: "center", padding: "36px 10px", lineHeight: 1.6 }}>
      Click a feed for its connection story, an edge for how two feeds link (with the field's business meaning), or a hub for its shared key.</div>;
  }
  if (sel.type === "hub") {
    const h = (graph.hubs || []).find((x) => x.key === sel.k); if (!h) return null;
    const members = h.feeds.map(nodeById).filter(Boolean);
    const byDom = {}; members.forEach((f) => { (byDom[f.domain] = byDom[f.domain] || []).push(f); });
    return (
      <div>
        <h3 style={{ fontSize: 15, margin: "0 0 3px", fontFamily: "monospace" }}>{h.key}</h3>
        <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 10 }}>shared key &middot; hub</div>
        <StepH t={t}>Business meaning</StepH>
        <div style={{ background: t.infoBg, border: `1px solid ${t.tint}`, borderRadius: t.radius.md, padding: "12px 14px", fontSize: 13 }}>
          {h.business_desc || "\u2014"}</div>
        <StepH t={t}>{members.length} share this key</StepH>
        {Object.entries(byDom).map(([dom, fs]) => (
          <div key={dom}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: domColor(domains, dom), margin: "8px 0 3px" }}>{dom} ({fs.length})</div>
            {fs.map((f) => (
              <div key={f.id} onClick={() => setSel({ type: "feed", id: f.id })}
                style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, padding: "5px 0", cursor: "pointer" }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: domColor(domains, dom) }} />{f.name}</div>
            ))}
          </div>
        ))}
      </div>
    );
  }
  if (sel.type === "feed") {
    const f = nodeById(sel.id); if (!f) return null;
    const conns = graph.edges.filter((e) => e.a === f.id || e.b === f.id);
    return (
      <div>
        <h3 style={{ fontSize: 15, margin: "0 0 3px" }}>{f.name}</h3>
        <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: domColor(domains, f.domain) }} />{f.domain}</div>
        <StepH t={t}>Connects to {conns.length}</StepH>
        {conns.map((e, i) => {
          const other = nodeById(e.a === f.id ? e.b : e.a); if (!other) return null;
          const gi = graph.edges.indexOf(e);
          return (
            <div key={i} onClick={() => setSel({ type: "edge", i: gi })}
              style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, padding: "6px 0",
                borderBottom: `1px solid ${t.bg}`, cursor: "pointer" }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: domColor(domains, other.domain) }} />
              {other.name}
              <span style={{ marginLeft: "auto", fontFamily: "monospace", fontSize: 10, color: t.textMuted }}>{e.key}</span>
            </div>
          );
        })}
      </div>
    );
  }
  // edge
  const e = graph.edges[sel.i]; if (!e) return null;
  const A = nodeById(e.a), B = nodeById(e.b); if (!A || !B) return null;
  const cross = A.domain !== B.domain; const mismatch = e.match === "mismatch";
  return (
    <div>
      <h3 style={{ fontSize: 15, margin: "0 0 3px" }}>{A.name} {"\u2194"} {B.name}</h3>
      <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 10 }}>
        {cross ? <span style={{ color: t.danger }}>{"\u21C4"} cross-domain</span> : "within domain"}</div>
      <StepH t={t}>Linking field</StepH>
      <div style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: t.radius.md, padding: "11px 13px" }}>
        <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700 }}>
          {e.key} {mismatch
            ? <span style={{ fontSize: 8.5, fontWeight: 700, color: "#fff", padding: "1px 6px", borderRadius: 3, background: "#ca8a04" }}>{"\u26A0"} CHECK</span>
            : <span style={{ fontSize: 8.5, fontWeight: 700, color: "#fff", padding: "1px 6px", borderRadius: 3, background: t.success }}>MATCH</span>}
        </div>
        <KV t={t} k="Business meaning" v={e.business_desc} mono={false} />
        <KV t={t} k="In both" v={`${A.name} · ${B.name}`} mono={false} />
      </div>
      {mismatch
        ? <div style={{ background: t.warningBg, border: `1px solid ${t.warning}`, borderRadius: t.radius.md, padding: "9px 11px", fontSize: 11.5, marginTop: 8, lineHeight: 1.5 }}>
            {"\u26A0"} The business description of this key differs between the two feeds — possibly a naming coincidence rather than a true link. The description is the semantic check on the join.</div>
        : <div style={{ fontSize: 11.5, color: t.sub, lineHeight: 1.5, marginTop: 8 }}>
            Matching business descriptions confirm both {A.name} and {B.name} reference the same concept — a trustworthy interdependency.</div>}
    </div>
  );
}

function Chip({ t, active, onClick, dot, label }) {
  return (
    <span onClick={onClick} style={{ fontSize: 11, fontWeight: 600, padding: "5px 11px", borderRadius: t.radius.pill,
      cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5,
      border: `1px solid ${active ? t.accent : t.border}`, background: active ? t.accent : t.panel, color: active ? "#fff" : t.sub }}>
      {dot && <span style={{ width: 8, height: 8, borderRadius: 4, background: dot, display: "inline-block" }} />}{label}
    </span>
  );
}
function StepH({ t, children }) {
  return <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: t.accent, margin: "14px 0 6px", letterSpacing: ".4px" }}>{children}</div>;
}
function KV({ t, k, v, mono = true }) {
  return (
    <div style={{ display: "flex", fontSize: 11.5, padding: "4px 0", borderBottom: `1px solid ${t.bg}` }}>
      <span style={{ width: 110, color: t.textMuted }}>{k}</span>
      <span style={{ fontFamily: mono ? "monospace" : "inherit", color: t.text }}>{v || "\u2014"}</span>
    </div>
  );
}
