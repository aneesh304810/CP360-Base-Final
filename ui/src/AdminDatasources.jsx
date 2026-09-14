import React, { useEffect, useState } from 'react';
import { api } from './api.js';

let T = {};
const mono = { get fontFamily() { return T.mono; } };

const Chip = ({ tone, children }) => {
  const map = {
    green: [T.successBg, T.success], red: [T.dangerBg, T.danger],
    blue: [T.infoBg, T.info], grey: [T.panel2, T.sub],
  };
  const [bg, fg] = map[tone] || map.grey;
  return <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 7px',
    borderRadius: 999, whiteSpace: 'nowrap', background: bg, color: fg }}>
    {children}</span>;
};
const ROLE_CHIP = {
  SYSTEM_OF_RECORD: ['SYSTEM OF RECORD', 'blue'],
  UNDER_TEST: ['UNDER TEST', 'blue'],
  PROFILING: ['PROFILING', 'grey'],
  CATALOG: ['CATALOG', 'grey'],
};
const EMPTY = {
  name: '', role: 'UNDER_TEST', method: 'HOST', host: '', port: 1521,
  service: '', ldap_alias: '', tns_entry: '', schemas: '', username: '',
  thick_mode: 'Y', read_only: 'Y', password: '', env_ref: '',
};

const Fld = ({ label, note, children }) => (
  <div style={{ marginBottom: 11 }}>
    <label style={{ display: 'block', fontSize: 9.5,
      textTransform: 'uppercase', letterSpacing: '.06em', color: T.sub,
      fontWeight: 700, marginBottom: 3 }}>{label}</label>
    {children}
    {note && <div style={{ fontSize: 10, color: T.sub, marginTop: 3 }}>
      {note}</div>}
  </div>);
const inp = { width: '100%', height: 32, border: `1px solid ${T.border}`,
  borderRadius: 2, fontFamily: 'inherit', fontSize: 12.5, padding: '0 9px',
  background: '#fff' };

export default function AdminDatasources({ t }) {
  T = { infoBg: '#e0f5fd', mono: "'Roboto Mono', monospace",
    panel2: '#dfe6e9', navy: '#10193b', info: '#0091bf', ...t };
  const [sources, setSources] = useState([]);
  const [form, setForm] = useState(null);         // null = list only
  const [test, setTest] = useState(null);
  const [saving, setSaving] = useState('');

  const refresh = () => api.dsList().then((d) => setSources(d.sources || []));
  useEffect(refresh, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const runTest = (name) => {
    setTest({ name, steps: ['testing…'] });
    api.dsTest(name).then((r) => { setTest({ name, ...r }); refresh(); });
  };
  const save = () => {
    setSaving('saving…');
    api.dsSave(form).then((r) => {
      setSaving(r.ok ? 'saved ✓' : `failed: ${r.error}`);
      if (r.ok) { refresh(); }
    });
  };

  return (
    <div>
      <h1 style={{ fontSize: 19, fontWeight: 500, margin: '0 0 2px' }}>
        Data Sources</h1>
      <div style={{ color: T.sub, fontSize: 12.5, marginBottom: 13 }}>
        Register Oracle connections once — Variance 360, CLOB Inspector and
        Recon 360 pick them from here · secrets never leave the server,
        never render in the UI</div>

      {/* ---- registered list ---- */}
      <div style={{ background: T.panel, border: `1px solid ${T.border}`,
        borderRadius: 3, boxShadow: '0 3px 5px rgba(0,0,0,.08)',
        overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center',
          padding: '9px 14px', borderBottom: `1px solid ${T.panel2}`,
          background: '#fafcfc' }}>
          <h2 style={{ fontSize: 12, fontWeight: 700,
            textTransform: 'uppercase', margin: 0 }}>
            Registered sources · {sources.length}</h2>
          <span style={{ marginLeft: 'auto', fontSize: 10.5, color: T.sub }}>
            status = last test · used-by shows referencing modules</span>
          <button type="button"
            onClick={() => { setForm({ ...EMPTY }); setTest(null); setSaving(''); }}
            style={{ marginLeft: 12, height: 28, background: T.accent,
              color: '#fff', border: 0, borderRadius: 2, fontSize: 12,
              padding: '0 12px', cursor: 'pointer' }}>
            + New data source</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns:
          '180px 1fr 130px 160px 150px', gap: 11, padding: '6px 14px',
          fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.05em',
          color: T.sub, fontWeight: 700, background: '#fafcfc',
          borderBottom: `1px solid ${T.panel2}` }}>
          <span>Name</span><span>Connection</span><span>Schema(s)</span>
          <span>Role</span><span>Status / actions</span>
        </div>
        {!sources.length && (
          <div style={{ padding: '22px 14px', textAlign: 'center',
            color: T.sub, fontSize: 12.5 }}>
            No sources yet — create the first one.</div>)}
        {sources.map((s) => {
          const [label, tone] = ROLE_CHIP[s.role] || [s.role || '—', 'grey'];
          const connStr = s.method === 'LDAP' ? `LDAP · ${s.ldap_alias}`
            : s.method === 'TNS' ? `TNS · ${s.tns_entry}`
              : `host · ${s.host}:${s.port}/${s.service}`;
          return (
            <div key={s.name} style={{ display: 'grid',
              gridTemplateColumns: '180px 1fr 130px 160px 150px', gap: 11,
              alignItems: 'center', padding: '10px 14px',
              borderBottom: `1px solid ${T.panel2}` }}>
              <div>
                <div style={{ ...mono, fontSize: 11.5, fontWeight: 700,
                  color: T.navy }}>{s.name}</div>
                <div style={{ fontSize: 9.5, color: T.sub }}>
                  {s.username} · {s.thick_mode === 'Y' ? 'thick' : 'thin'}
                  {s.read_only === 'Y' ? ' · read-only' : ''}</div>
              </div>
              <span style={{ ...mono, fontSize: 10, color: T.sub,
                overflowWrap: 'anywhere' }}>{connStr}</span>
              <span style={{ ...mono, fontSize: 10, color: T.sub }}>
                {s.schemas}</span>
              <span><Chip tone={tone}>{label}</Chip></span>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center',
                flexWrap: 'wrap' }}>
                <Chip tone={s.last_test_ok === 'Y' ? 'green'
                  : s.last_test_ok === 'N' ? 'red' : 'grey'}>
                  {s.last_test_ok === 'Y' ? 'OK'
                    : s.last_test_ok === 'N' ? 'FAIL' : 'UNTESTED'}</Chip>
                <button type="button" onClick={() => runTest(s.name)}
                  style={{ border: 0, background: 'none', color: T.accent,
                    textDecoration: 'underline', cursor: 'pointer',
                    fontSize: 11 }}>test</button>
                <button type="button"
                  onClick={() => { setForm({ ...EMPTY, ...s, password: '',
                    env_ref: '' }); setTest(null); setSaving(''); }}
                  style={{ border: 0, background: 'none', color: T.accent,
                    textDecoration: 'underline', cursor: 'pointer',
                    fontSize: 11 }}>edit</button>
              </span>
            </div>);
        })}
        {test && (
          <div style={{ padding: '9px 14px', borderTop:
            `2px solid ${T.accent}`, background: '#fafcfc' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700,
              textTransform: 'uppercase', color: T.sub, marginBottom: 4 }}>
              Test · {test.name}</div>
            <div style={{ ...mono, fontSize: 10.5, lineHeight: 1.7 }}>
              {(test.steps || []).map((st, i) => (
                <div key={i} style={{ color: st.startsWith('✗') ? T.danger
                  : st.startsWith('⚠') ? T.warning : T.text }}>{st}</div>))}
            </div>
          </div>)}
      </div>

      {/* ---- new / edit form ---- */}
      {form && (
        <div style={{ background: T.panel, border: `1px solid ${T.border}`,
          borderRadius: 3, boxShadow: '0 3px 5px rgba(0,0,0,.08)',
          overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center',
            padding: '9px 14px', borderBottom: `1px solid ${T.panel2}`,
            background: '#fafcfc' }}>
            <h2 style={{ fontSize: 12, fontWeight: 700,
              textTransform: 'uppercase', margin: 0 }}>
              {sources.some((s) => s.name === form.name)
                ? `Edit · ${form.name}` : 'New data source'}</h2>
            <span style={{ marginLeft: 'auto', fontSize: 10.5,
              color: T.sub }}>test before save · secret is write-only</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ padding: '14px 16px',
              borderRight: `1px solid ${T.panel2}` }}>
              <Fld label="Display name"
                note="unique key — referenced by profiles and run evidence">
                <input style={{ ...inp, ...mono }} value={form.name}
                  onChange={set('name')} /></Fld>
              <Fld label="Role">
                <select style={inp} value={form.role} onChange={set('role')}>
                  <option value="SYSTEM_OF_RECORD">
                    System of record (side A)</option>
                  <option value="UNDER_TEST">Under test (side B)</option>
                  <option value="PROFILING">Profiling source</option>
                  <option value="CATALOG">Catalog / evidence store</option>
                </select></Fld>
              <Fld label="Connection method">
                <select style={inp} value={form.method}
                  onChange={set('method')}>
                  <option value="HOST">Host / port / service</option>
                  <option value="LDAP">LDAP alias</option>
                  <option value="TNS">TNS entry</option>
                </select></Fld>
              {form.method === 'HOST' && (
                <>
                  <Fld label="Host">
                    <input style={{ ...inp, ...mono }} value={form.host}
                      onChange={set('host')} /></Fld>
                  <div style={{ display: 'grid',
                    gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Fld label="Port">
                      <input style={{ ...inp, ...mono }} value={form.port}
                        onChange={set('port')} /></Fld>
                    <Fld label="Service name">
                      <input style={{ ...inp, ...mono }} value={form.service}
                        onChange={set('service')} /></Fld>
                  </div>
                </>)}
              {form.method === 'LDAP' && (
                <Fld label="LDAP alias"
                  note="jdbc:oracle:thin:@ldap://… form accepted — resolved server-side">
                  <input style={{ ...inp, ...mono }} value={form.ldap_alias}
                    onChange={set('ldap_alias')} /></Fld>)}
              {form.method === 'TNS' && (
                <Fld label="TNS entry">
                  <input style={{ ...inp, ...mono }} value={form.tns_entry}
                    onChange={set('tns_entry')} /></Fld>)}
              <Fld label="Schema(s) — comma separated"
                note="Recon 360 compares like-named tables inside these">
                <input style={{ ...inp, ...mono }} value={form.schemas}
                  onChange={set('schemas')} /></Fld>
            </div>
            <div style={{ padding: '14px 16px' }}>
              <Fld label="Username">
                <input style={{ ...inp, ...mono }} value={form.username}
                  onChange={set('username')} /></Fld>
              <Fld label="Password (one-time)"
                note="stored encrypted server-side (needs CP_DS_MASTER_KEY) — or leave blank and use an env reference below · never shown again">
                <input type="password" style={inp} value={form.password}
                  onChange={set('password')} /></Fld>
              <Fld label="…or env reference"
                note="e.g. CP_DS_SWPUAT_PWD — resolved from the API server's environment (recommended)">
                <input style={{ ...inp, ...mono }} value={form.env_ref}
                  onChange={set('env_ref')} /></Fld>
              <Fld label="Driver options">
                <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                  <label style={{ display: 'flex', gap: 5 }}>
                    <input type="checkbox"
                      checked={form.thick_mode === 'Y'}
                      onChange={(e) => setForm({ ...form,
                        thick_mode: e.target.checked ? 'Y' : 'N' })} />
                    Thick mode (NNE)</label>
                  <label style={{ display: 'flex', gap: 5 }}>
                    <input type="checkbox" checked={form.read_only === 'Y'}
                      onChange={(e) => setForm({ ...form,
                        read_only: e.target.checked ? 'Y' : 'N' })} />
                    Read-only intent</label>
                </div></Fld>
              <div style={{ display: 'flex', gap: 9, marginTop: 10,
                alignItems: 'center' }}>
                <button type="button" onClick={save}
                  style={{ height: 30, background: T.accent, color: '#fff',
                    border: 0, borderRadius: 2, fontSize: 12,
                    padding: '0 14px', cursor: 'pointer' }}>
                  Save data source</button>
                <button type="button"
                  onClick={() => runTest(form.name)}
                  style={{ height: 30, background: '#fff', color: T.accent,
                    border: `1px solid ${T.border}`, borderRadius: 2,
                    fontSize: 12, padding: '0 14px', cursor: 'pointer' }}>
                  Save &amp; test</button>
                <button type="button" onClick={() => setForm(null)}
                  style={{ height: 30, background: 'none', border: 0,
                    color: T.sub, cursor: 'pointer', fontSize: 12 }}>
                  Cancel</button>
                <span style={{ fontSize: 11, color: saving.startsWith('failed')
                  ? T.danger : T.success }}>{saving}</span>
              </div>
            </div>
          </div>
          <div style={{ background: T.infoBg, border: '1px solid #b9d0e8',
            borderRadius: 3, padding: '8px 13px', fontSize: 11.5,
            color: T.accent, margin: '0 16px 14px' }}>
            <b>Security model:</b> credentials are write-only — posted once,
            stored as an encrypted value or env/vault reference keyed by
            source name; every later use resolves the secret server-side.
            Tests and scans log the source name to the evidence trail, never
            the credential.</div>
        </div>)}
    </div>);
}
