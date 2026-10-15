"""Read the ODI export into DataFrames with a known column set.

CSV first; the XLSX workbook only when a CSV is absent. Column names are
lower-cased. A missing file yields an empty frame with the required
columns, and its name is recorded in `missing` so a card can say what
evidence it never saw, rather than silently reporting absence.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

REQUIRED: dict[str, list[str]] = {
    "scenario_tasks": ["scenario", "version", "step_no", "task_no", "task_name1", "task_name2", "task_name3",
                       "task_type", "reads", "writes", "code_chars", "code_preview"],
    "scenarios": ["scenario", "writes", "reads", "db_procedures", "kms", "variables", "load_pattern", "load_plans", "autosys_jobs"],
    "odi_variables": ["name", "project", "datatype", "default", "refresh_lschema", "refresh_sql", "file"],
    "scd2_pbdw": ["table", "verdict", "confidence", "surrogate_key", "valid_from", "valid_to", "current_flag",
                  "business_date", "audit", "maps_to", "notes"],
    "table_360": ["table", "written_by_scenarios", "read_by_scenarios", "write_operations", "indexes", "layer"],
    "db_objects": ["object_type", "schema", "name", "on_table", "columns", "used_by"],
    "lineage_edges": ["src_type", "src", "relation", "dst_type", "dst", "detail"],
}
WORKBOOK = "ODI360_datapoints.xlsx"


@dataclass
class OdiExport:
    root: Path
    frames: dict[str, pd.DataFrame] = field(default_factory=dict)
    missing: list[str] = field(default_factory=list)
    sources: dict[str, str] = field(default_factory=dict)

    def __getattr__(self, name: str) -> pd.DataFrame:
        if name in REQUIRED:
            return self.frames[name]
        raise AttributeError(name)


def _norm(df: pd.DataFrame, required: list[str]) -> pd.DataFrame:
    df = df.copy()
    df.columns = [str(c).strip().lower() for c in df.columns]
    for c in required:
        if c not in df.columns:
            df[c] = ""
    for c in df.columns:
        if df[c].dtype == object:
            df[c] = df[c].fillna("").astype(str)
    if "code_chars" in df.columns:
        df["code_chars"] = pd.to_numeric(df["code_chars"], errors="coerce").fillna(0).astype(int)
    for c in ("step_no", "task_no"):
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0).astype(int)
    return df


def load_export(root: str | Path) -> OdiExport:
    root = Path(root)
    ex = OdiExport(root=root)
    xlsx = root / WORKBOOK
    sheets: dict[str, pd.DataFrame] = {}
    if xlsx.exists():
        try:
            sheets = {k.lower(): v for k, v in pd.read_excel(xlsx, sheet_name=None).items()}
        except Exception:  # a broken workbook is the same as no workbook
            sheets = {}
    for name, req in REQUIRED.items():
        csv = root / f"{name}.csv"
        if csv.exists():
            ex.frames[name] = _norm(pd.read_csv(csv, dtype=str, keep_default_na=False), req)
            ex.sources[name] = csv.name
        elif name in sheets:
            ex.frames[name] = _norm(sheets[name], req)
            ex.sources[name] = f"{WORKBOOK}:{name}"
        else:
            ex.frames[name] = pd.DataFrame({c: pd.Series(dtype=str) for c in req})
            ex.missing.append(name)
    return ex
