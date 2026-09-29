import React, { useState, useEffect, useMemo, useCallback } from "react";
import { securityApi } from "./securityApi.js";

// Admin · Security Entitlement.
//
// THE SCREEN IS A SENTENCE: this person may open these modules. One
// person at a time, tick boxes, Save. There are no roles to compose and
// no groups to trace, so the answer to "why can Ana see Variance 360" is
// visible on this page rather than assembled from four others.
//
// SAVE IS EXPLICIT, AND SAYS WHAT IT WILL DO. Ticking a box changes
// nothing until Save, and the button names the count in each direction
// ("grant 3, revoke 1"). An entitlement screen that writes on every click
// produces audit rows for hesitation, and gives an administrator no
// moment to notice they are about to revoke the wrong row.
//
// WHAT IS NOT HERE. No password field, no unlock, no group sync: AD owns
// all of that and CP 360 cannot change it. The only credential-shaped
// control on the page is Disable, which stops a CP 360 sign-in and leaves
// the person's grants intact, so re-enabling a returning colleague does
// not mean rebuilding their access from memory.

const CHIP = (t, kind) => ({
  fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: t.radius.pill,
  letterSpacing: ".3px", textTransform: "uppercase", whiteSpace: "nowrap",
  ...(kind === "admin" ? { background: "rgba(15,71,117,.1)", color: "#0f4775" }
    : kind === "off" ? { background: "rgba(193,17,58,.1)", color: "#c1113a" }
    : kind === "warn" ? { background: "rgba(232,163,61,.15)", color: "#8a6d1f" }
    : { background: "rgba(26,143,76,.12)", color: "#1a8f4c" }),
});

function Banner({ t, tone, title, children }) {
  const c = tone === "bad" ? "#c1113a" : tone === "warn" ? "#e8a33d" : "#1a8f4c";
  return (
    <div style={{ border: `1px solid ${c}`, borderLeft: `4px solid ${c}`,
      background: `${c}12`, borderRadius: t.radius.md, padding: "10px 13px",
      marginBottom: 16, fontSize: 12.5, lineHeight: 1.5, color: t.text }}>
      <b style={{ color: c }}>{title}</b> {children}
    </div>
  );
}

export default function SecurityAdmin({ t }) {
  const [health, setHealth] = useState(null);
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [modules, setModules] = useState([]);
  const [sel, setSel] = useState(null);       // user_id
  const [detail, setDetail] = useState(null); // {user, modules}
  const [ticked, setTicked] = useState(new Set());
  const [audit, setAudit] = useState([]);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newUser, setNewUser] = useState({ user_id: "", display_name: "" });

  const load = useCallback(async () => {
    setErr("");
    try {
      const [h, m, u] = await Promise.all([
        securityApi.health(), securityApi.modules(), securityApi.users(q),
      ]);
      setHealth(h); setModules(m.modules || []); setUsers(u.users || []);
    } catch (e) { setErr(e.message); }
  }, [q]);

  useEffect(() => { load(); }, [load]);

  const open = async (id) => {
    setSel(id); setErr(""); setNote("");
    try {
      const d = await securityApi.user(id);
      setDetail(d);
      setTicked(new Set(d.modules || []));
      securityApi.audit(id, 25).then((a) => setAudit(a.audit || []))
        .catch(() => setAudit([]));
    } catch (e) { setErr(e.message); setDetail(null); }
  };

  // What Save will actually do, computed from the two sets rather than
  // tracked as the boxes are clicked: a counter that is incremented and
  // decremented drifts, and this cannot.
  const held = useMemo(() => new Set(detail ? detail.modules || [] : []), [detail]);
  const toGrant = useMemo(
    () => [...ticked].filter((k) => !held.has(k)).sort(), [ticked, held]);
  const toRevoke = useMemo(
    () => [...held].filter((k) => !ticked.has(k)).sort(), [ticked, held]);
  const dirty = toGrant.length + toRevoke.length > 0;

  const save = async () => {
    if (!detail || !dirty) return;
    setBusy(true); setErr("");
    try {
      await securityApi.saveGrants(detail.user.user_id, [...ticked], note || null);
      await open(detail.user.user_id);
      await load();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const setStanding = async (patch) => {
    if (!detail) return;
    setBusy(true); setErr("");
    try {
      await securityApi.saveUser({ user_id: detail.user.user_id, ...patch });
      await open(detail.user.user_id);
      await load();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const addPerson = async () => {
    const id = (newUser.user_id || "").trim();
    if (!id) { setErr("An account name is required."); return; }
    setBusy(true); setErr("");
    try {
      await securityApi.saveUser({ user_id: id,
        display_name: (newUser.display_name || "").trim() || id });
      setAdding(false); setNewUser({ user_id: "", display_name: "" });
      await load(); await open(id.toUpperCase());
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const byGroup = useMemo(() => {
    const out = new Map();
    modules.forEach((m) => {
      const g = m.nav_group || "General";
      if (!out.has(g)) out.set(g, []);
      out.get(g).push(m);
    });
    return [...out.entries()];
  }, [modules]);

  const card = { background: t.panel, border: `1px solid ${t.border}`,
                 borderRadius: t.radius.md };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 500, color: t.accent,
        borderBottom: `2px solid ${t.accent}`, paddingBottom: 14,
        margin: "0 0 8px" }}>Security Entitlement</h1>
      <p style={{ fontSize: 12.5, color: t.sub, margin: "0 0 18px",
                  maxWidth: 780, lineHeight: 1.55 }}>
        Active Directory decides <b>who somebody is</b>. This screen decides{" "}
        <b>what they may open</b>. A person appears here the first time they
        sign in, with no modules; tick what they need and press Save.
      </p>

      {health && !health.enforcing && (
        <Banner t={t} tone="bad" title="Enforcement is off.">
          Every request is being served with full rights and no sign-in.
          Set <code>CP_SECURITY=on</code> on the API once AD is configured —
          until then these grants are recorded but not applied.
        </Banner>
      )}
      {health && health.enforcing && !health.admins && (
        <Banner t={t} tone="warn" title="No administrator.">
          Enforcement is on and no active administrator exists. Nobody can
          reach this screen through the app — seed the first one with the
          INSERT at the foot of <code>sql/64_security.sql</code>.
        </Banner>
      )}
      {health && !health.ready && (
        <Banner t={t} tone="warn" title="Schema incomplete.">
          One or more security tables are missing. Run{" "}
          <code>sql/64_security.sql</code> against the catalogue schema.
        </Banner>
      )}
      {err && <Banner t={t} tone="bad" title="That did not save.">{err}</Banner>}

      <div style={{ display: "flex", gap: 18, alignItems: "flex-start",
                    flexWrap: "wrap" }}>

        {/* ---- people ---- */}
        <div style={{ ...card, width: 320, flexShrink: 0 }}>
          <div style={{ padding: "10px 12px", borderBottom: `1px solid ${t.border}`,
                        display: "flex", gap: 8, alignItems: "center" }}>
            <input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Find a person…"
              style={{ flex: 1, minWidth: 0, padding: "6px 9px", fontSize: 12.5,
                border: `1px solid ${t.border}`, borderRadius: t.radius.md,
                fontFamily: t.font }} />
            <button onClick={() => setAdding((a) => !a)}
              style={{ border: `1px solid ${t.border}`, background: t.panel,
                borderRadius: t.radius.md, cursor: "pointer", fontSize: 12,
                padding: "6px 9px", color: t.accent, whiteSpace: "nowrap" }}>
              + Add
            </button>
          </div>

          {adding && (
            <div style={{ padding: 12, borderBottom: `1px solid ${t.border}`,
                          background: t.bg }}>
              <div style={{ fontSize: 11, color: t.sub, marginBottom: 7,
                            lineHeight: 1.45 }}>
                Adding someone here grants nothing — it lets you tick their
                modules before their first sign-in. They still sign in with
                their AD account.
              </div>
              <input value={newUser.user_id} placeholder="AD account (a.nair)"
                onChange={(e) => setNewUser({ ...newUser, user_id: e.target.value })}
                style={{ width: "100%", boxSizing: "border-box", padding: "6px 9px",
                  fontSize: 12.5, marginBottom: 6, fontFamily: t.font,
                  border: `1px solid ${t.border}`, borderRadius: t.radius.md }} />
              <input value={newUser.display_name} placeholder="Name (optional)"
                onChange={(e) => setNewUser({ ...newUser, display_name: e.target.value })}
                style={{ width: "100%", boxSizing: "border-box", padding: "6px 9px",
                  fontSize: 12.5, marginBottom: 8, fontFamily: t.font,
                  border: `1px solid ${t.border}`, borderRadius: t.radius.md }} />
              <button onClick={addPerson} disabled={busy}
                style={{ border: "none", background: t.accent, color: "#fff",
                  borderRadius: t.radius.md, cursor: "pointer", fontSize: 12.5,
                  padding: "7px 12px", fontFamily: t.font }}>Add person</button>
            </div>
          )}

          <div style={{ maxHeight: 620, overflowY: "auto" }}>
            {!users.length && (
              <div style={{ padding: 16, fontSize: 12.5, color: t.sub,
                            lineHeight: 1.5 }}>
                Nobody has signed in yet. People appear here automatically
                after their first sign-in, or add one above.
              </div>
            )}
            {users.map((u) => {
              const on = sel === u.user_id;
              return (
                <div key={u.user_id} onClick={() => open(u.user_id)}
                  style={{ padding: "9px 12px", cursor: "pointer",
                    borderBottom: `1px solid ${t.border}44`,
                    background: on ? `${t.accent}12` : "transparent",
                    borderLeft: `3px solid ${on ? t.accent : "transparent"}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <b style={{ fontSize: 13, color: t.text }}>
                      {u.display_name || u.user_id}</b>
                    {u.is_admin === "Y" && <span style={CHIP(t, "admin")}>admin</span>}
                    {u.status !== "ACTIVE" && <span style={CHIP(t, "off")}>disabled</span>}
                  </div>
                  <div style={{ fontSize: 11, color: t.sub, marginTop: 2 }}>
                    {u.user_id} ·{" "}
                    {u.is_admin === "Y" ? "all modules"
                      : u.grant_count ? `${u.grant_count} module${u.grant_count === 1 ? "" : "s"}`
                      : "no modules yet"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ---- one person's modules ---- */}
        <div style={{ ...card, flex: 1, minWidth: 420 }}>
          {!detail && (
            <div style={{ padding: 28, fontSize: 13, color: t.sub,
                          lineHeight: 1.6 }}>
              Choose a person on the left to see and change what they can
              open.
            </div>
          )}

          {detail && (
            <>
              <div style={{ padding: "12px 16px",
                            borderBottom: `1px solid ${t.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9,
                              flexWrap: "wrap" }}>
                  <b style={{ fontSize: 16 }}>
                    {detail.user.display_name || detail.user.user_id}</b>
                  <span style={{ fontSize: 12, color: t.sub }}>
                    {detail.user.user_id}</span>
                  {detail.user.is_admin === "Y" && <span style={CHIP(t, "admin")}>administrator</span>}
                  <span style={CHIP(t, detail.user.status === "ACTIVE" ? "ok" : "off")}>
                    {detail.user.status === "ACTIVE" ? "active" : "disabled"}</span>
                  <span style={{ marginLeft: "auto", display: "flex", gap: 7 }}>
                    <button onClick={() => setStanding({
                        status: detail.user.status === "ACTIVE" ? "DISABLED" : "ACTIVE" })}
                      disabled={busy}
                      style={{ border: `1px solid ${t.border}`, background: t.panel,
                        borderRadius: t.radius.md, cursor: "pointer", fontSize: 12,
                        padding: "5px 10px", color: t.text }}>
                      {detail.user.status === "ACTIVE" ? "Disable" : "Enable"}
                    </button>
                    <button onClick={() => setStanding({
                        is_admin: detail.user.is_admin !== "Y" })}
                      disabled={busy}
                      style={{ border: `1px solid ${t.border}`, background: t.panel,
                        borderRadius: t.radius.md, cursor: "pointer", fontSize: 12,
                        padding: "5px 10px", color: t.text }}>
                      {detail.user.is_admin === "Y"
                        ? "Remove administrator" : "Make administrator"}
                    </button>
                  </span>
                </div>
                {detail.user.is_admin === "Y" && (
                  <div style={{ fontSize: 11.5, color: t.sub, marginTop: 7,
                                lineHeight: 1.45 }}>
                    An administrator can open every module regardless of the
                    ticks below, and can change anyone's access — including
                    their own. The ticks are kept, so removing administrator
                    leaves them with exactly what is checked here.
                  </div>
                )}
              </div>

              <div style={{ padding: "6px 16px 16px" }}>
                {byGroup.map(([g, items]) => (
                  <div key={g} style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: t.sub,
                      textTransform: "uppercase", letterSpacing: ".5px",
                      marginBottom: 6 }}>{g}</div>
                    <div style={{ display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                      gap: 6 }}>
                      {items.map((m) => {
                        const free = m.open_to_all === "Y";
                        const on = free || ticked.has(m.module_key);
                        return (
                          <label key={m.module_key}
                            title={m.description || ""}
                            style={{ display: "flex", gap: 8, alignItems: "flex-start",
                              padding: "7px 9px", borderRadius: t.radius.md,
                              border: `1px solid ${on ? t.accent + "55" : t.border}`,
                              background: on ? `${t.accent}09` : t.panel,
                              cursor: free ? "default" : "pointer",
                              opacity: free ? 0.75 : 1 }}>
                            <input type="checkbox" checked={on} disabled={free}
                              onChange={(e) => {
                                const next = new Set(ticked);
                                if (e.target.checked) next.add(m.module_key);
                                else next.delete(m.module_key);
                                setTicked(next);
                              }}
                              style={{ marginTop: 2 }} />
                            <span style={{ minWidth: 0 }}>
                              <span style={{ fontSize: 13, color: t.text }}>
                                {m.module_name}</span>
                              {free && <span style={{ fontSize: 10.5, color: t.sub,
                                marginLeft: 6 }}>everyone</span>}
                              {m.description && (
                                <div style={{ fontSize: 11, color: t.sub,
                                  lineHeight: 1.4, marginTop: 1 }}>
                                  {m.description}</div>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ padding: "11px 16px", borderTop: `1px solid ${t.border}`,
                background: t.bg, display: "flex", alignItems: "center", gap: 10,
                flexWrap: "wrap", position: "sticky", bottom: 0 }}>
                <input value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="Why (optional — recorded against the grant)"
                  style={{ flex: 1, minWidth: 200, padding: "6px 9px", fontSize: 12.5,
                    border: `1px solid ${t.border}`, borderRadius: t.radius.md,
                    fontFamily: t.font }} />
                <span style={{ fontSize: 12, color: t.sub }}>
                  {dirty
                    ? `grant ${toGrant.length}, revoke ${toRevoke.length}`
                    : "no changes"}
                </span>
                <button onClick={save} disabled={!dirty || busy}
                  style={{ border: "none", borderRadius: t.radius.md,
                    cursor: dirty && !busy ? "pointer" : "default",
                    background: dirty && !busy ? t.accent : t.disabled,
                    color: "#fff", fontSize: 13, fontWeight: 600,
                    padding: "8px 16px", fontFamily: t.font }}>
                  {busy ? "Saving…" : "Save"}
                </button>
              </div>

              {audit.length > 0 && (
                <div style={{ padding: "12px 16px 16px",
                              borderTop: `1px solid ${t.border}` }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: t.sub,
                    textTransform: "uppercase", letterSpacing: ".5px",
                    marginBottom: 7 }}>Recent activity</div>
                  <table style={{ width: "100%", borderCollapse: "collapse",
                                  fontSize: 11.5 }}>
                    <tbody>
                      {audit.map((a, i) => (
                        <tr key={i} style={{ borderTop: `1px solid ${t.border}33` }}>
                          <td style={{ padding: "4px 8px 4px 0", color: t.sub,
                            whiteSpace: "nowrap" }}>
                            {String(a.at_ts || "").replace("T", " ").slice(0, 19)}</td>
                          <td style={{ padding: "4px 8px", fontWeight: 600 }}>
                            {a.action}</td>
                          <td style={{ padding: "4px 8px" }}>{a.module_key || ""}</td>
                          <td style={{ padding: "4px 8px", color: t.sub }}>
                            {a.actor}</td>
                          <td style={{ padding: "4px 0", textAlign: "right" }}>
                            {a.outcome !== "OK" && (
                              <span style={CHIP(t, "off")}>{a.outcome}</span>)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
