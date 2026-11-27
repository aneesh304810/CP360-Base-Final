import React, { useState, useEffect, useMemo } from "react";
import { PLAYS, MOOD, MOOD_WORD } from "./hubErrorPlays.js";

// HubErrorPlay: an error scenario as an animated walk through the flow. Pick
// a scenario; a token moves box to box, turns red where it goes wrong, goes
// to the branch box, and comes back once the hub has handled it. The state
// ribbon under the flow lights the registry state as it changes; the
// narration says what happened in one line per frame.

const NAVY = "#10193b", MUTE = "#5c7c94";
const W = 120, GAP = 20, X0 = 20, Y = 40, BY = 150;

export default function HubErrorPlay({ t, initial }) {
  const border = t.border || "#d9dee3", sub = t.sub || "#4a5560", text = t.text || "#1a1a1a", panel = t.panel || "#fff";
  const [pid, setPid] = useState(initial?.play || PLAYS[0].id);
  const play = PLAYS.find((p) => p.id === pid) || PLAYS[0];
  const [frame, setFrame] = useState(initial?.frame ?? 0);
  const [running, setRunning] = useState(initial?.running ?? true);
  const [speed, setSpeed] = useState(1);
  const F = play.frames[Math.min(frame, play.frames.length - 1)];
  const last = frame >= play.frames.length - 1;

  useEffect(() => {
    if (!running || last) return undefined;
    const id = setTimeout(() => setFrame((f) => f + 1), 2200 / speed);
    return () => clearTimeout(id);
  }, [running, frame, last, speed, pid]);
  const pick = (id) => { setPid(id); setFrame(0); setRunning(true); };
  const replay = () => { setFrame(0); setRunning(true); };

  const X = (i) => X0 + i * (W + GAP);
  const pos = useMemo(() => {
    if (typeof F.at === "number") return { x: X(F.at) + W - 12, y: Y + 10 };   // top-right corner, clear of the label
    const name = String(F.at).split(":")[1];
    return { x: X(play.branch[name]) + W - 12, y: BY + 8 };
  }, [F, play]);
  // boxes visited so far in this play, for the trail
  const visited = useMemo(() => { const s = new Set(); play.frames.slice(0, frame + 1).forEach((f) => { if (typeof f.at === "number") s.add(f.at); }); return s; }, [play, frame]);
  const branchLit = useMemo(() => { const s = {}; play.frames.slice(0, frame + 1).forEach((f) => { if (typeof f.at === "string") s[f.at.split(":")[1]] = f.mood; }); return s; }, [play, frame]);
  const failedNode = typeof F.at === "number" && F.mood === "fail" ? F.at : -1;

  return (
    <div data-play={play.id} data-frame={frame}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {PLAYS.map((p) => (
          <span key={p.id} role="tab" tabIndex={0} aria-selected={p.id === pid} onClick={() => pick(p.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") pick(p.id); }}
            style={{ fontSize: 11, fontWeight: 700, padding: "6px 12px", borderRadius: 999, cursor: "pointer", border: `1px solid ${p.id === pid ? NAVY : border}`, background: p.id === pid ? NAVY : panel, color: p.id === pid ? "#fff" : text }}>
            {p.title}</span>))}
      </div>

      <div style={{ border: `1px solid ${border}`, borderRadius: 12, background: panel, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: `1px solid ${border}`, flexWrap: "wrap" }}>
          <b style={{ fontSize: 13, color: text }}>{play.title}</b>
          <span style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: "#eaf1fb", color: "#1168bd" }}>{play.channel === "file" ? "Inbound file" : play.channel === "event" ? "Events" : "Outbound file"}</span>
          <span style={{ fontSize: 10.5, color: sub }}>{play.kind}</span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
            <span role="button" tabIndex={0} onClick={() => setRunning(!running)} aria-pressed={running} style={{ fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 6, background: NAVY, color: "#fff", cursor: "pointer" }}>{running && !last ? "Pause" : last ? "Done" : "Play"}</span>
            <span role="button" tabIndex={0} onClick={replay} style={{ fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 6, border: `1px solid ${border}`, color: text, cursor: "pointer" }}>Replay</span>
            <span role="button" tabIndex={0} onClick={() => setFrame(Math.max(0, frame - 1))} style={{ fontSize: 11, padding: "5px 9px", borderRadius: 6, border: `1px solid ${border}`, color: text, cursor: "pointer" }}>{"◀"}</span>
            <span role="button" tabIndex={0} onClick={() => setFrame(Math.min(play.frames.length - 1, frame + 1))} style={{ fontSize: 11, padding: "5px 9px", borderRadius: 6, border: `1px solid ${border}`, color: text, cursor: "pointer" }}>{"▶"}</span>
            <span role="button" tabIndex={0} onClick={() => setSpeed(speed === 1 ? 2 : 1)} style={{ fontSize: 10.5, padding: "5px 9px", borderRadius: 6, border: `1px solid ${border}`, color: sub, cursor: "pointer" }}>{speed}x</span>
          </span>
        </div>
        <div style={{ fontSize: 11.5, color: sub, padding: "8px 14px 0" }}>{play.summary}</div>

        <svg viewBox="0 0 1000 205" width="100%" style={{ display: "block" }} role="img" aria-label={`${play.title}: the flow with the token at ${typeof F.at === "number" ? play.nodes[F.at] : F.at}`}>
          <defs>
            <marker id="hpArr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={MUTE} /></marker>
          </defs>
          {play.nodes.map((l, i) => {
            const done = visited.has(i), here = typeof F.at === "number" && F.at === i, failed = failedNode === i;
            const stroke = failed ? MOOD.fail : here ? MOOD[F.mood] : done ? MOOD.ok : "#b8c4ce";
            const fill = failed ? "#fae0e2" : here ? `${MOOD[F.mood]}1f` : done ? "#e6f4f2" : "#fff";
            return (
              <g key={l}>
                <rect x={X(i)} y={Y} width={W} height={52} rx="7" fill={fill} stroke={stroke} strokeWidth={here ? 2.6 : 1.4} strokeDasharray={done || here ? undefined : "5 4"} style={{ transition: "all .5s" }} />
                <text x={X(i) + W / 2} y={Y + 30} fontSize="11" fontWeight="700" fill={NAVY} textAnchor="middle">{l.length > 16 ? l.slice(0, 15) + "…" : l}</text>
                {i < play.nodes.length - 1 && <path d={`M${X(i) + W},${Y + 26} L${X(i + 1)},${Y + 26}`} stroke={done && visited.has(i + 1) ? MOOD.ok : "#b8c4ce"} strokeWidth={1.3} markerEnd="url(#hpArr)" fill="none" />}
              </g>);
          })}
          {Object.entries(play.branch).map(([name, at], i) => {
            const mood = branchLit[name], here = typeof F.at === "string" && F.at.endsWith(name);
            const c = mood ? MOOD[mood === "ok" ? "fix" : mood] : "#b8c4ce";
            return (
              <g key={name}>
                <path d={`M${X(at) + W / 2},${Y + 52} L${X(at) + W / 2},${BY}`} stroke={c} strokeWidth={1.3} strokeDasharray="4 4" markerEnd="url(#hpArr)" fill="none" />
                <rect x={X(at)} y={BY} width={W} height={36} rx="7" fill={mood ? `${c}1f` : "#fff"} stroke={c} strokeWidth={here ? 2.6 : 1.4} strokeDasharray={mood ? undefined : "5 4"} style={{ transition: "all .5s" }} />
                <text x={X(at) + W / 2} y={BY + 22} fontSize="11" fontWeight="700" fill={NAVY} textAnchor="middle">{name}</text>
              </g>);
          })}
          {/* the token */}
          <g style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, transition: "transform .7s ease" }}>
            <circle r="11" fill={MOOD[F.mood]} opacity="0.25"><animate attributeName="r" values="11;16;11" dur="1.6s" repeatCount="indefinite" /></circle>
            <circle r="7" fill={MOOD[F.mood]} stroke="#fff" strokeWidth="2" />
          </g>
        </svg>

        {/* state ribbon */}
        <div style={{ display: "flex", gap: 6, padding: "4px 14px 10px", flexWrap: "wrap" }}>
          {play.states.map((s) => (
            <span key={s} data-state={s} data-lit={F.state === s} style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", fontWeight: 700, padding: "3px 9px", borderRadius: 999, transition: "all .4s",
              background: F.state === s ? (/FAIL|QUAR|GAP|UNRESOLVED/.test(s) ? MOOD.fail : /ARCHIVE_FAILED|EXPECTED/.test(s) ? MOOD.wait : MOOD.ok) : "transparent",
              color: F.state === s ? "#fff" : MUTE, border: `1px solid ${F.state === s ? "transparent" : border}` }}>{s}</span>))}
          <span style={{ marginLeft: "auto", fontSize: 10, color: sub }}>registry state</span>
        </div>

        {/* narration */}
        <div data-say style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "center", padding: "12px 14px", borderTop: `1px solid ${border}`, background: `${MOOD[F.mood]}0d` }}>
          <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 999, background: MOOD[F.mood], color: "#fff", textTransform: "uppercase", letterSpacing: 0.4 }}>{MOOD_WORD[F.mood]}</span>
          <span style={{ fontSize: 12.5, color: text, lineHeight: 1.5 }}>{F.say}</span>
          <span style={{ fontSize: 10.5, color: sub, whiteSpace: "nowrap" }}>{frame + 1} / {play.frames.length}</span>
        </div>
        <div style={{ display: "flex", gap: 3, padding: "0 14px 12px" }}>
          {play.frames.map((f, i) => <span key={i} onClick={() => { setFrame(i); setRunning(false); }} style={{ flex: 1, height: 4, borderRadius: 2, cursor: "pointer", background: i <= frame ? MOOD[f.mood] : border, transition: "background .3s" }} />)}
        </div>
      </div>
    </div>);
}
