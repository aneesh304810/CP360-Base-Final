import React, { useState, useEffect, useRef } from "react";
import { api } from "./api.js";

// =====================================================================
// GlobalSearch — the header search bar (sits right after the LIVE badge).
//   type  -> debounced /search?limit=8 -> dropdown: field-code chip,
//            hits grouped by kind, recents on empty focus
//   ↑↓ ↵ esc -> keyboard navigation
//   Enter / "See all" -> the dedicated results screen (#search?q=)
//   click a hit -> deep-links straight into its module (same nav payload
//                  the results screen uses)
// =====================================================================

const CODE_RX = /^[A-Za-z]{1,3}[/._-]\d+([/._-][Ll]?\d+)?$/;
const KINDS = {
  legacy_def: { label: "definition", bg: "#efe6fb", fg: "#6d3ac0" },
  datapoint: { label: "datapoint", bg: "#e0f5fd", fg: "#0091bf" },
  field: { label: "field", bg: "#e0f5fd", fg: "#0b5e83" },
  canonical: { label: "canonical", bg: "#e0f5fd", fg: "#0b5e83" },
  feed: { label: "feed", bg: "#fae5d3", fg: "#a8560f" },
  loader: { label: "loader", bg: "#efe6fb", fg: "#7c3aed" },
  loader_attr: { label: "loader attr", bg: "#efe6fb", fg: "#7c3aed" },
  api: { label: "api", bg: "#e8eaf6", fg: "#3f51b5" },
  api_field: { label: "api field", bg: "#e8eaf6", fg: "#3f51b5" },
  flow: { label: "flow", bg: "#e8eaf6", fg: "#3f51b5" },
  pipeline: { label: "pipeline", bg: "#d0ebd9", fg: "#159943" },
  dataset: { label: "dataset", bg: "#d0ebd9", fg: "#159943" },
  pii: { label: "pii", bg: "#f3d2d7", fg: "#c1113a" },
};
const GROUP_ORDER = ["legacy_def", "datapoint", "field", "canonical", "feed", "loader",
  "api", "flow", "pipeline", "dataset", "pii"];
const RECENT_KEY = "cp360RecentSearches";

const loadRecents = () => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); }
  catch (e) { return []; }
};
const saveRecent = (q) => {
  try {
    const r = [q, ...loadRecents().filter((x) => x !== q)].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(r));
  } catch (e) { /* private mode etc — recents are optional */ }
};

function Hl({ text, q }) {
  const t = String(text || ""), i = t.toLowerCase().indexOf(q.toLowerCase());
  if (!q || i < 0) return <>{t}</>;
  return <>{t.slice(0, i)}<mark style={{ background: "#fff3bf", padding: 0 }}>
    {t.slice(i, i + q.length)}</mark>{t.slice(i + q.length)}</>;
}

export default function GlobalSearch({ t, onSubmit, onOpen }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState([]);
  const [sel, setSel] = useState(0);
  const boxRef = useRef(null);
  const timer = useRef(null);

  // debounced fetch
  useEffect(() => {
    if (!open) return;
    if (timer.current) clearTimeout(timer.current);
    if (!q.trim()) { setHits([]); return; }
    timer.current = setTimeout(() => {
      api.search(q, undefined, 8).then((d) => setHits((d && d.results) || []));
    }, 160);
    return () => timer.current && clearTimeout(timer.current);
  }, [q, open]);

  useEffect(() => {
    const off = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, []);

  // flat item list for keyboard nav
  const firstTerm = q.trim().split(/\s+/)[0] || "";
  const isCode = CODE_RX.test(firstTerm);
  const items = [];
  if (!q.trim()) loadRecents().forEach((r) => items.push({ type: "recent", q: r }));
  else {
    if (isCode) items.push({ type: "code", q: q.trim() });
    hits.forEach((h) => items.push({ type: "hit", hit: h }));
    items.push({ type: "all", q: q.trim() });
  }

  const submit = (val) => { saveRecent(val); setOpen(false); onSubmit(val); };
  const choose = (it) => {
    if (!it) return submit(q);
    if (it.type === "hit") { saveRecent(q.trim()); setOpen(false); if (onOpen) onOpen(it.hit.nav || it.hit); }
    else submit(it.q);
  };
  const onKey = (e) => {
    if (e.key === "ArrowDown") { setSel((s) => Math.min(s + 1, items.length - 1)); e.preventDefault(); }
    else if (e.key === "ArrowUp") { setSel((s) => Math.max(s - 1, 0)); e.preventDefault(); }
    else if (e.key === "Enter") { items.length ? choose(items[Math.min(sel, items.length - 1)]) : submit(q); }
    else if (e.key === "Escape") setOpen(false);
  };

  // grouped render (hits by kind) while keeping flat indices for selection
  let idx = -1;
  const row = (content, i, onClick) => (
    <div key={i} onMouseEnter={() => setSel(i)} onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 14px",
               cursor: "pointer", borderTop: "1px solid #f2f4f7",
               background: sel === i ? "#e9f4fb" : "#fff" }}>{content}</div>);
  const kindPill = (k) => {
    const m = KINDS[k] || { label: k, bg: "#eef1f4", fg: "#556" };
    return <span style={{ fontSize: 8, fontWeight: 800, textTransform: "uppercase",
      padding: "2px 7px", borderRadius: 3, background: m.bg, color: m.fg,
      flex: "none" }}>{m.label}</span>;
  };

  const grouped = [];
  if (items.length) {
    if (!q.trim()) {
      grouped.push(<div key="rh" style={{ padding: "7px 14px 3px", fontSize: 8.5, fontWeight: 800,
        textTransform: "uppercase", letterSpacing: 0.5, color: "#999",
        background: "#fafbfc" }}>Recent searches</div>);
      items.forEach((it) => { idx++;
        const i = idx;
        grouped.push(row(<><span style={{ color: "#999", fontSize: 12 }}>🕘</span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: t.navy }}>{it.q}</span></>,
          i, () => choose(it)));
      });
    } else {
      if (isCode) { idx++;
        const i = idx;
        grouped.push(row(<>
          <span style={{ color: "#6d3ac0", fontWeight: 800 }}>#</span>{kindPill("legacy_def")}
          <span style={{ fontFamily: "Roboto Mono, monospace", fontSize: 12.5, fontWeight: 700,
                         color: t.navy }}>{firstTerm.toUpperCase()}</span>
          <span style={{ fontSize: 10, color: "#999" }}>field code — all masters &amp; warehouses</span>
          <span style={{ marginLeft: "auto", fontSize: 9, color: "#999" }}>instant answer ↵</span>
        </>, i, () => choose(items[i])));
      }
      GROUP_ORDER.concat(Object.keys(
        hits.reduce((m, h) => (GROUP_ORDER.includes(h.kind) ? m : (m[h.kind] = 1, m)), {})))
        .forEach((k) => {
          const g = hits.filter((h) => h.kind === k);
          if (!g.length) return;
          grouped.push(<div key={"gh" + k} style={{ padding: "7px 14px 3px", fontSize: 8.5,
            fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: "#999",
            background: "#fafbfc" }}>{(KINDS[k] || { label: k }).label}s</div>);
          g.forEach((h) => { idx++;
            const i = idx;
            grouped.push(row(<>
              {kindPill(h.kind)}
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: t.navy,
                               overflow: "hidden", textOverflow: "ellipsis",
                               whiteSpace: "nowrap" }}><Hl text={h.name} q={q} /></span>
                <span style={{ display: "block", fontSize: 10, color: "#999", overflow: "hidden",
                               textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <Hl text={h.subtitle} q={q} /></span>
              </span>
              {h.is_pii === "Y" && <span style={{ fontSize: 8, fontWeight: 800, color: "#c1113a",
                background: "#f3d2d7", borderRadius: 3, padding: "2px 6px",
                marginLeft: "auto", flex: "none" }}>PII</span>}
            </>, i, () => choose(items[i])));
          });
        });
      idx++;
      const allI = idx;
      grouped.push(row(<span style={{ fontSize: 11, fontWeight: 700, color: t.accent }}>
        See all results for “{q.trim()}” ↵</span>, allI, () => choose(items[allI])));
    }
  }

  return (
    <div ref={boxRef} style={{ position: "relative", width: 400, marginLeft: 14 }}>
      <input value={q} placeholder="Search — terms, field codes (BI/2-1), tables…"
        onChange={(e) => { setQ(e.target.value); setSel(0); setOpen(true); }}
        onFocus={() => setOpen(true)} onKeyDown={onKey}
        style={{ width: "100%", height: 32, borderRadius: 999, border: "none", outline: "none",
                 padding: "0 14px 0 34px", fontSize: 13, fontFamily: t.font,
                 background: "rgba(255,255,255,0.14)", color: "#fff" }} />
      <span style={{ position: "absolute", left: 12, top: 7, fontSize: 13, opacity: 0.7 }}>🔍</span>
      {open && grouped.length > 0 && (
        <div style={{ position: "absolute", top: 40, left: 0, right: 0, background: "#fff",
                      border: "1px solid #dfe6e9", borderRadius: 10, overflow: "hidden",
                      boxShadow: "0 16px 44px rgba(0,0,0,.28)", zIndex: 60 }}>
          {grouped}
          <div style={{ display: "flex", gap: 14, padding: "6px 14px", fontSize: 9, color: "#999",
                        background: "#fafbfc", borderTop: "1px solid #eef1f4" }}>
            <span>↑↓ navigate · ↵ open · esc close</span>
            <span style={{ marginLeft: "auto" }}>filters: is:pii · master:ip · ds:imds</span>
          </div>
        </div>)}
    </div>);
}
