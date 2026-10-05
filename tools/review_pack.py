#!/usr/bin/env python3
"""Build the architecture review pack from the discussion corpus.

WHY A GENERATOR AND NOT A DECK. The counts, the topic progress and the
eight SEI asks all come from data/hub_corpus.json. Typed into slides they
are wrong the first time somebody answers a question. Generated, they are
a re-run.

    node ui/scripts/export_hub_corpus.mjs    # only if the corpus changed
    python3 tools/review_pack.py             # writes docs/review-pack.html

Nothing here invents content: every sentence on the page is a row in the
corpus. The one editorial decision is which three recommendations to show
in full, and that is the SHOW list below.

The chart palette is the validated categorical set (slots 1-4 plus a
neutral for "still open"), with every segment directly labelled because
two of the light-mode steps sit under 3:1 on the surface.
"""
import datetime
import html
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOW = [72, 58, 67]          # shown in full; the rest are listed by number


def build(corpus):
    Q = {q["qid"]: q for q in corpus["questions"]}
    A = {a["qid"]: a for a in corpus["answers"]}
    T = {t["topic_no"]: t["title"] for t in corpus["topics"]}
    O = {o["owner_code"]: o["name"] for o in corpus["owners"]}

    total, answered = len(Q), len(A)
    openq = total - answered
    asks = sorted((a for a in A.values() if a.get("sei_ask")),
                  key=lambda x: x["qid"])

    n_of = lambda *c: sum(1 for a in A.values() if a["conf"] in c)
    buckets = [
        ("Answered from a document", n_of("document"), "#2a78d6", "#3987e5"),
        ("Verified in our platform", n_of("codebase"), "#eb6834", "#d95926"),
        ("Nothing recorded (a finding)", n_of("absence"), "#1baf7a", "#199e70"),
        ("Our recommendation", n_of("practice", "inference"), "#eda100", "#c98500"),
        ("Still open", openq, "#9aa3ab", "#6b7682"),
    ]
    if sum(b[1] for b in buckets) != total:
        raise SystemExit("buckets do not add to the question count — a new "
                         "evidence class needs a bucket here")

    e = html.escape
    para = lambda t: "".join(f"<p>{e(p.strip())}</p>"
                             for p in (t or "").split("\n\n") if p.strip())

    bar = "".join(
        f'<div class="seg" style="--w:{n / total * 100:.4f}%;--c:{lt};--cd:{dk}"'
        f' title="{e(nm)}: {n}"><span>{n}</span></div>'
        for nm, n, lt, dk in buckets)
    legend = "".join(f'<li><i style="--c:{lt};--cd:{dk}"></i>{e(nm)} <b>{n}</b></li>'
                     for nm, n, lt, dk in buckets)

    ask_rows = "".join(f"""
<article class="ask">
  <header><span class="qn">Q{a['qid']}</span><h3>{e(Q[a['qid']]['body'])}</h3></header>
  <p class="meta">topic {Q[a['qid']]['topic']} · {e(T.get(Q[a['qid']]['topic'], ''))}
     · raised by {e(O.get(Q[a['qid']]['owner_code'], ''))}</p>
  <blockquote>{e(a['sei_ask'])}</blockquote>
</article>""" for a in asks)

    topic_rows = ""
    for no in sorted(T):
        qs = [q for q in Q.values() if q["topic"] == no]
        done = sum(1 for q in qs if q["qid"] in A)
        pct = done / len(qs) * 100 if qs else 0
        topic_rows += (f'<tr><td class="tn">{no}</td><td>{e(T[no])}</td>'
                       f'<td class="num">{done}/{len(qs)}</td>'
                       f'<td class="track"><span style="--p:{pct:.1f}%"></span></td></tr>')

    recs = "".join(f"""
<article class="rec">
  <header><span class="qn">Q{n}</span><h3>{e(Q[n]['body'])}</h3></header>
  <p class="meta">raised by {e(O.get(Q[n]['owner_code'], ''))}
     · <span class="badge">BBH recommendation</span></p>
  {para(A[n]['body'])}
  <div class="note">{e(A[n]['gap'])}</div>
  {'<blockquote class="small"><b>Ask SEI ·</b> ' + e(A[n]['sei_ask']) + '</blockquote>'
   if A[n].get('sei_ask') else ''}
</article>""" for n in SHOW)

    others = ", ".join(f"Q{a['qid']}" for a in sorted(
        (x for x in A.values() if x["conf"] == "practice" and x["qid"] not in SHOW),
        key=lambda x: x["qid"]))

    css = open(os.path.join(ROOT, "tools", "review_pack.css"), encoding="utf-8").read()
    return TEMPLATE.format(css=css, total=total, answered=answered, openq=openq,
                           nasks=len(asks), bar=bar, legend=legend,
                           ask_rows=ask_rows, topic_rows=topic_rows, recs=recs,
                           others=others,
                           today=f"{datetime.date.today():%d %B %Y}")


TEMPLATE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Architecture Review Pack</title>
<style>{css}</style></head><body><div class="wrap">

<h1>CP Integration Hub — architecture review pack</h1>
<p class="sub">Draft for the review meeting · generated from the discussion
record on {today} · not yet agreed</p>

<section>
  <h2>Where we are</h2>
  <p class="lede">108 questions were raised at the architecture review. This is
  what we have been able to answer so far, and what each answer rests on.</p>
  <div class="stats">
    <div class="stat"><b>{total}</b><span>questions raised</span></div>
    <div class="stat"><b>{answered}</b><span>have a draft answer</span></div>
    <div class="stat"><b>{openq}</b><span>still open</span></div>
    <div class="stat hi"><b>{nasks}</b><span>need an answer from SEI</span></div>
  </div>
</section>

<section>
  <h2>What the answers rest on</h2>
  <p class="lede">The distinction matters. An answer taken from a design
  document is evidence. Our own recommendation is a proposal, and it is marked
  as one wherever it appears.</p>
  <div class="bar">{bar}</div>
  <ul class="legend">{legend}</ul>
</section>

<section>
  <h2>For the SEI meeting — {nasks} questions we cannot close ourselves</h2>
  <p class="lede">These are the ones that depend on what SEI delivers or agrees.
  Everything else on the list we can settle internally.</p>
  {ask_rows}
</section>

<section>
  <h2>Progress by topic</h2>
  <p class="lede">Where the remaining work sits.</p>
  <table>{topic_rows}</table>
</section>

<section>
  <h2>Sample recommendations</h2>
  <p class="lede">Three of the twenty, in full, to show the shape. Each one says
  what could go wrong, what we suggest, and what still needs deciding.</p>
  {recs}
  <p class="foot" style="margin-top:18px">The other seventeen: {others}.</p>
</section>

<section>
  <h2>How to read this</h2>
  <p class="foot">Nothing here is agreed. Every answer is a draft until the
  question owner accepts it, and accepting records who did and when. Where an
  answer is our recommendation rather than something we found in a document, it
  says so — and it is not a statement that SEI left anything out. Those
  questions have not been put to the SEI pack. If SEI has covered a point, their
  wording stands and ours falls away.</p>
</section>

</div></body></html>"""


if __name__ == "__main__":
    with open(os.path.join(ROOT, "data", "hub_corpus.json"), encoding="utf-8") as fh:
        corpus = json.load(fh)
    dest = os.path.join(ROOT, "docs", "review-pack.html")
    with open(dest, "w", encoding="utf-8") as fh:
        fh.write(build(corpus))
    print(f"{dest}: {len(corpus['questions'])} questions, "
          f"{len(corpus['answers'])} answered, "
          f"{sum(1 for a in corpus['answers'] if a.get('sei_ask'))} SEI asks")
