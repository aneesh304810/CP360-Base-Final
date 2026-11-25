# CP 360 Code Review

A senior data engineer's review of every push and pull request on the Airflow, dbt and Integration Hub repositories, against the CP 360 designs. Two halves:

- **Rules.** Deterministic checks run on the server: Airflow (retries on gates, catchup, parse-time work, task ids, secrets in Variables), dbt (AD-2 merges and deletes, incremental hygiene, ref/source, SELECT *, schema.yml contracts, layer names), Hub Python (error taxonomy, acknowledge-then-process, idempotency, timeouts, logging values, runtime DDL, per-feed branches), SQL and Liquibase (rollback, idempotent DDL, binds), secrets, hosts and client data. Every finding cites a `CP360-CR` rule and the design it comes from. `python -m codereview standards` prints the catalogue.
- **Judgement.** The review pack, written per change, is given to Microsoft 365 Copilot or Copilot Chat in ask mode. Copilot answers in a fixed format; the answer is pasted back and merged with the rule findings into the final report, which is posted to the pull request as review comments and stored in CP 360. With `CR_LLM=anthropic` and an API key, Claude writes this half automatically in the same run; the Copilot path works without any key.

## Setup

1. Apply `sql/89_codereview.sql` (idempotent) so reviews are stored in CP 360. Without it, reviews are kept as files under `CR_HOME` (default `./.codereview`, ignored by Git) and the page still works.
2. Environment on the API host:

   | Variable | Purpose |
   |---|---|
   | `GITHUB_TOKEN` or `CR_GITHUB_TOKEN` | a token that can read the repositories and write pull-request reviews |
   | `GITHUB_API_URL` | GitHub Enterprise API root, if not github.com |
   | `CR_WEBHOOK_SECRET` | the secret set on the webhook; requests without a valid signature are refused |
   | `CR_POST` | `0` to store reviews without posting to GitHub (default posts) |
   | `CR_PUBLIC_API_URL` | the API's public URL, so the pull-request comment can link to the pack |
   | `CR_LLM`, `ANTHROPIC_API_KEY` | optional: `anthropic` to have Claude write the judgement half |
   | `CR_HOME` | where packs and file-stored reviews live |

   Secrets go in the secret store or `local\secrets.ps1`, never in the repository.
3. In each repository to review: Settings, Webhooks, add `https://<api>/codereview/webhook`, content type `application/json`, the secret above, events **Pull requests** and **Pushes**. The ping shows green when the signature verifies.
4. Restart the API. `GET /codereview/health` shows what is configured.

## Running it

- **Automatically.** Every opened, updated or reopened pull request (drafts skipped) and every push gets a review within a minute: rule findings as inline comments, the verdict, and the link to the pack for the judgement half. A push to a branch with an open pull request reviews the pull request; otherwise it comments on the commit.
- **On demand.** `POST /codereview/run {"repo": "owner/name", "number": 123, "post": true}`, or from a checkout:

  ```
  git diff origin/main...HEAD > change.diff
  python -m codereview review --diff change.diff --root . --repo owner/name --ref my-branch
  python -m codereview review --pr owner/name#123 --post
  python -m codereview review --files dags/eod.py models/fct_positions.sql
  ```

## The Copilot half

1. Open the review on **Governance, Code Review 360** (or follow the link in the pull-request comment) and download `copilot-prompt.md`.
2. In Microsoft 365 Copilot or Copilot Chat (ask mode), attach the file and send: *Review this pull request as the instructions say and answer in the output contract.*
3. Copy the whole answer, the Findings table and the `VERDICT:` line, and paste it into the review's **Paste Copilot's answer** box, or run `python -m codereview ingest --review <id> --report copilot-report.md --post`.
4. The final report replaces the first comment's verdict: rule findings plus Copilot's, posted as review comments, stored with who said what.

If Copilot drifts from the format, send: *Rewrite your answer exactly in the output contract: the Findings table and the VERDICT line, nothing else.* The parser is tolerant of extra prose but needs the table and the verdict line.

## Verdicts

A rule finding of blocker or high severity is `REQUEST_CHANGES` regardless of the judgement half. Otherwise Copilot's verdict stands, or by the worst severity: medium is `COMMENT`, low and info `APPROVE`.

## Adding a rule

Add the entry to `codereview/standards.py` with its design reference, the check to the matching module under `codereview/rules/`, and a line to `codereview/fixtures/` that trips it. `api/test/test_codereview.py` runs the fixtures.
