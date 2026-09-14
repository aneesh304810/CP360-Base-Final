import React, { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

let T = {};
const mono = { get fontFamily() { return T.mono; } };
const num = (v) => (v == null ? '—' : Number(v).toLocaleString());

const Chip = ({ tone, onClick, children }) => {
  const map = {
    red: [T.dangerBg, T.danger], amber: [T.warningBg, T.warning],
    green: [T.successBg, T.success], grey: [T.panel2, T.sub],
    blue: [T.infoBg, T.info],
  };
  const [bg, fg] = map[tone] || map.grey;
  return <span onClick={onClick} style={{ fontSize: 9.5, fontWeight: 700,
    padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap',
    background: bg, color: fg, cursor: onClick ? 'pointer' : 'default' }}>
    {children}</span>;
};
const Panel = ({ title, hint, children }) => (
  <div style={{ background: T.panel, border: `1px solid ${T.border}`,
    borderRadius: 3, boxShadow: '0 3px 5px rgba(0,0,0,.08)',
    overflow: 'hidden', marginBottom: 14 }}>
    <div style={{ display: 'flex', alignItems: 'center', padding: '9px 14px',
      borderBottom: `1px solid ${T.panel2}`, background: '#fafcfc' }}>
      <h2 style={{ fontSize: 12, fontWeight: 700,
        textTransform: 'uppercase', margin: 0 }}>{title}</h2>
      {hint && <span style={{ marginLeft: 'auto', fontSize: 10.5,
        color: T.sub }}>{hint}</span>}
    </div>
    {children}
  </div>);
const KPI = ({ n, l, tone }) => (
  <div style={{ background: T.panel, border: `1px solid ${T.border}`,
    borderRadius: 3, padding: '9px 13px' }}>
    <div style={{ ...mono, fontSize: 18, fontWeight: 700,
      color: tone === 'r' ? T.danger : tone === 'g' ? T.success
        : tone === 'a' ? T.warning : T.navy }}>{n}</div>
    <div style={{ fontSize: 9.5, textTransform: 'uppercase',
      letterSpacing: '.05em', color: T.sub }}>{l}</div>
  </div>);
const Lbl = ({ children }) => (
  <label style={{ display: 'block', fontSize: 9.5,
    textTransform: 'uppercase', letterSpacing: '.06em', color: T.sub,
    fontWeight: 700, marginBottom: 2 }}>{children}</label>);

export default function Recon360({ t }) {
  T = { infoBg: '#e0f5fd', info: '#0091bf', warningBg: '#fae5d3',
    mono: "'Roboto Mono', monospace", panel2: '#dfe6e9',
    navy: '#10193b', ...t };
  const [srcs, setSrcs] = useState({ a: [], b: [] });
  const [sideA, setSideA] = useState('');
  const [sideB, setSideB] = useState('');
  const [depth, setDepth] = useState('ROWHASH');
  const [scopeSel, setScopeSel] = useState('ALL');
  const [running, setRunning] = useState(null);   // run status object
  const [sum, setSum] = useState(null);
  const [drifts, setDrifts] = useState([]);
  const [openTab, setOpenTab] = useState(null);
  const [breaks, setBreaks] = useState(null);
  const [filter, setFilter] = useState('PROBLEMS');
  const [find, setFind] = useState('');
  const [showGreen, setShowGreen] = useState(false);
  const [rules, setRules] = useState([]);

  const refresh = () => {
    api.reconSummary().then(setSum);
    api.reconSchema().then((d) => setDrifts(d.drifts || []));
    api.reconConfig().then((d) => setRules(d.rules || []));
  };
  useEffect(() => {
    api.reconSources().then((d) => {
      setSrcs(d);
      if (d.a?.length) setSideA(d.a[0].name);
      if (d.b?.length) setSideB(d.b[0].name);
    });
    refresh();
  }, []);

  // poll while a scan runs
  useEffect(() => {
    if (!running || ['COMPLETE', 'FAILED'].includes(running.status)) return;
    const id = setInterval(() => {
      api.reconRun(running.run_id).then((r) => {
        setRunning(r);
        refresh();
        if (['COMPLETE', 'FAILED'].includes(r.status)) clearInterval(id);
      });
    }, 4000);
    return () => clearInterval(id);
  }, [running?.run_id, running?.status]);

  const startScan = () => {
    const reds = (sum?.tables || [])
      .filter((x) => x.status === 'RED').map((x) => x.table_name);
    api.reconScan({
      side_a: sideA, side_b: sideB, depth,
      tables: scopeSel === 'BREAKS' && reds.length ? reds.join(',') : null,
    }).then((r) => setRunning({ ...r }));
  };

  const openBreaks = (tab) => {
    if (openTab === tab) { setOpenTab(null); return; }
    setOpenTab(tab);
    setBreaks(null);
    api.reconBreaks(tab).then(setBreaks);
  };

  const tables = sum?.tables || [];
  const run = sum?.run;
  const reds = tables.filter((x) => x.status === 'RED');
  const greens = tables.filter((x) => x.status === 'GREEN');
  const rowsInBreak = reds.reduce((a, x) => a
    + Number(x.missing_b || 0) + Number(x.extra_b || 0)
    + Number(x.mismatch || 0), 0);
  const visible = useMemo(() => {
    let v = filter === 'PROBLEMS' ? reds : tables;
    if (find) v = v.filter((x) => x.table_name.includes(find.toUpperCase()));
    return v;
  }, [tables, filter, find]);

  const scanning = running && !['COMPLETE', 'FAILED'].includes(running.status);

  return (
    <div>
      <h1 style={{ fontSize: 19, fontWeight: 500, margin: '0 0 2px' }}>
        Recon 360 — Prod Parallel Reconciliation</h1>
      <div style={{ color: T.sub, fontSize: 12.5, marginBottom: 13 }}>
        Same-schema comparison · schema ⇄ aggregates ⇄ row hashes ⇄ column
        diffs · tolerance-ruled · evidence-tagged</div>

      {/* ---- scan setup ---- */}
      <Panel title="Reconciliation scan"
        hint="sources from Admin › Data Sources · results stream in as tables land">
        <div style={{ padding: '10px 14px', display: 'flex', gap: 11,
          alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div><Lbl>Side A · system of record</Lbl>
            <select value={sideA} onChange={(e) => setSideA(e.target.value)}
              style={{ height: 30, minWidth: 210, fontSize: 12 }}>
              {(srcs.a || []).map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name} ({s.schemas})</option>))}
            </select></div>
          <div><Lbl>Side B · under test</Lbl>
            <select value={sideB} onChange={(e) => setSideB(e.target.value)}
              style={{ height: 30, minWidth: 210, fontSize: 12 }}>
              {(srcs.b || []).map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name} ({s.schemas})</option>))}
            </select></div>
          <div><Lbl>Scope</Lbl>
            <select value={scopeSel}
              onChange={(e) => setScopeSel(e.target.value)}
              style={{ height: 30, minWidth: 170, fontSize: 12 }}>
              <option value="ALL">All common tables</option>
              <option value="BREAKS">
                Only current breaks ({reds.length})</option>
            </select></div>
          <div><Lbl>Depth</Lbl>
            <select value={depth} onChange={(e) => setDepth(e.target.value)}
              style={{ height: 30, minWidth: 170, fontSize: 12 }}>
              <option value="SCHEMA">Schema only (fast)</option>
              <option value="AGG">Schema + aggregates</option>
              <option value="ROWHASH">+ row hash (PK tables)</option>
            </select></div>
          <button type="button" onClick={startScan} disabled={scanning}
            style={{ height: 30, background: scanning ? T.sub : T.accent,
              color: '#fff', border: 0, borderRadius: 2, fontSize: 12,
              fontWeight: 500, padding: '0 16px', cursor: 'pointer' }}>
            {scanning ? 'scanning…' : '▶ Run scan'}</button>
          {running && (
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between',
                ...mono, fontSize: 9.5, color: T.sub }}>
                <span>{running.status} · {running.tables_done ?? 0}/
                  {running.tables_total ?? '?'} tables</span>
                <span>{running.run_id}</span>
              </div>
              <div style={{ height: 8, background: '#eef1f4',
                borderRadius: 2, overflow: 'hidden' }}>
                <i style={{ display: 'block', height: '100%',
                  width: `${running.tables_total
                    ? (100 * (running.tables_done || 0))
                      / running.tables_total : 3}%`,
                  background: running.status === 'FAILED'
                    ? T.danger : T.info }} />
              </div>
              <div style={{ ...mono, fontSize: 9, color:
                running.status === 'FAILED' ? T.danger : T.sub,
                marginTop: 2 }}>
                {running.error_text || running.step || ''}</div>
            </div>)}
        </div>
      </Panel>

      {run && (
        <>
          {/* ---- sides + KPIs ---- */}
          <div style={{ display: 'grid',
            gridTemplateColumns: '1fr 46px 1fr', gap: 0,
            marginBottom: 13, alignItems: 'center' }}>
            <div style={{ background: T.panel,
              border: `1px solid ${T.border}`, borderRadius: 3,
              padding: '8px 14px' }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase',
                letterSpacing: '.06em', color: T.sub, fontWeight: 700 }}>
                Side A — system of record</div>
              <div style={{ ...mono, fontSize: 12, fontWeight: 700,
                color: T.navy }}>{run.side_a} · {run.schema_a}</div>
            </div>
            <div style={{ textAlign: 'center', ...mono, fontWeight: 700,
              color: T.accent }}>⇄</div>
            <div style={{ background: T.panel,
              border: `1px solid ${T.border}`, borderRadius: 3,
              padding: '8px 14px' }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase',
                letterSpacing: '.06em', color: T.sub, fontWeight: 700 }}>
                Side B — under test</div>
              <div style={{ ...mono, fontSize: 12, fontWeight: 700,
                color: T.navy }}>{run.side_b} · {run.schema_b}</div>
            </div>
          </div>
          <div style={{ display: 'grid',
            gridTemplateColumns: 'repeat(6,1fr)', gap: 10,
            marginBottom: 13 }}>
            <KPI n={tables.length} l="Tables compared" />
            <KPI n={greens.length} l="Fully reconciled" tone="g" />
            <KPI n={sum.schema_drift} l="Schema drifts" tone="a" />
            <KPI n={reds.length} l="Data breaks" tone="r" />
            <KPI n={num(rowsInBreak)} l="Rows in break" tone="r" />
            <KPI n={run.match_rate != null ? `${run.match_rate}%` : '—'}
              l={`Match rate · ${run.started_at}`} />
          </div>

          {/* ---- triage + heatmap ---- */}
          <div style={{ display: 'flex', gap: 7, alignItems: 'center',
            marginBottom: 10, flexWrap: 'wrap' }}>
            <Chip tone="red" onClick={() => setFilter('PROBLEMS')}>
              RED {reds.length}</Chip>
            <Chip tone="amber" onClick={() => setFilter('ALL')}>
              DRIFT {sum.schema_drift}</Chip>
            <Chip tone="green" onClick={() => setShowGreen(!showGreen)}>
              GREEN {greens.length} {showGreen ? '(shown)' : '(hidden)'}</Chip>
            <Chip tone="grey" onClick={() => setFilter('ALL')}>ALL</Chip>
            <input placeholder="find table…" value={find}
              onChange={(e) => setFind(e.target.value)}
              style={{ height: 24, fontSize: 11,
                border: `1px solid ${T.border}`, borderRadius: 2,
                padding: '0 8px', marginLeft: 'auto', width: 180 }} />
          </div>
          <Panel title={`Estate at a glance · ${tables.length} tables`}
            hint="one cell per table · click to open · hover for name">
            <div style={{ padding: '10px 14px', display: 'flex',
              flexWrap: 'wrap', gap: 3 }}>
              {tables.map((x) => (
                <i key={x.table_name} title={`${x.table_name} · ${x.status}`}
                  onClick={() => openBreaks(x.table_name)}
                  style={{ width: 16, height: 16, borderRadius: 2,
                    cursor: 'pointer',
                    background: x.status === 'RED' ? T.danger
                      : x.status === 'AMBER' ? T.warning : T.success,
                    opacity: x.status === 'GREEN' ? 0.35 : 1 }} />))}
            </div>
          </Panel>

          {/* ---- schema drift ---- */}
          {drifts.length > 0 && (
            <Panel title={`Schema reconciliation · ${drifts.length} drifts`}
              hint="caught before the data pass — fix the dbt model, not the data">
              {drifts.map((d, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns:
                  '190px 120px 1fr 1fr 90px', gap: 11,
                  alignItems: 'center', padding: '9px 14px',
                  borderBottom: `1px solid ${T.panel2}` }}>
                  <div style={{ ...mono, fontSize: 11.5, fontWeight: 700,
                    color: T.navy }}>{d.table_name}
                    <div style={{ fontFamily: 'Roboto', fontWeight: 400,
                      fontSize: 9.5, color: T.sub }}>
                      {d.column_name || ''}</div></div>
                  <Chip tone="amber">{d.drift_type}</Chip>
                  <span style={{ ...mono, fontSize: 10, color: T.sub }}>
                    A: <b style={{ color: T.navy }}>{d.a_def}</b></span>
                  <span style={{ ...mono, fontSize: 10,
                    color: T.danger }}>B: {d.b_def}</span>
                  <Chip tone={d.severity === 'FIX_FIRST' ? 'red' : 'amber'}>
                    {d.severity === 'FIX_FIRST' ? 'FIX FIRST' : 'DRIFT'}
                  </Chip>
                </div>))}
            </Panel>)}

          {/* ---- data breaks ---- */}
          <Panel title="Data reconciliation · tables by break severity"
            hint="aggregates per column · row-hash on PK · click for column-level diff">
            {visible.map((x) => (
              <React.Fragment key={x.table_name}>
                <div onClick={() => openBreaks(x.table_name)}
                  style={{ display: 'grid', gridTemplateColumns:
                    '210px 150px 1fr 1fr 64px', gap: 11,
                    alignItems: 'center', padding: '9px 14px',
                    borderBottom: `1px solid ${T.panel2}`,
                    cursor: 'pointer',
                    background: openTab === x.table_name
                      ? T.infoBg : undefined }}>
                  <div style={{ ...mono, fontSize: 11.5, fontWeight: 700,
                    color: T.navy }}>{x.table_name}
                    <div style={{ fontFamily: 'Roboto', fontWeight: 400,
                      fontSize: 9.5, color: T.sub }}>
                      {x.pk_cols ? `PK: ${x.pk_cols}`
                        : x.note || 'no PK — aggregates only'}</div></div>
                  <span style={{ ...mono, fontSize: 10.5 }}>
                    <span style={{ color: T.accent }}>
                      A {num(x.cnt_a)}</span>{' '}
                    <span style={{ color: '#7c3aed' }}>
                      B {num(x.cnt_b)}</span></span>
                  <span style={{ ...mono, fontSize: 10, color: T.sub,
                    overflowWrap: 'anywhere' }}>
                    {x.metric_breaks
                      ? <span style={{ color: T.danger }}>
                          {x.metric_breaks.slice(0, 90)}</span>
                      : x.status === 'GREEN'
                        ? `CNT ✓ · ${x.cols_compared} col metrics ✓`
                        : '—'}</span>
                  <span style={{ ...mono, fontSize: 10, color: T.sub }}>
                    missing B: <b style={{ color: x.missing_b
                      ? T.danger : T.navy }}>{num(x.missing_b)}</b>
                    {' '}· extra B: <b style={{ color: x.extra_b
                      ? T.danger : T.navy }}>{num(x.extra_b)}</b>
                    {' '}· mismatch: <b style={{ color: x.mismatch
                      ? T.danger : T.navy }}>{num(x.mismatch)}</b></span>
                  <Chip tone={x.status === 'RED' ? 'red'
                    : x.status === 'AMBER' ? 'amber' : 'green'}>
                    {x.status}</Chip>
                </div>
                {openTab === x.table_name && (
                  <div style={{ background: '#fbfcfd',
                    borderTop: `2px solid ${T.accent}`,
                    borderBottom: `1px solid ${T.panel2}`,
                    padding: '13px 16px' }}>
                    {!breaks ? <div style={{ fontSize: 11.5,
                      color: T.sub }}>loading…</div> : (
                      <>
                        {breaks.signature?.length > 0 && (
                          <>
                            <h3 style={{ fontSize: 10.5,
                              textTransform: 'uppercase',
                              letterSpacing: '.06em', color: T.sub,
                              margin: '0 0 7px' }}>
                              Break signatures · mismatches decompose into</h3>
                            {breaks.signature.map((s, i) => (
                              <div key={i} style={{ display: 'flex', gap: 8,
                                alignItems: 'center', padding: '5px 10px',
                                fontSize: 11, borderBottom:
                                  `1px solid ${T.panel2}` }}>
                                <Chip tone="red">{num(s.n)}</Chip>
                                <span style={{ ...mono, fontSize: 10.5 }}>
                                  {s.cols_differ}</span>
                              </div>))}
                          </>)}
                        <h3 style={{ fontSize: 10.5,
                          textTransform: 'uppercase',
                          letterSpacing: '.06em', color: T.sub,
                          margin: '12px 0 7px' }}>
                          Sample breaks · PII-masked per dictionary</h3>
                        <div style={{ display: 'grid', gridTemplateColumns:
                          '150px 90px 1fr 1fr', gap: 10, padding: '4px 10px',
                          fontSize: 9.5, textTransform: 'uppercase',
                          color: T.sub, fontWeight: 700,
                          background: '#fafcfc' }}>
                          <span>PK</span><span>Type</span>
                          <span>Side A</span><span>Side B</span>
                        </div>
                        {(breaks.breaks || []).slice(0, 30).map((b, i) => (
                          <div key={i} style={{ display: 'grid',
                            gridTemplateColumns: '150px 90px 1fr 1fr',
                            gap: 10, padding: '6px 10px', ...mono,
                            fontSize: 10.5, borderBottom:
                              `1px solid ${T.panel2}`,
                            alignItems: 'center' }}>
                            <span>{b.pk_value}</span>
                            <Chip tone={b.break_type === 'MISMATCH'
                              ? 'red' : 'amber'}>{b.break_type}</Chip>
                            <span style={{ color: T.accent,
                              overflowWrap: 'anywhere' }}>
                              {b.a_values || '—'}</span>
                            <span style={{ color: '#7c3aed',
                              overflowWrap: 'anywhere' }}>
                              {b.b_values || (b.break_type === 'MISSING_B'
                                ? 'row absent' : '—')}</span>
                          </div>))}
                      </>)}
                  </div>)}
              </React.Fragment>))}
            {filter === 'PROBLEMS' && greens.length > 0 && (
              <div onClick={() => setShowGreen(!showGreen)}
                style={{ padding: '9px 14px', display: 'flex', gap: 10,
                  alignItems: 'center', background: '#f6faf7',
                  cursor: 'pointer' }}>
                <Chip tone="green">{greens.length} GREEN</Chip>
                <span style={{ fontSize: 12, color: T.sub }}>
                  fully reconciled — counts, metrics and row hashes match
                  with tolerances applied · click to
                  {showGreen ? ' hide' : ' expand'}</span>
              </div>)}
            {showGreen && filter === 'PROBLEMS' && greens.map((x) => (
              <div key={x.table_name} style={{ display: 'grid',
                gridTemplateColumns: '210px 150px 1fr 64px', gap: 11,
                padding: '7px 14px', borderBottom:
                  `1px solid ${T.panel2}`, alignItems: 'center' }}>
                <span style={{ ...mono, fontSize: 11, color: T.navy }}>
                  {x.table_name}</span>
                <span style={{ ...mono, fontSize: 10, color: T.sub }}>
                  A/B {num(x.cnt_a)}</span>
                <span style={{ ...mono, fontSize: 10, color: T.sub }}>
                  {x.cols_compared} col metrics ✓
                  {x.pk_cols ? ' · row hash ✓' : ''}</span>
                <Chip tone="green">GREEN</Chip>
              </div>))}
          </Panel>

          {/* ---- tolerance rules ---- */}
          <Panel title="Tolerance rules · governed config, not code"
            hint="recon_pr_config · every rule is evidence — what you ignore, and why">
            {rules.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 8,
                alignItems: 'center', padding: '5px 12px', fontSize: 11,
                borderBottom: `1px solid ${T.panel2}` }}>
                <code style={{ ...mono, fontSize: 10,
                  background: T.panel2, padding: '1px 5px',
                  borderRadius: 2 }}>{r.scope}</code>
                <b style={{ fontSize: 10.5 }}>{r.rule_type}</b>
                {r.column_name && <span style={{ ...mono, fontSize: 10.5 }}>
                  {r.column_name}</span>}
                <span style={{ ...mono, fontSize: 10.5, color: T.sub }}>
                  {r.rule_value}</span>
                {r.note && <span style={{ color: T.sub }}>— {r.note}</span>}
              </div>))}
          </Panel>
        </>)}
      {!run && !scanning && (
        <div style={{ padding: '30px 14px', textAlign: 'center',
          color: T.sub, fontSize: 12.5 }}>
          No reconciliation runs yet — configure both sides in
          Admin › Data Sources, then run the first scan above.</div>)}
    </div>);
}
