"""The final report: Copilot's (or Claude's) answer parsed into findings,
merged with the rule findings, a verdict, the Markdown report, and the
GitHub review payload."""
from __future__ import annotations

import re
from datetime import datetime, timezone

from .rules import Finding
from .standards import BY_ID

ORDER = ["blocker", "high", "medium", "low", "info"]
VERDICTS = ("APPROVE", "COMMENT", "REQUEST_CHANGES")


def parse_answer(text, source="copilot", known_files=None):
    """Findings and verdict from an answer in the output contract. Tolerant:
    rows are read from any Markdown table with a File column; the verdict
    from a VERDICT: line; missing pieces are reported, not raised."""
    findings, problems = [], []
    rows = _table_rows(text)
    if not rows:
        problems.append("no Findings table found; ask Copilot to rewrite in the output contract")
    for r in rows:
        file = r.get("file", "").strip().strip("`")
        if not file or file == "-" and r.get("finding", "").lower().startswith("no findings"):
            continue
        line = r.get("line", "").strip()
        line_n = int(line) if re.fullmatch(r"\d+", line) else None
        sev = r.get("severity", "").strip().lower()
        if sev not in ORDER:
            problems.append(f"severity {sev!r} on {file}:{line} is not one of {', '.join(ORDER)}; read as medium")
            sev = "medium"
        rule = r.get("rule", "").strip().strip("`")
        rule = rule if rule in BY_ID else ""
        if known_files and file not in known_files:
            close = [k for k in known_files if k.endswith(file) or file.endswith(k)]
            if close:
                file = close[0]
            else:
                problems.append(f"file {file!r} is not in the change; kept as a general note")
        findings.append(Finding(rule=rule or "CP360-CR-GEN-004", file=file, line=line_n, message=r.get("finding", "").strip(), fix=r.get("fix", "").strip(),
                                source=source, severity=sev, title=BY_ID[rule]["title"] if rule else "Reviewer finding", confidence="medium"))
    m = re.search(r"VERDICT:\s*(APPROVE|COMMENT|REQUEST[_ ]CHANGES)", text, re.I)
    verdict = m.group(1).upper().replace(" ", "_") if m else None
    if not verdict:
        problems.append("no VERDICT line found")
    summary = ""
    if m:
        after = text[m.end():].strip()
        summary = re.split(r"\n\s*\n", after, 1)[0].strip() if after else ""
    return {"findings": findings, "verdict": verdict, "summary": summary, "problems": problems}


def _table_rows(text):
    rows, header = [], None
    for line in text.splitlines():
        s = line.strip()
        if not s.startswith("|"):
            if header and rows:
                break
            header = None
            continue
        cells = [c.strip() for c in s.strip("|").split("|")]
        if header is None:
            if any(c.lower() == "file" for c in cells):
                header = [c.lower() for c in cells]
            continue
        if all(re.fullmatch(r":?-{2,}:?", c) for c in cells if c):
            continue
        if len(cells) < len(header):
            cells += [""] * (len(header) - len(cells))
        rows.append(dict(zip(header, cells)))
    return rows


def _words(s):
    return {w for w in re.findall(r"[a-z0-9_]+", (s or "").lower()) if len(w) > 3}


def merge(rule_findings, reviewer_findings):
    """Reviewer findings that restate a rule finding on the same file and
    line are dropped; one that adds to it (a different message) is kept,
    because the pack asked for exactly that."""
    by_key = {}
    for f in rule_findings:
        by_key.setdefault((f.rule, f.file, f.line), []).append(f)
    out = list(rule_findings)
    for f in reviewer_findings:
        twins = by_key.get((f.rule, f.file, f.line), []) if f.rule != "CP360-CR-GEN-004" else []
        if twins:
            msg = (f.message or "").lower()
            if re.search(r"\b(duplicate|same as|as above|already (found|listed|reported))\b", msg) or len(_words(msg)) < 4:
                continue
            if any(len(_words(msg) & _words(t.message)) / max(1, len(_words(msg))) >= 0.6 for t in twins):
                continue
        out.append(f)
    return sorted(out, key=lambda f: (ORDER.index(f.severity), f.file, f.line or 0))


def verdict_for(findings, reviewer_verdict=None):
    """Blocker or high from a rule forces REQUEST_CHANGES; else the reviewer's
    verdict, else by the worst severity."""
    worst = min((ORDER.index(f.severity) for f in findings), default=len(ORDER))
    if worst <= ORDER.index("high") and any(f.source == "rule" and ORDER.index(f.severity) <= 1 for f in findings):
        return "REQUEST_CHANGES"
    if reviewer_verdict in VERDICTS:
        return reviewer_verdict
    if worst <= 1:
        return "REQUEST_CHANGES"
    if worst <= 2:
        return "COMMENT"
    return "APPROVE"


def counts(findings):
    return {s: sum(1 for f in findings if f.severity == s) for s in ORDER}


def to_markdown(review, findings, verdict, summary="", problems=None, pack_url=None):
    c = counts(findings)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [f"# CP 360 code review · {review.get('repo', '-')} · {review.get('ref', '-')}", "",
             f"**Verdict: {verdict}**  ·  {c['blocker']} blocker · {c['high']} high · {c['medium']} medium · {c['low']} low · {c['info']} info  ·  {now}", ""]
    if summary:
        lines += ["> " + summary.replace("\n", "\n> "), ""]
    if problems:
        lines += ["_Reading the reviewer's answer: " + "; ".join(problems) + "._", ""]
    lines += ["| # | Severity | Where | Rule | Finding | Fix | By |", "|---|---|---|---|---|---|---|"]
    for i, f in enumerate(findings, 1):
        where = f"{f.file}" + (f":{f.line}" if f.line else "")
        rule = f"{f.rule} {f.title}" if f.rule and f.rule != "CP360-CR-GEN-004" else (f.title or "-")
        lines.append(f"| {i} | {f.severity} | `{where}` | {rule} | {f.message.replace('|', '/')} | {f.fix.replace('|', '/')} | {f.source} |")
    if not findings:
        lines.append("| - | info | - | - | No findings. | - | - |")
    lines += ["", "## Standards applied", "", "The findings cite CP360-CR rule ids from the CP 360 designs: the Airflow fan-out (18), the Python ingestion framework (13), Gold dbt (16), error handling (29), audit lineage (31), security (32), observability (34), the metadata and config store (33) and the DevOps 360 pipeline standards.", ""]
    if pack_url:
        lines += [f"Review pack for the judgement review: {pack_url}", ""]
    return "\n".join(lines)


def github_review(findings, verdict, body, fds):
    """The payload for POST /repos/{owner}/{repo}/pulls/{n}/reviews: inline
    comments where the line is in the diff, the rest folded into the body."""
    in_diff = {f.path: f for f in fds}
    comments, leftovers = [], []
    for f in findings:
        fd = in_diff.get(f.file)
        if f.line and fd is not None and fd.in_diff(f.line):
            comments.append({"path": f.file, "line": f.line, "side": "RIGHT",
                             "body": f"**{f.severity.upper()}** `{f.rule}` {f.title}\n\n{f.message}" + (f"\n\n**Fix:** {f.fix}" if f.fix else "") + f"\n\n_by {f.source}_"})
        else:
            leftovers.append(f"- **{f.severity}** `{f.file}`{(':' + str(f.line)) if f.line else ''} `{f.rule}`: {f.message}" + (f" Fix: {f.fix}" if f.fix else ""))
    event = {"APPROVE": "APPROVE", "COMMENT": "COMMENT", "REQUEST_CHANGES": "REQUEST_CHANGES"}[verdict]
    full = body + ("\n\n## Findings outside the diff\n\n" + "\n".join(leftovers) if leftovers else "")
    return {"event": event, "body": full, "comments": comments}
