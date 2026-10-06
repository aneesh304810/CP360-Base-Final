// One picture, in the style of SEI's own "BBH to SEI : System Integration".
//
// WHY A HAND-LAID DIAGRAM AND NOT A ZONE MAP. The previous attempts drew
// zones and auto-routed wires between them, and every one of them was
// unreadable the moment more than six links were on screen. SEI's
// diagram is readable because somebody placed every box and every arrow
// by hand, numbered the steps, and left white space. This does the same.
//
// WHAT IT SHOWS. The top lane is SEI's diagram, steps 1 to 15, in their
// numbering and their columns. The bottom lane is what their diagram
// does not have: the event path and the file path, steps 16 to 25. Same
// columns, so a reader sees at once that the top lane runs BBH to SEI
// and the bottom lane runs the other way.
//
// SOURCE DISCIPLINE. SEI's diagram is confidential and not committed;
// only the architecture is drawn. No hostnames, addresses or data.

import React from "react";
import { NavStyles } from "./HubNav.jsx";

const INK = "#10193b", SUB = "#4a5a68", MUT = "#7b8894";
const SEI_C = "#8a7b3f", BBH_C = "#0f4775", RED = "#b71c1c";
const A = "#2a78d6", B = "#1baf7a", C = "#eb6834", D = "#6d3ac0", G = "#5c6b7a";

function Box({ x, y, w, h, n, badge, sub, tone, fill, dashed, big }) {
 const lines = sub ? sub.split("|") : [];
 return (
  <g>
   <rect x={x} y={y} width={w} height={h} rx={7} fill={fill || "#fff"}
    stroke={tone || "#b9c6d1"} strokeWidth={big ? 1.8 : 1.3}
    strokeDasharray={dashed ? "6 4" : undefined} />
   {badge && <>
    <circle cx={x + 16} cy={y + 16} r={11} fill={tone || BBH_C} />
    <text x={x + 16} y={y + 20} textAnchor="middle" fontSize="10"
     fontWeight="800" fill="#fff">{badge}</text></>}
   <text x={x + (badge ? 33 : 10)} y={y + 20} fontSize={big ? 12.5 : 11.5}
    fontWeight="700" fill={fill && fill !== "#fff" ? "#fff" : INK}>{n}</text>
   {lines.map((l, i) => (
    <text key={i} x={x + 10} y={y + 36 + i * 13} fontSize="9"
     fill={fill && fill !== "#fff" ? "#fde" : SUB}>{l}</text>))}
  </g>);
}

function Arr({ d, tone, dashed, label, lx, ly, anchor, w }) {
 const id = "e2e-" + (tone || G).replace("#", "");
 return (
  <g>
   <path d={d} fill="none" stroke={tone || G} strokeWidth={w || 1.6}
    strokeDasharray={dashed ? "6 4" : undefined} markerEnd={`url(#${id})`} />
   {label && <text x={lx} y={ly} fontSize="9" fontWeight="600" fill={tone || G}
    textAnchor={anchor || "middle"}>{label}</text>}
  </g>);
}

function Pill({ x, y, n, tone }) {
 const w = n.length * 5.3 + 14;
 return (
  <g>
   <rect x={x - w / 2} y={y - 9} width={w} height={18} rx={9} fill="#fff"
    stroke={tone || G} strokeWidth="1.2" />
   <text x={x} y={y + 3.5} textAnchor="middle" fontSize="8.5" fontWeight="700"
    fill={tone || G}>{n}</text>
  </g>);
}

export function EndToEndDiagram({ t }) {
 const W = 1400, H = 1030, BX = 704;   // BX: the boundary strip centre
 return (
  <div>
   <NavStyles />
   <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto",
    background: "#fff", borderRadius: 10 }} role="img"
    aria-label="BBH and SEI end to end: SEI's integration diagram with the event and file paths added">
    <defs>
     {[A, B, C, D, G].map((c) => (
      <marker key={c} id={"e2e-" + c.replace("#", "")} viewBox="0 0 10 10"
       refX="9" refY="5" markerWidth="6" markerHeight="6"
       orient="auto-start-reverse">
       <path d="M 0 0 L 10 5 L 0 10 z" fill={c} /></marker>))}
    </defs>

    {/* ---- bands ---- */}
    <rect x="16" y="46" width="224" height="968" rx="10" fill="#fdf5f5" stroke="#e8c2c6" />
    <rect x="252" y="46" width="416" height="968" rx="10" fill="#fbfaf0" stroke="#d8d2b8" />
    <rect x="740" y="46" width="400" height="968" rx="10" fill="#f3f8fc" stroke="#c3d4e4" />
    <rect x="1152" y="46" width="232" height="968" rx="10" fill="#f3f8fc" stroke="#c3d4e4" />
    <line x1={BX} y1="46" x2={BX} y2="1014" stroke={MUT} strokeWidth="1.2" strokeDasharray="4 5" />
    <text x="128" y="34" textAnchor="middle" fontSize="12" fontWeight="800" fill={RED}>SWP</text>
    <text x="460" y="34" textAnchor="middle" fontSize="12" fontWeight="800" fill={SEI_C}>SEI</text>
    <text x={BX} y="34" textAnchor="middle" fontSize="9" fill={MUT}>BBH boundary</text>
    <text x="940" y="34" textAnchor="middle" fontSize="12" fontWeight="800" fill={BBH_C}>BBH · PS-Integration Hub</text>
    <text x="1268" y="34" textAnchor="middle" fontSize="12" fontWeight="800" fill={BBH_C}>BBH systems</text>

    {/* ---- lane labels ---- */}
    <text x="28" y="66" fontSize="10" fontWeight="800" fill={BBH_C}>
     BBH → SEI</text>
    <text x="200" y="66" fontSize="9" fill={MUT}>
     as drawn on SEI's System Integration diagram · steps 1–15</text>
    <line x1="16" y1="484" x2="1384" y2="484" stroke={MUT} strokeWidth="1" strokeDasharray="2 4" />
    <text x="28" y="506" fontSize="10" fontWeight="800" fill={B}>
     SEI → BBH</text>
    <text x="100" y="506" fontSize="9" fill={MUT}>
     NOT on SEI's diagram · the event path and the file path · steps 16–25</text>

    {/* ================= TOP LANE: SEI's diagram ================= */}
    <Box x={28} y={78} w={96} h={380} n="SWP" sub="Platform" fill={RED} tone={RED} big />
    <Box x={134} y={130} w={98} h={50} n="SWP APIs" badge="8" tone={BBH_C} />
    <Box x={134} y={300} w={98} h={50} n="Loaders" badge="9" tone={BBH_C} />
    <Box x={134} y={400} w={98} h={40} n="SWP UI" tone="#b9c6d1" />

    <Box x={264} y={78} w={190} h={46} n="Orchestration API" badge="4" tone={BBH_C} />
    <Box x={470} y={78} w={186} h={46} n="Metadata, config, mapping" badge="5b" tone={BBH_C} />
    <Box x={264} y={154} w={190} h={46} n="Data ingestion" badge="5a" tone={BBH_C} />
    <Box x={264} y={230} w={190} h={46} n="Orchestration Data Model" badge="6" tone={BBH_C} sub="ODM" />
    <Box x={264} y={306} w={190} h={46} n="Workflows" badge="7" tone={BBH_C} />
    <Box x={470} y={306} w={186} h={46} n="Status monitoring dashboard" badge="11" tone={BBH_C} />

    <Box x={752} y={70} w={170} h={44} n="CP-Integration-Gateway" tone={D}
     sub="wrapper over BBH Apigee" />
    <Box x={752} y={200} w={182} h={44} n="BBH API Apigee proxy" badge="3" tone={BBH_C} sub="inbound to SEI" />
    <Box x={950} y={170} w={180} h={34} n="Loader file" badge="2c" tone={BBH_C} />
    <Box x={950} y={212} w={180} h={34} n="JSON" badge="2b" tone={BBH_C} />
    <Box x={950} y={254} w={180} h={34} n="Data extracts" badge="2a" tone={BBH_C} />
    <Box x={752} y={330} w={182} h={44} n="BBH API Apigee proxy" badge="12" tone={BBH_C} sub="status return" />
    <Box x={950} y={318} w={180} h={70} n="Integration360" badge="13" tone={BBH_C}
     sub="status · exceptions · tracking|reconciliation management" />
    <Box x={950} y={404} w={180} h={34} n="User · SSO" badge="14" tone={BBH_C} />

    <Box x={1164} y={78} w={208} h={190} n="BBH systems" badge="1" tone={RED}
     sub="Front office · Pivotal CRM, Investor View|Back office · AUM, billing, finance|Trade · Bloomberg, CRD, consolidation|Custody · Schwab, settlement, IID" />

    {/* top-lane arrows */}
    <Arr d="M1164 187 H1130" tone={G} />
    <Arr d="M1164 229 H1130" tone={G} />
    <Arr d="M1164 271 H1130" tone={G} />
    <Arr d="M950 187 L934 222" tone={C} />
    <Arr d="M950 229 H934" tone={C} />
    <Arr d="M950 271 L934 222" tone={C} />
    {/* between 5b (ends 124) and 5a (starts 154), into 4 from below */}
    <Arr d="M752 222 H690 V140 H420 V124" tone={C} label="C1 · loader submit" lx={560} ly={136} />
    <Pill x={BX} y={222} n="Apigee" tone={C} />
    <Arr d="M359 124 V154" tone={G} />
    <Arr d="M454 177 H462 V101 H470" tone={G} dashed label="read config" lx={467} ly={162} anchor="start" />
    <Arr d="M359 200 V230" tone={G} label="ingest" lx={366} ly={219} anchor="start" />
    <Arr d="M359 276 V306" tone={G} />
    <Arr d="M454 329 H470" tone={G} />
    <Arr d="M264 322 H248 V155 H232" tone={G} label="SWP APIs" lx={246} ly={240} anchor="end" />
    <Arr d="M264 338 H232 V325" tone={G} label="submit loader" lx={248} ly={356} />
    <Arr d="M134 155 H124" tone={G} />
    <Arr d="M134 325 H124" tone={G} />
    <Arr d={`M454 345 H${BX} V352 H752`} tone={C} label="C2 · status update to BBH" lx={600} ly={364} />
    <Pill x={BX} y={352} n="Apigee" tone={C} />
    <Arr d="M934 352 H950" tone={C} />
    <Arr d="M1040 404 V388" tone={G} />
    {/* real-time API calls, along the top */}
    <Arr d="M1164 92 H922" tone={D} />
    <Arr d="M752 92 H718 V58 H183 V130" tone={D}
     label="D2 · real-time API calls" lx={460} ly={54} />
    <Pill x={BX} y={76} n="Gateway + Apigee" tone={D} />
    <Arr d="M1040 438 V452 H160 V440" tone={D} dashed label="15 · SSO to the SWP UI" lx={600} ly={466} />

    {/* ================= BOTTOM LANE: the missing paths ================= */}
    <Box x={28} y={520} w={96} h={330} n="SWP" sub="Platform|commits" fill={RED} tone={RED} big />
    <Box x={134} y={740} w={98} h={50} n="SFTP extract" badge="17" tone={B} sub="daily file set" />

    <text x="264" y="516" fontSize="9" fontWeight="800" fill={SEI_C}>SEI DATA CLOUD</text>
    <Box x={264} y={524} w={190} h={92} n="SDC Snowflake" badge="18" tone={A}
     sub="DEV · IMPS · Prod, one account each|paired Azure subscriptions|network policy: SEI subnets + VPN" />
    <Box x={264} y={640} w={190} h={78} n="SEI Kafka" badge="19" tone={A}
     sub="BBH's dedicated queue on SEI's cluster|domain topics · markers 1000 / 1001|event carries the TAG, no payload" />
    <Box x={264} y={740} w={190} h={50} n="Momentum" badge="20" tone={B} sub="copies complete files only" />
    <Box x={264} y={808} w={392} h={74} n="Two Private Links, not one - and three environments" tone={A} dashed
     sub="path 1 · SQL service  ·  path 3 · managed blob: PUT, GET, large result sets|step 22 needs both: path 1 alone passes tests, fails on the first real batch|DEV, IMPS, Prod: three paths, three credential sets, no firewall overlap" />

    <Box x={752} y={524} w={180} h={92} n="Set-based puller" badge="22" tone={A}
     sub="a Snowflake SESSION, not an API|the tag selects the target|one bound read per view per batch" />
    <Box x={752} y={640} w={180} h={78} n="Event listener" badge="21" tone={A}
     sub="consumes the dedicated queue|reads the tag · markers bracket|the micro-batch · at-least-once" />
    <Box x={752} y={740} w={180} h={100} n="File ingestion" badge="23" tone={B}
     sub="Landing zone → validate → 3 counts|agree → RAW in one transaction|Archive · Quarantine|standby under events-primary" />
    <Box x={950} y={524} w={180} h={316} n="Oracle data estate" badge="24" tone={BBH_C} big
     sub="|Stage 1 · RAW|  ↓|Stage 2 · STG → INT (dbt)|  ↓ completeness gate|  DATE_CONTROL → TRIGGER|  needs every micro-batch LOADED|  AND the EOD system event|  ↓|Stage 3 · Exadata, Pre-Gold|  ↓|Consumer movement" />
    <Box x={1164} y={524} w={208} h={70} n="Consumers" badge="25" tone={BBH_C}
     sub="read Stage 3 through the Hub APIs|via CP-Integration-Gateway" />
    <Box x={1164} y={740} w={208} h={60} n="Loader error detail" tone={C} dashed
     sub="returns as a FILE (C3) - must stay|out of the expected daily set" />

    {/* bottom-lane arrows */}
    <Arr d="M124 570 H264" tone={A} label="16 · commits to the intake" lx={194} ly={562} />
    <Arr d="M359 616 V640" tone={A} label="SDC publishes" lx={366} ly={633} anchor="start" />
    <Arr d={`M454 679 H752`} tone={A} w={2} label="A1 · held connection, no gateway" lx={555} ly={672} />
    <Pill x={BX} y={679} n="Private Link" tone={A} />
    <Arr d="M842 640 V616" tone={A} label="tag → target" lx={850} ly={632} anchor="start" />
    <Arr d={`M752 570 H454`} tone={A} w={2} label="A2 · Snowflake session" lx={545} ly={562} />
    <Pill x={BX} y={570} n="Private Link · path 1 + 3" tone={A} />
    <Arr d="M932 570 H950" tone={A} />
    <Arr d="M124 765 H134" tone={B} />
    <Arr d="M232 765 H264" tone={B} />
    <Arr d={`M454 765 H752`} tone={B} w={2} label="B1 · standby route" lx={545} ly={758} />
    <Pill x={BX} y={765} n="SFTP / Momentum" tone={B} />
    <Arr d="M932 790 H950" tone={B} />
    <Arr d="M1164 770 H1142 V854 H842 V840" tone={C} dashed label="C3 · as a file" lx={1000} ly={866} />
    <Arr d="M1130 559 H1164" tone={BBH_C} />

    {/* ---- legend ---- */}
    <g transform="translate(28, 910)">
     <text x="0" y="0" fontSize="9" fontWeight="800" fill={MUT}>LEGEND</text>
     {[[BBH_C, "steps 1–15 · on SEI's diagram"], [A, "steps 16–22 · the event path, channel A"],
       [B, "steps 17, 20, 23 · the file path, channel B"], [C, "channel C · the loader round trip"],
       [D, "channel D · consumer and real-time reads"]].map(([c, l], i) => (
      <g key={l} transform={`translate(${(i % 3) * 300}, ${16 + Math.floor(i / 3) * 16})`}>
       <circle cx="6" cy="-3" r="5" fill={c} />
       <text x="16" y="0" fontSize="9" fill={SUB}>{l}</text>
      </g>))}
     <text x="0" y="56" fontSize="9" fill={MUT}>
      A pill on the boundary names what carries the crossing. Steps 16–25 are the two inbound paths SEI's diagram does not draw; every step on it runs BBH to SEI.</text>
     <text x="0" y="70" fontSize="8.5" fill={MUT}>
      Architecture only. SEI's source diagram is confidential and is not committed. No hostnames, addresses or data.</text>
    </g>
   </svg>
  </div>);
}
