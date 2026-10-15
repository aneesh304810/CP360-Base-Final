"""The reviewed SCD2 workbook -> scd2_rule_review.

Reads the XLSX tools/scd2_review_export.py wrote and people filled, and
merges each reviewed row into the sign-off table. A row counts as
reviewed when it has a REVIEWER and either a CONFIRMED value or a
BUSINESS_MEANING; CONFIRMED must be Y or N or blank. The rule text the
reviewer saw is stored beside the sign-off, so a later rerun of the tool
that rewrites a rule can be told apart from the one that was confirmed.

    $env:CP_SCD2_REVIEW_XLSX="local-data/scd2_review.xlsx"
    python -m ingestion.run scd2_review
"""
from __future__ import annotations

import datetime as _dt
import logging
import os

log = logging.getLogger("cp.scd2_review")
DEFAULT_XLSX = "local-data/scd2_review.xlsx"


def _s(x, n):
    if x is None:
        return None
    s = str(x).strip()
    return s[:n] if s else None


class Scd2ReviewConnector:
    def __init__(self, path: str):
        self.path = path

    @classmethod
    def from_env(cls):
        return cls(os.environ.get("CP_SCD2_REVIEW_XLSX") or DEFAULT_XLSX)

    def parse(self) -> dict:
        from openpyxl import load_workbook
        if not os.path.exists(self.path):
            log.warning("scd2_review: %s does not exist — nothing to load", self.path)
            return {"rows": [], "skipped": 0, "source": self.path}
        ws = load_workbook(self.path, read_only=True, data_only=True)["rules"]
        it = ws.iter_rows(values_only=True)
        head = [str(h or "").strip().upper() for h in next(it)]
        idx = {h: i for i, h in enumerate(head)}
        need = ["TABLE_NAME", "RULE_ID", "RULE_TEXT", "BUSINESS_MEANING", "CONFIRMED", "REVIEWER", "REVIEWER_NOTE"]
        missing = [h for h in need if h not in idx]
        if missing:
            raise ValueError(f"review workbook is missing columns: {', '.join(missing)}")
        rows, skipped = [], 0
        for r in it:
            g = lambda k: r[idx[k]] if idx[k] < len(r) else None  # noqa: E731
            t, rid = _s(g("TABLE_NAME"), 128), _s(g("RULE_ID"), 10)
            if not (t and rid):
                continue
            conf = (_s(g("CONFIRMED"), 1) or "").upper() or None
            if conf not in (None, "Y", "N"):
                raise ValueError(f"{t} {rid}: CONFIRMED must be Y or N, got {conf!r}")
            reviewer, meaning, note = _s(g("REVIEWER"), 120), _s(g("BUSINESS_MEANING"), 2000), _s(g("REVIEWER_NOTE"), 2000)
            if not reviewer or not (conf or meaning):
                skipped += 1
                continue
            if conf == "N" and not note:
                raise ValueError(f"{t} {rid}: a rule marked N needs a REVIEWER_NOTE saying why")
            rows.append({"table_name": t.upper(), "rule_id": rid.upper(), "rule_text_seen": _s(g("RULE_TEXT"), 4000),
                         "business_meaning": meaning, "confirmed": conf, "reviewer": reviewer, "reviewer_note": note})
        log.info("scd2_review: %s reviewed rows, %s rows not yet reviewed", len(rows), skipped)
        return {"rows": rows, "skipped": skipped, "source": self.path}

    def load(self, loader, bundle: dict) -> int:
        now = _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0)
        src = os.path.basename(bundle.get("source") or "")[:400]
        n = 0
        for r in bundle["rows"]:
            loader._merge("scd2_rule_review", ("table_name", "rule_id"), {**r, "reviewed_at": now, "source_file": src, "loaded_at": now})
            n += 1
        loader.commit()
        return n
