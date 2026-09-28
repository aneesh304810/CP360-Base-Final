// The chain for one warehouse column, with the rule on every hop — and the
// proposed SEI equivalent as a second track under it.
//
// WHY THE RULES BELONG ON THE CHAIN. The column graph drew
// SOURCE -> LANDING -> CONFORMED -> WAREHOUSE as four boxes and three
// arrows, and the arrows were blank. The expression that turns one box
// into the next is the only thing in that picture that can be wrong in an
// interesting way, and it was the one thing not drawn. Four boxes and
// three blanks says "this column comes from somewhere", which nobody
// doubted.
//
// WHY THE SEI SIDE IS A SECOND TRACK AND NOT A SECOND SCREEN. The question
// is a comparison, and a comparison needs both halves in one eye-span. Put
// the proposed rule on its own page and the reader holds one expression in
// their head while they walk to the other, which is how differences get
// missed.
//
// WHY IT LANDS AT THE CONTRACT FIELD, NOT AT THE WAREHOUSE. SEI replaces
// the FRONT of the chain: it lands in the incumbent's compatibility
// contract and the existing pipeline carries it from there. Drawing the
// SEI track all the way to the warehouse column would assert a direct
// SEI-to-IMDS architecture that nobody has proposed, and the one case
// where that IS proposed has its own name — BYPASSES_CONTRACT — and its
// own exception.

import React, { useState, useEffect, useMemo } from "react";
import { crosswalkApi } from "./seiCrosswalkApi.js";
import { EQ_MEANING } from "./CrosswalkFlow.jsx";
import { compareRules } from "./ruleParse.js";

const MONO = "'Roboto Mono', ui-monospace, Menlo, monospace";
const STAGE_C = { SRC: "#7c3aed", STG1: "#00a3a3", STG2: "#0091bf", DWH: "#0f4775" };

const VERDICT_UI = {
  AGREES: { label: "Computes the same value", c: "#159943" },
  DIFFERS: { label: "Computes something different", c: "#c1113a" },
  CANNOT_TELL: { label: "Not enough documented to tell", c: "#6b7c8a" },
  NEEDS_BUSINESS: { label: "A real difference — business decision", c: "#7c3aed" },
};

const g = (o, ...k) => k.reduce((a, x) =>
  (a != null ? a : o?.[x] ?? o?.[x?.toUpperCase?.()] ?? o?.[x?.toLowerCase?.()]), null);

// One box in the chain.
function Box({ t, stage, table, column, type, len }) {
  if (!column && !table) return null;
  return (
    <div style={{ minWidth: 0, flex: "1 1 150px" }}>
      <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 0.6,
        textTransform: "uppercase", color: STAGE_C[stage], marginBottom: 3 }}>
        {stage === "SRC" ? "Source" : stage === "STG1" ? "Landing"
          : stage === "STG2" ? "Conformed" : "Warehouse"}</div>
      <div style={{ border: `1px solid ${t.panel2 || "#dfe6e9"}`,
        borderLeft: `3px solid ${STAGE_C[stage]}`, borderRadius: 3,
        background: t.panel || "#fff", padding: "7px 9px", minWidth: 0 }}>
        <div title={column} style={{ fontFamily: MONO, fontSize: 11,
          color: t.navy || "#10193b", overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{column || "—"}</div>
        <div title={table} style={{ fontSize: 9.5, color: t.muted || "#999",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {table || ""}{type ? ` · ${type}${len ? `(${len})` : ""}` : ""}</div>
      </div>
    </div>);
}

// The arrow BETWEEN two boxes, carrying its rule. An undocumented hop says
// so rather than rendering an empty arrow that reads as "nothing happens
// here" — those are very different states and only one of them is fine.
function Hop({ t, rule }) {
  const has = rule && String(rule).trim();
  return (
    <div style={{ flex: "0 1 130px", minWidth: 74, alignSelf: "stretch",
      display: "flex", flexDirection: "column", justifyContent: "center",
      padding: "0 2px" }}>
      <div style={{ fontSize: 9.5, lineHeight: 1.45, textAlign: "center",
        fontFamily: has ? MONO : "inherit",
        color: has ? (t.sub || "#666") : (t.muted || "#999"),
        fontStyle: has ? "normal" : "italic",
        wordBreak: "break-word" }}>
        {has ? rule : "not documented"}</div>
      <div style={{ height: 1, background: t.panel2 || "#dfe6e9",
        position: "relative", marginTop: 5 }}>
        <span style={{ position: "absolute", right: -1, top: -3,
          borderLeft: `5px solid ${t.panel2 || "#dfe6e9"}`,
          borderTop: "3.5px solid transparent",
          borderBottom: "3.5px solid transparent" }} /></div>
    </div>);
}

export default function ChainRules({ t, chain, dataSource, onSaved }) {
  const legacy = (chain && chain.legacy && chain.legacy[0]) || null;
  const sei = (chain && chain.sei && chain.sei[0]) || null;
  const xf = (chain && chain.xform && chain.xform[0]) || null;
  const cmp = (chain && chain.compare && chain.compare[0]) || null;
  if (!legacy && !sei) return null;

  const L = (k) => g(legacy || {}, k);
  const seiRule = (xf && (xf.sei_logic || xf.sei_equivalent_transformation))
    || (cmp && cmp.sei_logic) || (sei && sei.map_rule);
  const eq = (xf && xf.transformation_equivalence) || (cmp && cmp.equivalence);
  const anySei = Boolean(seiRule || (sei && sei.sei_datapoint));

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
        textTransform: "uppercase", color: t.muted || "#999", marginBottom: 8 }}>
        Today · {L("source_system") || "incumbent"} → warehouse</div>

      <div style={{ display: "flex", alignItems: "stretch", gap: 4,
        flexWrap: "wrap" }}>
        <Box t={t} stage="SRC" table={L("src_source_table")}
          column={L("src_source_column")} type={L("src_type")} len={L("src_length")} />
        <Hop t={t} rule={L("src_to_stg1_transform")} />
        <Box t={t} stage="STG1" table={L("stg1_source_table")}
          column={L("stg1_source_column")} type={L("stg1_type")} />
        <Hop t={t} rule={L("stg1_to_stg2_transform")} />
        <Box t={t} stage="STG2" table={L("stg2_source_table")}
          column={L("stg2_source_column")} type={L("stg2_type")} />
        <Hop t={t} rule={L("stg2_to_dwh_transform")} />
        <Box t={t} stage="DWH" table={L("dwh_target_table")}
          column={L("dwh_target_column")} type={L("dwh_type")} len={L("dwh_length")} />
      </div>

      {anySei ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 9,
            margin: "16px 0 8px" }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
              textTransform: "uppercase", color: "#0091bf" }}>
              Proposed · SEI → the same contract field</span>
            <span style={{ flex: 1, height: 1, borderTop: "1px dashed #bcd6e4" }} />
          </div>

          {/* The SEI track stops at the contract field on purpose. SEI
              replaces the front of the chain; the rest of the pipeline is
              unchanged and drawing it again would imply it is not. */}
          <div style={{ display: "flex", alignItems: "stretch", gap: 4,
            flexWrap: "wrap", opacity: 0.98 }}>
            <div style={{ minWidth: 0, flex: "1 1 150px" }}>
              <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 0.6,
                textTransform: "uppercase", color: "#0091bf", marginBottom: 3 }}>
                SEI datapoint</div>
              <div style={{ border: "1px solid #bcd6e4", borderLeft: "3px solid #0091bf",
                borderRadius: 3, background: "#f2f9fc", padding: "7px 9px" }}>
                <div style={{ fontFamily: MONO, fontSize: 11,
                  color: t.navy || "#10193b", overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {(sei && sei.sei_datapoint) || "—"}</div>
                <div style={{ fontSize: 9.5, color: t.muted || "#999",
                  overflow: "hidden", textOverflow: "ellipsis",
                  whiteSpace: "nowrap" }}>
                  {(sei && sei.sei_feed) || (xf && xf.sei_source_objects) || ""}
                  {sei && sei.sei_type ? ` · ${sei.sei_type}` : ""}</div>
              </div>
            </div>
            <Hop t={t} rule={seiRule} />
            <div style={{ minWidth: 0, flex: "1 1 150px" }}>
              <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 0.6,
                textTransform: "uppercase", color: STAGE_C.SRC, marginBottom: 3 }}>
                Contract field · unchanged from here</div>
              <div style={{ border: `1px dashed ${t.panel2 || "#dfe6e9"}`,
                borderRadius: 3, padding: "7px 9px" }}>
                <div style={{ fontFamily: MONO, fontSize: 11,
                  color: t.sub || "#666" }}>
                  {(sei && sei.contract_field) || L("src_source_column") || "—"}</div>
                <div style={{ fontSize: 9.5, color: t.muted || "#999" }}>
                  {(sei && sei.contract_feed) || L("src_source_table") || ""}
                  {" · the three hops above carry it from here"}</div>
              </div>
            </div>
          </div>

          {(sei && (sei.map_kind || sei.depends_on_feed || sei.join_key
                    || sei.open_question)) && (
            <div style={{ fontSize: 10.5, color: t.sub || "#666", marginTop: 8,
              lineHeight: 1.65 }}>
              {sei.map_kind && <span><b>{String(sei.map_kind).toLowerCase()}</b>
                {sei.composite_role ? ` · ${sei.composite_role}` : ""} · </span>}
              {sei.join_key && <span>joins on <span style={{ fontFamily: MONO }}>
                {sei.join_key}</span> · </span>}
              {sei.depends_on_feed && <span style={{ color: "#e67e22" }}>
                needs <span style={{ fontFamily: MONO }}>{sei.depends_on_feed}</span>
                {" "}loaded first · </span>}
              {sei.open_question && <span style={{ display: "block", marginTop: 4 }}>
                <b>Open question</b> {sei.open_question}</span>}
            </div>)}

          {/* The hops above carry short expressions. A five-line branch
              does not fit in a 9.5px label between two boxes, so anything
              longer gets a pane of its own — with the structural
              comparison under it. */}
          <RuleCompare t={t} dataSource={dataSource}
            legacyText={(xf && xf.legacy_logic) || (cmp && cmp.imds_logic)
                        || L("stg2_to_dwh_transform")}
            seiText={seiRule} />

          <Validate t={t} chain={chain} eq={eq} cmp={cmp} xf={xf}
            dataSource={dataSource} onSaved={onSaved} />
        </>
      ) : (
        <div style={{ marginTop: 14, fontSize: 11, color: t.sub || "#666",
          border: `1px dashed ${t.panel2 || "#dfe6e9"}`, borderRadius: 3,
          padding: "10px 12px", lineHeight: 1.6 }}>
          No SEI transformation is proposed for this column. The chain above
          is what runs today, and nothing replaces its front.
        </div>)}
    </div>);
}

// The validation control.
//
// TWO STATUSES, SHOWN TOGETHER, NEVER MERGED. The workbook's
// APPROVAL_STATUS is an input — every row of it currently reads
// DRAFT_REVIEW_REQUIRED because that is where the generating pass left
// them. A reviewer's decision is a different fact with a name attached,
// and it is stored beside the workbook rather than over it: writing back
// would be erased by the next ingest, which upserts on COMPARISON_ID.
//
// Where the two disagree, the disagreement is the finding, so both are on
// screen at once.
function Validate({ t, chain, eq, cmp, xf, dataSource, onSaved }) {
  const existing = chain && chain.review;
  const [open, setOpen] = useState(false);
  const [verdict, setVerdict] = useState((existing && existing.verdict) || "");
  const [why, setWhy] = useState((existing && existing.rationale) || "");
  const [who, setWho] = useState((existing && existing.reviewer) || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const needsWhy = verdict && verdict !== "AGREES";
  const canSave = verdict && (!needsWhy || why.trim().length >= 3) && !busy;

  const save = async () => {
    setBusy(true); setErr(null);
    const r = await crosswalkApi.saveXformReview({
      data_source: dataSource, table: chain.table, column: chain.column,
      verdict, rationale: why, reviewer: who,
      comparison_id: cmp ? cmp.comparison_id : null,
    });
    setBusy(false);
    if (!r.ok) { setErr(r.error || "could not save"); return; }
    setOpen(false);
    if (onSaved) onSaved();
  };

  const cur = existing && VERDICT_UI[existing.verdict];
  const wb = (xf && xf.transformation_approval) || (cmp && cmp.approval_status);
  const conflict = existing && wb
    && (existing.verdict === "AGREES")
       !== String(wb).toUpperCase().startsWith("APPROVED");

  return (
    <div style={{ marginTop: 13, borderTop: `1px solid ${t.panel2 || "#dfe6e9"}`,
      paddingTop: 11 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "baseline",
        flexWrap: "wrap" }}>
        {eq && (
          <span title={EQ_MEANING[eq] || ""} style={{ fontSize: 10.5,
            color: t.sub || "#666" }}>
            <b style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.4,
              textTransform: "uppercase", color: t.muted || "#999",
              marginRight: 6 }}>Workbook says</b>
            {String(eq).replace(/_/g, " ").toLowerCase()}
            {wb ? ` · ${String(wb).replace(/_/g, " ").toLowerCase()}` : ""}</span>)}

        {cur ? (
          <span style={{ fontSize: 10.5, color: t.sub || "#666" }}>
            <b style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.4,
              textTransform: "uppercase", color: t.muted || "#999",
              marginRight: 6 }}>Reviewed</b>
            <span style={{ color: cur.c, fontWeight: 600 }}>{cur.label}</span>
            {existing.reviewer ? ` · ${existing.reviewer}` : ""}
            {existing.reviewed_at ? ` · ${existing.reviewed_at}` : ""}</span>
        ) : (
          <span style={{ fontSize: 10.5, color: t.muted || "#999" }}>
            Not yet reviewed by anyone.</span>)}

        <button type="button" onClick={() => setOpen((x) => !x)}
          style={{ marginLeft: "auto", background: "none",
            border: `1px solid ${t.panel2 || "#dfe6e9"}`, borderRadius: 3,
            padding: "3px 11px", font: "inherit", fontSize: 10.5,
            cursor: "pointer", color: t.accent || "#0f4775" }}>
          {existing ? "change review" : "is this correct?"}</button>
      </div>

      {conflict && (
        <div style={{ marginTop: 8, fontSize: 10.5, lineHeight: 1.6,
          borderLeft: "3px solid #e67e22", background: "#fdf3e7",
          padding: "7px 11px", borderRadius: 2, color: t.sub || "#666" }}>
          <b>The review and the workbook disagree.</b> The document says
          {" "}{String(wb).replace(/_/g, " ").toLowerCase()}; the review says
          {" "}{cur ? cur.label.toLowerCase() : existing.verdict}. That is the
          finding — neither is overwritten.
        </div>)}

      {existing && existing.rationale && !open && (
        <div style={{ marginTop: 7, fontSize: 10.5, color: t.sub || "#666",
          lineHeight: 1.6 }}>{existing.rationale}</div>)}

      {open && (
        <div style={{ marginTop: 10, border: `1px solid ${t.panel2 || "#dfe6e9"}`,
          borderRadius: 4, padding: "11px 13px", background: "#f7fafc" }}>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap",
            marginBottom: 9 }}>
            {Object.entries(VERDICT_UI).map(([k, v]) => (
              <button key={k} type="button" onClick={() => setVerdict(k)}
                style={{ font: "inherit", fontSize: 10.5, cursor: "pointer",
                  padding: "4px 11px", borderRadius: 999,
                  border: `1px solid ${verdict === k ? v.c : (t.panel2 || "#dfe6e9")}`,
                  background: verdict === k ? `${v.c}18` : "#fff",
                  color: verdict === k ? v.c : (t.sub || "#666"),
                  fontWeight: verdict === k ? 700 : 400 }}>{v.label}</button>))}
          </div>
          <textarea value={why} onChange={(e) => setWhy(e.target.value)}
            rows={3} placeholder={needsWhy
              ? "Required — what differs, and what would settle it"
              : "Optional — anything worth recording"}
            style={{ width: "100%", boxSizing: "border-box", font: "inherit",
              fontSize: 11, lineHeight: 1.6, padding: "7px 9px",
              border: `1px solid ${needsWhy && why.trim().length < 3
                ? "#e0b48a" : (t.panel2 || "#dfe6e9")}`,
              borderRadius: 3, resize: "vertical" }} />
          <div style={{ display: "flex", gap: 9, alignItems: "center",
            marginTop: 8, flexWrap: "wrap" }}>
            <input value={who} onChange={(e) => setWho(e.target.value)}
              placeholder="your name"
              style={{ font: "inherit", fontSize: 11, padding: "5px 9px",
                border: `1px solid ${t.panel2 || "#dfe6e9"}`, borderRadius: 3,
                width: 180 }} />
            <button type="button" disabled={!canSave} onClick={save}
              style={{ font: "inherit", fontSize: 11, padding: "5px 15px",
                borderRadius: 3, border: "none", cursor: canSave ? "pointer" : "default",
                background: canSave ? (t.accent || "#0f4775") : "#c9d4dc",
                color: "#fff" }}>{busy ? "saving…" : "save review"}</button>
            <button type="button" onClick={() => setOpen(false)}
              style={{ background: "none", border: "none", padding: 0,
                font: "inherit", fontSize: 10.5, cursor: "pointer",
                color: t.muted || "#999", textDecoration: "underline" }}>
              cancel</button>
            {needsWhy && why.trim().length < 3 && (
              <span style={{ fontSize: 10, color: "#b45309" }}>
                a reason is required — a rejection nobody can act on stops the
                row and names no way forward</span>)}
            {err && <span style={{ fontSize: 10.5, color: "#c1113a" }}>{err}</span>}
          </div>
        </div>)}
    </div>);
}

// ======================================================= the rule, in full
// The chain's hops carry short expressions well. They cannot carry this:
//
//     v_Trade_Date_Cash := Base_Market_Value_10;
//     IF TRIM(Investment_Type_Code_42) != 'CASH' THEN
//       book_value := nvl(book_value,0) + to_number(nvl(Base_Amortized_Cost_7,0));
//     ELSE
//       book_value := nvl(book_value,0) + to_number(nvl(v_Trade_Date_Cash,0));
//
// Five lines of procedural code with a branch in it, squeezed into a 9.5px
// centred label between two boxes, is worse than not showing it. So a rule
// of more than one line gets a pane: monospace, line breaks kept,
// indentation kept, and every field token rendered as a chip that says
// which published STAR field it names.
//
// THE COMPARISON IS STRUCTURAL, NOT TEXTUAL. Two rules written differently
// can compute the same value and two written similarly can compute
// different ones, so a character diff is pages of noise with the finding
// buried in it. What can be checked mechanically — which fields each side
// reads, what each branches on, whether either joins, whether nulls are
// handled — is checked, and each difference is stated as a fact rather
// than as a verdict. The verdict is the reviewer's to give.

function Chip({ t, tok, res }) {
  const r = res && res[tok.raw];
  const conf = (r && r.confidence) || "none";
  const c = conf === "name+ordinal" ? "#159943"
          : conf === "name" ? "#0091bf"
          : conf === "ordinal" ? "#e67e22" : "#7b8894";
  const title = r && r.field
    ? `${r.field.feed_family} field ${r.field.ordinal} · ${r.field.field_name}`
      + `${r.field.type ? ` · ${r.field.type}` : ""}`
      + (conf === "name+ordinal" ? "\nName and ordinal both match — confirmed."
         : conf === "name" ? "\nName matches; the ordinal does not. Likely."
         : "\nOnly the ordinal matches. A guess — field 10 of the wrong feed "
           + "is still field 10.")
      + (r.ambiguous ? `\n${r.candidates} feeds publish this name; the `
          + "expression does not say which." : "")
    : (tok.ordinal != null
        ? `No published STAR field matches ${tok.base} or ordinal ${tok.ordinal}.`
        : `No published STAR field named ${tok.base}.`);
  return (
    <span title={title} style={{ fontFamily: MONO, fontSize: 10.5,
      padding: "0 3px", borderRadius: 2, background: `${c}1f`,
      color: conf === "none" ? (t.sub || "#666") : c,
      borderBottom: `1px ${conf === "ordinal" ? "dashed" : "solid"} ${c}66`,
      cursor: "help" }}>{tok.raw}</span>);
}

function RulePane({ t, title, colour, text, parsed, res, empty }) {
  const toks = new Map((parsed.tokens || []).map((x) => [x.raw, x]));
  // Split the raw text on token boundaries so the chips sit in the code
  // rather than beside it. Rendering the fields as a separate list would
  // make the reader match names back to positions by eye.
  const render = () => {
    if (empty) return <span style={{ fontStyle: "italic",
      color: t.muted || "#999" }}>no rule written down</span>;
    const parts = [];
    const re = /\b[A-Za-z_][A-Za-z0-9_]*\b/g;
    let last = 0, m;
    while ((m = re.exec(text)) !== null) {
      const tok = toks.get(m[0]);
      if (!tok) continue;
      if (m.index > last) parts.push(text.slice(last, m.index));
      parts.push(<Chip key={`${m.index}`} t={t} tok={tok} res={res} />);
      last = m.index + m[0].length;
    }
    parts.push(text.slice(last));
    return parts;
  };
  return (
    <div style={{ flex: "1 1 320px", minWidth: 0 }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
        textTransform: "uppercase", color: colour, marginBottom: 5 }}>{title}</div>
      <pre style={{ margin: 0, fontFamily: MONO, fontSize: 10.5,
        lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word",
        background: "#f7fafc", border: `1px solid ${t.panel2 || "#dfe6e9"}`,
        borderLeft: `3px solid ${colour}`, borderRadius: 3,
        padding: "9px 11px", color: t.navy || "#10193b",
        maxHeight: 260, overflowY: "auto" }}>{render()}</pre>
      <div style={{ fontSize: 9.5, color: t.muted || "#999", marginTop: 4,
        lineHeight: 1.6 }}>
        {!empty && <>
          {parsed.lineCount} line{parsed.lineCount === 1 ? "" : "s"}
          {parsed.tokens.length ? ` · ${parsed.tokens.length} field${
            parsed.tokens.length === 1 ? "" : "s"}` : ""}
          {parsed.branches.length ? ` · ${parsed.branches.length} branch${
            parsed.branches.length === 1 ? "" : "es"}` : ""}
          {parsed.handlesNull ? " · handles nulls" : ""}
          {parsed.joins.length ? ` · ${parsed.joins.length} join` : ""}
        </>}
      </div>
    </div>);
}

export function RuleCompare({ t, legacyText, seiText, dataSource }) {
  const cmp = useMemo(() => compareRules(legacyText, seiText),
    [legacyText, seiText]);
  const [res, setRes] = useState(null);

  const wanted = useMemo(() => {
    const all = new Set();
    [...cmp.legacy.tokens, ...cmp.sei.tokens].forEach((x) => all.add(x.raw));
    return [...all];
  }, [cmp]);

  useEffect(() => {
    if (!wanted.length) { setRes(null); return; }
    let live = true;
    crosswalkApi.resolveTokens(wanted, dataSource).then((r) => {
      if (!live) return;
      const m = {};
      (r.tokens || []).forEach((x) => { m[x.token] = x; });
      setRes(m);
    });
    return () => { live = false; };
  }, [wanted.join("|"), dataSource]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (cmp.legacy.empty && cmp.sei.empty) return null;
  const SEV = { risk: ["#c1113a", "Risk"], check: ["#e67e22", "Check"],
                gap: ["#6b7c8a", "Gap"] };

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <RulePane t={t} title="Today · STAR → IMDS" colour="#b5651d"
          text={cmp.legacy.raw} parsed={cmp.legacy} res={res}
          empty={cmp.legacy.empty} />
        <RulePane t={t} title="Proposed · SEI" colour="#0091bf"
          text={cmp.sei.raw} parsed={cmp.sei} res={res} empty={cmp.sei.empty} />
      </div>

      {/* The join is a PRECONDITION, not a value rule, and burying it in
          the same cell as the arithmetic hides that. If the join misses,
          the value is wrong rather than absent — the harder failure. */}
      {cmp.sei.joins.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 10.5, lineHeight: 1.65,
          borderLeft: "3px solid #7c3aed", background: "#f6f1fd",
          padding: "8px 12px", borderRadius: 2, color: t.sub || "#666" }}>
          <b style={{ color: "#7c3aed" }}>Precondition</b>{" "}
          {cmp.sei.joins.join(" ")}
          <div style={{ color: t.muted || "#999", marginTop: 3 }}>
            A join has to hold before the expression means anything. If it
            misses, the value is wrong rather than missing.</div>
        </div>)}

      {cmp.findings.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
            textTransform: "uppercase", color: t.muted || "#999",
            marginBottom: 6 }}>
            What differs — structurally, not textually</div>
          {cmp.findings.map((f, i) => {
            const [c, lab] = SEV[f.severity] || SEV.check;
            return (
              <div key={i} style={{ display: "flex", gap: 9, alignItems: "baseline",
                marginBottom: 5 }}>
                <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 0.4,
                  textTransform: "uppercase", color: c, background: `${c}18`,
                  padding: "2px 6px", borderRadius: 2, flexShrink: 0,
                  minWidth: 38, textAlign: "center" }}>{lab}</span>
                <span style={{ fontSize: 11, lineHeight: 1.6,
                  color: t.sub || "#666" }}>{f.text}</span>
              </div>);
          })}
          <div style={{ fontSize: 10, color: t.muted || "#999", marginTop: 7,
            lineHeight: 1.6, maxWidth: "76ch" }}>
            Every line above is a fact about the two expressions, not a
            verdict on them. Two rules written differently can compute the
            same value; only a person can say whether these do.
          </div>
        </div>)}

      {res && (
        <div style={{ fontSize: 9.5, color: t.muted || "#999", marginTop: 9,
          display: "flex", gap: 13, flexWrap: "wrap" }}>
          <span><i style={{ display: "inline-block", width: 8, height: 8,
            borderRadius: 2, background: "#159943", marginRight: 4 }} />
            name and ordinal both match</span>
          <span><i style={{ display: "inline-block", width: 8, height: 8,
            borderRadius: 2, background: "#0091bf", marginRight: 4 }} />
            name only</span>
          <span><i style={{ display: "inline-block", width: 8, height: 8,
            borderRadius: 2, background: "#e67e22", marginRight: 4 }} />
            ordinal only — a guess</span>
          <span><i style={{ display: "inline-block", width: 8, height: 8,
            borderRadius: 2, background: "#7b8894", marginRight: 4 }} />
            no published field</span>
        </div>)}
    </div>);
}
