import React, { useState } from "react";
import { ROLE, USES, GOVERNS } from "./hubBusiness.js";

// HubSlides: the business view as a short presentation. Slide 1 is the world
// without the hub (RMJ schedules, cron jobs, scripts, schedulers and small
// interface applications, each wired point to point with its own translation
// or none). Slide 2 is the hub: ingestion channels, error handling, many
// sources to many destinations, translation and contracts in one governed
// place, so an interface is plug and play. Slides 3 and 4: what it does and
// what it governs.

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
  inside: [["Error handling", "validate at the door · quarantine · retry · replay · held rows"], ["Translation and contracts", "one set of rules, versioned, tested, governed"], ["Record of every movement", "business date · registry · reconciliation · date close"]],
  callouts: [["Plug and play", "A new interface is a configuration row and a contract, not a new job. It arrives on one of four channels the hub already runs."],
    ["One place to change", "A data contract or a transformation changes in the hub, once, under governance. Consumers keep reading a stable shape."],
    ["Many to many", "Any source to any destination through one doorway: SEI and vendors in, PBDW, Pivotal, IMDS and SEI out."],
    ["Errors caught, shown, replayed", "Every channel validates, quarantines or holds with a reason code; Integration 360 shows what, where and why; the play is replayed, never patched by hand."]],
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
  const hubX = 300, hubW = 380, hubY = 14, hubH = 320;
  return (
    <svg viewBox="0 0 980 360" width="100%" style={{ display: "block" }} role="img" aria-label="with the hub: channels in, consumers out, error handling and translation inside">
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
          <rect x={hubX + 16} y={hubY + 108 + i * 56} width={hubW - 32} height={46} rx="6" fill={i === 0 ? "#cc334433" : i === 1 ? "#1168bd44" : "#ffffff14"} stroke={i === 0 ? "#f2a0a8" : i === 1 ? "#8fb8ee" : "#a9c1de66"} />
          <text x={hubX + 28} y={hubY + 127 + i * 56} fontSize="11" fontWeight="700" fill="#fff">{l}</text>
          <text x={hubX + 28} y={hubY + 143 + i * 56} fontSize="8.5" fill="#dbe6f3">{s}</text>
        </g>))}
      <text x={hubX + hubW / 2} y={hubY + hubH - 14} fontSize="9" fill="#8fd3c6" textAnchor="middle" fontWeight="700">plug and play · one place to change · governed</text>
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

export const SLIDES = [
  { key: "story", kicker: "The story", title: "The Tower and the Hub", line: "An airport that grew one gate at a time, and the control tower that made it an airport. Every part of the picture is a part of the hub." },
  { key: "without", kicker: "Today", title: "Without a hub", line: "Every interface is its own job: an RMJ schedule, a cron job, a script, a small application. Each carries its own translation, or none." },
  { key: "with", kicker: "With CP Integration Hub", title: "One doorway, four channels", line: "Events, inbound files, APIs and outbound loaders come through one place that validates, translates, reconciles and publishes, and keeps the record." },
  { key: "does", kicker: "What it does", title: "Five things, to every movement", line: ROLE.line },
  { key: "governs", kicker: "What it governs", title: "One place to change, governed", line: "Contracts, transformations, interface impact and variance live in the hub; Lineage, Impact Analysis and Variance 360 read from it." },
];

export default function HubSlides({ t, initial }) {
  const border = t.border || "#d9dee3", sub = t.sub || "#4a5560", text = t.text || "#1a1a1a", panel = t.panel || "#fff";
  const [i, setI] = useState(Math.max(0, Math.min(SLIDES.length - 1, initial?.slide ?? 0)));
  const S = SLIDES[i];
  const Callouts = ({ rows, bad }) => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10, marginTop: 12 }}>
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
    <div data-slide={S.key} style={{ border: `1px solid ${border}`, borderRadius: 14, background: panel, overflow: "hidden", marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, padding: "18px 22px 12px", borderBottom: `1px solid ${border}` }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: S.key === "without" ? RED : TEAL }}>{S.kicker}</div>
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
        {S.key === "without" && <><div style={{ border: `1px solid ${RED}55`, borderRadius: 12, padding: 10, background: "#fff" }}><WithoutHub /></div><Callouts rows={WITHOUT_HUB.callouts} bad /></>}
        {S.key === "with" && <><div style={{ border: `1px solid ${TEAL}`, borderRadius: 12, padding: 10, background: "#fff" }}><WithHub /></div><Callouts rows={WITH_HUB.callouts} /></>}
        {S.key === "does" && <><Verbs /><Tiles rows={USES} icon /></>}
        {S.key === "governs" && <><Tiles rows={GOVERNS} cols={4} /><Callouts rows={WITH_HUB.callouts.slice(0, 2).concat([["Governed", "A change to a contract or a rule is reviewed, versioned and tested in the hub before any consumer sees it; Code Review 360 reviews the code, Integration 360 watches the run."], ["Read by the other pages", "Lineage, Impact Analysis, Variance 360 and the Auto Mapper read the hub's rules, so every page gives the same answer."]])} /></>}
      </div>
    </div>);
}
