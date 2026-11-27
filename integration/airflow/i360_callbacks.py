"""Integration 360 callbacks for Airflow: post each task and run outcome to the
CP 360 API as a small JSON record. No log text is sent, only the one error line.

Wire once per DAG (or in default_args for every DAG):

    from i360_callbacks import i360_default_args, i360_dag_callbacks
    with DAG("swp_positions_processing", default_args=i360_default_args(), **i360_dag_callbacks(), ...) as dag:

Configuration, from Airflow Variables or the environment:
    I360_API_URL         the CP 360 API, by its in-cluster service name when Airflow and CP 360
                         share the OpenShift cluster: http://<cp360-api-service>.<cp360-namespace>.svc:8000
    I360_WEBHOOK_SECRET  shared with the API (X-I360-Signature), or
    I360_INGEST_TOKEN    shared with the API (Authorization: Bearer)
    I360_BUSINESS_DATE_KEY  the dag_run.conf key that carries the business date (default business_date)

A failure to post never fails the task: it is logged and the run goes on.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import urllib.request

log = logging.getLogger("i360")


def _setting(name, default=""):
    try:
        from airflow.models import Variable  # noqa: PLC0415
        v = Variable.get(name, default_var=None)
        if v:
            return v
    except Exception:  # noqa: BLE001
        pass
    return os.environ.get(name, default)


def post(path: str, payload: dict, timeout: float = 5.0) -> bool:
    base = _setting("I360_API_URL").rstrip("/")
    if not base:
        log.info("i360: I360_API_URL not set; event not posted")
        return False
    body = json.dumps(payload, default=str).encode()
    headers = {"Content-Type": "application/json", "User-Agent": "cp360-i360-airflow/1.0"}
    secret, token = _setting("I360_WEBHOOK_SECRET"), _setting("I360_INGEST_TOKEN")
    if secret:
        headers["X-I360-Signature"] = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    elif token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        req = urllib.request.Request(f"{base}{path}", data=body, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=timeout) as r:  # noqa: S310  (in-cluster service, http or https as configured)
            return 200 <= r.status < 300
    except Exception as e:  # noqa: BLE001
        log.warning("i360: post %s failed: %s", path, str(e)[:200])
        return False


def _iso(v):
    return v.isoformat() if v is not None and hasattr(v, "isoformat") else (str(v) if v else None)


def task_event(context: dict) -> dict:
    ti, dr = context.get("task_instance") or context.get("ti"), context.get("dag_run")
    exc = context.get("exception")
    key = _setting("I360_BUSINESS_DATE_KEY", "business_date")
    conf = (getattr(dr, "conf", None) or {}) if dr is not None else {}
    return {
        "kind": "task", "dag_id": getattr(ti, "dag_id", None), "run_id": getattr(ti, "run_id", None) or getattr(dr, "run_id", None),
        "task_id": getattr(ti, "task_id", None), "map_index": getattr(ti, "map_index", -1), "state": str(getattr(ti, "state", "") or ""),
        "try_number": getattr(ti, "try_number", None), "start_date": _iso(getattr(ti, "start_date", None)), "end_date": _iso(getattr(ti, "end_date", None)),
        "duration": getattr(ti, "duration", None), "log_url": getattr(ti, "log_url", None),
        "logical_date": _iso(context.get("logical_date") or context.get("execution_date")), "business_date": conf.get(key),
        "run_state": str(getattr(dr, "state", "") or "") or None,
        "error": (f"{type(exc).__name__}: {exc}"[:2000] if exc else None),
    }


def run_event(context: dict, state: str) -> dict:
    dr = context.get("dag_run")
    key = _setting("I360_BUSINESS_DATE_KEY", "business_date")
    conf = (getattr(dr, "conf", None) or {}) if dr is not None else {}
    return {"kind": "run", "dag_id": getattr(dr, "dag_id", None) or context.get("dag").dag_id, "run_id": getattr(dr, "run_id", None), "state": state,
            "start_date": _iso(getattr(dr, "start_date", None)), "end_date": _iso(getattr(dr, "end_date", None)),
            "logical_date": _iso(context.get("logical_date") or context.get("execution_date")), "business_date": conf.get(key)}


def on_task_success(context):  post("/integration360/ingest/airflow", task_event(context))
def on_task_failure(context):  post("/integration360/ingest/airflow", task_event(context))
def on_task_retry(context):    post("/integration360/ingest/airflow", task_event(context))
def on_dag_success(context):   post("/integration360/ingest/airflow", run_event(context, "success"))
def on_dag_failure(context):   post("/integration360/ingest/airflow", run_event(context, "failed"))


def i360_default_args(extra: dict | None = None) -> dict:
    """default_args carrying the task callbacks; merge your own on top."""
    return {"on_success_callback": on_task_success, "on_failure_callback": on_task_failure, "on_retry_callback": on_task_retry, **(extra or {})}


def i360_dag_callbacks() -> dict:
    """DAG-level callbacks: pass as **i360_dag_callbacks() to DAG(...)."""
    return {"on_success_callback": on_dag_success, "on_failure_callback": on_dag_failure}
