"""Vendor Twinpane into CP 360, and re-apply the two changes it needs.

WHY VENDOR AND NOT LINK. Twinpane reads and writes the user's own disk
through the File System Access API. That only works from a page the
browser considers first-party to the app, so the file has to be served
from CP 360's own origin -- a link to GitHub, or an iframe pointing at
another host, gets the degraded download-only mode and no warning that
it did.

WHY PATCH AT ALL. Upstream disables the File System Access API whenever
it finds itself in an iframe:

    const canFS = !inFrame && 'showDirectoryPicker' in window;

That is right for the Claude artifact it was written for, where the frame
is cross-origin and the API genuinely cannot work. It is wrong here,
where the frame is same-origin and it can. Left alone, the Open folder
button silently falls back to the upload-and-download path: the tool
still appears to work, and "save back in place" -- the reason to use it
over a diff viewer -- quietly stops happening. That is exactly the class
of failure that is never reported, so it is patched rather than
documented.

WHY THE SECOND PATCH. The first one is a claim about what Chrome allows
in a same-origin iframe, and a claim is not a guarantee: browsers differ,
and policy around this API has moved before. So the picker calls also
learn the answer at runtime -- if the browser refuses, they fall through
to the <input> the unpatched build would have used. Whichever way the
claim turns out, the button works.

    python tools/vendor_twinpane.py [path-to-Compare-clone]

Run it again after upstream changes. Each patch asserts that it matched;
a refresh that silently dropped one would be worse than no refresh.
"""
from __future__ import annotations

import os
import re
import subprocess
import sys
import tempfile

UPSTREAM = "https://github.com/aneesh304810/Compare.git"
SOURCE = "twinpane-standalone.html"
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DEST = os.path.join(ROOT, "ui", "public", "vendor", "twinpane", "twinpane.html")

# The marker every patched build carries. ui/test/vendor-twinpane.test.jsx
# asserts it is present, so a re-vendor that lost the patches fails the
# test run rather than the next person's Open folder button.
MARK = "CP360-PATCH"

PATCHES = [
    # 1 -- a same-origin frame may use the API.
    ("""const canFS = !inFrame && 'showDirectoryPicker' in window;""",
     """/* """ + MARK + """ 1: upstream disables the File System Access API in any
   iframe, which is right for a cross-origin artifact and wrong for a
   same-origin embed. Same-origin frames keep it; anything else, including
   a frame whose top we cannot read, still loses it. */
const sameOrigin = (() => {
  try { return window.top.location.origin === location.origin; }
  catch { return false; }        /* cross-origin: reading top throws */
})();
const canFS = (!inFrame || sameOrigin) && 'showDirectoryPicker' in window;"""),

    # 2 -- and if the browser disagrees, fall through instead of failing.
    ("""    try { await loadDirHandle(i, await window.showDirectoryPicker({ mode: 'readwrite', id: 'twinpane' + i })); }
    catch (err) { if (err.name !== 'AbortError') toast(err.message, 'err'); }""",
     """    try { await loadDirHandle(i, await window.showDirectoryPicker({ mode: 'readwrite', id: 'twinpane' + i })); }
    /* """ + MARK + """ 2: a browser that refuses the picker here must not leave a
       dead button -- fall through to the <input> the unpatched build uses. */
    catch (err) {
      if (err.name === 'SecurityError' || err.name === 'NotAllowedError') { $('#dir' + i).click(); return; }
      if (err.name !== 'AbortError') toast(err.message, 'err');
    }"""),

    ("""    try { const [h] = await window.showOpenFilePicker({ id: 'twinpanef' + i }); await loadFileObj(i, await h.getFile(), h); }
    catch (err) { if (err.name !== 'AbortError') toast(err.message, 'err'); }""",
     """    try { const [h] = await window.showOpenFilePicker({ id: 'twinpanef' + i }); await loadFileObj(i, await h.getFile(), h); }
    /* """ + MARK + """ 2 */
    catch (err) {
      if (err.name === 'SecurityError' || err.name === 'NotAllowedError') { $('#file' + i).click(); return; }
      if (err.name !== 'AbortError') toast(err.message, 'err');
    }"""),
]


def fetch(src: str | None) -> tuple[str, str]:
    """Return (html, revision). A local clone is used as-is; otherwise a
    shallow clone into a temporary directory."""
    if src:
        path = os.path.join(src, SOURCE)
        if not os.path.exists(path):
            sys.exit(f"{path} does not exist — is that a Compare checkout?")
        return open(path, encoding="utf-8").read(), _rev(src)
    tmp = tempfile.mkdtemp(prefix="twinpane-")
    subprocess.run(["git", "clone", "--depth", "1", UPSTREAM, tmp],
                   check=True, capture_output=True)
    return open(os.path.join(tmp, SOURCE), encoding="utf-8").read(), _rev(tmp)


def _rev(path: str) -> str:
    try:
        return subprocess.run(["git", "-C", path, "rev-parse", "HEAD"],
                              check=True, capture_output=True,
                              text=True).stdout.strip()
    except Exception:                                         # noqa: BLE001
        return "unknown"


def main():
    html, rev = fetch(sys.argv[1] if len(sys.argv) > 1 else None)
    if MARK in html:
        sys.exit("the source already carries CP 360 patches — vendor from "
                 "upstream, not from ui/public")

    for i, (old, new) in enumerate(PATCHES, 1):
        if old not in html:
            # Upstream moved. Say which patch and stop: a half-patched
            # build is a tool that looks fine and cannot save.
            sys.exit(f"patch {i} did not match — upstream has changed.\n"
                     f"Looked for:\n{old}\n\n"
                     f"Re-read tools/vendor_twinpane.py and update it.")
        html = html.replace(old, new, 1)

    banner = (f"<!-- Vendored from {UPSTREAM} at {rev}.\n"
              f"     DO NOT EDIT HERE. Change it upstream and re-run\n"
              f"     python tools/vendor_twinpane.py\n"
              f"     CP360-PATCH hunks are applied on the way in; see that\n"
              f"     script for what they are and why. -->\n")
    html = re.sub(r"^(<!doctype html>)", r"\1\n" + banner, html, count=1,
                  flags=re.IGNORECASE)

    os.makedirs(os.path.dirname(DEST), exist_ok=True)
    with open(DEST, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"wrote {os.path.relpath(DEST, ROOT)}  ({len(html):,} bytes, "
          f"upstream {rev[:12]}, {len(PATCHES)} patches applied)")


if __name__ == "__main__":
    main()
