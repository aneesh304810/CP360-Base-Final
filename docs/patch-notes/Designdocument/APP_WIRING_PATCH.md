# App-level wiring — the edits OUTSIDE the module files (App.jsx / AppShell.jsx
# / navStatus.jsx / api.js / mockData.js). Exact code, copy-paste ready.
# I do not have your App.jsx source — these blocks follow your established
# conventions (NAV_GROUPS triples, route switch on nav id, MODULE_STATUS).
# Paste your App.jsx if you want these applied to the actual file.

## 1 · App.jsx — imports (top, with the other module imports)
    import LineageHome from './LineageHome.jsx';
    import Environment360 from './Environment360.jsx';
(Remove/keep the old LegacyLineage import per note in step 2 — LineageHome
imports LegacyLineage itself, so App.jsx no longer needs it directly.)

## 2 · App.jsx — the route switch (wherever nav id -> component renders)
REPLACE the existing lineage case (your old wrapper / direct LegacyLineage):
    case 'lineage':
      return <LineageHome t={t} focus={lineageFocus} />;
ADD the new case:
    case 'environment':
      return <Environment360 t={t} />;
Notes:
- lineageFocus = whatever object you already pass for search / Datapoint 360
  deep-links ({table, column, dataSource?}). If you pass nothing today, just
  <LineageHome t={t} /> works — the focus prop is optional.
- If your old lineage wrapper rendered a warehouse chip, delete the wrapper;
  LineageHome owns the chip now.

## 3 · AppShell.jsx — NAV_GROUPS (Admin group)
ADD after your existing Admin entries (datasources / apicatalog):
    ['environment', 'Environment 360', '🖧'],
The 'lineage' entry stays exactly as it is — same id, same position.

## 4 · navStatus.jsx — MODULE_STATUS
ADD:
    environment: { state: 'wip', pct: 60,
      works: 'certs · health · pulse',
      next: 'topology seed · alert routing' },
Optionally update the lineage entry (or delete it once verified — absence
means shipped).

## 5 · api.js — paste the 7 Environment 360 helpers
From env360_api_additions.js, inside the api object:
    envOverview: () => get('/env/overview', () => MOCK.envOverview()),
    envCerts: () => get('/env/certs', () => MOCK.envCerts()),
    envScanCerts: () => post('/env/certs/scan', {}, () => ({ ok: true })),
    envHealth: () => get('/env/health', () => MOCK.envHealth()),
    envTopology: () => get('/env/topology', () => MOCK.envTopology()),
    envPulse: () => get('/env/pulse', () => MOCK.envPulse()),
    envRunPulse: () => post('/env/pulse/run', {}, () => ({ ok: true })),
(Adjust get/post signatures to your api.js helpers if they differ — the
route strings and MOCK names are the contract.)

## 6 · mockData.js — paste the 5 exports
From env360_mockData_additions.js: envOverview, envCerts, envHealth,
envTopology, envPulse (whole-file copy of the exports).

## Lineage needs NO api.js / mockData changes — BizLineage and LineageHome
## call only endpoints your LegacyLineage already uses.

## Smoke after wiring
- Left nav shows Environment 360 with the amber IN BUILD dot (Admin group)
- Nav → Lineage → landing with PBDW/IMDS cards and 📖/🛠 doors
- Nav → Environment 360 → five tabs render (DEMO data until router mounted)
