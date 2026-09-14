"""ProjectResolver — single source of truth for project_id detection.

Every connector that creates a project-bearing entity calls this. No project
logic lives anywhere else. Rules are deterministic and auditable.
"""
from __future__ import annotations
import os
import re
from pathlib import Path

SEI_DBT_PATTERNS = [r"^sei_", r"^swp_"]
SEI_AIRFLOW_PATTERNS = [r"^swp_", r"^sei_"]

# fuzzy system-name -> project_id for Interface 360
_SYSTEM_MAP = [
    (r"addvantage|addv", "addvantage"),
    (r"pivotal|salesx", "pivotal"),
    (r"charles\s*river|crd", "charles_river"),
    (r"bloomberg|bbg", "bloomberg"),
    (r"sei|swp", "sei"),
    (r"pbdw|imdw|imds|risk|in-?house|bbh|client\s*portal", "internal"),
]


class ProjectResolver:
    def __init__(self, sei_oracle_schemas: list[str] | None = None,
                 overrides: dict | None = None):
        self.sei_oracle_schemas = {s.upper() for s in (sei_oracle_schemas or [])}
        self.overrides = overrides or {}

    @classmethod
    def from_env(cls) -> "ProjectResolver":
        schemas = [s.strip() for s in
                   os.getenv("SEI_ORACLE_SCHEMAS", "SEI_RAW,SEI_STAGE").split(",") if s.strip()]
        return cls(sei_oracle_schemas=schemas)

    # ---- per-source resolution ----------------------------------------
    def resolve_for_oracle(self, platform_id: str, schema: str) -> str:
        if (schema or "").upper() in self.sei_oracle_schemas:
            return "sei"
        return "internal"

    def resolve_for_mssql(self, platform_id: str, schema: str) -> str:
        # MSSQL sources are in-house by default
        return "internal"

    def resolve_for_dbt(self, model_name: str, meta: dict | None = None) -> str:
        meta = meta or {}
        if meta.get("project"):
            return meta["project"]
        for pat in SEI_DBT_PATTERNS:
            if re.match(pat, model_name or "", re.I):
                return "sei"
        return "internal"

    def resolve_for_airflow(self, dag_id: str, tags: list | None = None) -> str:
        tags = tags or []
        if "sei" in [str(t).lower() for t in tags]:
            return "sei"
        for pat in SEI_AIRFLOW_PATTERNS:
            if re.match(pat, dag_id or "", re.I):
                return "sei"
        return "internal"

    def resolve_for_api_spec(self, file_path: Path | str) -> str:
        parts = Path(file_path).parts
        if "NON-SEI" in parts:
            return "internal"
        if "API-SPEC" in parts:
            return "sei"
        return "other"

    def resolve_for_swp_feed(self, feed_name: str) -> str:
        return "sei"

    def resolve_for_interface_system(self, system_name: str) -> str:
        s = (system_name or "").lower()
        for pat, pid in _SYSTEM_MAP:
            if re.search(pat, s):
                return pid
        return "internal"
