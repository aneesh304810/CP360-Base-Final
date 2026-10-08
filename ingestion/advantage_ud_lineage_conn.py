"""Per-key lineage for the UD envelope, synthesised from the registry.

THE GAP THIS CLOSES. Every UD field lands in one column,
DIM_ACCOUNT_UD.USER_DEFINED_ATTRIBUTE_CLOB, so Datapoint 360 said "not in
DWH lineage" for UD/2 while the key UD_2 sat in 20,794 payloads. The
lineage loader does explode the CLOB into is_ud rows, but only from the
keys that happen to be in ONE proof sample row, and with no source chain,
so the dictionary's join (on the canonical source column) never finds
them.

This writes one legacy_lineage row per registry attribute:

  src     ACCOUNTMASTER . UD/2            the AddVantage field (dictionary code,
                                          UD/23-1 for a line, so the canonical
                                          join key UD_23_1 matches)
  stg2    STG2_ACCOUNT_UD_INTRADAY . UD_FLD_NUMBER   the tall table, one row per
                                          account per field number (per line)
  dwh     DIM_ACCOUNT_UD . UD_2            a virtual column: the JSON key inside
                                          USER_DEFINED_ATTRIBUTE_CLOB

A proof-exploded row for the same key is updated in place (its id is
reused), so the explosion and the registry agree instead of doubling.
Nothing here touches legacy_lineage_conn.py.
"""
from __future__ import annotations

import hashlib
import logging

from .base import BaseConnector
from .advantage_ud_rules import split_key

log = logging.getLogger("cp.advantage_ud")

DWH_TABLE = "DIM_ACCOUNT_UD"
CLOB = "USER_DEFINED_ATTRIBUTE_CLOB"
STG2_TABLE = "STG2_ACCOUNT_UD_INTRADAY"
STG2_COL = "UD_FLD_NUMBER"
SRC_TABLE = "ACCOUNTMASTER"


def dictionary_code(attr):
    """UD_2 -> UD/2 ; UD_23_1 -> UD/23-1 (the workbook's spelling)."""
    n, parent, seq, ks = split_key(attr)
    if n is None:
        return attr
    return f"UD/{n}" + (f"-{seq}" if seq is not None else "")


class AdvantageUdLineageConnector(BaseConnector):
    name = "advantage_ud_lineage"

    def __init__(self, registry, existing=None, template=None, data_source="PBDW"):
        """registry: iterable of dicts with attribute_name (+ key_structure, sequence_number).
        existing: {(dwh_target_table, dwh_target_column): lineage_id} for rows already
                  there with is_ud='Y', so they are updated rather than doubled.
        template: the CLOB column's own lineage row (functional_group etc.)."""
        self.registry = list(registry or [])
        self.existing = dict(existing or {})
        self.template = template or {}
        self.ds = data_source

    @classmethod
    def from_env(cls, registry=None, existing=None, template=None):
        return cls(registry or [], existing, template)

    def parse(self):
        out = []
        for r in self.registry:
            a = (r.get("attribute_name") or "").strip().upper()
            n, parent, seq, ks = split_key(a)
            if ks == "NON_STANDARD":
                continue
            code = dictionary_code(a)
            where = f"{STG2_COL} = {n}" + (f", line {seq}" if seq is not None else "")
            key = (DWH_TABLE, a)
            lid = self.existing.get(key) or \
                f"{self.ds}:{DWH_TABLE}:{a}:{hashlib.sha1(f'{SRC_TABLE}|{code}'.encode()).hexdigest()[:10]}"
            row = {
                "lineage_id": lid[:600], "data_source": self.ds[:40],
                "dwh_target_table": DWH_TABLE, "dwh_target_column": a[:200],
                "dwh_type": "JSON key in CLOB",
                "stg2_source_table": STG2_TABLE, "stg2_source_column": STG2_COL,
                "stg2_to_dwh_transform": f"pivot: rows where {where} become JSON key \"{a}\" of {CLOB}",
                "src_source_table": SRC_TABLE, "src_source_column": code[:200],
                "lineage_status": "UD Attribute",
                "lineage_status_detail": "Synthesised from the UD registry (profile of "
                                         f"{DWH_TABLE}.{CLOB}); STG2 pivot inferred from the CLOB column's own chain",
                "is_ud": "Y", "ud_key": a[:60],
            }
            if self.template.get("functional_group"):
                row["functional_group"] = self.template["functional_group"]
            out.append(row)
        log.info("advantage_ud_lineage: %d per-key rows (%d reuse an exploded row's id)",
                 len(out), sum(1 for r in out if (DWH_TABLE, r["dwh_target_column"]) in self.existing))
        return out

    def load(self, loader, rows):
        for r in rows:
            loader._merge("legacy_lineage", ("lineage_id",), r)
        loader.commit()
        return len(rows)
