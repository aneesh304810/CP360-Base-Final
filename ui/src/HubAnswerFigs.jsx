// Small figures for the drafted answers.
//
// ONE FIGURE PER ANSWER THAT NEEDS ONE, AND ONLY WHERE A SENTENCE WOULD
// LOSE. Four of these draw a shape the prose cannot: a 2×2 where one
// column is deliberately merged, a chain where the gap is a MISSING
// hop, three lanes closing independently, a step between environments
// that is 8× on one axis and 4× on the other. The rest of the answers
// have no figure on purpose.
//
// THEME. Status colours are the same hex in both themes, so filled
// badges with white text are safe. t.navy and t.accent are SURFACES in
// the dark theme and are never used as ink here.
//
// COLOUR IS NEVER THE ONLY SIGNAL. Green and red sit ~1.9 ΔE apart for a
// deuteranope, so every state also carries a glyph and a word.
import React from "react";

const OK = "#159943", NO = "#c1113a", WA = "#b4620f";

const Box = ({ x, y, w, h, fill, stroke, r = 6 }) => (
  <rect x={x} y={y} width={w} height={h} rx={r} fill={fill}
    stroke={stroke} strokeWidth="1" />
);
const T = ({ x, y, children, s = 10, w = 400, fill = "#2b3a47", a = "middle" }) => (
  <text x={x} y={y} fontSize={s} fontWeight={w} fill={fill} textAnchor={a}>{children}</text>
);
const Arrow = ({ x1, x2, y, c = "#8795a1" }) => (
  <g><line x1={x1} y1={y} x2={x2 - 6} y2={y} stroke={c} strokeWidth="1.5" />
    <polygon points={`${x2},${y} ${x2 - 7},${y - 3.5} ${x2 - 7},${y + 3.5}`} fill={c} /></g>
);

// Two flags, not one. The left column is merged because when no rollback
// is declared, data_safe has nothing to describe — and that merge IS the
// thing a single "rollbackable" boolean gets wrong.
function Rollback() {
  return (
    <svg viewBox="0 0 620 208" style={{ width: "100%", display: "block" }}>
      <T x={310} y={16} s={10.5} fill="#55636f">
        two flags, because “can it be rolled back” and “do I get the data back” are different questions
      </T>
      <T x={232} y={42} s={9.5} w={700} fill="#55636f">rollback_declared = N</T>
      <T x={470} y={42} s={9.5} w={700} fill="#55636f">rollback_declared = Y</T>
      <T x={108} y={82} s={9.5} w={700} fill="#55636f" a="end">data_safe = Y</T>
      <T x={108} y={152} s={9.5} w={700} fill="#55636f" a="end">data_safe = N</T>

      <Box x={120} y={52} w={224} h={136} fill="#fdf2e3" stroke="#e8c88f" />
      <T x={232} y={104} s={11} w={700} fill={WA}>▲ no_rollback</T>
      <T x={232} y={122} s={9.5} fill="#7a6433">nothing to run.</T>
      <T x={232} y={137} s={9.5} fill="#7a6433">reversible only from backup</T>
      <T x={232} y={166} s={8.5} fill="#8a7444">data_safe says nothing here —</T>
      <T x={232} y={178} s={8.5} fill="#8a7444">there is no block to run</T>

      <Box x={356} y={52} w={244} h={62} fill="#e8f6ed" stroke="#a9d8bb" />
      <T x={478} y={78} s={11} w={700} fill={OK}>✓ safe</T>
      <T x={478} y={96} s={9.5} fill="#3b6b4c">rollback exists and restores the data</T>

      <Box x={356} y={126} w={244} h={62} fill="#fdeaee" stroke="#eeb3c0" />
      <T x={478} y={150} s={11} w={700} fill={NO}>✕ rollback_not_data_safe</T>
      <T x={478} y={168} s={9.5} fill="#8c3348">DROP COLUMN — the block runs,</T>
      <T x={478} y={181} s={9.5} fill="#8c3348">the column comes back empty</T>
    </svg>
  );
}

// Three hops modelled, four layers asked about. The missing one is drawn
// as missing rather than described, because that is the whole answer.
function Hops() {
  const L = [["RAW", 40], ["STG1", 175], ["STG2", 310], ["DIM / FACT", 475]];
  return (
    <svg viewBox="0 0 620 182" style={{ width: "100%", display: "block" }}>
      <T x={310} y={15} s={10.5} fill="#55636f">
        recon_summary counts breaks on three named hops
      </T>
      {L.map(([lab, x]) => (
        <g key={lab}>
          <Box x={x} y={30} w={100} h={34} fill="#eef3f8" stroke="#c6d6e4" />
          <T x={x + 50} y={51} s={10.5} w={700} fill="#1d3c57">{lab}</T>
        </g>
      ))}
      <Arrow x1={140} x2={175} y={47} /><Arrow x1={275} x2={310} y={47} />
      <Arrow x1={410} x2={475} y={47} />

      {[["breaks_src_stg1", 157], ["breaks_stg1_stg2", 292]].map(([k, x]) => (
        <g key={k}>
          <line x1={x} y1={64} x2={x} y2={86} stroke="#8795a1" strokeDasharray="2 2" />
          <T x={x} y={100} s={8.5} fill="#55636f">{k}</T>
        </g>
      ))}
      <line x1={442} y1={64} x2={442} y2={86} stroke="#8795a1" strokeDasharray="2 2" />
      <T x={442} y={100} s={8.5} fill="#55636f">breaks_stg2_dwh</T>

      <Box x={300} y={116} w={300} h={52} fill="#fdf2e3" stroke="#e8c88f" />
      <T x={450} y={136} s={10} w={700} fill={WA}>▲ the INT layer has no hop of its own</T>
      <T x={450} y={154} s={9} fill="#7a6433">
        a break made in INT looks like one made by the load
      </T>
      <T x={150} y={142} s={9} fill="#55636f">eleven metrics per column per stage:</T>
      <T x={150} y={157} s={9} w={700} fill="#1d3c57">CNT · SUM · HASHSUM · NDV · NULLS · …</T>
    </svg>
  );
}

// Per-topic open/close, and the empty topic that is still complete —
// which is the case most implementations get wrong.
function Markers() {
  const rows = [["topic A", 44, 2], ["topic B", 92, 3], ["reference topic", 140, 0]];
  return (
    <svg viewBox="0 0 620 196" style={{ width: "100%", display: "block" }}>
      <T x={310} y={15} s={10.5} fill="#55636f">
        the batch is complete only when the LAST topic has closed
      </T>
      {rows.map(([lab, y, n]) => (
        <g key={lab}>
          <T x={118} y={y + 4} s={9.5} w={700} fill="#1d3c57" a="end">{lab}</T>
          <line x1={132} y1={y} x2={530} y2={y} stroke="#dfe6e9" strokeWidth="1" />
          <circle cx={148} cy={y} r={7} fill="#0f4775" />
          <T x={148} y={y + 3} s={8} w={700} fill="#ffffff">▶</T>
          {[...Array(n)].map((_, i) => (
            <rect key={i} x={200 + i * 70} y={y - 5} width={44} height={10} rx={3}
              fill="#bcd3e8" />
          ))}
          <circle cx={514} cy={y} r={7} fill="#0f4775" />
          <T x={514} y={y + 3} s={8} w={700} fill="#ffffff">■</T>
          {n === 0 && (
            <T x={300} y={y + 3} s={9} fill={OK}>✓ no data events — still a complete topic</T>
          )}
        </g>
      ))}
      <T x={148} y={28} s={8.5} fill="#55636f">start</T>
      <T x={514} y={28} s={8.5} fill="#55636f">end</T>
      <line x1={530} y1={34} x2={530} y2={152} stroke={OK} strokeDasharray="3 3" />
      <T x={566} y={100} s={9.5} w={700} fill={OK}>batch</T>
      <T x={566} y={114} s={9.5} w={700} fill={OK}>complete</T>
      <Box x={120} y={166} w={400} h={24} fill="#fdeaee" stroke="#eeb3c0" r={5} />
      <T x={320} y={182} s={9.5} fill="#8c3348">
        ✕ the SFTP file path has no equivalent signal
      </T>
    </svg>
  );
}

// The vocabulary exists; the liveness does not.
function RunState() {
  const have = ["passed", "failed", "warning", "skipped", "running", "not_run"];
  const miss = ["queued_at", "heartbeat_at", "worker_id"];
  return (
    <svg viewBox="0 0 620 186" style={{ width: "100%", display: "block" }}>
      <T x={310} y={15} s={10.5} fill="#55636f">
        guardrail_gate_run can say “running”; nothing can say “still alive”
      </T>
      <T x={38} y={44} s={9.5} w={700} fill="#55636f" a="start">status vocabulary — present</T>
      {have.map((s, i) => (
        <g key={s}>
          <Box x={38 + i * 94} y={54} w={84} h={24} r={12}
            fill={s === "running" ? "#fdf2e3" : "#eef3f8"}
            stroke={s === "running" ? "#e8c88f" : "#c6d6e4"} />
          <T x={80 + i * 94} y={70} s={9.5} w={700}
            fill={s === "running" ? WA : "#1d3c57"}>{s}</T>
        </g>
      ))}
      <T x={38} y={106} s={9.5} w={700} fill="#55636f" a="start">liveness — absent</T>
      {miss.map((s, i) => (
        <g key={s}>
          <Box x={38 + i * 120} y={116} w={108} h={24} r={12}
            fill="#fdeaee" stroke="#eeb3c0" />
          <T x={92 + i * 120} y={132} s={9.5} w={700} fill={NO}>✕ {s}</T>
        </g>
      ))}
      <T x={310} y={162} s={9.5} fill="#8c3348">
        so a dead pod leaves “running” forever, and nothing reaps it
      </T>
    </svg>
  );
}

// The step between non-production and production, and the TBD that runs
// the length of the sheet.
function Sizing() {
  const envs = [["RD DEV", 4, 2, 10], ["RD SIT", 4, 2, 10],
                ["QC · UAT", 4, 2, 10], ["PROD", 16, 16, 25]];
  return (
    <svg viewBox="0 0 620 186" style={{ width: "100%", display: "block" }}>
      <T x={310} y={15} s={10.5} fill="#55636f">
        UAT performance-tests at one-eighth of production CPU
      </T>
      {envs.map(([lab, mem, cpu, st], i) => {
        const x = 46 + i * 140, prod = lab === "PROD";
        return (
          <g key={lab}>
            <Box x={x} y={34} w={118} h={96} fill={prod ? "#e4f0fb" : "#f5f7f9"}
              stroke={prod ? "#9cc2e4" : "#dfe6e9"} />
            <T x={x + 59} y={54} s={10.5} w={700} fill="#1d3c57">{lab}</T>
            <T x={x + 59} y={77} s={15} w={700} fill={prod ? "#0f4775" : "#55636f"}>
              {cpu} CPU
            </T>
            <T x={x + 59} y={96} s={10} fill="#55636f">{mem} GB memory</T>
            <T x={x + 59} y={114} s={10} fill="#55636f">{st} GB storage</T>
            <T x={x + 59} y={146} s={9} fill={WA}>▲ Growth: TBD</T>
          </g>
        );
      })}
      <Box x={120} y={160} w={380} h={22} fill="#fdf2e3" stroke="#e8c88f" r={5} />
      <T x={310} y={175} s={9.5} fill="#7a6433">
        the Growth column reads TBD on every row of the sizing sheet
      </T>
    </svg>
  );
}

// One changeset, four places it may or may not have landed, and the
// checksum that says whether it is still the same changeset.
function Deploy() {
  const envs = [["RD DEV", true], ["RD SIT", true], ["QC · UAT", true], ["PROD", false]];
  return (
    <svg viewBox="0 0 620 176" style={{ width: "100%", display: "block" }}>
      <T x={310} y={15} s={10.5} fill="#55636f">
        guardrail_changeset_applied — one row per environment it reached
      </T>
      <Box x={38} y={34} w={150} h={76} fill="#eef3f8" stroke="#c6d6e4" />
      <T x={113} y={54} s={10.5} w={700} fill="#1d3c57">changeset</T>
      <T x={113} y={72} s={9} fill="#55636f">rollback_declared</T>
      <T x={113} y={86} s={9} fill="#55636f">data_safe</T>
      <T x={113} y={100} s={9} fill="#55636f">checksum</T>
      {envs.map(([lab, applied], i) => {
        const x = 230 + i * 96;
        return (
          <g key={lab}>
            <Box x={x} y={40} w={82} h={64} r={6}
              fill={applied ? "#e8f6ed" : "#f5f7f9"}
              stroke={applied ? "#a9d8bb" : "#dfe6e9"} />
            <T x={x + 41} y={60} s={9.5} w={700} fill="#1d3c57">{lab}</T>
            <T x={x + 41} y={82} s={11} w={700} fill={applied ? OK : "#8795a1"}>
              {applied ? "✓ applied" : "— ahead"}
            </T>
          </g>
        );
      })}
      <Arrow x1={190} x2={228} y={72} />
      <Box x={120} y={124} w={400} h={42} fill="#fdf2e3" stroke="#e8c88f" r={5} />
      <T x={320} y={142} s={9.5} w={700} fill={WA}>
        ▲ a checksum that differs between two environments
      </T>
      <T x={320} y={157} s={9} fill="#7a6433">
        means the changeset was edited after it was applied somewhere
      </T>
    </svg>
  );
}

// RD is the cluster, not an environment — the single most repeated
// misreading of this topology.
function Envs() {
  return (
    <svg viewBox="0 0 620 170" style={{ width: "100%", display: "block" }}>
      <T x={310} y={15} s={10.5} fill="#55636f">
        RD is the CLUSTER, not an environment name
      </T>
      <Box x={38} y={30} w={330} h={92} fill="#f5f7f9" stroke="#c6d6e4" r={8} />
      <T x={203} y={48} s={10} w={700} fill="#55636f">
        OCPQ shared non-production cluster
      </T>
      {[["RD DEV", 58], ["RD SIT", 168], ["QC · UAT", 278]].map(([lab, x]) => (
        <g key={lab}>
          <Box x={x} y={60} w={92} h={46} fill="#eef3f8" stroke="#c6d6e4" />
          <T x={x + 46} y={80} s={10} w={700} fill="#1d3c57">{lab}</T>
          <T x={x + 46} y={96} s={8.5} fill="#55636f">namespace</T>
        </g>
      ))}
      <Box x={404} y={30} w={178} h={92} fill="#e4f0fb" stroke="#9cc2e4" r={8} />
      <T x={493} y={48} s={10} w={700} fill="#55636f">separate cluster</T>
      <Box x={428} y={60} w={130} h={46} fill="#d2e6f7" stroke="#9cc2e4" />
      <T x={493} y={80} s={10} w={700} fill="#0f4775">PROD</T>
      <T x={493} y={96} s={8.5} fill={WA}>▲ cluster TBD</T>
      <Box x={120} y={134} w={380} h={24} fill="#eef3f8" stroke="#c6d6e4" r={5} />
      <T x={310} y={150} s={9.5} fill="#1d3c57">
        Airflow runs in all four — hosting is BBH OpenShift throughout
      </T>
    </svg>
  );
}


// ---- drawn from the BBH dbt Transformation Framework TDD -----------

// The five layers, what each one IS, and how long it keeps anything.
// The two facts people keep getting wrong: STG stores nothing, and INT
// is gone in seven days.
function Layers() {
  const L = [
    ["SWP_RAW", "Bronze", "table", "append-only", "#8a6d3b", "#f6efe4"],
    ["STG", "Silver", "VIEW", "no storage", "#1d3c57", "#eef3f8"],
    ["INT", "Silver", "table", "7 days", "#1d3c57", "#eef3f8"],
    ["DIM", "Gold", "pre-existing", "live history", "#2f6b46", "#e8f6ed"],
    ["FACT", "Gold", "pre-existing", "live history", "#2f6b46", "#e8f6ed"],
  ];
  return (
    <svg viewBox="0 0 620 196" style={{ width: "100%", display: "block" }}>
      <T x={310} y={15} s={10.5} fill="#55636f">
        STG holds no data; INT is dropped after seven days
      </T>
      {L.map(([name, band, kind, ret, ink, bg], i) => {
        const x = 20 + i * 118;
        return (
          <g key={name}>
            <T x={x + 52} y={34} s={8.5} fill="#8795a1">{band}</T>
            <Box x={x} y={40} w={104} h={62} fill={bg} stroke="#c6d6e4" />
            <T x={x + 52} y={62} s={11.5} w={700} fill={ink}>{name}</T>
            <T x={x + 52} y={79} s={9} fill="#55636f">{kind}</T>
            <T x={x + 52} y={94} s={9} w={700} fill={ink}>{ret}</T>
            {i < 4 && <Arrow x1={x + 104} x2={x + 118} y={71} />}
          </g>
        );
      })}
      <Box x={138} y={118} w={222} h={26} fill="#fdeaee" stroke="#eeb3c0" r={5} />
      <T x={249} y={135} s={9.5} fill="#8c3348">
        ✕ FAIL rows stop here — Source DQ filter
      </T>
      <Box x={20} y={158} w={580} h={28} fill="#fdf2e3" stroke="#e8c88f" r={5} />
      <T x={310} y={176} s={9.5} fill="#7a6433">
        ▲ replay re-derives from INT, and INT keeps only 7 days — the two
        facts have to be read together
      </T>
    </svg>
  );
}

// Three vocabularies over one pipeline. This is the actual reason
// question 1 is hard to answer: nobody is wrong, they are using
// different documents' words for the same boxes.
function Terms() {
  const rows = [
    ["BBH today", ["Source", "STG1", "STG2", "DIM / FACT"], "#55636f"],
    ["dbt TDD", ["SWP_RAW", "STG (view)", "INT", "DIM → FACT"], "#0f4775"],
    ["SEI pack", ["—", "Stage 1", "Stage 2", "IMDS / PBDW"], "#7c3aed"],
  ];
  return (
    <svg viewBox="0 0 620 186" style={{ width: "100%", display: "block" }}>
      <T x={310} y={15} s={10.5} fill="#55636f">
        one pipeline, three vocabularies — and “enriched” is a fourth
      </T>
      {rows.map(([label, cells, ink], r) => (
        <g key={label}>
          <T x={86} y={46 + r * 40} s={9.5} w={700} fill="#55636f" a="end">{label}</T>
          {cells.map((c, i) => (
            <g key={i}>
              <Box x={96 + i * 128} y={30 + r * 40} w={118} h={24} r={5}
                fill={r === 1 ? "#e4f0fb" : "#f5f7f9"}
                stroke={r === 1 ? "#9cc2e4" : "#dfe6e9"} />
              <T x={155 + i * 128} y={46 + r * 40} s={9.5} w={700} fill={ink}>{c}</T>
            </g>
          ))}
        </g>
      ))}
      <Box x={224} y={150} w={376} h={30} fill="#fdf2e3" stroke="#e8c88f" r={5} />
      <T x={412} y={163} s={9.5} w={700} fill={WA}>
        ▲ “Silver (Enriched)” in the TDD = STG + INT, not one layer
      </T>
      <T x={412} y={175} s={8.5} fill="#7a6433">
        so “the enriched layer” names two objects, one of which stores nothing
      </T>
      <line x1={288} y1={118} x2={288} y2={150} stroke="#e8c88f" strokeDasharray="2 2" />
      <line x1={416} y1={118} x2={416} y2={150} stroke="#e8c88f" strokeDasharray="2 2" />
    </svg>
  );
}

// One store, two categories, and the replay that closes it.
function DqStore() {
  return (
    <svg viewBox="0 0 620 210" style={{ width: "100%", display: "block" }}>
      <T x={310} y={15} s={10.5} fill="#55636f">
        two categories, two owners, ONE store
      </T>
      <Box x={20} y={30} w={270} h={44} fill="#fdeaee" stroke="#eeb3c0" />
      <T x={155} y={48} s={10} w={700} fill={NO}>SOURCE DQ · owner SWP</T>
      <T x={155} y={64} s={9} fill="#8c3348">the incoming record is malformed</T>
      <Box x={330} y={30} w={270} h={44} fill="#fdf2e3" stroke="#e8c88f" />
      <T x={465} y={48} s={10} w={700} fill={WA}>TRANSFORMATION DQ · owner BBH/SEI</T>
      <T x={465} y={64} s={9} fill="#7a6433">source-clean, but our logic could not resolve it</T>

      <Arrow x1={155} x2={200} y={92} c="#c1113a" />
      <Arrow x1={465} x2={420} y={92} c="#b4620f" />
      <Box x={200} y={84} w={220} h={44} fill="#eef3f8" stroke="#c6d6e4" />
      <T x={310} y={102} s={10.5} w={700} fill="#1d3c57">DQ_VALIDATION_FAILURE</T>
      <T x={310} y={118} s={8.5} fill="#55636f">
        reprocess_eligible · resolution_status
      </T>

      <Box x={20} y={146} w={270} h={46} fill="#f5f7f9" stroke="#dfe6e9" />
      <T x={155} y={164} s={9.5} w={700} fill="#55636f">eligible = N</T>
      <T x={155} y={180} s={9} fill="#55636f">stays OPEN until the source resends</T>
      <Box x={330} y={146} w={270} h={46} fill="#e8f6ed" stroke="#a9d8bb" />
      <T x={465} y={164} s={9.5} w={700} fill={OK}>✓ eligible = Y</T>
      <T x={465} y={180} s={9} fill="#3b6b4c">re-derived from INT, flips to RESOLVED</T>
      <line x1={260} y1={128} x2={155} y2={146} stroke="#8795a1" strokeDasharray="2 2" />
      <line x1={360} y1={128} x2={465} y2={146} stroke="#8795a1" strokeDasharray="2 2" />
    </svg>
  );
}

// The four boundaries, each with the equation that has to hold.
function Recon() {
  const B = [
    ["SWP_RAW → STG", "RAW rows = STG rows", "the view exposes all; FAIL rows carry the flag"],
    ["STG → INT", "STG PASS = INT rows", "STG = INT + Source-DQ-filtered"],
    ["INT → DIM", "NEW + CHANGED = inserts", "CHANGED = row closures (ACTIVE_IND 1→0)"],
    ["INT → FACT", "eligible = loaded + OPEN", "nothing loaded with a placeholder key"],
  ];
  return (
    <svg viewBox="0 0 620 192" style={{ width: "100%", display: "block" }}>
      <T x={310} y={15} s={10.5} fill="#55636f">
        four boundaries, each an equation that must hold or it is a WARNING
      </T>
      {B.map(([b, eq, note], i) => {
        const y = 28 + i * 40;
        return (
          <g key={b}>
            <Box x={20} y={y} w={140} h={32} fill="#eef3f8" stroke="#c6d6e4" r={5} />
            <T x={90} y={y + 20} s={9.5} w={700} fill="#1d3c57">{b}</T>
            <Arrow x1={160} x2={180} y={y + 16} />
            <T x={186} y={y + 14} s={10} w={700} fill="#2b3a47" a="start">{eq}</T>
            <T x={186} y={y + 27} s={8.5} fill="#8795a1" a="start">{note}</T>
          </g>
        );
      })}
      <Box x={20} y={190 - 18} w={580} h={0} fill="none" stroke="none" />
    </svg>
  );
}

// PENDING -> TRIGGER -> COMPLETE, and the state nothing reaps.
function DateCtl() {
  return (
    <svg viewBox="0 0 620 176" style={{ width: "100%", display: "block" }}>
      <T x={310} y={15} s={10.5} fill="#55636f">
        one row per business date; the date advances only on full success
      </T>
      {[["PENDING", 40, "#eef3f8", "#1d3c57", "files arriving"],
        ["TRIGGER", 240, "#fdf2e3", WA, "transformation invoked"],
        ["COMPLETE", 440, "#e8f6ed", OK, "next date seeded"]].map(
        ([lab, x, bg, ink, sub]) => (
          <g key={lab}>
            <Box x={x} y={38} w={140} h={46} fill={bg} stroke="#c6d6e4" />
            <T x={x + 70} y={60} s={11} w={700} fill={ink}>{lab}</T>
            <T x={x + 70} y={76} s={8.5} fill="#55636f">{sub}</T>
          </g>
        ))}
      <Arrow x1={180} x2={240} y={61} />
      <Arrow x1={380} x2={440} y={61} />
      <T x={210} y={34} s={8} fill="#8795a1">ingestion</T>
      <T x={410} y={34} s={8} fill="#8795a1">transformation</T>
      <Box x={150} y={100} w={320} h={44} fill="#fdeaee" stroke="#eeb3c0" r={5} />
      <T x={310} y={118} s={9.5} w={700} fill={NO}>
        ✕ ingestion acts only on PENDING rows
      </T>
      <T x={310} y={133} s={9} fill="#8c3348">
        so a date stuck in TRIGGER is never re-triggered by ingestion
      </T>
      <T x={310} y={162} s={9} fill="#55636f">
        on failure the run holds at TRIGGER and restarts from the failed task
      </T>
    </svg>
  );
}

// The rule that decides whether a correction may MERGE at all.
function Scd2() {
  return (
    <svg viewBox="0 0 620 182" style={{ width: "100%", display: "block" }}>
      <T x={310} y={15} s={10.5} fill="#55636f">
        reprocessing a corrected record: the write mechanism depends on the row
      </T>
      <Box x={30} y={32} w={250} h={64} fill="#e8f6ed" stroke="#a9d8bb" />
      <T x={155} y={52} s={10} w={700} fill={OK}>ACTIVE_IND = 1 still open</T>
      <T x={155} y={68} s={9} fill="#3b6b4c">on the failed business date</T>
      <T x={155} y={86} s={10.5} w={700} fill={OK}>✓ normal MERGE</T>
      <Box x={340} y={32} w={250} h={64} fill="#fdeaee" stroke="#eeb3c0" />
      <T x={465} y={52} s={10} w={700} fill={NO}>a later change already closed it</T>
      <T x={465} y={68} s={9} fill="#8c3348">ACTIVE_IND = 0</T>
      <T x={465} y={86} s={10.5} w={700} fill={NO}>✕ UPDATE that row, never MERGE</T>
      <Box x={90} y={112} w={440} h={44} fill="#fdf2e3" stroke="#e8c88f" r={5} />
      <T x={310} y={130} s={9.5} w={700} fill={WA}>
        ▲ a MERGE against a closed interval REOPENS it
      </T>
      <T x={310} y={146} s={9} fill="#7a6433">
        which silently rewrites history that downstream reports already used
      </T>
      <T x={310} y={172} s={8.5} fill="#8795a1">
        MERGE joins on ACCOUNT_KEY, never the natural key (ORA-30926)
      </T>
    </svg>
  );
}

export const FIGS = { rollback: Rollback, hops: Hops, markers: Markers,
  runstate: RunState, sizing: Sizing, deploy: Deploy, envs: Envs,
  layers: Layers, terms: Terms, dqstore: DqStore, recon: Recon,
  datectl: DateCtl, scd2: Scd2 };

export const FIG_NAMES = Object.keys(FIGS);
