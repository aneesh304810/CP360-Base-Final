// One picture, in the style of SEI's own "BBH to SEI : System Integration".
//
// WHAT MAKES THEIRS READABLE IS WHAT IT LEAVES OUT. Short titles, number
// badges, five words on an arrow at most, and white space. The first
// draft of this put a sentence in every box, a label on every arrow and
// our channel letters beside their step numbers, and it was clumsy. This
// one keeps their numbering and their four columns, puts the event and
// file paths in the white space their diagram already has rather than in
// a second lane, and says almost nothing on the picture itself. The
// detail is one click away on every other screen.
//
// Steps 1 to 15 are theirs. Steps 16 to 24 are the two inbound paths
// their diagram does not draw. Nodes 3 and 12 are the same component:
// the CP-Integration-Gateway, BBH's wrapper around the BBH Apigee proxy,
// drawn where the inbound and the status-return legs pass through it.
//
// SEI's diagram is confidential and not committed; architecture only.

import React from "react";
import { NavStyles } from "./HubNav.jsx";

const INK = "#10193b", SUB = "#5c6b7a", MUT = "#8a97a3";
const NAVY = "#1f3a5f", RED = "#b71c1c", NEW = "#1a8f5a", GW = "#6d3ac0", LINK = "#2a78d6";

function Box({ x, y, w, h, n, badge, sub, tone, fill }) {
 const dark = !!fill;
 return (
  <g>
   <rect x={x} y={y} width={w} height={h} rx={6} fill={fill || "#fff"}
    stroke={tone || NAVY} strokeWidth="1.4" />
   {badge && <>
    <circle cx={x + 15} cy={y + 15} r={10} fill={tone || NAVY} />
    <text x={x + 15} y={y + 18.5} textAnchor="middle" fontSize="9.5"
     fontWeight="800" fill="#fff">{badge}</text></>}
   <text x={x + (badge ? 31 : 10)} y={y + 19} fontSize="11.5" fontWeight="700"
    fill={dark ? "#fff" : INK}>{n}</text>
   {sub && <text x={x + (badge ? 31 : 10)} y={y + 33} fontSize="8.5"
    fill={dark ? "#fbd" : SUB}>{sub}</text>}
  </g>);
}
const Arr = ({ d, c, dash, w }) => (
 <path d={d} fill="none" stroke={c || SUB} strokeWidth={w || 1.5}
  strokeDasharray={dash ? "5 4" : undefined}
  markerEnd={`url(#e2e-${(c || SUB).slice(1)})`} />);
const Lbl = ({ x, y, t, c, a }) => (
 <text x={x} y={y} fontSize="8.5" fontWeight="600" fill={c || SUB}
  textAnchor={a || "middle"}>{t}</text>);
const Pill = ({ x, y, t, c }) => {
 const w = t.length * 5 + 12;
 return (<g>
  <rect x={x - w / 2} y={y - 8} width={w} height={16} rx={8} fill="#fff"
   stroke={c} strokeWidth="1.1" />
  <text x={x} y={y + 3} textAnchor="middle" fontSize="8" fontWeight="700"
   fill={c}>{t}</text></g>);
};

export function EndToEndDiagram({ t }) {
 const W = 1400, H = 700, BX = 700;
 return (
  <div>
   <NavStyles />
   <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto",
    background: "#fff", borderRadius: 10 }} role="img"
    aria-label="BBH and SEI end to end: SEI's integration diagram with the event and file paths added">
    <defs>
     {[SUB, NAVY, RED, NEW, GW, LINK].map((c) => (
      <marker key={c} id={"e2e-" + c.slice(1)} viewBox="0 0 10 10" refX="9"
       refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
       <path d="M 0 0 L 10 5 L 0 10 z" fill={c} /></marker>))}
    </defs>

    {/* columns */}
    <rect x="16" y="40" width="224" height="640" rx="10" fill="#fdf5f5" stroke="#e8c2c6" />
    <rect x="250" y="40" width="410" height="640" rx="10" fill="#fbfaf1" stroke="#d8d2b8" />
    <rect x="740" y="40" width="394" height="640" rx="10" fill="#f3f8fc" stroke="#c3d4e4" />
    <rect x="1150" y="40" width="234" height="640" rx="10" fill="#f3f8fc" stroke="#c3d4e4" />
    <line x1={BX} y1="40" x2={BX} y2="680" stroke={MUT} strokeWidth="1" strokeDasharray="3 5" />
    <text x="128" y="30" textAnchor="middle" fontSize="12" fontWeight="800" fill={RED}>SWP</text>
    <text x="455" y="30" textAnchor="middle" fontSize="12" fontWeight="800" fill="#8a7b3f">SEI</text>
    <text x="937" y="30" textAnchor="middle" fontSize="12" fontWeight="800" fill={NAVY}>BBH · PS-Integration Hub</text>
    <text x="1267" y="30" textAnchor="middle" fontSize="12" fontWeight="800" fill={NAVY}>BBH systems</text>
    <text x="262" y="56" fontSize="8.5" fontWeight="800" fill="#8a7b3f">PS-ORCHESTRATION</text>
    <text x="262" y="426" fontSize="8.5" fontWeight="800" fill={NEW}>SEI DATA CLOUD · not on SEI's diagram</text>
    <text x="752" y="426" fontSize="8.5" fontWeight="800" fill={NEW}>INBOUND · not on SEI's diagram</text>

    {/* ---- SWP ---- */}
    <Box x={30} y={66} w={90} h={596} n="SWP" sub="Platform" fill={RED} tone={RED} />
    <Box x={132} y={106} w={98} h={40} n="SWP APIs" badge="8" />
    <Box x={132} y={276} w={98} h={40} n="Loaders" badge="9" />
    <Box x={132} y={356} w={98} h={36} n="SWP UI" tone="#b9c6d1" />
    <Box x={132} y={596} w={98} h={40} n="SFTP extract" badge="20" tone={NEW} />

    {/* ---- SEI PS-Orchestration ---- */}
    <Box x={260} y={66} w={180} h={40} n="Orchestration API" badge="4" />
    <Box x={470} y={66} w={180} h={40} n="Metadata · config" badge="5b" />
    <Box x={260} y={136} w={180} h={40} n="Data ingestion" badge="5a" />
    <Box x={260} y={206} w={180} h={40} n="Orchestration data model" badge="6" />
    <Box x={260} y={276} w={180} h={40} n="Workflows" badge="7" />
    <Box x={470} y={276} w={180} h={40} n="Status dashboard" badge="11" />
    {/* ---- SEI Data Cloud ---- */}
    <Box x={260} y={436} w={180} h={46} n="SDC Snowflake" badge="16" tone={NEW} sub="DEV · IMPS · Prod" />
    <Box x={260} y={516} w={180} h={46} n="SEI Kafka" badge="17" tone={NEW} sub="BBH's dedicated queue" />
    <Box x={260} y={596} w={180} h={40} n="Momentum" badge="21" tone={NEW} />

    {/* ---- BBH hub, SEI's steps ---- */}
    <Box x={750} y={106} w={188} h={50} n="CP-Integration-Gateway" badge="3" tone={GW} sub="BBH Apigee proxy, wrapped" />
    <Box x={950} y={196} w={170} h={32} n="Loader file" badge="2c" />
    <Box x={950} y={238} w={170} h={32} n="JSON" badge="2b" />
    <Box x={950} y={280} w={170} h={32} n="Data extracts" badge="2a" />
    <Box x={750} y={286} w={188} h={50} n="CP-Integration-Gateway" badge="12" tone={GW} sub="status return" />
    <Box x={950} y={330} w={170} h={46} n="Integration360" badge="13" sub="status · exceptions · recon" />
    <Box x={950} y={388} w={170} h={32} n="User · SSO" badge="14" />
    {/* ---- BBH hub, added ---- */}
    <Box x={750} y={436} w={180} h={46} n="Set-based puller" badge="19" tone={NEW} sub="Snowflake session · tag → target" />
    <Box x={750} y={516} w={180} h={46} n="Event listener" badge="18" tone={NEW} sub="reads the tag off the queue" />
    <Box x={750} y={596} w={180} h={46} n="File ingestion" badge="22" tone={NEW} sub="landing → validate → RAW" />
    <Box x={950} y={436} w={170} h={206} n="Oracle" badge="23" tone={NEW} />
    {["Stage 1 · RAW", "↓", "Stage 2 · STG → INT", "↓ completeness gate", "Stage 3 · Exadata", "↓", "consumer movement"]
     .map((l, i) => <text key={i} x={981} y={482 + i * 20} fontSize="9.5" fill={INK}>{l}</text>)}

    {/* ---- BBH systems ---- */}
    <Box x={1160} y={66} w={214} h={74} n="BBH systems" badge="1" tone={RED}
     sub="front office · back office · trade · custody" />
    <Box x={1160} y={436} w={214} h={46} n="Consumers" badge="24" tone={NEW} sub="read through the gateway" />

    {/* ================= arrows: SEI's steps ================= */}
    <Arr d="M1160 212 H1120" /><Arr d="M1160 254 H1120" /><Arr d="M1160 296 H1120" />
    <Arr d="M1160 120 H1140 V212" c={SUB} w={0} />
    <Arr d="M950 296 H944 V212" c={SUB} w={1.5} />
    <Arr d="M950 254 H944" w={0} /><Arr d="M950 212 H944 V156" c={RED} />
    <Arr d="M1160 112 H938" c={GW} />
    <Lbl x={1045} y={106} t="real-time API calls" c={GW} />
    <Arr d="M750 120 H718 V54 H181 V106" c={GW} />
    <Arr d={`M750 142 H${BX} V121 H410 V106`} c={RED} />
    <Pill x={BX} y={142} t="gateway" c={GW} />
    <Lbl x={560} y={117} t="loader submit" c={RED} />
    <Arr d="M350 106 V136" />
    <Arr d="M440 156 H455 V86 H470" dash /><Lbl x={462} y={130} t="read config" a="start" />
    <Arr d="M350 176 V206" /><Lbl x={356} y={195} t="ingest" a="start" />
    <Arr d="M350 246 V276" />
    <Arr d="M440 296 H470" />
    <Arr d="M260 290 H246 V126 H230" />
    <Arr d="M260 302 H230 V296" /><Lbl x={246} y={318} t="submit loader" />
    <Arr d="M132 126 H120" /><Arr d="M132 296 H120" />
    <Arr d={`M350 316 V340 H${BX} V311 H750`} c={RED} />
    <Pill x={BX} y={311} t="gateway" c={GW} />
    <Lbl x={560} y={352} t="status update to BBH" c={RED} />
    <Arr d="M938 311 H950" c={RED} />
    <Arr d="M1035 388 V376" />
    <Arr d="M1035 420 V410 H181 V392" c={GW} dash /><Lbl x={600} y={420} t="SSO to the SWP UI" c={GW} />

    {/* ================= arrows: the added paths ================= */}
    <Arr d="M120 459 H260" c={NEW} /><Lbl x={190} y={453} t="commits" c={NEW} />
    <Arr d="M350 482 V516" c={NEW} /><Lbl x={356} y={504} t="publishes" c={NEW} a="start" />
    <Arr d="M440 539 H750" c={LINK} w={2} />
    <Pill x={BX} y={539} t="Private Link" c={LINK} />
    <Lbl x={560} y={532} t="held connection · no gateway" c={LINK} />
    <Arr d="M840 516 V482" c={NEW} /><Lbl x={846} y={504} t="tag → target" c={NEW} a="start" />
    <Arr d="M750 459 H440" c={LINK} w={2} />
    <Pill x={BX} y={459} t="Private Link · 2 paths" c={LINK} />
    <Lbl x={560} y={452} t="Snowflake session" c={LINK} />
    <Arr d="M930 459 H950" c={NEW} />
    <Arr d="M120 616 H132" c={NEW} /><Arr d="M230 616 H260" c={NEW} />
    <Arr d="M440 619 H750" c={NEW} w={2} />
    <Pill x={BX} y={619} t="SFTP / Momentum" c={NEW} />
    <Lbl x={560} y={612} t="daily set, standby · + loader error detail" c={NEW} />
    <Arr d="M930 619 H950" c={NEW} />
    <Arr d="M1120 459 H1160" c={NEW} />

    <text x="30" y="676" fontSize="8.5" fill={MUT}>
     Steps 1–15 as on SEI's System Integration diagram. Steps 16–24 (green) are the two inbound paths it does not draw. Nodes 3 and 12 are one component.</text>
   </svg>
  </div>);
}
