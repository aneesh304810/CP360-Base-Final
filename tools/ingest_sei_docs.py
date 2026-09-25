#!/usr/bin/env python3
"""Ingest the SEI source documents so they can be read beside the design.

Mirrors tools/build_design_docs.py: reads a source directory, emits a single
generated JS module the UI imports. Nothing here is specific to a PDF library —
three extraction backends are tried in order, and a pre-extracted .txt or .md
works with no library at all.

    python3 tools/ingest_sei_docs.py                 # sei-source/ -> ui/src/seiSourceDocs.js
    python3 tools/ingest_sei_docs.py --src ~/pdfs    # somewhere else
    python3 tools/ingest_sei_docs.py --check         # report only, write nothing

Extraction backends, in order of preference:
  1. pypdf            pip install pypdf
  2. pdftotext        poppler-utils, called with -layout
  3. plain text       a .txt or .md you exported yourself

Filenames map to document ids. Put the version in the filename and it is
picked up:

    sei-source/
      file-ingestion-tdd-v2.0.pdf
      dbt-transformation-tdd-v2.pdf
      integration-architecture-v5.pdf

Sectioning is heuristic and deliberately conservative: a line is a heading when
it matches a numbered clause (4, 4.2, 4.2.1), a lettered appendix clause
(C.1, E.6), or an "Appendix X" line, AND is short enough to be a title rather
than a sentence. Everything before the first heading becomes a "front" section
so no text is ever dropped.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SRC = ROOT / "sei-source"
DEFAULT_OUT = ROOT / "ui" / "src" / "seiSourceDocs.js"

# A heading is one of these, and short. Order matters: most specific first.
HEADING_PATTERNS = [
    re.compile(r"^\s*(Appendix\s+[A-Z])\b[\s:.—-]*(.*)$", re.I),
    re.compile(r"^\s*([A-Z]\.\d+(?:\.\d+)?)\s+(.+)$"),          # C.1 Discovery
    re.compile(r"^\s*(\d+(?:\.\d+){0,2})\s+([A-Z].+)$"),        # 6.1 File schema
    re.compile(r"^\s*(§\s*\d+(?:\.\d+)?)\s*(.*)$"),        # §6.1
]
MAX_HEADING_LEN = 90
MIN_SECTION_CHARS = 20


@dataclass
class Section:
    id: str
    label: str
    page: int
    text: str = ""


@dataclass
class Doc:
    id: str
    title: str
    version: str
    source_file: str
    backend: str
    pages: int
    sections: list = field(default_factory=list)


# --------------------------------------------------------------------- #
# extraction
# --------------------------------------------------------------------- #
def extract_pypdf(path: Path):
    try:
        from pypdf import PdfReader
    except ImportError:
        return None
    reader = PdfReader(str(path))
    return [(i + 1, (pg.extract_text() or "")) for i, pg in enumerate(reader.pages)], "pypdf"


def extract_pdftotext(path: Path):
    import shutil
    import subprocess

    if not shutil.which("pdftotext"):
        return None
    out = subprocess.run(
        ["pdftotext", "-layout", str(path), "-"],
        capture_output=True, text=True, check=False,
    )
    if out.returncode != 0:
        return None
    # pdftotext separates pages with form feed
    pages = out.stdout.split("\f")
    return [(i + 1, p) for i, p in enumerate(pages) if p.strip()], "pdftotext"


def extract_plain(path: Path):
    text = path.read_text(encoding="utf-8", errors="replace")
    # a page break if the exporter left one, otherwise one synthetic page
    if "\f" in text:
        pages = [p for p in text.split("\f") if p.strip()]
        return [(i + 1, p) for i, p in enumerate(pages)], "plain"
    return [(1, text)], "plain"


def extract(path: Path):
    if path.suffix.lower() in (".txt", ".md"):
        return extract_plain(path)
    for fn in (extract_pypdf, extract_pdftotext):
        got = fn(path)
        if got:
            return got
    raise SystemExit(
        f"\n  Cannot read {path.name}: no PDF backend available.\n"
        f"  Install one:   pip install pypdf\n"
        f"           or:   apt-get install poppler-utils\n"
        f"  Or export the PDF to text yourself and drop the .txt in beside it.\n"
    )


# --------------------------------------------------------------------- #
# sectioning
# --------------------------------------------------------------------- #
def heading_of(line: str):
    stripped = line.strip()
    if not stripped or len(stripped) > MAX_HEADING_LEN:
        return None
    if stripped.endswith((".", ";", ",")) and not re.match(r"^\s*Appendix", stripped, re.I):
        return None  # a sentence, not a title
    for pat in HEADING_PATTERNS:
        m = pat.match(stripped)
        if not m:
            continue
        num = re.sub(r"\s+", "", m.group(1)).lstrip("§")
        title = (m.group(2) or "").strip(" :.—-")
        if not title and not re.match(r"^Appendix", num, re.I):
            return None  # a bare number in a table is not a heading
        return num, title
    return None


def sectionise(pages):
    sections = []
    current = Section(id="front", label="Front matter", page=1)
    for page_no, text in pages:
        for line in text.splitlines():
            h = heading_of(line)
            if h:
                if len(current.text.strip()) >= MIN_SECTION_CHARS or sections:
                    sections.append(current)
                num, title = h
                current = Section(id=num, label=(f"{num} {title}".strip()), page=page_no)
            else:
                current.text += line.rstrip() + "\n"
    sections.append(current)
    # drop empties, collapse runs of blank lines
    out = []
    for s in sections:
        s.text = re.sub(r"\n{3,}", "\n\n", s.text).strip()
        if s.text:
            out.append(s)
    return out


def meta_from_name(path: Path):
    stem = path.stem
    mv = re.search(r"[-_ ]v(\d+(?:\.\d+)*)$", stem, re.I)
    version = mv.group(1) if mv else ""
    base = stem[: mv.start()] if mv else stem
    doc_id = re.sub(r"[^a-z0-9]+", "-", base.lower()).strip("-")
    title = re.sub(r"[-_]+", " ", base).strip().title()
    title = (title.replace("Tdd", "TDD").replace("Dbt", "dbt")
                  .replace("Sei", "SEI").replace("Bbh", "BBH"))
    return doc_id, title, version


# --------------------------------------------------------------------- #
def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", type=Path, default=DEFAULT_SRC)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--check", action="store_true", help="report only, write nothing")
    args = ap.parse_args()

    if not args.src.is_dir():
        print(f"No source directory at {args.src}.")
        print("Create it and drop the SEI PDFs in, then run this again:")
        print(f"  mkdir -p {args.src}")
        return 1

    files = sorted(
        p for p in args.src.iterdir()
        if p.suffix.lower() in (".pdf", ".txt", ".md")
        and not p.name.startswith(".")
        and p.stem.lower() not in ("readme", "notes")
    )
    if not files:
        print(f"{args.src} has no .pdf, .txt or .md files.")
        return 1

    docs = []
    for path in files:
        pages, backend = extract(path)
        doc_id, title, version = meta_from_name(path)
        sections = sectionise(pages)
        docs.append(Doc(id=doc_id, title=title, version=version,
                        source_file=path.name, backend=backend,
                        pages=len(pages), sections=sections))
        chars = sum(len(s.text) for s in sections)
        print(f"  {path.name:<44} {backend:<10} {len(pages):>4}p  "
              f"{len(sections):>4} sections  {chars:>8,} chars")
        if len(sections) <= 2 and len(pages) > 3:
            print("      ! only one section found — the headings did not match. "
                  "The document is still readable whole.")

    if args.check:
        print("\n--check: nothing written.")
        return 0

    payload = [
        {
            "id": d.id, "title": d.title, "version": d.version,
            "sourceFile": d.source_file, "pages": d.pages, "backend": d.backend,
            "sections": [
                {"id": s.id, "label": s.label, "page": s.page, "text": s.text}
                for s in d.sections
            ],
        }
        for d in docs
    ]
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8") as fh:
        fh.write("// GENERATED by tools/ingest_sei_docs.py — do not edit by hand.\n")
        fh.write("// Source documents provided by SEI, ingested for side-by-side review.\n")
        fh.write("// Re-run the tool after replacing a PDF; the citation map in\n")
        fh.write("// seiCitations.js is hand-maintained and is NOT regenerated.\n\n")
        fh.write("export const SEI_DOCS = ")
        json.dump(payload, fh, ensure_ascii=False, indent=1)
        fh.write(";\n")

    total = sum(len(s["text"]) for d in payload for s in d["sections"])
    print(f"\nWrote {args.out.relative_to(ROOT)} — {len(payload)} documents, "
          f"{sum(len(d['sections']) for d in payload)} sections, {total:,} chars.")
    print("Citations live in ui/src/seiCitations.js and are maintained by hand.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
