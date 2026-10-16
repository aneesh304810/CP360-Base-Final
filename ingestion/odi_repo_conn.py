"""ODI 360 · the repository export as tables — step ``odi_repo``.

WHAT IT LOADS. The CSVs an ODI repository export produces (the same folder
the scd2 step reads): scenarios, scenario_tasks, odi_variables, table_360,
db_objects, lineage_edges. Each becomes one hub table (sql/83) so the screen
can show a scenario step by step, a table with its writers and readers, a
variable with its refresh SQL, and the edges between tables.

WHAT IT DOES NOT DO. It never reads the warehouse: the export is the only
input. Code previews are stored as the export cut them (4,000 characters
at most) and flagged TRUNCATED when the export says the full code was
longer, so a reader knows what they are not seeing.

    $env:CP_ODI_DIR = "local-data/odi_export"     # never committed
    python -m ingestion.run odi_repo

A missing file is a warning and that table is left as it was; the export
is partial more often than it is absent.
"""
from __future__ import annotations

import logging
import os
import sys

log = logging.getLogger("cp.odi_repo")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LENS = os.path.join(ROOT, "tools", "scd2lens")
DEFAULT_ODI_DIR = "local-data/odi_export"


def _s(x, n=4000):
    if x is None:
        return None
    s = str(x).strip()
    return (s[:n] or None)


def _n(x):
    try:
        return int(x)
    except (TypeError, ValueError):
        return None


def _count(s, sep=";"):
    return len([p for p in str(s or "").split(sep) if p.strip()])


def _key(x, n, default="-"):
    """A key column: never NULL. The real export leaves src_type / dst_type /
    relation blank on some edges and object_type blank on some objects; the
    row is still worth keeping, and "-" says the export did not say."""
    return _s(x, n) or default


class OdiRepoConnector:
    def __init__(self, odi_dir: str):
        self.odi_dir = odi_dir

    @classmethod
    def from_env(cls):
        return cls(os.environ.get("CP_ODI_DIR") or DEFAULT_ODI_DIR)

    def parse(self) -> dict:
        if LENS not in sys.path:
            sys.path.insert(0, LENS)
        from scd2lens.ingest.loader import load_export
        from scd2lens.odi.normalise import is_truncated
        ex = load_export(self.odi_dir)
        for m in ex.missing:
            log.warning("odi_repo: %s not in %s — its table is left as it was", m, self.odi_dir)
        tasks = ex.scenario_tasks
        per_scn: dict[str, dict] = {}
        task_rows = []
        for _, r in tasks.iterrows():
            scn = str(r["scenario"]).strip()
            if not scn:
                continue
            cut = bool(is_truncated(str(r["code_preview"]), int(r["code_chars"] or 0)))
            agg = per_scn.setdefault(scn, {"steps": set(), "tasks": 0, "cut": 0})
            agg["steps"].add(int(r["step_no"])); agg["tasks"] += 1; agg["cut"] += int(cut)
            task_rows.append({
                "scenario": _s(scn, 200), "step_no": int(r["step_no"]), "task_no": int(r["task_no"]),
                "version": _s(r["version"], 40), "task_name1": _s(r["task_name1"], 400), "task_name2": _s(r["task_name2"], 400),
                "task_name3": _s(r["task_name3"], 400), "task_type": _s(r["task_type"], 10),
                "reads": _s(r["reads"]), "writes": _s(r["writes"]), "code_chars": _n(r["code_chars"]),
                "code_preview": _s(r["code_preview"]), "truncated": "Y" if cut else "N"})
        scn_rows = []
        for _, r in ex.scenarios.iterrows():
            scn = str(r["scenario"]).strip()
            if not scn:
                continue
            agg = per_scn.get(scn, {"steps": set(), "tasks": 0, "cut": 0})
            scn_rows.append({
                "scenario": _s(scn, 200), "writes": _s(r["writes"]), "reads": _s(r["reads"]), "db_procedures": _s(r["db_procedures"]),
                "kms": _s(r["kms"], 2000), "variables": _s(r["variables"]), "load_pattern": _s(r["load_pattern"], 60),
                "load_plans": _s(r["load_plans"], 2000), "autosys_jobs": _s(r["autosys_jobs"], 2000),
                "step_count": len(agg["steps"]), "task_count": agg["tasks"], "truncated_tasks": agg["cut"]})
        # a scenario that has tasks but no row in scenarios.csv still gets a row, from its tasks
        known = {x["scenario"] for x in scn_rows}
        for scn, agg in per_scn.items():
            if scn not in known:
                mine = tasks[tasks["scenario"] == scn]
                scn_rows.append({"scenario": _s(scn, 200),
                                 "writes": _s(";".join(sorted({w for w in mine["writes"] if str(w).strip()}))),
                                 "reads": _s(";".join(sorted({w for w in mine["reads"] if str(w).strip()}))),
                                 "db_procedures": None, "kms": None, "variables": None, "load_pattern": None,
                                 "load_plans": None, "autosys_jobs": None,
                                 "step_count": len(agg["steps"]), "task_count": agg["tasks"], "truncated_tasks": agg["cut"]})
        var_rows = [{"name": _s(r["name"], 400), "project": _s(r["project"], 200), "datatype": _s(r["datatype"], 60),
                     "default_value": _s(r["default"], 2000), "refresh_lschema": _s(r["refresh_lschema"], 200),
                     "refresh_sql": _s(r["refresh_sql"]), "source_file": _s(r["file"], 400)}
                    for _, r in ex.odi_variables.iterrows() if str(r["name"]).strip()]
        tbl_rows = [{"table_name": _s(str(r["table"]).upper(), 128), "written_by": _s(r["written_by_scenarios"]),
                     "read_by": _s(r["read_by_scenarios"]), "write_operations": _s(r["write_operations"], 400),
                     "indexes": _s(r["indexes"]), "layer": _s(r["layer"], 60),
                     "writer_count": _count(r["written_by_scenarios"]), "reader_count": _count(r["read_by_scenarios"])}
                    for _, r in ex.table_360.iterrows() if str(r["table"]).strip()]
        obj_rows = [{"object_type": _key(str(r["object_type"]).upper(), 60), "schema_name": _key(str(r["schema"]).upper(), 128),
                     "name": _s(r["name"], 200), "on_table": _s(str(r["on_table"]).upper(), 128), "columns": _s(r["columns"]),
                     "used_by": _s(r["used_by"])}
                    for _, r in ex.db_objects.iterrows() if str(r["name"]).strip()]
        edge_rows = [{"src_type": _key(str(r["src_type"]).upper(), 40), "src": _s(r["src"], 200), "relation": _key(r["relation"], 40),
                      "dst_type": _key(str(r["dst_type"]).upper(), 40), "dst": _s(r["dst"], 200), "detail": _key(r["detail"], 400)}
                     for _, r in ex.lineage_edges.iterrows() if str(r["src"]).strip() and str(r["dst"]).strip()]
        log.info("odi_repo: %s scenarios, %s tasks (%s truncated), %s variables, %s tables, %s objects, %s edges from %s",
                 len(scn_rows), len(task_rows), sum(1 for x in task_rows if x["truncated"] == "Y"), len(var_rows),
                 len(tbl_rows), len(obj_rows), len(edge_rows), self.odi_dir)
        return {"scenarios": scn_rows, "tasks": task_rows, "variables": var_rows, "tables": tbl_rows,
                "objects": obj_rows, "edges": edge_rows, "missing": list(ex.missing)}

    PLAN = (("scenarios", "odi_scenario", ("scenario",)),
            ("tasks", "odi_task", ("scenario", "step_no", "task_no")),
            ("variables", "odi_variable", ("name",)),
            ("tables", "odi_table", ("table_name",)),
            ("objects", "odi_object", ("object_type", "schema_name", "name")),
            ("edges", "odi_edge", ("src_type", "src", "relation", "dst_type", "dst", "detail")))

    def load(self, loader, bundle: dict) -> int:
        """Merge every row. A key column is never sent as NULL: whatever parse()
        produced, a None in a key part becomes "-" here and is counted, so one
        odd row in a 2,000-edge export is a warning line, not a failed step."""
        n = 0
        patched = 0
        for key, table, pk in self.PLAN:
            for r in bundle.get(key) or []:
                for k in pk:
                    if r.get(k) is None or (isinstance(r.get(k), str) and not r[k].strip()):
                        r[k] = 0 if k in ("step_no", "task_no") else "-"
                        patched += 1
                loader._merge(table, pk, r)
                n += 1
        if patched:
            log.warning("odi_repo: %s blank key value(s) stored as '-' — the export left them empty", patched)
        # The loader's contract: _merge, then commit. Without this the run closes
        # its connection and Oracle rolls every row back — "merged 82,651 rows"
        # in the log and six empty tables in the schema.
        loader.commit()
        return n
