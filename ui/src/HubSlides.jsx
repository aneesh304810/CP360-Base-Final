import React, { useState } from "react";
import { ROLE, USES, GOVERNS } from "./hubBusiness.js";

// HubSlides: the business view as a short presentation in four chapters.
// The problem (the tower story, why now, the world without a hub), what it is
// (the post office for data, in plain words), how it works (one doorway and
// four channels, the five things it does to every movement, how it is kept
// under control) and what the business gets. Every slide is one picture and a
// few lines; nothing on any slide is a host, an account or a credential.

const NAVY = "#10193b", TEAL = "#0e8f7e", RED = "#cc3344", AMBER = "#e0a13d", BLUE = "#1168bd", MUTE = "#5c7c94", VIOLET = "#6d3ac0";

export const WITHOUT_HUB = {
  sources: ["SEI files", "SEI events", "SEI APIs", "Vendor feeds", "BBH consumers"],
  jobs: [["RMJ schedule", "own mapping"], ["cron job", "no translation"], ["shell script", "hard-coded"], ["PL/SQL job", "own mapping"], ["interface app", "own rules"], ["scheduler task", "no record"], ["spreadsheet macro", "manual"], ["SFTP + script", "no retry"]],
  destinations: ["PBDW", "Pivotal DB", "IMDS", "SEI", "Reporting"],
  callouts: [["Every pair is its own job", "An RMJ schedule here, a cron job there, a script someone wrote: one per source and destination, each with its own copy of the mapping, or none."],
    ["A contract change touches every job", "When SEI changes a layout, every script that reads it is found by failing. Nobody has the list."],
    ["No record of the day", "Each job logs for itself. Whether the business date is complete is a question nobody can answer from one place."],
    ["Errors found downstream", "A wrong value is noticed by the consumer, after the report is out, with no reason code and no replay."]],
};
export const WITH_HUB = {
  channels: [["Events", "real-time"], ["Inbound files", "daily"], ["APIs", "on call"], ["Outbound loaders", "push + poll"]],
  inside: [["Error handling", "validate at the door · quarantine · retry · replay · held rows"], ["Translation and contracts", "one set of rules, versioned, tested, governed"], ["Record of every movement", "business date · registry · reconciliation · date close"],
    ["Security, entitlements and control", "who may see or change what · approvals · audit trail · PII masked · secrets in a vault"]],
  governedBy: ["Security Entitlement", "Code Review 360", "Release Delivery", "PII Explorer", "Cyber Security 360"],
  callouts: [["Plug and play", "A new interface is a configuration row and a contract, not a new job. It arrives on one of four channels the hub already runs."],
    ["One place to change", "A data contract or a transformation changes in the hub, once, under governance. Consumers keep reading a stable shape."],
    ["Many to many", "Any source to any destination through one doorway: SEI and vendors in, PBDW, Pivotal, IMDS and SEI out."],
    ["Errors caught, shown, replayed", "Every channel validates, quarantines or holds with a reason code; Integration 360 shows what, where and why; the play is replayed, never patched by hand."],
    ["Secured and controlled", "Access per person and per module (Security Entitlement). Changes reviewed (Code Review 360), promoted (Release Delivery) and audited. Personal data classified (PII Explorer) and masked outside the hub. Credentials in a vault, never in a job."]],
};

const Box = ({ x, y, w, h = 38, label, s, c = BLUE, fill = "#fff", dash, bold = 11 }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx="7" fill={fill} stroke={c} strokeWidth={1.4} strokeDasharray={dash ? "5 4" : undefined} />
    <text x={x + w / 2} y={y + (s ? 16 : h / 2 + 4)} fontSize={bold} fontWeight="700" fill={NAVY} textAnchor="middle">{label}</text>
    {s && <text x={x + w / 2} y={y + 29} fontSize="8.5" fill={c} textAnchor="middle">{s}</text>}
  </g>);

/** Slide 1 picture: sources, a tangle of jobs, destinations. */
export function WithoutHub() {
  const L = WITHOUT_HUB.sources, J = WITHOUT_HUB.jobs, R = WITHOUT_HUB.destinations;
  const ly = (i) => 30 + i * 64, jy = (i) => 18 + i * 42, ry = (i) => 30 + i * 64;
  const links = J.map((_, j) => [j % L.length, j, (j * 2 + 1) % R.length]).concat(J.map((_, j) => [(j + 2) % L.length, j, (j * 3) % R.length]));
  return (
    <svg viewBox="0 0 980 360" width="100%" style={{ display: "block" }} role="img" aria-label="without a hub: sources wired to destinations through many jobs">
      {links.map(([s, j, d], i) => (
        <g key={i} opacity="0.7">
          <path d={`M160,${ly(s) + 19} C260,${ly(s) + 19} 300,${jy(j) + 19} 390,${jy(j) + 19}`} fill="none" stroke={i % 3 === 0 ? RED : MUTE} strokeWidth="1.1" strokeDasharray={i % 4 === 0 ? "3 3" : undefined} />
          <path d={`M590,${jy(j) + 19} C680,${jy(j) + 19} 720,${ry(d) + 19} 820,${ry(d) + 19}`} fill="none" stroke={i % 3 === 0 ? RED : MUTE} strokeWidth="1.1" strokeDasharray={i % 4 === 0 ? "3 3" : undefined} />
        </g>))}
      {L.map((l, i) => <Box key={l} x={20} y={ly(i)} w={140} label={l} c={VIOLET} fill="#f2eefa" />)}
      {J.map(([l, s], i) => <Box key={l} x={390} y={jy(i)} w={200} label={l} s={s} c={i % 3 === 0 ? RED : AMBER} fill={i % 3 === 0 ? "#fae0e2" : "#fdf1d8"} dash={i % 4 === 0} />)}
      {R.map((l, i) => <Box key={l} x={820} y={ry(i)} w={140} label={l} c={TEAL} fill="#e6f4f2" />)}
      <text x={490} y={356} fontSize="9.5" fill={RED} textAnchor="middle" fontWeight="700">{J.length} jobs for {L.length} sources and {R.length} destinations · each with its own translation, or none · no one record of the day</text>
    </svg>);
}

/** Slide 2 picture: the hub with its channels, what it does inside, and the consumers. */
export function WithHub() {
  const hubX = 300, hubW = 380, hubY = 14, hubH = 406;
  return (
    <svg viewBox="0 0 980 432" width="100%" style={{ display: "block" }} role="img" aria-label="with the hub: channels in, consumers out, error handling, translation, the record and security and control inside">
      <defs><marker id="hsArr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={TEAL} /></marker></defs>
      {ROLE.sources.map(([l, s], i) => <Box key={l} x={20} y={30 + i * 66} w={190} h={44} label={l} s={s} c={VIOLET} fill="#f2eefa" />)}
      {ROLE.sources.map((_, i) => <path key={i} d={`M210,${52 + i * 66} L${hubX},${52 + i * 66}`} stroke={TEAL} strokeWidth="1.4" markerEnd="url(#hsArr)" fill="none" strokeDasharray={i === 2 ? "4 4" : undefined} />)}
      <rect x={hubX} y={hubY} width={hubW} height={hubH} rx="12" fill={NAVY} />
      <text x={hubX + hubW / 2} y={hubY + 24} fontSize="13" fontWeight="800" fill="#fff" textAnchor="middle">CP INTEGRATION HUB</text>
      <text x={hubX + 16} y={hubY + 46} fontSize="8.5" fontWeight="800" fill="#8fd3c6" letterSpacing="1">INGESTION CHANNELS</text>
      {WITH_HUB.channels.map(([l, c], i) => (
        <g key={l}>
          <rect x={hubX + 16 + i * 88} y={hubY + 54} width={85} height={40} rx="6" fill="#ffffff14" stroke="#a9c1de66" />
          <text x={hubX + 58.5 + i * 88} y={hubY + 71} fontSize="9" fontWeight="700" fill="#fff" textAnchor="middle">{l}</text>
          <text x={hubX + 58.5 + i * 88} y={hubY + 85} fontSize="8" fill="#8fd3c6" textAnchor="middle">{c}</text>
        </g>))}
      {WITH_HUB.inside.map(([l, s], i) => (
        <g key={l}>
          <rect x={hubX + 16} y={hubY + 108 + i * 56} width={hubW - 32} height={46} rx="6" fill={i === 0 ? "#cc334433" : i === 1 ? "#1168bd44" : i === 3 ? "#6d3ac055" : "#ffffff14"} stroke={i === 0 ? "#f2a0a8" : i === 1 ? "#8fb8ee" : i === 3 ? "#c9b3ef" : "#a9c1de66"} />
          <text x={hubX + 28} y={hubY + 127 + i * 56} fontSize="11" fontWeight="700" fill="#fff">{l}</text>
          <text x={hubX + 28} y={hubY + 143 + i * 56} fontSize="8.5" fill="#dbe6f3">{s}</text>
        </g>))}
      <text x={hubX + hubW / 2} y={hubY + hubH - 42} fontSize="9" fill="#8fd3c6" textAnchor="middle" fontWeight="700">plug and play · one place to change · governed</text>
      <text x={hubX + hubW / 2} y={hubY + hubH - 26} fontSize="8" fill="#c9b3ef" textAnchor="middle">governed by {WITH_HUB.governedBy.slice(0, 3).join(" · ")}</text>
      <text x={hubX + hubW / 2} y={hubY + hubH - 13} fontSize="8" fill="#c9b3ef" textAnchor="middle">{WITH_HUB.governedBy.slice(3).join(" · ")}</text>
      {ROLE.consumers.map(([l, s], i) => <Box key={l} x={770} y={20 + i * 60} w={190} h={44} label={l} s={s} c={i === 4 ? "#b8c4ce" : TEAL} fill={i === 4 ? "#f6f8fa" : "#e6f4f2"} dash={i === 4} />)}
      {ROLE.consumers.map((_, i) => <path key={i} d={`M${hubX + hubW},${42 + i * 60} L770,${42 + i * 60}`} stroke={TEAL} strokeWidth="1.4" markerEnd="url(#hsArr)" fill="none" strokeDasharray={i === 4 ? "4 4" : undefined} />)}
    </svg>);
}

export const STORY = {
  airlines: ["Airline A", "Airline B", "Airline C", "Charter", "Cargo"], crews: ["Fuel", "Baggage", "Gates", "Catering", "Customs"],
  arrangements: ["own radio", "paper sheet", "a phone call", "a macro"],
  beats: [
    ["The airport without a tower", "Every airline made its own arrangements with every crew: a radio frequency, a paper sheet, a phone call. Forty of them, and nobody holds the list.", "RMJ schedules, cron jobs, scripts and small applications, each with its own translation or none"],
    ["The tower", "Every movement comes through it, is recorded, and is handed on in a form the next crew already understands.", "CP Integration Hub: receive, validate, translate, reconcile, publish"],
    ["Four approaches", "Scheduled arrivals, the radar feed, a radio call, departures confirmed back down to the last bag.", "inbound files, events, APIs, outbound loaders"],
    ["The flight strip", "One strip per movement, one state at a time. The day closes when every expected flight is accounted for, not when the clock says so.", "the registry row and the business date"],
    ["The bad days", "A holding pattern, a go-around, a flight not on time, a plane down with no gate, a plan filed twice. Each has a word and a next step.", "quarantine, retry, missing file, archive failed, duplicate skipped"],
    ["The radar screen", "One screen: every flight, which one is in trouble, where, and why. No controller reads logs.", "Integration 360: what, where, why, down to the rows"],
  ],
  close: "The airport without a tower was not unsafe every day. It was unsafe on the day something changed and nobody knew who was affected.",
};

/** Slide 0 picture: the airport without a tower on the left, with the tower on the right. */
export function TowerStory() {
  const L = STORY.airlines, R = STORY.crews;
  const y = (i) => 34 + i * 58;
  const links = [[0, 1], [0, 3], [1, 0], [1, 4, "bad"], [2, 1, "bad", "dash"], [2, 2], [2, 4], [3, 0, "", "dash"], [3, 2, "bad"], [4, 3], [4, 1, "", "dash"], [0, 2, "bad"]];
  return (
    <svg viewBox="0 0 760 330" width="100%" style={{ display: "block" }} role="img" aria-label="the airport without a tower and with one">
      <text x="12" y="20" fontSize="10" fontWeight="800" fill={RED} letterSpacing="1">WITHOUT A TOWER</text>
      {links.map(([a, b, bad, dash], i) => <path key={i} d={`M104,${y(a) + 15} C180,${y(a) + 15} 180,${y(b) + 15} 256,${y(b) + 15}`} fill="none" stroke={bad ? RED : MUTE} strokeWidth="1.1" strokeDasharray={dash ? "3 3" : undefined} opacity="0.75" />)}
      {L.map((l, i) => <Box key={l} x={12} y={y(i)} w={92} h={30} label={l} c={VIOLET} fill="#f2eefa" bold={10.5} />)}
      {R.map((l, i) => <Box key={l} x={256} y={y(i)} w={92} h={30} label={l} c={TEAL} fill="#e6f4f2" bold={10.5} />)}
      {STORY.arrangements.map((a, i) => <text key={a} x={[150, 152, 150, 150][i]} y={[30, 140, 200, 312][i]} fontSize="8.5" fill={RED} fontFamily="ui-monospace, monospace">{a}</text>)}
      <text x={180} y={326} fontSize="9" fill={MUTE} textAnchor="middle">12 arrangements, 12 translations, no record of the day</text>
      <line x1="372" y1="24" x2="372" y2="320" stroke="#d6dce6" strokeDasharray="4 4" />
      <text x="392" y="20" fontSize="10" fontWeight="800" fill={TEAL} letterSpacing="1">WITH A TOWER</text>
      {L.map((l, i) => <Box key={l} x={392} y={y(i)} w={92} h={30} label={l} c={VIOLET} fill="#f2eefa" bold={10.5} />)}
      {R.map((l, i) => <Box key={l} x={656} y={y(i)} w={92} h={30} label={l} c={TEAL} fill="#e6f4f2" bold={10.5} />)}
      <rect x="534" y="40" width="72" height="250" rx="10" fill={NAVY} />
      <rect x="520" y="40" width="100" height="44" rx="10" fill={NAVY} />
      <rect x="528" y="48" width="84" height="28" rx="6" fill="#e8eef6" />
      <text x="570" y="67" textAnchor="middle" fontSize="10" fontWeight="800" fill={NAVY}>TOWER</text>
      {["receive", "validate", "translate", "reconcile", "publish"].map((v, i) => <text key={v} x="570" y={118 + i * 30} textAnchor="middle" fontSize="8.5" fill="#a9c1de" fontFamily="ui-monospace, monospace">{v}</text>)}
      {L.map((_, i) => <path key={`l${i}`} d={`M484,${y(i) + 15} L534,${y(i) + 15}`} stroke={TEAL} strokeWidth="1.4" />)}
      {R.map((_, i) => <path key={`r${i}`} d={`M606,${y(i) + 15} L656,${y(i) + 15}`} stroke={TEAL} strokeWidth="1.4" />)}
      <text x={570} y={326} fontSize="9" fill={MUTE} textAnchor="middle">one doorway, one language, one record</text>
    </svg>);
}

export const CONTEXT = {
  beats: [
    ["The situation", "BBH Capital Partners is moving its books and records onto SEI. From the first business day, almost every number BBH reports, reconciles, bills or shows a client originates at SEI and must reach BBH's own systems, and BBH keeps sending SEI instructions back.", "a two-way relationship of roughly forty interfaces per business date"],
    ["The channels", "Events from the SDC Event Hub are the primary feed. The thirty-eight SWP files are the daily standby and the reconciliation baseline. Loaders carry BBH's submissions back. APIs are not Day 1.", "four channels at different maturities, each treated by its nature"],
    ["The obvious approach, and its cost", "One job per interface: a schedule here, a script there. Every job its own copy of the mapping. A layout change is found by whichever job breaks first. Nobody can say whether the day is complete.", "forty jobs and a partner who keeps changing templates: a standing operational risk"],
    ["The decision", "One controlled doorway. Receive on all four channels, validate at the door, translate by one set of versioned rules, reconcile promised against loaded, publish one stable shape per consumer. Every movement has a record.", "CP Integration Hub; a change is made once, under governance; an added interface is configuration and a contract"],
    ["What goes with it", "Integration 360 shows what is wrong, where and why, down to the records, fed from Airflow, dbt and the registry. Lineage, Impact Analysis and Variance 360 read the hub's rules.", "one answer to where a number comes from and what a change would break"],
    ["Scope of this phase", "Events, inbound files and outbound loaders in production; the loader status callback as the first API; PBDW, Pivotal DB and IMDS as destinations. The canonical warehouse is designed forward-compatible, not built.", "13 of the hub's 21 components still depend on an answer from SEI, tracked, not assumed"],
  ],
  close: "Build one doorway now, while there are forty interfaces, rather than untangle four hundred arrangements later.",
};

/** Slide 1 picture: SEI on the left, BBH's systems on the right, the hub between them, the phase drawn solid and later dashed. */
export function ContextPicture() {
  const sei = [["SDC Event Hub", "events, intraday", "primary"], ["SWP files", "38 a day", "standby"], ["SWP APIs", "not Day 1", "later"], ["SEI loaders", "BBH's submissions in", "outbound"]];
  const bbh = [["PBDW", "system of record"], ["Pivotal DB", "existing"], ["IMDS", "existing"], ["Reporting", "reads the published shape"], ["CP DW Canonical", "not this phase"]];
  return (
    <svg viewBox="0 0 760 330" width="100%" style={{ display: "block" }} role="img" aria-label="SEI's platform, CP Integration Hub and BBH's systems, with this phase solid and later dashed">
      <defs><marker id="cxArr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={TEAL} /></marker></defs>
      <rect x="8" y="8" width="214" height="314" rx="12" fill="#f2eefa" stroke="#d9cdf3" />
      <text x="20" y="28" fontSize="10" fontWeight="800" fill={VIOLET} letterSpacing="1">SEI PLATFORM</text>
      {sei.map(([l, s2, tag], i) => (
        <g key={l}>
          <rect x="20" y={40 + i * 66} width="190" height="46" rx="8" fill="#fff" stroke={tag === "later" ? "#b8c4ce" : VIOLET} strokeDasharray={tag === "later" ? "5 4" : undefined} />
          <text x="30" y={59 + i * 66} fontSize="11" fontWeight="700" fill={NAVY}>{l}</text>
          <text x="30" y={75 + i * 66} fontSize="8.5" fill={MUTE}>{s2}</text>
          <text x="200" y={59 + i * 66} fontSize="8" fontWeight="800" fill={tag === "primary" ? TEAL : tag === "later" ? MUTE : AMBER} textAnchor="end">{tag.toUpperCase()}</text>
        </g>))}
      {sei.map(([, , tag], i) => tag === "outbound"
        ? <path key={i} d={`M300,${63 + i * 66} L210,${63 + i * 66}`} stroke={VIOLET} strokeWidth="1.4" fill="none" markerEnd="url(#cxArr)" />
        : <path key={i} d={`M210,${63 + i * 66} L300,${63 + i * 66}`} stroke={tag === "later" ? "#b8c4ce" : TEAL} strokeWidth="1.4" strokeDasharray={tag === "later" ? "4 4" : undefined} fill="none" markerEnd="url(#cxArr)" />)}
      <rect x="300" y="24" width="160" height="282" rx="12" fill={NAVY} />
      <text x="380" y="48" fontSize="11" fontWeight="800" fill="#fff" textAnchor="middle">CP INTEGRATION HUB</text>
      <text x="380" y="63" fontSize="8" fill="#a9c1de" textAnchor="middle">one doorway, both directions</text>
      {["receive on 4 channels", "validate at the door", "translate by one rule set", "reconcile promised vs loaded", "publish one shape each", "record every movement"].map((v, i) => (
        <g key={v}><rect x="312" y={78 + i * 36} width="136" height="28" rx="6" fill="#ffffff14" stroke="#a9c1de55" /><text x="380" y={96 + i * 36} fontSize="8.5" fill="#fff" textAnchor="middle">{v}</text></g>))}
      <text x="380" y="300" fontSize="8" fontWeight="700" fill="#8fd3c6" textAnchor="middle">~40 interfaces per business date</text>
      <rect x="538" y="8" width="214" height="314" rx="12" fill="#e6f4f2" stroke="#bfe3dc" />
      <text x="550" y="28" fontSize="10" fontWeight="800" fill={TEAL} letterSpacing="1">BBH SYSTEMS</text>
      {bbh.map(([l, s2], i) => (
        <g key={l}>
          <rect x="550" y={40 + i * 54} width="190" height="42" rx="8" fill="#fff" stroke={i === 4 ? "#b8c4ce" : TEAL} strokeDasharray={i === 4 ? "5 4" : undefined} />
          <text x="560" y={58 + i * 54} fontSize="11" fontWeight="700" fill={NAVY}>{l}</text>
          <text x="560" y={73 + i * 54} fontSize="8.5" fill={MUTE}>{s2}</text>
        </g>))}
      {bbh.map((_, i) => <path key={i} d={`M460,${61 + i * 54} L550,${61 + i * 54}`} stroke={i === 4 ? "#b8c4ce" : TEAL} strokeWidth="1.4" strokeDasharray={i === 4 ? "4 4" : undefined} fill="none" markerEnd="url(#cxArr)" />)}
      <rect x="236" y="314" width="288" height="14" rx="4" fill="none" />
      <text x="230" y="318" fontSize="8" fill={MUTE}>solid: this phase</text>
      <text x="460" y="318" fontSize="8" fill={MUTE} textAnchor="end">dashed: designed, built later</text>
    </svg>);
}


/* ---- What it is, in plain words: the post office for data ---- */
export const PLAIN = {
  senders: ["Portfolio accounting", "Custody feed", "Fee system", "Nightly script"],
  doors: [["File drop", "a file lands on a server"], ["Live message", "fired the instant something happens"], ["App call", "a system asks a question"], ["Outgoing file", "a file to send to a vendor"]],
  receivers: ["General ledger", "Reporting database", "Vendor", "Client portal"],
  jobs: [
    ["It receives", "It knows what each file or message should look like and checks it at the door. A missing column, a wrong date or a duplicate account is caught on arrival, not three systems later.", "Integration 360 shows the check that failed"],
    ["It translates", "Systems speak different languages: one says acct_no, another AccountId. The hub holds the dictionary and converts, so each system only ever speaks its own.", "the rules live in one place, versioned"],
    ["It delivers", "One incoming file can go to five destinations. The hub knows who needs what, gets it there, and knows who received it.", "many sources to many destinations"],
    ["It keeps the record", "Every step is written down: what came in, what changed, where it went, what went wrong and why.", "that record is what Integration 360 shows"],
  ],
  analogy: "Today every system that sends data to another builds its own private road, with its own rules, its own checks and its own quiet way of failing. With dozens of roads nobody sees the map. The hub is the one post office every parcel passes through.",
  close: "The CP Integration Hub is the single, supervised doorway through which all data moves between systems, so moving data is something you can see, control and change in one place.",
};
export function PlainPicture() {
  const box = (x, y, w, h, fill, stroke, r = 7) => <rect x={x} y={y} width={w} height={h} rx={r} fill={fill} stroke={stroke} strokeWidth="1.2" />;
  const label = (x, y, txt, opt = {}) => <text x={x} y={y} fontSize={opt.size || 10.5} fontWeight={opt.w || 600} fill={opt.c || NAVY} textAnchor={opt.a || "middle"} fontFamily="Inter, system-ui, sans-serif">{txt}</text>;
  const sy = (k) => 46 + k * 60;
  return (
    <svg viewBox="0 0 660 290" width="100%" role="img" aria-label="Systems that send on the left, the CP Integration Hub as a post office in the middle with four doors and four jobs, systems that receive on the right" style={{ display: "block" }}>
      <defs><marker id="pp-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5 0 10z" fill={MUTE} /></marker></defs>
      {label(80, 20, "SYSTEMS THAT SEND", { size: 9.5, c: MUTE })}
      {label(580, 20, "SYSTEMS THAT RECEIVE", { size: 9.5, c: MUTE })}
      {label(340, 20, "CP INTEGRATION HUB · THE POST OFFICE", { size: 9.5, c: TEAL })}
      {PLAIN.senders.map((n, k) => <g key={n}>{box(14, sy(k) - 16, 132, 34, "#fff", "#c9d3df")}{label(80, sy(k) + 5, n, { w: 600, size: 10.5 })}
        <line x1="146" y1={sy(k) + 1} x2="214" y2={sy(k) + 1} stroke={MUTE} strokeWidth="1.2" markerEnd="url(#pp-arr)" /></g>)}
      {PLAIN.receivers.map((n, k) => <g key={n}>{box(514, sy(k) - 16, 132, 34, "#fff", "#c9d3df")}{label(580, sy(k) + 5, n, { w: 600, size: 10.5 })}
        <line x1="446" y1={sy(k) + 1} x2="512" y2={sy(k) + 1} stroke={TEAL} strokeWidth="1.4" markerEnd="url(#pp-arr)" /></g>)}
      {/* the building */}
      <path d="M216 44 L340 26 L464 44 L464 46 L216 46 Z" fill={NAVY} />
      {box(216, 46, 248, 230, "#f3f8f7", TEAL, 4)}
      {PLAIN.doors.map(([d], k) => <g key={d}>{box(216, sy(k) - 13, 70, 28, TEAL, TEAL, 3)}{label(251, sy(k) + 5, d, { c: "#fff", size: 9.5, w: 700 })}</g>)}
      {["Receive & check", "Translate", "Deliver", "Keep the record"].map((j, k) => <g key={j}>
        {box(300, sy(k) - 13, 150, 28, "#fff", TEAL, 14)}
        <circle cx="316" cy={sy(k) + 1} r="8" fill={TEAL} />{label(316, sy(k) + 4.5, String(k + 1), { c: "#fff", size: 9, w: 800 })}
        {label(382, sy(k) + 5, j, { size: 10.5, w: 700, c: NAVY })}
      </g>)}
      {label(340, 266, "one doorway · one dictionary · one record of the day", { size: 9.5, c: TEAL, w: 700 })}
    </svg>);
}


/* ---- The four doors: one slide per channel, in plain words ---- */
export const DOORS = [
  ["File drop", "Inbound files", "every business day", "the day's positions file", "the file is complete, the columns are the ones promised, the counts add up", "the file is quarantined with a reason; nothing downstream reads a half file"],
  ["Live message", "Events", "the instant something happens", "a transaction booked at SEI", "the message has the fields the contract names and is not a duplicate", "the message is parked and retried; the next ones keep flowing"],
  ["App call", "APIs", "when a system asks a question", "a loader asking for its status", "the caller is allowed to ask, and the request is well formed", "the caller gets an error code and a reason, never a silent nothing"],
  ["Outgoing file", "Outbound loaders", "when BBH sends to SEI", "a fee loader submission", "every row the business promised is in the file before it leaves", "the submission is held and shown; it is released when the rows are there"],
];
export function DoorsPicture() {
  const label = (x, y, txt, opt = {}) => <text x={x} y={y} fontSize={opt.size || 10.5} fontWeight={opt.w || 600} fill={opt.c || NAVY} textAnchor={opt.a || "middle"} fontFamily="Inter, system-ui, sans-serif">{txt}</text>;
  const colors = [BLUE, VIOLET, AMBER, TEAL];
  return (
    <svg viewBox="0 0 660 300" width="100%" role="img" aria-label="Four doors into the hub: file drop, live message, app call and outgoing file, all leading to the same sorting floor" style={{ display: "block" }}>
      <defs><marker id="dr-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5 0 10z" fill={MUTE} /></marker></defs>
      {label(330, 20, "FOUR DOORS INTO THE SAME BUILDING", { size: 9.5, c: TEAL })}
      {DOORS.map(([plain, tech, when, ex], k) => { const x = 22 + k * 160, c = colors[k]; return (
        <g key={plain}>
          <path d={`M${x} 190 L${x} 70 Q${x} 36 ${x + 70} 36 Q${x + 140} 36 ${x + 140} 70 L${x + 140} 190 Z`} fill="#fff" stroke={c} strokeWidth="1.6" />
          <rect x={x + 14} y={78} width={112} height={112} rx="4" fill={c} opacity="0.12" />
          <circle cx={x + 112} cy={140} r="3" fill={c} />
          {label(x + 70, 60, plain, { size: 12, w: 800, c })}
          {label(x + 70, 100, tech, { size: 10, w: 700 })}
          {label(x + 70, 118, when, { size: 8.5, w: 500, c: MUTE })}
          {label(x + 70, 166, "e.g. " + ex, { size: 8.5, w: 600, c: NAVY })}
          <line x1={x + 70} y1="192" x2={x + 70} y2="226" stroke={MUTE} strokeWidth="1.2" markerEnd="url(#dr-arr)" />
        </g>); })}
      <rect x="22" y="230" width="616" height="52" rx="8" fill={NAVY} />
      {label(330, 251, "THE SAME SORTING FLOOR BEHIND EVERY DOOR", { size: 9.5, w: 800, c: "#8fd3c6" })}
      {label(330, 270, "check at the door → translate → deliver → write it down", { size: 11, w: 700, c: "#fff" })}
    </svg>);
}

/* ---- What the business gets ---- */
export const BENEFITS = [
  ["One place to change things", "A vendor changes a file layout and someone chases every script that reads it.", "Change the contract once in the hub; every consumer gets the new shape."],
  ["Problems are visible", "A report is wrong the next morning and the search for why begins.", "Integration 360 shows which step failed, which record, which column and what the error was."],
  ["New connections plug in", "Another private road: a new script, a new schedule, a new person who knows it.", "Register the system with the hub. Its channel, checks and translation already exist."],
  ["It is governed", "Who owns a feed and what changed when lives in people's heads.", "Owner, rules and every change are recorded; Code Review 360 reviews, Lineage and Impact read the same rules."],
];
export const CHAPTERS = [["problem", "The problem"], ["what", "What it is"], ["how", "CP Integration Hub"], ["benefits", "What you get"], ["appendix", "Appendix"]];

export const SLIDES = [
  { key: "without", chapter: "problem", kicker: "The problem today", title: "Without a hub", line: "Every interface is its own job: an RMJ schedule, a cron job, a script, a small application. Each carries its own translation, or none." },
  { key: "plain", chapter: "what", kicker: "In plain words", title: "The post office for your data", line: "One place every file, message and call passes through on its way from one system to another. It checks, translates, delivers and writes down what happened." },
  { key: "with", chapter: "how", kicker: "The hub itself", title: "One doorway, four channels", line: "Events, inbound files, APIs and outbound loaders come through one place that validates, translates, reconciles and publishes, and keeps the record." },
  { key: "doors", chapter: "how", kicker: "The four doors", title: "Four doors, one building", line: "Data arrives four ways: a file dropped on a schedule, a message the instant something happens, a system asking a question, and a file BBH sends out. Each has its own door. Behind every door is the same floor." },
  { key: "does", chapter: "how", kicker: "Every movement", title: "Five things, to every movement", line: ROLE.line },
  { key: "governs", chapter: "how", kicker: "Kept under control", title: "One place to change, governed", line: "Contracts, transformations, interface impact and variance live in the hub; Lineage, Impact Analysis and Variance 360 read from it." },
  { key: "benefits", chapter: "benefits", kicker: "What the business gets", title: "Four things change", line: "Each one is a cost you pay today without noticing, because it is spread across many small jobs and many people." },
  { key: "story", chapter: "appendix", kicker: "The story", title: "The Tower and the Hub", line: "An airport that grew one gate at a time, and the control tower that made it an airport. Every part of the picture is a part of the hub." },
];

export default function HubSlides({ t, initial }) {
  const border = t.border || "#d9dee3", sub = t.sub || "#4a5560", text = t.text || "#1a1a1a", panel = t.panel || "#fff";
  const [i, setI] = useState(Math.max(0, Math.min(SLIDES.length - 1, initial?.slide ?? 0)));
  const S = SLIDES[i];
  const Callouts = ({ rows, bad }) => (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${rows.length}, minmax(0,1fr))`, gap: 10, marginTop: 12 }}>
      {rows.map(([h, b]) => (
        <div key={h} style={{ border: `1px solid ${border}`, borderTop: `4px solid ${bad ? RED : TEAL}`, borderRadius: 8, padding: "10px 12px", background: panel }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: bad ? "#8e1b2b" : TEAL }}>{bad ? "✖" : "✔"} {h}</div>
          <div style={{ fontSize: 11, color: sub, marginTop: 3, lineHeight: 1.45 }}>{b}</div>
        </div>))}
    </div>);
  const VERB_LINES = { receive: "events, files, loader requests and API calls, each with a record", validate: "structure, counts and required fields, at the door", translate: "SEI's shapes into BBH's, by one set of versioned rules", reconcile: "rows promised against rows loaded; the date closes only when complete", publish: "one stable shape per consumer: PBDW, Pivotal, IMDS, SEI" };
  const Verbs = () => (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${ROLE.verbs.length}, minmax(0,1fr))` }}>
      {ROLE.verbs.map((v, k) => (
        <div key={v} style={{ padding: "14px 18px 14px 26px", background: k % 2 ? "#15224f" : NAVY, color: "#fff", clipPath: k === ROLE.verbs.length - 1 ? "polygon(0 0, 100% 0, 100% 100%, 0 100%, 12px 50%)" : "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)" }}>
          <div style={{ fontSize: 14, fontWeight: 800, textTransform: "capitalize" }}>{k + 1}. {v}</div>
          <div style={{ fontSize: 10.5, color: "#a9c1de", marginTop: 3, lineHeight: 1.4 }}>{VERB_LINES[v]}</div>
        </div>))}
    </div>);
  const Tiles = ({ rows, cols = 3, icon }) => (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gap: 12, marginTop: 12 }}>
      {rows.map((r) => { const [ic, h, b] = icon ? r : ["", r[0], r[1]]; return (
        <div key={h} style={{ border: `1px solid ${border}`, borderRadius: 10, padding: "14px 16px", background: panel, display: "flex", gap: 12 }}>
          {icon && <div style={{ width: 38, height: 38, borderRadius: 10, background: NAVY, color: "#fff", display: "grid", placeItems: "center", fontSize: 18, flex: "0 0 auto" }}>{ic}</div>}
          <div><div style={{ fontWeight: 700, color: text, fontSize: 13 }}>{h}</div><div style={{ fontSize: 11.5, color: sub, marginTop: 3, lineHeight: 1.45 }}>{b}</div></div>
        </div>); })}
    </div>);
  const nav = (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span role="button" tabIndex={0} aria-label="previous slide" onClick={() => setI(Math.max(0, i - 1))} style={{ fontSize: 12, padding: "5px 11px", borderRadius: 6, border: `1px solid ${border}`, cursor: "pointer", color: text, opacity: i === 0 ? 0.4 : 1 }}>{"◀"}</span>
      {SLIDES.map((s, k) => <span key={s.key} role="tab" aria-selected={k === i} tabIndex={0} onClick={() => setI(k)} title={s.title} style={{ width: k === i ? 22 : 9, height: 9, borderRadius: 9, background: k === i ? NAVY : border, cursor: "pointer", transition: "width .3s" }} />)}
      <span role="button" tabIndex={0} aria-label="next slide" onClick={() => setI(Math.min(SLIDES.length - 1, i + 1))} style={{ fontSize: 12, padding: "5px 11px", borderRadius: 6, border: `1px solid ${border}`, cursor: "pointer", color: text, opacity: i === SLIDES.length - 1 ? 0.4 : 1 }}>{"▶"}</span>
      <span style={{ fontSize: 10.5, color: sub }}>{i + 1} / {SLIDES.length}</span>
    </div>);
  return (
    <div data-slide={S.key} data-chapter={S.chapter} style={{ border: `1px solid ${border}`, borderRadius: 14, background: panel, overflow: "hidden", marginTop: 14 }}>
      <div role="tablist" aria-label="chapters" style={{ display: "grid", gridTemplateColumns: CHAPTERS.map((c) => (c[0] === "appendix" ? "minmax(0,.8fr)" : "minmax(0,1fr)")).join(" "), background: NAVY }}>
        {CHAPTERS.map(([ck, cl], k) => { const on = ck === S.chapter, first = SLIDES.findIndex((x) => x.chapter === ck), n = SLIDES.filter((x) => x.chapter === ck).length; return (
          <span key={ck} role="tab" aria-selected={on} tabIndex={0} onClick={() => setI(first)} data-chapter-tab={ck}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", cursor: "pointer", color: on ? "#fff" : "#8fa3bb", background: on ? "#16224a" : "transparent", borderBottom: `3px solid ${on ? TEAL : "transparent"}`, fontSize: 11.5, fontWeight: on ? 800 : 600, letterSpacing: .4, textTransform: "uppercase" }}>
            <span style={{ width: 18, height: 18, borderRadius: 9, background: on ? TEAL : "#2a3a66", color: "#fff", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 800 }}>{k + 1}</span>{cl}
            <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 600, whiteSpace: "nowrap", color: on ? "#a9c1de" : "#5f6f8f" }}>{n} slide{n === 1 ? "" : "s"}</span>
          </span>); })}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, padding: "18px 22px 12px", borderBottom: `1px solid ${border}` }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: S.chapter === "problem" ? RED : S.chapter === "appendix" ? MUTE : TEAL }}>{CHAPTERS.find((c) => c[0] === S.chapter)[1]} · {S.kicker}</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: text, margin: "2px 0 4px" }}>{S.title}</h2>
          <div style={{ fontSize: 13, color: sub, maxWidth: 820, lineHeight: 1.5 }}>{S.line}</div>
        </div>
        {nav}
      </div>
      <div style={{ padding: "14px 22px 20px" }}>
        {S.key === "story" && (
          <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 14 }}>
            <div>
              <div style={{ border: `1px solid ${border}`, borderRadius: 12, padding: 10, background: "#fff" }}><TowerStory /></div>
              <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 10, background: NAVY, color: "#fff", fontSize: 12.5, lineHeight: 1.5 }}><b>{STORY.close}</b> CP Integration Hub exists for that day.</div>
            </div>
            <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 8, alignContent: "start" }}>
              {STORY.beats.map(([h, b, m], k) => (
                <li key={h} style={{ display: "grid", gridTemplateColumns: "26px 1fr", gap: 8, padding: "8px 10px", border: `1px solid ${border}`, borderRadius: 8, background: panel }}>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 800, color: k === 0 ? RED : TEAL }}>{k + 1}</span>
                  <span><b style={{ fontSize: 12.5, color: text }}>{h}.</b> <span style={{ fontSize: 11.5, color: sub }}>{b}</span>
                    <div style={{ fontSize: 10.5, color: TEAL, marginTop: 2 }}>{"\u2192"} {m}</div></span>
                </li>))}
            </ol>
          </div>)}
        {S.key === "doors" && (
          <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 14 }}>
            <div>
              <div style={{ border: `1px solid ${border}`, borderRadius: 12, padding: 10, background: "#fff" }}><DoorsPicture /></div>
              <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 10, background: NAVY, color: "#fff", fontSize: 12.5, lineHeight: 1.5 }}><b>Why four doors and not one.</b> A nightly file and a message that arrives a thousand times a minute cannot be checked the same way. Each door checks what its traffic needs. What happens after the door is the same for all of them.</div>
            </div>
            <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 8, alignContent: "start" }}>
              {DOORS.map(([plain, tech, when, ex, check, fail], k) => (
                <li key={plain} style={{ display: "grid", gridTemplateColumns: "26px 1fr", gap: 8, padding: "9px 12px", border: `1px solid ${border}`, borderRadius: 8, background: panel }}>
                  <span style={{ width: 20, height: 20, borderRadius: 10, background: TEAL, color: "#fff", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800 }}>{k + 1}</span>
                  <span>
                    <b style={{ fontSize: 13, color: text }}>{plain}</b> <span style={{ fontSize: 11, color: sub }}>({tech})</span>
                    <div style={{ fontSize: 11.5, color: sub, lineHeight: 1.5, marginTop: 2 }}><b style={{ color: TEAL }}>At the door:</b> {check}.</div>
                    <div style={{ fontSize: 11.5, color: sub, lineHeight: 1.5 }}><b style={{ color: "#8e1b2b" }}>If it fails:</b> {fail}.</div>
                  </span>
                </li>))}
            </ol>
          </div>)}
        {S.key === "without" && <><div style={{ border: `1px solid ${RED}55`, borderRadius: 12, padding: 10, background: "#fff" }}><WithoutHub /></div><Callouts rows={WITHOUT_HUB.callouts} bad /></>}
        {S.key === "plain" && (
          <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 14 }}>
            <div>
              <div style={{ border: `1px solid ${border}`, borderRadius: 12, padding: 10, background: "#fff" }}><PlainPicture /></div>
              <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 10, border: `1px solid ${border}`, background: panel, fontSize: 12, color: sub, lineHeight: 1.5 }}>{PLAIN.analogy}</div>
              <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 10, background: NAVY, color: "#fff", fontSize: 12.5, lineHeight: 1.5 }}><b>In one sentence.</b> {PLAIN.close}</div>
            </div>
            <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 8, alignContent: "start" }}>
              {PLAIN.jobs.map(([h, b, m], k) => (
                <li key={h} style={{ display: "grid", gridTemplateColumns: "26px 1fr", gap: 8, padding: "10px 12px", border: `1px solid ${border}`, borderRadius: 8, background: panel }}>
                  <span style={{ width: 20, height: 20, borderRadius: 10, background: TEAL, color: "#fff", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800 }}>{k + 1}</span>
                  <span><b style={{ fontSize: 13, color: text }}>{h}.</b> <span style={{ fontSize: 12, color: sub, lineHeight: 1.5 }}>{b}</span>
                    <div style={{ fontSize: 10.5, color: TEAL, marginTop: 3 }}>{"\u2192"} {m}</div></span>
                </li>))}
              <li style={{ padding: "10px 12px", borderRadius: 8, border: `1px dashed ${TEAL}`, fontSize: 11.5, color: sub, lineHeight: 1.5 }}><b style={{ color: text }}>The tower, again.</b> The tower does not fly the planes. It sees all of them, sequences them, and tells you where each one is and which one is in trouble. The hub does not run the business systems; it moves the data between them and keeps the account.</li>
            </ol>
          </div>)}
        {S.key === "benefits" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
              {BENEFITS.map(([h, today, after], k) => (
                <div key={h} style={{ border: `1px solid ${border}`, borderRadius: 12, overflow: "hidden", background: panel, display: "flex", flexDirection: "column" }}>
                  <div style={{ padding: "12px 14px", background: NAVY, color: "#fff", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 24, height: 24, borderRadius: 12, background: TEAL, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 800 }}>{k + 1}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 800 }}>{h}</span>
                  </div>
                  <div style={{ padding: "10px 14px", borderBottom: `1px solid ${border}` }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: .8, color: "#8e1b2b" }}>TODAY</div>
                    <div style={{ fontSize: 11.5, color: sub, lineHeight: 1.5, marginTop: 2 }}>{today}</div>
                  </div>
                  <div style={{ padding: "10px 14px", background: "#f3f8f7", flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: .8, color: TEAL }}>WITH THE HUB</div>
                    <div style={{ fontSize: 11.5, color: text, lineHeight: 1.5, marginTop: 2 }}>{after}</div>
                  </div>
                </div>))}
            </div>
            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr auto", gap: 14, alignItems: "stretch" }}>
              <div style={{ padding: "14px 16px", borderRadius: 10, background: NAVY, color: "#fff", fontSize: 13, lineHeight: 1.55 }}><b>The message.</b> {PLAIN.close} The pages around it, Integration 360, Lineage, Impact Analysis and Variance 360, are the windows onto that one record.</div>
              <div style={{ padding: "12px 16px", borderRadius: 10, border: `1px solid ${border}`, background: panel, fontSize: 11.5, color: sub, lineHeight: 1.6, minWidth: 240 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: .8, color: TEAL }}>SEE IT RUNNING</div>
                <div>Integration 360 - Run: the day's pipelines</div>
                <div>Error handling tab: each failure, replayed</div>
                <div>Technical view: the design, piece by piece</div>
              </div>
            </div>
          </div>)}
        {S.key === "with" && <><div style={{ border: `1px solid ${TEAL}`, borderRadius: 12, padding: 10, background: "#fff" }}><WithHub /></div><Callouts rows={WITH_HUB.callouts} /></>}
        {S.key === "does" && <><Verbs /><Tiles rows={USES} icon /></>}
        {S.key === "governs" && <><Tiles rows={GOVERNS} cols={4} /><Callouts rows={WITH_HUB.callouts.slice(0, 2).concat([["Governed", "A change to a contract or a rule is reviewed, versioned and tested in the hub before any consumer sees it; Code Review 360 reviews the code, Integration 360 watches the run."], ["Read by the other pages", "Lineage, Impact Analysis, Variance 360 and the Auto Mapper read the hub's rules, so every page gives the same answer."]])} /></>}
      </div>
    </div>);
}
