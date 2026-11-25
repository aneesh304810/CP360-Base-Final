"""GitHub through the REST API with the standard library: the pull request's
files, the push's compare, a review with inline comments, an issue comment,
and webhook signature verification. The token comes from GITHUB_TOKEN (or
CR_GITHUB_TOKEN); GitHub Enterprise through GITHUB_API_URL."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import urllib.error
import urllib.request

API = os.environ.get("GITHUB_API_URL", "https://api.github.com").rstrip("/")


def _token():
    return os.environ.get("CR_GITHUB_TOKEN") or os.environ.get("GITHUB_TOKEN") or ""


def _req(method, path, body=None, raw=False, accept="application/vnd.github+json"):
    url = path if path.startswith("http") else f"{API}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Accept", accept)
    req.add_header("User-Agent", "cp360-codereview")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    if _token():
        req.add_header("Authorization", f"Bearer {_token()}")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            payload = r.read()
            return payload.decode("utf-8", "replace") if raw else (json.loads(payload) if payload else {})
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:300]
        raise RuntimeError(f"GitHub {method} {path} -> {e.code}: {detail}") from None


def verify_signature(secret, body: bytes, signature_header: str | None) -> bool:
    """X-Hub-Signature-256 against the raw body; False on any mismatch."""
    if not secret or not signature_header or not signature_header.startswith("sha256="):
        return False
    mac = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest("sha256=" + mac, signature_header)


def pr_files(owner, repo, number):
    files, page = [], 1
    while True:
        batch = _req("GET", f"/repos/{owner}/{repo}/pulls/{number}/files?per_page=100&page={page}")
        files.extend(batch)
        if len(batch) < 100:
            return files
        page += 1


def pr_head_sha(owner, repo, number):
    return _req("GET", f"/repos/{owner}/{repo}/pulls/{number}")["head"]["sha"]


def compare_files(owner, repo, base, head):
    return _req("GET", f"/repos/{owner}/{repo}/compare/{base}...{head}").get("files", [])


def file_text(owner, repo, path, ref):
    try:
        return _req("GET", f"/repos/{owner}/{repo}/contents/{path}?ref={ref}", raw=True, accept="application/vnd.github.raw+json")
    except RuntimeError:
        return None


def post_review(owner, repo, number, payload, commit_id=None):
    body = dict(payload)
    if commit_id:
        body["commit_id"] = commit_id
    try:
        return _req("POST", f"/repos/{owner}/{repo}/pulls/{number}/reviews", body)
    except RuntimeError as e:
        # a comment whose line GitHub will not accept fails the whole review: retry with the comments in the body
        if "422" in str(e) and body.get("comments"):
            folded = body["body"] + "\n\n## Inline comments GitHub could not place\n\n" + "\n".join(f"- `{c['path']}:{c['line']}` {c['body'].splitlines()[0]}" for c in body["comments"])
            return _req("POST", f"/repos/{owner}/{repo}/pulls/{number}/reviews", {"event": body["event"], "body": folded, **({"commit_id": commit_id} if commit_id else {})})
        raise


def post_issue_comment(owner, repo, number, body):
    return _req("POST", f"/repos/{owner}/{repo}/issues/{number}/comments", {"body": body})


def post_commit_comment(owner, repo, sha, body):
    return _req("POST", f"/repos/{owner}/{repo}/commits/{sha}/comments", {"body": body})


def open_pr_for_branch(owner, repo, branch):
    prs = _req("GET", f"/repos/{owner}/{repo}/pulls?state=open&head={owner}:{branch}")
    return prs[0]["number"] if prs else None
