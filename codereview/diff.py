"""Unified diffs as objects: the files changed, the hunks, the added lines
with their new line numbers (for inline comments), and the new text of a
file when the caller can supply it. Nothing here needs git; the webhook
gets the diff from GitHub, the CLI from a file or `git diff`."""
from __future__ import annotations

import re
from dataclasses import dataclass, field

HUNK = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@")


@dataclass
class Hunk:
    old_start: int
    new_start: int
    lines: list = field(default_factory=list)      # (tag, new_lineno or None, text)


@dataclass
class FileDiff:
    path: str
    old_path: str | None = None
    status: str = "modified"                        # added | modified | deleted | renamed
    hunks: list = field(default_factory=list)
    binary: bool = False
    new_text: str | None = None                     # the whole file after the change, when known

    @property
    def added(self):
        """(new_lineno, text) for every added line."""
        return [(n, t) for h in self.hunks for tag, n, t in h.lines if tag == "+"]

    @property
    def added_text(self):
        return "\n".join(t for _, t in self.added)

    @property
    def kind(self):
        return kind_of(self.path, self.new_text or self.added_text)

    def new_lines(self):
        """The file's new lines when the full text is known, else the added
        lines only, as a dict new_lineno -> text."""
        if self.new_text is not None:
            return {i + 1: t for i, t in enumerate(self.new_text.splitlines())}
        return dict(self.added)

    def in_diff(self, lineno):
        """True when a new line number is part of this diff (added or context),
        which is where GitHub accepts an inline comment."""
        return any(n == lineno for h in self.hunks for tag, n, _ in h.lines if n is not None)


def kind_of(path, text=""):
    """What a file is, for picking the rules: airflow, dbt_model, dbt_yaml,
    python, sql, liquibase, yaml, other."""
    p = path.lower()
    if p.endswith(".py"):
        if "/dags/" in p or p.startswith("dags/") or re.search(r"\b(DAG|@dag)\b", text or "") and "airflow" in (text or ""):
            return "airflow"
        return "python"
    if p.endswith(".sql"):
        if "/models/" in p or p.startswith("models/") or "{{" in (text or ""):
            return "dbt_model"
        if "changeset" in (text or "").lower() or "liquibase" in p:
            return "liquibase"
        return "sql"
    if p.endswith((".yml", ".yaml")):
        if "/models/" in p or p.endswith(("schema.yml", "schema.yaml", "_models.yml", "sources.yml")) or "models:" in (text or ""):
            return "dbt_yaml"
        if "databasechangelog" in (text or "").lower() or "changeset" in (text or "").lower():
            return "liquibase"
        return "yaml"
    if p.endswith(".xml") and "changeset" in (text or "").lower():
        return "liquibase"
    if p.endswith(("jenkinsfile", ".groovy")):
        return "pipeline"
    return "other"


def parse_unified(text):
    """A unified diff (git diff or GitHub .diff) to a list of FileDiff."""
    files, cur, hunk = [], None, None
    old_n = new_n = 0
    for raw in text.splitlines():
        if raw.startswith("diff --git "):
            m = re.match(r"diff --git a/(.*?) b/(.*)$", raw)
            cur = FileDiff(path=m.group(2) if m else raw, old_path=m.group(1) if m else None)
            files.append(cur); hunk = None
            continue
        if cur is None:
            continue
        if raw.startswith("new file mode"):
            cur.status = "added"
        elif raw.startswith("deleted file mode"):
            cur.status = "deleted"
        elif raw.startswith("rename to "):
            cur.status = "renamed"; cur.path = raw[len("rename to "):]
        elif raw.startswith("Binary files") or raw.startswith("GIT binary patch"):
            cur.binary = True
        elif raw.startswith("+++ "):
            p = raw[4:].strip()
            if p != "/dev/null":
                cur.path = p[2:] if p.startswith("b/") else p
        elif raw.startswith("--- "):
            continue
        elif raw.startswith("@@"):
            m = HUNK.match(raw)
            if not m:
                continue
            old_n, new_n = int(m.group(1)), int(m.group(3))
            hunk = Hunk(old_start=old_n, new_start=new_n)
            cur.hunks.append(hunk)
        elif hunk is not None:
            if raw.startswith("+"):
                hunk.lines.append(("+", new_n, raw[1:])); new_n += 1
            elif raw.startswith("-"):
                hunk.lines.append(("-", None, raw[1:])); old_n += 1
            elif raw.startswith("\\"):
                continue
            else:
                hunk.lines.append((" ", new_n, raw[1:] if raw.startswith(" ") else raw)); new_n += 1; old_n += 1
    return [f for f in files if f.status != "deleted"]


def from_github_files(files):
    """GitHub's pull-request files payload (filename, status, patch) to FileDiff."""
    out = []
    for f in files:
        status = {"added": "added", "removed": "deleted", "modified": "modified", "renamed": "renamed"}.get(f.get("status"), "modified")
        if status == "deleted":
            continue
        fd = FileDiff(path=f.get("filename"), old_path=f.get("previous_filename"), status=status)
        patch = f.get("patch")
        if not patch:
            fd.binary = True
            out.append(fd); continue
        parsed = parse_unified("diff --git a/x b/x\n+++ b/" + fd.path + "\n" + patch)
        if parsed:
            fd.hunks = parsed[0].hunks
        out.append(fd)
    return out


def numbered(fd, context=True):
    """The diff of one file as numbered text for the reviewer: new line numbers
    on added and context lines, removed lines marked, so a finding can cite
    a line the inline comment can land on."""
    out = [f"### {fd.path}  ({fd.status}, {fd.kind})"]
    if fd.binary:
        out.append("(binary)")
        return "\n".join(out)
    for h in fd.hunks:
        out.append(f"@@ new lines from {h.new_start} @@")
        for tag, n, t in h.lines:
            if tag == "+":
                out.append(f"{n:>5} + {t}")
            elif tag == "-":
                out.append(f"      - {t}")
            elif context:
                out.append(f"{n:>5}   {t}")
    return "\n".join(out)
