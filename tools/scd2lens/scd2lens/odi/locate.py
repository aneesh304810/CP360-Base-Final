"""Which scenarios and tasks write a table.

A scenario writes TABLE when scenarios.writes names it, or a task's writes
holds TABLE(OP), or an IKM task's code names it as the target through
odiRef.getObjectName("L", "TABLE". All three are checked because the
export is not consistent about which it fills.
"""
from __future__ import annotations

import re

import pandas as pd

from .normalise import normalise_code
from ..ingest.loader import OdiExport


def _has_table(cell: str, table: str) -> bool:
    return re.search(rf"(?<![A-Z0-9_]){re.escape(table)}(?![A-Z0-9_])", (cell or "").upper()) is not None


def writers_of(ex: OdiExport, table: str) -> list[str]:
    t = table.upper()
    out: set[str] = set()
    sc = ex.scenarios
    for _, r in sc.iterrows():
        if _has_table(r.get("writes", ""), t):
            out.add(str(r["scenario"]))
    tk = ex.scenario_tasks
    for _, r in tk.iterrows():
        if _has_table(r.get("writes", ""), t) and f"{t}(" in str(r.get("writes", "")).upper():
            out.add(str(r["scenario"]))
        elif re.search(rf'getObjectName\(\s*"L"\s*,\s*"{re.escape(t)}"', str(r.get("code_preview", "")), re.I):
            out.add(str(r["scenario"]))
    return sorted(out)


def tasks_writing(ex: OdiExport, table: str, scenarios: list[str] | None = None) -> pd.DataFrame:
    t = table.upper()
    tk = ex.scenario_tasks
    if scenarios is not None:
        tk = tk[tk["scenario"].isin(scenarios)]
    mask = tk["writes"].str.upper().str.contains(rf"(?<![A-Z0-9_]){re.escape(t)}\(", regex=True) \
        | tk["code_preview"].str.contains(rf'getObjectName\(\s*"L"\s*,\s*"{re.escape(t)}"', regex=True, case=False)
    return tk[mask].sort_values(["scenario", "step_no", "task_no"]).reset_index(drop=True)


def write_op(writes: str, table: str) -> str | None:
    m = re.search(rf"{re.escape(table.upper())}\(([A-Z_ ]+)\)", (writes or "").upper())
    return m.group(1).strip() if m else None


def scenario_tasks(ex: OdiExport, scenario: str) -> pd.DataFrame:
    tk = ex.scenario_tasks
    return tk[tk["scenario"] == scenario].sort_values(["step_no", "task_no"]).reset_index(drop=True)


def evidence(row: pd.Series, source: str = "scenario_tasks") -> str:
    name = " / ".join(str(row.get(k, "")) for k in ("task_name1", "task_name2", "task_name3") if str(row.get(k, "")).strip())
    return f"{source}: {row.get('scenario')} step {row.get('step_no')} task {row.get('task_no')} — {name}"


def code_of(row: pd.Series) -> str:
    return normalise_code(str(row.get("code_preview", "")))
