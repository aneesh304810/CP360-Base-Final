"""TRP multiline samples vs the extract: reconciliation, counts only.

The TRP workbook is one wide row per account, with multiline UD fields as
numbered columns ("Ud 23 1" -> UD_23_1, "Ud 514 3" -> UD_514_3). It is
validation, never a load source: it carries names, phone notes and
account references. So nothing from it is stored except, per attribute,
how many sample rows carry it, how many of those accounts the extract
knows, and whether the values agree.

Null tokens (N/A, NA, NONE, SILENT, blank) and junk markers (#ERROR,
DELETE FILE, DELETE CLIENT, TEST, **DUPE RECORD**, IWM TEST CLIENT, DEMO
ACCOUNT) are counted, not dropped. An attribute the extract never carries
(UD_514 in the brief) shows as every row missing_in_extract: that is the
finding, in a number.

Env:
  CP_ADDV_UD_TRP   the xlsx (default: the first *TRP*.xlsx under local-data/advantage-ud)
"""
from __future__ import annotations

import logging
import os
import re

from .base import BaseConnector
from .advantage_ud_workbook_conn import find_header_row, trp_header_to_key

log = logging.getLogger("cp.advantage_ud")

NULL_TOKENS = {"", "N/A", "NA", "NONE", "SILENT"}
JUNK = ("#ERROR", "DELETE FILE", "DELETE CLIENT", "TEST", "DUPE RECORD", "IWM TEST CLIENT", "DEMO ACCOUNT")


def _norm(v):
    return re.sub(r"\s+", " ", str(v if v is not None else "")).strip().upper()


class AdvantageUdTrpConnector(BaseConnector):
    name = "advantage_ud_trp"

    def __init__(self, path, lookup, registry_keys=None):
        """lookup(account_number) -> {attribute_name: raw_value} or None when
        the account is not in the extract. The step builds it from
        cp_advantage_ud_attribute; tests pass a dict."""
        self.path = path
        self.lookup = lookup
        self.registry_keys = set(registry_keys or [])

    @classmethod
    def from_env(cls, lookup=None, registry_keys=None):
        p = os.environ.get("CP_ADDV_UD_TRP")
        if not p:
            base = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "local-data", "advantage-ud")
            if os.path.isdir(base):
                for n in sorted(os.listdir(base)):
                    if n.lower().endswith(".xlsx") and "trp" in n.lower():
                        p = os.path.join(base, n); break
        return cls(p, lookup or (lambda a: None), registry_keys)

    def parse(self):
        if not self.path or not os.path.exists(self.path):
            log.warning("advantage_ud_trp: %s not found, nothing reconciled", self.path)
            return {"recon": [], "accounts": 0, "columns": 0, "undocumented": []}
        from openpyxl import load_workbook
        wb = load_workbook(self.path, read_only=True, data_only=True)
        ws = wb.worksheets[0]
        hr, hdr = find_header_row(ws)
        keys = [trp_header_to_key(h) for h in hdr]
        ci_acct = next((i for i, h in enumerate(hdr) if _norm(h) == "ACCOUNT NUMBER"), None)
        if ci_acct is None:
            raise ValueError("TRP sheet lacks an 'Account Number' column")
        undocumented = [h for h, k in zip(hdr, keys) if h and not k and _norm(h) != "ACCOUNT NUMBER"]
        stats = {}
        accounts = 0
        for row in ws.iter_rows(min_row=hr + 1, values_only=True):
            cells = list(row)
            acct = _norm(cells[ci_acct] if ci_acct < len(cells) else "")
            if re.match(r"^\d+\.0$", acct):
                acct = acct[:-2]
            if not acct:
                continue
            accounts += 1
            ext = self.lookup(acct)
            for i, k in enumerate(keys):
                if not k:
                    continue
                v = _norm(cells[i] if i < len(cells) else "")
                st = stats.setdefault(k, {"attribute_name": k, "trp_rows": 0, "matched_accounts": 0, "value_equal": 0,
                                          "value_differs": 0, "missing_in_extract": 0, "account_not_in_extract": 0,
                                          "null_tokens": 0, "junk_markers": 0,
                                          "in_registry": "Y" if k in self.registry_keys else "N"})
                if v in NULL_TOKENS:
                    st["null_tokens"] += 1
                    continue
                st["trp_rows"] += 1
                if any(j in v for j in JUNK):
                    st["junk_markers"] += 1
                if ext is None:
                    st["account_not_in_extract"] += 1
                    continue
                st["matched_accounts"] += 1
                if k not in ext:
                    st["missing_in_extract"] += 1
                elif _norm(ext[k]) == v:
                    st["value_equal"] += 1
                else:
                    st["value_differs"] += 1
        recon = sorted(stats.values(), key=lambda s: (int(s["attribute_name"].split("_")[1]), s["attribute_name"]))
        log.info("advantage_ud_trp: %d accounts, %d UD columns, %d undocumented columns",
                 accounts, len([k for k in keys if k]), len(undocumented))
        return {"recon": recon, "accounts": accounts, "columns": len([k for k in keys if k]),
                "undocumented": undocumented}

    def load(self, loader, bundle):
        for r in bundle["recon"]:
            loader._merge("cp_advantage_ud_recon", ("attribute_name",), r)
        loader.commit()
        return len(bundle["recon"])
