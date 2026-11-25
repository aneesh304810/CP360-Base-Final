"""The orchestrator: a change in, a review out.

  run(fds, repo, ref, ...)     rules -> pack -> (Claude when configured) -> report -> store
  ingest(review_id, answer)    Copilot's answer -> parse -> merge -> final report -> store (-> GitHub)
  post(review_id)              the final report to the pull request or the commit
"""
from __future__ import annotations

import os

from . import github, report as R, store
from .diff import from_github_files, parse_unified
from .pack import build as build_pack, diff_md, rule_findings_md
from .rules import run_all, Finding


def _parse_repo(repo):
    owner, _, name = (repo or "").partition("/")
    return owner, name


def fds_from_pr(repo, number, with_text=True):
    owner, name = _parse_repo(repo)
    fds = from_github_files(github.pr_files(owner, name, number))
    sha = github.pr_head_sha(owner, name, number)
    if with_text:
        for fd in fds:
            if not fd.binary and fd.path.endswith((".py", ".sql", ".yml", ".yaml")):
                fd.new_text = github.file_text(owner, name, fd.path, sha)
    return fds, sha


def fds_from_push(repo, before, after, with_text=True):
    owner, name = _parse_repo(repo)
    fds = from_github_files(github.compare_files(owner, name, before, after))
    if with_text:
        for fd in fds:
            if not fd.binary and fd.path.endswith((".py", ".sql", ".yml", ".yaml")):
                fd.new_text = github.file_text(owner, name, fd.path, after)
    return fds


def fds_from_diff_file(path, root=None):
    with open(path, encoding="utf-8", errors="replace") as fh:
        fds = parse_unified(fh.read())
    if root:
        for fd in fds:
            p = os.path.join(root, fd.path)
            if os.path.isfile(p) and fd.path.endswith((".py", ".sql", ".yml", ".yaml")):
                with open(p, encoding="utf-8", errors="replace") as fh:
                    fd.new_text = fh.read()
    return fds


def run(fds, repo=None, ref=None, kind="diff", number=None, head_sha=None, use_llm=None, pack_url_base=None):
    """Rules, the pack, the model review when configured, the report. Returns the stored review dict."""
    rid = store.new_id()
    rule_findings = run_all(fds)
    pack_files, _ = build_pack(rid, repo, ref, fds, rule_findings, store.pack_dir(rid))
    findings, reviewer_verdict, summary, problems, source = list(rule_findings), None, "", [], "rules"
    use_llm = (os.environ.get("CR_LLM", "").lower() == "anthropic") if use_llm is None else use_llm
    if use_llm:
        from . import llm
        if llm.available():
            try:
                answer = llm.review(diff_md(fds), rule_findings_md(rule_findings))
                parsed = R.parse_answer(answer, source="claude", known_files=[f.path for f in fds])
                findings = R.merge(rule_findings, parsed["findings"]); reviewer_verdict, summary, problems, source = parsed["verdict"], parsed["summary"], parsed["problems"], "rules+claude"
            except Exception as e:                                           # noqa: BLE001
                problems.append(f"model review failed: {str(e)[:120]}")
    verdict = R.verdict_for(findings, reviewer_verdict)
    pack_url = f"{pack_url_base.rstrip('/')}/{rid}/copilot-prompt.md" if pack_url_base else pack_files["copilot-prompt.md"]
    review = {"id": rid, "repo": repo, "ref": ref, "kind": kind, "number": number, "head_sha": head_sha, "verdict": verdict, "summary": summary,
              "status": "final" if source != "rules" else "awaiting_copilot", "pack_path": pack_files["copilot-prompt.md"], "source": source, "problems": problems}
    review["report_md"] = R.to_markdown(review, findings, verdict, summary, problems, pack_url)
    review["stored"] = store.save(review, findings)
    review["findings"] = [f.to_dict() for f in findings]
    review["files"] = [f.path for f in fds]
    return review


def ingest(review_id, answer_text, source="copilot"):
    """Copilot's answer for an existing review: parse, merge with the stored rule findings, final report."""
    saved = store.load(review_id)
    if not saved:
        raise ValueError(f"review {review_id} not found")
    review = saved["review"]
    rule_findings = [Finding(**{k: v for k, v in f.items() if k in Finding.__dataclass_fields__}) for f in saved["findings"] if f.get("source") == "rule"]
    files = _files_of(review_id) or sorted({f["file"] for f in saved["findings"]})
    parsed = R.parse_answer(answer_text, source=source, known_files=files)
    findings = R.merge(rule_findings, parsed["findings"])
    verdict = R.verdict_for(findings, parsed["verdict"])
    review.update({"verdict": verdict, "summary": parsed["summary"], "status": "final", "source": f"rules+{source}", "problems": parsed["problems"]})
    review["report_md"] = R.to_markdown(review, findings, verdict, parsed["summary"], parsed["problems"])
    review["stored"] = store.save(review, findings)
    review["findings"] = [f.to_dict() for f in findings]
    review["files"] = files
    return review


def _files_of(review_id):
    import json
    p = os.path.join(store.pack_dir(review_id), "pack.json")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as fh:
            return json.load(fh).get("files")
    return None


def post(review, fds=None):
    """The report to GitHub: a review with inline comments on a pull request,
    a commit comment on a push. Returns what was posted."""
    repo = review.get("repo")
    if not repo:
        return {"posted": False, "why": "no repository on the review"}
    owner, name = _parse_repo(repo)
    findings = [Finding(**{k: v for k, v in f.items() if k in Finding.__dataclass_fields__}) if isinstance(f, dict) else f for f in review.get("findings", [])]
    body = review["report_md"]
    if review.get("number"):
        if fds is None:
            fds, _ = fds_from_pr(repo, review["number"], with_text=False)
        payload = R.github_review(findings, review["verdict"], body, fds)
        res = github.post_review(owner, name, review["number"], payload, commit_id=review.get("head_sha"))
        return {"posted": True, "kind": "pull_request_review", "url": res.get("html_url"), "inline": len(payload["comments"])}
    if review.get("head_sha"):
        res = github.post_commit_comment(owner, name, review["head_sha"], body)
        return {"posted": True, "kind": "commit_comment", "url": res.get("html_url"), "inline": 0}
    return {"posted": False, "why": "neither a pull request number nor a commit"}
