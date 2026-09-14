import React, { useState, useEffect, useCallback, useRef } from 'react';

// Universal filter bar above every graph. Default top-20, auto-apply, faceted
// counts, removable chips, density warning, keyboard f/c. URL-synced by parent.
export default function GraphFilterBar({
  moduleKey, required = [], optional = [], values = {}, resultCount = 0,
  totalCount = 0, nodeCount = 0, densityThreshold = 60, alternativeView,
  onChange, onClear, onSwitchView, t,
}) {
  const [open, setOpen] = useState(null);
  const barRef = useRef(null);

  const onKey = useCallback((e) => {
    if (e.key === 'Escape') { setOpen(null); return; }
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.key === 'f') { e.preventDefault(); setOpen(required[0]?.key || null); }
    if (e.key === 'c') { e.preventDefault(); onClear && onClear(); }
  }, [required, onClear]);
  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  // close the open dropdown when clicking anywhere outside the filter bar.
  // mousedown (not click) so it fires before the click lands elsewhere, and
  // pointerdown covers touch. Listener attached only while a menu is open.
  useEffect(() => {
    if (!open) return;
    const onOutside = (e) => {
      if (barRef.current && !barRef.current.contains(e.target)) setOpen(null);
    };
    document.addEventListener('pointerdown', onOutside);
    return () => document.removeEventListener('pointerdown', onOutside);
  }, [open]);

  const set = (key, val) => onChange && onChange({ ...values, [key]: val });

  const chip = (f, isReq) => {
    const active = values[f.key] != null && values[f.key] !== '' &&
      !(Array.isArray(values[f.key]) && values[f.key].length === 0);
    return (
      <div key={f.key} style={{ position: 'relative' }}>
        <button onClick={() => setOpen(open === f.key ? null : f.key)} style={{
          height: t.height.btnSm, padding: '0 10px', border: `1px solid ${active ? t.navy : t.border}`,
          borderRadius: t.radius.sm, background: active ? t.navy : t.panel,
          color: active ? '#fff' : t.text, fontSize: 12, fontFamily: t.font,
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          {f.label}{active && Array.isArray(values[f.key]) ? ` (${values[f.key].length})` : ''}
          <span style={{ fontSize: 10 }}>{'\u25BE'}</span>
        </button>
        {open === f.key && f.options && (
          <div style={{ position: 'absolute', top: '105%', left: 0, zIndex: 30,
            background: t.panel, border: `1px solid ${t.border}`, borderRadius: t.radius.md,
            boxShadow: t.shadow.sm, minWidth: 180, maxHeight: 260, overflow: 'auto', padding: 5 }}>
            {f.options.map(o => {
              const sel = Array.isArray(values[f.key])
                ? values[f.key].includes(o.value) : values[f.key] === o.value;
              return (
                <div key={o.value} onClick={() => {
                  if (f.type === 'multi') {
                    const cur = values[f.key] || [];
                    set(f.key, sel ? cur.filter(x => x !== o.value) : [...cur, o.value]);
                  } else { set(f.key, sel ? '' : o.value); setOpen(null); }
                }} style={{
                  padding: '6px 10px', fontSize: 12, cursor: 'pointer', borderRadius: t.radius.sm,
                  background: sel ? t.infoBg : 'transparent', color: sel ? t.info : t.text,
                  display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span>{o.label}</span>
                  {o.count != null && <span style={{ color: t.textMuted, fontSize: 11 }}>{o.count}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const activeChips = [...required, ...optional].filter(f => {
    const v = values[f.key];
    return v != null && v !== '' && !(Array.isArray(v) && v.length === 0);
  });

  return (
    <div ref={barRef} style={{ background: t.panel, border: `1px solid ${t.disabled}`,
      borderRadius: t.radius.md, padding: '15px 20px', marginBottom: t.spacing.md }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.6px', color: t.textMuted, marginRight: 5 }}>Required</span>
        {required.map(f => chip(f, true))}
      </div>
      {optional.length > 0 && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.6px', color: t.textMuted, marginRight: 5 }}>Optional</span>
          {optional.map(f => chip(f, false))}
        </div>
      )}
      {activeChips.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {activeChips.map(f => (
            <button key={f.key} onClick={() => set(f.key, Array.isArray(values[f.key]) ? [] : '')}
              style={{ height: 24, padding: '0 8px', border: `1px solid ${t.info}`,
                borderRadius: t.radius.sm, background: t.infoBg, color: t.info, fontSize: 11,
                cursor: 'pointer', fontFamily: t.font }}>
              {f.label} {'\u00d7'}
            </button>
          ))}
        </div>
      )}
      <div style={{ marginTop: 12, fontSize: 12, color: t.sub, display: 'flex',
        gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <span>Showing <b>{resultCount}</b> of <b>{totalCount}</b></span>
        {nodeCount > densityThreshold && alternativeView && (
          <span style={{ color: t.warning, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {'\u26A0'} {nodeCount} nodes &mdash; dense.
            <button onClick={() => onSwitchView && onSwitchView(alternativeView)} style={{
              border: 'none', background: 'none', color: t.hover, cursor: 'pointer',
              fontFamily: t.font, fontSize: 12, textDecoration: 'underline' }}>
              Switch to {alternativeView}</button>
          </span>
        )}
        <span style={{ color: t.hover }}>Press <b>f</b> filter &middot; <b>c</b> clear</span>
      </div>
    </div>
  );
}
