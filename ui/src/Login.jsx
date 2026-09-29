import React, { useState, useEffect } from "react";
import { securityApi } from "./securityApi.js";

// The sign-in screen.
//
// WHAT IT DELIBERATELY DOES NOT DO. No "forgot password" link and no
// "create account": the password is Active Directory's and CP 360 has no
// way to change it, so a link here would send people down a path that
// ends nowhere. The footnote says whose password it is instead, because
// the most common failed login is somebody typing the wrong one of the
// two they have.
//
// ERRORS ARE SHOWN VERBATIM FROM THE SERVER. "Not accepted", "disabled",
// "directory unreachable" are three different problems with three
// different people to call, and collapsing them into "login failed" costs
// somebody an afternoon. What the server will not distinguish -- a wrong
// password from a wrong username -- stays undistinguished, because that
// one is a probe.

export default function Login({ t, onSignedIn }) {
  // Posture, not content: whether the schema is loaded and whether an
  // administrator exists. /security/health is open for exactly this —
  // an operator locked out by a missing bootstrap row needs to be told
  // so on the screen that is refusing them, not in a log they cannot
  // reach.
  const [health, setHealth] = useState(null);
  useEffect(() => { securityApi.health().then(setHealth).catch(() => {}); }, []);
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    if (e) e.preventDefault();
    if (!u.trim() || !p) { setErr("Enter your account name and password."); return; }
    setBusy(true); setErr("");
    try {
      const me = await securityApi.login(u.trim(), p);
      setP("");                      // out of component state immediately
      onSignedIn(me);
    } catch (ex) {
      setErr(ex.message || "Sign-in failed.");
      setP("");
    } finally {
      setBusy(false);
    }
  };

  const field = {
    width: "100%", boxSizing: "border-box", padding: "10px 12px",
    border: `1px solid ${t.border}`, borderRadius: t.radius.md,
    fontSize: 14, fontFamily: t.font, background: "#fff", color: t.text,
  };

  return (
    <div style={{ minHeight: "100vh", background: t.navy, fontFamily: t.font,
                  display: "grid", placeItems: "center", padding: 20 }}>
      <form onSubmit={submit} style={{ width: 380, maxWidth: "100%",
        background: t.panel, borderRadius: t.radius.lg || 10,
        padding: "30px 30px 24px", boxShadow: "0 18px 50px rgba(0,0,0,.35)" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 12,
                      marginBottom: 6 }}>
          <div style={{ width: 38, height: 38, borderRadius: "50%",
            background: `linear-gradient(135deg, ${t.pop}, ${t.accent})`,
            display: "grid", placeItems: "center", color: "#fff",
            fontWeight: 800, fontSize: 13 }}>CP</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: t.text }}>
              CP <span style={{ color: t.pop, fontWeight: 800 }}>360°</span>
            </div>
            <div style={{ fontSize: 11, color: t.sub }}>
              Brown Brothers Harriman · Capital Partners
            </div>
          </div>
        </div>

        <p style={{ fontSize: 12, color: t.sub, margin: "14px 0 18px",
                    lineHeight: 1.5 }}>
          Sign in with your <b>network account</b>. CP 360 checks it with
          Active Directory — it does not hold your password.
        </p>

        <label style={{ fontSize: 11, fontWeight: 700, color: t.sub,
                        textTransform: "uppercase", letterSpacing: ".4px" }}>
          Account name
        </label>
        <input value={u} onChange={(e) => setU(e.target.value)}
          autoFocus autoComplete="username" disabled={busy}
          placeholder="a.nair" style={{ ...field, margin: "5px 0 14px" }} />

        <label style={{ fontSize: 11, fontWeight: 700, color: t.sub,
                        textTransform: "uppercase", letterSpacing: ".4px" }}>
          Password
        </label>
        <input value={p} onChange={(e) => setP(e.target.value)}
          type="password" autoComplete="current-password" disabled={busy}
          style={{ ...field, margin: "5px 0 4px" }} />

        {err && (
          <div role="alert" style={{ marginTop: 12, padding: "9px 11px",
            background: "rgba(193,17,58,.08)", border: "1px solid #c1113a",
            borderRadius: t.radius.md, color: "#c1113a", fontSize: 12.5,
            lineHeight: 1.45 }}>{err}</div>
        )}

        <button type="submit" disabled={busy} style={{ width: "100%",
          marginTop: 18, padding: "11px 12px", border: "none",
          borderRadius: t.radius.md, cursor: busy ? "wait" : "pointer",
          background: busy ? t.sub : t.accent, color: "#fff",
          fontSize: 14, fontWeight: 600, fontFamily: t.font }}>
          {busy ? "Checking with the directory…" : "Sign in"}
        </button>

        {health && health.admins === 0 && (
          // An operator staring at a login screen they cannot get past
          // deserves to be told why, once, on the screen itself.
          <div style={{ marginTop: 14, fontSize: 11.5, color: "#8a6d1f",
            background: "rgba(232,163,61,.12)", border: "1px solid #e8a33d",
            borderRadius: t.radius.md, padding: "8px 10px", lineHeight: 1.45 }}>
            No CP 360 administrator has been set up yet. Anyone signing in
            will see the home page only, until the first administrator is
            seeded (see <code>sql/64_security.sql</code>).
          </div>
        )}

        <div style={{ marginTop: 16, fontSize: 11, color: t.sub,
                      lineHeight: 1.5 }}>
          Forgotten your password? It is your normal network password —
          reset it the usual way. Access to individual CP 360 modules is
          granted by a CP 360 security administrator, not by AD.
        </div>
      </form>
    </div>
  );
}
