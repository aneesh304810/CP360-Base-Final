"""AddVantage UD code dictionary connector.

Loads cp_advantage_ud_dictionary (sql/75) from the profiler's
code_dictionary.csv: one row per (attribute_name, code_value,
description_value) with an occurrence_count, split from the
"code=description" strings inside DIM_ACCOUNT_UD.USER_DEFINED_ATTRIBUTE_CLOB.

THE FILTER IS THE POINT. The profiler splits on the first "=" wherever it
sees one, so free text produces pairs that are not codes: a billing
instruction line reading "ANNUAL MIN = 87500" becomes code "ANNUAL MIN",
description "87500". Loading that as a dictionary entry would put prose in
a lookup. Three rules remove the false positives, each named so the log says
why a row was dropped:

  FREE_TEXT_PARENT  the attribute is a line of a multipart text field whose
                    parent is narrative (UD_32 billing instructions).
  CODE_SHAPE        a code has no spaces and is short. "PASSWORD PROTECT; PW"
                    is not a code.
  EMPTY             no description, nothing to look up.

Rows are MERGEd by dict_key, so a re-run replaces counts and never
duplicates. Nothing is deleted: a pair no longer observed stays, which is a
finding for the schema-drift report, not a deletion.

Env:
  CP_ADDV_UD_CODES   the csv (default local-data/advantage-ud/profile/code_dictionary.csv)
"""
from __future__ import annotations

import csv
import logging
import os
import re

from .base import BaseConnector

log = logging.getLogger("cp.advantage_ud")

UD_RE = re.compile(r"^UD_(\d+)(?:_(\d+))?$")

# Multipart parents that are narrative, not coded. UD_32 is the billing
# instruction block (type-3 text, 32-char lines). Extend from the registry
# once the classifier has run; until then this list is the classifier.
FREE_TEXT_PARENTS = {"UD_32"}

MAX_CODE_LEN = 12


def parent_of(attr):
    m = UD_RE.match(attr or "")
    if not m:
        return None
    return f"UD_{m.group(1)}" if m.group(2) else None


def false_positive(attr, code, desc):
    """Return the rule name that rejects this pair, or None to keep it."""
    if not UD_RE.match(attr or ""):
        return "NOT_UD"
    p = parent_of(attr)
    if p in FREE_TEXT_PARENTS:
        return "FREE_TEXT_PARENT"
    c = (code or "").strip()
    if not c or " " in c or len(c) > MAX_CODE_LEN or ";" in c:
        return "CODE_SHAPE"
    if not (desc or "").strip():
        return "EMPTY"
    return None


class AdvantageUdDictionaryConnector(BaseConnector):
    name = "advantage_ud_dictionary"

    def __init__(self, path):
        self.path = path

    @classmethod
    def from_env(cls):
        p = os.environ.get("CP_ADDV_UD_CODES") or os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "local-data", "advantage-ud", "profile", "code_dictionary.csv")
        return cls(p)

    def parse(self):
        if not os.path.exists(self.path):
            log.warning("advantage_ud_dictionary: %s not found, nothing loaded", self.path)
            return {"codes": [], "dropped": {}}
        out, dropped, seen = [], {}, set()
        with open(self.path, newline="", encoding="utf-8-sig") as fh:
            rd = csv.DictReader(fh)
            cols = {c.strip().lower(): c for c in (rd.fieldnames or [])}
            need = ("attribute_name", "code_value", "description_value")
            missing = [c for c in need if c not in cols]
            if missing:
                raise ValueError(f"code_dictionary.csv lacks {missing}; has {rd.fieldnames}")
            for row in rd:
                attr = (row[cols["attribute_name"]] or "").strip().upper()
                code = (row[cols["code_value"]] or "").strip()
                desc = (row[cols["description_value"]] or "").strip()
                why = false_positive(attr, code, desc)
                if why:
                    dropped[why] = dropped.get(why, 0) + 1
                    continue
                key = f"{attr}:{code}:OBSERVED"
                if key in seen:          # same pair twice: counts add, text keeps first
                    continue
                seen.add(key)
                cnt = (row.get(cols.get("occurrence_count", ""), "") or "").strip()
                out.append({
                    "dict_key": key[:200],
                    "attribute_name": attr[:60],
                    "parent_attribute": parent_of(attr),
                    "code_value": code[:50],
                    "description_value": desc[:400],
                    "occurrence_count": int(float(cnt)) if cnt else None,
                    "source": "OBSERVED",
                    "table_number": None,
                    "link_status": "OBSERVED",
                    "is_pii": "N",
                })
        log.info("advantage_ud_dictionary: %d pairs kept, dropped %s", len(out),
                 dropped or "none")
        return {"codes": out, "dropped": dropped}

    def load(self, loader, bundle):
        for r in bundle["codes"]:
            loader._merge("cp_advantage_ud_dictionary", ("dict_key",), r)
        loader.commit()
        return len(bundle["codes"])
