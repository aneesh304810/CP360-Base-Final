// Event 360 — the SEI event contract, who consumes it, and what it costs.
//
// THREE SOURCES, NEVER BLENDED ON SCREEN
//
//   the CONTRACT      what SEI says an event is          (meta_event_*)
//   OUR DECISIONS     who consumes it, how critical      (ctl_event_*, ref_*)
//   the MEASURED BILL warehouse time per SDC view        (meta_sdc_compute_*)
//
// Every panel says which of the three it is showing. A criticality band is
// ours; if it reaches a screen looking like a specification field, somebody
// will eventually quote it back to SEI as though SEI wrote it.
//
// THE THING THAT SURPRISES PEOPLE, AND WHY THE COST TAB IS SHAPED THIS WAY
//
// Cost attaches to the VIEW, not the event. Consumption rule 1 says an event
// is a notification and the record must be fetched from the SDC view named in
// the payload, so the bill is warehouse time on that view. Twenty events on
// ACCOUNT_BASIC_VIEW cost about what one costs. The basket therefore prices
// DISTINCT VIEWS, and ticking an event whose view is already in the basket
// visibly adds nothing — which is the correct answer, not a bug.
import React, { useEffect, useMemo, useState } from 'react';
import { evt360 } from './event360_api_additions.js';

// The mockup's palette, so the module reads as one system with Lineage 360.
const P = {
  ink: '#233240', sub: '#7b8894', rule: '#c9d4dc', page: '#f4f7f9',
  panel: '#fff', link: '#31bced', accent: '#0f4775', ok: '#159943',
  warn: '#e67e22', warnInk: '#a8560f', danger: '#c1113a', tint: '#eef3f8',
  mono: '"Roboto Mono",ui-monospace,SFMono-Regular,Menlo,monospace',
  // sequential, one hue, magnitude only
  s: ['#e4edf5', '#c3d8e9', '#9dbdd8', '#3a6f9e', '#0f4775'],
};
// categorical — event type. Three slots, validated all-pairs (CVD dE 9.2,
// normal-vision 24.0). Never cycled, never reused for anything else.
const TC = { Business: '#2a78d6', Technical: '#eb6834', Marker: '#1baf7a' };
// ordered severity, not categories; every chip carries its word as well
const BC = { Critical: '#c1113a', High: '#e67e22', Moderate: '#3a6f9e', Low: '#7b8894' };

const num = (v) => (v == null ? '—' : Math.round(Number(v)).toLocaleString());
const money = (n) => (n == null ? '—' : n >= 1000 ? '$' + Math.round(n).toLocaleString()
  : n >= 10 ? '$' + n.toFixed(0) : n >= 0.01 ? '$' + n.toFixed(2) : '$0.00');
const step = (n) => (!n ? '#fff' : n < 4 ? P.s[0] : n < 8 ? P.s[1] : n < 14 ? P.s[2]
  : n < 20 ? P.s[3] : P.s[4]);
const stepInk = (n) => (n >= 14 ? '#fff' : P.ink);

const Panel = ({ title, hint, src, right, children, pad = true }) => (
  <div style={{ background: P.panel, border: `1px solid ${P.rule}`, borderRadius: 10,
    marginBottom: 12, overflow: 'hidden' }}>
    {(title || right) && (
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${P.rule}`,
        display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          {title && <h2 style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>{title}</h2>}
          {hint && <div style={{ fontSize: 12.5, color: P.sub, marginTop: 3 }}>{hint}</div>}
          {src && <div style={{ fontFamily: P.mono, fontSize: 9.5, color: P.sub,
            marginTop: 4 }}>{src}</div>}
        </div>
        {right && <div style={{ marginLeft: 'auto' }}>{right}</div>}
      </div>)}
    <div style={pad ? { padding: '14px 16px' } : undefined}>{children}</div>
  </div>
);
const Tile = ({ n, label, detail }) => (
  <div style={{ background: P.panel, border: `1px solid ${P.rule}`, borderRadius: 10,
    padding: '13px 15px' }}>
    <div style={{ fontSize: 22, fontWeight: 600, fontFamily: P.mono,
      lineHeight: 1.1 }}>{n}</div>
    <div style={{ fontSize: 11.5, color: P.sub, marginTop: 3 }}>{label}</div>
    {detail && <div style={{ fontSize: 10.5, color: P.sub, marginTop: 5 }}>{detail}</div>}
  </div>
);
const Btn = ({ on, onClick, children, title }) => (
  <button title={title} onClick={onClick} aria-pressed={!!on} style={{
    font: 'inherit', fontSize: 11.5, fontWeight: 600, padding: '6px 13px',
    border: `1px solid ${on ? P.accent : P.rule}`, borderRadius: 4, cursor: 'pointer',
    background: on ? P.accent : '#fff', color: on ? '#fff' : P.ink }}>{children}</button>
);
const Band = ({ e }) => {
  const c = e && e.criticality;
  if (!c) return null;
  return <span style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 999,
    padding: '3px 9px', color: '#fff', whiteSpace: 'nowrap', background: BC[c.band] }}>
    {c.band}<b style={{ fontWeight: 400, opacity: .8, marginLeft: 3,
      fontFamily: P.mono, fontSize: 9.5 }}>{c.score}</b></span>;
};
const TypeChip = ({ t }) => (
  <span style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 999, padding: '3px 10px',
    background: TC[t] || P.sub, color: '#fff' }}>{t}</span>
);
const Note = ({ tone = 'warn', children }) => {
  const m = { warn: ['#fdf6ec', '#f2d9b4'], info: [P.tint, '#cfe0ee'],
    bad: ['#fdf0f2', '#f0c4cc'] }[tone];
  return <div style={{ background: m[0], border: `1px solid ${m[1]}`, borderRadius: 9,
    padding: '11px 14px', fontSize: 12, lineHeight: 1.55 }}>{children}</div>;
};
const th = { textAlign: 'left', padding: '7px 11px', fontSize: 9.5, fontWeight: 700,
  letterSpacing: .4, textTransform: 'uppercase', color: P.sub,
  borderBottom: `1px solid ${P.rule}` };
const td = { textAlign: 'left', padding: '7px 11px', fontSize: 12,
  borderBottom: '1px solid #edf1f4' };
const mtd = { ...td, fontFamily: P.mono, fontSize: 11 };

const TABS = [['est', 'Estate'], ['swm', 'Swimlanes'], ['lnk', 'Link view'],
  ['dep', 'Interdependence'], ['sub', 'Subscriptions & cost']];

export default function Event360() {
  const [tab, setTab] = useState('est');
  const [sum, setSum] = useState(null);
  const [det, setDet] = useState(null);      // open event id

  useEffect(() => { evt360.summary().then(setSum); }, []);

  if (!sum) return <div style={{ padding: 24, color: P.sub }}>Loading Event 360…</div>;
  if (!sum.loaded) return (
    <div style={{ padding: 24, maxWidth: 780 }}>
      <h1 style={{ fontSize: 19, fontWeight: 500, margin: '0 0 8px' }}>Event 360</h1>
      <Note tone="info">
        <b>Nothing is loaded yet.</b> {sum.detail || 'meta_event_definition is empty.'}
        <div style={{ marginTop: 8, fontFamily: P.mono, fontSize: 11.5 }}>
          python -m ingestion.run event360<br />
          python -m ingestion.run sdc_compute<br />
          python -m ingestion.run event_subscription
        </div>
        <div style={{ marginTop: 8 }}>This screen deliberately shows nothing rather
          than demo data: an estate that looks populated when it is not is the one
          failure nobody catches.</div>
      </Note>
    </div>);

  return (
    <div style={{ padding: '20px 26px 70px', maxWidth: 1500, color: P.ink,
      font: '14px/1.5 ui-sans-serif,system-ui,"Segoe UI",sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <h1 style={{ fontSize: 19, fontWeight: 500, margin: 0 }}>Event 360</h1>
        <span style={{ fontSize: 12.5, color: P.sub }}>
          {sum.events} events · {num(sum.fields)} fields · {num(sum.trigger_rows)} trigger
          rows over {num(sum.trigger_columns)} columns
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 14, fontSize: 11,
          color: P.sub, alignItems: 'center' }}>
          event type
          {['Business', 'Technical', 'Marker'].map((t) => (
            <span key={t}><i style={{ display: 'inline-block', width: 11, height: 11,
              borderRadius: 2.5, marginRight: 5, verticalAlign: -1,
              background: TC[t] }} />{t}</span>))}
        </span>
      </div>
      <p style={{ fontSize: 12.5, color: P.sub, margin: '0 0 14px', maxWidth: '86ch' }}>
        An event is a notification that something changed — not the change itself.
        Every screen here ends at that distinction.
      </p>

      {det ? <EventDetail id={det} onBack={() => setDet(null)} onOpen={setDet} />
        : <>
          <div style={{ display: 'flex', gap: 0, marginBottom: 16 }}>
            {TABS.map(([k, l], i) => (
              <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k}
                style={{ font: 'inherit', fontSize: 11.5, fontWeight: 600,
                  padding: '6px 13px', cursor: 'pointer',
                  border: `1px solid ${tab === k ? P.accent : P.rule}`,
                  borderLeftWidth: i === 0 ? 1 : 0,
                  borderRadius: i === 0 ? '4px 0 0 4px'
                    : i === TABS.length - 1 ? '0 4px 4px 0' : 0,
                  background: tab === k ? P.accent : '#fff',
                  color: tab === k ? '#fff' : P.ink }}>{l}</button>))}
          </div>
          {tab === 'est' && <Estate sum={sum} onOpen={setDet} />}
          {tab === 'swm' && <Lanes />}
          {tab === 'lnk' && <LinkView onOpen={setDet} />}
          {tab === 'dep' && <Interdep onOpen={setDet} />}
          {tab === 'sub' && <SubsCost onOpen={setDet} />}
        </>}
    </div>);
}

/* ============================ Estate ============================ */
const GROUPERS = [['type', 'Type'], ['domain', 'Domain'], ['cross', 'Domain × Type'],
  ['view', 'SDC view'], ['ops', 'Operation']];

function Estate({ sum, onOpen }) {
  const [by, setBy] = useState('type');
  const [g, setG] = useState(null);
  const [sel, setSel] = useState(null);
  const [rows, setRows] = useState([]);
  useEffect(() => { setG(null); setSel(null); evt360.groups(by).then(setG); }, [by]);
  useEffect(() => {
    if (!sel || !g) return setRows([]);
    const grp = (g.groups || []).find((x) => x.key === sel);
    if (!grp) return setRows([]);
    evt360.events().then((d) => setRows((d.events || [])
      .filter((e) => grp.event_ids.includes(Number(e.event_id)))));
  }, [sel, g]);
  const groups = (g && g.groups) || [];
  const max = Math.max(...groups.map((x) => x.total), 1);
  return (<>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))',
      gap: 12, marginBottom: 14 }}>
      <Tile n={sum.events} label="events in the contract"
        detail={Object.entries(sum.types).map(([k, v]) => `${v} ${k}`).join(' · ')} />
      <Tile n={`${sum.subscribed} / ${sum.events}`} label="subscribed"
        detail={`${sum.unsubscribed} produced for nobody · ${num(sum.subscriptions_active)} live subscriptions`} />
      <Tile n={num(sum.trigger_columns)} label="distinct watched columns"
        detail={`${num(sum.trigger_rows)} trigger rows`} />
      <Tile n={sum.sdc_period ? `${Math.round(sum.sdc_period.view_coverage_pct || 0)}%` : '—'}
        label="compute extract coverage"
        detail={sum.sdc_period ? `${sum.sdc_period.client_code} · ${sum.sdc_period.period_days} days`
          : 'no compute period loaded'} />
      <Tile n={sum.critical_or_high} label="Critical or High"
        detail="criticality is CP360's, derived — not SEI's" />
    </div>
    <Panel title="The whole estate, grouped"
      hint={g && g.note}
      right={<span style={{ display: 'flex', gap: 0 }}>
        {GROUPERS.map(([k, l], i) => (
          <button key={k} onClick={() => setBy(k)} aria-pressed={by === k}
            style={{ font: 'inherit', fontSize: 11.5, fontWeight: 600, padding: '6px 11px',
              cursor: 'pointer', border: `1px solid ${by === k ? P.accent : P.rule}`,
              borderLeftWidth: i === 0 ? 1 : 0,
              borderRadius: i === 0 ? '4px 0 0 4px' : i === GROUPERS.length - 1 ? '0 4px 4px 0' : 0,
              background: by === k ? P.accent : '#fff',
              color: by === k ? '#fff' : P.ink }}>{l}</button>))}
      </span>}>
      {!g ? <div style={{ color: P.sub, fontSize: 12 }}>Loading…</div> : (<>
        <div style={{ display: 'grid',
          gridTemplateColumns: '148px minmax(0,1fr) 52px 84px 92px 74px',
          gap: 11, alignItems: 'center', padding: '4px 0', fontSize: 9.5,
          fontWeight: 700, textTransform: 'uppercase', color: P.sub, letterSpacing: .5 }}>
          <div>Group</div><div>Events by type</div>
          <div style={{ textAlign: 'right' }}>Events</div>
          <div style={{ textAlign: 'right' }}>Subscribed</div>
          <div style={{ textAlign: 'right' }}>Distinct views</div>
          <div style={{ textAlign: 'right' }}>Sec</div>
        </div>
        {groups.map((x) => (
          <div key={x.key} onClick={() => setSel(sel === x.key ? null : x.key)}
            style={{ display: 'grid',
              gridTemplateColumns: '148px minmax(0,1fr) 52px 84px 92px 74px',
              gap: 11, alignItems: 'center', padding: '6px 0', cursor: 'pointer',
              background: sel === x.key ? P.tint : undefined }}>
            <div style={{ fontSize: 12.5, fontWeight: 500, overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={x.key}>{x.key}</div>
            <div><div style={{ display: 'flex', height: 22, borderRadius: 4,
              overflow: 'hidden', background: '#edf1f4',
              width: `${Math.round(x.total / max * 100)}%` }}>
              {['Business', 'Technical', 'Marker'].filter((t) => x[t]).map((t, i, a) => (
                <span key={t} style={{ flex: x[t], background: TC[t], color: '#fff',
                  fontSize: 10, fontWeight: 700, lineHeight: '22px', textAlign: 'center',
                  boxShadow: i < a.length - 1 ? `2px 0 0 0 ${P.panel}` : undefined }}>
                  {x[t]}</span>))}
            </div></div>
            <div style={{ fontFamily: P.mono, fontSize: 12, textAlign: 'right' }}>{x.total}</div>
            <div style={{ fontFamily: P.mono, fontSize: 12, textAlign: 'right',
              color: x.subscribed < x.total ? P.warnInk : undefined }}>{x.subscribed}</div>
            <div style={{ fontFamily: P.mono, fontSize: 12, textAlign: 'right' }}>
              {x.distinct_views}{x.measured_views < x.distinct_views
                ? <span style={{ color: P.sub }}> ({x.measured_views}m)</span> : null}</div>
            <div style={{ fontFamily: P.mono, fontSize: 12, textAlign: 'right' }}>
              {num(x.elapsed_sec)}</div>
          </div>))}
      </>)}
    </Panel>
    {sel && (
      <Panel title={sel} hint={`${rows.length} events in this group`} pad={false}>
        <div style={{ maxHeight: 420, overflow: 'auto' }}>
          <EventTable rows={rows} onOpen={onOpen} />
        </div>
      </Panel>)}
  </>);
}

function EventTable({ rows, onOpen }) {
  return (
    <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
      <thead><tr>
        <th style={{ ...th, width: 54 }}>ID</th><th style={th}>Event</th>
        <th style={{ ...th, width: 92 }}>Type</th><th style={{ ...th, width: 100 }}>Domain</th>
        <th style={{ ...th, width: 54 }}>Cols</th><th style={{ ...th, width: 180 }}>SDC view</th>
        <th style={{ ...th, width: 62 }}>Subs</th>
        <th style={{ ...th, width: 104 }}>Criticality</th><th style={{ ...th, width: 26 }} />
      </tr></thead>
      <tbody>{rows.map((e) => (
        <tr key={e.event_id} onClick={() => onOpen(Number(e.event_id))}
          style={{ cursor: 'pointer' }}>
          <td style={mtd}>{e.event_id}</td>
          <td style={td}>{e.event_name}</td>
          <td style={td}><TypeChip t={e.event_type} /></td>
          <td style={mtd}>{e.domain}</td>
          <td style={mtd}>{e.trig_cols || '—'}</td>
          <td style={{ ...mtd, fontSize: 10.5 }}>{e.sdc_view
            || <i style={{ color: P.sub }}>none · marker</i>}</td>
          <td style={mtd}>{e.subs_active}</td>
          <td style={td}><Band e={e} /></td>
          <td style={{ ...td, color: P.link, fontWeight: 600 }}>›</td>
        </tr>))}
        {!rows.length && <tr><td colSpan={9} style={{ ...td, color: P.sub, padding: 16 }}>
          No event matches.</td></tr>}
      </tbody>
    </table>);
}

/* ============================ Swimlanes ============================ */
function Lanes() {
  const [by, setBy] = useState('domain');
  const [d, setD] = useState(null);
  useEffect(() => { setD(null); evt360.lanes(by).then(setD); }, [by]);
  const lanes = (d && d.lanes) || [];
  const maxCol = Math.max(...lanes.map((l) => l.cols || 0), 1);
  const Stage = ({ children, last }) => (
    <div style={{ position: 'relative', padding: '12px 22px 12px 12px', minWidth: 0,
      borderLeft: '1px dashed #dfe6ec' }}>
      {children}
      {!last && <span style={{ position: 'absolute', right: 6, top: '50%', marginTop: -5,
        borderLeft: `7px solid ${P.rule}`, borderTop: '5px solid transparent',
        borderBottom: '5px solid transparent' }} />}
    </div>);
  return (<>
    <Panel title={`One lane per ${by === 'domain' ? 'domain' : 'source table'}, four stages, left to right`}
      hint="Every event has the same life: a source record changes, the trigger decides whether that change matters, an event is published, and the consumer goes back for the record."
      src="stage 1 META_EVENT_FIELD.SOURCE_TABLE · stage 2 TRIGGER_CONDITION + count · stage 3 EVENT_ID / EVENT_TYPE · stage 4 SDC_VIEW"
      right={<span style={{ display: 'flex', gap: 0 }}>
        <Btn on={by === 'domain'} onClick={() => setBy('domain')}>By domain</Btn>
        <Btn on={by === 'table'} onClick={() => setBy('table')}>By source table</Btn>
      </span>}>
      {!d ? <span style={{ color: P.sub, fontSize: 12 }}>Loading…</span> : null}
    </Panel>
    <div style={{ background: P.panel, border: `1px solid ${P.rule}`, borderRadius: 10,
      overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '132px repeat(4,minmax(0,1fr))',
        background: '#f4f7f9', borderBottom: `1px solid ${P.rule}` }}>
        {['Lane', '1 · Source record changes', '2 · Trigger evaluates',
          '3 · Event is published', '4 · Consumer re-reads'].map((s) => (
            <div key={s} style={{ padding: '9px 12px', fontSize: 9.5, fontWeight: 700,
              letterSpacing: .5, textTransform: 'uppercase', color: P.sub }}>{s}</div>))}
      </div>
      {lanes.map((l) => {
        const marker = l.lane === 'MARKER';
        const byType = ['Business', 'Technical', 'Marker']
          .map((t) => [t, l.events.filter((e) => e.event_type === t).length])
          .filter((x) => x[1]);
        return (
          <div key={l.lane} style={{ display: 'grid',
            gridTemplateColumns: '132px repeat(4,minmax(0,1fr))',
            borderTop: `1px solid ${P.rule}` }}>
            <div style={{ padding: 12, borderRight: `1px solid ${P.rule}`,
              background: '#f4f7f9' }}>
              <div style={{ fontFamily: P.mono, fontSize: 12, fontWeight: 600 }}>{l.lane}</div>
              <div style={{ fontSize: 11, color: P.sub, marginTop: 3 }}>
                {l.event_count} events</div>
            </div>
            <Stage>{marker
              ? <div style={{ fontSize: 12, color: P.sub }}>No source record. The lane
                starts when the <b>batch window closes</b>, not when a row changes.</div>
              : (l.tables.length
                ? l.tables.map((t) => (
                  <span key={t.table} style={{ fontFamily: P.mono, fontSize: 10.5,
                    background: P.tint, color: P.accent, borderRadius: 3,
                    padding: '2px 6px', display: 'inline-block', margin: '2px 3px 0 0' }}>
                    {t.table} <b>{t.cols}</b></span>))
                : <i style={{ color: P.sub, fontSize: 12 }}>no source table stated</i>)}
            </Stage>
            <Stage>{marker
              ? <div style={{ fontSize: 12, color: P.sub }}>Nothing is evaluated per row.</div>
              : (<>
                <div style={{ fontSize: 12.5 }}>
                  <b style={{ fontFamily: P.mono }}>{l.cols}</b> watched columns</div>
                <div style={{ height: 6, background: '#edf1f4', borderRadius: 999,
                  margin: '6px 0 5px' }}>
                  <div style={{ height: 6, borderRadius: 999, background: P.accent,
                    width: `${Math.round((l.cols || 0) / maxCol * 100)}%` }} /></div>
                <div style={{ fontSize: 11, color: P.sub }}>fires when any of them differs
                  before → after, and the condition holds</div></>)}
            </Stage>
            <Stage>
              <div style={{ display: 'flex', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
                {byType.map(([t, n]) => <span key={t} style={{ fontSize: 10.5,
                  fontWeight: 700, borderRadius: 999, padding: '3px 10px',
                  background: TC[t], color: '#fff' }}>{t} {n}</span>)}
              </div>
              <div style={{ lineHeight: 1.1 }}>
                {l.events.slice(0, 44).map((e) => (
                  <span key={e.event_id} title={`${e.event_id} · ${e.event_name}`}
                    style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%',
                      margin: '2px 3px 2px 0', background: TC[e.event_type],
                      boxShadow: `0 0 0 2px ${P.panel}` }} />))}
                {l.events.length > 44 && <span style={{ fontSize: 10.5, color: P.sub }}>
                  {' '}+{l.events.length - 44}</span>}
              </div>
            </Stage>
            <Stage last>{marker
              ? <Note><b>Lane ends here.</b> Nothing to fetch — a marker is a checkpoint.</Note>
              : (l.views.length
                ? <>{l.views.map((v) => (
                  <span key={v} style={{ fontFamily: P.mono, fontSize: 10.5,
                    background: P.tint, color: P.accent, borderRadius: 3, padding: '2px 6px',
                    display: 'inline-block', margin: '2px 3px 0 0' }}>{v}</span>))}
                  <div style={{ fontSize: 11, color: P.sub, marginTop: 5 }}>read the record
                    with <span style={{ fontFamily: P.mono }}>key</span>; never from the
                    payload</div></>
                : <i style={{ color: P.sub, fontSize: 12 }}>no view stated</i>)}
            </Stage>
          </div>);
      })}
    </div>
    <div style={{ marginTop: 12 }}>
      <Note><b>Stage 4 is the one people skip.</b> The payload is a notification, not the
        record. A lane whose stage 4 is empty is a lane where consumers have nowhere to go
        back to — which is why the marker lane is drawn as ending, not as continuing.</Note>
    </div>
  </>);
}

/* ============================ Link view ============================ */
// Unit of flow is the event and the left stage is its PRIMARY source table, so
// every stage conserves. Zoomed into a domain the middle stage is one band per
// event, and the canvas grows with the band count rather than squeezing them —
// a four-pixel band with no label is not a drill-down. The list beneath is the
// reliable way in; a band can be thin, a row cannot.
function LinkView({ onOpen }) {
  const [zoom, setZoom] = useState(null);
  const [d, setD] = useState(null);
  const [q, setQ] = useState('');
  useEffect(() => { setD(null); evt360.link(zoom).then(setD); }, [zoom]);
  const lay = useMemo(() => d && layout(d, zoom), [d, zoom]);
  const doms = useMemo(() => {
    const m = {};
    ((d && d.b) || []).forEach((n) => { if (!zoom) m[n.key] = n.value; });
    return m;
  }, [d, zoom]);
  if (!d) return <div style={{ color: P.sub, fontSize: 12 }}>Loading…</div>;
  const list = (d.b || []).filter((n) => n.event_id)
    .filter((n) => !q || String(n.label).toLowerCase().includes(q.toLowerCase())
      || String(n.event_id) === q);
  return (<>
    <Panel title={zoom ? `${zoom} — source table → event → SDC view`
      : 'Source table → domain → SDC view'}
      hint={zoom
        ? `One band per event, ${(d.b || []).length} of them, in id order. Click a band — or a row below — to open the event.`
        : 'Ribbon width is the number of events on that path. Click a domain to open it into its individual events.'}
      src="left META_EVENT_FIELD.SOURCE_TABLE (TRIGGER_DRIVING) · middle EVENT_ID / DOMAIN · right SDC_VIEW"
      right={<Btn onClick={() => setZoom(null)} on={!zoom}>All events</Btn>}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {Object.keys(doms).length > 0 && Object.entries(doms).map(([k, v]) => (
          <Btn key={k} on={zoom === k} onClick={() => setZoom(zoom === k ? null : k)}>
            {k} · {v}</Btn>))}
        {zoom && <Btn onClick={() => setZoom(null)}>← Back to all domains</Btn>}
      </div>
    </Panel>
    <div style={{ background: P.panel, border: `1px solid ${P.rule}`, borderRadius: 10,
      padding: '8px 4px', overflowX: 'auto', marginBottom: 12 }}>
      <Sankey lay={lay} onNode={(n) => {
        if (n.event_id) onOpen(n.event_id);
        else if (n.stage === 'b') setZoom(n.key);
      }} />
    </div>
    <Panel title={zoom ? `${zoom} — ${list.length} events` : 'Open a domain to list its events'}
      hint="Every event in the diagram above, in the same order, each one a door into its details. A band four pixels tall is hard to hit; this list is not."
      right={<input value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Filter events…" style={{ font: 'inherit', fontSize: 11.5,
          padding: '5px 9px', border: `1px solid ${P.rule}`, borderRadius: 4,
          minWidth: 180 }} />} pad={false}>
      <div style={{ maxHeight: 420, overflow: 'auto' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
          <thead><tr><th style={{ ...th, width: 54 }}>ID</th><th style={th}>Event</th>
            <th style={{ ...th, width: 90 }}>Events on path</th>
            <th style={{ ...th, width: 26 }} /></tr></thead>
          <tbody>{list.map((n) => (
            <tr key={n.key} onClick={() => onOpen(n.event_id)} style={{ cursor: 'pointer' }}>
              <td style={mtd}>{n.event_id}</td>
              <td style={td}>{String(n.label).replace(/^\d+ · /, '')}</td>
              <td style={mtd}>{n.value}</td>
              <td style={{ ...td, color: P.link, fontWeight: 600 }}>›</td>
            </tr>))}
            {!list.length && <tr><td colSpan={4} style={{ ...td, color: P.sub, padding: 16 }}>
              {zoom ? 'No event matches.' : 'Click a domain above to list its events here.'}
            </td></tr>}
          </tbody>
        </table>
      </div>
    </Panel>
  </>);
}

// One height budget for all three columns, so their marks total the same and a
// ribbon does not taper merely because its column holds fewer nodes.
function layout(d, zoom) {
  const SK = { W: 1180, top: 26, nw: 13, xa: 212, xb: 566, xc: 920 };
  const cols = [d.a || [], d.b || [], d.c || []];
  const most = Math.max(...cols.map((c) => c.length), 1);
  const gap = zoom ? 5 : 9, min = zoom ? 9 : 11;
  const H = zoom ? Math.max(560, (d.b || []).length * 17 + SK.top * 2) : 660;
  const budget = H - SK.top * 2 - (most - 1) * gap;
  const by = {};
  cols.forEach((g, gi) => {
    const stage = 'abc'[gi];
    const raw = g.reduce((s, n) => s + n.value, 0) || 1;
    const k = budget / raw;
    g.forEach((n) => { n.stage = stage; n.h = Math.max(min, n.value * k); });
    const over = g.reduce((s, n) => s + n.h, 0) - budget;
    if (over > 0) {
      const flex = g.filter((n) => n.h > min);
      const tot = flex.reduce((s, n) => s + (n.h - min), 0);
      if (tot > 0) flex.forEach((n) => { n.h -= (n.h - min) / tot * over; });
    }
    const g2 = (H - SK.top * 2 - g.reduce((s, n) => s + n.h, 0)) / Math.max(1, g.length - 1);
    let y = SK.top;
    g.forEach((n) => { n.y = y; n.id = `${stage}:${n.key}`; by[n.id] = n; y += n.h + g2; });
  });
  const wire = (links, sp, tp) => {
    links.forEach((l) => { l.sid = `${sp}:${l.s}`; l.tid = `${tp}:${l.t}`; });
    [['sid', 'tid', 'y0', 'h0', 'ox'], ['tid', 'sid', 'y1', 'h1', 'ix']]
      .forEach(([self, other, yk, hk, cur]) => {
        links.slice().sort((p, q) => (by[p[other]] || {}).y - (by[q[other]] || {}).y)
          .forEach((l) => {
            const n = by[l[self]]; if (!n) return;
            if (n[cur] == null) n[cur] = n.y;
            const h = l.v / n.value * n.h;
            l[yk] = n[cur]; n[cur] += h; l[hk] = h;
          });
      });
  };
  wire(d.ab || [], 'a', 'b'); wire(d.bc || [], 'b', 'c');
  return { SK, H, a: cols[0], b: cols[1], c: cols[2], ab: d.ab || [], bc: d.bc || [], by };
}

function Sankey({ lay, onNode }) {
  if (!lay) return <div style={{ color: P.sub, fontSize: 12, padding: 12 }}>Loading…</div>;
  const { SK, H } = lay;
  const ribbon = (x0, y0, h0, x1, y1, h1) => {
    const c = (x0 + x1) / 2;
    return `M${x0},${y0} C${c},${y0} ${c},${y1} ${x1},${y1} L${x1},${y1 + h1}
            C${c},${y1 + h1} ${c},${y0 + h0} ${x0},${y0 + h0} Z`;
  };
  const Node = ({ n, x, anchor }) => {
    const isEvt = !!n.event_id;
    let y = n.y;
    const bars = ['Business', 'Technical', 'Marker'].filter((t) => n.types[t]).map((t) => {
      const h = n.types[t] / n.value * n.h;
      const r = <rect key={t} x={x} y={y.toFixed(1)} width={SK.nw} rx={1.5}
        height={Math.max(1, h - (h > 3 ? 1.5 : 0)).toFixed(1)} fill={TC[t]} />;
      y += h; return r;
    });
    const tx = anchor === 'end' ? x - 9 : x + SK.nw + 9;
    const label = String(n.label || n.key);
    return (
      <g style={{ cursor: 'pointer' }} onClick={() => onNode(n)}>
        {bars}
        <rect x={x - 5} y={(n.y - 2.5).toFixed(1)} width={SK.nw + 10}
          height={(n.h + 5).toFixed(1)} fill="transparent" />
        <title>{`${label} — ${n.value} event${n.value === 1 ? '' : 's'}`}</title>
        {n.h >= 9 && <text x={tx} y={(n.y + n.h / 2 + 1).toFixed(1)} textAnchor={anchor}
          dominantBaseline="middle" fontSize={isEvt ? 10 : 11} fill={P.ink}
          style={isEvt ? { paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3.5,
            strokeLinejoin: 'round' } : undefined}>
          {label.length > 42 ? label.slice(0, 41) + '…' : label}
          {!isEvt && <tspan fill={P.sub} fontSize={9.5}> · {n.value}</tspan>}
        </text>}
      </g>);
  };
  return (
    <svg width={SK.W} height={H} role="img"
      aria-label="Flow from source tables through events to SDC views">
      {lay.ab.map((l, i) => l.h0 > 0 && (
        <path key={`ab${i}`} d={ribbon(SK.xa + SK.nw, l.y0, l.h0, SK.xb, l.y1, l.h1)}
          fill="#8fa6b8" fillOpacity={.42}><title>{`${l.s} → ${l.t}: ${l.v}`}</title></path>))}
      {lay.bc.map((l, i) => l.h0 > 0 && (
        <path key={`bc${i}`} d={ribbon(SK.xb + SK.nw, l.y0, l.h0, SK.xc, l.y1, l.h1)}
          fill="#8fa6b8" fillOpacity={.42}><title>{`${l.s} → ${l.t}: ${l.v}`}</title></path>))}
      {lay.a.map((n) => <Node key={n.id} n={n} x={SK.xa} anchor="end" />)}
      {lay.b.map((n) => <Node key={n.id} n={n} x={SK.xb} anchor="end" />)}
      {lay.c.map((n) => <Node key={n.id} n={n} x={SK.xc} anchor="start" />)}
      {[[SK.xa + SK.nw, 'SOURCE TABLE (PRIMARY)', 'end'],
        [SK.xb + SK.nw, lay.b.some((n) => n.event_id) ? 'EVENT' : 'DOMAIN', 'end'],
        [SK.xc, 'SDC VIEW', 'start']].map(([x, t, a]) => (
          <text key={t} x={x} y={14} textAnchor={a} fontSize={9.5} fontWeight={700}
            letterSpacing={.5} fill={P.sub}>{t}</text>))}
    </svg>);
}

/* ============================ Interdependence ============================ */
function Interdep({ onOpen }) {
  const [table, setTable] = useState('');
  const [d, setD] = useState(null);
  const [col, setCol] = useState(null);
  const [hits, setHits] = useState([]);
  useEffect(() => { evt360.interdependence(table || undefined).then(setD); }, [table]);
  useEffect(() => {
    if (!col) return setHits([]);
    evt360.column(col.source_table, col.source_column).then((r) => setHits(r.events || []));
  }, [col]);
  if (!d) return <div style={{ color: P.sub, fontSize: 12 }}>Loading…</div>;
  const domains = [...new Set((d.heat || []).map((h) => h.domain))].sort();
  const tables = d.tables || [];
  const maxBlast = Math.max(...(d.blast || []).map((b) => Number(b.events)), 1);
  const cell = (dom, tbl) => {
    const r = (d.heat || []).find((h) => h.domain === dom && h.source_table === tbl);
    return r ? Number(r.events) : 0;
  };
  return (<>
    <Panel title="If this column changes, what fires?"
      hint="Two events are coupled when they watch the same source column — change it once and both arrive, in no guaranteed order. That coupling is invisible in the catalogue and it is the thing that breaks consumers." />
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.25fr) minmax(0,1fr)',
      gap: 12, alignItems: 'start' }}>
      <Panel title="Blast radius" hint="Widest first. A column above 1 cannot be changed quietly."
        src="COUNT(DISTINCT event_id) GROUP BY source_table, source_column"
        right={<select value={table} onChange={(e) => { setTable(e.target.value); setCol(null); }}
          style={{ font: 'inherit', fontSize: 11.5, padding: '5px 8px',
            border: `1px solid ${P.rule}`, borderRadius: 4 }}>
          <option value="">All tables</option>
          {tables.map((t) => <option key={t}>{t}</option>)}
        </select>} pad={false}>
        <div style={{ maxHeight: 420, overflow: 'auto' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
            <thead><tr><th style={{ ...th, width: 150 }}>Table</th><th style={th}>Column</th>
              <th style={{ ...th, width: 190 }}>Events that fire</th></tr></thead>
            <tbody>{(d.blast || []).map((b) => {
              const on = col && col.source_table === b.source_table
                && col.source_column === b.source_column;
              return (
                <tr key={`${b.source_table}.${b.source_column}`} onClick={() => setCol(b)}
                  style={{ cursor: 'pointer', background: on ? P.tint : undefined }}>
                  <td style={{ ...mtd, fontSize: 10.5 }}>{b.source_table}</td>
                  <td style={mtd}>{b.source_column}</td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ flex: 1, height: 6, background: '#edf1f4',
                        borderRadius: 999 }}>
                        <span style={{ display: 'block', height: 6, borderRadius: 999,
                          background: P.accent,
                          width: `${Math.round(Number(b.events) / maxBlast * 100)}%` }} />
                      </span>
                      <span style={{ fontFamily: P.mono, fontSize: 11, width: 18,
                        textAlign: 'right' }}>{b.events}</span>
                    </div></td>
                </tr>);
            })}</tbody>
          </table>
        </div>
      </Panel>
      <Panel title={col ? `Arrives together — ${col.source_table}.${col.source_column}`
        : 'Arrives together'}
        hint={col ? `Change it once and ${hits.length} event${hits.length === 1 ? '' : 's'} are raised, in no guaranteed order.`
          : 'Pick a column on the left to see every event that fires with it.'} pad={false}>
        <div style={{ maxHeight: 420, overflow: 'auto' }}>
          {col ? <EventTable rows={hits} onOpen={onOpen} />
            : <div style={{ padding: 16, color: P.sub, fontSize: 12 }}>Nothing selected.</div>}
        </div>
      </Panel>
    </div>
    <Panel title="Where the domains reach across"
      hint="Events of one domain watching another domain's tables. The off-diagonal cells are the coupling — a table nobody expected to be watched.">
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
          <thead><tr><th style={{ ...th, width: 118 }}>Event domain</th>
            {tables.map((t) => <th key={t} style={{ ...th, textAlign: 'center',
              fontSize: 8.5 }}>{t.replace(/_/g, ' ')}</th>)}
            <th style={{ ...th, textAlign: 'right' }}>All</th></tr></thead>
          <tbody>{domains.map((dom) => {
            let tot = 0;
            return (<tr key={dom}>
              <th style={{ ...td, fontFamily: P.mono, fontSize: 11, fontWeight: 500 }}>{dom}</th>
              {tables.map((t) => {
                const n = cell(dom, t); tot += n;
                return <td key={t} style={{ ...td, textAlign: 'center', padding: 0 }}>
                  <span title={`${n} ${dom} events watch ${t}`} style={{ display: 'block',
                    padding: '9px 0', fontFamily: P.mono, fontSize: 11.5,
                    background: step(n), color: stepInk(n) }}>{n || ''}</span></td>;
              })}
              <td style={{ ...mtd, textAlign: 'right', fontSize: 11.5 }}>{tot}</td>
            </tr>);
          })}</tbody>
        </table>
      </div>
      <div style={{ marginTop: 10 }}>
        <Note><b>Numbers are printed in every cell.</b> The shade is a second reading of the
          same value, never the only one — a reader who cannot separate the steps still has
          the count.</Note>
      </div>
    </Panel>
  </>);
}

/* ============================ Subscriptions & cost ============================ */
// The basket is the screen. Cost is priced on the DISTINCT VIEWS the basket's
// events name, so ticking an event whose view is already in the basket adds
// nothing — that is the true answer and the panel says so out loud.
function SubsCost({ onOpen }) {
  const [subs, setSubs] = useState(null);
  const [events, setEvents] = useState([]);
  const [picked, setPicked] = useState(null);      // null until seeded from live
  const [cost, setCost] = useState(null);
  const [q, setQ] = useState('');
  const [dom, setDom] = useState('');
  const [rate, setRate] = useState({});
  useEffect(() => {
    evt360.subscriptions().then(setSubs);
    evt360.events().then((d) => {
      const ev = d.events || [];
      setEvents(ev);
      setPicked(new Set(ev.filter((e) => Number(e.subs_active) > 0)
        .map((e) => Number(e.event_id))));
    });
  }, []);
  useEffect(() => {
    if (!picked) return;
    evt360.cost({ event_ids: [...picked], ...rate }).then(setCost);
  }, [picked, rate]);
  const live = useMemo(() => new Set(events.filter((e) => Number(e.subs_active) > 0)
    .map((e) => Number(e.event_id))), [events]);
  if (!subs || !picked) return <div style={{ color: P.sub, fontSize: 12 }}>Loading…</div>;
  const rows = events.filter((e) => (!dom || e.domain === dom)
    && (!q || String(e.event_name).toLowerCase().includes(q.toLowerCase())
      || String(e.event_id) === q));
  const toggle = (id) => setPicked((s) => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const domains = [...new Set(events.map((e) => e.domain))].sort();
  const consumers = subs.consumers || [];
  const matrixDomains = [...new Set((subs.matrix || []).map((m) => m.domain))].sort();
  const mv = (c, d) => {
    const r = (subs.matrix || []).find((x) => x.consumer_code === c && x.domain === d);
    return r ? Number(r.n) : 0;
  };
  const u = cost && cost.usage, flo = cost && cost.minimum;
  return (<>
    <Panel title="Pick the events you subscribe to; the bill follows"
      hint="The basket starts from what is live today, so the first number you see is what you pay now."
      src="cost = measured warehouse time on the DISTINCT SDC views the basket names" />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))',
      gap: 12, marginBottom: 14 }}>
      <Tile n={`${picked.size} / ${events.length}`} label="events in your basket"
        detail={picked.size === live.size ? 'unchanged from what is live today'
          : `${picked.size > live.size ? '+' : ''}${picked.size - live.size} vs live today`} />
      <Tile n={cost ? cost.basket.distinct_views : '—'} label="distinct SDC views"
        detail="the view is read once however many events name it" />
      <Tile n={u ? money(u.per_month) : '—'} label="measured usage a month"
        detail={cost && cost.scale && cost.scale.ratio
          ? `reference client × ${cost.scale.ratio.toFixed(4)} account ratio`
          : 'no compute period loaded'} />
      <Tile n={flo ? money(flo.amount) : '—'} label={`contracted floor per ${flo ? String(flo.per).toLowerCase() : '—'}`}
        detail={flo ? (flo.binding ? 'THE FLOOR IS THE BILL' : 'usage has passed the floor') : '—'} />
      <Tile n={flo && flo.headroom_hours != null ? num(flo.headroom_hours) : '—'}
        label="warehouse-hours of headroom" detail="before usage reaches the floor" />
    </div>
    {flo && flo.binding && (
      <div style={{ marginBottom: 12 }}>
        <Note><b>Usage is {flo.usage_pct_of_floor}% of the floor, so the floor is the bill.</b>
          {' '}{flo.what_it_means} Trimming a chatty event saves nothing; the number worth
          tracking is headroom, not spend.</Note>
      </div>)}
    {cost && cost.basket.views_unmeasured.length > 0 && (
      <div style={{ marginBottom: 12 }}>
        <Note tone="bad"><b>{cost.basket.views_unmeasured.length} view
          {cost.basket.views_unmeasured.length === 1 ? '' : 's'} in this basket were not in
          the compute extract</b> — {cost.basket.views_unmeasured.join(', ')}. They are
          priced at nothing here because nothing measured them, which is not the same as
          being free. Extend the extract before trusting this total.</Note>
      </div>)}
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.15fr) minmax(0,1fr)',
      gap: 12, alignItems: 'start' }}>
      <Panel title="Your subscription" hint={`${picked.size} ticked · showing ${rows.length}`}
        right={<span style={{ display: 'flex', gap: 6 }}>
          <Btn onClick={() => setPicked(new Set(live))}>Reset to live</Btn>
          <Btn onClick={() => setPicked(new Set())}>Clear all</Btn>
        </span>} pad={false}>
        <div style={{ display: 'flex', gap: 6, padding: '10px 12px',
          borderBottom: `1px solid ${P.rule}` }}>
          <select value={dom} onChange={(e) => setDom(e.target.value)}
            style={{ font: 'inherit', fontSize: 11.5, padding: '5px 8px',
              border: `1px solid ${P.rule}`, borderRadius: 4 }}>
            <option value="">Any domain</option>
            {domains.map((x) => <option key={x}>{x}</option>)}
          </select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter events…"
            style={{ font: 'inherit', fontSize: 11.5, padding: '5px 9px', flex: 1,
              border: `1px solid ${P.rule}`, borderRadius: 4 }} />
        </div>
        <div style={{ maxHeight: 640, overflow: 'auto' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
            <thead><tr><th style={{ ...th, width: 36 }} /><th style={{ ...th, width: 46 }}>ID</th>
              <th style={th}>Event</th><th style={{ ...th, width: 170 }}>SDC view</th>
              <th style={{ ...th, width: 104 }}>Criticality</th>
              <th style={{ ...th, width: 26 }} /></tr></thead>
            <tbody>{rows.map((e) => {
              const id = Number(e.event_id), on = picked.has(id);
              return (<tr key={id} onClick={() => toggle(id)}
                style={{ cursor: 'pointer', background: on ? P.tint : undefined }}>
                <td style={{ ...td, textAlign: 'center', fontSize: 13,
                  color: on ? P.ok : P.rule }}>{on ? '☑' : '☐'}</td>
                <td style={mtd}>{id}</td>
                <td style={td}>{e.event_name}</td>
                <td style={{ ...mtd, fontSize: 10.5 }}>{e.sdc_view
                  || <i style={{ color: P.sub }}>none · marker</i>}</td>
                <td style={td}><Band e={e} /></td>
                <td style={{ ...td, color: P.link, fontWeight: 600 }}
                  onClick={(ev) => { ev.stopPropagation(); onOpen(id); }}>›</td>
              </tr>);
            })}</tbody>
          </table>
        </div>
      </Panel>
      <div>
        <Panel title="What this basket costs"
          hint="One read-back per message — consumption rule 1 says you must fetch the record, so every message you accept is also a read.">
          {!cost ? <span style={{ color: P.sub, fontSize: 12 }}>Loading…</span> : (<>
            {(cost.views || []).slice(0, 8).map((v) => {
              const max = Math.max(...cost.views.map((x) => x.projected_cost_month), .01);
              return (<div key={v.view} style={{ display: 'grid',
                gridTemplateColumns: '1fr 92px', gap: 10, alignItems: 'center',
                marginBottom: 9 }}>
                <div>
                  <div style={{ fontSize: 11.5, fontFamily: P.mono, marginBottom: 4 }}>
                    {v.view} <span style={{ color: P.sub }}>· {v.events} event
                      {v.events === 1 ? '' : 's'} · {v.sec_per_query}s/query</span></div>
                  <div style={{ height: 8, background: '#edf1f4', borderRadius: 999 }}>
                    <span style={{ display: 'block', height: 8, borderRadius: 999,
                      background: P.accent,
                      width: `${Math.round(v.projected_cost_month / max * 100)}%` }} /></div>
                </div>
                <div style={{ fontFamily: P.mono, fontSize: 12, textAlign: 'right' }}>
                  {money(v.projected_cost_month)}</div>
              </div>);
            })}
            {!cost.views.length && <div style={{ color: P.sub, fontSize: 12 }}>
              Nothing measured in this basket yet.</div>}
            <div style={{ borderTop: `1px solid ${P.rule}`, marginTop: 10, paddingTop: 10,
              display: 'flex', alignItems: 'center' }}>
              <b style={{ fontSize: 12.5 }}>Usage per month</b>
              <span style={{ marginLeft: 'auto', fontFamily: P.mono, fontSize: 17,
                fontWeight: 600 }}>{money(u.per_month)}</span></div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: 11.5, color: P.sub }}>First twelve months</span>
              <span style={{ marginLeft: 'auto', fontFamily: P.mono, fontSize: 12,
                color: P.sub }}>{money(u.first_twelve_months)}</span></div>
          </>)}
        </Panel>
        <Panel title="Assumptions you can move" hint="Every figure above is a function of these.">
          {[['credit_price', '$ per credit-hour'], ['concurrency', 'Concurrency (uptime ÷ summed elapsed)'],
            ['target_accounts', 'BBH accounts'], ['minimum_amount', 'Contracted floor'],
            ['growth_per_quarter_pct', 'Growth % per quarter']].map(([k, l]) => (
              <div key={k} style={{ display: 'grid', gridTemplateColumns: '1fr 128px',
                gap: 10, alignItems: 'center', padding: '5px 0', fontSize: 12,
                borderBottom: '1px solid #f1f5f8' }}>
                <span>{l}</span>
                <input defaultValue={cost && cost.rate && k in cost.rate ? cost.rate[k]
                  : (cost && cost.scale && k === 'target_accounts' ? cost.scale.target_accounts
                    : (cost && cost.minimum && k === 'minimum_amount' ? cost.minimum.amount : ''))}
                  inputMode="decimal"
                  onBlur={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v)) setRate((r) => ({ ...r, [k]: v }));
                  }}
                  style={{ font: 'inherit', fontFamily: P.mono, fontSize: 11.5,
                    padding: '5px 8px', border: `1px solid ${P.rule}`, borderRadius: 4,
                    width: '100%', textAlign: 'right' }} />
              </div>))}
          {cost && cost.rate && cost.rate.concurrency_is_assumed && (
            <div style={{ marginTop: 9 }}>
              <Note><b>Concurrency 1.0 is an assumption, not a measurement.</b>
                {' '}{cost.rate.note}</Note></div>)}
          {cost && cost.scale && cost.scale.note && (
            <div style={{ fontFamily: P.mono, fontSize: 9.5, color: P.sub, marginTop: 8 }}>
              {cost.scale.note}</div>)}
        </Panel>
      </div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)',
      gap: 12, alignItems: 'start' }}>
      <Panel title="Who consumes what"
        hint="Rows are consuming systems, columns are domains."
        src="CTL_EVENT_SUBSCRIPTION joined to META_EVENT_DEFINITION.DOMAIN">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
            <thead><tr><th style={{ ...th, width: 150 }}>Consumer</th>
              {matrixDomains.map((d2) => <th key={d2} style={{ ...th, textAlign: 'center',
                fontSize: 9 }}>{d2}</th>)}
              <th style={{ ...th, textAlign: 'right' }}>All</th></tr></thead>
            <tbody>{consumers.map((c) => {
              let t = 0;
              return (<tr key={c.consumer_code}>
                <th style={{ ...td, fontFamily: P.mono, fontSize: 11, fontWeight: 500 }}
                  title={c.consumer_name}>{c.consumer_code}</th>
                {matrixDomains.map((d2) => {
                  const n = mv(c.consumer_code, d2); t += n;
                  return <td key={d2} style={{ ...td, textAlign: 'center', padding: 0 }}>
                    <span style={{ display: 'block', padding: '9px 0', fontFamily: P.mono,
                      fontSize: 11.5, background: step(n), color: stepInk(n) }}>
                      {n || ''}</span></td>;
                })}
                <td style={{ ...mtd, textAlign: 'right', fontSize: 11.5 }}>{t}</td>
              </tr>);
            })}
              {!consumers.length && <tr><td colSpan={matrixDomains.length + 2}
                style={{ ...td, color: P.sub, padding: 16 }}>
                No consumers loaded — run <span style={{ fontFamily: P.mono }}>
                  python -m ingestion.run event_subscription</span></td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Published for nobody"
        hint={`${(subs.unsubscribed || []).length} events have no live subscription. They are produced and retained whether or not anyone reads them.`}
        pad={false}>
        <div style={{ maxHeight: 300, overflow: 'auto' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
            <tbody>{(subs.unsubscribed || []).map((e) => (
              <tr key={e.event_id} onClick={() => onOpen(Number(e.event_id))}
                style={{ cursor: 'pointer' }}>
                <td style={{ ...mtd, width: 46 }}>{e.event_id}</td>
                <td style={td}>{e.event_name}</td>
                <td style={{ ...mtd, fontSize: 10.5 }}>{e.domain}</td>
              </tr>))}
              {!(subs.unsubscribed || []).length && <tr><td style={{ ...td, color: P.sub,
                padding: 16 }}>Every event has a consumer.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  </>);
}

/* ============================ Event drill-down ============================ */
const DTABS = [['over', 'Overview'], ['trg', 'Triggers'], ['crit', 'Criticality'],
  ['sub', 'Subscriptions'], ['cost', 'Cost']];

function EventDetail({ id, onBack, onOpen }) {
  const [tab, setTab] = useState('over');
  const [d, setD] = useState(null);
  const [cost, setCost] = useState(null);
  useEffect(() => { setD(null); setTab('over'); evt360.event(id).then(setD); }, [id]);
  useEffect(() => { evt360.cost({ event_ids: [id] }).then(setCost); }, [id]);
  if (!d) return <div style={{ color: P.sub, fontSize: 12 }}>Loading…</div>;
  if (!d.found) return (<>
    <a onClick={onBack} style={{ color: P.link, cursor: 'pointer', fontSize: 12.5 }}>
      ← back</a>
    <Note tone="bad">Event {id} is not in <span style={{ fontFamily: P.mono }}>
      meta_event_definition</span>.</Note></>);
  const e = d.event, c = e.criticality, det = d.detail || {};
  const marker = e.event_type === 'Marker';
  return (<>
    <div style={{ fontSize: 12.5, color: P.sub, marginBottom: 12 }}>
      <a onClick={onBack} style={{ color: P.link, cursor: 'pointer',
        textDecoration: 'none' }}>Event 360</a>
      <i style={{ fontStyle: 'normal', margin: '0 7px', color: '#c2ccd4' }}>›</i>
      <b style={{ color: P.ink, fontWeight: 500 }}>Event {e.event_id}</b>
    </div>
    <Panel>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>{e.event_name}</h1>
            <TypeChip t={e.event_type} />
            <span style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 999,
              padding: '3px 10px', background: P.tint, color: P.accent }}>{e.domain}</span>
          </div>
          <div style={{ fontSize: 12.5, color: P.sub, marginTop: 4, fontFamily: P.mono }}>
            id {e.event_id} · {e.section} · page {e.page} · {e.trig_cols} watched columns
            · {e.subs_active} live subscriptions
          </div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <Band e={e} />
          <div style={{ fontSize: 10.5, color: P.sub, marginTop: 4 }}>
            criticality — CP360's, not SEI's</div>
        </div>
      </div>
    </Panel>
    {e.load_flag && (
      <div style={{ marginBottom: 12 }}>
        <Note tone="bad"><b>{e.load_flag}</b> — {e.load_flag_note}
          <div style={{ fontFamily: P.mono, fontSize: 9.5, marginTop: 5 }}>
            LOAD_FLAG / LOAD_FLAG_NOTE — set by the loader, not by the sheet.</div></Note>
      </div>)}
    <div style={{ display: 'flex', gap: 0, marginBottom: 14 }}>
      {DTABS.map(([k, l], i) => (
        <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k}
          style={{ font: 'inherit', fontSize: 11.5, fontWeight: 600, padding: '6px 13px',
            cursor: 'pointer', border: `1px solid ${tab === k ? P.accent : P.rule}`,
            borderLeftWidth: i === 0 ? 1 : 0,
            borderRadius: i === 0 ? '4px 0 0 4px' : i === DTABS.length - 1 ? '0 4px 4px 0' : 0,
            background: tab === k ? P.accent : '#fff',
            color: tab === k ? '#fff' : P.ink }}>{l}</button>))}
    </div>

    {tab === 'over' && (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.25fr) minmax(0,1fr)',
        gap: 12, alignItems: 'start' }}>
        <Panel title="Description — verbatim from the specification"
          src="META_EVENT_DEFINITION.DESCRIPTION">
          <div style={{ fontSize: 12.5, lineHeight: 1.65 }}>{det.description || <i
            style={{ color: P.sub }}>no description in the workbook</i>}</div>
          <div style={{ borderTop: `1px solid ${P.rule}`, marginTop: 12, paddingTop: 12 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: .5,
              textTransform: 'uppercase', color: P.sub, marginBottom: 9 }}>
              The four stages</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {[['⚙', 'Something changes', marker ? 'the batch window closes'
                : `${e.trig_cols} column${e.trig_cols === 1 ? '' : 's'} watched`],
                ['📣', 'The event is raised', `id ${e.event_id} · ${e.event_type}`],
                ['✉', 'A payload arrives', `${e.payload_cols} fields`],
                ['🔎', 'You fetch the record', marker ? 'nothing to fetch'
                  : (e.sdc_view || 'view unresolved')]].map(([ic, t, s]) => (
                    <div key={t} style={{ textAlign: 'center' }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%',
                        border: `2px solid ${P.accent}`, display: 'grid',
                        placeItems: 'center', margin: '0 auto 6px', fontSize: 17 }}>{ic}</div>
                      <div style={{ fontSize: 11.5, fontWeight: 500 }}>{t}</div>
                      <div style={{ fontSize: 10.5, color: P.sub }}>{s}</div>
                    </div>))}
            </div>
          </div>
        </Panel>
        <div>
          <Panel title="The contract"
            src="SDC_VIEW · PAYLOAD_KEY · OPERATION_CODES · PAYLOAD_FIELD_LIST">
            <KV rows={[
              ['SDC view', e.sdc_view || <i style={{ color: P.sub }}>
                Not applicable{marker ? ' — marker' : ''}</i>],
              ['Payload key', e.payload_key || <i style={{ color: P.sub }}>Not applicable</i>],
              ['Composite key parts', det.composite_key_parts || <i
                style={{ color: P.sub }}>—</i>],
              ['Operations', e.operation_codes || <i style={{ color: P.sub }}>
                Not applicable</i>],
              ['Payload fields', det.payload_field_list || '—'],
              ['Then do', marker ? 'treat as a checkpoint; there is nothing to fetch.'
                : 'use the key to read the record from the view — never from the payload body.'],
            ]} />
          </Panel>
          <Panel title="Sample payload — verbatim as ingested"
            src="META_EVENT_DEFINITION.SAMPLE_PAYLOAD (CLOB)">
            <pre style={{ margin: 0, fontFamily: P.mono, fontSize: 11, lineHeight: 1.6,
              background: '#f7fafc', border: `1px solid ${P.rule}`, borderRadius: 8,
              padding: '11px 13px', overflow: 'auto', whiteSpace: 'pre-wrap' }}>
              {det.sample_payload || '(none)'}</pre>
            <div style={{ marginTop: 9 }}>
              <Note>The values are the specification's own illustration. Code against the
                field names, never the values.</Note></div>
          </Panel>
          <Panel title="Consumer guidance — verbatim" src="META_EVENT_DEFINITION.CONSUMER_GUIDANCE">
            <div style={{ fontSize: 12.5, lineHeight: 1.65 }}>{det.consumer_guidance
              || <i style={{ color: P.sub }}>none given</i>}</div>
          </Panel>
          <Panel title={`Fields — ${(d.fields || []).length}`}
            src="META_EVENT_FIELD, grain (SECTION, FIELD_ORDINAL)" pad={false}>
            <div style={{ maxHeight: 320, overflow: 'auto' }}>
              <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
                <thead><tr><th style={{ ...th, width: 34 }}>#</th>
                  <th style={{ ...th, width: 120 }}>Category</th><th style={th}>Field</th>
                  <th style={{ ...th, width: 110 }}>Type</th>
                  <th style={{ ...th, width: 46 }}>Key</th></tr></thead>
                <tbody>{(d.fields || []).map((f) => (
                  <tr key={f.field_ordinal}>
                    <td style={{ ...mtd, fontSize: 10.5 }}>{f.field_ordinal}</td>
                    <td style={td}><span style={{ fontSize: 9.5, fontWeight: 700,
                      borderRadius: 999, padding: '3px 9px',
                      background: f.field_category === 'PAYLOAD' ? P.tint : '#fdf6ec',
                      color: f.field_category === 'PAYLOAD' ? P.accent : P.warnInk }}>
                      {f.field_category}</span></td>
                    <td style={mtd}>{f.field_name}</td>
                    <td style={td}>{f.data_type === 'NOT_SPECIFIED'
                      ? <i style={{ color: P.sub, fontSize: 11 }}>NOT_SPECIFIED</i>
                      : <span style={{ fontFamily: P.mono, fontSize: 11 }}>{f.data_type}</span>}</td>
                    <td style={td}>{f.is_key === 'Y' ? '✓' : ''}</td>
                  </tr>))}</tbody>
              </table>
            </div>
            <div style={{ padding: 10 }}>
              <Note><b><span style={{ fontFamily: P.mono }}>NOT_SPECIFIED</span> is the fact,
                not a gap.</b> The specification never states payload field types, lengths or
                nullability. An empty cell invites someone to fill it in; the literal keeps an
                honest absence from turning into a confident fiction.</Note>
            </div>
          </Panel>
        </div>
      </div>)}

    {tab === 'trg' && (marker
      ? <Panel title="Nothing triggers this"
        hint="A marker is raised when the batch window closes, not by a row changing. There is no trigger condition, no watched column and nothing to couple to." />
      : <>
        <Panel title="Trigger condition — verbatim"
          src="META_EVENT_DEFINITION.TRIGGER_CONDITION">
          <pre style={{ margin: 0, fontFamily: P.mono, fontSize: 11, lineHeight: 1.6,
            background: '#f7fafc', border: `1px solid ${P.rule}`, borderRadius: 8,
            padding: '11px 13px', whiteSpace: 'pre-wrap' }}>
            {det.trigger_condition || '(none stated)'}</pre>
        </Panel>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
          gap: 12, alignItems: 'start' }}>
          <Panel title={`Watched columns — ${(d.trigger_columns || []).length}`}
            hint="And how many events watch each one. Above 1 is a column you cannot change quietly."
            src="META_EVENT_FIELD where FIELD_CATEGORY = 'TRIGGER_DRIVING'" pad={false}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
              <thead><tr><th style={{ ...th, width: 150 }}>Table</th><th style={th}>Column</th>
                <th style={{ ...th, width: 90 }}>Also fires</th></tr></thead>
              <tbody>{(d.trigger_columns || []).map((t) => (
                <tr key={`${t.source_table}.${t.source_column}`}>
                  <td style={{ ...mtd, fontSize: 10.5 }}>{t.source_table}</td>
                  <td style={mtd}>{t.source_column}</td>
                  <td style={td}>{Number(t.watchers) > 1
                    ? <span style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 999,
                      padding: '3px 10px', background: '#fdf6ec', color: P.warnInk }}>
                      {Number(t.watchers) - 1} more</span>
                    : <span style={{ color: P.sub, fontSize: 11 }}>this event only</span>}</td>
                </tr>))}</tbody>
            </table>
          </Panel>
          <Panel title={`Arrives together — ${(d.coupled || []).length}`}
            hint="These share at least one watched column, so a single change raises all of them. In no guaranteed order." pad={false}>
            <div style={{ maxHeight: 400, overflow: 'auto' }}>
              <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
                <tbody>{(d.coupled || []).map((x) => (
                  <tr key={x.event_id} onClick={() => onOpen(x.event_id)}
                    style={{ cursor: 'pointer' }}>
                    <td style={{ ...mtd, width: 44 }}>{x.event_id}</td>
                    <td style={td}>{x.event_name}</td>
                    <td style={{ ...td, width: 104 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 999,
                        padding: '3px 9px', color: '#fff', background: BC[x.band] }}>
                        {x.band}</span></td>
                  </tr>))}
                  {!(d.coupled || []).length && <tr><td style={{ ...td, color: P.sub,
                    padding: 16 }}>Nothing else watches these columns. This event arrives
                    alone.</td></tr>}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </>)}

    {tab === 'crit' && (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)',
        gap: 12, alignItems: 'start' }}>
        <Panel title="Why this band"
          hint="The weights are on screen because a criticality score whose arithmetic is hidden is just an opinion in a badge."
          src="REF_EVENT_CRITICALITY_WEIGHT — edit the table, the bands move"
          right={<Band e={e} />}>
          {(d.weights || []).map((w) => {
            const v = (c.inputs || {})[w.input_code] || 0;
            return (<div key={w.input_code} style={{ marginBottom: 9 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 46px',
                gap: 10, alignItems: 'center', fontSize: 11.5 }}>
                <span>{w.label} <span style={{ color: P.sub }}>
                  · {Math.round(Number(w.weight) * 100)}%</span></span>
                <span style={{ height: 7, background: '#edf1f4', borderRadius: 999 }}>
                  <span style={{ display: 'block', height: 7, borderRadius: 999,
                    background: P.accent, width: `${Math.round(v * 100)}%` }} /></span>
                <span style={{ fontFamily: P.mono, fontSize: 11, textAlign: 'right' }}>
                  {Math.round(v * 100)}</span>
              </div>
              <div style={{ fontSize: 10.5, color: P.sub, marginTop: 2 }}>
                {w.what_it_is} — {String((c.raw || {})[w.input_code])}</div>
            </div>);
          })}
          <Note tone="info"><b>Score {c.score} of 100 → {c.band}.</b> Bands: 70+ Critical ·
            50+ High · 30+ Moderate · below that Low.</Note>
        </Panel>
        <Note><b>This number is ours, not SEI's.</b> The specification says nothing about
          criticality. It is computed from things CP360 can observe — live subscriptions,
          measured volume, column coupling, and whatever the contract leaves unstated.
          Change the weights in <span style={{ fontFamily: P.mono }}>
            ref_event_criticality_weight</span> and the band changes; that is the point of
          showing them. Do not quote it back to SEI as though it came from them.</Note>
      </div>)}

    {tab === 'sub' && (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.25fr) minmax(0,1fr)',
        gap: 12, alignItems: 'start' }}>
        <Panel title={`Subscriptions on this event — ${(d.subscriptions || []).length}`}
          src="CTL_EVENT_SUBSCRIPTION" pad={false}>
          {(d.subscriptions || []).length ? (
            <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
              <thead><tr><th style={{ ...th, width: 140 }}>Consumer</th><th style={th}>System</th>
                <th style={{ ...th, width: 80 }}>Delivery</th>
                <th style={{ ...th, width: 130 }}>Filter</th>
                <th style={{ ...th, width: 88 }}>Status</th></tr></thead>
              <tbody>{d.subscriptions.map((s) => (
                <tr key={s.consumer_code}>
                  <td style={mtd}>{s.consumer_code}</td>
                  <td style={td}>{s.consumer_name}</td>
                  <td style={{ ...mtd, fontSize: 10.5 }}>{s.delivery_mode}</td>
                  <td style={{ ...mtd, fontSize: 10.5 }}>{s.filter_expr}</td>
                  <td style={td}><span style={{ fontSize: 10.5, fontWeight: 700,
                    borderRadius: 999, padding: '3px 10px',
                    background: s.status === 'ACTIVE' ? '#e7f6ec' : '#fdf6ec',
                    color: s.status === 'ACTIVE' ? P.ok : P.warnInk }}>{s.status}</span></td>
                </tr>))}</tbody>
            </table>)
            : <div style={{ padding: 14 }}><Note><b>Nobody subscribes to this event.</b> It
              is produced and retained anyway. Either a consumer is missing or the event
              is.</Note></div>}
        </Panel>
        <Note tone="info"><b>The filter is what decides the bill.</b> A subscription set to
          all operations pays for every insert and update; one narrowed to a single
          operation code pays for a fraction. It is the cheapest change available, and
          nobody has to touch the contract to make it.</Note>
      </div>)}

    {tab === 'cost' && (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)',
        gap: 12, alignItems: 'start' }}>
        <Panel title="What reading this event's view costs"
          hint={d.view_profile
            ? `${e.sdc_view} — measured on the reference client's warehouse.`
            : 'This view was not in the compute extract.'}
          src={d.view_profile_note}>
          {d.view_profile ? <KV rows={[
            ['SDC view', <span style={{ fontFamily: P.mono }}>{e.sdc_view}</span>],
            ['Queries measured', num(d.view_profile.queries)],
            ['Seconds per query', Number(d.view_profile.sec_per_query).toFixed(2)],
            ['GB per query', Number(d.view_profile.gb_per_query).toFixed(4)],
            ['Period', d.view_profile.period_id],
            ['Basket of this event alone', cost ? money(cost.usage.per_month) + ' / month' : '—'],
          ]} /> : <Note tone="bad"><b>Not measured.</b> {e.sdc_view
            ? <>The compute extract did not include <span style={{ fontFamily: P.mono }}>
              {e.sdc_view}</span>. That is not the same as free — extend the extract before
              pricing anything that reads it.</>
            : 'A marker has no view to read, so it has no read-back cost.'}</Note>}
        </Panel>
        <Note><b>The read-back, not the message, is the cost.</b> This event is published
          once and read once per consumer, because every consumer must fetch the record
          rather than trust the payload. Cost scales with consumers, not with the contract —
          and because the bill attaches to the view, other events naming the same view are
          already paying for it.</Note>
      </div>)}
  </>);
}

const KV = ({ rows }) => (
  <dl style={{ display: 'grid', gridTemplateColumns: '150px minmax(0,1fr)',
    gap: '8px 12px', fontSize: 12.5, margin: 0 }}>
    {rows.map(([k, v], i) => (<React.Fragment key={i}>
      <dt style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase',
        color: P.sub, paddingTop: 3 }}>{k}</dt>
      <dd style={{ margin: 0 }}>{v}</dd>
    </React.Fragment>))}
  </dl>);
