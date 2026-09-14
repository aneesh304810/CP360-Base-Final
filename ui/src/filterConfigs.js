// Filter configs for each module's GraphFilterBar. Project filters included.
export const interface360Filters = (facets = {}) => ({
  required: [
    { key: 'source_system', label: 'Source System', type: 'multi', searchable: true,
      options: (facets.source_system || []).map(f => ({ value: f.value, label: f.value, count: f.count })) },
    { key: 'target_system', label: 'Target System', type: 'multi', searchable: true,
      options: (facets.target_system || []).map(f => ({ value: f.value, label: f.value, count: f.count })) },
    { key: 'feed_type', label: 'Feed Type', type: 'multi',
      options: (facets.feed_type || []).map(f => ({ value: f.value, label: f.value, count: f.count })) },
    { key: 'direction', label: 'Direction', type: 'single',
      options: [{ value: 'Inbound', label: 'Inbound' }, { value: 'Outbound', label: 'Outbound' }] },
  ],
  optional: [
    { key: 'source_project_id', label: 'Source Project', type: 'multi',
      options: (facets.source_project || []).map(f => ({ value: f.value, label: f.value, count: f.count })) },
    { key: 'target_project_id', label: 'Target Project', type: 'multi',
      options: (facets.target_project || []).map(f => ({ value: f.value, label: f.value, count: f.count })) },
    { key: 'migration_flag', label: 'Migration', type: 'single',
      options: [{ value: 'Y', label: 'Replacing' }, { value: 'N', label: 'Stable' }] },
    { key: 'carries_pii', label: 'PII Status', type: 'single',
      options: [{ value: 'Y', label: 'Carries PII' }, { value: 'N', label: 'No PII' }] },
  ],
  densityThreshold: 80, alternativeView: 'Matrix',
});

export const data360LineageFilters = (facets = {}) => ({
  required: [
    { key: 'plane', label: 'Plane', type: 'single',
      options: [{ value: 'data', label: 'Data' }, { value: 'transform', label: 'Transform' },
        { value: 'orchestration', label: 'Orchestration' }] },
    { key: 'layer', label: 'Layer', type: 'multi',
      options: [{ value: 'bronze', label: 'Bronze' }, { value: 'silver', label: 'Silver' },
        { value: 'gold', label: 'Gold' }] },
  ],
  optional: [
    { key: 'project_id', label: 'Project', type: 'multi',
      options: [{ value: 'sei', label: 'SEI' }, { value: 'internal', label: 'Internal' }] },
    { key: 'object_type', label: 'Object Type', type: 'multi',
      options: ['TABLE', 'VIEW', 'FEED', 'MODEL', 'DAG'].map(v => ({ value: v, label: v })) },
    { key: 'feed_class', label: 'Feed Class', type: 'single',
      options: [{ value: 'standard', label: 'Standard' }, { value: 'supplemental', label: 'Supplemental' }] },
    { key: 'geography', label: 'Geography', type: 'single',
      options: [{ value: 'US', label: 'US' }, { value: 'UK', label: 'UK' }] },
  ],
  densityThreshold: 50, alternativeView: 'Table',
});

export const datapoint360Filters = () => ({
  required: [
    { key: 'datapoint', label: 'Datapoint', type: 'single', searchable: true },
    { key: 'modules', label: 'Show in modules', type: 'multi',
      options: ['interface360', 'api360', 'data360'].map(v => ({ value: v, label: v })) },
  ],
  optional: [
    { key: 'project_id', label: 'Show in projects', type: 'multi',
      options: [{ value: 'sei', label: 'SEI' }, { value: 'internal', label: 'Internal' }] },
    { key: 'cross_project', label: 'Cross-project only', type: 'toggle' },
  ],
});
