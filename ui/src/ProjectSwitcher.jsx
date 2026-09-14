import React from 'react';
import { projLabel } from './bbhTheme.js';

// Tab strip: All / SEI / Non-SEI + per-project multi-select.
export default function ProjectSwitcher({ value, onChange, stats, projects, t }) {
  const tab = (key, label, count) => {
    const active = value === key;
    return (
      <button key={key} onClick={() => onChange(key)} style={{
        height: t.height.btn, padding: '0 14px', border: 'none',
        borderRadius: t.radius.sm, cursor: 'pointer', fontFamily: t.font,
        fontSize: 13, fontWeight: 500, display: 'inline-flex', alignItems: 'center',
        gap: 7, transition: t.transition,
        background: active ? t.navy : t.disabled, color: active ? '#fff' : t.text,
      }}>
        {label}
        {count != null && <span style={{
          fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: t.radius.pill,
          background: active ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
        }}>{count}</span>}
      </button>
    );
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10,
      marginBottom: t.spacing.md, flexWrap: 'wrap' }}>
      {tab('all', 'All', stats?.all)}
      {tab('sei', 'SEI', stats?.sei)}
      {tab('non-sei', 'Non-SEI', stats?.nonSei)}
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.6px', color: t.textMuted, marginLeft: t.spacing.sm }}>
        Filter by project</span>
      <select value={typeof value === 'string' &&
        !['all','sei','non-sei'].includes(value) ? value : ''}
        onChange={e => onChange(e.target.value || 'all')} style={{
          height: t.height.btn, border: `1px solid ${t.border}`,
          borderRadius: t.radius.sm, padding: '0 10px', fontFamily: t.font,
          fontSize: 13, background: t.panel, color: t.text }}>
        <option value="">All projects</option>
        {(projects || []).map(p => (
          <option key={p.project_id} value={p.project_id}>{p.display_name}</option>
        ))}
      </select>
    </div>
  );
}
