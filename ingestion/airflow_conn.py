"""
Airflow connector — reads the Airflow **Postgres** metadata database (read-only)
and writes:
  - datasets (object_type='DAG') per DAG, project resolved from dag_id/tags
  - runs (per task instance, recent window)
  - transform_lineage (DAG -> model) using Cosmos task naming, so the
    Orchestration plane can overlay which DAG runs which dbt model

Connection: AIRFLOW_DSN = postgresql://user:pwd@host:5432/airflow
Uses psycopg if available; degrades to a no-op (logs) if the driver/DB is absent
so ingestion never hard-fails on Airflow being unreachable.
"""
from __future__ import annotations
import logging
import os
import re
from typing import Any, Optional

from .base import BaseConnector
from .model import Dataset
from .project_resolver import ProjectResolver

log = logging.getLogger(__name__)

# Cosmos renders dbt models as tasks named like "<model>_run" / "<model>.run".
_COSMOS_TASK = re.compile(r"^(?P<model>[a-z0-9_]+?)[._](run|test)$", re.I)


class AirflowConnector(BaseConnector):
    PLATFORM_ID = "airflow"

    def __init__(self, dsn: str, resolver: ProjectResolver,
                 dag_filter: Optional[list[str]] = None, run_limit: int = 500):
        self.dsn = dsn
        self.resolver = resolver
        self.dag_filter = dag_filter or []
        self.run_limit = run_limit

    @classmethod
    def from_env(cls) -> "AirflowConnector":
        flt = os.getenv("AIRFLOW_DAGS_FILTER", "")
        return cls(
            dsn=os.environ["AIRFLOW_DSN"],
            dag_filter=[p.strip() for p in flt.split(",") if p.strip()],
            resolver=ProjectResolver.from_env(),
        )

    # ---- parse -------------------------------------------------------
    def parse(self) -> dict[str, Any]:
        from .airflow_metadata_source import open_source
        try:
            src = open_source(self.dsn)
        except Exception as e:
            log.warning("airflow: cannot open source (%s); skipping", e)
            return {"datasets": [], "runs": [], "edges": []}

        datasets: list[Dataset] = []
        runs: list[dict] = []
        edges: list[dict] = []
        try:
            # ---- DAGs ----
            dag_rows = src.fetch("dag")
            # tags per dag
            tags_by_dag: dict[str, list[str]] = {}
            for dag_id, tag in src.fetch("dag_tag"):
                tags_by_dag.setdefault(dag_id, []).append(tag)

            for dag_id, is_paused, owners in dag_rows:
                if self.dag_filter and not _matches(dag_id, self.dag_filter):
                    continue
                tags = tags_by_dag.get(dag_id, [])
                project_id = self.resolver.resolve_for_airflow(dag_id, tags)
                datasets.append(Dataset(
                    platform_id=self.PLATFORM_ID, schema="dags",
                    object_name=dag_id, object_type="DAG",
                    project_id=project_id, owner=owners,
                    tags=",".join(tags) or None))

            # ---- task instances -> runs + Cosmos DAG->model edges ----
            seen_edges = set()
            for dag_id, task_id, state, start, end in src.fetch(
                    "task_instance", limit=self.run_limit):
                if self.dag_filter and not _matches(dag_id, self.dag_filter):
                    continue
                project_id = self.resolver.resolve_for_airflow(
                    dag_id, tags_by_dag.get(dag_id, []))
                dur = ((end - start).total_seconds()
                       if (start and end) else None)
                runs.append({
                    "run_id": f"{dag_id}.{task_id}.{start}",
                    "dag_id": dag_id, "task_id": task_id,
                    "project_id": project_id, "status": state,
                    "start_ts": str(start) if start else None,
                    "end_ts": str(end) if end else None,
                    "duration_s": dur})
                # Cosmos: task -> dbt model => DAG node feeds MODEL node
                m = _COSMOS_TASK.match(task_id or "")
                if m:
                    model = m.group("model")
                    dag_key = f"{self.PLATFORM_ID}.dags.{dag_id}"
                    model_key = f"dbt.dbt.{model}"   # dbt platform/schema fallback
                    eid = f"{dag_key}->{model_key}"
                    if eid not in seen_edges:
                        seen_edges.add(eid)
                        edges.append({
                            "edge_id": eid, "from_key": dag_key,
                            "to_key": model_key, "from_type": "dag",
                            "to_type": "dataset", "source": "airflow_cosmos",
                            "project_id": project_id})
        finally:
            src.close()

        log.info("airflow: %d DAGs, %d runs, %d orchestration edges",
                 len(datasets), len(runs), len(edges))
        return {"datasets": datasets, "runs": runs, "edges": edges}

    # ---- load --------------------------------------------------------
    def load(self, loader, bundle: dict[str, Any]) -> None:
        for ds in bundle["datasets"]:
            loader._merge("datasets",
                ("platform_id", "schema_name", "object_name"),
                {"platform_id": ds.platform_id, "schema_name": ds.schema,
                 "object_name": ds.object_name, "object_type": ds.object_type,
                 "project_id": ds.project_id, "owner": ds.owner, "tags": ds.tags},
                protect=("business_desc",))
        for r in bundle["runs"]:
            loader._merge("runs", ("run_id",), r)
        for e in bundle["edges"]:
            loader._merge("transform_lineage", ("edge_id",), e)
        loader.commit()


def _matches(dag_id: str, patterns: list[str]) -> bool:
    for p in patterns:
        rx = "^" + re.escape(p).replace(r"\*", ".*") + "$"
        if re.match(rx, dag_id, re.I):
            return True
    return False
