"""A DAG as the fan-out design wants it. Synthetic."""
from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime


def run_ingest(feed_id, **ctx):
    from hub.ingest import run
    run(feed_id=feed_id, business_date=ctx["ds"])


with DAG(
    dag_id="eod_fanout",
    start_date=datetime(2026, 1, 1),
    schedule="0 2 * * *",
    catchup=False,
    tags=["eod", "positions"],
    default_args={"owner": "cp-platform", "retries": 0},
) as dag:
    positions__ingest = PythonOperator(task_id="positions__eod_positions__ingest", python_callable=run_ingest, op_kwargs={"feed_id": "eod_positions"})
