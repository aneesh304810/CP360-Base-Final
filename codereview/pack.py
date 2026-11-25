"""The Copilot review pack: what a reviewer with no API access needs to
write the judgement half of the review in Microsoft 365 Copilot or Copilot
Chat in ask mode, and the fixed answer format the report parser reads back.

Files in a pack (one folder per review):
  00-README.md          how to run it in Copilot, in five steps
  01-instructions.md    the senior data engineer persona and the output contract
  02-standards.md       the CP 360 standards digest
  03-rule-findings.md   what the deterministic rules already found (do not repeat)
  04-diff.md            the numbered diff, file by file
  copilot-prompt.md     all of the above in one file, for pasting or attaching
"""
from __future__ import annotations

import json
import os

from .standards import digest

ANSWER_FORMAT = """## Output contract

Answer with exactly two sections and nothing else.

### Findings

A Markdown table with these columns, one row per finding, most severe first:

| File | Line | Severity | Rule | Finding | Fix |
|---|---|---|---|---|---|

- `File` is the path as shown in the diff. `Line` is the new line number shown in the diff (a number), or `-` for a file-level finding.
- `Severity` is one of blocker, high, medium, low, info.
- `Rule` is the CP360-CR id from the standards when one applies, else `-`.
- `Finding` says what is wrong and why it matters in production, in one or two sentences. `Fix` says the change to make.
- Do not repeat a finding already listed under rule findings; add to it only if you see something the rule did not.
- If there is nothing to report, the table has one row: `| - | - | info | - | No findings beyond the rule checks. | - |`.

### Verdict

One line: `VERDICT: APPROVE`, `VERDICT: COMMENT` or `VERDICT: REQUEST_CHANGES`, then one paragraph for the author: what is good, what must change before production, in the voice of a senior engineer who wants the change to ship.
"""

INSTRUCTIONS = """# Instructions for the reviewer

You are a senior data engineer on the CP 360 Integration Hub platform reviewing a pull request for production readiness. The platform is Airflow orchestrating a Python ingestion framework and dbt models on Oracle, with the Integration Hub's Python services around it. Review the diff below against the CP 360 standards, which come from the platform's design documents; cite the standard's id when one applies, and say which design decision is at stake.

What you look for, in this order:
1. Correctness and data safety: anything that could load wrong data, lose a row, rewrite history (AD-2), or retry a structural failure.
2. Production readiness: error classification, idempotency, timeouts and breakers, secrets and hosts, logging with keys not values, audit events on the key paths.
3. Standards and anti-patterns: the rule list, plus the ones a reviewer sees and a rule cannot: a second code path, transformation in a DAG, a feed-specific branch, a contract broken quietly.
4. Tests and evidence: what changed without a test, what gate would catch it.

How you write:
- Be specific: file, line, what, why, fix. One finding per row. No praise padding, no generic advice.
- Severity by consequence in production, not by how easy the fix is.
- When the diff is partial (added lines only), say what you would need to see to be sure, rather than guessing.
- Never quote a secret, a hostname or a data value back; refer to the line.

""" + ANSWER_FORMAT

README = """# Review pack {review_id}

Repository: {repo}  ·  Change: {ref}  ·  Files: {n_files}  ·  Rule findings: {n_rules}

## Run it in Microsoft 365 Copilot or Copilot Chat (ask mode)

1. Open a new chat. Attach `copilot-prompt.md` (or paste its contents; it is the four files below in one).
2. Send: "Review this pull request as the instructions say and answer in the output contract."
3. Copy Copilot's whole answer (the Findings table and the Verdict line) into a file, for example `copilot-report.md`.
4. Paste it on the Code Review 360 page for this review, or run:
   `python -m codereview ingest --review {review_id} --report copilot-report.md --post`
5. The final report merges Copilot's findings with the rule findings, posts the review comments to the pull request and stores the review in CP 360.

If Copilot's answer does not follow the table format, send: "Rewrite your answer exactly in the output contract: the Findings table and the VERDICT line, nothing else."

## Files

- 01-instructions.md: the reviewer persona and the output contract
- 02-standards.md: the CP 360 standards the review holds code to
- 03-rule-findings.md: what the rules already found
- 04-diff.md: the numbered diff
"""


def rule_findings_md(findings):
    if not findings:
        return "# Rule findings\n\nNone. The deterministic checks found nothing; the judgement review is the whole review.\n"
    lines = ["# Rule findings", "", "These were found by the deterministic checks and will be posted as comments. Do not repeat them; add only what they miss.", "",
             "| File | Line | Severity | Rule | Finding |", "|---|---|---|---|---|"]
    for f in sorted(findings, key=lambda x: ("blocker high medium low info".split().index(x.severity), x.file, x.line or 0)):
        lines.append(f"| {f.file} | {f.line if f.line is not None else '-'} | {f.severity} | {f.rule} | {f.message.replace('|', '/')} |")
    return "\n".join(lines) + "\n"


def diff_md(fds):
    from .diff import numbered
    parts = ["# The change, numbered", "", "New line numbers are on the left of added (+) and context lines; removed lines are marked -. Cite the new line number.", ""]
    for fd in fds:
        parts.append(numbered(fd)); parts.append("")
    return "\n".join(parts)


def build(review_id, repo, ref, fds, findings, out_dir):
    """Write the pack to out_dir and return the file paths plus the combined prompt text."""
    os.makedirs(out_dir, exist_ok=True)
    files = {
        "00-README.md": README.format(review_id=review_id, repo=repo or "-", ref=ref or "-", n_files=len(fds), n_rules=len(findings)),
        "01-instructions.md": INSTRUCTIONS,
        "02-standards.md": digest(),
        "03-rule-findings.md": rule_findings_md(findings),
        "04-diff.md": diff_md(fds),
    }
    combined = "\n\n---\n\n".join(files[k] for k in ("01-instructions.md", "02-standards.md", "03-rule-findings.md", "04-diff.md"))
    files["copilot-prompt.md"] = f"<!-- CP 360 review pack {review_id} · {repo or '-'} · {ref or '-'} -->\n\n" + combined
    for name, text in files.items():
        with open(os.path.join(out_dir, name), "w", encoding="utf-8") as fh:
            fh.write(text)
    with open(os.path.join(out_dir, "pack.json"), "w", encoding="utf-8") as fh:
        json.dump({"review_id": review_id, "repo": repo, "ref": ref, "files": [f.path for f in fds], "rule_findings": [f.to_dict() for f in findings]}, fh, indent=1)
    return {name: os.path.join(out_dir, name) for name in files}, combined
