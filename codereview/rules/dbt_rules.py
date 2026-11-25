"""dbt model and YAML rules: AD-2, incremental hygiene, refs, contracts, naming."""
from __future__ import annotations

import re

from . import Finding

LAYERS = ("stg_", "int_", "dim_", "fct_", "fact_", "br_", "v_", "facade_", "rpt_", "snap_")


def check(fd):
    return check_yaml(fd) if fd.kind == "dbt_yaml" else check_model(fd)


def check_model(fd):
    out = []
    lines = fd.new_lines() if fd.new_text is not None else dict(fd.added)
    text = "\n".join(t for _, t in sorted(lines.items()))
    first = min(lines) if lines else None
    name = fd.path.rsplit("/", 1)[-1][:-4]
    if not name.startswith(LAYERS):
        out.append(Finding("CP360-CR-DBT-006", fd.path, None, f"model {name!r} has no layer prefix (stg_, int_, dim_, fct_, facade naming).", "Name the model by its layer so it can be placed and governed."))
    low = text.lower()
    cfg = re.search(r"\{\{\s*config\((.*?)\)\s*\}\}", text, re.S)
    cfg_s = cfg.group(1) if cfg else ""
    if "incremental" in cfg_s:
        if "unique_key" not in cfg_s:
            out.append(Finding("CP360-CR-DBT-002", fd.path, _line_of(lines, "config("), "incremental model without unique_key.", "Set unique_key to the business key (and the version key for SCD2)."))
        if "is_incremental()" not in text:
            out.append(Finding("CP360-CR-DBT-002", fd.path, _line_of(lines, "config("), "incremental model without an is_incremental() block: every run reloads the full source.", "Filter the source on the run's business date or watermark inside {% if is_incremental() %}."))
        if re.search(r"incremental_strategy\s*=\s*['\"](merge|delete\+insert)", cfg_s):
            out.append(Finding("CP360-CR-DBT-001", fd.path, _line_of(lines, "incremental_strategy"), "merge or delete+insert strategy on an incremental model: AD-2 forbids a destructive merge in Pre-Gold and Gold.", "Use the append-then-flip macro: insert new versions, UPDATE only is_current on superseded keys."))
    for n, t in sorted(lines.items()):
        s = t.strip().lower()
        if s.startswith("--") or s.startswith("{#"):
            continue
        if re.search(r"\bselect\s+\*\s+from\b", s) and "count(*)" not in s:
            out.append(Finding("CP360-CR-DBT-004", fd.path, n, "SELECT * in a model: the column contract is whatever upstream has today.", "List the columns; the YAML contract is checked against them.", evidence=t.strip()[:120]))
        if re.search(r"\b(delete\s+from|truncate\s+table)\b", s) or (re.search(r"\bmerge\s+into\b", s) and "when matched then delete" in low):
            out.append(Finding("CP360-CR-DBT-001", fd.path, n, "a DELETE, TRUNCATE or MERGE-with-delete in a model: rows are never removed; corrections are new versions.", "Append the corrected version and flip is_current.", evidence=t.strip()[:120]))
        if re.search(r"\bupdate\s+\w+\s+set\b", s) and not re.search(r"set\s+is_current\b", s):
            out.append(Finding("CP360-CR-DBT-001", fd.path, n, "an UPDATE of a data column: only the current flag is ever updated in place.", "Insert the new version; UPDATE ... SET is_current='N' is the only in-place write.", evidence=t.strip()[:120]))
        m = re.search(r"\b(from|join)\s+([a-z_][\w$]*\.[a-z_][\w$]*)\b", s)
        if m and "{{" not in s and not re.match(r"(from|join)\s+(dual|\()", s):
            out.append(Finding("CP360-CR-DBT-003", fd.path, n, f"hard-coded table {m.group(2)}: bypasses ref()/source(), lineage and the environment.", "Use {{ ref('model') }} or {{ source('schema', 'table') }}.", evidence=t.strip()[:120]))
        if re.search(r"\bis_current\s*=\s*'y'", s) and re.search(r"\b(cfg_|config_|_config\b|tolerance|severity|registry)", s) and "business_date" not in low:
            out.append(Finding("CP360-CR-DBT-008", fd.path, n, "a config or registry table filtered on is_current alone: replay of an earlier business date reads today's config.", "Join on effective_from <= business_date < effective_to.", evidence=t.strip()[:120], confidence="medium"))
    return out


def check_yaml(fd):
    """Every model in a schema.yml carries description and tests on its key."""
    out = []
    try:
        import yaml
        doc = yaml.safe_load(fd.new_text or fd.added_text) or {}
    except Exception:                                                        # noqa: BLE001
        return out
    for m in (doc.get("models") or []):
        name = m.get("name", "?")
        line = _line_of(fd.new_lines() if fd.new_text is not None else dict(fd.added), f"name: {name}")
        if not (m.get("description") or "").strip():
            out.append(Finding("CP360-CR-DBT-005", fd.path, line, f"model {name} has no description.", "One paragraph: what grain, what business date rule, what it feeds."))
        cols = m.get("columns") or []
        if not cols:
            out.append(Finding("CP360-CR-DBT-005", fd.path, line, f"model {name} declares no columns: no contract for Gate 2 to check.", "List the columns with description and tests."))
            continue
        undocumented = [c.get("name") for c in cols if not (c.get("description") or "").strip()]
        if undocumented:
            out.append(Finding("CP360-CR-DBT-005", fd.path, line, f"model {name}: {len(undocumented)} column(s) without a description ({', '.join(map(str, undocumented[:5]))}).", "Describe every column; the comment is the contract and the prompt."))
        tests = {t if isinstance(t, str) else next(iter(t)) for c in cols for t in (c.get("tests") or c.get("data_tests") or [])}
        keyish = [c for c in cols if re.search(r"(_id|_key|_sk|_number)$", str(c.get("name", "")))]
        if keyish and not ({"unique", "not_null"} & tests):
            out.append(Finding("CP360-CR-DBT-005", fd.path, line, f"model {name}: key column(s) {', '.join(str(c.get('name')) for c in keyish[:3])} without unique or not_null tests.", "Test the business key: unique + not_null, or a dbt_utils.unique_combination_of_columns."))
    return out


def _line_of(lines, needle):
    for n, t in sorted(lines.items()):
        if needle in t:
            return n
    return min(lines) if lines else None
