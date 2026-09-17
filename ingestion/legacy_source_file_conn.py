"""CP_SOURCE_FILE — what each AddVantage EOD feed IS, in business words.

The lineage workbook's CP_SOURCE_FILE sheet is two columns:

    A  "AddVantage EOD Data feed"   Addv-ACCT-CHK-REG_BBH-TRP_YYYYMMDDHHMMSS.dat
    B  "Dataset"                    Account-Check Register

legacy_lineage.src_source_table carries the left-hand value — the physical
transmission name, which tells a business reader nothing. The right-hand value
is the answer, it has been sitting in the workbook all along, and nothing read
it. This connector does.

WHY THIS IS ITS OWN MODULE AND NOT A METHOD ON LegacyLineageConnector

The obvious home is legacy_lineage_conn.py, beside _parse_dependency. It is
not the safe one: the copy of that file in this repository is OLDER than the
copy being run — it has none of the [FIX 1..4] proof-parser patches — and
editing a stale file is how api.js, mockData.js and routers_legacy_lineage.py
each broke a working screen earlier in this work. A separate module has no
such failure mode: it can be added to a checkout running any version of the
lineage connector, and it changes nothing that already loads.

Run it as its own ingestion step:

    python -m ingestion.run legacy_source_file

Env:
    CP_LEGACY_LINEAGE_XLSX        the workbook (same one the lineage step reads)
    CP_LEGACY_SOURCE_FILE_SHEET   optional; default: auto-detect CP_SOURCE_FILE
    CP_LEGACY_DATA_SOURCE         which warehouse (default PBDW)
"""
from __future__ import annotations
import os
import re
import logging
from openpyxl import load_workbook

log = logging.getLogger("cp.legacy_source_file")

_PREFERRED = ("cpsourcefile", "sourcefile", "sourcefiles",
              "addvantageeoddatafeed")

# Headings matched loosely rather than exactly: this sheet is maintained by
# hand, and "AddVantage EOD Data feed" is the kind of heading that acquires a
# year or a footnote. Order matters — "file" would otherwise claim a column
# named "Dataset file".
_FILE_HDR = ("addvantageeoddatafeed", "eoddatafeed", "datafeed", "sourcefile",
             "filename", "feed", "file")
_DATASET_HDR = ("dataset", "datasetname", "businessname", "businessterm",
                "description")

_EXT_RE = re.compile(r"\.(dat|txt|csv|psv|tsv)$", re.I)
# YYYYMMDDHHMMSS / YYYYMMDD stamps, and <SEQ NO.>-style sequence markers
_PLACEHOLDER_RE = re.compile(r"<[^>]*>|Y{4}M{2}D{2}(?:H{2}M{2}S{2})?", re.I)
# transmission tags — stripped only where they TRAIL the name
_TRAIL_TOKENS = ("BBH", "TRP")


def _s(v):
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _norm(name):
    return str(name or "").lower().replace(" ", "").replace("_", "")


def file_key(name):
    """Canonical join key between a feed name and a src_source_table.

    The two are spelled inconsistently — the lineage sheet sometimes carries
    the full transmission name, sometimes a shorter form — so matching the raw
    strings alone misses. Drop the extension, the date and sequence
    placeholders, collapse separators, uppercase.

        Addv-ACCT-CHK-REG_BBH-TRP_YYYYMMDDHHMMSS.dat -> ADDV_ACCT_CHK_REG
        Addv-MSTR-ACC-BID1_TRP_YYYYMMDDHHMMSS_<SEQ NO.>.dat
                                                     -> ADDV_MSTR_ACC_BID1

    BBH and TRP come off the END only, and that restriction is the whole
    reason this is a function rather than a regex. BBH_REQUEST_AUTHORIZER is a
    real source table whose name BEGINS with BBH; stripping the token wherever
    it appeared would rename it REQUEST_AUTHORIZER and break its own lineage.
    """
    if not name:
        return ""
    s = _EXT_RE.sub("", str(name).strip())
    s = _PLACEHOLDER_RE.sub(" ", s)
    parts = [p for p in re.split(r"[\s/.\-_]+", s.upper()) if p]
    while parts and parts[-1] in _TRAIL_TOKENS:
        parts.pop()
    return "_".join(parts)


class LegacySourceFileConnector:
    name = "legacy_source_file"

    def __init__(self, xlsx_path, sheet=None, data_source=None):
        self.xlsx_path = xlsx_path
        self.sheet = sheet
        self.data_source = (data_source or "PBDW").upper()

    @classmethod
    def from_env(cls):
        return cls(
            os.environ.get("CP_LEGACY_LINEAGE_XLSX",
                           "sample-artifacts/LEGACY-LINEAGE/legacy_lineage.xlsx"),
            os.environ.get("CP_LEGACY_SOURCE_FILE_SHEET"),
            os.environ.get("CP_LEGACY_DATA_SOURCE"),
        )

    def _pick_sheet(self, wb):
        if self.sheet:
            return self.sheet
        norm = {_norm(s): s for s in wb.sheetnames}
        for pref in _PREFERRED:
            if pref in norm:
                return norm[pref]
        for s in wb.sheetnames:
            if "sourcefile" in _norm(s):
                return s
        return None

    def parse(self):
        if not os.path.exists(self.xlsx_path):
            log.warning("legacy lineage workbook not found: %s (skipping)",
                        self.xlsx_path)
            return {"source_file": []}
        wb = load_workbook(self.xlsx_path, data_only=True, read_only=True)
        name = self._pick_sheet(wb)
        if not name or name not in wb.sheetnames:
            log.warning("no CP_SOURCE_FILE sheet in %s — feeds will keep "
                        "showing as transmission filenames", self.xlsx_path)
            return {"source_file": []}

        ws = wb[name]
        hdr = []
        for row in ws.iter_rows(min_row=1, max_row=1, values_only=True):
            hdr = [(_s(c) or "") for c in row]
            break

        i_file = i_ds = None
        for i, h in enumerate(hdr):
            n = _norm(h)
            if i_file is None and any(k in n for k in _FILE_HDR):
                i_file = i
            elif i_ds is None and any(k in n for k in _DATASET_HDR):
                i_ds = i
        # the sheet has always been (feed, dataset) in the first two columns;
        # fall back to that rather than returning nothing on a renamed heading
        if i_file is None:
            i_file = 0
        if i_ds is None:
            i_ds = 1 if len(hdr) > 1 else None
        log.info("legacy_source_file: sheet %r, feed=col%s dataset=col%s",
                 name, i_file, i_ds)

        out, seen, dup = [], set(), 0
        for row in ws.iter_rows(min_row=2, values_only=True):
            f = _s(row[i_file]) if i_file < len(row) else None
            if not f:
                continue
            d = _s(row[i_ds]) if i_ds is not None and i_ds < len(row) else None
            if f in seen:
                dup += 1
                continue
            seen.add(f)
            out.append({"src_file": f, "src_file_key": file_key(f),
                        "dataset": d, "source_system": "ADDVANTAGE",
                        "data_source": self.data_source})

        named = sum(1 for r in out if r["dataset"])
        log.info("legacy_source_file[%s]: %d feeds, %d with a dataset name%s",
                 self.data_source, len(out), named,
                 f", {dup} duplicate rows skipped" if dup else "")
        # A key collision means two different feeds reduce to one join key, so
        # whichever the lineage matches gets an arbitrary business name. Say so
        # rather than letting a wrong label look authoritative.
        keys = {}
        for r in out:
            keys.setdefault(r["src_file_key"], []).append(r["src_file"])
        for k, files in keys.items():
            if len(files) > 1:
                log.warning("legacy_source_file: key %s is shared by %s — the "
                            "dataset name shown for it may be either", k, files)
        return {"source_file": out}

    def load(self, loader, bundle):
        rows = bundle.get("source_file", [])
        for r in rows:
            loader._merge("legacy_source_file", ("src_file",), r)
        loader.commit()
        return len(rows)
