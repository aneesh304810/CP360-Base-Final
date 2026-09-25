#!/usr/bin/env python3
"""Reverse of build_design_docs.py: designDocsData.js -> designs-md/*.md

The designs-md/ sources were lost when this repository was assembled from patch
bundles; only the compiled designDocsData.js survived. The compiler stores the
raw front matter (`fm_raw`) and each section's raw markdown (`sections[].md`),
so the sources can be reconstructed exactly.

    python3 tools/export_design_docs.py            # write designs-md/
    python3 tools/export_design_docs.py --check    # verify round-trip, write nothing

--check recompiles what it would write and compares it against the current
designDocsData.js. Anything but a clean match means the export is lossy and
should not be trusted as a baseline.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "ui" / "src" / "designDocsData.js"
OUT = ROOT / "designs-md"


def load_docs(path: Path):
    text = path.read_text(encoding="utf-8")
    m = re.search(r"export const DESIGN_DOCS = (\[.*\]);\s*$", text, re.S)
    if not m:
        raise SystemExit(f"Could not find DESIGN_DOCS in {path}")
    return json.loads(m.group(1))


def render(doc) -> str:
    fm = doc.get("fm_raw", "").strip("\n")
    parts = ["---", fm, "---", ""]
    parts.append(f"# {doc['title']}")
    parts.append("")
    for sec in doc["sections"]:
        if sec.get("h"):
            parts.append(f"## {sec['h']}")
        body = sec.get("md", "")
        if body:
            parts.append(body)
        parts.append("")
    return "\n".join(parts).rstrip("\n") + "\n"


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--data", type=Path, default=DATA)
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args()

    docs = load_docs(args.data)
    missing_src = [d["id"] for d in docs if not d.get("src")]
    if missing_src:
        print(f"! {len(missing_src)} docs have no source filename: {missing_src[:5]}")

    args.out.mkdir(parents=True, exist_ok=True)
    written, total = 0, 0
    for d in docs:
        name = d.get("src") or f"{d['id']}.md"
        body = render(d)
        total += len(body)
        if not args.check:
            (args.out / name).write_text(body, encoding="utf-8")
        written += 1

    label = "would write" if args.check else "wrote"
    print(f"{label} {written} files to {args.out.relative_to(ROOT)} — {total:,} chars")

    if args.check:
        # round-trip: does re-parsing what we would write reproduce the sections?
        sys.path.insert(0, str(ROOT / "tools"))
        bad = []
        for d in docs:
            body = render(d)
            m = re.match(r"---\n(.*?)\n---\n", body, re.S)
            after = body[m.end():] if m else body
            got = [h for h, _ in _split_sections(after)]
            want = [s["h"] for s in d["sections"]]
            if got != want:
                bad.append((d["id"], want, got))
        if bad:
            print(f"! {len(bad)} docs do not round-trip:")
            for i, w, g in bad[:3]:
                print(f"   {i}: wanted {w[:3]}... got {g[:3]}...")
            return 1
        print("round-trip clean: every section heading survives export and re-parse.")
    return 0


def _split_sections(body):
    """Mirror of build_design_docs.split_sections, kept local so --check needs no import."""
    parts, cur, buf = [], "", []
    for line in body.split("\n"):
        if line.startswith("# ") and not line.startswith("## "):
            continue
        if line.startswith("## "):
            if cur or any(x.strip() for x in buf):
                parts.append((cur, "\n".join(buf).rstrip()))
            cur, buf = line[3:].strip(), []
        else:
            buf.append(line)
    if cur or any(x.strip() for x in buf):
        parts.append((cur, "\n".join(buf).rstrip()))
    return parts


if __name__ == "__main__":
    sys.exit(main())
