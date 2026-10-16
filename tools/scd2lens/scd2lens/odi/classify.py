"""The load pattern of a table, from the signals the parsers found."""
from __future__ import annotations

from dataclasses import dataclass, field

MERGE_SCD2 = "MERGE_SCD2"
TRUNCATE_APPEND_HIST = "TRUNCATE_APPEND_HIST"
SNAPSHOT = "SNAPSHOT"
SCD1 = "SCD1"
UNKNOWN = "UNKNOWN"
# The column scan says SCD2 but the export cut the writer's code before the
# merge, so the load pattern could not be READ. Distinct from UNKNOWN (no
# writer at all) because the fix is different: re-export, not investigate.
SCD2_UNVERIFIED = "SCD2_UNVERIFIED"


@dataclass
class Signals:
    merge_on_includes_valid_from: bool = False
    merge_found: bool = False
    enddate_proc: bool = False
    truncate: bool = False
    control_append: bool = False
    insert_hist_proc: bool = False
    as_of_grain: bool = False
    delete_insert_by_date: bool = False
    code_truncated: bool = False          # a writer's code was cut by the export before it could be parsed
    notes: list[str] = field(default_factory=list)


def classify(sig: Signals, scan_verdict: str | None = None) -> tuple[str, list[str]]:
    notes = list(sig.notes)
    if sig.merge_on_includes_valid_from and sig.enddate_proc:
        pattern = MERGE_SCD2
    elif sig.truncate and sig.control_append and sig.insert_hist_proc:
        pattern = TRUNCATE_APPEND_HIST
    elif sig.as_of_grain and sig.delete_insert_by_date:
        pattern = SNAPSHOT
    elif sig.merge_found and not sig.merge_on_includes_valid_from and not sig.enddate_proc:
        pattern = SCD1
    elif sig.merge_on_includes_valid_from and not sig.enddate_proc:
        pattern = MERGE_SCD2
        notes.append("merge keys on the validity date but no end-date procedure was found; closing rule UNKNOWN")
    elif sig.code_truncated and scan_verdict and scan_verdict.upper().startswith("SCD2"):
        pattern = SCD2_UNVERIFIED
        notes.append(f"column scan said {scan_verdict}; the writer's code is truncated in the export, so the load "
                     "pattern was not read — re-export the scenario untruncated to confirm")
    else:
        pattern = UNKNOWN
    if scan_verdict:
        v = scan_verdict.upper()
        if pattern == MERGE_SCD2 and not v.startswith("SCD2"):
            notes.append(f"column scan said {scan_verdict}; ODI shows an SCD2 merge — scan should be revisited")
        if pattern in (TRUNCATE_APPEND_HIST, SCD1) and v.startswith("SCD2"):
            notes.append(f"column scan said {scan_verdict}; ODI shows {pattern} — history columns exist but are not versioned in place")
    return pattern, notes
