# Sourcing the remaining 73 review questions

35 of the 108 questions now carry a draft answer in the Hub Discussion tab,
drafted from this codebase. This document is about the other 73: **where each
one's answer actually lives**, and — for the ones an SEI document can settle —
paste-ready extraction prompts.

The single most useful finding first:

> **The SEI PDF cannot answer most of them.** By my reading, 25 of the 73 are
> SEI's to answer, 25 belong to BBH's own ingestion-framework design, and 23
> are not in any document — they are decisions nobody has made or numbers
> nobody has measured. Sending all 73 at one PDF will produce 73 confident
> paragraphs, of which roughly a third will be invention.

So the buckets below are the point of this document, not the prompts.

---

## Bucket A — the SEI document should answer these (5)

> **Topics 1 and 2 are done**, and six more questions were answered from a
> second document. Questions 1–10 went to the SEI pack; 18, 19, 32, 33, 34
> and 44 were then answered from the **BBH dbt Transformation Framework
> TDD**, which turned out to be the missing BBH-side design document this
> page used to say was nowhere to be found. Prompts A1, A2 and A4 have been
> removed because they have been run.
>
> The strongest result remains question 4 — Stage 2 is explicitly *not* an
> enterprise-wide canonical model — which is the sentence that makes
> questions 3 and 10 matter.

> **Second update, October 2026.** The full dbt TDD, appendices included,
> answered four more of these: 28 (the layer mapping end to end), 52
> (`FILE_SCHEMA_CONFIG` is the expected set, `FILE_REGISTRY` the completed
> one), and 91 and 92 (`DATE_CONTROL.SLA_CUTOFF_TS` is a tz-aware column per
> business date, and every SLA target in the document is still `TBC`). They
> have left this bucket.
>
> It also named **a document nobody has asked for yet.** The TDD's scope
> boundary puts file generation, external transfer, physical file discovery,
> header/trailer validation and the RAW load itself outside itself, and
> assigns them to a separate **Ingestion Framework TDD**. That is the document
> that owns most of what is left in this bucket. Getting hold of it is
> probably worth more than any prompt on this page.

| Topic | Questions |
|---|---|
| 6 · SDC vs SFTP | 26 |
| 10 · Delivery contract | 53, 54, 55, 56 |

### How to run these

Paste one prompt at a time into enterprise Claude **with the SEI PDF
attached**. One prompt per topic, not both at once — a single long prompt
produces summary, and what is wanted here is citation.

Every prompt below ends with the same two rules. Keep them:

> **Structure and metadata only.** Never reproduce account numbers, client
> names, transaction identifiers, positions, balances, credentials, connection
> strings or hostnames. Code-set *values* are metadata and are in scope; the
> entities they describe are not.
>
> **Cite or decline.** For each question, quote the sentence(s) in the document
> that answer it and give the section or page. If the document does not answer
> it, say `NOT IN DOCUMENT` and stop — do not reason towards a likely answer.
> A question the document does not cover is a finding, not a gap to fill.

That second rule is the one that matters. Without it you get fluent answers to
questions the document never addressed, and those are worse than no answers,
because they will be read as SEI's position.

---

### A3 · Transfer mechanism and delivery contract (questions 26, 53–56)

Still the highest-value prompt in the set, and now a shorter one. The answers
are contractual rather than architectural — they are what BBH is entitled to
rely on, and no BBH design document can supply them.

Items 2 and 8 below are kept but marked: the dbt TDD has answered the BBH side
of both, so what is wanted from SEI is only the half the TDD cannot give — the
commitment, not the mechanism.

```
Attached is SEI's design document. Answer only from it.

1. Which transfer mechanism does the document specify for SEI → BBH: SDC,
   SFTP, both, or a migration between them? If both, which is target state and
   is a cutover described?
2. (BBH side answered — question 52.) Does SEI commit to a list of which
   interfaces are delivered on each business date, and does SEI notify BBH
   when that list changes? BBH loads its own copy into FILE_SCHEMA_CONFIG;
   what is wanted here is the source of truth SEI stands behind.
3. How are holidays, month-end, weekly files and one-off exceptions handled?
4. Is the expected-file set effective-dated or snapshotted, or can it change
   for a business date that is already open?
5. Does the document guarantee exactly ONE physical delivery per logical
   interface per business date? Quote the guarantee.
6. If multipart or repeated deliveries are possible, what identifier
   distinguishes them? Is there a batch key, sequence number or manifest?
7. What file-readiness signal indicates a file has finished arriving — a
   trailer record, a sentinel file, a manifest, a marker event, or none?
8. (BBH side answered — questions 91 and 92.) What delivery cutoff times
   does SEI COMMIT to, in which named time zone, and is the commitment one
   cutoff for everything or one per interface? How is multi-currency /
   multi-region timing handled? BBH has a per-date, time-zone-aware cutoff
   column and no agreed value to put in it.

<the two rules above>
```

### Return format

Ask for this at the end of each prompt. It drops straight into
`ui/src/hubAnswers.js` with no re-typing:

```json
[
  { "n": 1,
    "body": "<the answer, in plain prose>",
    "gap": "<what the document does NOT settle, or empty if it fully settles it>",
    "ev": ["SEI design doc §4.2", "SEI design doc p.17"],
    "verbatim": "<the quoted sentence(s) the answer rests on>" }
]
```

`verbatim` is the field to insist on. An answer whose quote does not actually
support it is visible in one glance; an answer without a quote is not
checkable at all.

---

## Bucket B — BBH's own design documents, not SEI's (20)

These reference `DATE_CONTROL`, `FILE_REGISTRY`, the Airflow DAG structure, the
worker/pod lifecycle and the Dim/Fact build. **None of that is SEI's to
describe.** Asking the SEI PDF will produce plausible fiction.

> **Correction, October 2026.** This page previously said the document that
> would answer these "is not in this repository — the single biggest blind
> spot". It exists: the **BBH dbt Transformation Framework TDD**. It has
> already answered 47, 48, 59, 60 and 63, and it settles several more below.
> Point extractions at *that* document, not at the SEI pack.
>
> **All twenty now carry an industry-practice draft.** Those are
> *suggestions* — what a comparable platform normally does — and they are
> badged `industry practice · not BBH's` on screen, carry no quote, and each
> names the decision BBH still owns. **They do not answer these questions**,
> which is why the questions stay in this bucket: the BBH design document
> still has to say what BBH actually did. The suggestions are there so the
> conversation starts from a proposal rather than a blank thread.
>
> The suite enforces the distinction: a bucket B question may carry an
> industry-practice draft and nothing stronger.

| Area | Questions | Ask |
|---|---|---|
| Business-date control, triggers, recovery | 58, 61, 65, 66, 67, 68, 69, 70, 71 | **dbt TDD §5** + the DAG code |
| Restatement and replay | 72, 73, 75, 76 | **dbt TDD §6.4.1, §7.1** |
| DIM/FACT build, history, effective dating | 45, 46 | **dbt TDD §6.4** + data modelling |
| OpenShift scheduling and DB limits | 79, 82, 85 | Platform / Sudhakar |
| Logging standard, alert routing | 88, 89 | BBH observability standards |

The fastest route for the first two rows is now the TDD's appendices: it says
the trigger and `DATE_CONTROL` SQL are in Appendix A, and the model SQL in
Appendix B. Those pages have not been read yet and would likely close most of
the remaining business-date questions.

---

## Bucket C — no document answers these (20)

> Questions 11, 12, 14 and 15 now carry an **absence** draft: the SEI pack
> was searched and is silent. That records the search so nobody repeats it;
> it does **not** answer who owns the work, which is still a decision. They
> stay in this bucket for that reason. Question 13 came back `no_data` and
> has no draft at all.

> **Three have left, October 2026.** The dbt TDD turned out to answer 38 (the
> blocking controls are the STG DQ filter, the per-layer test task and
> dimension resolution — reconciliation runs *after* the fact build and only
> alerts), 93 (four measures with four named responses, every target `TBC`)
> and 97 (a date stuck in PENDING triggers nothing; the alert that exists
> watches TRIGGER, which a late file never reaches). Question 96 keeps an
> **absence** draft and stays: the design names DAGs as owners, not people,
> and who owns the cutoff is still a decision.

They are decisions nobody has recorded, or numbers nobody has measured. A
document search will not find them and should not be attempted.

| Kind | Questions | Who decides |
|---|---|---|
| Ownership of ODI → dbt conversion | 11, 12, 13, 14, 15 | Contract / SOW — Professional Services scope |
| PB DWH internal logic ownership | 16, 17 | BBH data engineering |
| BBH vs SEI RACI | 20, 22, 23, 24, 25 | Programme — a RACI, not an architecture |
| Dual-run period and surviving outputs | 29, 30, 31 | Programme |
| Operational SLAs and ownership | 95, 96 | BBH production support |
| Retention and compliance | 98 | BBH compliance |
| Upgrade path and training | 104, 105 | BBH platform / Kartheek |

Several of these are the questions the review exists to force. Marking them
`blocked` in the Discussion tab, with the named decider, is more honest than
leaving them open — and the tab supports exactly that.

---

## What I would get first

If only one thing is extracted: **A3, the delivery contract.** Seven questions,
all contractual, and three drafts already written (50, 51, 57) depend on
whether SEI guarantees one delivery per interface per business date. If that
guarantee exists, the file-path design simplifies sharply. If it does not,
`(FILE_NAME, BUSINESS_DATE)` is the wrong key and that is a schema change, so
it is worth knowing before the ingestion framework is built rather than after.

---

## The eight questions that need SEI, not BBH

Twenty of these questions now carry a **BBH recommendation** — what a
comparable platform does, badged `BBH recommendation · gap vs SEI analysis`
on screen. They are BBH's position, not SEI's design.

Eight of the twenty cannot be closed by BBH alone: they turn on what SEI
delivers or agrees. Those carry an **Ask SEI** line, and this is the list —
it is generated from the corpus rather than maintained by hand, so it cannot
drift from what the screen shows.

| # | Question | Ask SEI |
|---|---|---|
| **45** | How will the transformed DIM/FACT data be checked against source/AddVant… | Which population and which freeze point will SEI agree for a parity run, and will SEI produce the ODI-era baseline or will BBH? |
| **58** | How are weekends and non-business days handled? Will BBH process Saturda… | Does SWP deliver on Saturdays, Sundays and market holidays — per interface, not globally — and against which calendar? |
| **66** | How can operations prove for certain whether RAW should be reloaded? | Will each delivery carry a checksum or manifest (row count and content hash)? Without one, a resend cannot be distinguished from the original. |
| **67** | Once DATE_CONTROL = COMPLETE, can ingestion still accept a file for that… | Does the delivery contract permit a file for a business date BBH has already closed, and with what notice? |
| **68** | If so, how do we stop RAW from going out of sync with Gold data that is … | When SEI restates a delivery, how is BBH told — and how far back may a restatement reach? |
| **73** | Should we keep the original lifecycle for audit and add a version/restat… | Does SEI resend a corrected file under the SAME filename and business date? If so, (FILE_NAME, BUSINESS_DATE) is not a key and a delivery sequence has to come from SEI, not be invented by BBH. |
| **76** | How are business corrections and data restatements handled? | What is SEI's role in a restatement — who declares it, who re-delivers, and within what window? |
| **89** | How are Splunk alerts correlated, escalated, and routed? | Which alerts should escalate to SEI rather than to BBH support, and through what channel? |

**Say it carefully.** None of these questions has been searched for in the
SEI pack — they were bucketed as BBH-side from the start. So the standing
note on every recommendation reads *"raised by BBH … not a statement that
SEI omitted it … if SEI has covered it, their text supersedes this"*.
Claiming a gap nobody looked for is how a review loses an argument it was
winning.

Regenerate this list after changing the corpus:

```bash
node ui/scripts/export_hub_corpus.mjs
python3 - <<'EOF'
import json
c = json.load(open("data/hub_corpus.json"))
for a in sorted((a for a in c["answers"] if a.get("sei_ask")), key=lambda x: x["qid"]):
    print(f'{a["qid"]:>4}  {a["sei_ask"]}')
EOF
```
