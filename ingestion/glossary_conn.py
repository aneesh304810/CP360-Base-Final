"""
Business glossary connector (semantic layer).

Derives business terms and their column mappings from dbt, then merges an
optional authored glossary file for gaps (regulatory scope, terms dbt doesn't
carry). Sources, in priority order (later overrides earlier on conflict):

  1. dbt metrics (MetricFlow)  -> term = metric.label, maps to the measure column
  2. dbt model meta.business_term / meta.* -> term from meta
  3. dbt column descriptions    -> weak terms (only if flagged)
  4. authored glossary file (md/xlsx) -> fills gaps, sets regulatory_scope

Writes business_glossary + term_column_map. Trace-down to physical lineage
reuses the existing column_lineage / transform_lineage at query time (in the
router), so this connector only needs the top mapping.
"""
from __future__ import annotations
import json
import logging
import os
import re
from pathlib import Path

log = logging.getLogger("cp.glossary")


class GlossaryConnector:
    def __init__(self, manifest_path: str, semantic_manifest_path: str | None = None,
                 authored_path: str | None = None, project_default: str = "sei"):
        self.manifest_path = manifest_path
        # MetricFlow metrics can live in manifest.json (newer dbt) or a separate
        # semantic_manifest.json; accept either.
        self.semantic_manifest_path = semantic_manifest_path
        self.authored_path = authored_path
        self.project_default = project_default

    @classmethod
    def from_env(cls):
        return cls(
            manifest_path=os.environ["DBT_MANIFEST_PATH"],
            semantic_manifest_path=os.getenv("DBT_SEMANTIC_MANIFEST_PATH"),
            authored_path=os.getenv("GLOSSARY_AUTHORED_PATH"),
        )

    def parse(self) -> dict:
        terms: dict[str, dict] = {}        # term -> glossary row
        maps: list[dict] = []              # term_column_map rows

        manifest = json.load(open(self.manifest_path, encoding="utf-8", errors="replace"))
        nodes = manifest.get("nodes", {})

        # --- column key resolver: model name -> "schema.model" dataset_key ---
        model_dskey = {}
        model_cols = {}
        for uid, n in nodes.items():
            if n.get("resource_type") != "model":
                continue
            nm = n["name"]
            ds = f"{n.get('schema','')}.{nm}".lower()
            model_dskey[nm] = ds
            model_cols[nm] = {c.lower() for c in (n.get("columns") or {}).keys()}

        # --- 1. dbt metrics (MetricFlow) ---
        # newer dbt: manifest["metrics"], plus optional separate semantic manifest
        metric_sources = [manifest.get("metrics", {})]
        if self.semantic_manifest_path and Path(self.semantic_manifest_path).exists():
            sm = json.load(open(self.semantic_manifest_path, encoding="utf-8", errors="replace"))
            metric_sources.append({m.get("name"): m for m in sm.get("metrics", [])})
            # build measure -> (model, column) from semantic_models
            measure_col = {}
            for smod in sm.get("semantic_models", []):
                model_ref = smod.get("node_relation", {}).get("alias") or smod.get("model", "")
                model_ref = re.sub(r".*\.", "", str(model_ref)).strip("'\"")
                for meas in smod.get("measures", []):
                    expr = meas.get("expr") or meas.get("name")
                    measure_col[meas["name"]] = (model_ref, expr)
        else:
            measure_col = {}

        for msrc in metric_sources:
            for mname, m in (msrc or {}).items():
                if not isinstance(m, dict):
                    continue
                label = m.get("label") or m.get("name") or mname
                term = label.strip()
                terms[term] = {
                    "term": term[:200], "label": label[:400],
                    "definition": (m.get("description") or "")[:4000] or None,
                    "business_domain": None,
                    "owner": (m.get("meta") or {}).get("owner"),
                    "regulatory_scope": (m.get("meta") or {}).get("regulatory_scope"),
                    "certified": "Y" if (m.get("meta") or {}).get("certified") else "N",
                    "metric_type": m.get("type") or m.get("calculation"),
                    "source": "dbt_metric", "project_id": self.project_default,
                }
                # map metric -> measure column -> model.column
                meas_name = None
                tm = m.get("type_params") or {}
                if isinstance(tm.get("measure"), dict):
                    meas_name = tm["measure"].get("name")
                elif isinstance(tm.get("measure"), str):
                    meas_name = tm["measure"]
                if meas_name and meas_name in measure_col:
                    model_ref, col = measure_col[meas_name]
                    ds = model_dskey.get(model_ref, model_ref.lower())
                    maps.append({"term": term[:200], "dataset_key": ds[:520],
                                 "column_name": (col or meas_name)[:200],
                                 "mapping_source": "dbt_metric"})

        # --- 2. dbt model meta.business_term ---
        for uid, n in nodes.items():
            if n.get("resource_type") != "model":
                continue
            meta = (n.get("config") or {}).get("meta") or n.get("meta") or {}
            bt = meta.get("business_term")
            if not bt:
                continue
            term = str(bt).strip()
            terms.setdefault(term, {
                "term": term[:200], "label": term[:400],
                "definition": (n.get("description") or "")[:4000] or None,
                "business_domain": meta.get("domain"),
                "owner": meta.get("owner"),
                "regulatory_scope": meta.get("regulatory_scope"),
                "certified": "Y" if meta.get("certified") else "N",
                "metric_type": None, "source": "dbt_meta",
                "project_id": self.project_default,
            })
            # map to the meta-named column, or the model's first measure-like col
            col = meta.get("business_column")
            if col:
                maps.append({"term": term[:200],
                             "dataset_key": model_dskey.get(n["name"], n["name"]).lower()[:520],
                             "column_name": str(col)[:200], "mapping_source": "dbt_meta"})

        # --- 3. column-level meta.business_term (finest dbt-derived) ---
        for uid, n in nodes.items():
            if n.get("resource_type") != "model":
                continue
            for cname, c in (n.get("columns") or {}).items():
                cmeta = c.get("meta") or {}
                bt = cmeta.get("business_term")
                if not bt:
                    continue
                term = str(bt).strip()
                terms.setdefault(term, {
                    "term": term[:200], "label": term[:400],
                    "definition": (c.get("description") or "")[:4000] or None,
                    "business_domain": cmeta.get("domain"),
                    "owner": cmeta.get("owner"), "regulatory_scope": cmeta.get("regulatory_scope"),
                    "certified": "Y" if cmeta.get("certified") else "N",
                    "metric_type": None, "source": "dbt_meta",
                    "project_id": self.project_default,
                })
                maps.append({"term": term[:200],
                             "dataset_key": model_dskey.get(n["name"], n["name"]).lower()[:520],
                             "column_name": cname.lower()[:200], "mapping_source": "dbt_meta"})

        # --- 4. authored glossary file fills gaps / adds regulatory scope ---
        if self.authored_path and Path(self.authored_path).exists():
            self._merge_authored(terms, maps)

        log.info("glossary: %d terms, %d column mappings", len(terms), len(maps))
        return {"glossary": list(terms.values()), "maps": _dedupe(maps)}

    def _merge_authored(self, terms, maps):
        """Authored markdown table: | Term | Definition | Domain | Owner |
        Regulatory | Maps to (schema.model.column) |"""
        path = Path(self.authored_path)
        text = path.read_text(encoding="utf-8", errors="replace")
        for line in text.splitlines():
            if not line.strip().startswith("|"):
                continue
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if len(cells) < 2 or cells[0].lower() in ("term", ""):
                continue
            # skip markdown separator rows like |----|----| or |:---|---:|
            if re.fullmatch(r"[-:]+", cells[0]):
                continue
            term = cells[0]
            existing = terms.get(term, {})
            terms[term] = {
                "term": term[:200], "label": existing.get("label", term)[:400],
                "definition": (cells[1] if len(cells) > 1 else None) or existing.get("definition"),
                "business_domain": (cells[2] if len(cells) > 2 and cells[2] else None) or existing.get("business_domain"),
                "owner": (cells[3] if len(cells) > 3 and cells[3] else None) or existing.get("owner"),
                "regulatory_scope": (cells[4] if len(cells) > 4 and cells[4] else None) or existing.get("regulatory_scope"),
                "certified": existing.get("certified", "N"),
                "metric_type": existing.get("metric_type"),
                "source": existing.get("source", "authored") if existing else "authored",
                "project_id": self.project_default,
            }
            # column mapping "schema.model.column"
            if len(cells) > 5 and cells[5]:
                ref = cells[5].strip()
                parts = ref.rsplit(".", 1)
                if len(parts) == 2:
                    maps.append({"term": term[:200], "dataset_key": parts[0].lower()[:520],
                                 "column_name": parts[1].lower()[:200],
                                 "mapping_source": "authored"})

    def load(self, loader, bundle):
        for g in bundle["glossary"]:
            loader._merge("business_glossary", ("term",), g,
                          protect=("regulatory_scope", "certified", "owner"))
        for m in bundle["maps"]:
            loader._merge("term_column_map",
                          ("term", "dataset_key", "column_name"), m)
        loader.commit()


def _dedupe(maps):
    seen, out = set(), []
    for m in maps:
        k = (m["term"], m["dataset_key"], m["column_name"])
        if k not in seen:
            seen.add(k); out.append(m)
    return out
