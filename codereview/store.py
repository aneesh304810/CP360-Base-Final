"""Where reviews live: the CP 360 Oracle schema when the API's db module can
reach it (cr_review, cr_finding, sql/89), else a JSON file per review under
CR_HOME (default ./.codereview), which is what the command line uses."""
from __future__ import annotations

import json
import os
import time
import uuid

HOME = os.environ.get("CR_HOME", os.path.join(os.getcwd(), ".codereview"))


def new_id():
    return f"cr{int(time.time() * 1000)}{uuid.uuid4().hex[:6]}"


def pack_dir(review_id):
    return os.path.join(HOME, "packs", review_id)


def _db():
    try:
        from app.db import query, execute  # the API's layer, when running inside it
        return query, execute
    except Exception:                                                        # noqa: BLE001
        return None, None


def save(review: dict, findings: list):
    """review: id, repo, ref, kind (pr|push), number, head_sha, verdict, summary, status, pack_path, report_md, source."""
    os.makedirs(os.path.join(HOME, "reviews"), exist_ok=True)
    with open(os.path.join(HOME, "reviews", review["id"] + ".json"), "w", encoding="utf-8") as fh:
        json.dump({"review": review, "findings": [f.to_dict() if hasattr(f, "to_dict") else f for f in findings]}, fh, indent=1)
    query, execute = _db()
    if execute is None:
        return "file"
    try:
        st = [("MERGE INTO cr_review t USING (SELECT :id AS review_id FROM dual) s ON (t.review_id = s.review_id) "
               "WHEN MATCHED THEN UPDATE SET t.verdict = :verdict, t.summary = :summary, t.status = :status, t.report_md = :report_md, t.source = :source, t.updated_at = SYSTIMESTAMP "
               "WHEN NOT MATCHED THEN INSERT (review_id, repo, ref, kind, pr_number, head_sha, verdict, summary, status, pack_path, report_md, source) "
               "VALUES (:id, :repo, :ref, :kind, :number, :head_sha, :verdict, :summary, :status, :pack_path, :report_md, :source)",
               {k: review.get(k) for k in ("id", "repo", "ref", "kind", "number", "head_sha", "verdict", "summary", "status", "pack_path", "report_md", "source")}),
              ("DELETE FROM cr_finding WHERE review_id = :id", {"id": review["id"]})]
        for i, f in enumerate(findings):
            d = f.to_dict() if hasattr(f, "to_dict") else f
            st.append(("INSERT INTO cr_finding (finding_id, review_id, seq, rule_id, severity, file_path, line_no, title, message, fix, evidence, source, confidence) "
                       "VALUES (:fid, :id, :seq, :rule, :sev, :file, :line, :title, :msg, :fix, :ev, :src, :conf)",
                       {"fid": f"{review['id']}-{i + 1}", "id": review["id"], "seq": i + 1, "rule": d.get("rule"), "sev": d.get("severity"), "file": (d.get("file") or "")[:1000],
                        "line": d.get("line"), "title": (d.get("title") or "")[:200], "msg": (d.get("message") or "")[:2000], "fix": (d.get("fix") or "")[:2000],
                        "ev": (d.get("evidence") or "")[:400], "src": d.get("source"), "conf": d.get("confidence")}))
        execute(st)
        return "db"
    except Exception:                                                        # noqa: BLE001
        return "file"


def load(review_id):
    p = os.path.join(HOME, "reviews", review_id + ".json")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as fh:
            return json.load(fh)
    query, _ = _db()
    if query is None:
        return None
    try:
        rows = query("SELECT * FROM cr_review WHERE review_id = :id", {"id": review_id})
        if not rows:
            return None
        r = rows[0]
        fs = query("SELECT * FROM cr_finding WHERE review_id = :id ORDER BY seq", {"id": review_id})
        return {"review": {"id": r["review_id"], "repo": r.get("repo"), "ref": r.get("ref"), "kind": r.get("kind"), "number": r.get("pr_number"), "head_sha": r.get("head_sha"),
                           "verdict": r.get("verdict"), "summary": r.get("summary"), "status": r.get("status"), "pack_path": r.get("pack_path"), "report_md": r.get("report_md"), "source": r.get("source")},
                "findings": [{"rule": f.get("rule_id"), "severity": f.get("severity"), "file": f.get("file_path"), "line": f.get("line_no"), "title": f.get("title"), "message": f.get("message"),
                              "fix": f.get("fix"), "evidence": f.get("evidence"), "source": f.get("source"), "confidence": f.get("confidence")} for f in fs]}
    except Exception:                                                        # noqa: BLE001
        return None


def list_reviews(limit=100):
    out = []
    d = os.path.join(HOME, "reviews")
    if os.path.isdir(d):
        for name in sorted(os.listdir(d), reverse=True)[:limit]:
            try:
                with open(os.path.join(d, name), encoding="utf-8") as fh:
                    j = json.load(fh)
                r = j["review"]; r["findings_n"] = len(j.get("findings", []))
                out.append(r)
            except Exception:                                                # noqa: BLE001
                continue
    query, _ = _db()
    if query is not None:
        try:
            have = {r["id"] for r in out}
            for r in query("SELECT r.*, (SELECT COUNT(*) FROM cr_finding f WHERE f.review_id = r.review_id) AS findings_n FROM cr_review r ORDER BY created_at DESC FETCH FIRST :n ROWS ONLY", {"n": limit}):
                if r["review_id"] not in have:
                    out.append({"id": r["review_id"], "repo": r.get("repo"), "ref": r.get("ref"), "kind": r.get("kind"), "number": r.get("pr_number"), "verdict": r.get("verdict"),
                                "status": r.get("status"), "source": r.get("source"), "findings_n": int(r.get("findings_n") or 0), "created_at": str(r.get("created_at") or "")})
        except Exception:                                                    # noqa: BLE001
            pass
    return out
