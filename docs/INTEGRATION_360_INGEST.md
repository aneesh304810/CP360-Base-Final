# Integration 360: feeding it from Airflow and dbt

Integration 360 reads records, not logs. Airflow, dbt and the check engines
already produce them; this is how they reach CP 360.

## What arrives, and from where

| On the page | Source | Arrives by |
|---|---|---|
| Pipeline status, last run | Airflow `dag_run` state and dates | the DAG callbacks |
| The task that failed, retries, duration, log link | Airflow `task_instance` | the task callbacks |
| The error line, the loader's error code | the exception on the failed task | the task callback (first 2,000 characters, never the log) |
| The record | the hub's `FILE_REGISTRY` and submission registry | read directly, already in Oracle |
| The rule, expected, observed, failures | dbt `run_results.json` (tests and models), `sources.json` (freshness), Great Expectations or Soda results | `i360_post_run.py` after each dbt run; one record per check |
| The column | `manifest.json` (`column_name` and the model the test is attached to) | with the run results |
| Bad records with file row numbers | the staging model's `FAIL` rows joined back to RAW on `FILE_REGISTRY_ID` and `FILE_ROW_NUMBER`; dbt `store_failures` tables; the check's `bad_rows` | a query at view time (`/integration360/badrows`), or carried on the check |
| Root cause, what to do | people | typed on the page, kept in `i360_note` |

## Push or pull

Two ways to feed it; both end in the same tables and the page cannot tell them apart.

| | Push: callbacks | Pull: the poller |
|---|---|---|
| What changes on the pipeline side | each DAG takes `default_args=i360_default_args()` and `**i360_dag_callbacks()`; the dbt task runs `i360_post_run.py` after `dbt build` | nothing in the DAGs; the dbt task writes its `target/` to a shared volume |
| What CP 360 runs | nothing extra | `integration/poll/i360_poller.py` as a CronJob every few minutes (`deploy/openshift/i360-poller-cronjob.yaml`) |
| Credentials | one shared secret, held by Airflow | one Airflow API user for the poller, plus the shared secret |
| Network | Airflow namespace to CP 360 API | CP 360 namespace to the Airflow webserver service, and to the API |
| Latency | seconds | the schedule, a few minutes |
| The error line | the exception, from the callback | the tail of the failed task's log over the REST API, reduced to one line |
| When to choose | new DAGs, or a team that owns its DAGs | existing DAGs you would rather not touch; one place to operate |

The poller pulls DAG runs updated since its watermark, their task instances, and for failed tasks the log tail (only the loader's error code or the last error line is kept). For dbt it posts every `run_results.json` newer than the watermark with its `manifest.json` and `sources.json`; the dag id is the folder that holds `target/`, or `I360_DBT_DAG` when there is one project.

## Steps

1. **Tables.** Apply `sql/90_integration360.sql` by hand to the CP 360 schema (idempotent).
2. **Secret.** Set `I360_WEBHOOK_SECRET` (or `I360_INGEST_TOKEN`) on the CP 360 API deployment and on Airflow (an Airflow Variable or the dbt task's environment). Without either the endpoints accept and `/integration360/health` says `signature: false`; fine for a first wiring in a test namespace, not for production.
3. **Network.** Airflow and CP 360 share the OpenShift cluster, in different namespaces. The callbacks post to the API's Service by its in-cluster name, `http://<cp360-api-service>.<cp360-namespace>.svc:8000`. If the CP 360 namespace denies ingress by default, apply `deploy/openshift/i360-allow-airflow.yaml` with the placeholders filled. No Route is needed and nothing is exposed outside the cluster.
4. **Airflow.** Copy `integration/airflow/i360_callbacks.py` beside the DAGs (or into a plugins folder) and give each DAG `default_args=i360_default_args()` and `**i360_dag_callbacks()`. Put the business date in `dag_run.conf["business_date"]` so every event carries it.
5. **dbt.** After `dbt build` (and after `dbt source freshness`), run `integration/dbt/i360_post_run.py --target <target dir> --dag <dag id> --business-date <YYYYMMDD>`. Turn `store_failures` on for the tests whose failing rows you want to see.
6. **Checks.** Great Expectations, Soda or the loader post one record per check to `/integration360/ingest/check`: `{engine, dag_id, run_id, business_date, dataset, column, rule, status, expected, observed, threshold, failures, total, message, bad_rows}`; `bad_rows` is capped at 50.

## What the page does with it

The pipeline list takes its status from the latest run per DAG: red when the run failed, a task failed or a check failed; amber on a warning or a run still going; green otherwise. An open pipeline shows the failed tasks with their error line, the failing checks with expected against observed and the column, the bad rows the check carried or the staging rows for the date, and the notes. Until a DAG has reported, the page shows the illustrative case and says so.

## Endpoints

| Method and path | Purpose |
|---|---|
| `POST /integration360/ingest/airflow` | one task or run event, or `{events: [...]}` |
| `POST /integration360/ingest/dbt` | `{run_results, manifest?, sources?, dag_id?, business_date?}` |
| `POST /integration360/ingest/check` | one check, or `{checks: [...]}` |
| `GET /integration360/pipelines?days=14` | per DAG: latest run, failed tasks, failing checks, status |
| `GET /integration360/runs/{dag_id}` | recent runs with tasks |
| `GET /integration360/findings/{dag_id}?business_date=&status=` | checks and notes |
| `GET /integration360/badrows?stg=&raw=&business_date=&cols=` | a staging model's FAIL rows joined to RAW |
| `POST /integration360/note` | root cause and action |
| `GET /integration360/health` | what is configured |
