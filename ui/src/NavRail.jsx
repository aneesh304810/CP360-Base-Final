// The left navigation: Home, pinned pages, then sections by what the user is
// doing (Catalog, Lineage & Analysis, Build, Operate, Govern, Admin). Expanded
// it is an accordion whose open state is remembered per browser; collapsed it
// is an icon rail where each section icon opens a flyout. The IN BUILD pill is
// a 7px dot with a tooltip here; the full badge sits on the page's breadcrumb.
// Role filtering happens before this component sees the groups (filterNav).
import React, { useState, useEffect } from 'react';
import { MODULE_STATUS, NavLegend } from './navStatus.jsx';

export const RAIL_W = 60, FULL_W = 248, MAX_PINS = 5;
const OPEN_KEY = 'cp360-nav-open', PINS_KEY = 'cp360-nav-pins';

const read = (k, fb) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? fb : v; } catch (e) { return fb; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private window */ } };

/* ---- icons: inline stroke SVG, one per section plus the small controls ---- */
const PATHS = {
  home: <path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  catalog: <g><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></g>,
  lineage: <g><circle cx="6" cy="5" r="2.5" /><circle cx="6" cy="19" r="2.5" /><circle cx="18" cy="9" r="2.5" /><path d="M6 7.5v9M18 11.5c0 3-3 4-6 4.5-2 .4-4 1-6 1" /></g>,
  build: <g><path d="M14 4l6 6-2 2-6-6z" /><path d="M12 6L4 14l-1 4 4-1 8-8" /></g>,
  operate: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  govern: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  admin: <g><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></g>,
  pin: <path d="M9 3h6l-1 6 3 3H7l3-3zM12 12v9" />,
  down: <path d="M6 9l6 6 6-6" />,
  right: <path d="M9 6l6 6-6 6" />,
  left: <path d="M15 6l-6 6 6 6" />,
};
export function NavIcon({ name, size = 16, color = 'currentColor' }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, display: 'block' }}>
      {PATHS[name] || PATHS.catalog}
    </svg>);
}

/** The quiet status mark: a dot for in build or beta, a dashed ring for planned, nothing for live. */
export function StatusDot({ id }) {
  const st = MODULE_STATUS[id];
  if (!st) return null;
  const word = st.state === 'wip' ? 'In build' : st.state === 'beta' ? 'Beta' : 'Planned';
  const tip = `${word}${st.pct != null ? ` · ${st.pct}%` : ''}${st.works ? `\nWorks: ${st.works}` : ''}${st.next ? `\nNext: ${st.next}` : ''}`;
  return (
    <span title={tip} aria-label={word} data-status={st.state} style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
      background: st.state === 'wip' ? '#f0a04b' : st.state === 'beta' ? '#31bced' : 'transparent',
      border: st.state === 'planned' ? '1.5px dashed #8fa3bb' : 'none' }} />);
}

/** Which section (its key) holds a route. */
export const sectionOf = (groups, route) => { const g = (groups || []).find((x) => x.group && x.items.some((it) => it[0] === route)); return g ? g.key : null; };
/** The label of a route, from the groups. */
export const labelOf = (groups, route) => { for (const g of groups || []) for (const it of g.items) if (it[0] === route) return it[1]; return null; };

const ITEM = { display: 'flex', alignItems: 'center', gap: 8, height: 30, boxSizing: 'border-box', borderRadius: 6, cursor: 'pointer',
  fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textDecoration: 'none', color: '#d5dee9' };

export default function NavRail({ t, groups, route, onNav, collapsed, onToggle, initial }) {
  const sections = (groups || []).filter((g) => g.group);
  const home = (groups || []).find((g) => !g.group);
  const [open, setOpen] = useState(() => (initial && initial.open) || read(OPEN_KEY, {}));
  const [pins, setPins] = useState(() => (initial && initial.pins) || read(PINS_KEY, []));
  const [fly, setFly] = useState((initial && initial.fly) || null);        // section key whose flyout shows
  const [flyPinned, setFlyPinned] = useState(false);
  useEffect(() => { write(OPEN_KEY, open); }, [open]);
  useEffect(() => { write(PINS_KEY, pins); }, [pins]);
  useEffect(() => { setFly(null); setFlyPinned(false); }, [route, collapsed]);

  const current = sectionOf(groups, route);
  const isOpen = (g) => g.key === current || open[g.key] !== false;
  const toggle = (g) => setOpen((o) => ({ ...o, [g.key]: !isOpen(g) }));
  const pinned = pins.map((k) => [k, labelOf(groups, k)]).filter((x) => x[1]);
  const togglePin = (k) => setPins((p) => (p.includes(k) ? p.filter((x) => x !== k) : p.length >= MAX_PINS ? p : [...p, k]));
  const go = (k) => (e) => { if (e) e.preventDefault(); onNav(k); };

  const css = '.cpnav-item .cpnav-pin{opacity:0}.cpnav-item:hover .cpnav-pin,.cpnav-item:focus-within .cpnav-pin{opacity:1}'
    + '.cpnav-item:hover{background:rgba(255,255,255,0.07)}.cpnav-head:hover{color:#fff}'
    + '.cpnav-rail-btn:hover,.cpnav-rail-btn:focus{background:rgba(255,255,255,0.12);color:#fff;outline:none}'
    + '@keyframes cpPulse{0%,100%{opacity:1}50%{opacity:.35}}';

  const Row = ({ k, label, active, indent = 36, pinnable = true, inFly = false }) => (
    <a href={`#${k}`} onClick={go(k)} className="cpnav-item" aria-current={active ? 'page' : undefined} data-nav={k}
      style={{ ...ITEM, padding: `0 8px 0 ${active ? indent - 3 : indent}px`, height: inFly ? 34 : 30,
        background: active ? 'rgba(255,255,255,0.10)' : 'transparent', borderLeft: active ? '3px solid #2fc1a9' : 'none',
        color: active ? '#fff' : '#d5dee9', fontWeight: active ? 600 : 400 }}>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      <StatusDot id={k} />
      {pinnable && (
        <button type="button" className="cpnav-pin" onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin(k); }}
          title={pins.includes(k) ? 'Unpin' : pins.length >= MAX_PINS ? `Up to ${MAX_PINS} pinned pages` : 'Pin to top'}
          aria-label={pins.includes(k) ? `Unpin ${label}` : `Pin ${label}`} aria-pressed={pins.includes(k)}
          style={{ border: 'none', background: 'transparent', color: pins.includes(k) ? '#2fc1a9' : '#8fa3bb', cursor: 'pointer',
            padding: 2, display: 'flex', opacity: pins.includes(k) ? 1 : undefined }}>
          <NavIcon name="pin" size={12} />
        </button>)}
    </a>);

  /* ---------------------------------------------------------- collapsed rail */
  if (collapsed) {
    const flyG = fly ? sections.find((g) => g.key === fly) : null;
    return (
      <nav aria-label="Primary" data-nav-mode="rail"
        onMouseLeave={() => { if (!flyPinned) setFly(null); }}
        style={{ width: RAIL_W, flexShrink: 0, background: t.navy, color: '#d5dee9', display: 'flex', flexDirection: 'column',
          alignItems: 'center', padding: '8px 0 12px', position: 'relative', transition: 'width 0.18s ease' }}>
        <style>{css}</style>
        <button type="button" onClick={onToggle} title="Expand navigation" aria-label="Expand navigation" className="cpnav-rail-btn"
          style={{ width: 44, height: 36, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent',
            color: '#8fa3bb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: 8 }}>
          <NavIcon name="right" size={14} />
        </button>
        {home && (
          <a href="#home" onClick={go('home')} title="Home" aria-label="Home" className="cpnav-rail-btn" data-nav="home"
            style={{ width: 44, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: route === 'home' ? '#2fc1a9' : '#c3cfdd', textDecoration: 'none' }}>
            <NavIcon name="home" size={17} />
          </a>)}
        <div style={{ width: 32, height: 1, background: 'rgba(255,255,255,0.10)', margin: '6px 0' }} />
        {sections.map((g) => {
          const active = g.key === current, showing = fly === g.key;
          const inBuild = g.items.some((it) => MODULE_STATUS[it[0]]);
          return (
            <div key={g.key} style={{ position: 'relative', width: RAIL_W, display: 'flex', justifyContent: 'center' }}>
              <button type="button" className="cpnav-rail-btn" title={g.group} aria-label={g.group} aria-expanded={showing}
                aria-current={active ? 'true' : undefined} data-section={g.key}
                onMouseEnter={() => { if (!flyPinned) setFly(g.key); }} onFocus={() => setFly(g.key)}
                onClick={() => { if (showing && flyPinned) { setFly(null); setFlyPinned(false); } else { setFly(g.key); setFlyPinned(true); } }}
                style={{ width: 44, height: 40, borderRadius: 8, border: 'none', cursor: 'pointer', position: 'relative',
                  background: showing ? 'rgba(255,255,255,0.12)' : 'transparent', color: active ? '#2fc1a9' : showing ? '#fff' : '#c3cfdd',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {active && <span aria-hidden="true" style={{ position: 'absolute', left: -8, top: 8, width: 3, height: 24, borderRadius: 2, background: '#2fc1a9' }} />}
                <NavIcon name={g.key} size={18} />
                {inBuild && <span aria-hidden="true" style={{ position: 'absolute', top: 6, right: 6, width: 5, height: 5, borderRadius: '50%', background: '#f0a04b' }} />}
              </button>
              {showing && flyG && (
                <div role="menu" aria-label={g.group} data-flyout={g.key}
                  style={{ position: 'absolute', left: RAIL_W + 6, top: 0, width: 272, boxSizing: 'border-box', zIndex: 60,
                    background: '#16224a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
                    boxShadow: '0 14px 36px rgba(16,25,59,0.35)', padding: '10px 8px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 4 }}>
                    <NavIcon name={g.key} size={16} color="#8fa3bb" />
                    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', color: '#fff', textTransform: 'uppercase' }}>{g.group}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: '#8fa3bb' }}>{g.items.length} page{g.items.length === 1 ? '' : 's'}</span>
                  </div>
                  {g.items.map(([k, label]) => <Row key={k} k={k} label={label} active={route === k} indent={10} inFly />)}
                </div>)}
            </div>);
        })}
      </nav>);
  }

  /* ---------------------------------------------------------- expanded nav */
  return (
    <nav aria-label="Primary" data-nav-mode="full"
      style={{ width: FULL_W, flexShrink: 0, background: t.navy, color: '#d5dee9', display: 'flex', flexDirection: 'column',
        padding: '8px 8px 0', overflowY: 'auto', transition: 'width 0.18s ease' }}>
      <style>{css}</style>
      <button type="button" onClick={onToggle} title="Collapse navigation" aria-label="Collapse navigation"
        style={{ display: 'flex', alignItems: 'center', gap: 8, height: 32, padding: '0 10px', border: 'none', background: 'transparent',
          color: '#8fa3bb', fontSize: 12, cursor: 'pointer', borderRadius: 6, fontFamily: 'inherit', marginBottom: 2 }}>
        <NavIcon name="left" size={14} /><span>Collapse</span>
      </button>
      {home && (
        <a href="#home" onClick={go('home')} className="cpnav-item" data-nav="home" aria-current={route === 'home' ? 'page' : undefined}
          style={{ ...ITEM, height: 32, padding: '0 10px', gap: 10, fontWeight: 500, fontSize: 13.5, color: route === 'home' ? '#fff' : '#d5dee9',
            background: route === 'home' ? 'rgba(255,255,255,0.10)' : 'transparent' }}>
          <NavIcon name="home" size={16} /><span>Home</span>
        </a>)}

      {pinned.length > 0 && (
        <div data-pinned style={{ marginTop: 8 }}>
          <div style={{ height: 26, display: 'flex', alignItems: 'center', padding: '0 10px', fontSize: 10.5, fontWeight: 600, letterSpacing: '.08em', color: '#8fa3bb' }}>PINNED</div>
          {pinned.map(([k, label]) => <Row key={`pin-${k}`} k={k} label={label} active={route === k} />)}
        </div>)}

      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '10px 10px 4px' }} />

      {sections.map((g) => {
        const o = isOpen(g), active = g.key === current;
        return (
          <div key={g.key} data-section={g.key} data-open={o}>
            <button type="button" className="cpnav-head" onClick={() => toggle(g)} aria-expanded={o}
              style={{ width: '100%', height: 34, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 10, padding: '0 10px',
                marginTop: 6, border: 'none', background: 'transparent', color: active ? '#fff' : '#c3cfdd', cursor: 'pointer',
                textAlign: 'left', fontFamily: 'inherit', borderRadius: 6 }}>
              <NavIcon name={g.key} size={16} color={active ? '#2fc1a9' : '#8fa3bb'} />
              <span style={{ flex: 1, fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.group}</span>
              {!o && <span style={{ fontSize: 10.5, color: '#8fa3bb' }}>{g.items.length}</span>}
              <NavIcon name={o ? 'down' : 'right'} size={12} color="#8fa3bb" />
            </button>
            {o && <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {g.items.map(([k, label]) => <Row key={k} k={k} label={label} active={route === k} />)}
            </div>}
          </div>);
      })}
      <NavLegend />
    </nav>);
}
