import React from 'react';
import { projColor, projLabel } from './bbhTheme.js';

// Small pill chip: colored dot + project label.
export default function ProjectBadge({ projectId, t, title }) {
  if (!projectId) return null;
  const c = projColor(t, projectId);
  return (
    <span title={title || projLabel(projectId)} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11,
      fontWeight: 600, padding: '2px 8px', borderRadius: t.radius.pill,
      background: c + '1f', color: c, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />
      {projLabel(projectId)}
    </span>
  );
}
