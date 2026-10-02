import React, { useState, useEffect, useMemo } from "react";
import { classifyLink, summarise, linkRule } from "./linkOps.js";
import { explainRule } from "./plainRule.js";
import { starUsage } from "./seiCrosswalkApi.js";
import { catalogApi, useBusinessCatalog, bizName } from "./businessCatalog.js";

// Source view · the reading view. Sentences, not wires.
//
// THE CANVAS ANSWERS A DIFFERENT QUESTION. "How is this wired" is what a
// data engineer asks, and the ribbons answer it well. A business user is
// asking "where does my number come from, and did anything happen to it
// on the way" — and for that, a picture you have to trace with your eye
// is worse than a line of English.
//
// IT IS THE SAME DATA AND THE SAME CLASSIFIER. Every row here is built
// from classifyLink and explainRule, which the canvas and the chips also
// read. A reading view that computed "changed" its own way would
// eventually disagree with the picture beside it, and then neither could
// be trusted.
//
// WHAT IT LEADS WITH. Two numbers a business reader can act on: how many
// fields CHANGE on the way, because those are the ones that will not tie
// out against the source, and how many nothing READS. Everything else on
// the screen is reassurance, and reassurance goes below the fold.

const C = {
  ink: "#233240", sub: "#5b6773", faint: "#8793a0", rule: "#d9e0e6",
  panel: "#fff", page: "#f5f8f8", accent: "#0f4775",
  same: "#1a8f4c", changed: "#8a6d1f", changedBg: "#fdf1dc",
  unread: "#4a5560", unreadBg: "#eef2f5", pii: "#9e1130", piiBg: "#fdeaee",
};

const pc = (n, d) => (d ? Math.round((n / d) * 100) : 0);
const UP = (s) => String(s ?? "").trim().toUpperCase();

/* Business terms for every table this feed lands in.
 *
 * useFieldTerms is deliberately ONE table: the column page asks about one
 * table and nothing else. A feed lands in several, so this asks for each
 * and merges. The merge keeps a TABLE|COLUMN key as well as a bare COLUMN
 * one, because the same column name in two tables can carry two terms and
 * the row knows which table it belongs to — the bare key is only the
 * fallback for a family row, which has no single table.
 *
 * Unlike termName this returns NULL when a column has no term. termName
 * falls back to the column name, which is the right answer for a label and
 * the wrong one for "did the dictionary name this", and a caller writing
 * `termName(a) || termName(b)` silently never reaches b. */
function useTargetTerms(tableKey, ds) {
  const [by, setBy] = useState({});
  useEffect(() => {
    const tables = tableKey ? tableKey.split("\u0001") : [];
    if (!tables.length) { setBy({}); return; }
    let live = true;
    Promise.all(tables.map((tb) => catalogApi.fields(tb, ds))).then((rs) => {
      if (!live) return;
      const m = {};
      rs.forEach((r, i) => (r.fields || []).forEach((f) => {
        const col = UP(f.dwh_target_column);
        const term = String(f.business_term || "").trim();
        if (!col || !term) return;
        m[`${UP(tables[i])}|${col}`] = term;
        if (!m[col]) m[col] = term;
      }));
      setBy(m);
    });
    return () => { live = false; };
  }, [tableKey, ds]);
  return by;
}

/* One field, as a sentence. The verb comes from the classifier, so this
   can never describe an operation the chips call something else. */
function sentenceFor(col, op) {
  const rule = linkRule(col);
  const ex = explainRule(rule, { hasSource: !!col.src, target: col.col });
  const real = (ex.steps || []).filter((s) => s.op && s.op !== "direct");
  if (!col.src) return "is produced by the warehouse — nothing in the feed supplies it";
  if (!real.length) return "arrives, and lands unchanged";
  if (real.length === 1) {
    const s = real[0];
    const what = String(s.what || "").replace(/\s+/g, " ").trim();
    // explainRule writes full sentences; splice the first clause in so the
    // row reads as one line rather than two.
    const first = what.split(". ")[0].replace(/\.$/, "");
    return `arrives, then ${first.charAt(0).toLowerCase()}${first.slice(1)}`;
  }
  return `arrives, then passes through ${real.length} steps before it lands`;
}

export default function SourceReading({ t, data, feedName, dataSource,
                                        onOpenTarget }) {
  const ds = (dataSource || "PBDW").toUpperCase();
  const [q, setQ] = useState("");
  const [only, setOnly] = useState("all");   // all | changed | unread
  const [open, setOpen] = useState(null);    // the expanded field key
  const [usage, setUsage] = useState(null);

  const byTable = useBusinessCatalog(ds);
  // A string, not an array: a fresh array every render would refetch the
  // dictionary on every keystroke in the search box.
  const tableKey = useMemo(
    () => (data?.targets || []).map((tg) => tg.table).filter(Boolean)
            .join("\u0001"), [data]);
  const terms = useTargetTerms(tableKey, ds);
  const term = (table, col) =>
    terms[`${UP(table)}|${UP(col)}`] || terms[UP(col)] || null;

  // Usage is a separate read, and its absence is not an error: the chips
  // simply do not appear. STAR_FIELD_USAGE is loaded per lane and a
  // warehouse without it is a normal state, not a broken screen.
  useEffect(() => {
    let live = true;
    starUsage.fields(ds, null, null, 5000)
      .then((r) => { if (!live) return;
        const m = new Map();
        (r.fields || []).forEach((f) => {
          const k = String(f.field_name || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
          if (k && !m.has(k)) m.set(k, f.is_used);
        });
        setUsage(m);
      })
      .catch(() => setUsage(null));
    return () => { live = false; };
  }, [ds]);

  /* Every column across every target, flattened and classified once. */
  const rows = useMemo(() => {
    const out = [];
    (data?.targets || []).forEach((tg) => {
      (tg.cols || []).forEach((c) => {
        const op = c.__op || classifyLink(c);
        const key = String(c.src || c.col || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        // The ordinal suffix again: the usage matrix has no _10 on the end.
        const stripped = key.replace(/[0-9]+$/, "");
        const used = usage ? (usage.get(key) ?? usage.get(stripped) ?? null) : null;
        out.push({
          ...c, __op: op, table: tg.table,
          group: tg.functional_group || "Ungrouped",
          // The dictionary names warehouse columns, so the term is looked
          // up on the target. Where there is none the physical column name
          // stands: a prettified guess reads like a business name and is
          // not one.
          name: term(tg.table, c.col) || c.col,
          sentence: sentenceFor(c, op),
          used,
          id: `${tg.table}.${c.col}`,
        });
      });
    });
    return out;
  }, [data, terms, usage]);

  const sum = useMemo(() => summarise(rows), [rows]);
  const unread = rows.filter((r) => r.used === "N").length;
  // Distinct feed fields, not column links. One field landing in three
  // tables is three links and one piece of information, and the lead
  // sentence is about the second of those.
  const srcCount = useMemo(
    () => new Set(rows.map((r) => r.src).filter(Boolean)).size, [rows]);

  /* Repeats collapse. ACCOUNT_LONG_NAME_1…_5 is one thing five times, and
     five rows of it push everything that matters below the fold. They are
     folded only when they agree — a group where one member is transformed
     and the others are not is NOT the same thing five times, and gets its
     rows back. */
  const grouped = useMemo(() => {
    const byGroup = new Map();
    rows.forEach((r) => {
      if (!byGroup.has(r.group)) byGroup.set(r.group, []);
      byGroup.get(r.group).push(r);
    });
    const out = [];
    for (const [group, list] of byGroup) {
      const fams = new Map();
      list.forEach((r) => {
        const stem = String(r.col || "").replace(/_?[0-9]+$/, "");
        const k = `${stem}|${r.__op.op}|${r.used}`;
        if (!fams.has(k)) fams.set(k, { stem, members: [] });
        fams.get(k).members.push(r);
      });
      const items = [];
      for (const { stem, members } of fams.values()) {
        if (members.length >= 3) {
          items.push({ ...members[0], id: `fam:${group}:${stem}`,
            repeats: members.length, stem,
            // The stem, not a term: the dictionary names ACCOUNT_LONG_NAME_1,
            // not the family, and a term borrowed from member one would
            // put "…_1" at the head of a row covering five of them. The
            // mono line below spells out which columns are folded in.
            name: stem,
            members });
        } else items.push(...members);
      }
      items.sort((a, b) => String(a.name).localeCompare(String(b.name)));
      out.push([group, items]);
    }
    out.sort((a, b) => a[0].localeCompare(b[0]));
    return out;
  }, [rows, terms]);

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return grouped.map(([g, items]) => [g, items.filter((r) => {
      if (only === "changed" && !r.__op.transformed) return false;
      if (only === "unread" && r.used !== "N") return false;
      if (!s) return true;
      return `${r.name} ${r.col} ${r.src || ""}`.toLowerCase().includes(s);
    })]).filter(([, items]) => items.length);
  }, [grouped, q, only]);

  const shown = visible.reduce((a, [, i]) => a + i.length, 0);
  if (!data) return null;

  return (
    <div style={{ fontFamily: t.font, color: C.ink }}>

      {/* The counts as a sentence. The canvas header has the same numbers
          as "1 table · 400 column links · 34 transformed", which is true
          and unreadable to anyone who does not already know the model. */}
      <p style={{ fontSize: 14.5, lineHeight: 1.65, maxWidth: 840,
                  margin: "0 0 18px" }}>
        {feedName ? <b>{feedName}</b> : "This feed"} carries{" "}
        <b>{srcCount} pieces of information</b>, and they fill{" "}
        <b>{sum.total} warehouse field{sum.total === 1 ? "" : "s"}</b>.{" "}
        <b>{sum.transformed}</b> of those {sum.transformed === 1 ? "is" : "are"}{" "}
        changed on the way
        {sum.total ? ` (${pc(sum.transformed, sum.total)}%)` : ""}.
        {usage && unread > 0 && <> <b>{unread}</b> nothing reads.</>}
      </p>

      <div style={{ display: "grid", gap: 14, marginBottom: 20,
        gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))" }}>
        <Act t={t} n={sum.transformed} c={C.changed} bg="#fffdf7"
          title={`${sum.transformed} change on the way`}
          body="The value that lands is not the value that arrived. If you
                reconcile against the source, these are the ones that will
                not tie out."
          action="Show only these" on={only === "changed"}
          onClick={() => setOnly(only === "changed" ? "all" : "changed")} />
        {usage && (
          <Act t={t} n={unread} c={C.unread} bg={C.panel}
            title={`${unread} nothing reads`}
            body="Carried every run, with no consumer found. Still part of
                  the contract — worth asking whether they need to move."
            action="Show only these" on={only === "unread"}
            onClick={() => setOnly(only === "unread" ? "all" : "unread")} />)}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center",
                    flexWrap: "wrap", marginBottom: 14 }}>
        <label htmlFor="sr-find" style={{ fontSize: 12.5, color: C.sub }}>Find</label>
        <input id="sr-find" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="a field, a business term, a column…"
          style={{ font: "inherit", fontSize: 13, padding: "7px 11px", width: 280,
            border: `1px solid ${C.rule}`, borderRadius: 3, background: "#fff" }} />
        {only !== "all" && (
          <button type="button" onClick={() => setOnly("all")}
            style={{ font: "inherit", fontSize: 12, padding: "6px 12px",
              border: `1px solid ${C.accent}`, background: "#fff",
              color: C.accent, borderRadius: 3, cursor: "pointer" }}>
            Showing {only === "changed" ? "changed" : "unread"} only — clear
          </button>)}
        <span style={{ marginLeft: "auto", fontSize: 11.5, color: C.faint }}>
          {shown} of {sum.total}
        </span>
      </div>

      {visible.map(([group, items]) => (
        <section key={group} style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: ".6px", color: C.sub, margin: "0 0 7px" }}>
            {group}
            <span style={{ fontWeight: 400, textTransform: "none",
              letterSpacing: 0, color: C.faint }}>
              {" "}· {items.length} {items.length === 1 ? "field" : "fields"}
            </span>
          </h3>
          <div style={{ background: C.panel, border: `1px solid ${C.rule}`,
                        borderRadius: 4, overflow: "hidden" }}>
            {items.map((r, i) => (
              <Row key={r.id} r={r} t={t} last={i === items.length - 1}
                open={open === r.id}
                onToggle={() => setOpen(open === r.id ? null : r.id)}
                onOpenTarget={onOpenTarget} byTable={byTable} />))}
          </div>
        </section>))}

      {!visible.length && (
        <div style={{ padding: 26, textAlign: "center", color: C.sub,
          fontSize: 13, background: C.panel, border: `1px solid ${C.rule}`,
          borderRadius: 4 }}>
          Nothing matches. {only !== "all" && (
            <button type="button" onClick={() => setOnly("all")}
              style={{ font: "inherit", border: 0, background: "none",
                color: C.accent, cursor: "pointer", padding: 0,
                textDecoration: "underline" }}>Show everything</button>)}
        </div>)}

      <p style={{ fontSize: 11.5, color: C.faint, lineHeight: 1.6,
                  maxWidth: 820, marginTop: 20 }}>
        Business names come from the dictionary; where a field has none the
        view shows its column name rather than inventing one. What each
        field does on the way is read from the same rules the picture
        draws, so the two cannot disagree.
      </p>
    </div>);
}

function Act({ t, n, c, bg, title, body, action, on, onClick }) {
  return (
    <div style={{ background: bg, border: `1px solid ${on ? c : C.rule}`,
      borderLeft: `4px solid ${c}`, borderRadius: 4, padding: "14px 17px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
        <b style={{ fontSize: 25, fontWeight: 400, color: c }}>{n}</b>
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>
          {title.replace(/^\d+\s/, "")}</span>
      </div>
      <p style={{ margin: "6px 0 10px", fontSize: 12.5, lineHeight: 1.55,
                  color: "#4a5560" }}>{body}</p>
      <button type="button" onClick={onClick} aria-pressed={on}
        style={{ font: "inherit", fontSize: 12.5, padding: "6px 13px",
          border: `1px solid ${c}`, background: on ? c : "#fff",
          color: on ? "#fff" : c, borderRadius: 3, cursor: "pointer" }}>
        {on ? "Showing these" : action}</button>
    </div>);
}

function Chip({ bg, fg, children, title }) {
  return <span title={title} style={{ fontSize: 10, fontWeight: 700,
    padding: "2px 8px", borderRadius: 999, background: bg, color: fg,
    whiteSpace: "nowrap" }}>{children}</span>;
}

function Row({ r, t, last, open, onToggle, onOpenTarget, byTable }) {
  const changed = r.__op.transformed;
  return (
    <div style={{ borderBottom: last ? "none" : `1px solid ${C.rule}66` }}>
      <button type="button" onClick={onToggle} aria-expanded={open}
        style={{ font: "inherit", textAlign: "left", width: "100%",
          border: 0, background: open ? "#f2f7fb" : "transparent",
          padding: "11px 16px", cursor: "pointer", color: C.ink }}>
        <span style={{ display: "flex", alignItems: "baseline", gap: 9,
                       flexWrap: "wrap" }}>
          <b style={{ fontSize: 14 }}>{r.name}</b>
          {changed && <Chip bg={C.changedBg} fg={C.changed}>changed</Chip>}
          {r.used === "N" && <Chip bg={C.unreadBg} fg={C.unread}>not read</Chip>}
          {r.pk === "Y" && <Chip bg="#e3eefb" fg="#0f4775" title="primary key">key</Chip>}
          <span style={{ fontSize: 12.5, color: "#4a5560" }}>{r.sentence}</span>
          {r.repeats && (
            <span style={{ fontSize: 11.5, color: C.faint }}>
              — {r.repeats} times, one per variant</span>)}
          <span style={{ marginLeft: "auto", fontSize: 11, color: C.accent }}>
            {open ? "hide" : "the journey"}</span>
        </span>
        <span style={{ display: "block", fontSize: 11, color: C.faint,
                       marginTop: 3, fontFamily: "ui-monospace, monospace" }}>
          {/* For a family, the real first and last member — a synthesised
              `STEM1 … STEM5` is a name no column in the warehouse has. */}
          {r.repeats
            ? `${r.members[0].col} … ${r.members[r.members.length - 1].col}`
            : `${r.src || "—"} → ${r.col}`}
        </span>
      </button>
      {open && <Journey r={r} onOpenTarget={onOpenTarget} byTable={byTable} />}
    </div>);
}

/* Three stops, in words. The canvas draws this as a wire; here each stop
   says what the value looks like when it gets there. Stages the lane does
   not have are left out rather than drawn empty — a blank box reads as a
   missing value, which is a different and worse claim. */
function Journey({ r, onOpenTarget, byTable }) {
  const rule = linkRule(r);
  const ex = explainRule(rule, { hasSource: !!r.src, target: r.col });
  const stops = [
    { n: 1, label: "Arrives", name: r.src || "— nothing supplies it",
      note: r.src_type
        ? `In the feed${r.src_length ? `, ${r.src_type}(${r.src_length})` : `, ${r.src_type}`}.`
        : "In the feed." },
    r.stg1 && { n: 2, label: "Conformed", name: r.stg1, note: "Loaded to staging." },
    r.stg2 && { n: 3, label: "Prepared", name: r.stg2, note: "Ready for the warehouse." },
    { n: 4, label: "Warehouse", name: `${r.table}.${r.col}`,
      sub: bizName(byTable && byTable.by, r.table),
      note: r.type ? `Stored as ${r.type}${r.length ? `(${r.length})` : ""}.`
                   : "What reports read." },
  ].filter(Boolean).map((s, i) => ({ ...s, n: i + 1 }));

  return (
    <div style={{ padding: "2px 16px 18px", background: "#fbfdfe" }}>
      <div style={{ display: "grid", gap: 11, marginTop: 8,
        gridTemplateColumns: `repeat(auto-fit, minmax(190px, 1fr))` }}>
        {stops.map((s) => (
          <div key={s.n} style={{ border: `1px solid ${C.rule}`,
            borderTop: `3px solid ${s.label === "Warehouse" ? C.same : C.accent}`,
            borderRadius: 3, padding: "10px 12px", background: "#fff" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".5px",
              textTransform: "uppercase", color: C.sub }}>
              {s.n} · {s.label}</div>
            <div style={{ fontSize: 12.5, marginTop: 5, color: C.ink,
              fontFamily: "ui-monospace, monospace", wordBreak: "break-all" }}>
              {s.name}</div>
            {s.sub && s.sub !== r.table && (
              <div style={{ fontSize: 11.5, color: C.sub, marginTop: 2 }}>
                {s.sub}</div>)}
            <div style={{ fontSize: 11.5, color: "#4a5560", marginTop: 3,
                          lineHeight: 1.45 }}>{s.note}</div>
          </div>))}
      </div>

      {(ex.steps || []).filter((s) => s.watch).map((s, i) => (
        <div key={i} style={{ marginTop: 11, fontSize: 12.5, lineHeight: 1.55,
          background: "#f4f7f9", borderRadius: 3, padding: "10px 13px",
          color: "#4a5560" }}>
          <b style={{ color: C.ink }}>Worth knowing.</b> {s.watch}
        </div>))}

      {/* The unit, currency and sign a type comparison cannot see. Two
          NUMBER(28,12) columns in different units are not the same
          column, and this is the only place that says so in words. */}
      {(r.unit || r.currency || r.sign || r.code_set) && (
        <div style={{ marginTop: 9, fontSize: 11.5, color: C.sub }}>
          {[r.unit && `measured in ${r.unit}`,
            r.currency && `${r.currency} currency basis`,
            r.sign && `${r.sign} sign convention`,
            r.code_set && `code set ${r.code_set}`]
            .filter(Boolean).join(" · ")}
        </div>)}

      {onOpenTarget && (
        <button type="button" onClick={() => onOpenTarget(r.table)}
          style={{ marginTop: 12, font: "inherit", fontSize: 12,
            border: `1px solid ${C.rule}`, background: "#fff", color: C.accent,
            borderRadius: 3, padding: "6px 12px", cursor: "pointer" }}>
          Open {r.table} →
        </button>)}
    </div>);
}
