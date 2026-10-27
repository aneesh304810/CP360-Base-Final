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
    # the v12 workbook (sql/87)
    "FINALHISTMIGRATIONLINEAGE": "lineage", "DECONSOURCEDICTIONARY": "decon",
    "HISTMIGRATIONRULE": "rules", "TARGETFIELDQC": "qc", "MANIFEST": "manifest",
}
TABLE = {"lanes": "cp_hist_migration_lane", "artifacts": "cp_hist_source_artifact",
         "evidence": "cp_hist_mapping_evidence", "dictionary": "cp_hist_header_dictionary",
         "lineage": "cp_hist_lineage", "decon": "cp_hist_decon_dictionary", "rules": "cp_hist_rule",
         "qc": "cp_hist_target_qc", "manifest": "cp_hist_manifest"}
PK = {"lanes": ("historical_lane_id",), "artifacts": ("source_artifact",),
      "evidence": ("source_mapping_workbook", "source_mapping_sheet", "source_mapping_row", "original_source_column_number"),
      "dictionary": ("meaningful_column_name",),
      "lineage": ("lineage_id",), "decon": ("technical_object",), "rules": ("rule_id",), "qc": ("qc_id",), "manifest": ("manifest_key",)}
# HM-009, then the recommended order for the lineage package: lanes, register,
# decon dictionary, rules, the final lineage, QC; the evidence last because
# it is the big one and nothing else waits on it.
LOAD_ORDER = ("lanes", "artifacts", "dictionary", "manifest", "decon", "rules", "lineage", "qc", "evidence")
CLOBS = {"evidence": ("evidence_value",), "lineage": ("transformation_rule", "validation_rule"),
         "rules": ("transformation_rule", "validation_rule"), "qc": ("row_json",)}
LANE_OF = (("UAF", "UAF_SEI_HIST"), ("ADDVANTAGE", "ADDVANTAGE_SEI_HIST"), ("ADVANTAGE", "ADDVANTAGE_SEI_HIST"), ("PB", "ADDVANTAGE_SEI_HIST"),
           ("STAR", "STAR_SEI_HIST"), ("IM", "STAR_SEI_HIST"))
DECON_STATUS = ("CURATED", "REVIEW_REQUIRED", "PARTIAL_REVIEW_REQUIRED", "NO_TECHNICAL_OBJECT")

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
    "lineage": {"lineage_id": (200, True), "catalog_id": (200, False), "functional_group": (200, False), "source_path": (400, False),
                "source_system": (200, False), "source_object_field": (2000, False), "decon_dictionary_meaning": (4000, False),
                "decon_business_domain": (200, False), "decon_dictionary_status": (400, False), "source_dependencies": (4000, False),
                "transformation_rule_source": (400, False), "transformation_rule": (0, False), "rule_status": (100, False),
                "target_system": (100, False), "target_dat_file": (200, True), "target_field": (200, True), "target_field_source_column": (400, False),
                "target_data_type": (60, False), "target_max_length": (30, False), "target_decimal_pos": (30, False), "mandatory": (4000, False),
                "validation_rule": (0, False), "source_workbook": (400, False), "source_sheet": (200, False), "source_row": (None, False),
                "common_target_key": (500, False), "common_target_indicator": (40, False), "match_method": (60, False), "match_status": (30, False),
                "approval_status": (60, False)},
    "decon": {"technical_object": (400, True), "source_prefix": (100, False), "business_meaning": (4000, False), "source_type": (200, False),
              "business_domain": (200, False), "migration_function": (400, False), "definition_basis": (100, False),
              "dictionary_status": (40, False), "lineage_usage_count": (None, False), "example_target_fields": (2000, False)},
    "rules": {"rule_id": (200, True), "catalog_id": (200, False), "functional_group": (200, False), "sei_target_file": (200, False),
              "sei_target_field": (200, False), "rule_source_column": (400, False), "rule_type": (100, False), "transformation_rule": (0, False),
              "validation_rule": (0, False), "mapping_status": (100, False), "source_objects_fields": (4000, False), "source_workbook": (400, False),
              "source_sheet": (200, False), "evidence_locator": (1000, False), "approval_status": (60, False)},
    "qc": {}, "manifest": {},
}
# A header the sheet may use instead of the physical name.
ALIASES = {"HISTORICALLANEID": "historical_lane_id", "CP360TREATMENT": "cp_360_treatment",
           "LINEAGEMATCHSTATUS": "match_status", "DICTIONARYSTATUS": "dictionary_status", "DECONSTATUS": "decon_dictionary_status",
           "SOURCEOBJECTSFIELDS": "source_objects_fields", "SOURCEOBJECTFIELD": "source_object_field", "SEITARGETFILE": "sei_target_file",
           "TARGETFILE": "target_dat_file", "DATFILE": "target_dat_file"}
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


def norm_field(f):
    """The crosswalk's own normalisation (lane_lineage_conn._norm_code), so a
    historical target field and sei_input_lineage.sei_field_norm compare."""
    if not f:
        return ""
    c = re.sub(r"[\s/.\-]+", "_", str(f).strip())
    c = re.sub(r"_{2,}", "_", c).strip("_").upper()
    return re.sub(r"_L(\d+)", r"_\1", c)


def lane_of(source_system, source_path, lanes):
    """Which registered lane a lineage row belongs to, from its source system
    or path. PB and IM/UAF sources that reach the same SEI field stay on
    their own lanes; COMMON only when the row itself says so."""
    s = f"{source_path or ''} {source_system or ''}".upper()
    if "COMMON" in s:
        return "COMMON"
    for hint, lane in LANE_OF:
        if re.search(rf"(^|[^A-Z]){hint}([^A-Z]|$)", s):
            return lane
    return "UNCLASSIFIED"


def decon_status(text):
    """The governed value. The sheet's words vary; the four values do not."""
    t = str(text or "").strip().upper().replace(" ", "_").replace("-", "_")
    if not t:
        return None
    for v in DECON_STATUS:
        if v in t:
            return v
    if "NO_TECH" in t or "NO_OBJECT" in t or "NOT_FOUND" in t:
        return "NO_TECHNICAL_OBJECT"
    if "PARTIAL" in t:
        return "PARTIAL_REVIEW_REQUIRED"
    if "REVIEW" in t or "DERIVED" in t:
        return "REVIEW_REQUIRED"
    if "CURATED" in t or "APPROVED" in t:
        return "CURATED"
    return "REVIEW_REQUIRED"


def basis_class(text):
    t = str(text or "").upper()
    if "CURATED" in t:
        return "CURATED"
    if "NAME" in t or "DERIVED" in t or "INFERRED" in t:
        return "NAME_DERIVED"
    return "UNKNOWN" if not t else "OTHER"


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
        b = {"lanes": [], "artifacts": [], "evidence": [], "dictionary": [], "lineage": [], "decon": [], "rules": [], "qc": [], "manifest": [],
             "files": [], "checks": [], "skipped": 0, "source_file": None, "source_hash": None, "sheets": []}
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
        log.info("hist_migration: %s lanes, %s artifacts, %s evidence rows, %s dictionary rows, %s lineage rows, %s decon objects, %s rules, %s QC rows from %s; %s blank cells skipped",
                 len(b["lanes"]), len(b["artifacts"]), len(b["evidence"]), len(b["dictionary"]), len(b["lineage"]), len(b["decon"]), len(b["rules"]), len(b["qc"]), b["files"], b["skipped"])
        return b

    def _take_generic(self, b, kind, rows):
        """TARGET_FIELD_QC and _MANIFEST: the sheet's columns are its own.
        QC rows keep every cell as JSON and the usual names where they can
        be recognised; the manifest is key and value, first two columns."""
        headers = [_s(c) for c in rows[0]]
        n = 0
        if kind == "manifest":
            for row in rows[1:]:
                cells = [_s(c) for c in row]
                if not cells or not cells[0]:
                    continue
                b["manifest"].append({"manifest_key": cells[0][:200], "manifest_value": (" · ".join(c for c in cells[1:] if c))[:4000]})
                n += 1
            return n
        hint = lambda *ws: next((i for i, h in enumerate(headers) if any(w in _fold(h) for w in ws)), None)   # noqa: E731
        ci = {"id": hint("QCID", "CONTROLID", "CHECKID", "RULEID"), "name": hint("CONTROL", "CHECK", "RULE", "TEST"),
              "applies": hint("APPLIES", "SCOPE", "TARGET", "FIELD"), "expected": hint("EXPECTED"), "actual": hint("ACTUAL", "OBSERVED", "COUNT"),
              "result": hint("RESULT", "STATUS", "OUTCOME", "PASS"), "detail": hint("DETAIL", "DESCRIPTION", "NOTE", "COMMENT")}
        for k, row in enumerate(rows[1:], start=2):
            cells = [_s(c) for c in row]
            if not any(cells):
                continue
            g = lambda key: (cells[ci[key]] if ci[key] is not None and ci[key] < len(cells) else "")   # noqa: E731
            rec = {"qc_id": (g("id") or f"QC-{k:04d}")[:200], "control_name": (g("name") or cells[0])[:400], "applies_to": g("applies")[:400],
                   "expected": g("expected")[:1000], "actual": g("actual")[:1000], "result": g("result")[:60], "detail": g("detail")[:4000],
                   "row_json": json.dumps({h: c for h, c in zip(headers, cells) if h}, ensure_ascii=False)}
            b["qc"].append(rec)
            n += 1
        return n

    def _take(self, b, kind, rows):
        rows = [r for r in rows if r and any(_s(c) for c in r)]
        if not rows:
            return 0
        if kind in ("qc", "manifest"):
            return self._take_generic(b, kind, rows)
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
                elif kind == "lineage":
                    rec["decon_status_text"] = rec["decon_dictionary_status"][:400]
                    rec["decon_dictionary_status"] = decon_status(rec["decon_status_text"])
                    rec["target_field_norm"] = norm_field(rec["target_field"])[:200]
                    rec["target_key"] = f"SEI::{rec['target_dat_file']}::{rec['target_field']}"[:500]
                    rec["recon_key"] = "|".join(str(rec[c] or "") for c in ("source_path", "source_workbook", "source_sheet", "source_row", "target_dat_file", "target_field"))[:1500]
                    rec["match_method"] = rec["match_method"] or "EXACT_NORMALIZED_FIELD_MATCH"
                    rec["match_status"] = (rec["match_status"] or "").upper()[:30] or "NOT_CHECKED"
                    rec["approval_status"] = rec["approval_status"] or ""
                elif kind == "decon":
                    rec["basis_class"] = basis_class(rec["definition_basis"])
                    rec["dictionary_status"] = decon_status(rec["dictionary_status"]) or ("CURATED" if rec["basis_class"] == "CURATED" else "REVIEW_REQUIRED")
                elif kind == "rules":
                    rec["target_key"] = f"SEI::{rec['sei_target_file']}::{rec['sei_target_field']}"[:500] if rec["sei_target_file"] and rec["sei_target_field"] else ""
                    rec["approval_status"] = rec["approval_status"] or ""
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
        b["checks"].append({"rule": "CP360-HM-009", "level": "Pass", "sheet": "all", "n": 4, "detail": "load order: lanes, register, dictionary, manifest, decon dictionary, rules, lineage, QC, then evidence"})
        if b["lineage"]:
            lane_ids = {l["historical_lane_id"] for l in b["lanes"]}
            manifest = {m["manifest_key"].upper(): m["manifest_value"] for m in b["manifest"]}
            default_approval = next((v for k, v in manifest.items() if "APPROVAL" in k), "") or "DRAFT_REVIEW_REQUIRED"
            rules_by_cat, rules_by_key = {}, {}
            for r in b["rules"]:
                if r["catalog_id"]:
                    rules_by_cat.setdefault(r["catalog_id"], []).append(r["rule_id"])
                if r["target_key"]:
                    rules_by_key.setdefault(r["target_key"], []).append(r["rule_id"])
                r["approval_status"] = r["approval_status"] or default_approval
            blank_target = sum(1 for r in b["lineage"] if not r["target_field"] or not r["target_dat_file"])
            unlaned, no_rule, by_key = 0, 0, {}
            for r in b["lineage"]:
                r["lane_id"] = lane_of(r["source_system"], r["source_path"], lane_ids)
                unlaned += r["lane_id"] in ("UNCLASSIFIED",)
                r["approval_status"] = r["approval_status"] or default_approval
                if not (rules_by_cat.get(r["catalog_id"]) or rules_by_key.get(r["target_key"])):
                    no_rule += 1
                by_key.setdefault(r["target_key"], set()).add(r["lane_id"])
            shared = sum(1 for k, v in by_key.items() if len(v) > 1)
            b["checks"].append({"rule": "CP360-HL-001", "level": "Error" if blank_target else "Pass", "sheet": "lineage", "n": blank_target,
                                "detail": f"{blank_target} lineage rows with a blank TARGET_DAT_FILE or TARGET_FIELD (the workbook records zero)"})
            b["checks"].append({"rule": "CP360-HL-002", "level": "Warning" if unlaned else "Pass", "sheet": "lineage", "n": unlaned,
                                "detail": f"{unlaned} lineage rows whose source system or path resolves to no registered lane"})
            b["checks"].append({"rule": "CP360-HL-003", "level": "Warning" if no_rule else "Pass", "sheet": "lineage", "n": no_rule,
                                "detail": f"{no_rule} lineage rows with no HIST_MIGRATION_RULE on their catalog id or target field"})
            b["checks"].append({"rule": "CP360-HL-004", "level": "Pass", "sheet": "lineage", "n": shared,
                                "detail": f"{shared} SEI target fields reached from more than one lane; kept as separate lineage rows, never merged (PB and IM/UAF stay apart)"})
            ungoverned = sum(1 for r in b["lineage"] if r["decon_status_text"] and r["decon_dictionary_status"] not in DECON_STATUS)
            b["checks"].append({"rule": "CP360-HL-005", "level": "Pass", "sheet": "lineage", "n": ungoverned,
                                "detail": "DECON_DICTIONARY_STATUS is governed: CURATED, REVIEW_REQUIRED, PARTIAL_REVIEW_REQUIRED or NO_TECHNICAL_OBJECT"})
            derived = sum(1 for d in b["decon"] if d["basis_class"] == "NAME_DERIVED")
            b["checks"].append({"rule": "CP360-HL-006", "level": "Pass", "sheet": "decon", "n": derived,
                                "detail": f"{derived} of {len(b['decon'])} decon dictionary meanings are derived from the name, not curated; they are marked, never promoted"})
            b["checks"].append({"rule": "CP360-HL-007", "level": "Pass", "sheet": "lineage", "n": len(b["lineage"]),
                                "detail": f"RULE_STATUS, APPROVAL_STATUS ({default_approval} by default), DECON_DICTIONARY_STATUS and MATCH_STATUS are kept independent"})
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

    def _match(self, cur, b):
        """EXACT_NORMALIZED_FIELD_MATCH against the operational SEI input
        lineage already in the warehouse: a historical target field matches
        when its normalised name and dat file are a sei_input_lineage row.
        The workbook's own verdict, when it carries one, is kept; this fills
        the rows that have none."""
        try:
            cur.execute("SELECT DISTINCT UPPER(sei_target_file), sei_field_norm FROM sei_input_lineage WHERE sei_field_norm IS NOT NULL")
            have = {(f or "", n or "") for f, n in cur.fetchall()}
        except Exception as e:                               # noqa: BLE001
            log.warning("hist_migration: sei_input_lineage not readable (%s); match_status stays NOT_CHECKED", str(e)[:80])
            return
        norms = {n for _, n in have}
        matched = unmatched = 0
        for r in b["lineage"]:
            if r["match_status"] not in ("", "NOT_CHECKED"):
                continue
            k = (r["target_dat_file"].upper(), r["target_field_norm"])
            r["match_status"] = "MATCHED" if (k in have or r["target_field_norm"] in norms) else "UNMATCHED"
            matched += r["match_status"] == "MATCHED"
            unmatched += r["match_status"] == "UNMATCHED"
        b["checks"].append({"rule": "CP360-HL-008", "level": "Warning" if unmatched else "Pass", "sheet": "lineage", "n": unmatched,
                            "detail": f"{matched} target fields match the operational SEI input lineage by exact normalised name; {unmatched} do not and are flagged for review"})

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
        if cur is not None and b["lineage"]:
            self._match(cur, b)
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
                if kind in CLOBS:
                    try:
                        import oracledb
                        cur.setinputsizes(**{c: oracledb.DB_TYPE_CLOB for c in CLOBS[kind]})   # HM-010
                    except Exception:                        # noqa: BLE001
                        pass
                for i in range(0, len(rows), 2000):
                    cur.executemany(sql, rows[i:i + 2000])
                if kind in CLOBS:
                    cur.setinputsizes()
            else:
                for r in rows:
                    loader._merge(TABLE[kind], PK[kind], r)
            total += len(rows)
        batch = {"batch_id": batch_id, "source_file": stamp["source_file"], "source_hash": b["source_hash"],
                 "lanes_n": len(b["lanes"]), "artifacts_n": len(b["artifacts"]), "evidence_n": len(b["evidence"]),
                 "dictionary_n": len(b["dictionary"]), "skipped_n": b["skipped"], "checks": json.dumps(b["checks"]),
                 "lineage_n": len(b["lineage"]), "decon_n": len(b["decon"]), "rules_n": len(b["rules"]), "qc_n": len(b["qc"])}
        if cur is not None:
            cur.execute("INSERT INTO cp_hist_ingest_batch (batch_id, source_file, source_hash, lanes_n, artifacts_n, evidence_n, dictionary_n, skipped_n, checks, lineage_n, decon_n, rules_n, qc_n) "
                        "VALUES (:batch_id, :source_file, :source_hash, :lanes_n, :artifacts_n, :evidence_n, :dictionary_n, :skipped_n, :checks, :lineage_n, :decon_n, :rules_n, :qc_n)", batch)
            cur.close()
        else:
            loader._merge("cp_hist_ingest_batch", ("batch_id",), batch)
        loader.commit()
        log.info("hist_migration: batch %s: %s rows in four tables", batch_id, total)
        return total
