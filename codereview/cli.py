"""Command line.

  python -m codereview review --diff change.diff [--root .] [--repo owner/name --ref branch] [--post]
  python -m codereview review --pr owner/name#123 [--post] [--llm]
  python -m codereview review --files path [path ...]        (whole files, as if added)
  python -m codereview ingest --review <id> --report copilot-report.md [--post]
  python -m codereview standards                                (print the digest)
  python -m codereview list
"""
from __future__ import annotations

import argparse
import json
import os
import sys

from . import review as RV, store
from .diff import FileDiff, Hunk
from .standards import digest


def _fds_from_files(paths):
    out = []
    for p in paths:
        with open(p, encoding="utf-8", errors="replace") as fh:
            text = fh.read()
        fd = FileDiff(path=p, status="added", new_text=text)
        h = Hunk(old_start=0, new_start=1, lines=[("+", i + 1, t) for i, t in enumerate(text.splitlines())])
        fd.hunks = [h]
        out.append(fd)
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(prog="codereview", description="CP 360 code review: rules, the Copilot pack, the final report")
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("review"); r.add_argument("--diff"); r.add_argument("--root"); r.add_argument("--pr"); r.add_argument("--files", nargs="*")
    r.add_argument("--repo"); r.add_argument("--ref"); r.add_argument("--post", action="store_true"); r.add_argument("--llm", action="store_true"); r.add_argument("--json", action="store_true")
    i = sub.add_parser("ingest"); i.add_argument("--review", required=True); i.add_argument("--report", required=True); i.add_argument("--post", action="store_true"); i.add_argument("--json", action="store_true")
    sub.add_parser("standards"); sub.add_parser("list")
    a = ap.parse_args(argv)

    if a.cmd == "standards":
        print(digest()); return 0
    if a.cmd == "list":
        for rv in store.list_reviews():
            print(f"{rv['id']}  {rv.get('verdict') or '-':16} {rv.get('status') or '-':16} {rv.get('repo') or '-'} {rv.get('ref') or ''}  {rv.get('findings_n', 0)} findings")
        return 0
    if a.cmd == "ingest":
        with open(a.report, encoding="utf-8") as fh:
            rv = RV.ingest(a.review, fh.read())
        if a.post:
            rv["github"] = RV.post(rv)
        _out(rv, a.json); return 0

    fds, kind, number, sha = [], "diff", None, None
    if a.pr:
        repo, _, num = a.pr.partition("#")
        fds, sha = RV.fds_from_pr(repo, int(num)); a.repo, kind, number = repo, "pr", int(num)
    elif a.diff:
        fds = RV.fds_from_diff_file(a.diff, a.root)
    elif a.files:
        fds = _fds_from_files(a.files); kind = "files"
    else:
        ap.error("one of --diff, --pr or --files")
    rv = RV.run(fds, repo=a.repo, ref=a.ref, kind=kind, number=number, head_sha=sha, use_llm=True if a.llm else None)
    if a.post:
        rv["github"] = RV.post(rv, fds)
    _out(rv, a.json); return 0


def _out(rv, as_json):
    if as_json:
        print(json.dumps({k: v for k, v in rv.items() if k != "report_md"}, indent=1, default=str)); return
    print(rv["report_md"])
    print(f"\nreview {rv['id']} · {rv['status']} · stored in {rv.get('stored')} · pack: {rv.get('pack_path')}")
    if rv.get("github"):
        print(f"github: {rv['github']}")


if __name__ == "__main__":
    sys.exit(main())
