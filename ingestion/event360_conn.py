"""Event 360 — the SEI event specification workbook, as tables.

Eight sheets; seven are ingested (Extraction_Status is not). The contract:

    Event_Catalog         105 rows  -> meta_event_definition
    Field_Level_Details   575 rows  -> meta_event_field
    Event_Types             3 rows  -> ref_event_type
    Event_Domains           5 rows  -> ref_event_domain
    Payload_Structure       6 rows  -> ref_envelope_field
    Consumption_Guidance    6 rows  -> ref_consumption_rule

Every sheet is a real Excel Table with its header in row 1, so a headered read
works with no offset handling.

THE GATES REFUSE, THEY DO NOT WARN
----------------------------------
A specification load that is 4 rows short is worse than one that fails: the
screens built on it look right and quietly under-report. So the counts, the
key resolution, the envelope shape and the trigger arithmetic are checked
BEFORE anything is written, and a failure raises. `strict=False` downgrades
that to logging, for the one legitimate case of inspecting a workbook that is
known to be mid-revision.

WHAT IS DELIBERATELY NOT CLEANED
--------------------------------
* 'NOT_SPECIFIED' in data type / length / nullable is the FACT, not a gap.
  The specification never states payload field types. Anything that "fills
  these in later" is inventing a contract.
* Typos are verbatim: IDENTTIFIERS, insterest, Acount_ISA_Detail,
  INSTRUMENT_GLOBA. A typo in a contract may be the real object name.
* Event IDs 99-101 do not exist. No placeholder rows are generated.

Env:
    CP_EVENT360_XLSX     the workbook, or the folder holding it.
                         Default: sample-artifacts/EVENT-360/
    CP_EVENT360_STRICT   '0' to downgrade gate failures to warnings
"""
from __future__ import annotations
import json
import logging
import os
import re
from collections import Counter

from openpyxl import load_workbook

log = logging.getLogger("cp.event360")

# Sheet name -> how we find it. Matched loosely because sheet names are typed
# by hand, but never so loosely that two sheets can claim the same slot.
_SHEETS = {
    "catalog":    ("event_catalog", "eventcatalog"),
    "fields":     ("field_level_details", "fieldleveldetails", "fielddetails"),
    "types":      ("event_types", "eventtypes"),
    "domains":    ("event_domains", "eventdomains"),
    "envelope":   ("payload_structure", "payloadstructure"),
    "guidance":   ("consumption_guidance", "consumptionguidance"),
}

# Expected shape, asserted after parse. From the contract, not from the file.
EXPECT_EVENTS = 105
EXPECT_FIELDS = 575
EXPECT_MARKER_PAYLOAD = 3        # eventId, batchDt, onlineDt
EXPECT_DATA_PAYLOAD = 4          # eventId, key, op, view
MISSING_IDS = (99, 100, 101)     # absent from the index by design

MARKER = "Marker"

# The sheet writes "Not applicable" in the view / key / operation columns of a
# marker event. That is the spec saying "this does not apply to markers", not a
# view called Not applicable. Branch on event type, and use this only as the
# corroborating check.
_NOT_APPLICABLE = re.compile(r"^\s*not\s*applicable\b", re.I)

# Column A..T of Event_Catalog -> column name. Header text is matched after
# normalisation, so "Event ID", "Event Id" and "event_id" all land.
CATALOG_MAP = {
    "eventid": "event_id",
    "eventname": "event_name",
    "eventtype": "event_type",
    "domain": "domain",
    "section": "section",
    "page": "page",
    "sdcview": "sdc_view",
    "payloadkey": "payload_key",
    "operationcodes": "operation_codes",
    "description": "description",
    "samplepayload": "sample_payload",
    "triggerdrivingtablesandcolumns": "trigger_tables_columns",
    "triggercondition": "trigger_condition",
    "consumerguidance": "consumer_guidance",
    "detailextractionstatus": "detail_extraction_status",
    "payloadfieldlist": "payload_field_list",
    "compositekeyparts": "composite_key_parts",
    "triggercolumncount": "trigger_column_count",
    "sourcepagereference": "source_page_reference",
    "fieldlevelextractionstatus": "field_extraction_status",
}

FIELD_MAP = {
    "section": "section",
    "sourcepage": "source_page",
    "eventid": "event_id",
    "eventname": "event_name",
    "fieldcategory": "field_category",
    "fieldordinal": "field_ordinal",
    "fieldname": "field_name",
    "description": "description",
    "datatype": "data_type",
    "lengthprecision": "length_precision",
    "nullable": "nullable",
    "iskey": "is_key",
    "sourcetable": "source_table",
    "sourcecolumn": "source_column",
    "samplevalue": "sample_value",
    "extractionstatus": "extraction_status",
}


class Event360LoadError(Exception):
    """A gate failed. Nothing has been written."""


def _norm(s) -> str:
    return re.sub(r"[^a-z0-9]", "", str(s or "").lower())


def _s(v):
    """Cell -> trimmed string or None. Never str(None)."""
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _i(v):
    """Cell -> int or None. Excel hands back 1.0 for an integer cell."""
    s = _s(v)
    if s is None:
        return None
    try:
        return int(float(s))
    except (TypeError, ValueError):
        return None


def split_lines(v):
    """Column L and Q: newline-delimited. Split, trim, drop blanks.

    Excel writes CHAR(10) inside a cell, but a workbook that has been through
    a Windows round trip can carry CHAR(13)CHAR(10), and one hand-edited cell
    in the source used a semicolon. All three split; nothing else does, because
    a comma is legitimate inside a trigger condition.
    """
    if v is None:
        return []
    return [p.strip() for p in re.split(r"[\r\n;]+", str(v)) if p.strip()]


def split_pipe(v):
    """Column H: pipe-delimited WITH surrounding spaces — 'A | B'."""
    if v is None:
        return []
    return [p.strip() for p in str(v).split("|") if p.strip()]


def split_commas(v):
    """Column P: the payload field list, 'eventId, key, op, view'."""
    if v is None:
        return []
    return [p.strip() for p in re.split(r"[,\s]+", str(v)) if p.strip()]


def parse_payload(v):
    """Column K is JSON-as-text with embedded newlines. PARSE it.

    A regex over this is how "view": "NULL" on event 92 gets read as a view
    named NULL. Returns (obj, error) — the error is kept rather than raised,
    because a malformed sample is a fact about the spec worth reporting, not a
    reason to abandon 104 good rows.
    """
    s = _s(v)
    if not s:
        return None, None
    try:
        return json.loads(s), None
    except Exception as exc:                                  # noqa: BLE001
        return None, f"{type(exc).__name__}: {exc}"


class Event360Connector:
    name = "event360"

    def __init__(self, xlsx_path, strict=True):
        self.xlsx_path = xlsx_path
        self.strict = strict
        self.gate_failures: list[str] = []
        self.notes: list[str] = []

    # sample-artifacts/<UPPER-KEBAB>/ is the house convention — LEGACY-LINEAGE,
    # FEED-CATALOG, API-SPEC. The default is the FOLDER, not a filename, so the
    # workbook can be dropped in under whatever name it arrives with.
    DEFAULT_DIR = "sample-artifacts/EVENT-360"

    @classmethod
    def from_env(cls):
        return cls(
            os.environ.get("CP_EVENT360_XLSX", cls.DEFAULT_DIR),
            os.environ.get("CP_EVENT360_STRICT", "1").strip().lower()
            not in ("0", "false", "no"),
        )

    def _resolve(self):
        """A file path is used as given; a folder is searched for one workbook.

        Exactly one .xlsx is taken, and the choice is logged. TWO is refused
        rather than guessed — picking the alphabetically-first of an old and a
        new revision, silently, is the kind of thing nobody notices until the
        counts are wrong.
        """
        p = self.xlsx_path
        if os.path.isfile(p):
            return p
        if not os.path.isdir(p):
            return p                       # let the caller report it missing
        books = sorted(f for f in os.listdir(p)
                       if f.lower().endswith((".xlsx", ".xlsm"))
                       and not f.startswith("~$"))    # skip Excel lock files
        if not books:
            return None
        if len(books) > 1:
            self.gate_failures.append(
                f"{p} holds {len(books)} workbooks — {books}. "
                f"Set CP_EVENT360_XLSX to the one to load.")
            return None
        chosen = os.path.join(p, books[0])
        log.info("event360: using %s", chosen)
        return chosen

    # ---- sheet plumbing --------------------------------------------------
    def _pick(self, wb, slot):
        want = _SHEETS[slot]
        by = {_norm(s): s for s in wb.sheetnames}
        for w in want:
            if _norm(w) in by:
                return by[_norm(w)]
        for n, real in by.items():
            if any(n.startswith(_norm(w)) for w in want):
                return real
        return None

    def _rows(self, ws, colmap):
        """Header-driven read. Unknown headers are ignored rather than
        positional-guessed: a column inserted into the sheet must not silently
        shift every value one to the left."""
        head = []
        for r in ws.iter_rows(min_row=1, max_row=1, values_only=True):
            head = [_norm(c) for c in r]
            break
        idx = {}
        for i, h in enumerate(head):
            if h in colmap and colmap[h] not in idx:
                idx[colmap[h]] = i
        missing = [c for c in colmap.values() if c not in idx]
        if missing:
            self.notes.append(f"{ws.title}: columns not found — {missing}")
        out = []
        for row in ws.iter_rows(min_row=2, values_only=True):
            if not any(c is not None and str(c).strip() for c in row):
                continue
            out.append({k: (row[i] if i < len(row) else None)
                        for k, i in idx.items()})
        return out

    # ---- parse -----------------------------------------------------------
    def parse(self):
        path = self._resolve()
        if self.gate_failures:             # ambiguous folder; say so and stop
            self._finish()
            return {}
        if not path or not os.path.exists(path):
            log.warning("event360 workbook not found at %s — put the .xlsx in "
                        "%s/ or set CP_EVENT360_XLSX (skipping)",
                        self.xlsx_path, self.DEFAULT_DIR)
            return {}
        wb = load_workbook(path, data_only=True, read_only=True)
        got = {k: self._pick(wb, k) for k in _SHEETS}
        for k, v in got.items():
            if not v:
                self.gate_failures.append(f"sheet not found: {k}")
        if self.gate_failures:
            self._finish()
            return {}

        types = self._parse_ref(wb[got["types"]],
                                ("eventtype", "description", "events"),
                                ("event_type", "description", "event_count"))
        domains = self._parse_ref(wb[got["domains"]],
                                  ("domain", "coverage", "events"),
                                  ("domain", "coverage", "event_count"))
        envelope = self._parse_ref(
            wb[got["envelope"]],
            ("field", "description", "type", "length", "mandatory"),
            ("field", "description", "data_type", "length_precision",
             "mandatory"))
        guidance = self._parse_ref(wb[got["guidance"]],
                                   ("number", "guidance"),
                                   ("rule_no", "rule_text"))

        events = self._parse_catalog(wb[got["catalog"]])
        fields = self._parse_fields(wb[got["fields"]])

        self._gates(events, fields, types, domains, envelope, guidance)
        self._finish()
        return {"event_type": types, "event_domain": domains,
                "envelope_field": envelope, "consumption_rule": guidance,
                "event_definition": events, "event_field": fields}

    def _parse_ref(self, ws, headers, cols):
        rows = self._rows(ws, dict(zip((_norm(h) for h in headers), cols)))
        out = []
        for r in rows:
            rec = {}
            for c in cols:
                v = r.get(c)
                rec[c] = _i(v) if c in ("event_count", "rule_no") else _s(v)
            if any(rec.values()):
                out.append(rec)
        return out

    def _parse_catalog(self, ws):
        out = []
        for r in self._rows(ws, CATALOG_MAP):
            eid = _i(r.get("event_id"))
            if eid is None:
                continue
            is_marker = (_s(r.get("event_type")) or "").lower() == MARKER.lower()

            # "Not applicable" is the spec declining to answer, not a value.
            # It becomes NULL REGARDLESS of event type, so nothing downstream
            # can ever join a view literally named "Not applicable".
            #
            # Whether it is EXPECTED is the separate question: for a marker it
            # is the contract, for a data event it is a contradiction worth
            # flagging. The first version of this only nulled it for markers,
            # which meant the one row the spec calls out — event 92 — kept the
            # literal string AND escaped the flag, failing at both jobs.
            def na_aware(key):
                v = _s(r.get(key))
                return None if v is None or _NOT_APPLICABLE.match(v) else v

            def said_na(key):
                v = _s(r.get(key))
                return bool(v) and bool(_NOT_APPLICABLE.match(v))

            trig = split_lines(r.get("trigger_tables_columns"))
            key_parts = split_lines(r.get("composite_key_parts"))
            pipe_parts = split_pipe(r.get("payload_key"))
            payload, perr = parse_payload(r.get("sample_payload"))

            flag = flag_note = None
            # Event 92 is the known instance of a row that contradicts itself:
            # SDC view "Not applicable" while the sample payload carries
            # "view": "NULL". Detected by SHAPE, not hardcoded to id 92 — a
            # second one is caught the same way.
            if not is_marker and said_na("sdc_view"):
                flag, flag_note = ("REVIEW_REQUIRED",
                                   "non-marker event with SDC view "
                                   "'Not applicable'; confirm with SEI")
                if isinstance(payload, dict) and \
                        str(payload.get("view", "")).upper() == "NULL":
                    flag_note += " (its sample payload declares view NULL)"
            elif isinstance(payload, dict) and \
                    str(payload.get("view", "")).upper() == "NULL" \
                    and na_aware("sdc_view") is None:
                flag, flag_note = ("REVIEW_REQUIRED",
                                   "sample payload declares view NULL with no "
                                   "SDC view; confirm with SEI")
            if perr:
                flag = flag or "REVIEW_REQUIRED"
                flag_note = (flag_note or "") + f" sample payload unparseable: {perr}"

            out.append({
                "event_id": eid,
                "event_name": _s(r.get("event_name")),      # verbatim, typos kept
                "event_type": _s(r.get("event_type")),
                "domain": _s(r.get("domain")),
                "section": _s(r.get("section")),
                "page": _i(r.get("page")),
                "sdc_view": na_aware("sdc_view"),
                "payload_key": na_aware("payload_key"),
                "operation_codes": na_aware("operation_codes"),
                "description": _s(r.get("description")),
                "sample_payload": _s(r.get("sample_payload")),
                "trigger_tables_columns": _s(r.get("trigger_tables_columns")),
                "trigger_condition": _s(r.get("trigger_condition")),
                "consumer_guidance": _s(r.get("consumer_guidance")),
                "detail_extraction_status": _s(r.get("detail_extraction_status")),
                "payload_field_list": _s(r.get("payload_field_list")),
                "composite_key_parts": _s(r.get("composite_key_parts")),
                # RECOMPUTED, not trusted. The sheet's column R is a derived
                # value maintained by hand; it is checked against this below.
                "trigger_column_count": len(trig),
                "source_page_reference": _s(r.get("source_page_reference")),
                "field_extraction_status": _s(r.get("field_extraction_status")),
                "load_flag": flag,
                "load_flag_note": (flag_note or "").strip() or None,
                # not columns — carried for the gates, stripped before load
                "_trigger": trig, "_key_parts": key_parts,
                "_pipe_parts": pipe_parts, "_is_marker": is_marker,
                "_sheet_trigger_count": _i(r.get("trigger_column_count")),
                "_payload_fields": split_commas(r.get("payload_field_list")),
            })
        return out

    def _parse_fields(self, ws):
        out = []
        for r in self._rows(ws, FIELD_MAP):
            sec, ordn = _s(r.get("section")), _i(r.get("field_ordinal"))
            if sec is None or ordn is None:
                continue
            out.append({
                "section": sec,
                "field_ordinal": ordn,
                "source_page": _i(r.get("source_page")),
                "event_id": _i(r.get("event_id")),
                "event_name": _s(r.get("event_name")),
                "field_category": _s(r.get("field_category")),
                "field_name": _s(r.get("field_name")),
                "description": _s(r.get("description")),
                # NOT_SPECIFIED is the fact. Never defaulted, never inferred.
                "data_type": _s(r.get("data_type")),
                "length_precision": _s(r.get("length_precision")),
                "nullable": _s(r.get("nullable")),
                "is_key": _s(r.get("is_key")),
                "source_table": _s(r.get("source_table")),
                "source_column": _s(r.get("source_column")),
                "sample_value": _s(r.get("sample_value")),
                "extraction_status": _s(r.get("extraction_status")),
            })
        return out

    # ---- gates -----------------------------------------------------------
    def _gates(self, events, fields, types, domains, envelope, guidance):
        fail = self.gate_failures.append
        note = self.notes.append

        if len(events) != EXPECT_EVENTS:
            fail(f"event count {len(events)} <> {EXPECT_EVENTS}")
        if len(fields) != EXPECT_FIELDS:
            fail(f"field count {len(fields)} <> {EXPECT_FIELDS}")

        ids = [e["event_id"] for e in events]
        dupe = [i for i, n in Counter(ids).items() if n > 1]
        if dupe:
            fail(f"duplicate event ids: {sorted(dupe)[:10]}")
        ghost = sorted(set(ids) & set(MISSING_IDS))
        if ghost:
            fail(f"event ids {ghost} should not exist")

        secs = [e["section"] for e in events]
        dupe_s = [s for s, n in Counter(secs).items() if n > 1]
        if dupe_s:
            fail(f"duplicate sections: {sorted(dupe_s)[:10]}")
        # Sections are 4.1 .. 4.105, contiguous, even though ids skip 99-101.
        want = {f"4.{i}" for i in range(1, EXPECT_EVENTS + 1)}
        gap = sorted(want - set(secs), key=lambda s: float(s[2:]))
        if gap:
            fail(f"missing sections: {gap[:10]}"
                 + (f" (+{len(gap) - 10} more)" if len(gap) > 10 else ""))

        known_types = {t["event_type"] for t in types}
        known_doms = {d["domain"] for d in domains}
        bad_t = sorted({e["event_type"] for e in events} - known_types)
        bad_d = sorted({e["domain"] for e in events} - known_doms)
        if bad_t:
            fail(f"event types not in Event_Types: {bad_t}")
        if bad_d:
            fail(f"domains not in Event_Domains: {bad_d}")

        # Column R is hand-maintained. Report every disagreement; the loaded
        # value is the recomputed one either way.
        drift = [(e["event_id"], e["_sheet_trigger_count"],
                  e["trigger_column_count"]) for e in events
                 if e["_sheet_trigger_count"] is not None
                 and e["_sheet_trigger_count"] != e["trigger_column_count"]]
        if drift:
            note(f"trigger column count in the sheet disagrees with the parsed "
                 f"list on {len(drift)} event(s), e.g. {drift[:5]} "
                 f"(id, sheet, parsed) — the parsed value is loaded")

        # H (pipe) and Q (newline) are two spellings of the same key. If they
        # disagree the spec contradicts itself about the payload key.
        keyd = [e["event_id"] for e in events
                if e["_pipe_parts"] and e["_key_parts"]
                and [p.upper() for p in e["_pipe_parts"]]
                != [p.upper() for p in e["_key_parts"]]]
        if keyd:
            note(f"payload key and composite key parts disagree on "
                 f"{len(keyd)} event(s): {keyd[:8]}")

        known_env = {f["field"] for f in envelope}
        stray = sorted({f for e in events for f in e["_payload_fields"]}
                       - known_env)
        if stray:
            fail(f"payload fields not in Payload_Structure: {stray}")

        # Envelope shape per type, from the field sheet — the authority on what
        # was actually loaded, not the catalog's own list.
        by_event = {}
        for f in fields:
            if (f.get("field_category") or "").upper() == "PAYLOAD":
                by_event[f["event_id"]] = by_event.get(f["event_id"], 0) + 1
        wrong = []
        for e in events:
            want_n = EXPECT_MARKER_PAYLOAD if e["_is_marker"] else EXPECT_DATA_PAYLOAD
            got_n = by_event.get(e["event_id"], 0)
            if got_n != want_n:
                wrong.append((e["event_id"], e["event_type"], got_n, want_n))
        if wrong:
            fail(f"{len(wrong)} event(s) have the wrong payload field count, "
                 f"e.g. {wrong[:5]} (id, type, got, want)")

        orphan = sorted({f["event_id"] for f in fields} - set(ids))
        if orphan:
            fail(f"field rows whose event_id has no parent: {orphan[:10]}")

        # The row-count arithmetic the contract states, as an independent check
        # on the same 575.
        markers = sum(1 for e in events if e["_is_marker"])
        data_ev = len(events) - markers
        trig_rows = sum(1 for f in fields
                        if (f.get("field_category") or "").upper() == "TRIGGER_DRIVING")
        expect = (EXPECT_DATA_PAYLOAD * data_ev
                  + EXPECT_MARKER_PAYLOAD * markers + trig_rows)
        if expect != len(fields):
            fail(f"field arithmetic: {EXPECT_DATA_PAYLOAD}x{data_ev} + "
                 f"{EXPECT_MARKER_PAYLOAD}x{markers} + {trig_rows} trigger = "
                 f"{expect}, but {len(fields)} rows were read")

        flagged = [e["event_id"] for e in events if e["load_flag"]]
        if flagged:
            note(f"{len(flagged)} event(s) flagged REVIEW_REQUIRED: {flagged}")

        if len(guidance) != 6:
            note(f"consumption guidance has {len(guidance)} rules, expected 6")

    def _finish(self):
        for n in self.notes:
            log.warning("event360: %s", n)
        if not self.gate_failures:
            return
        msg = "; ".join(self.gate_failures)
        if self.strict:
            raise Event360LoadError(
                "event360 load refused — nothing written. " + msg)
        log.error("event360 gates FAILED (strict off, loading anyway): %s", msg)

    # ---- load ------------------------------------------------------------
    def load(self, loader, bundle):
        if not bundle:
            return 0
        n = 0
        # Reference tables first: the catalog's type and domain resolve against
        # them, and the envelope contract is what the field rows instantiate.
        for r in bundle.get("event_type", []):
            loader._merge("ref_event_type", ("event_type",), r); n += 1
        for r in bundle.get("event_domain", []):
            loader._merge("ref_event_domain", ("domain",), r); n += 1
        for r in bundle.get("envelope_field", []):
            loader._merge("ref_envelope_field", ("field",), r); n += 1
        for r in bundle.get("consumption_rule", []):
            loader._merge("ref_consumption_rule", ("rule_no",), r); n += 1
        for r in bundle.get("event_definition", []):
            loader._merge("meta_event_definition", ("event_id",),
                          {k: v for k, v in r.items() if not k.startswith("_")})
            n += 1
        for r in bundle.get("event_field", []):
            loader._merge("meta_event_field", ("section", "field_ordinal"), r)
            n += 1
        loader.commit()
        log.info("event360: merged %d rows across 6 tables", n)
        return n
