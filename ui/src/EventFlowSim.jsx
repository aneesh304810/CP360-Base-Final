// How a batch actually runs — animated, with the failure paths.
//
// WHAT THIS TAB IS FOR. Every other tab in Event 360 describes the estate
// at rest: which events exist, what they watch, what they cost. None of
// them answers the question everybody actually asks in the room, which is
// "walk me through one". So this one plays a single run from the SWP
// commit to the warehouse, one step at a time, and then plays the five
// ways it goes wrong.
//
// IT IS A WALK-THROUGH OF THE CONTRACT, NOT A TRACE. No number on this
// screen came from a running system; there is no running system yet. That
// distinction is laboured in the banner and in every count, because this
// module's own rule is that an estate which looks populated when it is not
// is the one failure nobody catches. What IS load-bearing is the rules:
// each step cites the SEI answer it comes from, so a reader can tell a
// guarantee from an illustration at a glance.
//
// THE ONE IDEA THE DIAGRAM EXISTS TO CARRY. An event is a notification
// that something changed, and it carries primary keys and an event type —
// not the changed data. Nothing moves until the SEI data consumer goes
// back to Snowflake over JDBC and fetches the rows those keys name. Half
// the questions about volume, ordering and completeness dissolve once that
// is on the screen, and prose has repeatedly failed to put it there.
//
// TWO CLOCKS, NOT ONE. Micro-batch markers bracket a Snowflake commit and
// run many times a day; System Events announce a business milestone in SWP
// and run about once. Neither substitutes for the other, and conflating
// them is the mistake this screen is built to prevent: the boundary tells
// you a commit is whole, the System Event tells you a process has finished,
// and NEITHER tells you how many records to expect.
//
// ANIMATION IS OPT-OUT, NOT DECORATION. Movement is a CSS animation on the
// live edge and node only, disabled under prefers-reduced-motion by a media
// query in the same stylesheet, and autoplay is suppressed for the same
// readers. Every state the animation passes through is reachable by the
// step buttons, so nothing is conveyed by motion alone.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { P, TC } from "./eventPalette.js";

const MONO = P.mono;
const KEY = "234234234232312321-0";

// The SEI answers this screen is built from, so a claim can be traced to
// the sentence that licenses it rather than to whoever drew the boxes.
export const Q = {
  1:  "Marker events do not include record counts, so they cannot be used "
    + "for record-count-based completeness validation.",
  2:  "System Events mark business-process milestones in SWP. Marker events "
    + "bracket a commit boundary in the Snowflake intake.",
  3:  "An MB Start on one domain topic guarantees the same MB Start on every "
    + "other domain topic; an MB End always follows an MB Start; data within "
    + "the boundary keeps the integrity the SWP data model enforces.",
  4:  "There is no required processing order between event types. If "
    + "ordering matters downstream, the listener imposes it.",
  5:  "The stream is at-least-once. Consumers must handle duplicates.",
  6:  "Duplicate events are expected under certain circumstances.",
  7:  "The key field in the payload is the identifier for deduplication.",
  8:  "Events stay on the topic for 7 days by default. To reprocess, move "
    + "the listener's consumer offset back to a chosen offset.",
  9:  "Offsets are continuous within a partition.",
  10: "Retention is 7 days by default, 90 days maximum by configuration.",
  13: "Alert from the System Event SLA. A missing event may mean delayed "
    + "source processing, a delay between the source and SDC, or a failure "
    + "in event generation or publishing.",
  14: "Recovery is by moving the consumer group offset back. Replaying one "
    + "specific System Event needs manual intervention and is not advised.",
  15: "Published events are immutable. An event at an offset cannot be "
    + "updated, replaced, corrected or removed.",
  17: "The catalogue evolves by topic, not by schema version: payload shape "
    + "stays fixed and new capability arrives as a new topic.",
  18: "Schema and contract changes come through PSI release notes; "
    + "emergency fixes are emailed before production deployment.",
  19: "If one domain topic has an issue, fall back to that domain's custom "
    + "view and keep processing. The fallback is per domain, not per "
    + "business date.",
  21: "Peak rate is still to be determined. Validate in Trial, simulating "
    + "month-end, year-end and a busy business day.",
};

/* ===================================================== the graph ===== */
// One layout, every scenario. A step names the node it happens at; the
// edge that lights is inferred from the step before it, so a scenario is
// a list of sentences rather than a list of coordinates.
export const NODES = {
  swp:     { x: 16,  y: 118, w: 84,  h: 46, t: "SWP", s: "OCI · accounting", g: "sei" },
  snow:    { x: 118, y: 118, w: 92,  h: 46, t: "Snowflake", s: "SDC intake", g: "sei" },
  hub:     { x: 228, y: 44,  w: 116, h: 104, t: "SDC Event Hub", s: "5 topics", g: "sei" },
  views:   { x: 228, y: 196, w: 116, h: 48, t: "Custom views", s: "BBH Stage 1 · NRT", g: "sei" },
  listen:  { x: 372, y: 44,  w: 112, h: 40, t: "Event listener", s: "BBH hosted app", g: "bbh" },
  staged:  { x: 372, y: 96,  w: 112, h: 40, t: "Staged IDs", s: "PKs + event type", g: "bbh" },
  consume: { x: 372, y: 148, w: 112, h: 46, t: "SEI data consumer", s: "Python over JDBC", g: "bbh" },
  airflow: { x: 372, y: 206, w: 112, h: 38, t: "Airflow", s: "schedule config", g: "bbh" },
  stg1:    { x: 512, y: 128, w: 96,  h: 46, t: "Stage 1", s: "Bronze · Oracle", g: "bbh" },
  stg2:    { x: 636, y: 128, w: 96,  h: 46, t: "Stage 2", s: "Silver · Oracle", g: "bbh" },
  im:      { x: 790, y: 88,  w: 88,  h: 40, t: "IM Data", s: "", g: "dw" },
  pbdw:    { x: 790, y: 174, w: 88,  h: 40, t: "PB DW", s: "", g: "dw" },
};
export const EDGES = [
  ["swp", "snow"], ["snow", "hub"], ["snow", "views"], ["hub", "listen"],
  ["listen", "staged"], ["staged", "consume"], ["airflow", "consume"],
  ["views", "consume"], ["consume", "stg1"], ["stg1", "stg2"],
  ["stg2", "im"], ["stg2", "pbdw"],
];
// Five topics in the dedicated environment. The names are illustrative —
// a separate System Events topic is in progress and has not been named.
export const TOPICS = ["account", "security", "position", "transaction", "system"];

/* ================================================== the scenarios ==== */
// kind: ok | act | warn | err | ask.  `ask` is an open question — something
// the answers BBH holds do not settle. Those are the most valuable rows on
// the screen and are never dressed up as facts.
const s = (o) => ({ kind: "ok", ...o });

const NORMAL = [
  s({ at: "swp", t: "13:55:10", h: "SWP closes a unit of accounting work",
      d: "Business date 2026-09-15. Nothing has been published yet — this is "
       + "the source system committing its own work." }),
  s({ at: "snow", t: "13:55:10", h: "SDC commits a micro-batch to Snowflake",
      d: "The commit is atomic across domains. Everything that follows is a "
       + "notification about this one commit.", set: { key: KEY } }),
  s({ at: "hub", t: "13:55:10.321", h: "MB Start (1000) on all five topics",
      d: "The same micro-batch key is published to every domain topic, not "
       + "just the ones with data. This is what makes the boundary "
       + "cross-topic rather than per-topic.",
      pay: { eventid: 1000, key: KEY, startTime: "2026-09-26 13:55:10.321 -0400" },
      q: 3, set: { open: 5, closedTopics: [] } }),
  s({ at: "hub", t: "13:55:11-36", h: "Business and technical events land",
      d: "Each one carries primary keys and an event type. None of them "
       + "carries the changed data, and none of them carries a record "
       + "count — so no arithmetic on this screen can prove completeness.",
      q: 1, set: { evts: 2720 } }),
  s({ at: "hub", t: "13:55:11-36", h: "The reference topic receives nothing",
      d: "A topic with no data events in a boundary is complete, not late. "
       + "A consumer that waits for at least one event per topic will wait "
       + "forever on a quiet domain." }),
  s({ at: "hub", t: "13:55:36.712", h: "MB End (1001) closes each topic",
      d: "Same key, one per topic, at different moments. The boundary is "
       + "complete when the LAST topic closes — not the first.",
      pay: { eventid: 1001, key: KEY, endTime: "2026-09-26 13:55:36.712 -0400" },
      q: 3, set: { closedTopics: TOPICS } }),
  s({ at: "listen", t: "13:55:36.9", kind: "act",
      h: "Listener: 5 of 5 closed — boundary accepted",
      d: "Within this boundary the data keeps the integrity the SWP data "
       + "model enforces. That is the completeness guarantee BBH gets, and "
       + "it is a structural one rather than a counted one.", q: 3 }),
  s({ at: "staged", t: "13:55:37", kind: "act",
      h: "Keys deduplicated and staged",
      d: "Every event is checked against the idempotency store on its key "
       + "before its primary keys are staged. The stream is at-least-once, "
       + "so this is not optional.", q: 7, set: { staged: 2714, dups: 6 } }),
  s({ at: "airflow", t: "13:55:40", h: "Airflow releases the consumer",
      d: "Schedule configuration decides when a closed boundary is worked, "
       + "which is also where any required ordering between domains is "
       + "imposed — the stream guarantees none.", q: 4 }),
  s({ at: "consume", t: "13:56:02", kind: "act",
      h: "THE DATA MOVES HERE, AND ONLY HERE",
      d: "The consumer reads the rows those staged keys name from the "
       + "Snowflake custom views over JDBC. Every event so far has been a "
       + "notification; this is the first step that carries a value." }),
  s({ at: "stg1", t: "13:56:48", h: "Stage 1 — Bronze, Oracle",
      d: "Merged on primary key. A duplicate that survived the listener "
       + "still lands once here, which is the second of the two defences "
       + "and the reason neither can be dropped." }),
  s({ at: "stg2", t: "13:58:10", h: "Stage 2 — Silver, Oracle",
      d: "BBH's own transformation. Nothing SEI publishes reaches a report "
       + "without passing through a rule this catalogue records." }),
  s({ at: "im", t: "14:01", h: "IM Data and PB DW",
      d: "One boundary, start to finish, in about six minutes.",
      set: { done: true } }),
  s({ at: "hub", t: "23:14", kind: "act",
      h: "System Event 5 — PRICING COMPLETE, PRICE DATE FLIP",
      d: "A different clock entirely. Pricing and pricing corrections have "
       + "finished in SWP, so pricing data can now be retrieved. This says "
       + "nothing about any micro-batch.",
      pay: { batchDt: "2026-09-15 00:00:00", eventId: 5,
             onlineDt: "2026-09-16 00:00:00" }, q: 2 }),
  s({ at: "hub", t: "23:41", kind: "act",
      h: "System Event 2 — BATCH DATE FLIP, EDB",
      d: "End-of-day position and accrual processing has completed. This is "
       + "the gate for retrieving EOD data — and, like every other event "
       + "here, it carries no record count.",
      pay: { batchDt: "2026-09-15 00:00:00", eventId: 2,
             onlineDt: "2026-09-16 00:00:00" }, q: 1 }),
];

const DUPLICATE = [
  s({ at: "hub", t: "13:55:22", h: "A position event is delivered",
      d: "Key ending -0. Primary keys and an event type, as always.",
      set: { key: KEY, evts: 1 } }),
  s({ at: "staged", t: "13:55:22", kind: "act", h: "Key not seen — staged",
      d: "The idempotency store records the key. This is the first and "
       + "cheapest place a duplicate can be stopped.", set: { staged: 1 } }),
  s({ at: "hub", t: "13:55:29", kind: "warn",
      h: "The identical event arrives again",
      d: "A consumer-group rebalance redelivered it. The stream is "
       + "at-least-once by design, so this is normal traffic and not an "
       + "incident.", q: 5, set: { evts: 2 } }),
  s({ at: "staged", t: "13:55:29", kind: "act", h: "Key already seen — discarded",
      d: "Deduplication is on the payload's key field. Staged IDs are "
       + "unchanged; nothing downstream ever learns this happened.",
      q: 7, set: { dups: 1 } }),
  s({ at: "stg1", t: "13:56:48", h: "And the merge would have caught it anyway",
      d: "Stage 1 merges on primary key, so a duplicate that slipped past "
       + "the listener still lands once. Two defences, deliberately — the "
       + "listener keeps the consumer from fetching the same row twice, the "
       + "merge keeps the warehouse correct if it ever does." }),
  s({ at: "listen", t: "", kind: "ask", h: "Open question: what does a correction look like?",
      d: "Deduplication discards a repeat of a key. A correction to a "
       + "published fact has to arrive as a NEW event, because events are "
       + "immutable — so it must carry a different key, or the listener will "
       + "silently swallow it. The answers BBH holds do not state this. Ask "
       + "before the listener is built, not after.", q: 15 }),
];

const OUTAGE = [
  s({ at: "listen", t: "02:10", kind: "err", h: "The BBH listener stops",
      d: "A host failure. The consumer group's offsets stay where they were "
       + "on every topic.", set: { off: 1204881, down: true } }),
  s({ at: "hub", t: "02:10-06:25", kind: "warn", h: "SEI keeps publishing",
      d: "Nothing is lost. Events stay on the topic for 7 days by default "
       + "and up to 90 by configuration, so the recovery window is days, "
       + "not minutes.", q: 10, set: { evts: 41908 } }),
  s({ at: "listen", t: "06:25", kind: "act", h: "The listener restarts",
      d: "It resumes from the stored offset. Offsets are continuous within "
       + "a partition, so there is no gap to detect and nothing to skip.",
      q: 9, set: { down: false } }),
  s({ at: "hub", t: "06:25-06:52", h: "The backlog replays in order",
      d: "Boundaries close in the order they opened. Four hours of events "
       + "take minutes to read because no data moves — these are "
       + "notifications." }),
  s({ at: "staged", t: "06:25-06:52", kind: "act", h: "Replay is safe because of dedup",
      d: "Every replayed event is a duplicate candidate, and the same key "
       + "check that handles redelivery handles replay. A listener without "
       + "deduplication cannot be restarted safely.", q: 7, set: { dups: 112 } }),
  s({ at: "listen", t: "", kind: "act", h: "If the offset itself were lost",
      d: "Move the consumer group's offset to the chosen point and let it "
       + "run forward. That is the recommended recovery pattern. Replaying "
       + "one specific event on its own needs manual intervention and is "
       + "not advised.", q: 14 }),
  s({ at: "consume", t: "06:55", h: "Downstream catches up",
      d: "Stage 1 and Stage 2 process the recovered boundaries normally. "
       + "Nothing about the outage reaches the warehouse.", set: { done: true } }),
];

const NOEND = [
  s({ at: "hub", t: "13:55:10", h: "MB Start (1000) on all five topics",
      d: "A normal boundary opens.",
      set: { key: KEY, open: 5, closedTopics: [] } }),
  s({ at: "hub", t: "13:55:11+", h: "Data events land as usual",
      d: "Nothing yet distinguishes this from a healthy run.",
      set: { evts: 2720 } }),
  s({ at: "hub", t: "13:56:02", h: "Four topics close",
      d: "MB End arrives on account, security, position and system.",
      set: { closedTopics: ["account", "security", "position", "system"] } }),
  s({ at: "hub", t: "14:25", kind: "err", h: "Transaction never closes",
      d: "Thirty minutes on, there is no MB End for this key on the "
       + "transaction topic." }),
  s({ at: "listen", t: "14:25", kind: "act",
      h: "The boundary stays open — and must",
      d: "A consumer that closes on four of five has read part of a "
       + "transaction and called it whole. Nothing from this boundary may "
       + "be published downstream, however complete the other topics look.",
      q: 3 }),
  s({ at: "listen", t: "14:25", kind: "err", h: "This is an incident, not a state",
      d: "SEI guarantees an MB End always follows an MB Start. So a missing "
       + "end marker is never something to wait out — it means something "
       + "broke.", q: 3 }),
  s({ at: "listen", t: "14:25", kind: "act", h: "Alert on the SLA, then call",
      d: "Likely causes: delayed source processing from maintenance or an "
       + "SWP release, a delay between the source and SDC, or a failure in "
       + "generation or publishing. BBH monitors its own SLA rather than "
       + "waiting to be told.", q: 13 }),
  s({ at: "staged", t: "", kind: "warn", h: "Meanwhile the keys sit staged",
      d: "Held, unpublished, and visible. Build the queue so an operator "
       + "can see exactly which boundary is stuck and since when." }),
];

const DOMAIN = [
  s({ at: "hub", t: "09:00", kind: "err", h: "The security topic stops delivering",
      d: "One domain. Account, position, transaction and system are "
       + "unaffected." }),
  s({ at: "listen", t: "09:00", kind: "act", h: "Do not stop the business date",
      d: "The fallback is per domain, not per business date. Everything "
       + "else keeps running on events.", q: 19 }),
  s({ at: "views", t: "09:05", kind: "act", h: "Read the security custom view instead",
      d: "The custom views are structured like the EOD files, so the "
       + "fallback path is one BBH already knows how to load.", q: 19 }),
  s({ at: "hub", t: "09:05", h: "Use the System Event view to time it",
      d: "It confirms the milestone — EOD started, EOD complete — so the "
       + "pull happens after the data is actually there rather than on a "
       + "guess.", q: 19 }),
  s({ at: "consume", t: "09:20", h: "Stage 1 loads from the view for that domain",
      d: "Same target tables, different source. Downstream never sees the "
       + "difference." }),
  s({ at: "hub", t: "15:40", kind: "act", h: "The topic recovers",
      d: "Rewind the consumer offset to the last boundary that closed "
       + "cleanly and resume event-driven processing. The overlap is safe "
       + "because of deduplication.", q: 8, set: { dups: 318, done: true } }),
];

const IMMUTABLE = [
  s({ at: "hub", t: "11:02", kind: "warn", h: "A published event was wrong",
      d: "It named a key that should not have changed. It is already at an "
       + "offset in a partition.", set: { off: 1204902 } }),
  s({ at: "hub", t: "", kind: "err", h: "It cannot be fixed in place",
      d: "Every event published to the SDC Event Hub is immutable. An event "
       + "at an offset cannot be updated, replaced, corrected or removed — "
       + "there is no edit, and no delete.", q: 15 }),
  s({ at: "hub", t: "11:40", kind: "act", h: "The correction is a new event",
      d: "It arrives later, at a higher offset. So a consumer has to resolve "
       + "by position in the partition, never by what it saw first.", q: 15 }),
  s({ at: "listen", t: "", kind: "ask", h: "Open question: dedup versus correction",
      d: "If the correction repeats the key, the listener's deduplication "
       + "discards it. If it carries a new key, deduplication is safe but "
       + "the listener needs a rule for superseding what it already staged. "
       + "BBH needs one sentence from SEI here, and does not have it.",
      q: 7 }),
  s({ at: "hub", t: "", h: "The payload shape itself never changes",
      d: "The catalogue evolves by topic, not by schema version: new "
       + "capability arrives as a new topic with the same payload format, so "
       + "existing integrations are not versioned out from under BBH.",
      q: 17 }),
  s({ at: "snow", t: "", h: "Where changes are announced",
      d: "Snowflake domain view schema and contract changes come through PSI "
       + "release notes; emergency fixes are emailed before they reach "
       + "production. Neither arrives on a topic.", q: 18 }),
];

export const SCENARIOS = [
  { k: "normal", n: "A normal run", c: P.ok,
    b: "One micro-batch from the SWP commit to the warehouse, then the two "
     + "System Events that close the day.", steps: NORMAL },
  { k: "dup", n: "Duplicate delivery", c: TC.Business,
    b: "At-least-once means the same event twice. Where it is stopped, and "
     + "what catches it if that fails.", steps: DUPLICATE },
  { k: "outage", n: "Outage and replay", c: P.warn,
    b: "BBH is down for four hours. What is lost, how far back it can be "
     + "recovered, and why replay needs deduplication.", steps: OUTAGE },
  { k: "noend", n: "No end marker", c: P.danger,
    b: "Four topics of five close. The boundary must not be accepted, and "
     + "the gap is an incident rather than a wait.", steps: NOEND },
  { k: "domain", n: "One topic down", c: P.warn,
    b: "A single domain stops delivering. Fall back to its custom view "
     + "without stopping the business date.", steps: DOMAIN },
  { k: "immutable", n: "A wrong event", c: P.danger,
    b: "Published events cannot be corrected. What a fix actually looks "
     + "like, and the question it raises for the listener.", steps: IMMUTABLE },
];

export const KIND = {
  ok:   { c: P.sub,    l: "" },
  act:  { c: P.accent, l: "BBH acts" },
  warn: { c: P.warn,   l: "Expected, handle it" },
  err:  { c: P.danger, l: "Failure" },
  ask:  { c: "#7c3aed", l: "Open question" },
};

// prefers-reduced-motion, read once. Under SSR there is no matchMedia, and
// the honest default there is "no motion" rather than a crash.
function useReducedMotion() {
  const [r, setR] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setR(Boolean(m.matches));
    read();
    if (m.addEventListener) { m.addEventListener("change", read);
      return () => m.removeEventListener("change", read); }
    return undefined;
  }, []);
  return r;
}

const edgeId = (a, b) => `${a}>${b}`;
const findEdge = (a, b) =>
  EDGES.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
    ? edgeId(a, b) : null;

export default function EventFlowSim() {
  const [sk, setSk] = useState("normal");
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ms, setMs] = useState(2200);
  const [showQ, setShowQ] = useState(false);
  const reduced = useReducedMotion();
  const listRef = useRef(null);
  const started = useRef(false);

  const sc = SCENARIOS.find((x) => x.k === sk) || SCENARIOS[0];
  const steps = sc.steps;
  const last = steps.length - 1;

  // Autoplay once on mount, and never for a reader who asked for no
  // motion. Switching scenario rewinds but does not start playing: a
  // screen that starts moving every time you click a tab is unusable.
  useEffect(() => {
    if (started.current || reduced) return;
    started.current = true;
    setPlaying(true);
  }, [reduced]);

  useEffect(() => { setI(0); setPlaying(false); }, [sk]);

  useEffect(() => {
    if (!playing) return undefined;
    if (i >= last) { setPlaying(false); return undefined; }
    const h = setTimeout(() => setI((n) => Math.min(n + 1, last)), ms);
    return () => clearTimeout(h);
  }, [playing, i, last, ms]);

  const step = steps[i] || steps[0];
  const prev = i > 0 ? steps[i - 1] : null;
  const live = prev ? findEdge(prev.at, step.at) : null;

  // Everything the counters show is folded from the steps played so far,
  // so scrubbing backwards is exact rather than approximate.
  const st = useMemo(() => {
    const acc = { key: null, open: 0, closed: 0, evts: 0, staged: 0, dups: 0,
                  off: null, down: false, done: false };
    for (let n = 0; n <= i && n < steps.length; n++)
      Object.assign(acc, steps[n].set || {});
    return acc;
  }, [steps, i]);

  // Which nodes have been visited, for the trail behind the live one.
  const seen = useMemo(() => {
    const m = new Set();
    for (let n = 0; n < i; n++) m.add(steps[n].at);
    return m;
  }, [steps, i]);

  useEffect(() => {
    const el = listRef.current && listRef.current.querySelector('[data-cur="1"]');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
  }, [i]);

  const card = { background: P.panel, border: `1px solid ${P.rule}`,
    borderRadius: 6, padding: "14px 16px", marginBottom: 14 };
  const eyebrow = { fontSize: 9.5, fontWeight: 700, letterSpacing: .5,
    textTransform: "uppercase", color: P.sub };
  const btn = (on) => ({ font: "inherit", fontSize: 11.5, fontWeight: 600,
    padding: "6px 13px", borderRadius: 4, cursor: "pointer",
    border: `1px solid ${on ? P.accent : P.rule}`,
    background: on ? P.accent : "#fff", color: on ? "#fff" : P.ink });

  return (
    <div>
      <style>{CSS}</style>

      {/* The banner is not boilerplate. Every other tab in this module is
          fed from the catalogue and refuses to render when it is empty;
          this one is hand-written, so it has to say so before it says
          anything else. */}
      <div style={{ ...card, borderLeft: `3px solid ${P.accent}`,
        background: P.tint }}>
        <div style={{ ...eyebrow, color: P.accent }}>
          A walk-through, not a trace</div>
        <p style={{ fontSize: 12.5, lineHeight: 1.6, margin: "6px 0 0",
          maxWidth: "88ch", color: P.ink }}>
          No number on this screen came from a running system — there is not
          one yet. Times, counts and offsets are illustrative. What is
          load-bearing is the <b>rules</b>: every step that depends on a
          guarantee cites the SEI answer it comes from, so a reader can tell
          a commitment from an illustration without asking.{" "}
          <button type="button" onClick={() => setShowQ((v) => !v)}
            style={{ font: "inherit", fontSize: 12.5, border: 0, padding: 0,
              background: "none", color: P.accent, cursor: "pointer",
              textDecoration: "underline" }}>
            {showQ ? "Hide the answers" : "Read the answers this is built from"}
          </button>
        </p>
        {showQ && (
          <div style={{ marginTop: 11, borderTop: `1px solid ${P.rule}`,
            paddingTop: 10 }}>
            {Object.keys(Q).map((n) => (
              <div key={n} style={{ display: "flex", gap: 10, padding: "4px 0",
                fontSize: 12, lineHeight: 1.55, color: P.sub }}>
                <b style={{ color: P.accent, flexShrink: 0, minWidth: 18 }}>
                  {n}</b><span>{Q[n]}</span>
              </div>))}
            <div style={{ fontSize: 11, color: P.sub, marginTop: 8 }}>
              Source: SEI responses to BBH event-processing questions.
              Numbering follows that document.
            </div>
          </div>)}
      </div>

      {/* scenario picker */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap",
        marginBottom: 12 }}>
        {SCENARIOS.map((x) => (
          <button key={x.k} type="button" onClick={() => setSk(x.k)}
            aria-pressed={sk === x.k}
            style={{ ...btn(sk === x.k), display: "flex", gap: 7,
              alignItems: "center" }}>
            <i style={{ width: 8, height: 8, borderRadius: 2,
              background: sk === x.k ? "#fff" : x.c }} />{x.n}</button>))}
      </div>
      <p style={{ fontSize: 12.5, color: P.sub, margin: "0 0 14px",
        maxWidth: "88ch", lineHeight: 1.6 }}>{sc.b}</p>

      <div style={card}>
        <Diagram live={live} at={step.at} seen={seen} st={st}
          reduced={reduced} playing={playing} />
        <Legend />
      </div>

      {/* transport */}
      <div style={{ display: "flex", gap: 8, alignItems: "center",
        flexWrap: "wrap", marginBottom: 12 }}>
        <button type="button" onClick={() => { if (i >= last) setI(0);
            setPlaying((v) => !v); }}
          style={{ ...btn(playing), minWidth: 86 }}>
          {playing ? "Pause" : i >= last ? "Replay" : "Play"}</button>
        <button type="button" onClick={() => { setPlaying(false);
            setI((n) => Math.max(0, n - 1)); }} disabled={i === 0}
          style={{ ...btn(false), opacity: i === 0 ? .45 : 1 }}>Back</button>
        <button type="button" onClick={() => { setPlaying(false);
            setI((n) => Math.min(last, n + 1)); }} disabled={i >= last}
          style={{ ...btn(false), opacity: i >= last ? .45 : 1 }}>Step</button>
        <button type="button" onClick={() => { setPlaying(false); setI(0); }}
          style={btn(false)}>Restart</button>
        <label style={{ fontSize: 11.5, color: P.sub, display: "flex",
          gap: 7, alignItems: "center", marginLeft: 6 }}>
          speed
          <input type="range" min="700" max="4000" step="100" value={ms}
            onChange={(e) => setMs(Number(e.target.value))}
            aria-label="Seconds between steps" style={{ width: 110 }} />
        </label>
        <span style={{ marginLeft: "auto", fontSize: 11.5, color: P.sub }}>
          step {i + 1} of {steps.length}</span>
      </div>

      {reduced && (
        <p style={{ fontSize: 11.5, color: P.sub, margin: "-4px 0 12px" }}>
          Your system asks for reduced motion, so nothing moves and nothing
          auto-plays. Step and Play still work, and every state the animation
          would pass through is reachable from the buttons.
        </p>)}

      <div style={{ display: "grid", gap: 14,
        gridTemplateColumns: "minmax(0,1.55fr) minmax(250px,1fr)" }}>
        <div>
          <Current step={step} />
          <div ref={listRef} style={{ ...card, padding: 0, marginBottom: 0,
            maxHeight: 340, overflow: "auto" }}>
            {steps.map((x, n) => (
              <button key={n} type="button" data-cur={n === i ? "1" : "0"}
                onClick={() => { setPlaying(false); setI(n); }}
                style={{ display: "block", width: "100%", textAlign: "left",
                  font: "inherit", cursor: "pointer", border: 0,
                  borderTop: n ? `1px solid ${P.rule}` : 0,
                  padding: "9px 14px", color: P.ink,
                  background: n === i ? P.tint : n < i ? "#fbfdfe" : "#fff",
                  opacity: n > i ? .5 : 1 }}>
                <span style={{ display: "flex", gap: 9, alignItems: "baseline" }}>
                  <i style={{ width: 7, height: 7, borderRadius: "50%",
                    flexShrink: 0, background: KIND[x.kind].c }} />
                  <span style={{ fontFamily: MONO, fontSize: 10,
                    color: P.sub, minWidth: 68, flexShrink: 0 }}>
                    {x.t || "—"}</span>
                  <span style={{ fontSize: 12.5,
                    fontWeight: n === i ? 600 : 400 }}>{x.h}</span>
                </span>
              </button>))}
          </div>
        </div>
        <div>
          <State st={st} sk={sk} />
          <Limits />
        </div>
      </div>
    </div>);
}

/* ======================================================= the parts === */
// Keyframes have to live in a stylesheet — an inline style cannot hold
// one. The reduced-motion query sits in the SAME sheet as the animations
// it disables, so the opt-out cannot be shipped separately from the thing
// it opts out of.
const CSS = `
@keyframes cp360efFlow { to { stroke-dashoffset: -24; } }
@keyframes cp360efPulse { 0%,100% { opacity: 1 } 50% { opacity: .45 } }
.cp360ef-live { stroke-dasharray: 7 5; animation: cp360efFlow .75s linear infinite; }
.cp360ef-node { animation: cp360efPulse 1.3s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .cp360ef-live, .cp360ef-node { animation: none; }
}`;

export function path(a, b) {
  const A = NODES[a], B = NODES[b];
  if (!A || !B) return "";
  const ay = A.y + A.h / 2, by = B.y + B.h / 2;
  const ax = A.x + A.w / 2, bx = B.x + B.w / 2;
  if (Math.abs(ax - bx) < 10) {
    const down = by > ay;
    return `M${ax},${down ? A.y + A.h : A.y} L${bx},${down ? B.y : B.y + B.h}`;
  }
  const right = bx > ax;
  const x1 = right ? A.x + A.w : A.x;
  const x2 = right ? B.x : B.x + B.w;
  if (Math.abs(ay - by) < 10) return `M${x1},${ay} L${x2},${by}`;
  const mx = (x1 + x2) / 2;
  return `M${x1},${ay} L${mx},${ay} L${mx},${by} L${x2},${by}`;
}

export function Diagram({ live, at, seen, st, reduced, playing }) {
  const closed = new Set(st.closedTopics || []);
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox="0 0 892 262" role="img"
        style={{ width: "100%", height: "auto", display: "block" }}
        aria-label={"SWP commits to Snowflake. The SDC Event Hub publishes "
          + "notifications on five topics and also exposes custom views. "
          + "BBH's event listener stages primary keys, Airflow releases the "
          + "SEI data consumer, and that consumer fetches the rows over "
          + "JDBC into Stage 1, Stage 2 and then IM Data and PB DW."}>

        <rect x="4" y="4" width="352" height="254" rx="6" fill="#f7fafc"
          stroke={P.rule} strokeDasharray="4 3" />
        <text x="14" y="20" fontSize="10" fontWeight="700" fill={P.sub}
          letterSpacing="0.6">SEI</text>
        <rect x="364" y="4" width="384" height="254" rx="6" fill="#f7fafc"
          stroke={P.rule} strokeDasharray="4 3" />
        <text x="374" y="20" fontSize="10" fontWeight="700" fill={P.sub}
          letterSpacing="0.6">BBH INTEGRATION HUB</text>

        {EDGES.map(([a, b]) => {
          const id = edgeId(a, b), rid = edgeId(b, a);
          const on = live === id || live === rid;
          return (
            <path key={id} d={path(a, b)} fill="none"
              className={on && !reduced && playing ? "cp360ef-live" : undefined}
              stroke={on ? P.accent : P.rule} strokeWidth={on ? 2.2 : 1.2} />);
        })}

        {Object.entries(NODES).map(([id, n]) => {
          const on = at === id, been = seen.has(id);
          const fill = on ? "#fff" : been ? "#fbfdfe" : "#fff";
          const edge = on ? P.accent : been ? P.sub : P.rule;
          return (
            <g key={id} className={on && !reduced && playing ? "cp360ef-node" : undefined}>
              <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="4"
                fill={fill} stroke={edge} strokeWidth={on ? 2.2 : 1} />
              <text x={n.x + n.w / 2} y={n.y + (n.s ? 18 : 25)} fontSize="10.5"
                textAnchor="middle" fill={P.ink}
                fontWeight={on ? 700 : 500}>{n.t}</text>
              {n.s && (
                <text x={n.x + n.w / 2} y={n.y + 30} fontSize="8.5"
                  textAnchor="middle" fill={P.sub}>{n.s}</text>)}
              {id === "hub" && TOPICS.map((tp, k) => (
                <g key={tp}>
                  <rect x={n.x + 8} y={n.y + 38 + k * 12} width={n.w - 16}
                    height="10" rx="2"
                    fill={closed.has(tp) ? TC.Marker : P.rule}
                    opacity={closed.has(tp) ? 0.9 : 0.5} />
                  <text x={n.x + 12} y={n.y + 46 + k * 12} fontSize="7"
                    fill={closed.has(tp) ? "#fff" : P.sub}>{tp}</text>
                </g>))}
            </g>);
        })}

        {/* The sentence the boxes exist to carry. */}
        <text x="498" y="252" fontSize="9" fill={P.sub} textAnchor="middle">
          events carry keys · the consumer fetches the data</text>
      </svg>
    </figure>);
}

function Legend() {
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8,
      fontSize: 10.5, color: P.sub, alignItems: "center" }}>
      <span><i style={{ display: "inline-block", width: 10, height: 10,
        borderRadius: 2, background: TC.Marker, marginRight: 5,
        verticalAlign: -1 }} />topic closed for this boundary</span>
      <span><i style={{ display: "inline-block", width: 10, height: 10,
        borderRadius: 2, background: P.rule, marginRight: 5,
        verticalAlign: -1 }} />still open</span>
      <span style={{ marginLeft: "auto" }}>
        Five topics in the dedicated BBH environment. The names are
        illustrative; a separate System Events topic is in progress and has
        not been named.</span>
    </div>);
}

export function Current({ step }) {
  const k = KIND[step.kind];
  return (
    <div style={{ background: P.panel, border: `1px solid ${P.rule}`,
      borderLeft: `3px solid ${k.c}`, borderRadius: 6, padding: "13px 16px",
      marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "baseline",
        flexWrap: "wrap" }}>
        {step.t && <span style={{ fontFamily: MONO, fontSize: 11,
          color: P.sub }}>{step.t}</span>}
        {k.l && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: .5,
          textTransform: "uppercase", color: "#fff", background: k.c,
          padding: "2px 7px", borderRadius: 999 }}>{k.l}</span>}
      </div>
      <div style={{ fontSize: 14.5, fontWeight: 600, margin: "6px 0 5px" }}>
        {step.h}</div>
      <p style={{ fontSize: 12.5, lineHeight: 1.6, color: P.sub, margin: 0,
        maxWidth: "80ch" }}>{step.d}</p>
      {step.pay && (
        <pre style={{ fontFamily: MONO, fontSize: 11, lineHeight: 1.55,
          background: P.page, border: `1px solid ${P.rule}`, borderRadius: 4,
          padding: "9px 12px", margin: "10px 0 0", overflow: "auto" }}>
{JSON.stringify(step.pay, null, 2)}</pre>)}
      {step.q && (
        <div style={{ fontSize: 11.5, color: P.sub, marginTop: 10,
          paddingTop: 8, borderTop: `1px solid ${P.rule}`, lineHeight: 1.55 }}>
          <b style={{ color: P.accent }}>SEI answer {step.q}.</b> {Q[step.q]}
        </div>)}
    </div>);
}

export function State({ st, sk }) {
  const closed = (st.closedTopics || []).length;
  const rows = [
    ["Boundary key", st.key || "—", true],
    ["Topics closed", st.open ? `${closed} of ${st.open}` : "—", false],
    ["Events seen", st.evts ? num(st.evts) : "—", false],
    ["Keys staged", st.staged ? num(st.staged) : "—", false],
    ["Duplicates discarded", st.dups ? num(st.dups) : "0", false],
    ["Consumer offset", st.off ? num(st.off) : "—", true],
  ];
  const bad = sk === "noend" && st.open && closed < st.open;
  return (
    <div style={{ background: P.panel, border: `1px solid ${P.rule}`,
      borderRadius: 6, padding: "13px 16px", marginBottom: 14 }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: .5,
        textTransform: "uppercase", color: P.sub, marginBottom: 8 }}>
        Listener state</div>
      {rows.map(([l, v, m]) => (
        <div key={l} style={{ display: "flex", gap: 10, padding: "4px 0",
          fontSize: 12, borderTop: `1px solid #eef2f5` }}>
          <span style={{ color: P.sub, flex: 1 }}>{l}</span>
          <span style={{ fontFamily: m ? MONO : "inherit",
            fontSize: m ? 10.5 : 12, textAlign: "right",
            wordBreak: "break-all" }}>{v}</span>
        </div>))}
      <div style={{ marginTop: 10, fontSize: 11.5, lineHeight: 1.5,
        padding: "8px 11px", borderRadius: 4,
        background: st.down ? "#fdeaee" : bad ? "#fdf1dc"
          : st.done ? "#e8f6ed" : P.page,
        color: st.down ? P.danger : bad ? P.warnInk
          : st.done ? "#12713a" : P.sub }}>
        {st.down ? "Listener down. Offsets held; nothing lost."
          : bad ? "Boundary incomplete — publish nothing from it."
          : st.done ? "Boundary accepted and loaded."
          : "Running."}
      </div>
    </div>);
}

export function Limits() {
  const items = [
    ["No record counts, anywhere", "Neither System Events nor Business "
      + "Events carry one, so completeness can never be arithmetic. It is "
      + "the micro-batch boundary plus the SWP data model, or it is "
      + "nothing.", 1],
    ["No guaranteed processing order", "If accounts and securities must "
      + "land before transactions, BBH's listener enforces that. The stream "
      + "does not.", 4],
    ["No data in the payload", "Primary keys and an event type. Every row "
      + "BBH loads is fetched afterwards from the custom views over JDBC.", null],
    ["No volume or peak figure yet", "Sizing is still open. Validate in "
      + "Trial, and simulate month-end, year-end and a busy business day "
      + "rather than an average one.", 21],
    ["Recovery is bounded by retention", "7 days by default, 90 at most by "
      + "configuration. That, not the listener, sets how long an outage can "
      + "last before data is unrecoverable from the topic.", 10],
  ];
  return (
    <div style={{ background: P.panel, border: `1px solid ${P.rule}`,
      borderLeft: `3px solid ${P.warn}`, borderRadius: 6,
      padding: "13px 16px" }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: .5,
        textTransform: "uppercase", color: P.warnInk, marginBottom: 4 }}>
        What the events cannot tell you</div>
      <p style={{ fontSize: 11.5, color: P.sub, margin: "0 0 8px",
        lineHeight: 1.5 }}>
        The five limits that change a design decision, rather than the ones
        that are merely true.</p>
      {items.map(([h, d, q]) => (
        <div key={h} style={{ padding: "8px 0",
          borderTop: `1px solid #eef2f5` }}>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>{h}</div>
          <div style={{ fontSize: 11.5, color: P.sub, lineHeight: 1.55,
            marginTop: 2 }}>
            {d}{q ? <span style={{ color: P.accent }}> · answer {q}</span> : null}
          </div>
        </div>))}
    </div>);
}

const num = (n) => (n == null ? "—" : Number(n).toLocaleString("en-US"));
