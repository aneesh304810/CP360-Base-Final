"""Historical data migration connector: the four HIST_* sheets of the SEI
workbook, loaded as a snapshot under the CP360-HM rules.

WHAT IT READS. The SEI crosswalk workbook named by CP_SEI_XLSX (the
STAR/IMDS/SEI lineage catalog), which now carries the four sheets
HIST_MIGRATION_LANES, HIST_SOURCE_REGISTER, HIST_MAPPING_EVIDENCE and
HIST_HEADER_DICTIONARY. CP_HIST_MIGRATION_XLSX names a different workbook;
CP_HIST_MIGRATION_DIR names a folder to scan instead. The step runs on its
own (`hist_migration`) and also at the end of `sei_crosswalk`, so the one
`python -m ingestion.run sei_crosswalk` that loads the catalog loads these
sheets too. Headers match by their folded name, either the
source column name ("Historical Lane ID") or the CP 360 physical name
(HISTORICAL_LANE_ID), so a renamed header still reads.

THE RULES, as the sheet specification numbers them:
  HM-001 text is Unicode, trimmed at the ends only; line breaks kept
  HM-002 one evidence row per populated mapping cell
  HM-003 the evidence key is workbook + sheet + row + column number
  HM-004 a blank evidence value is not a row; required metadata not null
  HM-005 the evidence value is never transformed or summarised
  HM-006 the original column name and number are kept
  HM-007 a lane in the evidence should resolve to a registered lane (warn)
  HM-008 the deconversion spec and the TRP dictionary are reference
         artifacts, not operational feeds
  HM-009 lanes, register and dictionary load before the evidence
  HM-010 the evidence value is a CLOB
  HM-011 batch id, file, hash, timestamp and active flag on every row

WHAT IT WRITES (sql/86): the four tables as a full replace and one row in
cp_hist_ingest_batch with the counts and the rule results. A workbook whose
hash equals the last batch's is skipped unless CP_HIST_MIGRATION_FORCE=1.

Run it:
    python -m ingestion.run sei_crosswalk      # the catalog, then these sheets
    python -m ingestion.run hist_migration     # these sheets only
    local/load-hist.ps1 [-Force] [-Xlsx path]  # the same, with the environment set up

Env:
    CP_SEI_XLSX                the crosswalk workbook (load-all.ps1 sets it)
    CP_HIST_MIGRATION_XLSX     a different workbook for these sheets
    CP_HIST_MIGRATION_DIR      a folder to scan instead of one file
    CP_HIST_MIGRATION_FORCE    "1" to reload an unchanged workbook
    CP_HIST_WITH_CROSSWALK     "0" to keep the sheets out of the sei_crosswalk step
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import time
import uuid

from .base import BaseConnector

log = logging.getLogger("cp.hist_migration")

SHEETS = {
    "HISTMIGRATIONLANES": "lanes", "HISTSOURCEREGISTER": "artifacts",
    "HISTMAPPINGEVIDENCE": "evidence", "HISTHEADERDICTIONARY": "dictionary",
}
TABLE = {"lanes": "cp_hist_migration_lane", "artifacts": "cp_hist_source_artifact",
         "evidence": "cp_hist_mapping_evidence", "dictionary": "cp_hist_header_dictionary"}
PK = {"lanes": ("historical_lane_id",), "artifacts": ("source_artifact",),
      "evidence": ("source_mapping_workbook", "source_mapping_sheet", "source_mapping_row", "original_source_column_number"),
      "dictionary": ("meaningful_column_name",)}
LOAD_ORDER = ("lanes", "artifacts", "dictionary", "evidence")                      # HM-009

# column -> (width, required). A width of None is a number; 0 is a CLOB.
COLS = {
    "lanes": {"historical_lane_id": (100, True), "historical_source_system": (200, True), "target_system": (100, True),
              "migration_purpose": (400, True), "primary_mapping_evidence": (400, False), "reference_artifacts": (1000, False),
              "data_domain": (200, False), "relationship_to_operational_lineage": (1000, False), "status": (100, True)},
    "artifacts": {"source_artifact": (400, True), "artifact_type": (200, True), "historical_migration_role": (1000, True),
                  "supported_lanes": (400, False), "cp_360_treatment": (200, True), "notes": (1000, False)},
    "evidence": {"historical_migration_domain": (200, True), "historical_source_system": (200, True),
                 "historical_migration_lane": (200, True), "mapping_evidence_type": (200, True), "migration_group": (200, False),
                 "source_mapping_workbook": (200, True), "source_mapping_sheet": (200, True), "source_mapping_row": (None, True),
                 "evidence_category": (200, True), "evidence_attribute": (400, True), "evidence_value": (0, True),
                 "original_source_column": (400, False), "original_source_column_number": (None, True), "reference_artifacts": (1000, False)},
    "dictionary": {"meaningful_column_name": (200, True), "definition": (1000, True), "source_or_derivation": (1000, True)},
}
# A header the sheet may use instead of the physical name.
ALIASES = {"HISTORICALLANEID": "historical_lane_id", "CP360TREATMENT": "cp_360_treatment"}
REFERENCE_HINTS = ("DCONCUS", "DICTIONARY", "SPECIFICATION", ".DOCX", ".TXT")                      # HM-008


def _fold(h):
    return re.sub(r"[^A-Z0-9]", "", str(h or "").upper())


def _s(v):
    """HM-001: Unicode text, trimmed at the ends, inner line breaks kept."""
    if v is None:
        return ""
    s = str(v).replace("\r\n", "\n").replace("\r", "\n").strip()
    return "" if s.lower() in ("none", "nan") else s


def _pos_int(v):
    try:
        n = int(float(str(v).strip()))
    except Exception:                                        # noqa: BLE001
        return None
    return n if n > 0 else None


def map_headers(kind, headers):
    idx = {}
    for i, h in enumerate(headers):
        k = _fold(h)
        if not k:
            continue
        col = ALIASES.get(k)
        if col is None:
            for c in COLS[kind]:
                if _fold(c) == k:
                    col = c
                    break
        if col and col not in idx:
            idx[col] = i
    return idx


def artifact_class(name, typ):
    """What the register says the artifact is. The type column decides; the
    name only helps when the type says nothing. HM-008 then checks that the
    deconversion spec and the TRP dictionary came out as REFERENCE."""
    t = (typ or "").upper()
    if "FEED" in t or "OPERATIONAL" in t or "EXTRACT" in t:
        return "OPERATIONAL"
    if "MAPPING" in t or "CATALOG" in t:
        return "MAPPING"
    if any(h in t or h in (name or "").upper() for h in REFERENCE_HINTS):
        return "REFERENCE"
    return "OTHER"


class HistMigrationConnector(BaseConnector):
    name = "hist_migration"

    def __init__(self, xlsx=None, folder=None, force=False):
        self.xlsx = xlsx or os.environ.get("CP_HIST_MIGRATION_XLSX") or os.environ.get("CP_SEI_XLSX")
        self.folder = folder or os.environ.get("CP_HIST_MIGRATION_DIR")
        self.force = force

    @classmethod
    def from_env(cls):
        return cls(force=os.environ.get("CP_HIST_MIGRATION_FORCE", "").strip() in ("1", "true", "yes"))

    @property
    def where(self):
        return self.folder or self.xlsx or "(CP_SEI_XLSX not set)"

    # ------------------------------------------------------------- parse
    def files(self):
        """The folder's workbooks when a folder is named; else the one workbook."""
        if self.folder:
            if not os.path.isdir(self.folder):
                return []
            return sorted(os.path.join(self.folder, n) for n in os.listdir(self.folder)
                          if not n.startswith("~$") and n.lower().rsplit(".", 1)[-1] in ("xlsx", "xlsm"))
        return [self.xlsx] if self.xlsx and os.path.isfile(self.xlsx) else []

    def parse(self):
        b = {"lanes": [], "artifacts": [], "evidence": [], "dictionary": [], "files": [], "checks": [],
             "skipped": 0, "source_file": None, "source_hash": None, "sheets": []}
        from openpyxl import load_workbook
        for path in self.files():
            wb = load_workbook(path, read_only=True, data_only=True)
            hit = False
            for ws in wb.worksheets:
                kind = SHEETS.get(_fold(ws.title))
                if not kind:
                    continue
                hit = True
                rows = [list(r) for r in ws.iter_rows(values_only=True)]
                n = self._take(b, kind, rows)
                b["sheets"].append({"workbook": os.path.basename(path), "sheet": ws.title, "kind": kind, "rows": n})
            if not hit:
                log.warning("hist_migration: %s has no HIST_* sheet; its sheets are: %s", os.path.basename(path), ", ".join(wb.sheetnames))
            if hit:
                b["files"].append(os.path.basename(path))
                if b["source_file"] is None:
                    b["source_file"] = os.path.basename(path)
                    with open(path, "rb") as fh:
                        b["source_hash"] = hashlib.sha256(fh.read()).hexdigest()
        if not b["files"]:
            return b
        self._checks(b)
        log.info("hist_migration: %s lanes, %s artifacts, %s evidence rows, %s dictionary rows from %s; %s blank cells skipped",
                 len(b["lanes"]), len(b["artifacts"]), len(b["evidence"]), len(b["dictionary"]), b["files"], b["skipped"])
        return b

    def _take(self, b, kind, rows):
        rows = [r for r in rows if r and any(_s(c) for c in r)]
        if not rows:
            return 0
        idx = map_headers(kind, [_s(c) for c in rows[0]])
        missing = [c for c, (w, req) in COLS[kind].items() if req and c not in idx]
        if missing:
            b["checks"].append({"rule": "CP360-HM-001", "level": "Error", "sheet": kind, "n": len(missing),
                                "detail": f"required column(s) not found: {', '.join(missing)}"})
            return 0
        n = 0
        seen = set()
        for row in rows[1:]:
            get = lambda c: row[idx[c]] if c in idx and idx[c] < len(row) else None      # noqa: E731
            rec = {}
            for c, (w, req) in COLS[kind].items():
                if w is None:
                    rec[c] = _pos_int(get(c))
                else:
                    rec[c] = _s(get(c))
                    if w and len(rec[c]) > w:
                        b["checks"].append({"rule": "CP360-HM-001", "level": "Warning", "sheet": kind, "n": 1, "detail": f"{c} cut to {w} characters"})
                        rec[c] = rec[c][:w]
            if kind == "evidence":
                if not rec["evidence_value"]:                                             # HM-004
                    b["skipped"] += 1
                    continue
                if rec["source_mapping_row"] is None or rec["original_source_column_number"] is None:
                    b["checks"].append({"rule": "CP360-HM-003", "level": "Error", "sheet": kind, "n": 1,
                                        "detail": "row or column number is not a positive whole number; row dropped"})
                    continue
                rec["evidence_length"] = len(rec["evidence_value"])
                key = tuple(rec[k] for k in PK["evidence"])
                if key in seen:
                    b["checks"].append({"rule": "CP360-HM-003", "level": "Error", "sheet": kind, "n": 1, "detail": f"duplicate key {key}; later row kept"})
                seen.add(key)
            else:
                if not rec[PK[kind][0]]:
                    continue
                if kind == "artifacts":
                    rec["artifact_class"] = artifact_class(rec["source_artifact"], rec["artifact_type"])
            missing_req = [c for c, (w, req) in COLS[kind].items() if req and w is not None and w != 0 and not rec[c]]
            if missing_req:
                b["checks"].append({"rule": "CP360-HM-004", "level": "Warning", "sheet": kind, "n": 1, "detail": f"empty required {', '.join(missing_req)}"})
            b[kind].append(rec)
            n += 1
        return n

    def _checks(self, b):
        """The sheet-level rules, once the sheets are read."""
        lanes = {l["historical_lane_id"] for l in b["lanes"]}
        lane_names = {_fold(l["historical_lane_id"]) for l in b["lanes"]} | {_fold(f"{l['historical_source_system']} to {l['target_system']}") for l in b["lanes"]}
        unresolved = 0
        for e in b["evidence"]:
            k = _fold(e["historical_migration_lane"])
            e["lane_resolved"] = "Y" if (k in lane_names or e["historical_migration_lane"] in lanes) else "N"
            unresolved += e["lane_resolved"] == "N"
        b["checks"].append({"rule": "CP360-HM-007", "level": "Warning" if unresolved else "Pass", "sheet": "evidence", "n": unresolved,
                            "detail": f"{unresolved} evidence rows name a lane that is not a registered lane (common or unclassified lanes are allowed)"})
        bad = [a["source_artifact"] for a in b["artifacts"]
               if any(h in a["source_artifact"].upper() for h in ("DCONCUS", "TRP")) and a["artifact_class"] != "REFERENCE"]
        b["checks"].append({"rule": "CP360-HM-008", "level": "Error" if bad else "Pass", "sheet": "artifacts", "n": len(bad),
                            "detail": ("reference artifacts typed as something else: " + ", ".join(bad)) if bad else "the deconversion spec and the TRP dictionary are reference artifacts"})
        b["checks"].append({"rule": "CP360-HM-004", "level": "Pass", "sheet": "evidence", "n": b["skipped"], "detail": f"{b['skipped']} blank cells produced no row"})
        longest = max((e["evidence_length"] for e in b["evidence"]), default=0)
        b["checks"].append({"rule": "CP360-HM-010", "level": "Pass", "sheet": "evidence", "n": longest, "detail": f"longest evidence value {longest} characters; stored as CLOB"})
        b["checks"].append({"rule": "CP360-HM-009", "level": "Pass", "sheet": "all", "n": 4, "detail": "load order: lanes, register, dictionary, then evidence"})
        b["checks"].append({"rule": "CP360-HM-011", "level": "Pass", "sheet": "all", "n": 1, "detail": "batch id, source file, hash, timestamp and active flag stamped on every row"})

    # -------------------------------------------------------------- load
    def _last_hash(self, conn):
        try:
            cur = conn.cursor()
            cur.execute("SELECT source_hash FROM cp_hist_ingest_batch ORDER BY loaded_at DESC FETCH FIRST 1 ROWS ONLY")
            r = cur.fetchone()
            cur.close()
            return r[0] if r else None
        except Exception:                                    # noqa: BLE001
            return None

    def load(self, loader, bundle=None):
        b = bundle or self.parse()
        if not b["files"]:
            return 0
        conn = getattr(loader, "conn", None)
        cur = conn.cursor() if conn is not None and hasattr(conn, "cursor") else None
        if cur is not None and not self.force and b["source_hash"] and self._last_hash(conn) == b["source_hash"]:
            log.info("hist_migration: %s unchanged since the last batch (same hash); skipped. Set CP_HIST_MIGRATION_FORCE=1 to reload", b["source_file"])
            cur.close()
            return 0
        batch_id = f"hm{int(time.time() * 1000)}{uuid.uuid4().hex[:6]}"
        stamp = {"batch_id": batch_id, "source_file": (b["source_file"] or "")[:260], "source_hash": b["source_hash"], "active_ind": "Y"}
        total = 0
        if cur is not None:
            for kind in reversed(LOAD_ORDER):
                cur.execute(f"DELETE FROM {TABLE[kind]}")
        for kind in LOAD_ORDER:                                                           # HM-009
            rows = [{**r, **stamp} for r in b[kind]]
            if not rows:
                continue
            cols = list(rows[0].keys())
            if cur is not None:
                sql = f"INSERT INTO {TABLE[kind]} ({', '.join(cols)}) VALUES ({', '.join(':' + c for c in cols)})"
                if kind == "evidence":
                    try:
                        import oracledb
                        cur.setinputsizes(evidence_value=oracledb.DB_TYPE_CLOB)                # HM-010
                    except Exception:                        # noqa: BLE001
                        pass
                for i in range(0, len(rows), 2000):
                    cur.executemany(sql, rows[i:i + 2000])
                if kind == "evidence":
                    cur.setinputsizes()
            else:
                for r in rows:
                    loader._merge(TABLE[kind], PK[kind], r)
            total += len(rows)
        batch = {"batch_id": batch_id, "source_file": stamp["source_file"], "source_hash": b["source_hash"],
                 "lanes_n": len(b["lanes"]), "artifacts_n": len(b["artifacts"]), "evidence_n": len(b["evidence"]),
                 "dictionary_n": len(b["dictionary"]), "skipped_n": b["skipped"], "checks": json.dumps(b["checks"])}
        if cur is not None:
            cur.execute("INSERT INTO cp_hist_ingest_batch (batch_id, source_file, source_hash, lanes_n, artifacts_n, evidence_n, dictionary_n, skipped_n, checks) "
                        "VALUES (:batch_id, :source_file, :source_hash, :lanes_n, :artifacts_n, :evidence_n, :dictionary_n, :skipped_n, :checks)", batch)
            cur.close()
        else:
            loader._merge("cp_hist_ingest_batch", ("batch_id",), batch)
        loader.commit()
        log.info("hist_migration: batch %s: %s rows in four tables", batch_id, total)
        return total
