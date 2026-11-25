"""CP 360 code review, driven on fixtures and fakes: the diff parser, every
rule on the synthetic fixtures (and silence on the good ones), the pack, the
Copilot answer parser, merge and verdict, the GitHub payload, the webhook
signature, and the router with a fake GitHub. No network, no Oracle.
Run: python3.13 api/test/test_codereview.py"""
import hashlib
import hmac
import json
import os
import sys
import tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "api"))
os.environ["CR_HOME"] = tempfile.mkdtemp()

from codereview.diff import parse_unified, from_github_files, kind_of, FileDiff, Hunk   # noqa: E402
from codereview.rules import run_all                                              # noqa: E402
from codereview.standards import RULES, BY_ID, digest                             # noqa: E402
from codereview import report as R, pack as P, github as G, review as RV, store   # noqa: E402

BAD = 0


def ok(cond, msg, got=""):
    global BAD
    print(("ok   " if cond else "FAIL ") + msg + ("" if cond else f"  -> {str(got)[:240]}"))
    if not cond:
        BAD += 1


FIX = os.path.join(ROOT, "codereview", "fixtures")


def as_added(path, name=None):
    with open(path, encoding="utf-8") as fh:
        text = fh.read()
    fd = FileDiff(path=name or os.path.relpath(path, ROOT), status="added", new_text=text)
    fd.hunks = [Hunk(0, 1, [("+", i + 1, t) for i, t in enumerate(text.splitlines())])]
    return fd


print("-- standards")
ok(len(RULES) >= 40 and len({r["id"] for r in RULES}) == len(RULES) and all(r["ref"] for r in RULES), "every rule has a unique id and a design reference")
ok("CP360-CR-AF-001" in digest() and "AD-9" in digest(), "the digest carries the rules and their design decisions")

print("-- the diff parser")
diff = """diff --git a/dags/eod.py b/dags/eod.py
index 1..2 100644
--- a/dags/eod.py
+++ b/dags/eod.py
@@ -1,3 +1,5 @@
 import os
+from airflow import DAG
+PASSWORD = "hunter22!"
 x = 1
-y = 2
+y = 3
diff --git a/models/fct_x.sql b/models/fct_x.sql
new file mode 100644
--- /dev/null
+++ b/models/fct_x.sql
@@ -0,0 +1,2 @@
+{{ config(materialized='incremental') }}
+select * from silver.t
"""
fds = parse_unified(diff)
ok([f.path for f in fds] == ["dags/eod.py", "models/fct_x.sql"] and fds[1].status == "added", "two files, the second new", [(f.path, f.status) for f in fds])
ok(fds[0].added == [(2, "from airflow import DAG"), (3, 'PASSWORD = "hunter22!"'), (5, "y = 3")] and fds[0].in_diff(4) and not fds[0].in_diff(9), "added lines carry new line numbers; context lines are in the diff, untouched lines are not", fds[0].added)
ok(fds[0].kind == "airflow" and fds[1].kind == "dbt_model" and kind_of("db/changelog/001.xml", "<changeSet") == "liquibase" and kind_of("models/schema.yml", "models:") == "dbt_yaml", "kinds from path and text")
gh = from_github_files([{"filename": "hub/svc.py", "status": "modified", "patch": "@@ -10,2 +10,3 @@\n a\n+print('x')\n b"}, {"filename": "x.png", "status": "added"}])
ok(gh[0].added == [(11, "print('x')")] and gh[1].binary, "GitHub file payloads parse the same way; no patch means binary")

print("-- the rules on the fixtures")
bad = [as_added(os.path.join(FIX, n), f"codereview/fixtures/{n}") for n in ("bad_dag.py", "bad_hub.py", "bad_model.sql", "schema.yml", "bad_release.sql")]
found = run_all(bad)
hit = {f.rule for f in found}
want = {"CP360-CR-AF-001", "CP360-CR-AF-002", "CP360-CR-AF-003", "CP360-CR-AF-004", "CP360-CR-AF-005", "CP360-CR-AF-006", "CP360-CR-AF-009",
        "CP360-CR-PY-001", "CP360-CR-PY-002", "CP360-CR-PY-003", "CP360-CR-PY-004", "CP360-CR-PY-005", "CP360-CR-PY-006", "CP360-CR-PY-007", "CP360-CR-PY-008", "CP360-CR-PY-009", "CP360-CR-PY-010",
        "CP360-CR-DBT-001", "CP360-CR-DBT-002", "CP360-CR-DBT-003", "CP360-CR-DBT-004", "CP360-CR-DBT-005", "CP360-CR-DBT-006", "CP360-CR-DBT-008",
        "CP360-CR-SQL-001", "CP360-CR-SQL-002", "CP360-CR-SQL-003", "CP360-CR-SQL-004", "CP360-CR-SEC-001", "CP360-CR-SEC-002"}
ok(want <= hit, "every planted anti-pattern is found", sorted(want - hit))
dag = [f for f in found if f.file.endswith("bad_dag.py")]
ok(any(f.rule == "CP360-CR-AF-001" and "retries=3" in f.message for f in dag) and any(f.rule == "CP360-CR-AF-001" and "G1-Structural Gate" in f.message for f in dag), "retries on default_args and on the gate task are two findings")
ok(any(f.rule == "CP360-CR-AF-003" and f.line == 8 for f in dag) and any(f.rule == "CP360-CR-AF-005" and f.line == 9 for f in dag), "parse-time work and the Variable secret are on their lines", [(f.rule, f.line) for f in dag])
hub = [f for f in found if f.file.endswith("bad_hub.py")]
sec = [f for f in hub if f.rule == "CP360-CR-SEC-001"]
ok(sec and "Sup3rSecret" not in sec[0].evidence and sec[0].line == 7, "the literal password is found and not quoted back", [(f.line, f.evidence) for f in sec])
ok(any(f.rule == "CP360-CR-PY-002" for f in hub) and any(f.rule == "CP360-CR-PY-004" and f.line == 30 for f in hub), "match-before-write on the endpoint and the DELETE against RAW", [(f.rule, f.line) for f in hub])
yml = [f for f in found if f.file.endswith("schema.yml")]
ok(len(yml) == 3 and {("description" in f.message, "unique" in f.message) for f in yml} >= {(True, False), (False, True)}, "schema.yml: no description, an undocumented column, no key test, three findings", [f.message for f in yml])
good = run_all([as_added(os.path.join(FIX, "good_dag.py"), "dags/good_dag.py")])
ok([f.rule for f in good if f.rule != "CP360-CR-OPS-003"] == [], "the good DAG is clean apart from 'no test changed with it'", [(f.rule, f.message) for f in good])
ok(any(f.rule == "CP360-CR-OPS-003" for f in good) and not any(f.rule == "CP360-CR-OPS-003" for f in run_all([as_added(os.path.join(FIX, "good_dag.py"), "dags/good_dag.py"), as_added(os.path.join(FIX, "schema.yml"), "models/schema.yml")])), "production code without a test is flagged; with a schema.yml change it is not")

print("-- the pack")
rid = "crTEST"
files, combined = P.build(rid, "acme/hub", "feature/CP-1", bad, found, store.pack_dir(rid))
ok(set(files) == {"00-README.md", "01-instructions.md", "02-standards.md", "03-rule-findings.md", "04-diff.md", "copilot-prompt.md"} and all(os.path.exists(p) for p in files.values()), "six files written")
ok("Output contract" in combined and "| File | Line | Severity | Rule | Finding | Fix |" in combined and "VERDICT:" in combined and "codereview/fixtures/bad_dag.py" in combined and "   18 + with DAG(" in combined, "the prompt carries the contract, the standards, the findings and the numbered diff", combined[-300:])
ok("Sup3rSecret" in combined, "the diff itself is in the pack (the reviewer must see the code; the pack is private to the reviewer)")

print("-- Copilot's answer parsed, merged, judged")
answer = """Here is my review.

### Findings

| File | Line | Severity | Rule | Finding | Fix |
|---|---|---|---|---|---|
| codereview/fixtures/bad_hub.py | 14 | high | CP360-CR-PY-005 | The status poll has no circuit breaker; a degraded loader API is hammered every cycle. | Wrap the call in the shared breaker with the design's thresholds. |
| codereview/fixtures/bad_dag.py | - | medium | - | The DAG has no documentation string naming the design component it implements. | Add the module docstring with the component number. |
| bad_hub.py | 21 | critical | CP360-CR-PY-002 | duplicate of the rule finding | - |

### Verdict

VERDICT: REQUEST_CHANGES
Good bones, but the retry loop and the endpoint ordering are production incidents waiting to happen. Fix those two and the secrets, and this ships.
"""
parsed = R.parse_answer(answer, known_files=[f.file for f in found])
ok(len(parsed["findings"]) == 3 and parsed["verdict"] == "REQUEST_CHANGES" and parsed["summary"].startswith("Good bones") and parsed["findings"][0].rule == "CP360-CR-PY-005" and parsed["findings"][0].source == "copilot", "findings, verdict and the paragraph are read", (len(parsed["findings"]), parsed["verdict"], parsed["summary"][:30]))
ok(parsed["findings"][1].rule == "CP360-CR-GEN-004" and parsed["findings"][1].line is None and parsed["findings"][2].severity == "medium" and parsed["findings"][2].file.endswith("bad_hub.py") and any("critical" in p for p in parsed["problems"]), "no rule becomes a reviewer note, an unknown severity is reported and read as medium, a short file name is matched", parsed["problems"])
merged = R.merge(found, parsed["findings"])
ok(len(merged) == len(found) + 2 and merged[0].severity == "blocker", "the duplicate of a rule finding is dropped; the rest merge, most severe first")
ok(R.verdict_for(merged, "APPROVE") == "REQUEST_CHANGES" and R.verdict_for([f for f in merged if f.severity in ("medium",)], "APPROVE") == "APPROVE" and R.verdict_for([f for f in merged if f.severity == "medium"], None) == "COMMENT", "a rule blocker forces Request changes; otherwise the reviewer's verdict, else by the worst severity")
md = R.to_markdown({"repo": "acme/hub", "ref": "feature/CP-1"}, merged, "REQUEST_CHANGES", parsed["summary"], parsed["problems"], "https://api/codereview/reviews/crTEST/pack")
ok(md.startswith("# CP 360 code review · acme/hub") and "**Verdict: REQUEST_CHANGES**" in md and "| by |" not in md and "copilot |" in md and "rule |" in md, "the Markdown report has the verdict, the counts and who found what")
payload = R.github_review(merged, "REQUEST_CHANGES", md, bad)
ok(payload["event"] == "REQUEST_CHANGES" and all(c["side"] == "RIGHT" and c["line"] for c in payload["comments"]) and len(payload["comments"]) >= 25 and "Findings outside the diff" in payload["body"], "inline comments where the line is in the diff; file-level findings fold into the body", len(payload["comments"]))
empty = R.parse_answer("I could not find anything.\n\nVERDICT: APPROVE\nLooks good.")
ok(empty["findings"] == [] and empty["verdict"] == "APPROVE" and any("no Findings table" in p for p in empty["problems"]), "a missing table is reported, not fatal")

print("-- the webhook signature")
secret, body = "s3", b'{"a":1}'
sig = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
ok(G.verify_signature(secret, body, sig) and not G.verify_signature(secret, body + b" ", sig) and not G.verify_signature("", body, sig) and not G.verify_signature(secret, body, None), "the signature verifies the raw body and refuses everything else")

print("-- the orchestrator on a fake GitHub")
rv = RV.run(bad, repo="acme/hub", ref="feature/CP-1", kind="pr", number=7, head_sha="abc123")
ok(rv["verdict"] == "REQUEST_CHANGES" and rv["status"] == "awaiting_copilot" and rv["source"] == "rules" and rv["stored"] == "file" and os.path.exists(rv["pack_path"]), "a run stores the review and writes the pack; without a model it awaits Copilot", {k: rv[k] for k in ("verdict", "status", "source", "stored")})
posted = {}
G.post_review = lambda owner, repo, number, payload, commit_id=None: posted.update({"owner": owner, "repo": repo, "number": number, "payload": payload, "commit": commit_id}) or {"html_url": "https://x/r/1"}
res = RV.post(rv, bad)
ok(res["posted"] and posted["number"] == 7 and posted["commit"] == "abc123" and posted["payload"]["event"] == "REQUEST_CHANGES" and res["inline"] == len(posted["payload"]["comments"]), "posting sends the review to the pull request at the head commit", res)
rv2 = RV.ingest(rv["id"], answer)
ok(rv2["status"] == "final" and rv2["source"] == "rules+copilot" and rv2["summary"].startswith("Good bones") and len(rv2["findings"]) == len(rv["findings"]) + 2, "ingesting Copilot's answer makes the review final with its findings merged", (rv2["status"], len(rv2["findings"]), len(rv["findings"])))
lst = store.list_reviews()
ok(any(r["id"] == rv["id"] and r["status"] == "final" for r in lst), "the review lists as final")

print("-- the router")
import app.routers_codereview as CR   # noqa: E402
from fastapi import HTTPException  # noqa: E402
import asyncio  # noqa: E402


class Req:
    def __init__(self, body, headers):
        self._b, self.headers, self.base_url = body, headers, "http://api/"
    async def body(self): return self._b
    async def json(self): return json.loads(self._b)


class BG:
    def __init__(self): self.tasks = []
    def add_task(self, fn, *a): self.tasks.append((fn.__name__, a))


os.environ["CR_WEBHOOK_SECRET"] = "s3"
ev = json.dumps({"action": "opened", "repository": {"full_name": "acme/hub"}, "pull_request": {"number": 9, "title": "CP-1 fan-out", "draft": False}}).encode()
sig = "sha256=" + hmac.new(b"s3", ev, hashlib.sha256).hexdigest()
bg = BG()
out = asyncio.run(CR.webhook(Req(ev, {"X-Hub-Signature-256": sig, "X-GitHub-Event": "pull_request"}), bg))
ok(out["accepted"] and bg.tasks and bg.tasks[0][0] == "_run_pr" and bg.tasks[0][1][:2] == ("acme/hub", 9), "a signed pull_request event is accepted and queued", (out, bg.tasks))
try:
    asyncio.run(CR.webhook(Req(ev, {"X-Hub-Signature-256": "sha256=bad", "X-GitHub-Event": "pull_request"}), BG()))
    ok(False, "a bad signature is refused")
except HTTPException as e:
    ok(e.status_code == 401, "a bad signature is refused")
draft = json.dumps({"action": "opened", "repository": {"full_name": "acme/hub"}, "pull_request": {"number": 9, "draft": True}}).encode()
out = asyncio.run(CR.webhook(Req(draft, {"X-Hub-Signature-256": "sha256=" + hmac.new(b"s3", draft, hashlib.sha256).hexdigest(), "X-GitHub-Event": "pull_request"}), BG()))
ok(not out["accepted"], "a draft is skipped")
push = json.dumps({"ref": "refs/heads/feature/x", "before": "a", "after": "b", "repository": {"full_name": "acme/hub"}}).encode()
bg = BG()
out = asyncio.run(CR.webhook(Req(push, {"X-Hub-Signature-256": "sha256=" + hmac.new(b"s3", push, hashlib.sha256).hexdigest(), "X-GitHub-Event": "push"}), bg))
ok(out["accepted"] and bg.tasks[0][0] == "_run_push", "a push is queued")
ok(CR.one(rv["id"])["review"]["status"] == "final" and "Output contract" in CR.pack(rv["id"]) and len(CR.standards()["rules"]) == len(RULES), "the review, its pack and the standards are served")
h = CR.health()
ok(h["webhookSecret"] is True and "llm" in h, "health says what is configured")
main = open(os.path.join(ROOT, "api", "app", "main.py")).read()
ok('"routers_codereview"' in main, "the router is mounted")
ok(not any(k in open(os.path.join(ROOT, "codereview", "standards.py")).read() for k in ("testbbh", "@bbh.com")), "the standards carry no host or address")

print()
if BAD:
    print(f"{BAD} FAILED"); sys.exit(1)
print("codereview assertions pass")
