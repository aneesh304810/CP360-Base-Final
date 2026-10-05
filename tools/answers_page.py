#!/usr/bin/env python3
"""Write the review answers out as one readable page.

    python3 tools/answers_page.py        # -> docs/answers.html

Every question that has an answer, grouped by topic. For each one: what
was asked, who raised it, what the answer rests on, the quote where
there is one, what it does not settle, the question for SEI where there
is one, and the source.

No statistics and no charts. Everything on the page is a row in
data/hub_corpus.json, so re-run it after the corpus changes rather than
editing the HTML.
"""
import datetime
import html
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CLASS = {
    "document":  ("from a document",          "cls-doc"),
    "codebase":  ("verified in the platform", "cls-code"),
    "absence":   ("nothing recorded",         "cls-abs"),
    "inference": ("reasoned, not read",       "cls-inf"),
    "practice":  ("BBH recommendation",       "cls-rec"),
}

CSS = """
:root{--bg:#f4f6f8;--panel:#fff;--ink:#15212b;--ink2:#44535f;--mut:#76838e;
 --line:#dde4ea;--accent:#0f4775;--warnbg:#fdf2e3;--warnline:#e8c88f;
 --warnink:#6d5518;--askbg:#e8f1fb;--askline:#9cc2e4;color-scheme:light}
@media(prefers-color-scheme:dark){:root:not([data-theme=light]){
 --bg:#10151a;--panel:#18212a;--ink:#e8eef3;--ink2:#b4c1cc;--mut:#8a99a5;
 --line:#2a3741;--accent:#9cc2e4;--warnbg:#2a2214;--warnline:#5e4a1d;
 --warnink:#e3c98c;--askbg:#13263a;--askline:#2f5277;color-scheme:dark}}
:root[data-theme=dark]{--bg:#10151a;--panel:#18212a;--ink:#e8eef3;--ink2:#b4c1cc;
 --mut:#8a99a5;--line:#2a3741;--accent:#9cc2e4;--warnbg:#2a2214;
 --warnline:#5e4a1d;--warnink:#e3c98c;--askbg:#13263a;--askline:#2f5277;
 color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);padding:28px 16px 64px;
 font:15px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:860px;margin:0 auto}
h1{font-size:22px;margin:0 0 4px;letter-spacing:-.01em}
.sub{color:var(--mut);font-size:13px;margin:0 0 24px}
section{background:var(--panel);border:1px solid var(--line);border-radius:12px;
 padding:20px 22px;margin-bottom:18px}
h2{font-size:13px;margin:0 0 14px;letter-spacing:.02em;text-transform:uppercase;
 color:var(--accent)}
article{border-top:1px solid var(--line);padding:16px 0 4px}
article:first-of-type{border-top:0;padding-top:0}
header{display:flex;gap:10px;align-items:baseline}
.qn{font-weight:800;color:var(--accent);font-size:13px;flex:none;min-width:34px}
h3{font-size:14.5px;margin:0;font-weight:650;line-height:1.45}
.meta{font-size:11.5px;color:var(--mut);margin:4px 0 9px 44px}
p{margin:0 0 10px 44px;font-size:13.5px;color:var(--ink2);max-width:68ch}
.badge{border:1px solid var(--line);border-radius:3px;padding:1px 7px;
 font-size:10px;font-weight:700;color:var(--ink2)}
.badge.cls-doc{border-color:var(--askline);color:var(--accent)}
.badge.cls-abs{border-color:var(--warnline);color:var(--warnink)}
.quote{margin:4px 0 10px 44px;padding:8px 13px;font-size:12.5px;font-style:italic;
 color:var(--mut);border-left:3px solid var(--line);max-width:68ch}
.note{margin:10px 0 4px 44px;background:var(--warnbg);border:1px solid var(--warnline);
 border-radius:7px;padding:10px 13px;font-size:12.5px;color:var(--warnink);
 max-width:68ch}
.note::before{content:"What this does not settle \\00b7 ";font-weight:700}
.ask{margin:10px 0 4px 44px;background:var(--askbg);border:1px solid var(--askline);
 border-radius:7px;padding:10px 13px;font-size:12.5px;max-width:68ch;color:var(--ink)}
.src{font-size:11px;color:var(--mut);margin-top:-2px}
.src:empty{display:none}
.foot{color:var(--mut);font-size:12px;margin-left:0}
@media print{body{background:#fff;padding:0}
 section{break-inside:avoid;border-color:#ccc}}
"""


def build(corpus):
    Q = {q["qid"]: q for q in corpus["questions"]}
    A = {a["qid"]: a for a in corpus["answers"]}
    T = {t["topic_no"]: t["title"] for t in corpus["topics"]}
    O = {o["owner_code"]: o["name"] for o in corpus["owners"]}

    e = html.escape
    para = lambda t: "".join(f"<p>{e(b.strip())}</p>"
                             for b in (t or "").split("\n\n") if b.strip())

    out = []
    for no in sorted(T):
        qs = sorted((q for q in Q.values() if q["topic"] == no),
                    key=lambda x: x["qid"])
        done = [q for q in qs if q["qid"] in A]
        if not done:
            continue
        out.append(f'<section><h2>{no} &middot; {e(T[no])}</h2>')
        for q in done:
            a = A[q["qid"]]
            label, cls = CLASS.get(a["conf"], (a["conf"], ""))
            out.append(
                f'<article>'
                f'<header><span class="qn">Q{q["qid"]}</span>'
                f'<h3>{e(q["body"])}</h3></header>'
                f'<p class="meta">raised by {e(O.get(q["owner_code"], ""))}'
                f' &middot; <span class="badge {cls}">{e(label)}</span></p>'
                + para(a["body"])
                + (f'<blockquote class="quote">{e(a["quote"])}</blockquote>'
                   if a.get("quote") else "")
                + (f'<div class="note">{e(a["gap"])}</div>' if a.get("gap") else "")
                + (f'<div class="ask"><b>Ask SEI &middot;</b> {e(a["sei_ask"])}</div>'
                   if a.get("sei_ask") else "")
                + f'<p class="src">{e(" · ".join(a["ev"].split(" | ")) if a.get("ev") else "")}</p>'
                + '</article>')
        still = [q["qid"] for q in qs if q["qid"] not in A]
        if still:
            out.append('<p class="foot">Still open in this topic: '
                       + ", ".join(f"Q{n}" for n in still) + ".</p>")
        out.append("</section>")

    return (f'<!doctype html>\n<html lang="en"><head><meta charset="utf-8">\n'
            f'<meta name="viewport" content="width=device-width,initial-scale=1">\n'
            f'<title>Review answers</title><style>{CSS}</style></head>\n'
            f'<body><div class="wrap">\n'
            f'<h1>CP Integration Hub &mdash; answers and recommendations</h1>\n'
            f'<p class="sub">{len(A)} of {len(Q)} questions &middot; draft, nothing '
            f'agreed &middot; {datetime.date.today():%d %B %Y}</p>\n'
            + "\n".join(out) + '\n</div></body></html>\n')


if __name__ == "__main__":
    with open(os.path.join(ROOT, "data", "hub_corpus.json"), encoding="utf-8") as fh:
        corpus = json.load(fh)
    dest = os.path.join(ROOT, "docs", "answers.html")
    with open(dest, "w", encoding="utf-8") as fh:
        fh.write(build(corpus))
    print(f"{dest}: {len(corpus['answers'])} answers of "
          f"{len(corpus['questions'])} questions")
