// Code Review 360 — every push and pull request reviewed as a senior data
// engineer would, against the CP 360 designs: the rule findings the server
// found, the Copilot pack for the judgement half, Copilot's answer pasted
// back, and the final report as it was posted to GitHub.
//
// EVERY NUMBER IS DERIVED FROM THE FINDINGS. No secret, host or data value
// is on the page: the rules mask what they quote, and the report carries
// file paths, line numbers and sentences.
//
// `initial` lets a test hand in the payloads and skip the network.
import React, { useEffect, useMemo, useState } from "react";
import api, { SEVERITIES, SEV_COLOR, VERDICT_COLOR, VERDICT_LABEL, STATUS_LABEL, counts } from "./codeReviewApi.js";

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const TABS = ["Reviews", "Standards", "How it works"];
const Chip = ({ c, children }) => <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: .4, color: c, border: `1px solid ${c}`, borderRadius: 3, padding: "0 6px", whiteSpace: "nowrap" }}>{children}</span>;
const Tile = ({ t, n, label, color }) => (
  <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 6, padding: "10px 14px", minWidth: 104, flex: "1 1 104px" }}>
    <div style={{ fontSize: 24, fontWeight: 800, color: color || t.navy, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{n}</div>
    <div style={{ fontSize: 10, color: t.textMuted, textTransform: "uppercase", letterSpacing: ".6px", marginTop: 6 }}>{label}</div>
  </div>);
const th = (t) => ({ textAlign: "left", fontSize: 9.5, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase", color: t.textMuted, padding: "0 10px 6px 0", borderBottom: `1px solid ${t.border}`, verticalAlign: "bottom", whiteSpace: "nowrap" });
const td = (t) => ({ padding: "7px 10px 7px 0", verticalAlign: "top", borderBottom: `1px solid ${t.bg}`, color: t.sub, fontSize: 12, lineHeight: 1.45 });
const btn = (t, primary) => ({ font: "inherit", fontSize: 12, padding: "5px 11px", borderRadius: 4, cursor: "pointer", border: `1px solid ${primary ? t.accent : t.border}`, background: primary ? t.accent : t.panel, color: primary ? "#fff" : t.text, textDecoration: "none", display: "inline-block" });
const H = ({ t, children, sub }) => <div style={{ margin: "14px 0 6px" }}><div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{children}</div>{sub && <div style={{ fontSize: 12, color: t.sub, maxWidth: "90ch", lineHeight: 1.55 }}>{sub}</div>}</div>;

export default function CodeReview360({ t, initial }) {
  const [tab, setTab] = useState(initial?.tab || "Reviews");
  const [list, setList] = useState(initial?.reviews || null);
  const [health, setHealth] = useState(initial?.health || null);
  const [standards, setStandards] = useState(initial?.standards || null);
  const [open, setOpen] = useState(initial?.open || null);
  const [detail, setDetail] = useState(initial?.detail || null);
  const [answer, setAnswer] = useState("");
  const [post, setPost] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [run, setRun] = useState({ repo: "", number: "" });

  useEffect(() => {
    if (initial) return undefined;
    let on = true;
    api.reviews().then((r) => { if (on) setList(r.reviews || []); });
    api.health().then((h) => { if (on) setHealth(h); });
    const q = (typeof window !== "undefined" ? window.location.hash.split("?")[1] : "") || "";
    const m = /(?:^|&)review=([^&]+)/.exec(q);
    if (m) setOpen(decodeURIComponent(m[1]));
    return () => { on = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!open || initial?.detail) return undefined; let on = true; setDetail(null); api.review(open).then((d) => { if (on) setDetail(d); }); return () => { on = false; }; }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === "Standards" && !standards && !initial) api.standards().then(setStandards); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const reviews = list || [];
  const sum = useMemo(() => ({
    total: reviews.length, awaiting: reviews.filter((r) => r.status === "awaiting_copilot").length,
    changes: reviews.filter((r) => r.verdict === "REQUEST_CHANGES").length, approve: reviews.filter((r) => r.verdict === "APPROVE").length,
  }), [reviews]);

  const ingest = async () => {
    if (!open || !answer.trim()) return;
    setBusy(true); setMsg(null);
    const r = await api.ingest(open, answer, post);
    setBusy(false);
    if (r.error) { setMsg({ err: true, text: r.error }); return; }
    setDetail({ review: r, findings: r.findings }); setAnswer("");
    setMsg({ text: `final report: ${VERDICT_LABEL[r.verdict] || r.verdict}, ${r.findings.length} findings` + (r.github ? (r.github.posted ? `, posted to GitHub (${r.github.inline} inline)` : `, not posted: ${r.github.why}`) : "") });
    api.reviews().then((x) => setList(x.reviews || []));
  };
  const runNow = async () => {
    if (!run.repo || !run.number) return;
    setBusy(true); setMsg(null);
    const r = await api.run(run.repo, parseInt(run.number, 10), post);
    setBusy(false);
    if (r.error) { setMsg({ err: true, text: r.error }); return; }
    setMsg({ text: `reviewed ${run.repo} #${run.number}: ${VERDICT_LABEL[r.verdict] || r.verdict}, ${r.findings.length} rule findings` });
    api.reviews().then((x) => setList(x.reviews || [])); setOpen(r.id); setDetail({ review: r, findings: r.findings });
  };

  const d = detail;
  const findings = d ? (d.findings || d.review?.findings || []) : [];
  const c = counts(findings);

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 500, color: t.accent, borderBottom: `2px solid ${t.accent}`, paddingBottom: 14, margin: "0 0 8px" }}>Code Review 360</h1>
      <p style={{ fontSize: 12.5, color: t.sub, margin: "0 0 10px", maxWidth: "100ch", lineHeight: 1.55 }}>
        Every push and pull request on the Airflow, dbt and Integration Hub code, reviewed as a senior data engineer would against the CP 360 designs. The rules run on the server
        and post their findings at once; the judgement half is written by Microsoft 365 Copilot from the review pack and pasted back here, or by Claude when a key is configured.
        The final report goes to the pull request as review comments and stays here.
      </p>
      {health && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 11.5, color: t.sub, marginBottom: 10 }}>
        <Chip c={health.githubToken ? "#159943" : "#c1113a"}>{health.githubToken ? "GitHub token" : "no GitHub token"}</Chip>
        <Chip c={health.webhookSecret ? "#159943" : "#c1113a"}>{health.webhookSecret ? "webhook secret set" : "no webhook secret"}</Chip>
        <Chip c={health.llm && health.llm !== "none" ? "#159943" : "#6b7884"}>{health.llm && health.llm !== "none" ? `model: ${health.llm}` : "judgement by Copilot"}</Chip>
        <Chip c={health.post ? "#159943" : "#b45309"}>{health.post ? "posts to GitHub" : "stores only"}</Chip>
      </div>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Tile t={t} n={sum.total} label="reviews" /><Tile t={t} n={sum.awaiting} label="awaiting Copilot" color="#b45309" />
        <Tile t={t} n={sum.changes} label="request changes" color="#c1113a" /><Tile t={t} n={sum.approve} label="approved" color="#159943" />
      </div>
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${t.border}`, margin: "12px 0" }}>
        {TABS.map((v) => <div key={v} role="tab" tabIndex={0} aria-selected={tab === v} onClick={() => setTab(v)} style={{ padding: "8px 16px", fontSize: 13, cursor: "pointer", color: tab === v ? t.accent : t.sub, borderBottom: tab === v ? `2px solid ${t.accent}` : "2px solid transparent", marginBottom: -1 }}>{v}</div>)}
      </div>
      {msg && <div style={{ fontSize: 12, color: msg.err ? "#c1113a" : t.text, background: t.panel, border: `1px solid ${msg.err ? "#c1113a" : t.border}`, borderLeft: `3px solid ${msg.err ? "#c1113a" : "#159943"}`, borderRadius: 4, padding: "6px 10px", marginBottom: 10 }}>{msg.text}</div>}

      {tab === "Reviews" && (<>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          <input value={run.repo} onChange={(e) => setRun({ ...run, repo: e.target.value })} placeholder="owner/repository" style={{ font: "inherit", fontSize: 12, padding: "5px 8px", border: `1px solid ${t.border}`, borderRadius: 4, width: 220, background: t.panel, color: t.text }} />
          <input value={run.number} onChange={(e) => setRun({ ...run, number: e.target.value })} placeholder="PR #" style={{ font: "inherit", fontSize: 12, padding: "5px 8px", border: `1px solid ${t.border}`, borderRadius: 4, width: 70, background: t.panel, color: t.text }} />
          <button type="button" style={btn(t, true)} disabled={busy} onClick={runNow}>Review a pull request now</button>
          <label style={{ fontSize: 11.5, color: t.sub, display: "inline-flex", gap: 4, alignItems: "center" }}><input type="checkbox" checked={post} onChange={(e) => setPost(e.target.checked)} /> post to GitHub</label>
        </div>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr>{["Review", "Repository · change", "Verdict", "Status", "Findings", "Source", ""].map((h, i) => <th key={i} style={th(t)}>{h}</th>)}</tr></thead>
          <tbody>{reviews.map((r) => (
            <tr key={r.id} style={{ background: open === r.id ? t.bg : undefined }}>
              <td style={{ ...td(t), fontFamily: MONO, fontSize: 11 }}>{r.id}<div style={{ fontSize: 10.5, color: t.textMuted }}>{r.created_at || ""}</div></td>
              <td style={{ ...td(t), color: t.text, fontWeight: 600 }}>{r.repo || "-"}<div style={{ fontSize: 10.5, color: t.textMuted, fontWeight: 400 }}>{r.kind === "pr" && r.number ? `#${r.number} · ` : ""}{r.ref || ""}</div></td>
              <td style={td(t)}><Chip c={VERDICT_COLOR[r.verdict] || "#6b7884"}>{VERDICT_LABEL[r.verdict] || r.verdict || "-"}</Chip></td>
              <td style={td(t)}>{STATUS_LABEL[r.status] || r.status || "-"}</td>
              <td style={td(t)}>{r.findings_n ?? "-"}</td>
              <td style={td(t)}>{r.source || "-"}</td>
              <td style={td(t)}><button type="button" style={btn(t)} onClick={() => setOpen(r.id)}>Open</button></td>
            </tr>))}
            {reviews.length === 0 && <tr><td colSpan={7} style={{ ...td(t), padding: 18 }}>No reviews yet. Add the webhook to a repository, or review a pull request now.</td></tr>}
          </tbody>
        </table>

        {open && !d && <div style={{ fontSize: 12, color: t.sub, marginTop: 12 }}>loading review {open}…</div>}
        {d && d.review && (<div style={{ marginTop: 16, background: t.panel, border: `1px solid ${t.border}`, borderRadius: 6, padding: "14px 16px" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{d.review.repo || "local change"} {d.review.number ? `#${d.review.number}` : ""} <span style={{ color: t.textMuted, fontWeight: 400 }}>{d.review.ref || ""}</span></div>
            <Chip c={VERDICT_COLOR[d.review.verdict] || "#6b7884"}>{VERDICT_LABEL[d.review.verdict] || d.review.verdict}</Chip>
            <span style={{ fontSize: 11.5, color: t.sub }}>{STATUS_LABEL[d.review.status] || d.review.status} · {d.review.source}</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontFamily: MONO, fontSize: 11, color: t.textMuted }}>{d.review.id}</span>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "10px 0" }}>
            {SEVERITIES.map((s) => <Tile key={s} t={t} n={c[s]} label={s} color={SEV_COLOR[s]} />)}
          </div>
          {d.review.summary && <div style={{ fontSize: 12.5, color: t.text, borderLeft: `3px solid ${t.accent}`, padding: "4px 10px", margin: "6px 0 10px", lineHeight: 1.55 }}>{d.review.summary}</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <a href={api.packUrl(d.review.id)} style={btn(t, true)} download={`copilot-prompt-${d.review.id}.md`}>Download the Copilot pack</a>
            <span style={{ fontSize: 11.5, color: t.sub, alignSelf: "center" }}>attach it in Microsoft 365 Copilot or Copilot Chat (ask mode) and send: "Review this pull request as the instructions say and answer in the output contract."</span>
          </div>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead><tr>{["#", "Severity", "Where", "Rule", "Finding", "Fix", "By"].map((h, i) => <th key={i} style={th(t)}>{h}</th>)}</tr></thead>
            <tbody>{findings.map((f, i) => (
              <tr key={i}>
                <td style={td(t)}>{i + 1}</td>
                <td style={td(t)}><Chip c={SEV_COLOR[f.severity] || "#6b7884"}>{f.severity}</Chip></td>
                <td style={{ ...td(t), fontFamily: MONO, fontSize: 11 }}>{f.file}{f.line ? `:${f.line}` : ""}</td>
                <td style={{ ...td(t), maxWidth: 220 }}><span style={{ fontFamily: MONO, fontSize: 10.5 }}>{f.rule && f.rule !== "CP360-CR-GEN-004" ? f.rule : ""}</span><div style={{ color: t.text, fontSize: 11.5 }}>{f.title}</div></td>
                <td style={{ ...td(t), maxWidth: 360 }}>{f.message}</td>
                <td style={{ ...td(t), maxWidth: 300 }}>{f.fix || "-"}</td>
                <td style={td(t)}>{f.source}</td>
              </tr>))}
              {findings.length === 0 && <tr><td colSpan={7} style={{ ...td(t), padding: 14 }}>No findings.</td></tr>}
            </tbody>
          </table>
          <H t={t} sub="Copy Copilot's whole answer, the Findings table and the VERDICT line, and paste it here. The final report merges it with the rule findings and, when ticked, posts the review comments to the pull request.">Paste Copilot's answer</H>
          <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={8} placeholder={"| File | Line | Severity | Rule | Finding | Fix |\n|---|---|---|---|---|---|\n| dags/eod.py | 42 | high | CP360-CR-AF-001 | ... | ... |\n\nVERDICT: REQUEST_CHANGES\n..."} style={{ font: "inherit", fontFamily: MONO, fontSize: 11.5, width: "100%", boxSizing: "border-box", padding: 8, border: `1px solid ${t.border}`, borderRadius: 4, background: t.bg, color: t.text }} />
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
            <button type="button" style={btn(t, true)} disabled={busy || !answer.trim()} onClick={ingest}>{busy ? "Working…" : "Build the final report"}</button>
            <label style={{ fontSize: 11.5, color: t.sub, display: "inline-flex", gap: 4, alignItems: "center" }}><input type="checkbox" checked={post} onChange={(e) => setPost(e.target.checked)} /> post to the pull request</label>
          </div>
          {d.review.report_md && <details style={{ marginTop: 12 }}><summary style={{ fontSize: 12, color: t.sub, cursor: "pointer" }}>The report as posted (Markdown)</summary>
            <pre style={{ fontFamily: MONO, fontSize: 11, whiteSpace: "pre-wrap", overflowWrap: "anywhere", background: t.bg, border: `1px solid ${t.border}`, borderRadius: 4, padding: 10, color: t.text, maxHeight: 360, overflow: "auto" }}>{d.review.report_md}</pre></details>}
        </div>)}
      </>)}

      {tab === "Standards" && (<>
        <H t={t} sub="The rules the review holds code to, each with the CP 360 design it comes from. Automated rules run on the server; the rest are in the reviewer's hands, Copilot's or Claude's.">Standards</H>
        {!standards && <div style={{ fontSize: 12, color: t.sub }}>loading…</div>}
        {standards && Object.entries(standards.areas || {}).map(([k, label]) => {
          const rs = (standards.rules || []).filter((r) => r.area === k);
          if (!rs.length) return null;
          return (<div key={k} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text, margin: "8px 0 4px" }}>{label} <span style={{ color: t.textMuted, fontWeight: 400 }}>· {rs.length}</span></div>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead><tr>{["Rule", "Severity", "Standard", "From the design", "Automated"].map((h, i) => <th key={i} style={th(t)}>{h}</th>)}</tr></thead>
              <tbody>{rs.map((r) => (<tr key={r.id}>
                <td style={{ ...td(t), fontFamily: MONO, fontSize: 11, whiteSpace: "nowrap" }}>{r.id}</td>
                <td style={td(t)}><Chip c={SEV_COLOR[r.sev]}>{r.sev}</Chip></td>
                <td style={{ ...td(t), maxWidth: 520 }}><b style={{ color: t.text }}>{r.title}.</b> {r.text}</td>
                <td style={{ ...td(t), maxWidth: 260 }}>{r.ref}</td>
                <td style={td(t)}>{r.auto ? <Chip c="#159943">rule</Chip> : <Chip c="#6b7884">reviewer</Chip>}</td>
              </tr>))}</tbody>
            </table>
          </div>);
        })}
      </>)}

      {tab === "How it works" && (<>
        <H t={t}>From a push to a posted review</H>
        {[["1", "GitHub calls the webhook", "On every opened, updated or reopened pull request and every push. The signature is checked against the webhook secret; the request is acknowledged at once and the review runs in the background."],
          ["2", "The rules run", "Airflow DAGs are read by AST: retries on gates, catchup, parse-time work, task ids, secrets in Variables. dbt models and schema.yml: AD-2 merges and deletes, incremental hygiene, ref and source, SELECT *, contracts, layer names. Hub Python: error taxonomy, acknowledge-then-process, idempotency, timeouts, logging of values, runtime DDL, per-feed branches. SQL and Liquibase: rollback, idempotent DDL, binds. Every file: secrets, hosts, client data, size, TODOs, tests with code."],
          ["3", "The first comment is posted", "The rule findings go to the pull request as inline review comments with the verdict so far and a link to the review pack. A blocker or high finding is Request changes."],
          ["4", "Copilot writes the judgement half", "Download the pack, attach it in Microsoft 365 Copilot or Copilot Chat (ask mode), and ask for the review. The pack carries the senior data engineer instructions, the standards, what the rules already found, and the numbered diff, with a fixed answer format."],
          ["5", "The final report", "Paste Copilot's answer here. It is parsed, merged with the rule findings, the verdict is settled, and the final review is posted to the pull request and stored in CP 360 with who said what. With a model key configured, this step happens in the first run."]].map(([n, h, b]) => (
          <div key={n} style={{ display: "flex", gap: 12, margin: "10px 0" }}>
            <div style={{ width: 30, height: 30, borderRadius: 15, background: t.accent, color: "#fff", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{n}</div>
            <div><div style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>{h}</div><div style={{ fontSize: 12.5, color: t.sub, lineHeight: 1.55, maxWidth: "95ch" }}>{b}</div></div>
          </div>))}
        <H t={t} sub="GITHUB_TOKEN, CR_WEBHOOK_SECRET and CR_PUBLIC_API_URL on the API host; the webhook on each repository with Pull requests and Pushes; sql/89 for the store. docs/CODE_REVIEW.md has the steps and the command line.">Setup</H>
      </>)}
    </div>);
}
