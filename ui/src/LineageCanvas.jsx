import React, { useState, useRef, useEffect, useCallback } from 'react';
import { api } from './api.js';

/**
 * Interactive lineage canvas — draggable nodes, pan, zoom, Dataset/Columns
 * toggle, Data/Transforms/Orchestration planes, and a side detail panel.
 * Mirrors the mockup's "Canvas" lineage view. Data comes from the live API
 * (api.graph + api.columnLineage); falls back to a small demo graph so the
 * canvas is never blank.
 */
export default function LineageCanvas({ t, projectId }) {
  const [nodes, setNodes] = useState({});      // id -> {id,label,module,x,y,cols?}
  const [edges, setEdges] = useState([]);      // {from,to,kind}
  const [colMode, setColMode] = useState('dataset'); // 'dataset' | 'column'
  const [plane, setPlane] = useState('data');  // 'data'|'transform'|'orch'
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [side, setSide] = useState(null);      // {title, body[]}
  const [expanded, setExpanded] = useState(null);
  const stageRef = useRef(null);
  const drag = useRef(null);

  // ---- load graph ----
  useEffect(() => {
    let ok = true;
    Promise.all([
      api.graph(projectId, plane === 'orch' ? 'Orchestration' : plane === 'transform' ? 'Transform' : 'Data'),
      api.columnLineage(null),
    ]).then(([g, cl]) => {
      if (!ok) return;
      const gnodes = (g && g.nodes) || [];
      const gedges = (g && g.edges) || [];
      if (gnodes.length) {
        const laid = layout(gnodes, gedges);
        setNodes(laid);
        setEdges(gedges.map(e => ({ from: e.from_key || e.from, to: e.to_key || e.to, kind: planeKind(plane) })));
      } else {
        const demo = demoGraph(plane);
        setNodes(demo.nodes); setEdges(demo.edges);
      }
      window.__colEdges = (cl && cl.column_edges) || [];
    }).catch(() => {
      const demo = demoGraph(plane);
      setNodes(demo.nodes); setEdges(demo.edges);
    });
    return () => { ok = false; };
  }, [projectId, plane]);

  // ---- drag a node ----
  const onNodeDown = (id, e) => {
    e.stopPropagation();
    const n = nodes[id];
    drag.current = { id, sx: e.clientX, sy: e.clientY, ox: n.x, oy: n.y };
  };
  const onMove = useCallback((e) => {
    if (!drag.current) return;
    if (drag.current.pan) {
      setPan({ x: drag.current.px + (e.clientX - drag.current.sx),
               y: drag.current.py + (e.clientY - drag.current.sy) });
      return;
    }
    const dx = (e.clientX - drag.current.sx) / zoom;
    const dy = (e.clientY - drag.current.sy) / zoom;
    setNodes(prev => ({ ...prev, [drag.current.id]: {
      ...prev[drag.current.id], x: drag.current.ox + dx, y: drag.current.oy + dy } }));
  }, [zoom]);
  const onUp = useCallback(() => { drag.current = null; }, []);
  useEffect(() => {
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [onMove, onUp]);

  const onStageDown = (e) => {
    drag.current = { pan: true, sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
  };

  const nodeColor = (mod) => mod === 'FEED' || mod === 'feed' ? (t.info || '#0091bf')
    : mod === 'MODEL' || mod === 'transform' ? (t.datapoint || '#0f4775')
    : mod === 'DAG' || mod === 'orch' ? (t.loader || '#7c3aed')
    : (t.navy || '#0f4775');

  const openCol = (nid, col, edge) => {
    setSide({ title: col, body: [
      ['Dataset', nid],
      ['Column', col],
      ['Transform', edge?.transform_expr || 'passthrough'],
      ['Source', edge?.from_column || '\u2014'],
    ] });
  };

  const NW = 150, NH = 34;
  return (
    <div>
      {/* controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Seg t={t} opts={[['dataset', 'Dataset graph'], ['column', 'Columns']]}
          val={colMode} set={setColMode} active={t.navy} />
        <Seg t={t} opts={[['data', 'Data'], ['transform', 'Transforms'], ['orch', 'Orchestration']]}
          val={plane} set={setPlane} active={t.accent} />
        {colMode === 'column' && <span style={{ fontSize: 11, color: t.textMuted }}>
          Columns view: click a node header to expand its columns</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <Btn t={t} onClick={() => setZoom(z => Math.min(2, z + 0.1))}>+</Btn>
          <Btn t={t} onClick={() => setZoom(z => Math.max(0.4, z - 0.1))}>{'\u2212'}</Btn>
          <Btn t={t} onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>{'\u2922'}</Btn>
        </div>
      </div>

      {/* stage */}
      <div ref={stageRef} onMouseDown={onStageDown} style={{
        position: 'relative', height: 520, overflow: 'hidden',
        border: `1px solid ${t.border}`, borderRadius: 10,
        background: 'radial-gradient(circle,#d7dee2 1px,transparent 1px)',
        backgroundSize: '22px 22px', backgroundColor: '#f7fafa', cursor: 'grab' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: 2400, height: 1400,
          transformOrigin: '0 0', transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})` }}>
          {/* edges */}
          <svg style={{ position: 'absolute', top: 0, left: 0, width: 2400, height: 1400, pointerEvents: 'none' }}>
            {edges.map((e, i) => {
              const a = nodes[e.from], b = nodes[e.to];
              if (!a || !b) return null;
              const x1 = a.x + NW, y1 = a.y + NH / 2, x2 = b.x, y2 = b.y + NH / 2;
              const mx = (x1 + x2) / 2;
              const col = e.kind === 'orch' ? (t.loader || '#7c3aed')
                : e.kind === 'transform' ? (t.datapoint || '#0f4775') : (t.info || '#0091bf');
              return <path key={i} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                stroke={col} strokeWidth={2} fill="none"
                strokeDasharray={e.kind === 'orch' ? '5,4' : 'none'} opacity={0.7} />;
            })}
          </svg>
          {/* nodes */}
          {Object.values(nodes).map((n) => (
            <div key={n.id} onMouseDown={(e) => onNodeDown(n.id, e)}
              style={{ position: 'absolute', left: n.x, top: n.y, minWidth: NW,
                background: t.panel, border: `1px solid ${t.border}`, borderRadius: 7,
                boxShadow: t.shadow?.sm || '0 1px 4px rgba(0,0,0,.1)', cursor: 'grab', zIndex: 2 }}>
              <div onClick={() => colMode === 'column' && setExpanded(expanded === n.id ? null : n.id)}
                style={{ padding: '7px 10px', borderLeft: `3px solid ${nodeColor(n.module)}`,
                  borderRadius: '7px 7px 0 0' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: nodeColor(n.module) }}>
                  {(n.module || 'NODE').toUpperCase()}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.navy, wordBreak: 'break-all' }}>
                  {n.label}</div>
              </div>
              {colMode === 'column' && expanded === n.id && (n.cols || demoColsFor(n)).map((c) => (
                <div key={c} onClick={() => openCol(n.label, c,
                  (window.__colEdges || []).find(e => (e.to_column || '').toLowerCase().endsWith('.' + c.toLowerCase())))}
                  style={{ padding: '4px 10px', fontSize: 11, fontFamily: 'monospace',
                    borderTop: `1px solid ${t.panel2 || '#eef1f2'}`, cursor: 'pointer',
                    color: t.text }}>{c}</div>
              ))}
            </div>
          ))}
        </div>

        {/* legend */}
        <div style={{ position: 'absolute', left: 12, bottom: 12, background: 'rgba(255,255,255,.95)',
          border: `1px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 11 }}>
          {[['data flow', t.info || '#0091bf', false], ['transform', t.datapoint || '#0f4775', false],
            ['orchestration', t.loader || '#7c3aed', true]].map(([lbl, c, dash]) => (
            <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 6, color: t.sub }}>
              <span style={{ width: 20, borderTop: `2px ${dash ? 'dashed' : 'solid'} ${c}` }} /> {lbl}
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', right: 12, top: 12, background: 'rgba(255,255,255,.95)',
          border: `1px solid ${t.border}`, borderRadius: 8, padding: '7px 11px', fontSize: 11,
          color: t.textMuted }}>Drag nodes {'\u00b7'} drag empty space to pan {'\u00b7'} +/{'\u2212'}</div>

        {/* side panel */}
        <div style={{ position: 'absolute', right: 0, top: 0, width: 300, height: '100%',
          background: t.panel, borderLeft: `1px solid ${t.border}`, boxShadow: '-2px 0 12px rgba(16,25,59,.08)',
          zIndex: 10, transform: side ? 'translateX(0)' : 'translateX(100%)', transition: 'transform .2s',
          overflowY: 'auto' }}>
          {side && <>
            <div style={{ padding: '13px 15px', borderBottom: `1px solid ${t.border}`,
              display: 'flex', alignItems: 'center' }}>
              <b style={{ fontSize: 14, color: t.navy }}>{side.title}</b>
              <span onClick={() => setSide(null)} style={{ marginLeft: 'auto', cursor: 'pointer',
                color: t.textMuted, fontSize: 18 }}>{'\u00d7'}</span>
            </div>
            <div style={{ padding: '13px 15px' }}>
              {side.body.map(([k, v]) => (
                <div key={k} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.5px',
                    color: t.textMuted }}>{k}</div>
                  <div style={{ fontSize: 12, fontFamily: k === 'Transform' ? 'monospace' : 'inherit',
                    color: t.navy, marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>
          </>}
        </div>
      </div>
    </div>
  );
}

function Seg({ t, opts, val, set, active }) {
  return (
    <div style={{ display: 'flex', gap: 2, background: t.panel2 || '#eef1f2', borderRadius: 7, padding: 3 }}>
      {opts.map(([k, label]) => (
        <button key={k} onClick={() => set(k)} style={{
          background: val === k ? active : 'transparent', color: val === k ? '#fff' : t.sub,
          border: 'none', fontSize: 12, fontWeight: 600, padding: '6px 13px', borderRadius: 5,
          cursor: 'pointer', fontFamily: t.font }}>{label}</button>
      ))}
    </div>
  );
}
function Btn({ t, onClick, children }) {
  return <button onClick={onClick} style={{ width: 28, height: 28, border: `1px solid ${t.border}`,
    background: t.panel, borderRadius: 6, cursor: 'pointer', fontFamily: t.font }}>{children}</button>;
}

// ---- layout: assign x by depth (topological-ish), y by row within depth ----
function layout(nodes, edges) {
  const byId = {}; nodes.forEach(n => { byId[n.name || n.id] = n; });
  const indeg = {}; nodes.forEach(n => { indeg[n.name || n.id] = 0; });
  edges.forEach(e => { const to = e.to_key || e.to; if (to in indeg) indeg[to]++; });
  // depth via BFS from roots
  const depth = {}; const q = [];
  nodes.forEach(n => { const id = n.name || n.id; if (!indeg[id]) { depth[id] = 0; q.push(id); } });
  const adj = {}; edges.forEach(e => { const f = e.from_key || e.from, to = e.to_key || e.to;
    (adj[f] = adj[f] || []).push(to); });
  while (q.length) { const id = q.shift(); (adj[id] || []).forEach(to => {
    if (depth[to] == null || depth[to] < depth[id] + 1) { depth[to] = depth[id] + 1; q.push(to); } }); }
  const rowByDepth = {};
  const out = {};
  nodes.slice(0, 60).forEach(n => {
    const id = n.name || n.id; const d = depth[id] || 0;
    rowByDepth[d] = (rowByDepth[d] || 0);
    out[id] = { id, label: n.object_name || n.label || id, module: n.object_type || n.module || n.layer,
      x: 60 + d * 230, y: 40 + rowByDepth[d] * 90 };
    rowByDepth[d]++;
  });
  return out;
}
function planeKind(plane) { return plane === 'orch' ? 'orch' : plane === 'transform' ? 'transform' : 'data'; }
function demoColsFor(n) { return ['id', 'name', 'value', 'updated_at']; }

// ---- demo graph so the canvas is never blank ----
function demoGraph(plane) {
  const nodes = {
    trades: { id: 'trades', label: 'TRADES', module: 'FEED', x: 60, y: 60, cols: ['trade_id', 'account_id', 'market_value_local', 'fx_rate'] },
    positions: { id: 'positions', label: 'positions', module: 'FEED', x: 60, y: 180, cols: ['position_id', 'account_id', 'quantity'] },
    brz: { id: 'brz', label: 'sei_brz_positions', module: 'MODEL', x: 300, y: 120, cols: ['position_id', 'account_id', 'quantity', 'market_value_local', 'fx_rate'] },
    slv: { id: 'slv', label: 'sei_slv_positions', module: 'MODEL', x: 540, y: 120, cols: ['position_id', 'account_id', 'market_value_usd'] },
    gld: { id: 'gld', label: 'sei_gld_position_sum', module: 'MODEL', x: 780, y: 120, cols: ['account_id', 'total_market_value_usd'] },
    dag: { id: 'dag', label: 'swp_medallion_dag', module: 'DAG', x: 540, y: 300, cols: [] },
  };
  let edges = [
    { from: 'trades', to: 'brz', kind: 'data' },
    { from: 'positions', to: 'brz', kind: 'data' },
    { from: 'brz', to: 'slv', kind: 'data' },
    { from: 'slv', to: 'gld', kind: 'data' },
  ];
  if (plane === 'orch') edges = edges.concat([
    { from: 'dag', to: 'brz', kind: 'orch' }, { from: 'dag', to: 'slv', kind: 'orch' },
    { from: 'dag', to: 'gld', kind: 'orch' }]);
  return { nodes, edges };
}
