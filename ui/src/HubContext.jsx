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
import { NavStyles, OpenCard, ClickHint, SvgGo } from "./HubNav.jsx";
import { CHANNELS, TRANSPORTS, GATEWAY_NOTE, chanById } from "./hubChannels.js";
import { EV_KINDS, EV_RULES, EV_GATE, CLOCKS } from "./hubEventModel.js";
import { LOOP_LEGS, SUB_STATES, LOOP_RULES, LOOP_GAP } from "./hubLoaderLoop.js";
import { FILE_CHAIN, FILE_VALIDATIONS, COUNT_RULE, FAIL_MODES, FILE_POSTURE }
 from "./hubFileIngestion.js";
import { S1_SHAPE, S1_RULES, S1_COLS, S1_TABLES, S1_CONFLICT, S1_NOT_HERE,
 s1Both, s1ArchOnly } from "./hubStage1Model.js";
import { DB_PATH, DB_CONTROL, DB_ABSENT, DB_LINKS, DB_NOTE, dbNode }
 from "./hubDbModel.js";
import { FEEDS, RAW_TABLES, RAW_CONF, RAW_WITHOUT_FEED, FAN_OUT,
 FEED_SUMMARY, feedsForRaw, feedsUnmapped, feedOfTable, feedsForDomain }
 from "./hubFeedMap.js";
import { GAP_DOC, GAP_SCOPE, GAP_PRECEDENCE, GAP_TIERS, GAP_REGISTER,
 GAP_IDENTIFIERS, GAP_FOUNDATION, GAP_OUTBOUND_ERD, GAP_RECON, GAP_MOVEMENT,
 GAP_DECISIONS, GAP_ACCEPTANCE, GAP_CODE_FINDING, GAP_NAMING, GAP_HADR_OPEN,
 BUILD_LABEL, buildStatus, BUILD_SUMMARY } from "./hubGapSupplement.js";
import { GW_DOC, GW_STRENGTHS, GW_GAPS, GW_RISKS, GW_OPERATION, GW_HEADERS,
 GW_TOKEN_STATES, GW_TOKEN_TESTS, GW_SECRETS, GW_RUNTIME_OBJECTS,
 GW_METRICS, GW_RUNBOOKS, GW_APPROVAL, GW_PLAN, GW_BLOCKING }
 from "./hubGatewayReview.js";
import { RECONCILE, RC_VERDICT, RC_COUNTS, rcBy } from "./hubGapReconcile.js";
import { SEI_STATES, SEI_TABLES, SEI_COMPONENTS } from "./seiBaseline.js";
import { S2_DOMAINS, S2_TABLES, S2_CONTRACT, S2_STD_COLS, S2_GAPS, S2_INFERRED_COUNT,
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
  <g className="cp-hit" onClick={onPick} tabIndex={0} role="button">
   <rect x="268" y={y - 22} width="424" height="38" fill="transparent" />
   <SvgGo x={668} y={y - 12} />
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
   <NavStyles />
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
     and the API Gateway. That band is a wall, not a step in a chain.
    </div>
    <ClickHint>Each of the six numbered channels opens what crosses on it,
     which transport carries it, and what breaks when it stops.</ClickHint>
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
   <NavStyles />
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
   <NavStyles />
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
   className={onPick ? "cp-row" : undefined}
   style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "7px 0",
    borderTop: i ? "1px solid #eef3f5" : "none",
    cursor: onPick ? "pointer" : "default" }}>
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

/* The perspective bar. One model, four questions - keeping them as tabs
   rather than four screens is what stops them drifting into four models. */
function Persp({ now, set, opts }) {
 return (
  <div style={{ display: "inline-flex", gap: 3, background: "#eef3f5",
   borderRadius: 999, padding: 3, marginBottom: 11, flexWrap: "wrap" }}>
   {opts.map(([k, label]) => (
    <span key={k} onClick={() => set(k)} style={{ fontSize: 11.5,
     fontWeight: now === k ? 600 : 400, padding: "5px 14px",
     borderRadius: 999, cursor: "pointer",
     background: now === k ? ACC : "transparent",
     color: now === k ? "#fff" : SUB }}>{label}</span>))}
  </div>);
}

export function Stage2Model({ t, dom, tbl, setDom, setTbl,
 persp, setPersp, erd, setErd }) {
 const P = persp || "domains";
 const setP = setPersp || (() => {});
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
    <NavStyles />
    <div style={card()}>
     <div style={eyebrow}>{s2DomainName(r[0])}{anchor ? " - anchor entity" : ""}</div>
     <div style={{ fontFamily: MONO, fontSize: 17, fontWeight: 500, color: INK,
      margin: "5px 0 2px", overflowWrap: "anywhere" }}>{tbl}</div>
     {anchor && inDoms.length > 0 && (
      <Body><div style={{ marginTop: 5 }}>Referenced from {inDoms.length} domains
       - {inDoms.map((d) => s2DomainName(d)).join(", ")}.</div></Body>)}
     <div style={{ marginTop: 9 }}>
      {(() => {
       const b = buildStatus(tbl), L = BUILD_LABEL[b];
       return (
        <span title={L[1]}>
         <Chip bg={b === "target" ? "#eef1f4" : b === "sample" ? OK : WARN}
          fg={b === "target" ? MUT : "#fff"}>{L[0]}</Chip></span>);
      })()}
     </div>
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
   <OpenCard onClick={() => setTbl(n)} opens="table" style={{ background: "#fff",
    border: `1px solid ${RULE}`, borderLeft: anchor ? `3px solid ${ACC}` : undefined,
    borderRadius: 6, padding: "9px 11px" }}>
    <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500, color: INK,
     overflowWrap: "anywhere" }}>{n}
     {gaps > 0 && <span style={{ display: "inline-block", width: 7, height: 7,
      borderRadius: "50%", marginLeft: 5,
      background: s2Blocked(n) ? BAD : WARN }} />}</div>
    <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUT, marginTop: 3,
     overflowWrap: "anywhere" }}>{sub}</div>
   </OpenCard>);
  const showErd = erd !== false;
  return (
   <div>
    <NavStyles />
    <div style={card()}>
     <b style={{ fontSize: 15, color: INK }}>{s2DomainName(dom)}</b>
     <div style={{ fontSize: 11, color: MUT, marginTop: 4 }}>
      {tabs.length} tables - {own.length} relationships out - {into.length} in
      - anchors shown with a left rule - a dot marks an unresolved model gap</div>
    </div>
    <Persp now={showErd ? "erd" : "list"} set={(k) => setErd && setErd(k === "erd")}
     opts={[["erd", "ERD"], ["list", "Entities and relationships"]]} />
    {!showErd && <ClickHint>Every entity and every row here opens that
     table. The ERD tab is the same tables, drawn as spine and
     leaves.</ClickHint>}
    {showErd && <Stage2Erd t={t} dom={dom} onPick={setTbl} />}
    {showErd ? null : (<>
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
    </>)}
   </div>);
 }

 /* ---- the three top-level perspectives ---- */
 const bar = (<>
  <NavStyles />
  <Persp now={P} set={setP} opts={[["domains", "Domains"],
   ["lineage", "Cross-domain lineage"], ["feeds", "Feeds to Stage 1"]]} /></>);
 if (P === "lineage") return (
  <div>{bar}<Stage2Lineage t={t} onPick={setDom} /></div>);
 if (P === "feeds") return (
  <div>{bar}<Stage2Feeds t={t} onPick={setTbl} /></div>);

 return (
  <div>
   <NavStyles />
   {bar}
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
      <OpenCard key={d.k} onClick={() => setDom(d.k)} opens="ERD and tables"
       style={card({ marginBottom: 0 })}>
       <b style={{ fontSize: 13, color: INK }}>{d.n}</b>
       <div style={{ fontSize: 11, color: MUT, margin: "3px 0 8px" }}>
        {d.c} tables - {own.length} out{into ? ` - ${into} in` : ""}</div>
       <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Chip bg="#eef1f4" fg={MUT}>{own.length - inf} declared</Chip>
        <Chip bg="#fdf2e3" fg="#a8560f">{inf} inferred</Chip>
        {nokey > 0 && <Chip bg={BAD} fg="#fff">
         {nokey} key{nokey > 1 ? "s" : ""} undecided</Chip>}
       </div>
      </OpenCard>);
    })}
   </div>
   <ClickHint>A domain opens its ERD; a box in the ERD opens that table,
    with its key, its edges and anything unresolved on it.</ClickHint>

   <div style={card({ borderLeft: `3px solid ${BAD}`, marginTop: 11 })}>
    <div style={eyebrow}>Built, versus designed</div>
    <Body><div style={{ marginTop: 5 }}>
     <b style={{ color: INK }}>{BUILD_SUMMARY().implemented} of
     {" "}{S2_TABLES.length} canonical models exist in the code</b>, and
     {" "}{BUILD_SUMMARY().expand} of those are mapped to fewer attributes
     than the canonical model defines. The other
     {" "}{S2_TABLES.length - BUILD_SUMMARY().implemented} are targets. Every
     table below is drawn alike, so a model and an intention look identical
     until you open one.</div></Body>
   </div>
   <div style={card({ borderLeft: `3px solid ${WARN}` })}>
    <Body><b style={{ color: INK }}>{S2_INFERRED_COUNT} of {S2_RELS.length}
     {" "}relationships are not declared foreign keys</b>, and {S2_TESTED.size} are
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
   <NavStyles />
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

/* ===================================================================
   Stage 1 - the RAW data model. Its own screen, beside Stage 2's, so
   "what does the data look like here" has the same answer shape at
   both layers.
   =================================================================== */
export function Stage1Model({ t }) {
 const both = s1Both(), only = s1ArchOnly();
 return (
  <div>
   <NavStyles />
   <div style={card()}>
    <div style={eyebrow}>Stage 1 - RAW - bronze</div>
    <b style={{ fontSize: 16, color: INK }}>{S1_SHAPE.n}</b>
    <Body><div style={{ marginTop: 6 }}>{S1_SHAPE.w}</div></Body>
    <div style={{ fontSize: 10.5, color: MUT, marginTop: 9 }}>{S1_SHAPE.ev}</div>
   </div>

   <div style={card({ borderLeft: `3px solid ${ACC}` })}>
    <div style={eyebrow}>There is no canonical model here, and that is the design</div>
    <Body><div style={{ marginTop: 5 }}>Stage 1 holds what arrived, in the
     shape it arrived in. No entities, no relationships, no keys. The first
     normalised model is Stage 2 INT.</div></Body>
   </div>

   <Head title="The five rules" note="what Stage 1 does, and refuses to do" />
   <div style={card()}>
    {S1_RULES.map((r, i) => (
     <div key={r[0]} style={{ display: "flex", gap: 14, padding: "8px 0",
      borderTop: i ? "1px solid #eef3f5" : "none" }}>
      <span style={{ fontSize: 12.5, fontWeight: 500, color: INK,
       flex: "0 0 180px" }}>{r[0]}</span>
      <span style={{ fontSize: 12.5, color: SUB, lineHeight: 1.6 }}>{r[1]}</span>
     </div>))}
   </div>

   <Head title="The only columns Stage 1 adds"
    note="everything else in the row is as the file delivered it" />
   <div style={card()}>
    {S1_COLS.map((c, i) => (
     <div key={c[0]} style={{ display: "flex", gap: 14, padding: "7px 0",
      borderTop: i ? "1px solid #eef3f5" : "none" }}>
      <span style={{ fontFamily: MONO, fontSize: 11.5, color: INK,
       flex: "0 0 170px" }}>{c[0]}</span>
      <span style={{ fontSize: 11, color: MUT, flex: "0 0 85px" }}>{c[1]}</span>
      <span style={{ fontSize: 12.5, color: SUB, lineHeight: 1.6 }}>{c[2]}</span>
     </div>))}
   </div>

   <Head title={`The RAW tables - ${S1_TABLES.length} named, ${both} agreed`}
    note="the two sources do not name the same set" />
   <div style={{ display: "grid", gap: 8,
    gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))",
    alignItems: "start" }}>
    {S1_TABLES.map((x) => (
     <div key={x.n} style={{ background: "#fff", border: `1px solid ${RULE}`,
      borderLeft: `3px solid ${x.doc ? OK : WARN}`, borderRadius: 6,
      padding: "10px 12px" }}>
      <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500,
       color: INK, overflowWrap: "anywhere" }}>{x.n}</div>
      <div style={{ marginTop: 7 }}>
       {x.doc ? <Chip bg={OK} fg="#fff">both sources</Chip>
              : <Chip bg={WARN} fg="#fff">architecture only</Chip>}
      </div>
     </div>))}
   </div>

   <div style={card({ borderLeft: `3px solid ${BAD}`, marginTop: 11 })}>
    <div style={eyebrow}>Conflict {S1_CONFLICT.id} - {S1_CONFLICT.t}</div>
    <Body><div style={{ marginTop: 5 }}>{S1_CONFLICT.w}</div>
     <div style={{ marginTop: 8, color: INK }}>{S1_CONFLICT.why}</div></Body>
    <div style={{ fontSize: 12, color: SUB, marginTop: 9 }}>
     <b>{both}</b> of {S1_TABLES.length} tables are named by both sources.
     Those {both} are the only set safe to build against today;
     the other {only} need SEI to say which document holds.</div>
   </div>

   <Head title="What Stage 1 does not answer"
    note="so nobody goes looking for it here" />
   <div style={card()}>
    <ul style={{ fontSize: 12.5, color: SUB, lineHeight: 1.7, margin: 0,
     paddingLeft: 17 }}>
     {S1_NOT_HERE.map((x) => <li key={x}>{x}</li>)}</ul>
   </div>
  </div>);
}

/* ===================================================================
   The database, in the flow. Two bands: the data path rows actually
   live in, and the control plane that decides whether they move.
   =================================================================== */
const DBX = { raw: 120, stg: 300, int: 480, gold: 660, pre: 840, wh: 1020 };
const DBC = { cfg: 100, reg: 285, dq: 470, date: 655, recon: 840 };
const PATH_Y = 80, PATH_H = 76, CTL_Y = 330, CTL_H = 84;

export function DbModelView({ t, pick, setPick, onOpen }) {
 const sel = pick ? dbNode(pick) : null;
 const node = (x, y, w, h, n, sub, o) => {
  const opt = o || {};
  return (
   <g key={n} onClick={opt.onClick} className={opt.onClick ? "cp-hit" : undefined}
    tabIndex={opt.onClick ? 0 : undefined} role={opt.onClick ? "button" : undefined}
    style={opt.onClick ? undefined : { cursor: "default" }}>
    <rect className="cp-bx" x={x - w / 2} y={y} width={w} height={h} rx={6}
     fill={opt.fill || "#fff"} stroke={opt.stroke || RULE}
     strokeWidth={opt.sel ? 2.4 : 1.4}
     strokeDasharray={opt.dash ? "5 4" : undefined} />
    {opt.onClick && <SvgGo x={x + w / 2 - 8} y={y + 15}
     c={opt.stroke === BAD ? BAD : ACC} />}
    <text x={x} y={y + 24} textAnchor="middle" fontSize={opt.fs || 12.5}
     fontWeight="500" fill={INK}>{n}</text>
    {sub && <text x={x} y={y + 40} textAnchor="middle" fontSize="10"
     fill={MUT}>{sub}</text>}
    {opt.foot && <text x={x} y={y + h - 10} textAnchor="middle" fontSize="9.5"
     fill={opt.footC || MUT}>{opt.foot}</text>}
   </g>);
 };
 return (
  <div>
   <NavStyles />
   <div style={card()}>
    <svg viewBox="0 0 1200 560" style={{ width: "100%", height: "auto" }}
     role="img" aria-label="The database: the data path and the control plane">
     <defs><marker id="dbarr" viewBox="0 0 10 10" refX="9" refY="5"
      markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill={SUB} /></marker>
      <marker id="dbgov" viewBox="0 0 10 10" refX="9" refY="5"
       markerWidth="6" markerHeight="6" orient="auto-start-reverse">
       <path d="M 0 0 L 10 5 L 0 10 z" fill={MUT} /></marker></defs>

     <text x="40" y="52" fontSize="10" fontWeight="700" fill={ACC}>
      THE DATA PATH - where rows live</text>
     <rect x="24" y="62" width="1152" height="112" rx="9" fill="#f4f7f9"
      stroke="#e4eaef" />
     {DB_PATH.map((p) => node(DBX[p.id], PATH_Y, 150, PATH_H, p.n, p.layer, {
       stroke: p.kind === "view" ? MUT : ACC,
       dash: p.kind === "view",
       sel: pick === p.id,
       foot: p.kind === "view" ? "a view" : (p.open ? "model" : null),
       footC: p.open ? ACC : MUT,
       onClick: () => setPick(pick === p.id ? null : p.id) }))}
     {DB_LINKS.filter((l) => l.kind === "flow").map((l) => (
      <line key={l.from + l.to} x1={DBX[l.from] + 76} y1={PATH_Y + PATH_H / 2}
       x2={DBX[l.to] - 78} y2={PATH_Y + PATH_H / 2} stroke={SUB}
       strokeWidth="1.6" markerEnd="url(#dbarr)" />))}

     <text x="40" y="302" fontSize="10" fontWeight="700" fill={MUT}>
      THE CONTROL PLANE - what decides whether they move</text>
     <rect x="24" y="314" width="1152" height="116" rx="9" fill="#f4f7f9"
      stroke="#e4eaef" />
     {DB_CONTROL.map((c) => node(DBC[c.id], CTL_Y, 170, CTL_H, c.n, c.role, {
       fs: 11.5,
       stroke: pick === c.id ? ACC : "#b9c6d1",
       sel: pick === c.id,
       onClick: () => setPick(pick === c.id ? null : c.id) }))}
     <line x1={DBC.cfg + 86} y1={CTL_Y + CTL_H / 2} x2={DBC.reg - 88}
      y2={CTL_Y + CTL_H / 2} stroke={MUT} strokeWidth="1.4"
      strokeDasharray="5 4" markerEnd="url(#dbgov)" />

     {/* governance and write links, drawn short so none of them cross */}
     {[["reg", "raw"], ["dq", "stg"], ["date", "int"], ["recon", "int"]]
      .map(([c, p]) => (
       <line key={c + p} x1={DBC[c]} y1={CTL_Y - 2} x2={DBX[p]}
        y2={PATH_Y + PATH_H + 2} stroke={MUT} strokeWidth="1.3"
        strokeDasharray="4 4" />))}

     <text x="40" y="470" fontSize="10" fontWeight="700" fill={BAD}>
      NOT BUILT - the other two routes have no bookkeeping at all</text>
     {DB_ABSENT.map((a, i) => node(180 + i * 330, 482, 300, 56, a.n, a.route, {
       stroke: BAD, dash: true, fill: "#fdf7f8",
       sel: pick === a.id,
       onClick: () => setPick(pick === a.id ? null : a.id) }))}
     <text x="700" y="516" fontSize="10.5" fill={SUB}>
      Every table above has exactly one writer. Neither of these exists.</text>
    </svg>
    <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginTop: 4 }}>
     {DB_LINKS.filter((l) => l.kind !== "flow").map((l) => (
      <span key={l.from + l.to} style={{ fontSize: 11, color: SUB,
       border: `1px solid ${RULE}`, borderRadius: 999, padding: "3px 11px" }}>
       <span style={{ fontFamily: MONO, fontSize: 10.5, color: INK }}>
        {(dbNode(l.from) || {}).n}</span>
       <span style={{ color: MUT }}> {l.kind === "governs" ? "governs" : "writes"} </span>
       <span style={{ fontFamily: MONO, fontSize: 10.5, color: INK }}>
        {(dbNode(l.to) || {}).n}</span>
       <span style={{ color: MUT }}> &mdash; {l.w}</span>
      </span>))}
    </div>
    <div style={{ fontSize: 11.5, color: SUB, lineHeight: 1.6, marginTop: 9,
     maxWidth: "92ch" }}>
     <b>The data path is what a business reader follows; the control plane is
     what an operator follows at 3am.</b>
    </div>
    <ClickHint>Every box opens, including the two dashed ones that do not
     exist yet. RAW and INT go on to their own data models.</ClickHint>
   </div>

   {sel ? (
    <div style={card({ borderLeft: `3px solid ${sel.route ? BAD : ACC}` })}>
     <div style={eyebrow}>
      {sel.route ? `Not built - ${sel.route}`
                 : (sel.layer || sel.role || "control table")}</div>
     <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 500, color: INK,
      margin: "4px 0 6px", overflowWrap: "anywhere" }}>{sel.n}</div>
     <Body>{sel.w}</Body>
     {!sel.route && (
      <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginTop: 11,
       fontSize: 12, color: SUB }}>
       <span><b style={{ ...eyebrow, display: "block" }}>Written by</b>
        {sel.writes}</span>
       <span><b style={{ ...eyebrow, display: "block" }}>Read by</b>
        {sel.reads}</span>
      </div>)}
     {sel.open && onOpen && (
      <div onClick={() => onOpen(sel.open)} style={{ fontSize: 11.5,
       fontWeight: 700, color: ACC, cursor: "pointer", marginTop: 11 }}>
       {sel.open === "s1" ? "the Stage 1 data model"
                          : "the Stage 2 canonical model, 52 tables"} -&gt;</div>)}
    </div>
   ) : (
    <div style={card()}>
     <div style={eyebrow}>One writer each</div>
     <Body>{DB_NOTE}</Body>
    </div>)}
  </div>);
}

/* ===================================================================
   Stage 2, seen three more ways.

   ONE MODEL, FOUR QUESTIONS. The domain map answers "what is in here".
   The ERD answers "how does this domain hang together". The lineage view
   answers "what does this domain depend on that it does not own". The
   feed view answers "where did any of it come from". They are
   perspectives on the same 52 tables, not four models.
   =================================================================== */

/* ---- ERD: hub and spoke, because that is the shape these domains are --
   Every one of these domains is one or two heavily-referenced entities
   with a ring of children. Laid out as a generic graph it is spaghetti;
   laid out as spine and leaves it reads in one pass. */
export function Stage2Erd({ t, dom, onPick }) {
 const tabs = s2TablesIn(dom).map((r) => r[1]);
 const own = s2RelsOwned(dom);
 const ext = [...new Set(own.map((r) => r.parent)
  .filter((n) => s2Table(n) && s2DomainOf(n) !== dom))];
 const all = tabs.concat(ext);
 const inDeg = {};
 all.forEach((n) => { inDeg[n] = own.filter((r) => r.parent === n).length; });
 const spine = all.filter((n) => inDeg[n] >= 2 || ext.indexOf(n) >= 0)
  .sort((a, b) => inDeg[b] - inDeg[a]);
 const leaves = all.filter((n) => spine.indexOf(n) < 0);
 // One column of leaves unless a domain ever grows past twelve. Two
 // columns looked tidier and was worse: every spine-to-column-two line
 // crossed a column-one box, and a line that crosses a box reads as
 // touching it. No domain here has more than eleven tables.
 const cols = leaves.length > 12 ? 2 : 1;
 const colOf = (i) => (cols === 1 ? 0 : i % 2);
 const rowOf = (i) => (cols === 1 ? i : Math.floor(i / 2));
 const BW = 258, BH = 38, GAP = 11;
 const LX = 40, RX = [430, 430 + BW + 56];
 const rows = cols === 1 ? leaves.length : Math.ceil(leaves.length / 2);
 const H = Math.max(spine.length, rows) * (BH + GAP) + 70;
 const pos = {};
 spine.forEach((n, i) => { pos[n] = [LX, 44 + i * (BH + GAP)]; });
 leaves.forEach((n, i) => { pos[n] = [RX[colOf(i)], 44 + rowOf(i) * (BH + GAP)]; });
 const W = RX[cols - 1] + BW + 62;

 const Box = ({ n }) => {
  const p = pos[n];
  const outside = ext.indexOf(n) >= 0;
  const anchor = s2IsAnchor(n);
  const r = s2Table(n);
  return (
   <g className="cp-hit" onClick={() => onPick && onPick(n)} tabIndex={0}
    role="button">
    <rect className="cp-bx" x={p[0]} y={p[1]} width={BW} height={BH} rx={5}
     fill={outside ? "#f4f7f9" : "#fff"}
     stroke={anchor ? ACC : RULE} strokeWidth={anchor ? 2 : 1.3}
     strokeDasharray={outside ? "5 4" : undefined} />
    <text x={p[0] + 10} y={p[1] + 16} fontSize="10.5" fontFamily={MONO}
     fontWeight="500" fill={INK}>{n.length > 27 ? n.slice(0, 26) + "." : n}</text>
    <text x={p[0] + 10} y={p[1] + 29} fontSize="8.5" fill={MUT}>
     {outside ? s2DomainName(s2DomainOf(n)) : (r && r[2] ? r[2].split(", ")[0] : "no key")}
     {s2Blocked(n) ? "  * key undecided" : ""}</text>
    <SvgGo x={p[0] + BW - 7} y={p[1] + 24} />
   </g>);
 };
 return (
  <div style={card()}>
   <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}
    role="img" aria-label={`Entity relationships inside ${s2DomainName(dom)}`}>
    {own.map((e, i) => {
     const a = pos[e.parent], b = pos[e.child];
     if (!a || !b) return null;
     const col = e.kind === "fk" ? OK : WARN;
     const dash = e.kind === "fk" ? undefined : "4 4";
     const ya = a[1] + BH / 2, yb = b[1] + BH / 2;
     // Two leaves pointing at each other sit in the same column, and a
     // straight line between them runs through every box in between.
     // Bulge it out to the right instead.
     if (a[0] === b[0]) {
      const x = a[0] + BW;
      return (
       <path key={i} d={`M ${x} ${ya} C ${x + 42} ${ya} ${x + 42} ${yb} ${x} ${yb}`}
        fill="none" stroke={col} strokeWidth="1.2" strokeDasharray={dash}
        opacity="0.75" />);
     }
     const aRight = a[0] < b[0];
     return (
      <line key={i} x1={aRight ? a[0] + BW : a[0]} y1={ya}
       x2={aRight ? b[0] : b[0] + BW} y2={yb}
       stroke={col} strokeWidth="1.2" strokeDasharray={dash} opacity="0.75" />);
    })}
    {all.map((n) => <Box key={n} n={n} />)}
   </svg>
   <div style={{ display: "flex", gap: 15, flexWrap: "wrap", marginTop: 9,
    fontSize: 11, color: SUB }}>
    <span><span style={{ display: "inline-block", width: 16, height: 2,
     background: OK, verticalAlign: "middle" }} /> declared FK</span>
    <span><span style={{ display: "inline-block", width: 16, height: 2,
     background: WARN, verticalAlign: "middle" }} /> inferred</span>
    <span style={{ color: MUT }}>dashed box = an entity this domain
     references but does not own &middot; thick border = anchor</span>
   </div>
   <ClickHint>Every box opens that table, the dashed ones included &mdash;
    those land you in the domain that owns it.</ClickHint>
  </div>);
}

/* ---- Lineage: what each domain owes the others ---------------------- */
export function Stage2Lineage({ t, onPick }) {
 const LANE = 44, LX = 236, W = 1180;
 const order = S2_DOMAINS.map((d) => d.k);
 const yOf = (k) => 30 + order.indexOf(k) * LANE;
 const cross = S2_RELS.filter((r) => {
  const a = s2DomainOf(r.child), b = s2DomainOf(r.parent);
  return a && b && a !== b;
 });
 const pairs = {};
 cross.forEach((r) => {
  const key = s2DomainOf(r.child) + ">" + s2DomainOf(r.parent);
  (pairs[key] = pairs[key] || []).push(r);
 });
 const H = order.length * LANE + 46;
 return (
  <div style={card()}>
   <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}
    role="img" aria-label="Cross-domain dependencies between the ten domains">
    <defs><marker id="lnarr" viewBox="0 0 10 10" refX="9" refY="5"
     markerWidth="5" markerHeight="5" orient="auto-start-reverse">
     <path d="M 0 0 L 10 5 L 0 10 z" fill={MUT} /></marker></defs>
    {S2_DOMAINS.map((d, i) => {
     const owns = s2RelsOwned(d.k);
     const out = Object.keys(pairs).filter((k) => k.split(">")[0] === d.k).length;
     return (
      <g key={d.k} className="cp-hit" onClick={() => onPick && onPick(d.k)}
       tabIndex={0} role="button">
       <rect className="cp-bx" x="0" y={yOf(d.k) - 15} width={W}
        height={LANE - 6} rx="5" fill={i % 2 ? "#f4f7f9" : "#fff"}
        stroke="#eef3f5" />
       <SvgGo x={W - 12} y={yOf(d.k) + 7} />
       <text x="12" y={yOf(d.k) + 2} fontSize="11.5" fontWeight="500"
        fill={INK}>{d.n}</text>
       <text x="12" y={yOf(d.k) + 15} fontSize="9.5" fill={MUT}>
        {d.c} tables &middot; {owns.length} out &middot; depends on {out} other
        {out === 1 ? " domain" : " domains"}</text>
      </g>);
    })}
    {/* Each arc leaves the owner's lane and lands in the lane it depends
        on. Staggered by index so two arcs between the same pair of lanes
        do not sit on top of each other. */}
    {Object.entries(pairs).map(([key, rs], i) => {
     const [from, to] = key.split(">");
     const y1 = yOf(from) + 2, y2 = yOf(to) + 2;
     const x = LX + 26 + (i % 14) * 62;
     const d = `M ${x} ${y1} C ${x + 34} ${y1} ${x + 34} ${y2} ${x} ${y2}`;
     return (
      <g key={key}>
       {/* Weight by how many columns cross, so the nine-column dependency
           does not look like the one-column one. */}
       <path d={d} fill="none" stroke={rs.length >= 4 ? ACC : MUT}
        strokeWidth={Math.min(3.4, 1 + rs.length * 0.28)}
        opacity={rs.length >= 4 ? 0.9 : 0.75} markerEnd="url(#lnarr)" />
       <text x={x + 38} y={(y1 + y2) / 2 + 3} fontSize={rs.length >= 4 ? 11 : 9}
        fontWeight={rs.length >= 4 ? 700 : 400}
        fill={rs.length >= 4 ? ACC : MUT}>{rs.length}</text>
      </g>);
    })}
   </svg>
   <div style={{ fontSize: 11.5, color: SUB, lineHeight: 1.6, marginTop: 9,
    maxWidth: "92ch" }}>
    <b>{cross.length} of {S2_RELS.length} relationships cross a domain
    boundary.</b> Each arc runs from the domain that owns the column to the
    domain it points at, and the number on it is how many columns. A domain
    with many arcs out cannot be built, tested or loaded on its own.
   </div>
   <ClickHint>Every lane opens that domain&apos;s ERD.</ClickHint>
  </div>);
}

/* ---- Feeds: the chain from a file to a canonical table --------------- */
export function Stage2Feeds({ t, onPick }) {
 const S = FEED_SUMMARY;
 const confChip = (c) => c === "named" ? <Chip bg={OK} fg="#fff">named</Chip>
  : c === "likely" ? <Chip bg="#eef1f4" fg={MUT}>inferred</Chip>
  : <Chip bg={BAD} fg="#fff">no RAW table</Chip>;
 const FeedRow = ({ f }) => (
  <div style={{ display: "flex", gap: 12, padding: "8px 0",
   borderTop: "1px solid #eef3f5", alignItems: "baseline", flexWrap: "wrap" }}>
   <span style={{ fontSize: 12.5, color: INK, flex: "0 0 200px" }}>{f.feed}</span>
   <span style={{ flex: "0 0 90px" }}>{confChip(f.conf)}</span>
   <span style={{ display: "flex", gap: 5, flexWrap: "wrap", flex: "1 1 50%" }}>
    {f.tables.map((n) => (
     <span key={n} className="cp-row" onClick={() => onPick && onPick(n)}
      style={{ fontFamily: MONO, fontSize: 10, border: `1px solid ${RULE}`,
       borderRadius: 3, padding: "1px 6px", cursor: "pointer", color: INK }}>
      {n}</span>))}
   </span>
  </div>);
 return (
  <div>
   <NavStyles />
   <div style={card()}>
    <div style={eyebrow}>SWP feed &rarr; Stage 1 RAW &rarr; Stage 2 canonical</div>
    <b style={{ fontSize: 16, color: INK }}>
     {S.feeds} feeds, {S.mapped} with a Stage 1 table named</b>
    <Body><div style={{ marginTop: 6 }}>Neither document publishes this map.
     The only real one is FILE_SCHEMA_CONFIG.TARGET_RAW_TABLE, which is
     configuration rather than a list, so the chain from a file to a
     canonical table exists nowhere on paper. What follows is matched by
     name and labelled with how confident that match is.</div></Body>
    <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginTop: 13 }}>
     {[[S.feeds, "feeds", INK], [S.named, "RAW table named", OK],
       [S.likely, "inferred", MUT], [S.none, "no RAW table", BAD]]
      .map(([n, l, c]) => (
       <span key={l} style={{ textAlign: "center" }}>
        <b style={{ fontSize: 23, color: c, display: "block" }}>{n}</b>
        <span style={{ fontSize: 10, color: MUT }}>{l}</span></span>))}
    </div>
   </div>

   <div style={card({ borderLeft: `3px solid ${BAD}` })}>
    <div style={eyebrow}>The finding</div>
    <Body><div style={{ marginTop: 5 }}>
     <b style={{ color: INK }}>{S.none} of {S.feeds} feeds have no Stage 1
     landing table named by either document</b> &mdash; and two of them,
     {" "}{S.anchorsUnmapped.join(" and ")}, are anchors of the Stage 2
     model. If ASSET has no RAW table, the whole Asset and Security Master
     domain has no described inbound path, and nothing downstream notices,
     because nothing downstream asks for a table that was never modelled.
    </div></Body>
   </div>

   <Head title="One feed is not one table"
    note="the fan-out nobody expects when they size this work" />
   <div style={card()}>
    {FAN_OUT.map((f, i) => (
     <div key={f.feed} style={{ display: "flex", gap: 14, padding: "8px 0",
      borderTop: i ? "1px solid #eef3f5" : "none", alignItems: "baseline" }}>
      <span style={{ fontSize: 12.5, color: INK, flex: "0 0 190px" }}>
       {f.feed}</span>
      <b style={{ fontSize: 15, color: ACC, flex: "0 0 36px" }}>
       {f.tables.length}</b>
      <span style={{ fontSize: 12, color: SUB }}>canonical tables, in
       {" "}{f.domains.map((d) => s2DomainName(d)).join(" and ")}</span>
     </div>))}
   </div>

   {RAW_TABLES.map((raw) => (
    <div key={raw} style={card()}>
     <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
      <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 500,
       color: INK }}>{raw}</span>
      <span style={{ fontSize: 11, color: MUT }}>
       {feedsForRaw(raw).length} feeds land here</span>
     </div>
     {feedsForRaw(raw).map((f) => <FeedRow key={f.feed} f={f} />)}
    </div>))}

   <div style={card({ borderLeft: `3px solid ${BAD}` })}>
    <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
     <b style={{ fontSize: 13, color: BAD }}>No RAW table named</b>
     <span style={{ fontSize: 11, color: MUT }}>
      {feedsUnmapped().length} feeds</span>
    </div>
    {feedsUnmapped().map((f) => <FeedRow key={f.feed} f={f} />)}
   </div>

   <div style={card()}>
    <div style={eyebrow}>And two RAW tables with no feed</div>
    <Body><div style={{ marginTop: 5 }}>
     {RAW_WITHOUT_FEED.join(" and ")} are named by the architecture but have
     no source sheet in the canonical model. Corrections arrive as a
     re-delivery rather than as a feed of their own &mdash; or they do not,
     and which reading is right is conflict C4.</div></Body>
   </div>
  </div>);
}

/* ===================================================================
   The gap supplements, and what they do to what we already drew.

   TWO DOCUMENTS ARRIVED OVER THE TOP OF THE BASELINE: a consolidated
   architecture gap supplement and a production-readiness review of the
   CP-Integration-Gateway. Holding them beside the baseline is worth
   nothing unless somebody compares them, so the reconciliation is the
   default view and the source documents are behind it.
   =================================================================== */
const SEV = { block: BAD, open: WARN };

function Find({ r }) {
 const v = RC_VERDICT[r.v];
 return (
  <div style={card({ borderLeft: `3px solid ${v.c}` })}>
   <div style={{ display: "flex", gap: 9, alignItems: "baseline",
    flexWrap: "wrap" }}>
    <Chip bg={v.c} fg="#fff">{v.n}</Chip>
    <span style={{ fontFamily: MONO, fontSize: 10.5, color: MUT }}>{r.id}</span>
    <b style={{ fontSize: 13.5, color: INK }}>{r.t}</b>
   </div>
   <div style={{ display: "grid", gap: 10, marginTop: 10,
    gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
    <div><div style={eyebrow}>The supplement says</div>
     <Body><div style={{ marginTop: 4 }}>{r.sup}</div></Body></div>
    <div><div style={eyebrow}>The Hub holds</div>
     <Body><div style={{ marginTop: 4 }}>{r.hub}</div></Body></div>
   </div>
   {r.cost && (
    <div style={{ marginTop: 10, paddingTop: 9,
     borderTop: "1px solid #eef3f5" }}>
     <div style={eyebrow}>What it costs to leave open</div>
     <Body><div style={{ marginTop: 4, color: INK }}>{r.cost}</div></Body></div>)}
   <div style={{ fontSize: 10.5, color: MUT, marginTop: 9 }}>
    {r.dec && r.dec !== "none" ? `Decision: ${r.dec}` : "No decision needed"}
    {r.where ? ` · lands on ${r.where}` : ""}</div>
  </div>);
}

export function GapSupplementView({ t, tab, setTab, filter, setFilter }) {
 const T = tab || "reconcile";
 const F = filter || "all";
 const bar = (<>
  <NavStyles />
  <Persp now={T} set={setTab} opts={[["reconcile", "What it changes"],
   ["register", "Gap register"], ["decisions", "Decisions and risks"],
   ["accept", "Acceptance criteria"], ["gateway", "The gateway review"],
   ["source", "Source and terminology"]]} /></>);

 if (T === "register") return (
  <div>{bar}
   <div style={card()}>
    <b style={{ fontSize: 15, color: INK }}>
     {GAP_REGISTER.length} architecture gaps, {GW_GAPS.length} gateway gaps</b>
    <Body><div style={{ marginTop: 5 }}>Each with the disposition the
     supplement requires. Four of the gateway gaps block production
     approval.</div></Body>
   </div>
   <Head title="Architecture" note="the consolidated supplement" />
   <div style={card()}>
    {GAP_REGISTER.map((g, i) => (
     <div key={g.id} style={{ display: "flex", gap: 13, padding: "9px 0",
      borderTop: i ? "1px solid #eef3f5" : "none", flexWrap: "wrap" }}>
      <span style={{ fontFamily: MONO, fontSize: 11, color: ACC,
       flex: "0 0 68px" }}>{g.id}</span>
      <span style={{ flex: "1 1 340px", minWidth: 0 }}>
       <div style={{ fontSize: 12.5, color: INK, lineHeight: 1.55 }}>{g.g}</div>
       <div style={{ fontSize: 12, color: SUB, lineHeight: 1.55,
        marginTop: 3 }}>{g.d}</div></span>
      <span style={{ fontSize: 10.5, color: MUT, flex: "0 0 180px" }}>
       {g.dom}</span>
     </div>))}
   </div>
   <Head title="Gateway" note={`${GW_BLOCKING} of ${GW_GAPS.length} block production approval`} />
   <div style={card()}>
    {GW_GAPS.map((g, i) => (
     <div key={g.id} style={{ display: "flex", gap: 13, padding: "9px 0",
      borderTop: i ? "1px solid #eef3f5" : "none", flexWrap: "wrap" }}>
      <span style={{ fontFamily: MONO, fontSize: 11, color: SEV[g.sev],
       flex: "0 0 86px" }}>{g.id}</span>
      <span style={{ flex: "1 1 340px", minWidth: 0 }}>
       <div style={{ fontSize: 12.5, color: INK, lineHeight: 1.55 }}>{g.g}</div>
       <div style={{ fontSize: 12, color: SUB, lineHeight: 1.55,
        marginTop: 3 }}>{g.d}</div></span>
      <span style={{ flex: "0 0 80px" }}>
       {g.sev === "block" ? <Chip bg={BAD} fg="#fff">blocks</Chip>
                          : <Chip bg="#eef1f4" fg={MUT}>open</Chip>}</span>
     </div>))}
   </div>
  </div>);

 if (T === "decisions") return (
  <div>{bar}
   <div style={card()}>
    <b style={{ fontSize: 15, color: INK }}>
     {GAP_DECISIONS.length} decisions must close before build completion</b>
    <Body><div style={{ marginTop: 5 }}>Ten architecture, eight Stage 2.
     None is a preference: each one changes what gets built.</div></Body>
   </div>
   {[["arch", "Architecture"], ["silver", "Stage 2 Silver"]].map(([k, n]) => (
    <div key={k}>
     <Head title={n} note={`${GAP_DECISIONS.filter((d) => d[2] === k).length} decisions`} />
     <div style={card()}>
      {GAP_DECISIONS.filter((d) => d[2] === k).map((d, i) => (
       <div key={d[0]} style={{ display: "flex", gap: 13, padding: "8px 0",
        borderTop: i ? "1px solid #eef3f5" : "none" }}>
        <span style={{ fontFamily: MONO, fontSize: 11, color: ACC,
         flex: "0 0 120px" }}>{d[0]}</span>
        <span style={{ fontSize: 12.5, color: SUB, lineHeight: 1.6 }}>
         {d[1]}</span>
       </div>))}
     </div>
    </div>))}
   <Head title="Gateway risks" note="with the evidence each needs before closure" />
   <div style={card()}>
    {GW_RISKS.map((r, i) => (
     <div key={r[0]} style={{ display: "flex", gap: 13, padding: "9px 0",
      borderTop: i ? "1px solid #eef3f5" : "none", flexWrap: "wrap" }}>
      <span style={{ fontFamily: MONO, fontSize: 11, color: BAD,
       flex: "0 0 96px" }}>{r[0]}</span>
      <span style={{ fontSize: 12.5, color: INK, flex: "1 1 300px" }}>{r[1]}</span>
      <span style={{ fontSize: 12, color: SUB, flex: "1 1 280px" }}>{r[2]}</span>
     </div>))}
   </div>
   <div style={card({ borderLeft: `3px solid ${BAD}` })}>
    <div style={eyebrow}>HA and DR establish no numbers at all</div>
    <Body><div style={{ marginTop: 5 }}>Seven items to finalise, and the
     supplement states plainly that no numerical RTO or RPO is established
     and that values require formal BBH approval.</div></Body>
    <ul style={{ fontSize: 12.5, color: SUB, lineHeight: 1.65,
     margin: "9px 0 0", paddingLeft: 17 }}>
     {GAP_HADR_OPEN.map((x) => <li key={x}>{x}</li>)}</ul>
   </div>
  </div>);

 if (T === "accept") return (
  <div>{bar}
   <div style={card()}>
    <b style={{ fontSize: 15, color: INK }}>
     {GAP_ACCEPTANCE.length + GW_APPROVAL.length} criteria</b>
    <Body><div style={{ marginTop: 5 }}>The design is complete when these
     hold. They are measurable, which is what makes them worth holding as
     data rather than prose.</div></Body>
   </div>
   {[["arch", "Architecture"], ["silver", "Stage 2 Silver"]].map(([k, n]) => (
    <div key={k}>
     <Head title={n} note={`${GAP_ACCEPTANCE.filter((a) => a[0] === k).length} criteria`} />
     <div style={card()}>
      {GAP_ACCEPTANCE.filter((a) => a[0] === k).map((a, i) => (
       <div key={a[1]} style={{ display: "flex", gap: 11, padding: "7px 0",
        borderTop: i ? "1px solid #eef3f5" : "none" }}>
        <span style={{ fontSize: 11, color: MUT, flex: "0 0 22px" }}>
         {i + 1}</span>
        <span style={{ fontSize: 12.5, color: SUB, lineHeight: 1.6 }}>
         {a[1]}</span>
       </div>))}
     </div>
    </div>))}
   <Head title="Gateway production approval"
    note="all twelve are required, not a scorecard" />
   <div style={card()}>
    {GW_APPROVAL.map((a, i) => (
     <div key={a} style={{ display: "flex", gap: 11, padding: "7px 0",
      borderTop: i ? "1px solid #eef3f5" : "none" }}>
      <span style={{ fontSize: 11, color: MUT, flex: "0 0 22px" }}>{i + 1}</span>
      <span style={{ fontSize: 12.5, color: SUB, lineHeight: 1.6 }}>{a}</span>
     </div>))}
   </div>
  </div>);

 if (T === "gateway") return (
  <div>{bar}
   <div style={card({ borderLeft: `3px solid ${WARN}` })}>
    <div style={eyebrow}>{GW_DOC.n}</div>
    <Body><div style={{ marginTop: 5 }}>{GW_DOC.w}</div>
     <div style={{ marginTop: 9, color: INK }}>{GW_DOC.verdict}</div></Body>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 11 }}>
     {GW_DOC.stack.map((x) => (
      <span key={x} style={{ fontSize: 10.5, border: `1px solid ${RULE}`,
       borderRadius: 999, padding: "2px 9px", color: SUB }}>{x}</span>))}
    </div>
   </div>
   <div style={{ display: "grid", gap: 9,
    gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))" }}>
    <div style={card({ marginBottom: 0, borderLeft: `3px solid ${OK}` })}>
     <div style={eyebrow}>What is already right</div>
     <ul style={{ fontSize: 12.5, color: SUB, lineHeight: 1.65,
      margin: "7px 0 0", paddingLeft: 17 }}>
      {GW_STRENGTHS.map((x) => <li key={x}>{x}</li>)}</ul>
    </div>
    <div style={card({ marginBottom: 0, borderLeft: `3px solid ${BAD}` })}>
     <div style={eyebrow}>Immediate actions</div>
     <ul style={{ fontSize: 12.5, color: SUB, lineHeight: 1.65,
      margin: "7px 0 0", paddingLeft: 17 }}>
      {GW_PLAN.immediate.map((x) => <li key={x}>{x}</li>)}</ul>
    </div>
   </div>
   <Head title="A governed operation" note="declared before any outbound call is built" />
   <div style={card()}>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
     {GW_OPERATION.map((f) => (
      <span key={f} style={{ fontFamily: MONO, fontSize: 10.5,
       border: `1px solid ${RULE}`, borderRadius: 3, padding: "2px 7px",
       color: INK }}>{f}</span>))}
    </div>
    <div style={{ marginTop: 11, padding: "9px 13px", background: "#fdf7f0",
     borderLeft: `3px solid ${WARN}`, borderRadius: "0 5px 5px 0" }}>
     <Body><b style={{ color: INK }}>There is no quota or rate-limit field
      on this list</b> &mdash; and the boundary screen names gateway rate
      limiting as the thing that actually enforces the key-set collapser's
      restraint. The mitigation we describe has no implementation
      named.</Body>
    </div>
   </div>
   <Head title="Header policy" note="accepted, generated, suppressed, returned" />
   <div style={card()}>
    {GW_HEADERS.map((h, i) => (
     <div key={h[0]} style={{ display: "flex", gap: 14, padding: "8px 0",
      borderTop: i ? "1px solid #eef3f5" : "none" }}>
      <span style={{ fontSize: 12.5, fontWeight: 500, color: INK,
       flex: "0 0 190px" }}>{h[0]}</span>
      <span style={{ fontSize: 12.5, color: SUB, lineHeight: 1.6 }}>
       {h[1]}</span>
     </div>))}
   </div>
   <Head title="The vendor token cache"
    note="in memory, per pod - so refresh count scales with replicas" />
   <div style={card()}>
    {GW_TOKEN_STATES.map((x, i) => (
     <div key={x[0]} style={{ display: "flex", gap: 14, padding: "8px 0",
      borderTop: i ? "1px solid #eef3f5" : "none" }}>
      <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 700,
       color: INK, flex: "0 0 120px" }}>{x[0]}</span>
      <span style={{ fontSize: 12.5, color: SUB, flex: "1 1 40%" }}>{x[1]}</span>
      <span style={{ fontSize: 12, color: MUT, flex: "1 1 40%" }}>{x[2]}</span>
     </div>))}
    <div style={{ ...eyebrow, marginTop: 12 }}>Required tests</div>
    <ul style={{ fontSize: 12.5, color: SUB, lineHeight: 1.65,
     margin: "7px 0 0", paddingLeft: 17 }}>
     {GW_TOKEN_TESTS.map((x) => <li key={x}>{x}</li>)}</ul>
   </div>
   <Head title="OpenShift runtime objects" note="three are not in place yet" />
   <div style={card()}>
    {GW_RUNTIME_OBJECTS.map((o, i) => (
     <div key={o[0]} style={{ display: "flex", gap: 12, padding: "7px 0",
      borderTop: i ? "1px solid #eef3f5" : "none", alignItems: "baseline" }}>
      <span style={{ flex: "0 0 74px" }}>
       {o[1] ? <Chip bg="#eef1f4" fg={MUT}>present</Chip>
             : <Chip bg={WARN} fg="#fff">not yet</Chip>}</span>
      <span style={{ fontSize: 12.5, color: SUB }}>{o[0]}</span>
     </div>))}
   </div>
   <div style={{ display: "grid", gap: 9,
    gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
    <div style={card({ marginBottom: 0 })}>
     <div style={eyebrow}>Metric families</div>
     <ul style={{ fontSize: 12.5, color: SUB, lineHeight: 1.65,
      margin: "7px 0 0", paddingLeft: 17 }}>
      {GW_METRICS.map((x) => <li key={x}>{x}</li>)}</ul>
    </div>
    <div style={card({ marginBottom: 0 })}>
     <div style={eyebrow}>Runbooks required</div>
     <ul style={{ fontSize: 12.5, color: SUB, lineHeight: 1.65,
      margin: "7px 0 0", paddingLeft: 17 }}>
      {GW_RUNBOOKS.map((x) => <li key={x}>{x}</li>)}</ul>
    </div>
   </div>
   <div style={card({ borderLeft: `3px solid ${BAD}` })}>
    <div style={eyebrow}>Secret hygiene</div>
    <Body><div style={{ marginTop: 5 }}>{GW_SECRETS.never}</div>
     <div style={{ marginTop: 7, color: INK }}>{GW_SECRETS.rotate}{" "}
      {GW_SECRETS.startup}</div></Body>
    <div style={{ display: "grid", gap: 10, marginTop: 11,
     gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))" }}>
     {[["ConfigMap - non-secret", GW_SECRETS.configmap],
       ["Secret - sensitive", GW_SECRETS.secret]].map(([n, xs]) => (
      <div key={n}><div style={eyebrow}>{n}</div>
       <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
        {xs.map((x) => (
         <span key={x} style={{ fontFamily: MONO, fontSize: 10,
          border: `1px solid ${RULE}`, borderRadius: 3, padding: "1px 6px",
          color: INK }}>{x}</span>))}</div></div>))}
    </div>
   </div>
  </div>);

 if (T === "source") return (
  <div>{bar}
   <div style={card()}>
    <div style={eyebrow}>{GAP_DOC.n}</div>
    <Body><div style={{ marginTop: 5 }}>{GAP_DOC.w}</div></Body>
    <div style={{ ...eyebrow, marginTop: 12 }}>Built from</div>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
     {GAP_DOC.sources.map((x) => (
      <span key={x} style={{ fontSize: 10.5, border: `1px solid ${RULE}`,
       borderRadius: 999, padding: "2px 9px", color: SUB }}>{x}</span>))}
    </div>
   </div>
   <Head title="The four-tier model"
    note="the single most consequential thing in the supplement" />
   <div style={card()}>
    {GAP_TIERS.map((x, i) => (
     <div key={x.tier} style={{ display: "flex", gap: 14, padding: "9px 0",
      borderTop: i ? "1px solid #eef3f5" : "none" }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: ACC,
       flex: "0 0 150px" }}>{x.tier}</span>
      <span style={{ fontSize: 12.5, fontWeight: 500, color: INK,
       flex: "0 0 130px" }}>{x.n}</span>
      <span style={{ fontSize: 12.5, color: SUB, lineHeight: 1.6 }}>{x.w}</span>
     </div>))}
   </div>
   <Head title="Precedence" note="which document wins, asked constantly and guessed at" />
   <div style={card()}>
    {GAP_PRECEDENCE.map((p, i) => (
     <div key={p} style={{ display: "flex", gap: 11, padding: "7px 0",
      borderTop: i ? "1px solid #eef3f5" : "none" }}>
      <b style={{ fontSize: 13, color: ACC, flex: "0 0 22px" }}>{i + 1}</b>
      <span style={{ fontSize: 12.5, color: SUB }}>{p}</span>
     </div>))}
   </div>
   <Head title="Canonical traceability identifiers"
    note="nine, with the propagation rule that usually gets lost" />
   <div style={card()}>
    {GAP_IDENTIFIERS.map((x, i) => (
     <div key={x[0]} style={{ display: "flex", gap: 13, padding: "8px 0",
      borderTop: i ? "1px solid #eef3f5" : "none", flexWrap: "wrap" }}>
      <span style={{ fontFamily: MONO, fontSize: 11.5, color: INK,
       flex: "0 0 150px" }}>{x[0]}</span>
      <span style={{ fontSize: 12, color: MUT, flex: "0 0 210px" }}>{x[1]}</span>
      <span style={{ fontSize: 12.5, color: SUB, flex: "1 1 320px" }}>{x[2]}</span>
     </div>))}
   </div>
   <Head title="Foundation entities" note="five exist, three have no table anywhere" />
   <div style={card()}>
    {GAP_FOUNDATION.map((f, i) => (
     <div key={f[0]} style={{ display: "flex", gap: 12, padding: "8px 0",
      borderTop: i ? "1px solid #eef3f5" : "none", alignItems: "baseline",
      flexWrap: "wrap" }}>
      <span style={{ flex: "0 0 74px" }}>
       {f[2] ? <Chip bg="#eef1f4" fg={MUT}>exists</Chip>
             : <Chip bg={WARN} fg="#fff">no table</Chip>}</span>
      <span style={{ fontFamily: MONO, fontSize: 11.5, color: INK,
       flex: "0 0 200px" }}>{f[0]}</span>
      <span style={{ fontSize: 12.5, color: SUB, flex: "1 1 320px" }}>
       {f[1]}</span>
     </div>))}
   </div>
   <Head title="Stage 2 to Stage 3" note={GAP_MOVEMENT.n} />
   <div style={card()}>
    <Body>{GAP_MOVEMENT.w}</Body>
    <div style={{ marginTop: 9 }}><div style={eyebrow}>The gate</div>
     <Body><div style={{ marginTop: 4 }}>{GAP_MOVEMENT.gate}</div></Body></div>
    <div style={{ marginTop: 9 }}><div style={eyebrow}>Replay boundary</div>
     <Body><div style={{ marginTop: 4 }}>{GAP_MOVEMENT.replay}</div></Body></div>
   </div>
   <Head title="Seven reconciliation boundaries" note="the pack specifies three" />
   <div style={card()}>
    <ul style={{ fontSize: 12.5, color: SUB, lineHeight: 1.7, margin: 0,
     paddingLeft: 17 }}>{GAP_RECON.map((x) => <li key={x}>{x}</li>)}</ul>
   </div>
   <Head title="Naming standard" note="one pattern per object type" />
   <div style={card()}>
    {GAP_NAMING.map((n, i) => (
     <div key={n[0]} style={{ display: "flex", gap: 13, padding: "7px 0",
      borderTop: i ? "1px solid #eef3f5" : "none" }}>
      <span style={{ fontSize: 12.5, color: INK, flex: "0 0 180px" }}>
       {n[0]}</span>
      <span style={{ fontFamily: MONO, fontSize: 11, color: SUB,
       flex: "0 0 240px" }}>{n[1]}</span>
      <span style={{ fontFamily: MONO, fontSize: 11, color: MUT }}>{n[2]}</span>
     </div>))}
   </div>
   <div style={card({ borderLeft: `3px solid ${WARN}` })}>
    <div style={eyebrow}>Code finding - {GAP_CODE_FINDING.model}</div>
    <Body><div style={{ marginTop: 5 }}>{GAP_CODE_FINDING.w}</div>
     <div style={{ marginTop: 7, color: INK }}>{GAP_CODE_FINDING.why}</div>
     <div style={{ marginTop: 7 }}>{GAP_CODE_FINDING.fix}</div></Body>
   </div>
   <Head title="Scope" note={`${GAP_SCOPE.length} architecture domains`} />
   <div style={card()}>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
     {GAP_SCOPE.map((x) => (
      <span key={x} style={{ fontSize: 11.5, border: `1px solid ${RULE}`,
       borderRadius: 999, padding: "3px 11px", color: SUB }}>{x}</span>))}
    </div>
   </div>
  </div>);

 /* ---- the default: what the supplements change ---- */
 const shown = F === "all" ? RECONCILE : rcBy(F);
 return (
  <div>{bar}
   <div style={card()}>
    <b style={{ fontSize: 16, color: INK }}>
     {RECONCILE.length} places the supplements touch what we already drew</b>
    <Body><div style={{ marginTop: 6 }}>Holding a second design document
     beside the first is worth nothing unless somebody compares them. Nothing
     below is silently resolved: where the two disagree, both readings are
     stated and the decision is named.</div></Body>
    <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 13 }}>
     {[["all", "All", INK]].concat(Object.keys(RC_VERDICT)
       .map((k) => [k, RC_VERDICT[k].n, RC_VERDICT[k].c]))
      .map(([k, n, c]) => (
       <span key={k} onClick={() => setFilter && setFilter(k)}
        style={{ cursor: "pointer", fontSize: 11.5, fontWeight: F === k ? 700 : 400,
         borderRadius: 999, padding: "4px 13px",
         border: `1px solid ${F === k ? c : RULE}`,
         background: F === k ? c : "#fff",
         color: F === k ? "#fff" : SUB }}>
        {n}{k === "all" ? ` ${RECONCILE.length}` : ` ${RC_COUNTS[k]}`}</span>))}
    </div>
    <div style={{ fontSize: 11.5, color: SUB, marginTop: 10 }}>
     {F === "all" ? "Conflicts first." : RC_VERDICT[F] && RC_VERDICT[F].w}
    </div>
   </div>
   {["conflict", "closes", "extends", "agrees"]
    .filter((v) => F === "all" || F === v)
    .map((v) => shown.filter((r) => r.v === v).map((r) => <Find key={r.id} r={r} />))}
  </div>);
}
