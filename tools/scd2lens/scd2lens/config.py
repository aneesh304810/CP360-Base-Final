"""Settings: config.yaml plus three environment variables for the connection.

Credentials come only from the environment and are never echoed, logged
or written into a report.
"""
from __future__ import annotations

import os
from pathlib import Path

import yaml
from pydantic import BaseModel, Field

DEFAULT_TECH = ["START_DATE", "END_DATE", "ACTIVE_IND", "LOAD_DATE", "LOAD_TYPE", "BATCH_ID", "CREATED_TSP", "UPDATED_TSP"]
DEFAULT_LOBS = ["CLOB", "BLOB", "NCLOB", "LONG", "LONG RAW"]


class Settings(BaseModel):
    odi_dir: Path = Path("./odi_export")
    schema_name: str = Field("PBDWAPP", alias="schema")
    tech_columns: list[str] = DEFAULT_TECH
    hash_chunk_size: int = 8
    lob_types: list[str] = DEFAULT_LOBS
    db_sample_since: str | None = None
    freshness_alert_days: int = 10
    tables: str | list[str] = "auto"
    # Sub-population column per table, declared when the code that would
    # prove it is truncated in the export: {"DIM_ACCOUNT": "MASTER_IND"}.
    # Regular and master accounts share DIM_ACCOUNT and get their versions
    # from separate scenarios, so a version number partitioned on the
    # natural key alone merges two histories.
    partitions: dict[str, str] = {}

    model_config = {"populate_by_name": True}

    @classmethod
    def load(cls, path: str | Path | None = None) -> "Settings":
        p = Path(path or "config.yaml")
        data = yaml.safe_load(p.read_text()) if p.exists() else {}
        return cls(**(data or {}))

    @property
    def tech_upper(self) -> set[str]:
        return {c.upper() for c in self.tech_columns}

    @property
    def lob_upper(self) -> set[str]:
        return {c.upper() for c in self.lob_types}


class Credentials(BaseModel):
    dsn: str
    user: str
    password: str

    @classmethod
    def from_env(cls) -> "Credentials | None":
        dsn, user, pw = os.environ.get("PBDW_DSN"), os.environ.get("PBDW_USER"), os.environ.get("PBDW_PASSWORD")
        if not (dsn and user and pw):
            return None
        return cls(dsn=dsn, user=user, password=pw)

    def __repr__(self) -> str:  # never leak
        return "Credentials(user=***, dsn=***)"
