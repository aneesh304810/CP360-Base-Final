// navStatus.jsx — module status badges for the CP 360 left nav.
// Single source of truth: edit MODULE_STATUS only; dot, tag, tooltip and
// legend all derive from it. Live modules stay unmarked (calm by default).
import React from 'react';

export const MODULE_STATUS = {
  mapper:      { state: 'wip', pct: 45,
    works: 'Plaid ingested · embedding shortlist',
    next: 'LLM judgment batch · review queue' },
  pii:         { state: 'wip', pct: 70,
    works: 'PII taxonomy · field flags',
    next: 'masking policy preview' },
  guardrails:  { state: 'wip', pct: 60,
    works: 'rules engine · thresholds',
    next: 'alert routing tuning' },
  recon:       { state: 'wip', pct: 80,
    works: 'three-pass recon engine',
    next: 'scheduling · break aging' },
  apiconsole:  { state: 'wip', pct: 85,
    works: 'console · guided · collections',
    next: 'first live SEI run sign-off' },
  datasources: { state: 'wip', pct: 75,
    works: 'register · test · store',
    next: 'vault-ref secrets' },
  apicatalog:  { state: 'wip', pct: 85,
    works: 'registry · manifest · versions · flow composer',
    next: 'drop legacy tables after verification' },
  environment: { state: 'wip', pct: 60,
    works: 'certs · health · pulse',
    next: 'topology seed · alert routing' },
  hub: { state: "wip", pct: 75 },
  // other states when needed:
  // somekey: { state: 'beta', works: '...', next: '...' },
  // somekey: { state: 'planned', note: '...' },
};

const C = { wip: '#e67e22', beta: '#31bced', planned: 'transparent' };

export function NavBadge({ id }) {
  const st = MODULE_STATUS[id];
  if (!st) return null;                       // live -> no mark
  const label = st.state === 'wip' ? 'IN BUILD'
    : st.state === 'beta' ? 'BETA' : 'PLANNED';
  const tip = st.state === 'planned'
    ? (st.note || 'planned — not started')
    : `${label} ${st.pct != null ? st.pct + '%' : ''}\nWorks: ${st.works}\nNext: ${st.next}`;
  return (
    <span title={tip} style={{ display: 'inline-flex', alignItems: 'center',
      gap: 5, marginLeft: 'auto' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%',
        background: C[st.state],
        border: st.state === 'planned' ? '1.5px dashed #6d84a3' : 'none',
        animation: st.state === 'wip' ? 'cpPulse 1.6s infinite' : 'none' }} />
      <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '.05em',
        borderRadius: 999, padding: '1px 6px',
        background: st.state === 'planned' ? 'transparent' : C[st.state],
        border: st.state === 'planned' ? '1px solid #6d84a3' : 'none',
        color: st.state === 'beta' ? '#10193b'
          : st.state === 'planned' ? '#8fa3bd' : '#fff' }}>{label}</span>
    </span>);
}

export function NavLegend() {
  return (
    <div style={{ marginTop: 'auto', padding: '10px 16px',
      borderTop: '1px solid #223059', fontSize: 10, color: '#8fa3bd',
      lineHeight: 2 }}>
      <style>{'@keyframes cpPulse{0%,100%{opacity:1}50%{opacity:.35}}'}</style>
      <div>live — no mark</div>
      <div><span style={{ display: 'inline-block', width: 7, height: 7,
        borderRadius: '50%', background: '#e67e22', marginRight: 6 }} />
        in build — usable parts marked on the page</div>
      <div><span style={{ display: 'inline-block', width: 7, height: 7,
        borderRadius: '50%', border: '1.5px dashed #6d84a3',
        marginRight: 6 }} />planned — honest, dimmed</div>
    </div>);
}
