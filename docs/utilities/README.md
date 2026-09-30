# Utilities · Compare (Twinpane)

**Utilities → Compare** in the sidebar. Two folders or two files side by
side, with the differences highlighted and copyable in either direction.

It answers the question the catalogue cannot: not *what is this column*
but *what actually changed* between two copies of a DDL script, a
workbook export, a spec or a release.

Source: <https://github.com/aneesh304810/Compare> · vendored into
`ui/public/vendor/twinpane/twinpane.html`.

---

## Nothing is uploaded

Every comparison happens in the browser tab. No file, path or line of
content reaches the CP 360 server or anywhere else — the vendored page
contains no `fetch`, no `XMLHttpRequest`, no `WebSocket` and no beacon,
and `ui/test/vendor-twinpane.test.jsx` asserts that on every test run so
a future refresh cannot quietly make the claim false.

Two requests do go out, neither of them your data:

| What | When | If it is blocked |
|---|---|---|
| IBM Plex from `fonts.googleapis.com` / `fonts.gstatic.com` | every page load | Falls back to the system font. Cosmetic only. |
| JSZip from `cdnjs.cloudflare.com` | only when saving **several** changed files from a browser **without** file-system access | That one save fails with a clear message. Chrome and Edge never take this path — they write in place. |

Both are disclosed on the screen. If network policy requires a fully
self-contained page, the fix is to add the font CSS and `jszip.min.js`
as local files and a third hunk in `tools/vendor_twinpane.py`; ask and it
is a small change.

---

## Saving back to disk

| Browser | Open folder / Open file | Saving |
|---|---|---|
| Chrome, Edge | native picker, read-write | **writes straight back to the original files** |
| Firefox, Safari | upload picker | changed files come back as a download (a zip when there are several) |

This is the File System Access API, and it is the reason the tool is
worth having in the app rather than as a link.

---

## Why it is an iframe, and why that was not free

The tool is a thousand lines of vanilla DOM in one file. Porting it to
React would buy nothing visible and would fork a tool maintained in its
own repository, so CP 360 embeds it instead.

**It has to be served from CP 360's own origin.** A browser only grants
file-system access to a page it considers first-party. An iframe pointed
at GitHub, or at any other host, gets the upload-and-download fallback —
and gets it *silently*, with every button still working. That is why the
file lives in `ui/public` rather than being linked.

**Upstream turns the API off inside any frame.** Twinpane was written for
a Claude artifact, where the frame is cross-origin and the API genuinely
cannot work, so it does:

```js
const canFS = !inFrame && 'showDirectoryPicker' in window;
```

Correct there, wrong here. `tools/vendor_twinpane.py` applies two hunks
on the way in:

1. **`canFS` becomes same-origin aware.** A frame whose top we can read,
   on our own origin, keeps the API. A cross-origin frame — where reading
   `window.top.location` throws — still loses it.
2. **Both pickers fall back on refusal.** Patch 1 is a claim about what
   Chrome permits in a same-origin frame, and a claim is not a guarantee;
   policy around this API has moved before. So if the browser answers
   `SecurityError` or `NotAllowedError`, the call falls through to the
   `<input>` the unpatched build would have used. Whichever way the claim
   turns out, the button works.

Verified in Chromium: inside a same-origin frame `window.top.location.origin
=== location.origin` is true and `showDirectoryPicker` is present, so the
patched check enables the API.

---

## Refreshing it

```bash
python tools/vendor_twinpane.py                 # shallow-clones upstream
python tools/vendor_twinpane.py ../Compare      # or use a local checkout
```

**Do not edit `ui/public/vendor/twinpane/twinpane.html`** — it is
overwritten. Change it upstream and re-vendor.

Each hunk asserts that it matched. If upstream moves the line a patch
targets, the script **stops and says which one**, rather than writing a
half-patched file that looks fine and cannot save. When that happens,
update the patch in the script.

`node ui/test/run.mjs` then checks the result: the file is where the
iframe points, the patches are present, the upstream line they replace is
gone, and the outbound host list has not grown.

---

## Entitlement

The module key is `compare`, in the `Utilities` group. It is seeded by
`sql/64_security.sql`; if that has already been run, **re-run it** — the
module `MERGE` is idempotent and exists for exactly this.

Until it is in `sec_module`, the screen can only be reached by an
administrator, because a key that is not there cannot be ticked for
anybody.

---

## Keyboard

Shortcuts work while the tool has focus — click inside the frame first.

| Keys | Action |
| --- | --- |
| Alt+↓ / Alt+↑ | Next / previous difference |
| Alt+→ / Alt+← | Copy the current difference right / left |
| Ctrl+Z | Undo |
| Esc | Back to the folder view |

**Esc** is also the app's exit from full screen, and the frame sees it
first — press it once for the folder view, again to leave full screen.
