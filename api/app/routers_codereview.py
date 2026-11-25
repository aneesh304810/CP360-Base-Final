"""CP 360 code review: the GitHub webhook and the review records.

    POST /codereview/webhook                 GitHub: pull_request (opened, synchronize, reopened, ready_for_review) and push
    GET  /codereview/reviews                 the reviews, newest first
    GET  /codereview/reviews/{id}            one review with its findings and report
    GET  /codereview/reviews/{id}/pack       the Copilot prompt (copilot-prompt.md) to attach in M365 Copilot
    POST /codereview/reviews/{id}/ingest     Copilot's answer pasted back: final report, posted to GitHub when asked
    POST /codereview/run                     review a pull request on demand: {repo, number, post}
    GET  /codereview/standards               the rule catalogue
    GET  /codereview/health                  what is configured: token, secret, model

THE WEBHOOK VERIFIES THE SIGNATURE with CR_WEBHOOK_SECRET and returns 202 at
once; the review runs in the background: rules, the pack, the report, a
pull-request review with the rule findings (or a commit comment on a push),
the record in cr_review. The judgement half is Copilot's: the pull-request
comment carries the link to the pack, and the answer comes back through
/ingest or the Code Review 360 page.

Set CR_LLM=anthropic with an ANTHROPIC_API_KEY to have Claude write the
judgement half in the same run; the Copilot path still works beside it.
"""
from __future__ import annotations

import logging
import os
import sys

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

log = logging.getLogger("cp.api.codereview")
router = APIRouter(prefix="/codereview", tags=["codereview"])

# the package lives at the repository root, beside api/
_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from codereview import review as RV, store, github  # noqa: E402
from codereview.standards import RULES, AREAS  # noqa: E402

EVENTS = {"opened", "synchronize", "reopened", "ready_for_review"}


def _pack_url_base(request: Request | None):
    base = os.environ.get("CR_PUBLIC_API_URL") or (str(request.base_url).rstrip("/") if request else "")
    return f"{base}/codereview/reviews" if base else None


def _run_pr(repo, number, title, post, pack_base):
    try:
        fds, sha = RV.fds_from_pr(repo, number)
        rv = RV.run(fds, repo=repo, ref=title or f"#{number}", kind="pr", number=number, head_sha=sha, pack_url_base=pack_base)
        if post:
            rv["github"] = RV.post(rv, fds)
        log.info("codereview %s: %s #%s -> %s, %s findings, %s", rv["id"], repo, number, rv["verdict"], len(rv["findings"]), rv.get("github"))
    except Exception as e:                                                   # noqa: BLE001
        log.warning("codereview failed for %s #%s: %s", repo, number, str(e)[:200])


def _run_push(repo, ref, before, after, post, pack_base):
    try:
        fds = RV.fds_from_push(repo, before, after)
        owner, name = repo.split("/", 1)
        branch = ref.replace("refs/heads/", "")
        number = github.open_pr_for_branch(owner, name, branch)
        rv = RV.run(fds, repo=repo, ref=branch, kind="pr" if number else "push", number=number, head_sha=after, pack_url_base=pack_base)
        if post:
            rv["github"] = RV.post(rv, fds)
        log.info("codereview %s: push %s %s -> %s, %s findings", rv["id"], repo, branch, rv["verdict"], len(rv["findings"]))
    except Exception as e:                                                   # noqa: BLE001
        log.warning("codereview failed for push %s %s: %s", repo, ref, str(e)[:200])


@router.get("/health")
def health():
    return {"githubToken": bool(os.environ.get("CR_GITHUB_TOKEN") or os.environ.get("GITHUB_TOKEN")), "webhookSecret": bool(os.environ.get("CR_WEBHOOK_SECRET")),
            "llm": os.environ.get("CR_LLM", "") or "none", "post": os.environ.get("CR_POST", "1") not in ("0", "false", "no"), "home": store.HOME}


@router.get("/standards")
def standards():
    return {"areas": AREAS, "rules": RULES}


@router.post("/webhook", status_code=202)
async def webhook(request: Request, bg: BackgroundTasks):
    body = await request.body()
    secret = os.environ.get("CR_WEBHOOK_SECRET", "")
    if not github.verify_signature(secret, body, request.headers.get("X-Hub-Signature-256")):
        raise HTTPException(401, "signature missing or wrong: set CR_WEBHOOK_SECRET to the webhook's secret")
    event = request.headers.get("X-GitHub-Event", "")
    payload = await request.json()
    post = os.environ.get("CR_POST", "1") not in ("0", "false", "no")
    pack_base = _pack_url_base(request)
    if event == "ping":
        return {"accepted": True, "event": "ping"}
    if event == "pull_request":
        if payload.get("action") not in EVENTS or payload.get("pull_request", {}).get("draft"):
            return {"accepted": False, "why": f"action {payload.get('action')} or draft"}
        repo = payload["repository"]["full_name"]; pr = payload["pull_request"]
        bg.add_task(_run_pr, repo, pr["number"], pr.get("title"), post, pack_base)
        return {"accepted": True, "event": "pull_request", "repo": repo, "number": pr["number"]}
    if event == "push":
        if payload.get("deleted") or not payload.get("after") or set(payload.get("after", "")) == {"0"}:
            return {"accepted": False, "why": "branch deleted"}
        repo = payload["repository"]["full_name"]
        bg.add_task(_run_push, repo, payload.get("ref", ""), payload.get("before"), payload.get("after"), post, pack_base)
        return {"accepted": True, "event": "push", "repo": repo, "ref": payload.get("ref")}
    return {"accepted": False, "why": f"event {event} not handled"}


class RunBody(BaseModel):
    repo: str
    number: int
    post: bool = False


@router.post("/run")
def run_now(body: RunBody, request: Request):
    fds, sha = RV.fds_from_pr(body.repo, body.number)
    rv = RV.run(fds, repo=body.repo, ref=f"#{body.number}", kind="pr", number=body.number, head_sha=sha, pack_url_base=_pack_url_base(request))
    if body.post:
        rv["github"] = RV.post(rv, fds)
    return rv


@router.get("/reviews")
def reviews(limit: int = 100):
    return {"reviews": store.list_reviews(min(500, max(1, int(limit or 100))))}


@router.get("/reviews/{review_id}")
def one(review_id: str):
    saved = store.load(review_id)
    if not saved:
        raise HTTPException(404, "no such review")
    return saved


@router.get("/reviews/{review_id}/pack", response_class=PlainTextResponse)
def pack(review_id: str):
    p = os.path.join(store.pack_dir(review_id), "copilot-prompt.md")
    if not os.path.exists(p):
        raise HTTPException(404, "the pack for this review is not on this server")
    with open(p, encoding="utf-8") as fh:
        return fh.read()


class IngestBody(BaseModel):
    answer: str
    post: bool = False
    source: str = "copilot"


@router.post("/reviews/{review_id}/ingest")
def ingest(review_id: str, body: IngestBody):
    if not body.answer.strip():
        raise HTTPException(400, "paste Copilot's answer: the Findings table and the VERDICT line")
    try:
        rv = RV.ingest(review_id, body.answer, source=body.source if body.source in ("copilot", "claude") else "copilot")
    except ValueError as e:
        raise HTTPException(404, str(e))
    if body.post:
        try:
            rv["github"] = RV.post(rv)
        except Exception as e:                                               # noqa: BLE001
            rv["github"] = {"posted": False, "why": str(e)[:200]}
    return rv
