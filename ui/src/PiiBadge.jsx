import React from 'react';

// PII badge — color paired with text always (never color alone).
export default function PiiBadge({ category, attribute, t, size = 'sm' }) {
  if (!category) return null;
  const colorMap = {
    'Client Level Sensitive': t.piiClientLevel,
    'Client and Employee Sensitive': t.piiClientEmployee,
    'Account Level Sensitive': t.piiAccountLevel,
    'Asset Level Sensitive': t.piiAssetLevel,
  };
  const labelMap = {
    'Client Level Sensitive': 'PII \u00b7 CLIENT',
    'Client and Employee Sensitive': 'PII \u00b7 CLIENT/EMP',
    'Account Level Sensitive': 'PII \u00b7 ACCOUNT',
    'Asset Level Sensitive': 'PII \u00b7 ASSET',
  };
  const bg = colorMap[category] || t.piiNone;
  const label = labelMap[category] || 'PII';
  return (
    <span title={attribute ? `${category} \u2014 ${attribute}` : category} style={{
      display: 'inline-block', fontSize: size === 'sm' ? 10 : 11, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.3px', padding: '4px 6px',
      borderRadius: t.radius.sm, color: '#fff', background: bg,
    }}>{label}</span>
  );
}
