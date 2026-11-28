import React, { useState, useEffect } from 'react';
import { api } from './api.js';
import GlobalSearch from "./GlobalSearch.jsx";
import { NavBadge } from './navStatus.jsx';
import NavRail, { sectionOf, labelOf } from './NavRail.jsx';
import { filterNav } from './securityApi.js';
// Grouped, viewport-aware collapsing sidebar navigation (drawn by NavRail).
const BREAKPOINT = 1200;
const GRAPH_ROUTES = new Set(['data']);

const NAV_GROUPS = [
 { group: null, items: [['home', 'Home', '\u2302']] },
 // Sections by what the user is doing. Keys name the section icon in NavRail.
 { group: 'Catalog', key: 'catalog', items: [
 ['interface', 'Interface 360', '\u21C4'],
 ['api', 'API 360', '\u25C8'],
 ['data', 'Data 360', '\u25A4'],
 ['datapoint', 'Datapoint 360', '\u25C9'],
 ['event360', 'Event 360', '\u25D0'],
 ['odi360', 'ODI 360', '\u27F2'],
 ] },
 { group: 'Lineage & Analysis', key: 'lineage', items: [
 ['lineage', 'Lineage', '\u{1F9EC}'],
 ['impact', 'Impact Analysis', '⚡'],
 ['variance', 'Variance 360', '≍'],
 ['compare', 'Compare', '\u29C9'],
 ['mapper', 'Auto Mapper', '\u21F2'],
 ['dataanalysis', 'Historical Data Analysis', '\u2AF6'],
 ] },
 { group: 'Build', key: 'build', items: [
 ['hub', 'CP Integration Hub', '🏛'],
 ['integration360', 'Integration 360 - Design', '\u25CE'],
 ['system', 'System Design', '⛬'],
 ['devops360', 'DevOps 360', '⚙'],
 ['release', 'Release Delivery', '\u25B3'],
 ['codereview', 'Code Review 360', '\u2611'],
 ] },
 { group: 'Operate', key: 'operate', items: [
 ['guardrails', 'Integration 360 - Run', '\u25C9'],
 ['recon', 'Recon 360', '⇄'],
 ['pbnotify', 'PB Notifications', '\u2709'],
 ['apiconsole', 'API Console', '\u2318'],
 ] },
 { group: 'Govern', key: 'govern', items: [
 ['pii', 'PII Explorer', '⚑'],
 ['cyber360', 'Cyber Security 360', '\u26E8'],
 ['security', 'Security Entitlement', '\u26BF'],
 ] },
 { group: 'Admin', key: 'admin', items: [
 ['datasources', 'Data Sources', '⛭'],
 ['apicatalog', 'API Catalog Admin', '\u2699'],
 ['environment', 'Environment 360', '🖧'],
 ] },
];

// `me` is the payload from /auth/me. When enforcement is off it carries
// modules: null, and filterNav then returns the sidebar untouched — the
// app looks exactly as it did before there was a login.
export default function AppShell({ t, route, onNav, live, onSearch, onOpenHit,
 me, onSignOut, children }) {
 const [manual, setManual] = useState(null);
 const [narrow, setNarrow] = useState(
 typeof window !== 'undefined' ? window.innerWidth < BREAKPOINT : false);

 useEffect(() => {
 const onResize = () => {
 const isNarrow = window.innerWidth < BREAKPOINT;
 setNarrow((prev) => {
 if (prev !== isNarrow) setManual(null);
 return isNarrow;
 });
 };
 window.addEventListener('resize', onResize);
 return () => window.removeEventListener('resize', onResize);
 }, []);

 const autoCollapsed = narrow || GRAPH_ROUTES.has(route);
 const collapsed = manual === null ? autoCollapsed : manual;

 // ---- search bar with autocomplete suggestions ----
 const [sq, setSq] = useState('');
 const [sugs, setSugs] = useState([]);
 const [showSug, setShowSug] = useState(false);
 const [activeIdx, setActiveIdx] = useState(-1);

 useEffect(() => {
 if (!sq || sq.trim().length < 2) { setSugs([]); return; }
 const id = setTimeout(() => {
 api.searchSuggest(sq).then((r) => { setSugs(r.suggestions || []); setShowSug(true); });
 }, 180); // debounce so we don't fire on every keystroke
 return () => clearTimeout(id);
 }, [sq]);

 const submitSearch = (val) => {
 const v = (val || '').trim();
 if (!v) return;
 setShowSug(false);
 window.location.hash = `search?q=${encodeURIComponent(v)}`;
 if (onSearch) onSearch(v);
 };

 const pickSuggestion = (s) => {
 setSq(s.name);
 setShowSug(false);
 if (s.nav && s.nav.module && onNav) onNav(s.nav.module);
 else submitSearch(s.name);
 };

 const onSearchKey = (e) => {
 if (e.key === 'Enter') {
 if (activeIdx >= 0 && sugs[activeIdx]) pickSuggestion(sugs[activeIdx]);
 else submitSearch(e.target.value);
 } else if (e.key === 'ArrowDown') {
 e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, sugs.length - 1)); setShowSug(true);
 } else if (e.key === 'ArrowUp') {
 e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, -1));
 } else if (e.key === 'Escape') {
 setShowSug(false); setActiveIdx(-1);
 }
 };

 const groups = filterNav(NAV_GROUPS, me ? me.modules : null);
 const section = groups.find((g) => g.key === sectionOf(groups, route));
 const pageLabel = labelOf(groups, route);
 const who = me && me.user ? me.user : null;

 return (
 <div style={{ minWidth: t.minWidth, minHeight: '100vh', background: t.bg,
 color: t.text, fontFamily: t.font }}>
 <div style={{ height: 56, background: t.navy, color: '#fff', display: 'flex',
 alignItems: 'center', padding: '0 20px', gap: 16, position: 'sticky', top: 0, zIndex: 40 }}>
 <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
 <div style={{ fontSize: 8, fontWeight: 800, color: t.pop, letterSpacing: 1, lineHeight: 1, marginBottom: 1 }}>360{'\u00b0'}</div>
 <div style={{ width: 34, height: 34, borderRadius: '50%',
 background: `linear-gradient(135deg, ${t.pop}, ${t.accent})`,
 display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: 12,
 letterSpacing: '.5px', border: `2px solid ${t.pop}` }}>CP</div>
 </div>
 <div><b style={{ fontSize: 17, fontWeight: 600 }}>CP <span style={{ color: t.pop, fontWeight: 800 }}>360{'\u00b0'}</span></b>
 <span style={{ color: '#8fa6c4', fontSize: 11, marginLeft: 8 }}>
 Brown Brothers Harriman &middot; Capital Partners</span></div>
 <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: '3px 9px',
 borderRadius: t.radius.pill,
 color: live ? '#bfe' : '#fc9', background: live ? 'rgba(21,153,67,0.25)' : 'rgba(230,126,34,0.25)' }}>
 {'\u25CF'} {live ? 'LIVE' : 'DEMO'}</span>
 <GlobalSearch t={t} onSubmit={submitSearch} onOpen={onOpenHit} />
 <span style={{ marginLeft: 'auto' }} />
 {who && (
 <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
 <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
 <span style={{ fontSize: 12, color: '#e6edf7' }}>
 {who.display_name || who.user_id}</span>
 <span style={{ fontSize: 10, color: '#8fa6c4' }}>
 {me.is_admin ? 'Security administrator' : 'Signed in'}</span>
 </span>
 <button onClick={onSignOut} title="Sign out"
 style={{ border: '1px solid #33456b', background: 'transparent',
 color: '#c5d2e4', borderRadius: t.radius.md, cursor: 'pointer',
 fontSize: 11, padding: '5px 10px', fontFamily: t.font }}>Sign out</button>
 </span>
 )}
 </div>

 <div style={{ display: 'flex', minHeight: 'calc(100vh - 56px)' }}>
 <NavRail t={t} groups={groups} route={route} onNav={onNav} collapsed={collapsed}
 onToggle={() => setManual(!collapsed)} />
 <div style={{ flex: 1, minWidth: 0, padding: '26px 34px 60px' }}>
 {route !== 'home' && pageLabel && (
 <div data-breadcrumb style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
 color: t.sub, marginBottom: 10, flexWrap: 'wrap' }}>
 {section && <span>{section.group}</span>}
 {section && <span aria-hidden="true" style={{ color: t.border }}>{'\u203A'}</span>}
 <span style={{ color: t.text, fontWeight: 600 }}>{pageLabel}</span>
 <span style={{ display: 'inline-block' }}><NavBadge id={route} /></span>
 </div>
 )}
 {children}
 </div>
 </div>
 </div>
 );
}

export function SectionHeader({ t, children }) {
 return (
 <h1 style={{ fontSize: 24, fontWeight: 500, color: t.accent,
 borderBottom: `2px solid ${t.accent}`, paddingBottom: 15, margin: '0 0 30px' }}>
 {children}</h1>
 );
}

export function FullscreenPanel({ t, title, children }) {
 const [full, setFull] = useState(false);
 useEffect(() => {
 const onKey = (e) => { if (e.key === 'Escape') setFull(false); };
 window.addEventListener('keydown', onKey);
 return () => window.removeEventListener('keydown', onKey);
 }, []);
 const wrap = full
 ? { position: 'fixed', inset: 0, zIndex: 200, background: t.panel, borderRadius: 0 }
 : { position: 'relative', background: t.panel, border: `1px solid ${t.border}`, borderRadius: t.radius.md };
 return (
 <div style={wrap}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
 borderBottom: `1px solid ${t.border}`, background: t.bg }}>
 <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
 letterSpacing: '.4px', color: t.sub }}>{title}</span>
 <button onClick={() => setFull((f) => !f)}
 style={{ marginLeft: 'auto', border: `1px solid ${t.border}`, background: t.panel,
 borderRadius: t.radius.md, cursor: 'pointer', fontSize: 12, padding: '4px 10px',
 color: t.sub }}>{'\u26F6'} {full ? 'Exit' : 'Full screen'}</button>
 </div>
 <div style={{ height: full ? 'calc(100vh - 45px)' : 'auto', overflow: 'auto' }}>
 {children}
 </div>
 </div>
 );
}
