// BBH v6 design tokens — light + dark, with project palette.
export const tLight = {
  bg: '#f5f8f8', panel: '#ffffff', panel2: '#dfe6e9', border: '#b5b6b6',
  text: '#333333', sub: '#666666', textMuted: '#999999',
  navy: '#10193b', accent: '#0f4775', muted: '#5f87a7', tint: '#cae3ee',
  pop: '#31bced', hover: '#0091bf', hoverBg: '#eee', disabled: '#dbdae0',
  success: '#159943', successBg: '#d0ebd9', danger: '#c1113a', dangerBg: '#f3d2d7',
  warning: '#e67e22', warningBg: '#fae5d3', info: '#0091bf', infoBg: '#e0f5fd',
  modInterface: '#10193b', modApi: '#0091bf', modData: '#0f4775', modDatapoint: '#159943',
  projSei: '#0091bf', projBloomberg: '#000000', projPivotal: '#7c3aed',
  projAddvantage: '#ea580c', projCharlesRiver: '#2563eb', projInternal: '#0f4775',
  projOther: '#999999', catSei: '#0091bf', catNonSei: '#5f87a7',
  piiClientLevel: '#c1113a', piiClientEmployee: '#c1113a', piiAccountLevel: '#e67e22',
  piiAssetLevel: '#0091bf', piiNone: '#999999',
  bronze: '#b45309', silver: '#64748b', gold: '#ca8a04', layerNone: '#cbd5e1',
  font: "Roboto, 'Helvetica Neue', Arial, sans-serif",
  height: { btn: 34, btnSm: 29, input: 34, inputSm: 29 },
  spacing: { xs: 5, sm: 10, md: 20, lg: 30, xl: 40, xxl: 50 },
  radius: { sm: 2, md: 3, pill: 999 },
  shadow: {
    reg: '0 3px 5px rgba(0,0,0,0.2)', sm: '0 5px 20px rgba(0,0,0,0.1)',
    lg: '0 10px 30px rgba(0,0,0,0.18)',
  },
  transition: '0.25s ease-out', minWidth: 1263,
};

export const tDark = {
  ...tLight,
  bg: '#0b1220', panel: '#0f172a', panel2: '#111c34', border: '#1e293b',
  text: '#e2e8f0', sub: '#94a3b8', textMuted: '#64748b', hoverBg: '#111c34',
  navy: '#0a0f24',
};

// project_id -> color token
export function projColor(t, projectId) {
  return {
    sei: t.projSei, bloomberg: t.projBloomberg, pivotal: t.projPivotal,
    addvantage: t.projAddvantage, charles_river: t.projCharlesRiver,
    internal: t.projInternal, other: t.projOther,
  }[projectId] || t.projOther;
}

export function projLabel(projectId) {
  return {
    sei: 'SEI', bloomberg: 'Bloomberg', pivotal: 'Pivotal',
    addvantage: 'AddVantage', charles_river: 'Charles River',
    internal: 'Internal', other: 'Other',
  }[projectId] || projectId;
}
