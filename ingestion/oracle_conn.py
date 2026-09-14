"""
Oracle connector — harvests tables/views and columns from configured schemas
(read-only). Project resolved per schema via ProjectResolver.resolve_for_oracle
(schemas in SEI_ORACLE_SCHEMAS -> 'sei', else 'internal').

Degrades to a no-op (logs) if the driver/DB is unreachable so ingestion never
hard-fails on a single source.
"""
from __future__ import annotations
import logging
import os
from typing import Any, Optional

from .base import BaseConnector
from .model import Dataset, Column
from .project_resolver import ProjectResolver

log = logging.getLogger(__name__)


class OracleConnector(BaseConnector):
    def __init__(self, dsn: str, schemas: list[str], resolver: ProjectResolver,
                 platform_id: str = "ora"):
        self.dsn = dsn
        self.schemas = schemas
        self.resolver = resolver
        self.platform_id = platform_id

    @classmethod
    def from_env(cls) -> "OracleConnector":
        schemas = [s.strip() for s in
                   os.getenv("ORACLE_PROD_SCHEMAS", "").split(",") if s.strip()]
        return cls(
            dsn=os.environ["ORACLE_PROD_DSN"],
            schemas=schemas,
            resolver=ProjectResolver.from_env(),
            platform_id=os.getenv("ORACLE_PLATFORM_ID", "ora"),
        )

    def _connect(self):
        import oracledb
        dsn = self.dsn
        if dsn.startswith("oracle://"):
            rest = dsn[len("oracle://"):]
            creds, hostpart = rest.split("@", 1)
            user, pwd = creds.split(":", 1)
            return oracledb.connect(user=user, password=pwd, dsn=hostpart)
        return oracledb.connect(dsn=dsn)

    def parse(self) -> dict[str, Any]:
        try:
            conn = self._connect()
        except Exception as e:
            log.warning("oracle: cannot connect (%s); skipping", e)
            return {"datasets": []}

        datasets: list[Dataset] = []
        try:
            cur = conn.cursor()
            for schema in self.schemas:
                project_id = self.resolver.resolve_for_oracle(self.platform_id, schema)
                # tables + views
                cur.execute(
                    """SELECT object_name, object_type FROM all_objects
                       WHERE owner = :o AND object_type IN ('TABLE','VIEW')""",
                    {"o": schema.upper()})
                objs = cur.fetchall()
                for object_name, otype in objs:
                    ds = Dataset(
                        platform_id=self.platform_id, schema=schema,
                        object_name=object_name, object_type=otype,
                        project_id=project_id)
                    datasets.append(ds)
                # columns for the whole schema in one pass
                cur.execute(
                    """SELECT table_name, column_name, data_type, data_length,
                              data_precision, data_scale, nullable, column_id
                       FROM all_tab_columns WHERE owner = :o
                       ORDER BY table_name, column_id""",
                    {"o": schema.upper()})
                by_obj: dict[str, Dataset] = {d.object_name: d for d in datasets
                                              if d.schema_name == schema}
                for (tname, cname, dtype, dlen, dprec, dscale,
                     nullable, cid) in cur.fetchall():
                    ds = by_obj.get(tname)
                    if not ds:
                        continue
                    ds.columns.append(Column(
                        platform_id=self.platform_id, schema=schema,
                        object_name=tname, column_name=cname, position_order=cid,
                        data_type=dtype, base_data_type=dtype, max_length=dlen,
                        precision=dprec, scale=dscale,
                        nullable="Y" if nullable == "Y" else "N"))
            cur.close()
        finally:
            conn.close()
        log.info("oracle: %d datasets from %d schemas",
                 len(datasets), len(self.schemas))
        return {"datasets": datasets}

    def load(self, loader, bundle: dict[str, Any]) -> None:
        for ds in bundle["datasets"]:
            loader._merge("datasets",
                ("platform_id", "schema_name", "object_name"),
                {"platform_id": ds.platform_id, "schema_name": ds.schema,
                 "object_name": ds.object_name, "object_type": ds.object_type,
                 "project_id": ds.project_id},
                protect=("business_desc",))
            for c in ds.columns:
                loader._merge("columns",
                    ("platform_id", "schema_name", "object_name", "column_name"),
                    {"platform_id": ds.platform_id, "schema_name": ds.schema,
                     "object_name": ds.object_name, "column_name": c.name,
                     "position_order": c.position_order, "data_type": c.data_type,
                     "base_data_type": c.base_data_type, "max_length": c.max_length,
                     "precision": c.precision, "scale": c.scale,
                     "nullable": "Y" if c.nullable else "N"},
                    protect=("business_desc", "is_pii", "pii_category", "pii_attribute"))
        loader.commit()
