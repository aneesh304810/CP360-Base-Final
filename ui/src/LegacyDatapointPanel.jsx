// LegacyDatapointPanel.jsx — Non-SEI view for Datapoint 360.
// Left rail: one card per normalized field (duplicates collapsed server-side).
// Right pane: physical tables carrying the field + business definition(s).
// Styling matches the existing CP 360 look: white cards, slate text, the
// purple system accent, KEY/PII chips, IN/OUT-style badges.

import { useEffect, useMemo, useState } from "react";
import {
  fetchLegacyDatapoints,
  fetchLegacyDatapointDetail,
  fetchLegacySummary,
} from "../../api/legacyReference";

const SYSTEM_ACCENT = {
  ADDVANTAGE: "#7c6fd8",
  CRD: "#3b7dd8",
  STAR: "#b0642a",
};

export default function LegacyDatapointPanel({ system = "ADDVANTAGE" }) {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [q, setQ] = useState("");
  const [piiOnly, setPiiOnly] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const accent = SYSTEM_ACCENT[system] || SYSTEM_ACCENT.ADDVANTAGE;

  // Debounced list fetch
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    const t = setTimeout(() => {
      fetchLegacyDatapoints({ system, q, piiOnly })
        .then((res) => {
          if (!alive) return;
          setItems(res.items || []);
          // Keep selection if it survives the filter; else pick first
          setSelected((prev) => {
            const still = (res.items || []).find(
              (i) => i.normalized === prev
            );
            return still ? prev : res.items?.[0]?.normalized ?? null;
          });
        })
        .catch((e) => alive && setError(String(e.message || e)))
        .finally(() => alive && setLoading(false));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [system, q, piiOnly]);

  useEffect(() => {
    let alive = true;
    fetchLegacySummary({ system })
      .then((s) => alive && setSummary(s))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [system]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    let alive = true;
    fetchLegacyDatapointDetail({ system, name: selected })
      .then((d) => alive && setDetail(d))
      .catch((e) => alive && setError(String(e.message || e)));
    return () => {
      alive = false;
    };
  }, [system, selected]);

  const definedPct = useMemo(() => {
    if (!summary?.distinct_fields) return null;
    return Math.round(
      (100 * (summary.defined_fields || 0)) / summary.distinct_fields
    );
  }, [summary]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header cards — legacy replacement for Inbound/Outbound feed cards */}
      <div style={{ display: "flex", gap: 12 }}>
        <SummaryCard
          title="Field inventory"
          sub={`${system} · source: legacy dictionary`}
          value={summary?.distinct_fields}
          accent={accent}
        />
        <SummaryCard
          title="Business definitions"
          sub={
            definedPct == null
              ? "coverage"
              : `${definedPct}% of fields defined`
          }
          value={summary?.defined_fields}
          accent="#8a8f9c"
        />
        <SummaryCard
          title="PII fields"
          sub="privacy-classified"
          value={summary?.pii_fields}
          accent="#c04b4b"
        />
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search attribute / field code…"
          style={{
            flex: "0 0 340px",
            padding: "8px 12px",
            border: "1px solid #d6d9e0",
            borderRadius: 6,
            fontSize: 14,
          }}
        />
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "#4b5160",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={piiOnly}
            onChange={(e) => setPiiOnly(e.target.checked)}
          />
          PII only
        </label>
        {loading && (
          <span style={{ fontSize: 12, color: "#8a8f9c" }}>Loading…</span>
        )}
      </div>

      {error && (
        <div
          style={{
            padding: "10px 14px",
            background: "#fdecec",
            border: "1px solid #e8b4b4",
            borderRadius: 6,
            color: "#8c2f2f",
            fontSize: 13,
          }}
        >
          Couldn't load legacy datapoints: {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        {/* Left rail */}
        <div
          style={{
            flex: "0 0 360px",
            maxHeight: 560,
            overflowY: "auto",
            border: "1px solid #e2e5ea",
            borderRadius: 8,
          }}
        >
          {items.length === 0 && !loading && (
            <div style={{ padding: 20, fontSize: 13, color: "#8a8f9c" }}>
              No fields match. Clear the search or the PII filter to see the
              full {system} inventory.
            </div>
          )}
          {items.map((it) => (
            <button
              key={it.normalized}
              onClick={() => setSelected(it.normalized)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "10px 14px",
                border: "none",
                borderBottom: "1px solid #eef0f4",
                background:
                  selected === it.normalized ? "#f0f1fb" : "transparent",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#2b3040",
                    fontFamily: "inherit",
                  }}
                >
                  {it.datapoint}
                  {it.is_pii === "Y" && <Chip text="PII" bg="#c04b4b" />}
                </span>
                <span style={{ fontSize: 12, color: "#8a8f9c" }}>
                  {it.occurrences}×
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#8a8f9c", marginTop: 2 }}>
                {it.module_count} table{it.module_count === 1 ? "" : "s"}
                {it.has_definition !== "Y" && " · no definition"}
              </div>
            </button>
          ))}
        </div>

        {/* Detail pane */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {detail ? (
            <DetailPane detail={detail} accent={accent} />
          ) : (
            <div style={{ padding: 24, fontSize: 13, color: "#8a8f9c" }}>
              Select a field to see where it lives and its business definition.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailPane({ detail, accent }) {
  return (
    <div>
      <h2 style={{ margin: "0 0 4px", fontSize: 22, color: "#2b3040" }}>
        {detail.datapoint}
      </h2>
      <div style={{ fontSize: 13, color: "#6b7180", marginBottom: 16 }}>
        normalized: {detail.normalized} · {detail.occurrence_count} occurrence
        {detail.occurrence_count === 1 ? "" : "s"} across {detail.module_count}{" "}
        table{detail.module_count === 1 ? "" : "s"}
      </div>

      {/* Business definitions — one section per master */}
      {detail.definitions?.length > 0 ? (
        detail.definitions.map((d, i) => (
          <div
            key={i}
            style={{
              border: "1px solid #e2e5ea",
              borderLeft: `3px solid ${accent}`,
              borderRadius: 8,
              padding: "12px 16px",
              marginBottom: 12,
              background: "#fff",
            }}
          >
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                color: "#8a8f9c",
                marginBottom: 4,
              }}
            >
              {d.master_name || "Business definition"}
            </div>
            {d.business_term && (
              <div
                style={{ fontSize: 15, fontWeight: 600, color: "#2b3040" }}
              >
                {d.business_term}
              </div>
            )}
            {d.short_desc && (
              <p
                style={{
                  fontSize: 13,
                  color: "#4b5160",
                  margin: "6px 0 0",
                  lineHeight: 1.5,
                }}
              >
                {d.short_desc}
              </p>
            )}
            <div
              style={{
                display: "flex",
                gap: 14,
                marginTop: 8,
                fontSize: 12,
                color: "#6b7180",
                flexWrap: "wrap",
              }}
            >
              {d.data_type && <span>Type: {d.data_type}</span>}
              {d.max_length && <span>Len: {d.max_length}</span>}
              {d.is_required === "Y" && <span>Required</span>}
              {d.privacy_class && <span>Privacy: {d.privacy_class}</span>}
              {d.regulatory_class && (
                <span>Regulatory: {d.regulatory_class}</span>
              )}
              {d.pb_field_mapping && (
                <span>PB mapping: {d.pb_field_mapping}</span>
              )}
            </div>
          </div>
        ))
      ) : (
        <div
          style={{
            border: "1px dashed #d6d9e0",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 12,
            fontSize: 13,
            color: "#8a8f9c",
          }}
        >
          No business definition yet for this field.
        </div>
      )}

      {/* Physical occurrences */}
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          color: "#8a8f9c",
          margin: "16px 0 8px",
        }}
      >
        Physical tables · {detail.occurrence_count}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ color: "#8a8f9c", textAlign: "left" }}>
            <th style={th}>Table</th>
            <th style={th}>DWH type</th>
            <th style={th}>Len</th>
            <th style={th}>Functional group</th>
            <th style={th}>Status</th>
            <th style={th}>Source chain</th>
          </tr>
        </thead>
        <tbody>
          {detail.occurrences.map((o, i) => (
            <tr key={i} style={{ borderTop: "1px solid #eef0f4" }}>
              <td style={{ ...td, fontFamily: "monospace" }}>
                {o.dwh_target_table}
              </td>
              <td style={td}>{o.dwh_type || "—"}</td>
              <td style={td}>{o.dwh_length || "—"}</td>
              <td style={td}>{o.functional_group || "Unassigned"}</td>
              <td style={td}>{o.lineage_status || "—"}</td>
              <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>
                {sourceChain(o)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function sourceChain(o) {
  const hops = [
    o.src_source_table && `${o.src_source_table}.${o.src_source_column ?? ""}`,
    o.stg1_source_table &&
      `${o.stg1_source_table}.${o.stg1_source_column ?? ""}`,
    o.stg2_source_table &&
      `${o.stg2_source_table}.${o.stg2_source_column ?? ""}`,
  ].filter(Boolean);
  return hops.length ? hops.join(" → ") : "—";
}

function SummaryCard({ title, sub, value, accent }) {
  return (
    <div
      style={{
        flex: 1,
        border: "1px solid #e2e5ea",
        borderTop: `3px solid ${accent}`,
        borderRadius: 8,
        padding: "14px 18px",
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 600, color: "#2b3040" }}>
        {title}
      </div>
      <div style={{ fontSize: 12, color: "#8a8f9c" }}>{sub}</div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 600,
          color: accent,
          marginTop: 6,
        }}
      >
        {value ?? "—"}
      </div>
    </div>
  );
}

function Chip({ text, bg }) {
  return (
    <span
      style={{
        display: "inline-block",
        marginLeft: 8,
        padding: "1px 6px",
        borderRadius: 4,
        background: bg,
        color: "#fff",
        fontSize: 10,
        fontWeight: 700,
        verticalAlign: "middle",
      }}
    >
      {text}
    </span>
  );
}

const th = { padding: "6px 10px", fontWeight: 500, fontSize: 12 };
const td = { padding: "8px 10px", color: "#2b3040" };
