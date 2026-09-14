"""Environment 360 probe runner — the pulse (every 3 min).
Self-contained: TCP reachability floor; depth ladder per check_type later.
WAITING probes (port TBD in workbook) are not selected — visible as ◌."""
import os, socket, time
from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator

def _tcp(host, port, timeout=3.0):
    t0 = time.time()
    try:
        with socket.create_connection((host, int(port)), timeout=timeout):
            ms = int((time.time() - t0) * 1000)
            return ("WARN" if ms > 1500 else "OK"), ms, "connect ok"
    except socket.timeout:
        return "DOWN", int(timeout * 1000), "timeout"
    except OSError as e:
        return "DOWN", int((time.time() - t0) * 1000), str(e)[:120]

def run_probes(**_):
    import oracledb
    dsn = os.environ["CP_CATALOG_DB_DSN"]
    user, rest = dsn.split("/", 1)
    pwd, host = rest.rsplit("@", 1)
    with oracledb.connect(user=user, password=pwd, dsn=host) as c:
        cur = c.cursor()
        cur.execute("SELECT probe_id, check_type, target_host, target_port "
                    "FROM env_probe WHERE state = 'ARMED'")
        results = []
        for pid, ctype, thost, tport in cur.fetchall():
            if not thost or not tport:
                results.append((pid, "SKIP", None, "no target"))
                continue
            status, ms, detail = _tcp(thost, tport)
            results.append((pid, status, ms, f"{ctype}: {detail}"))
        cur.executemany("INSERT INTO env_probe_result "
                        "(probe_id, status, latency_ms, detail) VALUES (:1,:2,:3,:4)",
                        results)
        c.commit()
        print(f"pulse: {len(results)} probes executed")

with DAG(dag_id="env360_probe_runner", start_date=datetime(2026, 1, 1),
         schedule="*/3 * * * *", catchup=False, max_active_runs=1,
         default_args={"retries": 1, "retry_delay": timedelta(minutes=1)},
         tags=["env360", "monitoring"]) as dag:
    PythonOperator(task_id="pulse", python_callable=run_probes)
