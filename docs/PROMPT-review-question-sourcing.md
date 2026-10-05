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

## Bucket A — the SEI document should answer these (9)

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

| Topic | Questions |
|---|---|
| 6 · SDC vs SFTP | 26 |
| 7 · How SEI data feeds the framework | 28 |
| 10 · Delivery contract | 52, 53, 54, 55, 56 |
| 15 · Delivery SLA and time zones | 91, 92 |

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

### A3 · Transfer mechanism and delivery contract (questions 26, 52–56, 91, 92)

This is the highest-value prompt in the set. Seven questions, and the answers
are contractual rather than architectural — they are what BBH is entitled to
rely on.

```
Attached is SEI's design document. Answer only from it.

1. Which transfer mechanism does the document specify for SEI → BBH: SDC,
   SFTP, both, or a migration between them? If both, which is target state and
   is a cutover described?
2. Is there an authoritative list of which interfaces are delivered on each
   business date? Where does it live and who maintains it?
3. How are holidays, month-end, weekly files and one-off exceptions handled?
4. Is the expected-file set effective-dated or snapshotted, or can it change
   for a business date that is already open?
5. Does the document guarantee exactly ONE physical delivery per logical
   interface per business date? Quote the guarantee.
6. If multipart or repeated deliveries are possible, what identifier
   distinguishes them? Is there a batch key, sequence number or manifest?
7. What file-readiness signal indicates a file has finished arriving — a
   trailer record, a sentinel file, a manifest, a marker event, or none?
8. What delivery cutoff times are committed, in which time zone, and how is
   multi-currency / multi-region timing handled?

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

## Bucket C — no document answers these (23)

> Questions 11, 12, 14 and 15 now carry an **absence** draft: the SEI pack
> was searched and is silent. That records the search so nobody repeats it;
> it does **not** answer who owns the work, which is still a decision. They
> stay in this bucket for that reason. Question 13 came back `no_data` and
> has no draft at all.

They are decisions nobody has recorded, or numbers nobody has measured. A
document search will not find them and should not be attempted.

| Kind | Questions | Who decides |
|---|---|---|
| Ownership of ODI → dbt conversion | 11, 12, 13, 14, 15 | Contract / SOW — Professional Services scope |
| PB DWH internal logic ownership | 16, 17 | BBH data engineering |
| BBH vs SEI RACI | 20, 22, 23, 24, 25 | Programme — a RACI, not an architecture |
| Dual-run period and surviving outputs | 29, 30, 31 | Programme |
| Mandatory DQ gates before publication | 38 | BBH Data Management |
| Operational SLAs and ownership | 93, 95, 96, 97 | BBH production support |
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
