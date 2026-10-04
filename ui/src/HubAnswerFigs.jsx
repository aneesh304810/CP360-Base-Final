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

export const FIGS = { rollback: Rollback, hops: Hops, markers: Markers,
  runstate: RunState, sizing: Sizing, deploy: Deploy, envs: Envs };

export const FIG_NAMES = Object.keys(FIGS);
