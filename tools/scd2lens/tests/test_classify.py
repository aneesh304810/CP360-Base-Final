from scd2lens.odi.classify import MERGE_SCD2, SCD1, TRUNCATE_APPEND_HIST, UNKNOWN, Signals, classify
from scd2lens.rules.engine import build_card


def test_signal_table():
    assert classify(Signals(merge_found=True, merge_on_includes_valid_from=True, enddate_proc=True))[0] == MERGE_SCD2
    assert classify(Signals(truncate=True, control_append=True, insert_hist_proc=True))[0] == TRUNCATE_APPEND_HIST
    assert classify(Signals(merge_found=True))[0] == SCD1
    assert classify(Signals())[0] == UNKNOWN
    p, notes = classify(Signals(truncate=True, control_append=True, insert_hist_proc=True), "SCD2")
    assert p == TRUNCATE_APPEND_HIST and any("not versioned in place" in n for n in notes)


def test_cards_classify_the_three_fixtures(export, settings):
    assert build_card(export, "DIM_ACCOUNT", settings).pattern == MERGE_SCD2
    assert build_card(export, "DIM_SECURITY", settings).pattern == MERGE_SCD2
    c = build_card(export, "DIM_IP_RELATIONSHIP", settings)
    assert c.pattern == TRUNCATE_APPEND_HIST
    assert any("not versioned in place" in n for n in c.notes)


def test_scan_stands_in_when_the_writer_code_is_cut():
    """The real export truncates code_preview, so most SCD2 dimensions parse to nothing. With the scan
    saying SCD2, that is SCD2_UNVERIFIED and the note says to re-export — not UNKNOWN, which means no writer."""
    from scd2lens.odi.classify import SCD2_UNVERIFIED
    p, notes = classify(Signals(code_truncated=True), "SCD2")
    assert p == SCD2_UNVERIFIED and any("re-export" in n for n in notes)
    assert classify(Signals(code_truncated=True), "NONE")[0] == UNKNOWN       # the scan does not say SCD2
    assert classify(Signals(code_truncated=True))[0] == UNKNOWN               # no scan at all
