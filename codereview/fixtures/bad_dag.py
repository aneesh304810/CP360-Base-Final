"""A DAG with the anti-patterns the review must catch. Synthetic."""
import requests
from airflow import DAG
from airflow.models import Variable
from airflow.operators.python import PythonOperator
from datetime import datetime

CFG = requests.get("http://config.internal/feeds").json()
DB_PASSWORD = Variable.get("oracle_password")


def load_positions(**ctx):
    import pandas as pd
    df = pd.read_sql("SELECT * FROM stg.positions", ctx["conn"])
    df.to_sql("fct_positions", ctx["conn"])


with DAG(
    dag_id="positions_eod",
    start_date=datetime(2026, 1, 1),
    schedule_interval="0 2 * * *",
    default_args={"owner": "airflow", "retries": 3},
) as dag:
    g1 = PythonOperator(task_id="G1-Structural Gate", python_callable=lambda: None, retries=2)
    load = PythonOperator(task_id="load_positions", python_callable=load_positions)
    g1 >> load
