// The C4 context level, and the three detail screens that hang off it.
//
// WHY THESE LIVE IN THEIR OWN FILE. HubDesign.jsx is already the router for
// a dozen views; adding six more inline would make the file the thing
// nobody wants to open. Each export here is a leaf screen: it takes t and
// its own selection, and knows nothing about how it was reached.
//
// NO ESCAPED UNICODE ANYWHERE IN THIS FILE. A backslash-u sequence is an
// escape inside a JS string literal and six literal characters in JSX text
// or a JSX attribute. That has shipped to screen three times on this route.
// Real characters only.

import React from "react";
import { CHANNELS, TRANSPORTS, GATEWAY_NOTE, chanById } from "./hubChannels.js";
import { EV_KINDS, EV_RULES, EV_GATE, CLOCKS } from "./hubEventModel.js";
import { LOOP_LEGS, SUB_STATES, LOOP_RULES, LOOP_GAP } from "./hubLoaderLoop.js";
import { FILE_CHAIN, FILE_VALIDATIONS, COUNT_RULE, FAIL_MODES, FILE_POSTURE }
 from "./hubFileIngestion.js";
import { SEI_STATES, SEI_TABLES, SEI_COMPONENTS } from "./seiBaseline.js";
import { S2_DOMAINS, S2_CONTRACT, S2_STD_COLS, S2_GAPS, S2_INFERRED_COUNT,
 S2_RELS, S2_TESTED, s2Table, s2DomainOf, s2DomainName, s2IsAnchor, s2IntKey,
 s2ShortKey, s2RelsOwned, s2RelsInto, s2GapsOn, s2Blocked, s2TablesIn }
 from "./hubStage2Model.js";

const INK = "#10193b", SUB = "#4a5a68", MUT = "#7b8894", RULE = "#dfe6e9";
const OK = "#159943", WARN = "#e67e22", BAD = "#c1113a", ACC = "#0f4775";
const EVC = { Data: "#2a78d6", Marker: "#1baf7a", System: "#eb6834" };
const MONO = '"Roboto Mono",ui-monospace,Menlo,monospace';

const card = (extra) => ({ background: "#fff", border: `1px solid ${RULE}`,
 borderRadius: 8, padding: "14px 17px", marginBottom: 11, ...(extra || {}) });
const eyebrow = { fontSize: 9.5, fontWeight: 800, letterSpacing: 0.7,
 textTransform: "uppercase", color: MUT };
const Chip = ({ bg, fg, children }) => (
 <span style={{ display: "inline-block", fontSize: 9.5, fontWeight: 700,
  letterSpacing: 0.4, textTransform: "uppercase", borderRadius: 3,
  padding: "2px 7px", background: bg, color: fg, whiteSpace: "nowrap" }}>
  {children}</span>);
const Body = ({ children }) => (
 <div style={{ fontSize: 12.5, color: SUB, lineHeight: 1.65, maxWidth: "80ch" }}>
  {children}</div>);
const Head = ({ title, note, right }) => (
 <div style={{ display: "flex", alignItems: "center", gap: 12,
  background: "#1f4f7a", color: "#fff", borderRadius: 10,
  padding: "13px 18px", margin: "16px 0 10px" }}>
  <div><b>{title}</b>
   {note && <div style={{ fontSize: 10, color: "#dfe7f2", marginTop: 2 }}>
    {note}</div>}</div>
  {right && <div style={{ marginLeft: "auto", fontSize: 10.5,
   color: "#dfe7f2" }}>{right}</div>}
 </div>);

/* ===================================================================
   Level 1 - context. Two parties, three transports, four channels.
   =================================================================== */
const Pbox = ({ x, y, w, h, n, s, stroke }) => (
 <g>
  <rect x={x} y={y} width={w} height={h} rx={6} fill="#fff"
   stroke={stroke || RULE} strokeWidth="1.3" />
  <text x={x + w / 2} y={y + (s ? h / 2 - 3 : h / 2 + 4)} textAnchor="middle"
   fontSize="12" fontWeight="500" fill={INK}>{n}</text>
  {s && <text x={x + w / 2} y={y + h / 2 + 12} textAnchor="middle"
   fontSize="10" fill={MUT}>{s}</text>}
 </g>);

function Lane({ y, dir, label, role, dim, onPick }) {
 const col = dim ? MUT : ACC, a = y + 8;
 const dash = dim ? "6 4" : undefined;
 const seg = (x1, x2) => (
  <line x1={x1} y1={a} x2={x2} y2={a} stroke={col} strokeWidth="1.6"
   strokeDasharray={dash} markerEnd="url(#ctxarr)" />);
 return (
  <g onClick={onPick} style={{ cursor: "pointer" }}>
   <rect x="268" y={y - 22} width="424" height="38" fill="transparent" />
   {dir === "in" ? <>{seg(272, 466)}{seg(614, 686)}</>
                 : <>{seg(466, 272)}{seg(686, 614)}</>}
   <text x="276" y={y - 14} fontSize="11.5" fontWeight="500" fill={INK}>
    {label}</text>
   <text x="276" y={y - 2} fontSize="10" fill={dim ? MUT : ACC}>{role}</text>
  </g>);
}

export function ContextView({ t, chan, setChan }) {
 const c = chan ? chanById(chan) : null;
 return (
  <div>
   <div style={card()}>
    <svg viewBox="0 0 1200 500" style={{ width: "100%", height: "auto" }}
     role="img" aria-label="SEI and BBH, three transports and four channels">
     <defs><marker id="ctxarr" viewBox="0 0 10 10" refX="9" refY="5"
      markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill={SUB} /></marker></defs>

     <rect x="20" y="60" width="250" height="400" rx="9" fill="#f4f7f9"
      stroke="#0091bf" strokeWidth="1.5" />
     <text x="145" y="50" textAnchor="middle" fontSize="13" fontWeight="700"
      fill="#0091bf">SEI</text>
     <rect x="690" y="60" width="490" height="400" rx="9" fill="#f4f7f9"
      stroke={ACC} strokeWidth="1.5" />
     <text x="935" y="50" textAnchor="middle" fontSize="13" fontWeight="700"
      fill={ACC}>BBH</text>

     <Pbox x={38} y={100} w={214} h={42} n="SWP" s="the book of record" />
     <Pbox x={38} y={156} w={214} h={56} n="SDC"
      s="Snowflake intake, domain topics" />
     <Pbox x={38} y={226} w={214} h={42} n="SEI PS loader"
      s="processes BBH pushes" />
     <Pbox x={38} y={282} w={214} h={42} n="SFTP extract"
      s="the daily file set" />

     <line x1="640" y1="40" x2="640" y2="478" stroke={RULE} strokeWidth="1.2"
      strokeDasharray="3 5" />
     <text x="640" y="32" textAnchor="middle" fontSize="10" fill={MUT}>
      BBH boundary</text>

     <Pbox x={470} y={98} w={140} h={50} n="SDC consumer"
      s="topic subscription" stroke="#2a78d6" />
     <rect x="470" y="190" width="140" height="130" rx="6" fill="#fff"
      stroke={ACC} strokeWidth="1.3" />
     <text x="540" y="243" textAnchor="middle" fontSize="12.5"
      fontWeight="500" fill={INK}>Apigee</text>
     <text x="540" y="260" textAnchor="middle" fontSize="12.5"
      fontWeight="500" fill={INK}>+ API Gateway</text>
     <text x="540" y="279" textAnchor="middle" fontSize="10" fill={MUT}>
      every API, both ways</text>
     <g opacity="0.62"><Pbox x={470} y={345} w={140} h={75} n="File transport"
      s="SFTP / Momentum" /></g>

     <Lane y={120} dir="in" label="1 - Change events"
      role="PRIMARY - notification only" onPick={() => setChan("C1")} />
     <Lane y={205} dir="out" label="2 - Data fetch"
      role="fetches what the events name" onPick={() => setChan("C2")} />
     <Lane y={247} dir="out" label="3 - Loader push" role="BBH data to SEI"
      onPick={() => setChan("C4")} />
     <Lane y={289} dir="in" label="4 - Status back" role="verdict and counts"
      onPick={() => setChan("C4")} />
     <Lane y={360} dir="in" label="5 - File delivery"
      role="STANDBY - recovery route" dim onPick={() => setChan("C3")} />
     <Lane y={400} dir="in" label="6 - Error detail"
      role="which records, and why" dim onPick={() => setChan("C4")} />

     <rect x="706" y="96" width="458" height="196" rx="6" fill="#fff"
      stroke={RULE} />
     <text x="718" y="114" fontSize="9.5" fontWeight="700" fill={MUT}>
      INTEGRATION HUB</text>
     <Pbox x={718} y={124} w={216} h={40} n="Event listener"
      s="+ collapser, idempotency" />
     <Pbox x={946} y={124} w={206} h={40} n="Set-based puller"
      s="one pull per view" />
     <Pbox x={718} y={172} w={216} h={40} n="Loader framework"
      s="template, map, push" />
     <Pbox x={946} y={172} w={206} h={40} n="Integration 360"
      s="status intake, registry" />
     <Pbox x={718} y={228} w={434} h={48} n="Completeness gate"
      s="DATE_CONTROL - PENDING to TRIGGER" stroke={ACC} />

     <rect x="706" y="308" width="458" height="142" rx="6" fill="#fff"
      stroke={RULE} />
     <text x="718" y="326" fontSize="9.5" fontWeight="700" fill={MUT}>
      DATA HUB</text>
     {["RAW", "STG", "INT", "DIM/FACT", "Pre-Gold", "Stage 3"].map((n, i) => (
      <g key={n}>
       <Pbox x={720 + i * 73} y={338} w={62} h={36} n={n} />
       {i < 5 && <line x1={783 + i * 73} y1="356" x2={791 + i * 73} y2="356"
        stroke={SUB} strokeWidth="1.6" markerEnd="url(#ctxarr)" />}
      </g>))}
     <text x="718" y="400" fontSize="10.5" fill={MUT}>
      Stage 1 lands it - Stage 2 checks and normalises it -</text>
     <text x="718" y="416" fontSize="10.5" fill={MUT}>
      Gold models it - Pre-Gold mirrors the warehouse - Stage 3 is movement</text>
     <text x="718" y="438" fontSize="10.5" fill={MUT}>
      Consumers read the Hub APIs through the same gateway.</text>
    </svg>
    <div style={{ fontSize: 11.5, color: SUB, lineHeight: 1.6, marginTop: 8,
     maxWidth: "92ch" }}>
     <b>Three transports, four channels.</b> Events and files cross on their
     own transports. Everything API-shaped - the data fetch, the loader push,
     the status coming back, and every consumer call - crosses through Apigee
     and the API Gateway. That band is a wall, not a step in a chain. Click a
     channel.
    </div>
   </div>

   {c ? (
    <div style={card()}>
     <div style={eyebrow}>Channel {c.no}</div>
     <div style={{ display: "flex", gap: 9, alignItems: "baseline",
      flexWrap: "wrap", margin: "3px 0 7px" }}>
      <b style={{ fontSize: 15, color: INK }}>{c.name}</b>
      {c.role === "primary" ? <Chip bg={ACC} fg="#fff">Primary</Chip>
                            : <Chip bg="#eef1f4" fg={MUT}>Standby</Chip>}
     </div>
     <Body><div style={{ color: INK, marginBottom: 5 }}>{c.one}</div>
      {c.detail}</Body>
     <div style={{ ...eyebrow, margin: "13px 0 3px" }}>How it runs</div>
     {c.legs.map((l, i) => (
      <div key={i} style={{ display: "flex", gap: 11, padding: "9px 0",
       borderTop: i ? `1px solid #eef3f5` : "none" }}>
       <span style={{ flex: "0 0 22px", height: 22, borderRadius: "50%",
        background: l[0] === "SEI" ? "#0091bf" : ACC, color: "#fff",
        fontSize: 11, fontWeight: 700, display: "grid",
        placeItems: "center" }}>{i + 1}</span>
       <span><b style={{ fontSize: 9.5, color: MUT, letterSpacing: 0.4 }}>
        {l[0]}</b>
        <div style={{ fontSize: 12.5, color: SUB, lineHeight: 1.6 }}>
         {l[1]}</div></span>
      </div>))}
     <div style={{ fontSize: 10.5, color: MUT, marginTop: 10 }}>
      Transport - {c.transport} &nbsp;-&nbsp; {c.src}</div>
    </div>
   ) : (
    <div style={card()}>
     <div style={eyebrow}>The pattern underneath</div>
     <Body>One idea, applied four times: <b style={{ color: INK }}>a thin
      signal on one transport, the payload on another.</b> Inbound, the event
      says a row changed and the API fetches it. Outbound, the status API
      gives the verdict and a file carries the per-record detail. Learn it
      once and all four channels read the same way.</Body>
    </div>)}

   <Head title="The gateway is a chokepoint, and that cuts both ways"
    note="one managed door - and one shared quota" />
   <div style={{ display: "grid", gap: 9,
    gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
    <div style={card({ marginBottom: 0, borderLeft: `3px solid ${OK}` })}>
     <div style={eyebrow}>What it buys</div>
     <ul style={{ fontSize: 12.5, color: SUB, lineHeight: 1.65,
      margin: "7px 0 0", paddingLeft: 17 }}>
      {GATEWAY_NOTE.buys.map((b) => <li key={b}>{b}</li>)}</ul>
    </div>
    <div style={card({ marginBottom: 0, borderLeft: `3px solid ${BAD}` })}>
     <div style={eyebrow}>What it costs</div>
     <Body><div style={{ marginTop: 6 }}>{GATEWAY_NOTE.costs}</div>
      <div style={{ marginTop: 8, color: INK }}>{GATEWAY_NOTE.fix}</div></Body>
    </div>
   </div>

   <Head title="Transports" note="three pipes, not four" />
   <div style={{ display: "grid", gap: 8,
    gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
    {TRANSPORTS.map((x) => (
     <div key={x.id} style={card({ marginBottom: 0 })}>
      <b style={{ fontSize: 12.5, color: INK }}>{x.n}</b>
      <div style={{ fontSize: 10.5, color: MUT, marginTop: 2 }}>{x.sub}</div>
      <div style={{ marginTop: 8 }}>
       {x.role === "primary" ? <Chip bg={ACC} fg="#fff">Primary</Chip>
                             : <Chip bg="#eef1f4" fg={MUT}>Standby</Chip>}
      </div>
     </div>))}
   </div>
  </div>);
}

/* ===================================================================
   Events and the gate.
   =================================================================== */
export function GateView({ t, onFile }) {
 return (
  <div>
   <div style={card()}>
    <b style={{ fontSize: 15, color: INK }}>
     Three kinds of event, three different jobs</b>
    <Body><div style={{ marginTop: 6 }}>Conflating any two of them is the
     mistake this screen exists to prevent. The boundary tells you a commit
     is whole; the system event tells you a process has finished; neither
     tells you how many records to expect.</div></Body>
   </div>
   <div style={{ display: "grid", gap: 9,
    gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
    {EV_KINDS.map((k) => (
     <div key={k.k} style={card({ marginBottom: 0 })}>
      <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
       <Chip bg={EVC[k.k]} fg="#fff">{k.k}</Chip>
       <span style={{ fontSize: 10.5, color: MUT }}>{k.cadence}</span></div>
      <div style={{ fontSize: 13, fontWeight: 500, color: INK,
       margin: "9px 0 4px", lineHeight: 1.5 }}>{k.tells}</div>
      <div style={{ fontFamily: MONO, fontSize: 11, color: MUT,
       marginBottom: 6 }}>{k.carries}</div>
      <Body>{k.note}</Body>
     </div>))}
   </div>

   <Head title="The two clocks"
    note="the daily DAG is not extended to run 288 times" />
   <div style={{ display: "grid", gap: 9,
    gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
    {CLOCKS.map((c) => (
     <div key={c.id} style={card({ marginBottom: 0 })}>
      <b style={{ fontSize: 13, color: INK }}>{c.n}</b>
      <div style={{ fontSize: 10.5, color: MUT, marginTop: 2 }}>{c.cadence}</div>
      <Body><div style={{ marginTop: 7 }}>{c.owns}</div></Body>
     </div>))}
   </div>

   <Head title="The gate" note="one guarded UPDATE, two ways to satisfy it" />
   <div style={card()}><Body>{EV_GATE.what}</Body></div>
   <div style={{ display: "grid", gap: 9,
    gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))" }}>
    {EV_GATE.arms.map((a) => (
     <div key={a.id} style={card({ marginBottom: 0,
      borderLeft: `3px solid ${a.live ? "#2a78d6" : MUT}` })}>
      <div style={eyebrow}>{a.name} - {a.sub}</div>
      <ul style={{ margin: "8px 0", paddingLeft: 17 }}>
       {a.cond.map((x) => (
        <li key={x} style={{ fontFamily: MONO, fontSize: 11.5, color: INK,
         lineHeight: 1.7 }}>{x}</li>))}</ul>
      <Body>{a.why}</Body>
      {!a.live && onFile && (
       <div onClick={onFile} style={{ fontSize: 11, fontWeight: 700,
        color: ACC, cursor: "pointer", marginTop: 8 }}>
        the file path, end to end -&gt;</div>)}
      <div style={{ fontSize: 10.5, color: MUT, marginTop: 7 }}>{a.src}</div>
     </div>))}
   </div>

   <div style={card({ borderLeft: `3px solid ${WARN}`, marginTop: 11 })}>
    <div style={eyebrow}>When neither arm is satisfied by the cutoff</div>
    <Body><div style={{ marginTop: 5 }}>{EV_GATE.sla}</div></Body>
   </div>
   <div style={card({ borderLeft: `3px solid ${BAD}` })}>
    <div style={eyebrow}>The non-gating rule</div>
    <Body><div style={{ marginTop: 5 }}>{EV_GATE.nonGating}</div></Body>
   </div>

   <Head title="Consumer rules the listener must honour"
    note="from the event specification, verbatim" />
   <div style={card()}>
    <ul style={{ fontSize: 12.5, color: SUB, lineHeight: 1.7, margin: 0,
     paddingLeft: 17 }}>
     {EV_RULES.map((r) => <li key={r}>{r}</li>)}</ul>
   </div>
  </div>);
}

/* ===================================================================
   The loader loop.
   =================================================================== */
export function LoaderLoopView({ t }) {
 return (
  <div>
   <div style={card()}>
    <b style={{ fontSize: 15, color: INK }}>A loop, not an arrow</b>
    <Body><div style={{ marginTop: 6 }}>Legs 2 and 3 cross the gateway; leg 4
     arrives on the file transport. The consumer cannot be answered until the
     status and the detail file agree, which is why this contract is
     asynchronous by necessity rather than by preference.</div></Body>
    <div style={{ marginTop: 13 }}>
     {LOOP_LEGS.map((l) => (
      <div key={l[0]} style={{ display: "flex", gap: 11, padding: "9px 0",
       borderTop: l[0] === "1" ? "none" : "1px solid #eef3f5" }}>
       <span style={{ flex: "0 0 22px", height: 22, borderRadius: "50%",
        background: ACC, color: "#fff", fontSize: 11, fontWeight: 700,
        display: "grid", placeItems: "center" }}>{l[0]}</span>
       <span><b style={{ fontSize: 12.5, color: INK }}>{l[1]}</b>
        <div style={{ fontSize: 12, color: SUB, lineHeight: 1.6 }}>
         {l[2]}</div></span>
      </div>))}
    </div>
   </div>

   <Head title="Submission lifecycle"
    note="what a batch can be, and what each state means" />
   <div style={card()}>
    {SUB_STATES.map((s, i) => (
     <div key={s[0]} style={{ display: "flex", gap: 14, padding: "9px 0",
      borderTop: i ? "1px solid #eef3f5" : "none" }}>
      <span style={{ fontFamily: MONO, fontSize: 11.5, color: INK,
       flex: "0 0 180px" }}>{s[0]}</span>
      <span style={{ fontSize: 12.5, color: SUB, lineHeight: 1.6 }}>
       {s[1]}</span>
     </div>))}
   </div>

   <Head title="What holds the loop together" note="and what breaks if it does not" />
   <div style={card()}>
    {LOOP_RULES.map((r, i) => (
     <div key={r[0]} style={{ display: "flex", gap: 14, padding: "9px 0",
      borderTop: i ? "1px solid #eef3f5" : "none" }}>
      <span style={{ fontSize: 12.5, fontWeight: 500, color: INK,
       flex: "0 0 180px" }}>{r[0]}</span>
      <span style={{ fontSize: 12.5, color: SUB, lineHeight: 1.6 }}>
       {r[1]}</span>
     </div>))}
   </div>

   <div style={card({ borderLeft: `3px solid ${BAD}` })}>
    <div style={eyebrow}>{LOOP_GAP.t}</div>
    <Body><div style={{ marginTop: 5 }}>{LOOP_GAP.b}</div></Body>
    <ul style={{ fontSize: 12.5, color: SUB, lineHeight: 1.65,
     margin: "9px 0 0", paddingLeft: 17 }}>
     {LOOP_GAP.needs.map((n) => <li key={n}>{n}</li>)}</ul>
   </div>
  </div>);
}

/* ===================================================================
   Stage 2 INT - the canonical model. Domain map, one domain, one table.
   =================================================================== */
const EDGE = { fk: [OK, "Declared FK"], inf: [WARN, "Inferred - enforced nowhere"] };

function EdgeRow({ r, i, onPick }) {
 const e = EDGE[r.kind];
 return (
  <div onClick={() => onPick && onPick(r.child)}
   style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "7px 0",
    borderTop: i ? "1px solid #eef3f5" : "none", cursor: onPick ? "pointer" : "default" }}>
   <span style={{ width: 8, height: 8, borderRadius: "50%", background: e[0],
    flex: "0 0 auto", marginTop: 4 }} />
   <span style={{ fontFamily: MONO, fontSize: 11.5, color: INK, flex: "1 1 40%",
    minWidth: 0, overflowWrap: "anywhere" }}>
    {r.child}{r.col && <span style={{ color: MUT }}> . {r.col}</span>}</span>
   <span style={{ fontSize: 11, color: MUT }}>to</span>
   <span style={{ fontFamily: MONO, fontSize: 11.5, color: INK,
    flex: "1 1 25%", minWidth: 0, overflowWrap: "anywhere" }}>{r.parent}</span>
   <span style={{ fontSize: 11, color: SUB, flex: "1 1 30%" }}>
    {e[1]}{r.kind === "inf" && <span style={{ color: MUT }}> - {r.label}</span>}
    {r.tested && <span style={{ marginLeft: 6, border: "1px solid #3a6f9e",
     color: "#3a6f9e", borderRadius: 3, padding: "1px 5px", fontSize: 9,
     fontWeight: 700, letterSpacing: 0.4 }}>DBT TEST</span>}</span>
  </div>);
}

export function Stage2Model({ t, dom, tbl, setDom, setTbl }) {
 /* ---- one table ---- */
 if (tbl) {
  const r = s2Table(tbl);
  if (!r) return <div style={card()}>Not in the model.</div>;
  const pars = S2_RELS.filter((x) => x.child === tbl);
  const kids = S2_RELS.filter((x) => x.parent === tbl);
  const gaps = s2GapsOn(tbl);
  const anchor = s2IsAnchor(tbl);
  const inDoms = anchor ? [...new Set(S2_RELS
   .filter((x) => x.parent === tbl || x.child === tbl)
   .map((x) => s2DomainOf(x.child === tbl ? x.parent : x.child))
   .filter(Boolean))] : [];
  const KV = ({ k, children }) => (
   <div style={{ display: "flex", gap: 14, padding: "6px 0" }}>
    <span style={{ ...eyebrow, flex: "0 0 150px", paddingTop: 2 }}>{k}</span>
    <span style={{ fontSize: 12.5, color: SUB, lineHeight: 1.6 }}>{children}</span>
   </div>);
  return (
   <div>
    <div style={card()}>
     <div style={eyebrow}>{s2DomainName(r[0])}{anchor ? " - anchor entity" : ""}</div>
     <div style={{ fontFamily: MONO, fontSize: 17, fontWeight: 500, color: INK,
      margin: "5px 0 2px", overflowWrap: "anywhere" }}>{tbl}</div>
     {anchor && inDoms.length > 0 && (
      <Body><div style={{ marginTop: 5 }}>Referenced from {inDoms.length} domains
       - {inDoms.map((d) => s2DomainName(d)).join(", ")}.</div></Body>)}
     <div style={{ marginTop: 11 }}>
      <KV k="INT key"><span style={{ fontFamily: MONO, color: INK }}>
       {s2IntKey(r)}</span></KV>
      <KV k="Dictionary key"><span style={{ fontFamily: MONO,
       color: r[2] ? INK : MUT }}>{r[2] || "not defined"}</span></KV>
      <KV k="Source sheet">{r[4]}</KV>
      <KV k="Feeds from">SWP feed to FILE_SCHEMA_CONFIG interface to Stage 1
       RAW to the STG view to this table</KV>
      <KV k="Reconciliation">STG PASS count = INT count, per BUSINESS_DATE -
       boundary <span style={{ fontFamily: MONO }}>STG_TO_INT</span></KV>
      <KV k="Retention">7 days, partition drop on BUSINESS_DATE</KV>
     </div>
    </div>
    {gaps.length > 0 && (
     <div style={card({ borderLeft: `3px solid ${gaps.some((g) => g.block) ? BAD : WARN}` })}>
      <div style={eyebrow}>Unresolved on this table</div>
      {gaps.map((g) => (
       <div key={g.n} style={{ marginTop: 9 }}>
        <Chip bg={g.block ? BAD : WARN} fg="#fff">
         Gap {g.n}{g.block ? " - blocks a build" : ""}</Chip>
        <div style={{ fontSize: 12.5, color: INK, lineHeight: 1.6,
         marginTop: 5 }}>{g.g}</div>
        <div style={{ fontSize: 12.5, color: SUB, lineHeight: 1.6 }}>{g.r}</div>
       </div>))}
     </div>)}
    <div style={{ display: "grid", gap: 9,
     gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))" }}>
     <div style={card({ marginBottom: 0 })}>
      <div style={eyebrow}>Points at - {pars.length}</div>
      {pars.length ? pars.map((x, i) => (
       <EdgeRow key={x.child + x.parent + (x.col || i)} r={x} i={i}
        onPick={(n) => setTbl(n === tbl ? null : n)} />))
       : <div style={{ fontSize: 12, color: MUT, marginTop: 7 }}>Nothing.</div>}
     </div>
     <div style={card({ marginBottom: 0 })}>
      <div style={eyebrow}>Pointed at by - {kids.length}</div>
      {kids.length ? kids.map((x, i) => (
       <EdgeRow key={x.child + x.parent + (x.col || i)} r={x} i={i}
        onPick={(n) => setTbl(n)} />))
       : <div style={{ fontSize: 12, color: MUT, marginTop: 7 }}>Nothing.</div>}
     </div>
    </div>
   </div>);
 }

 /* ---- one domain ---- */
 if (dom) {
  const tabs = s2TablesIn(dom);
  const own = s2RelsOwned(dom);
  const into = s2RelsInto(dom);
  const outside = [...new Set(own.concat(into)
   .map((r) => [r.child, r.parent]).flat()
   .filter((n) => s2Table(n) && s2DomainOf(n) !== dom))];
  const Ent = ({ n, sub, anchor, gaps }) => (
   <div onClick={() => setTbl(n)} style={{ background: "#fff",
    border: `1px solid ${RULE}`, borderLeft: anchor ? `3px solid ${ACC}` : undefined,
    borderRadius: 6, padding: "9px 11px", cursor: "pointer" }}>
    <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500, color: INK,
     overflowWrap: "anywhere" }}>{n}
     {gaps > 0 && <span style={{ display: "inline-block", width: 7, height: 7,
      borderRadius: "50%", marginLeft: 5,
      background: s2Blocked(n) ? BAD : WARN }} />}</div>
    <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUT, marginTop: 3,
     overflowWrap: "anywhere" }}>{sub}</div>
   </div>);
  return (
   <div>
    <div style={card()}>
     <b style={{ fontSize: 15, color: INK }}>{s2DomainName(dom)}</b>
     <div style={{ fontSize: 11, color: MUT, marginTop: 4 }}>
      {tabs.length} tables - {own.length} relationships out - {into.length} in
      - anchors shown with a left rule - a dot marks an unresolved model gap</div>
    </div>
    <div style={{ display: "grid", gap: 8,
     gridTemplateColumns: "repeat(auto-fit,minmax(205px,1fr))",
     alignItems: "start" }}>
     {tabs.map((r) => (
      <Ent key={r[1]} n={r[1]} sub={s2ShortKey(r)} anchor={s2IsAnchor(r[1])}
       gaps={s2GapsOn(r[1]).length} />))}
    </div>
    {outside.length > 0 && (
     <>
      <Head title="Also referenced, from other domains" />
      <div style={{ display: "grid", gap: 8,
       gridTemplateColumns: "repeat(auto-fit,minmax(205px,1fr))",
       alignItems: "start" }}>
       {outside.map((n) => (
        <Ent key={n} n={n} sub={s2DomainName(s2DomainOf(n))}
         anchor={s2IsAnchor(n)} gaps={s2GapsOn(n).length} />))}
      </div>
     </>)}
    <Head title={`Relationships from this domain - ${own.length}`} />
    <div style={card()}>
     {own.map((x, i) => (
      <EdgeRow key={x.child + x.parent + (x.col || i)} r={x} i={i}
       onPick={setTbl} />))}
    </div>
    {into.length > 0 && (
     <>
      <Head title={`Referenced from other domains - ${into.length}`} />
      <div style={card()}>
       {into.map((x, i) => (
        <EdgeRow key={x.child + x.parent + (x.col || i)} r={x} i={i}
         onPick={setTbl} />))}
      </div>
     </>)}
   </div>);
 }

 /* ---- the domain map ---- */
 return (
  <div>
   <div style={card()}>
    <div style={eyebrow}>Stage 2 - INT - normalised SWP model</div>
    <b style={{ fontSize: 16, color: INK }}>52 canonical tables, 10 domains</b>
    <Body><div style={{ marginTop: 6 }}>38 SWP feeds, 1,452 business
     attributes, 3NF. Fed only by STG PASS rows, partitioned by
     BUSINESS_DATE, 7-day retention. Pick a domain.</div></Body>
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 11,
     fontSize: 11.5, color: SUB, alignItems: "center" }}>
     {[[OK, "declared foreign key"], [WARN, "inferred - enforced nowhere"]]
      .map(([c, l]) => (
       <span key={l} style={{ display: "inline-flex", alignItems: "center",
        gap: 6, border: `1px solid ${RULE}`, borderRadius: 999,
        padding: "3px 11px" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%",
         background: c }} />{l}</span>))}
     <span style={{ border: "1px solid #3a6f9e", color: "#3a6f9e",
      borderRadius: 999, padding: "3px 11px" }}>dbt relationships test</span>
    </div>
   </div>
   <div style={{ display: "grid", gap: 9,
    gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
    {S2_DOMAINS.map((d) => {
     const own = s2RelsOwned(d.k);
     const inf = own.filter((r) => r.kind === "inf").length;
     const into = s2RelsInto(d.k).length;
     const nokey = s2TablesIn(d.k).filter((r) => s2Blocked(r[1])).length;
     return (
      <div key={d.k} onClick={() => setDom(d.k)} style={card({ marginBottom: 0,
       cursor: "pointer" })}>
       <b style={{ fontSize: 13, color: INK }}>{d.n}</b>
       <div style={{ fontSize: 11, color: MUT, margin: "3px 0 8px" }}>
        {d.c} tables - {own.length} out{into ? ` - ${into} in` : ""}</div>
       <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Chip bg="#eef1f4" fg={MUT}>{own.length - inf} declared</Chip>
        <Chip bg="#fdf2e3" fg="#a8560f">{inf} inferred</Chip>
        {nokey > 0 && <Chip bg={BAD} fg="#fff">
         {nokey} key{nokey > 1 ? "s" : ""} undecided</Chip>}
       </div>
      </div>);
    })}
   </div>

   <div style={card({ borderLeft: `3px solid ${WARN}`, marginTop: 11 })}>
    <Body><b style={{ color: INK }}>{S2_INFERRED_COUNT} of {S2_RELS.length}
     relationships are not declared foreign keys</b>, and {S2_TESTED.size} are
     proposed as dbt tests. Every edge is either declared, tested, or enforced
     nowhere - and the third group is where the build risk sits.</Body>
   </div>

   <Head title="The INT contract" note="how a canonical table behaves as an INT model" />
   <div style={card()}>
    {S2_CONTRACT.map((c, i) => (
     <div key={c[0]} style={{ display: "flex", gap: 14, padding: "8px 0",
      borderTop: i ? "1px solid #eef3f5" : "none" }}>
      <span style={{ fontSize: 12.5, fontWeight: 500, color: INK,
       flex: "0 0 170px" }}>{c[0]}</span>
      <span style={{ fontSize: 12.5, color: SUB, lineHeight: 1.6 }}>{c[1]}</span>
     </div>))}
   </div>

   <Head title="Standard INT columns - on all 52"
    note="not in the dictionary, so every dictionary key is short by at least one" />
   <div style={card()}>
    {S2_STD_COLS.map((c, i) => (
     <div key={c[0]} style={{ display: "flex", gap: 14, padding: "7px 0",
      borderTop: i ? "1px solid #eef3f5" : "none" }}>
      <span style={{ fontFamily: MONO, fontSize: 11.5, color: INK,
       flex: "0 0 180px" }}>{c[0]}</span>
      <span style={{ fontSize: 11, color: MUT, flex: "0 0 90px" }}>{c[1]}</span>
      <span style={{ fontSize: 12.5, color: SUB }}>{c[2]}</span>
     </div>))}
   </div>

   <Head title="Model gaps" note="found while building the ERD from the two artifacts" />
   <div style={{ display: "grid", gap: 8 }}>
    {S2_GAPS.slice().sort((a, b) => (b.block ? 1 : 0) - (a.block ? 1 : 0))
     .map((g) => (
      <div key={g.n} style={card({ marginBottom: 0,
       borderLeft: `3px solid ${g.block ? BAD : WARN}` })}>
       <div style={{ display: "flex", gap: 8, alignItems: "baseline",
        flexWrap: "wrap" }}>
        <Chip bg={g.block ? BAD : WARN} fg="#fff">
         Gap {g.n}{g.block ? " - blocks a build" : ""}</Chip>
        {g.on.length > 0 && (
         <span style={{ fontSize: 10.5, color: MUT, fontFamily: MONO }}>
          {g.on.slice(0, 3).join(", ")}
          {g.on.length > 3 ? ` +${g.on.length - 3}` : ""}</span>)}
       </div>
       <div style={{ fontSize: 12.5, color: INK, lineHeight: 1.6,
        marginTop: 6 }}>{g.g}</div>
       <div style={{ fontSize: 12.5, color: SUB, lineHeight: 1.6 }}>{g.r}</div>
      </div>))}
   </div>
  </div>);
}

/* ===================================================================
   File-based ingestion - the path both design documents describe.
   The states and the control tables are read from the SEI baseline
   rather than restated, so there is one copy of each.
   =================================================================== */
export function FileIngestionView({ t, onComp }) {
 const reg = SEI_STATES.file_registry;
 const tbl = (id) => SEI_TABLES.find((x) => x.id === id);
 const comp = (id) => SEI_COMPONENTS.find((x) => x.id === id);
 const SEV = { warn: WARN, bad: BAD };
 return (
  <div>
   <div style={card()}>
    <b style={{ fontSize: 15, color: INK }}>
     Discover, validate, load, reconcile, archive</b>
    <Body><div style={{ marginTop: 6 }}>The path both SEI design documents
     describe, and the best-specified thing in the pack. Every step below is
     cited; click a component for its record.</div></Body>
   </div>

   {FILE_CHAIN.map((f, i) => (
    <div key={f.id} style={card({ borderLeft: `3px solid ${ACC}` })}>
     <div style={{ display: "flex", gap: 12, alignItems: "baseline",
      flexWrap: "wrap" }}>
      <span style={{ flex: "0 0 22px", height: 22, borderRadius: "50%",
       background: ACC, color: "#fff", fontSize: 11, fontWeight: 700,
       display: "grid", placeItems: "center" }}>{i + 1}</span>
      <b style={{ fontSize: 13.5, color: INK }}>{f.n}</b>
      <span style={{ fontFamily: MONO, fontSize: 10.5, color: MUT }}>
       {f.tech}</span>
     </div>
     <Body><div style={{ marginTop: 7 }}>{f.w}</div></Body>
     <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 9 }}>
      {f.sei.map((id) => {
       const c = comp(id);
       return (
        <span key={id} onClick={() => onComp && onComp(id)}
         style={{ fontSize: 10, fontWeight: 700, borderRadius: 3,
          padding: "2px 8px", background: "#e4f0fb", color: ACC,
          cursor: onComp ? "pointer" : "default" }}>
         {c ? c.n : id}</span>);
      })}
      {f.tbl.map((id) => {
       const x = tbl(id);
       return (
        <span key={id} style={{ fontFamily: MONO, fontSize: 10,
         fontWeight: 700, borderRadius: 3, padding: "2px 8px",
         background: "#eef1f4", color: "#5c6b7a" }}>{x ? x.n : id}</span>);
      })}
     </div>
    </div>))}

   <Head title="What validation means, in order"
    note="all of it before a single row reaches RAW" />
   <div style={card()}>
    {FILE_VALIDATIONS.map((v, i) => (
     <div key={v[0]} style={{ display: "flex", gap: 14, padding: "8px 0",
      borderTop: i ? "1px solid #eef3f5" : "none" }}>
      <span style={{ fontSize: 12.5, fontWeight: 500, color: INK,
       flex: "0 0 150px" }}>{v[0]}</span>
      <span style={{ fontSize: 12.5, color: SUB, lineHeight: 1.6 }}>
       {v[1]}</span>
     </div>))}
   </div>

   <Head title="The commit condition" note="checked before the commit, not after" />
   <div style={card({ borderLeft: `3px solid ${OK}` })}>
    <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700,
     color: INK }}>{COUNT_RULE.eq}</div>
    <Body><div style={{ marginTop: 7 }}>{COUNT_RULE.w}</div></Body>
   </div>

   <Head title="Three ways it fails, three different recoveries"
    note="collapsing them into one is how a business date gets duplicated" />
   <div style={{ display: "grid", gap: 9,
    gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
    {FAIL_MODES.map((f) => (
     <div key={f.st} style={card({ marginBottom: 0,
      borderLeft: `3px solid ${SEV[f.sev]}` })}>
      <Chip bg={SEV[f.sev]} fg="#fff">{f.st}</Chip>
      <div style={{ fontSize: 12.5, color: INK, lineHeight: 1.6,
       marginTop: 8 }}>{f.when}</div>
      <div style={{ fontSize: 12, color: SUB, lineHeight: 1.6,
       marginTop: 4 }}><b>RAW:</b> {f.raw}</div>
      <div style={{ fontSize: 12.5, color: SUB, lineHeight: 1.6,
       marginTop: 6 }}>{f.fix}</div>
     </div>))}
   </div>

   <Head title={reg.n} note={`the lifecycle record - ${reg.ev}`} />
   <div style={card()}>
    {reg.rows.map((r, i) => (
     <div key={r[0]} style={{ display: "flex", gap: 14, padding: "8px 0",
      borderTop: i ? "1px solid #eef3f5" : "none" }}>
      <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 700,
       color: INK, flex: "0 0 150px" }}>{r[0]}</span>
      <span style={{ fontSize: 12.5, color: SUB, flex: "1 1 45%",
       lineHeight: 1.6 }}>{r[1]}</span>
      <span style={{ fontSize: 12, color: MUT, flex: "1 1 35%",
       lineHeight: 1.6 }}>{r[2]}</span>
     </div>))}
   </div>

   <Head title="The two control tables it runs on"
    note="what is expected, and what arrived" />
   <div style={{ display: "grid", gap: 9,
    gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))" }}>
    {["T1", "T2"].map((id) => {
     const x = tbl(id);
     if (!x) return null;
     return (
      <div key={id} style={card({ marginBottom: 0 })}>
       <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 500,
        color: INK }}>{x.n}</div>
       <Body><div style={{ marginTop: 6 }}>{x.w}</div></Body>
       <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUT,
        lineHeight: 1.7, marginTop: 8, overflowWrap: "anywhere" }}>
        {x.cols}</div>
       <div style={{ fontSize: 10.5, color: MUT, marginTop: 7 }}>{x.ev}</div>
      </div>);
    })}
   </div>

   <div style={card({ borderLeft: `3px solid ${WARN}`, marginTop: 11 })}>
    <div style={eyebrow}>{FILE_POSTURE.q}</div>
    <Body><div style={{ marginTop: 5 }}>{FILE_POSTURE.b}</div></Body>
    <ul style={{ fontSize: 12.5, color: SUB, lineHeight: 1.65,
     margin: "9px 0 0", paddingLeft: 17 }}>
     {FILE_POSTURE.turns.map((x) => <li key={x}>{x}</li>)}</ul>
   </div>
  </div>);
}
