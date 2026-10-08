"""AddVantage UD profile connector: the registry and everything around it.

Reads the profiler's outputs from one folder and loads sql/76:

    attribute_profile.csv   -> cp_advantage_ud_registry   (one row per key)
    type_variance.csv       -> registry.variance_class     (joined by key)
    parent_structures.csv   -> cp_advantage_ud_parent
    schema_variants.csv     -> cp_advantage_ud_schema + cp_advantage_ud_family
    code_conflicts.csv      -> cp_advantage_ud_conflict    (classified)
    run_summary.csv         -> cp_advantage_ud_run         (counts as integers)

NOT READ: attribute_detail.csv and record_schemas.csv. They are per
account, hundreds of megabytes, and nothing the catalogue shows needs a
row per account. sample_values columns are present in two of the files
above and are deliberately never loaded: they can carry a household name
or an account number, and the UI draws the SHAPE of a value from the
registry instead.

Every file is optional, so a partial drop loads what it has; a header
that lacks a required column raises, because a silently empty registry
is worse than a loud one. Pandas writes integers as floats (19.0) and
nulls as blanks; both are handled. Rows MERGE by key, so re-runs replace.

Env:
  CP_ADDV_UD_PROFILE_DIR   (default local-data/advantage-ud/profile)
"""
from __future__ import annotations

import csv
import logging
import os

from .base import BaseConnector
from .advantage_ud_rules import (RULES, split_key, classify, reclassify_type,
                                 structure_role, conflict_class, family_of,
                                 is_gold_candidate, is_free_text)

log = logging.getLogger("cp.advantage_ud")

FILES = {
    "profile":   "attribute_profile.csv",
    "variance":  "type_variance.csv",
    "parents":   "parent_structures.csv",
    "schemas":   "schema_variants.csv",
    "conflicts": "code_conflicts.csv",
    "run":       "run_summary.csv",
}


def _i(v):
    v = (v or "").strip()
    if v == "" or v.lower() in ("nan", "none", "null"):
        return None
    try:
        return int(float(v))
    except ValueError:
        return None


def _f(v):
    v = (v or "").strip()
    if v == "" or v.lower() in ("nan", "none", "null"):
        return None
    try:
        return float(v)
    except ValueError:
        return None


def _s(v, n=None):
    v = (v or "").strip()
    if v.lower() in ("nan", "none"):
        v = ""
    return (v[:n] if n else v) or None


def _read(path, required=()):
    if not os.path.exists(path):
        return None
    with open(path, newline="", encoding="utf-8-sig") as fh:
        rd = csv.DictReader(fh)
        cols = {c.strip().lower(): c for c in (rd.fieldnames or [])}
        missing = [c for c in required if c not in cols]
        if missing:
            raise ValueError(f"{os.path.basename(path)} lacks {missing}; has {rd.fieldnames}")
        rows = []
        for r in rd:
            rows.append({k: (r.get(c) or "") for k, c in cols.items()})
        return rows


class AdvantageUdProfileConnector(BaseConnector):
    name = "advantage_ud_profile"

    def __init__(self, folder, rules=None):
        self.folder = folder
        self.rules = rules or RULES

    @classmethod
    def from_env(cls):
        from .advantage_ud_paths import resolve
        r = resolve()
        return cls(r["profile_dir"] or os.path.join(r["dir"], "profile"))

    def _path(self, k):
        return os.path.join(self.folder, FILES[k])

    # ------------------------------------------------------------- parse
    def parse(self):
        b = {"registry": [], "parents": [], "schemas": [], "families": [],
             "conflicts": [], "run": [], "files": {}}
        var = {}
        for r in _read(self._path("variance"), ("attribute_name",)) or []:
            var[r["attribute_name"].strip().upper()] = _s(r.get("variance_class"), 60)
        b["files"]["variance"] = len(var)

        prof = _read(self._path("profile"), ("attribute_name",))
        for r in prof or []:
            a = r["attribute_name"].strip().upper()
            n, parent, seq, ks = split_key(a)
            dom = _s(r.get("dominant_type"), 40)
            mx = _i(r.get("max_value_length"))
            vtype, changed = reclassify_type(a, dom, mx, self.rules)
            vc, domain, silver, src = classify(a, dom, mx, None, self.rules)
            b["registry"].append({
                "attribute_name": a[:60], "attribute_number": n, "parent_attribute": parent,
                "sequence_number": seq, "key_structure": ks,
                "is_ud_attribute": "Y" if ks != "NON_STANDARD" else "N",
                "occurrence_count": _i(r.get("occurrence_count")),
                "record_presence_pct": _f(r.get("record_presence_pct")),
                "distinct_value_count": _i(r.get("distinct_value_count")),
                "null_or_blank_count": _i(r.get("null_or_blank_count")),
                "min_value_length": _i(r.get("min_value_length")),
                "max_value_length": mx,
                "avg_value_length": _f(r.get("avg_value_length")),
                "dominant_type": dom,
                "dominant_type_pct": _f(r.get("dominant_type_pct")),
                "type_variance_ind": _s(r.get("type_variance_ind"), 1),
                "type_distribution": _s(r.get("type_distribution"), 2000),
                "leading_zero_count": _i(r.get("leading_zero_count")),
                "date_masks": _s(r.get("date_masks"), 200),
                "variance_class": var.get(a),
                "value_class": vc, "type_reclassified": "Y" if changed else "N",
                "domain": domain, "silver_entity": silver, "class_source": src,
                "gold_candidate": "Y" if is_gold_candidate(a, self.rules) else "N",
                "is_free_text": "Y" if is_free_text(a, self.rules) else "N",
            })
        b["files"]["profile"] = len(b["registry"])

        structs = self.rules.get("structures") or {}
        for r in _read(self._path("parents"), ("parent_attribute",)) or []:
            p = r["parent_attribute"].strip().upper()
            b["parents"].append({
                "parent_attribute": p[:60], "record_count": _i(r.get("record_count")),
                "observed_sequences": _s(r.get("observed_sequences"), 1000),
                "missing_sequences": _s(r.get("missing_sequences_in_observed_range"), 1000),
                "min_children": _i(r.get("min_children_per_record")),
                "max_children": _i(r.get("max_children_per_record")),
                "avg_children": _f(r.get("avg_children_per_record")),
                "structure_role": structure_role(p, self.rules),
                "line_names": ", ".join((structs.get(p) or {}).get("lines") or []) or None,
            })
        b["files"]["parents"] = len(b["parents"])

        fams = {}
        for r in _read(self._path("schemas"), ("schema_signature", "attribute_list")) or []:
            keys = [k.strip() for k in r["attribute_list"].split(",") if k.strip()]
            fid, label, parents = family_of(keys, self.rules)
            rc = _i(r.get("record_count")) or 0
            ac = _i(r.get("attribute_count")) or len(keys)
            b["schemas"].append({
                "schema_signature": r["schema_signature"].strip()[:16], "attribute_count": ac,
                "attribute_list": r["attribute_list"], "record_count": rc,
                "typed_variant_count": _i(r.get("typed_schema_variant_count")),
                "record_pct": _f(r.get("record_pct")), "family_id": fid,
            })
            f = fams.setdefault(fid, {"family_id": fid, "family_label": label[:400],
                                      "parents_present": ",".join(parents)[:1000],
                                      "parent_count": len(parents), "record_count": 0,
                                      "variant_count": 0, "min_attribute_count": ac,
                                      "max_attribute_count": ac})
            f["record_count"] += rc
            f["variant_count"] += 1
            f["min_attribute_count"] = min(f["min_attribute_count"], ac)
            f["max_attribute_count"] = max(f["max_attribute_count"], ac)
        b["families"] = sorted(fams.values(), key=lambda f: -f["record_count"])
        b["files"]["schemas"] = len(b["schemas"])

        for r in _read(self._path("conflicts"), ("attribute_name", "code_value")) or []:
            a = r["attribute_name"].strip().upper()
            descs = [d for d in (r.get("descriptions") or "").split(" | ")]
            b["conflicts"].append({
                "conflict_key": f"{a}:{r['code_value'].strip()}"[:200], "attribute_name": a[:60],
                "code_value": r["code_value"].strip()[:50],
                "description_count": _i(r.get("description_count")),
                "descriptions": _s(r.get("descriptions"), 2000),
                "conflict_class": conflict_class(a, descs, self.rules),
            })
        b["files"]["conflicts"] = len(b["conflicts"])

        for r in _read(self._path("run"), ("metric", "value")) or []:
            b["run"].append({"metric": r["metric"].strip()[:60], "value_num": _f(r.get("value"))})
        b["files"]["run"] = len(b["run"])

        log.info("advantage_ud_profile: %s", b["files"])
        return b

    # -------------------------------------------------------------- load
    def load(self, loader, bundle):
        n = 0
        for table, key, rows in (
                ("cp_advantage_ud_registry", ("attribute_name",), bundle["registry"]),
                ("cp_advantage_ud_parent", ("parent_attribute",), bundle["parents"]),
                ("cp_advantage_ud_family", ("family_id",), bundle["families"]),
                ("cp_advantage_ud_schema", ("schema_signature",), bundle["schemas"]),
                ("cp_advantage_ud_conflict", ("conflict_key",), bundle["conflicts"]),
                ("cp_advantage_ud_run", ("metric",), bundle["run"])):
            for r in rows:
                loader._merge(table, key, r)
                n += 1
        loader.commit()
        return n
