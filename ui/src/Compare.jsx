import React, { useState, useEffect, useRef } from "react";

// Utilities · Compare — Twinpane, embedded.
//
// WHY AN IFRAME AND NOT A PORT. Twinpane is a thousand lines of vanilla
// DOM that already works. Rewriting it as React would buy nothing the
// user can see and would fork a tool that is maintained in its own
// repository; `tools/vendor_twinpane.py` refreshes the copy in one
// command, which a rewrite could never do.
//
// WHY SAME-ORIGIN MATTERS. It reads and writes the real disk through the
// File System Access API, and a browser only allows that from a page it
// considers first-party to the app. Serving the file out of ui/public
// keeps it on CP 360's origin; pointing the frame at GitHub would get the
// upload-and-download fallback with no sign that anything was lost. The
// vendoring script explains the two patches that keep the API alive
// inside the frame.
//
// NOTHING IS UPLOADED, and the screen says so, because that is the first
// question anybody in this building asks about a tool that reads their
// disk. It is a checkable claim: the vendored page contains no fetch, no
// XMLHttpRequest, no WebSocket and no beacon. The only requests it makes
// are for a web font and, on one fallback path, a zip library — both
// noted below.

const SRC = "/vendor/twinpane/twinpane.html";

export default function Compare({ t }) {
  const [full, setFull] = useState(false);
  const [reloads, setReloads] = useState(0);
  const frame = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setFull(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const btn = {
    border: `1px solid ${t.border}`, background: t.panel, color: t.text,
    borderRadius: t.radius.md, cursor: "pointer", fontSize: 12,
    padding: "5px 11px", fontFamily: t.font, whiteSpace: "nowrap",
  };

  // The frame is remounted by key when Start over is pressed. Reaching
  // into its document to reset it would need the same-origin access the
  // tool relies on and would couple this screen to its internals.
  const surface = (
    <iframe ref={frame} key={reloads} src={SRC} title="Twinpane Compare"
      // No sandbox attribute. Sandboxing would strip the file-system
      // access that is the entire point; the page is our own file on our
      // own origin, not third-party content.
      allow="clipboard-read; clipboard-write"
      style={{ width: "100%", height: "100%", border: 0, display: "block",
               background: t.panel }} />
  );

  const bar = (
    <div style={{ display: "flex", alignItems: "center", gap: 8,
      padding: "8px 12px", borderBottom: `1px solid ${t.border}`,
      background: t.bg, flexWrap: "wrap" }}>
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: ".4px", color: t.sub }}>Twinpane</span>
      <span style={{ fontSize: 11.5, color: t.sub }}>
        Folder and file compare · runs entirely in your browser
      </span>
      <span style={{ marginLeft: "auto", display: "flex", gap: 7 }}>
        <button style={btn} onClick={() => setReloads((n) => n + 1)}
          title="Discard everything loaded and start again">Start over</button>
        <button style={btn} onClick={() => window.open(SRC, "_blank", "noopener")}
          title="Opens the same tool in its own tab">Open in a new tab ↗</button>
        <button style={btn} onClick={() => setFull((f) => !f)}>
          ⛶ {full ? "Exit full screen" : "Full screen"}
        </button>
      </span>
    </div>
  );

  if (full) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 300,
                    background: t.panel, display: "flex",
                    flexDirection: "column" }}>
        {bar}
        <div style={{ flex: 1, minHeight: 0 }}>{surface}</div>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 500, color: t.accent,
        borderBottom: `2px solid ${t.accent}`, paddingBottom: 14,
        margin: "0 0 8px" }}>Compare</h1>
      <p style={{ fontSize: 12.5, color: t.sub, margin: "0 0 14px",
                  maxWidth: 820, lineHeight: 1.55 }}>
        Two folders or two files, side by side, with the differences
        highlighted and copyable in either direction. Useful for the thing
        this catalogue cannot answer from the database: what actually
        changed between two copies of a spec, a DDL script, a workbook
        export or a release.
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap",
                    margin: "0 0 16px" }}>
        <Note t={t} tone="ok" title="Nothing is uploaded.">
          Every comparison happens in this browser tab. No file, path or
          line of content is sent to the CP 360 server or anywhere else —
          the page makes no data requests at all.
        </Note>
        <Note t={t} tone="info" title="Saving back in place needs Chrome or Edge.">
          There, <b>Open folder</b> and <b>Open file</b> write your edits
          straight back to disk. In other browsers the same buttons still
          compare, and changes come back as a download instead.
        </Note>
      </div>

      <div style={{ border: `1px solid ${t.border}`, borderRadius: t.radius.md,
        overflow: "hidden", background: t.panel }}>
        {bar}
        <div style={{ height: "calc(100vh - 340px)", minHeight: 460 }}>
          {surface}
        </div>
      </div>

      <details style={{ marginTop: 14, fontSize: 12.5, color: t.sub }}>
        <summary style={{ cursor: "pointer", color: t.accent }}>
          Keyboard, and what this is
        </summary>
        <div style={{ marginTop: 10, lineHeight: 1.6, maxWidth: 820 }}>
          <p style={{ margin: "0 0 10px" }}>
            <b>Alt+↓ / Alt+↑</b> next and previous difference ·{" "}
            <b>Alt+→ / Alt+←</b> copy the current difference right or left ·{" "}
            <b>Ctrl+Z</b> undo · <b>Esc</b> back to the folder view.
            Shortcuts work while the tool has focus — click inside it first.
          </p>
          <p style={{ margin: "0 0 10px" }}>
            This is <b>Twinpane</b>, kept in its own repository and vendored
            into CP 360 as a single file under{" "}
            <code>ui/public/vendor/twinpane/</code>. To pick up a newer
            version, run <code>python tools/vendor_twinpane.py</code> — do
            not edit the vendored copy, it is overwritten.
          </p>
          <p style={{ margin: 0 }}>
            Two things do reach the network, neither of them your data: the
            page asks Google Fonts for IBM Plex (it falls back to system
            fonts if that is blocked), and if you save several changed files
            from a browser without file-system access it fetches a zip
            library from cdnjs. Both are noted in{" "}
            <code>docs/utilities/README.md</code>, which says how to bundle
            them locally if network policy requires it.
          </p>
        </div>
      </details>
    </div>
  );
}

function Note({ t, tone, title, children }) {
  const c = tone === "ok" ? "#1a8f4c" : t.accent;
  return (
    <div style={{ flex: "1 1 340px", minWidth: 280,
      border: `1px solid ${t.border}`, borderLeft: `3px solid ${c}`,
      borderRadius: t.radius.md, padding: "9px 12px", background: t.panel,
      fontSize: 12, lineHeight: 1.5, color: t.sub }}>
      <b style={{ color: c }}>{title}</b> {children}
    </div>
  );
}
