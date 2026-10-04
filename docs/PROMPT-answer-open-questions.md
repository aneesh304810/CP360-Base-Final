# The prompt to run

Paste the block below, attach whatever documents you have, and replace the
two bracketed parts. It is built so that **"no data" is the default outcome
and answering is the exception** — the opposite of how a model behaves if you
just ask it nicely to be careful.

Five devices do that work. They matter more than the wording:

1. **An evidence class per answer, from a closed list.** Not a percentage.
   "80% confident" is a feeling; `document` versus `inference` is a claim
   about where the words came from, and it is falsifiable.
2. **The class dictates what else is required.** `document` without a
   verbatim quote is rejected by the schema, so the cheapest way to answer is
   to find the sentence — not to write a plausible paragraph.
3. **`NO DATA` is a valid, expected, un-penalised answer.** Stated explicitly,
   because a model left to infer the grading criterion will assume that
   answering is what is wanted.
4. **A stated expected hit rate.** If the reply answers nearly everything, the
   reply is wrong — and saying so in advance removes the incentive to stretch.
5. **A separate demotion pass.** Re-read each answer against its own quote and
   downgrade anything the quote does not actually support. Models are far
   better at catching this in review than at avoiding it while drafting.

Nothing here makes a model honest. What it does is make dishonesty visible in
one glance: an answer whose quote does not contain its claim is obvious, and
that is what you spot-check.

---

```
You are answering open architecture-review questions for BBH's CP
Integration Hub / Lineage 360 programme. Attached: [LIST WHAT YOU ATTACHED
— e.g. "SEI SWP design document v1.4 (PDF)"].

Answer these questions, and only these:
[PASTE THE QUESTION NUMBERS AND TEXT — one per line. Do no more than about
15 in one go; past that the answers get shorter and the citations get worse.]

=== HOW TO DECIDE WHETHER YOU CAN ANSWER ===

For each question, pick exactly ONE evidence class:

  document   You found it in an attached document. You MUST quote the
             sentence(s) verbatim and give the section or page. If you
             cannot produce the quote, this is not the class.

  absence    You searched the attached material for it and it is NOT
             there. Say what you searched for. This is a real answer and
             a useful one — "the document never specifies a file-readiness
             signal" is a finding, not a failure.

  inference  You are reasoning from something in the document rather than
             reading it. State the premises in the body and begin the
             body with "Inferred:". Never write an inference as though it
             were the document's position.

  no_data    Nothing in the attached material bears on this. Set body to
             exactly "NO DATA" and stop. Do not reason towards a likely
             answer. Do not fall back on what is usual in the industry.

DEFAULT TO no_data. Answering is the exception, not the goal.

=== WHAT I EXPECT BACK ===

These questions were written BECAUSE the document did not answer them.
A good reply answers maybe a third to a half of them and marks the rest
no_data or absence. If you come back having answered nearly all of them,
you have stretched, and I will find it when I check the quotes — so the
only thing a padded answer costs us both is time.

Do not soften a no_data into a partial answer to be helpful. A wrong
answer here reaches an architecture review as the vendor's position.

=== WHAT NOT TO INCLUDE ===

Structure and metadata only. Never reproduce account numbers, client
names, transaction identifiers, positions, balances, credentials,
connection strings or hostnames. Code-set VALUES are metadata and are in
scope; the entities they describe are not.

=== BEFORE YOU REPLY: A SECOND PASS ===

Go back over every answer you have drafted and check it against its own
quote:

  - Does the quote actually contain the claim, or merely sit near it?
    If merely near it, change the class to inference or no_data.
  - Did you use any word the document does not use — "guaranteed",
    "always", "exactly once", "real time"? Either quote where it says
    that, or remove the word.
  - Does any answer describe how systems like this usually work rather
    than how THIS one does? That is no_data.

Report how many you demoted in this pass. Demoting zero out of fifteen
is itself a signal that you did not do the pass.

=== FORMAT ===

Return one JSON array, nothing else:

[
  { "n": 50,
    "conf": "document",
    "body": "the answer in plain prose, or exactly NO DATA",
    "gap": "what this still does not settle",
    "quote": "the verbatim sentence(s), for conf=document only",
    "ev": ["SEI design doc §4.2", "SEI design doc p.17"] }
]

Then, outside the JSON, one line: how many answered, how many absence,
how many no_data, and how many you demoted in the second pass.
```

---

## What to do with what comes back

**Load only the `document`, `absence` and `inference` entries.** A `no_data`
entry is not a draft and must not become one — it is the signal to leave that
question open, or to mark it `blocked` with the person who has to decide. A
screen showing "NO DATA" as an answer is worse than one showing no answer,
because it looks like the question was dealt with. The suite rejects a seed
whose class is `no_data`.

The rest drops into `ui/src/hubAnswers.js` beside the 35 drafts already
there. The screen already knows what to do with each field:

| Field | What the screen does with it |
|---|---|
| `conf` | A badge next to the answer — *from a document*, *nothing recorded*, *reasoned, not read* |
| `quote` | Rendered as a pull-quote under the body, so the claim and its source sit together |
| `gap` | The amber "What this does not settle" box |
| `ev` | Evidence chips |
| `body` | The answer |

The suite enforces the rule that makes the class worth having: **`conf:
"document"` with no `quote` fails the build.** An uncited document claim
cannot reach the screen looking like a verified one.

Answers arrive as **drafts** — labelled *draft · not agreed*, leaving the
question on `answered`, never `resolved`. Somebody still has to accept one,
and accepting is what turns it into the linked component's documentation.

## Checking it, in about two minutes

Not every answer — the ones that would change a decision:

1. **Search the PDF for the quote.** Not for the topic; for the sentence. If
   it is not there verbatim, the class is wrong and so, probably, is the
   answer.
2. **Read the quote without the answer.** Does it say what the answer says it
   says? This is where "the document implies" hides.
3. **Look at the no_data count.** Zero is the warning sign, not a good score.

## Where this will not help

Bucket C in `PROMPT-review-question-sourcing.md` — 23 questions that are
decisions nobody has made or numbers nobody has measured. No document
contains them, so no prompt extracts them; a model asked will produce
industry-typical answers that read as fact. Mark them `blocked` in the
Discussion tab with the named decider instead. The tab supports that, and it
is a more honest state than leaving them open.
