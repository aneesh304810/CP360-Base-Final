"""The Micro_Batch_Markers sheet, and why it is not catalog events.

WHY IT NEEDED CODE AT ALL. The sheet was added to the workbook and the
loader ignored it in silence -- _SHEETS had no slot for it, so nothing
asked for it, nothing failed, and nothing loaded. The workbook grew and
the database did not, which is the quietest kind of wrong.

WHY NOT META_EVENT_DEFINITION. The sheet's own column says "Catalog
event: No". The markers carry ids 1000 and 1001, clear of the catalog's
1..105, and publish on every subscribed domain topic rather than on one.
Two extra rows in a table gated at 105 would make every "how many events
are there" answer wrong by two.

WHY ONE TABLE WITH TWO KINDS. Rows 2-3 are markers with a numeric id.
Rows 4-5 carry the literal word "Rule" and state a consumption rule about
the markers. Reading that column as a number gives two rows with a null
key that collide on insert.

    python ingestion/test/test_micro_batch_markers.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

import openpyxl                                                # noqa: E402
from ingestion.event360_conn import (                          # noqa: E402
    Event360Connector, EXPECT_MARKERS, MARKER_IDS)

BAD = 0
TMP = os.environ.get("TMPDIR", "/tmp")


def ok(cond, msg, got=None):
    global BAD
    print(f"{'ok  ' if cond else 'FAIL'} {msg}" + ("" if cond else f"  -> {got!r}"))
    if not cond:
        BAD += 1


HDR = ["Marker ID", "Marker name", "Published where", "Catalog event",
       "Payload fields", "Purpose", "Consumer handling", "Source"]
ROWS = [
    [1000, "Micro-Batch Start", "Every subscribed domain topic", "No",
     "eventId, key, startTime, endTime",
     "Marks the start of a Snowflake commit boundary.",
     "Record the micro-batch key and begin tracking events on the topic.",
     "SEI Data Cloud Event Specification v1.1, sections 2.3 and 2.4"],
    [1001, "Micro-Batch End", "Every subscribed domain topic", "No",
     "eventId, key, startTime, endTime",
     "Marks the end of the same Snowflake commit boundary.",
     "Mark a topic complete for the key; treat the batch complete only after "
     "this end marker is received on every subscribed topic.",
     "SEI Data Cloud Event Specification v1.1, sections 2.3 and 2.4"],
    ["Rule", "Zero-event topic boundary", "Every subscribed domain topic", "No",
     "Same marker pair",
     "A start/end pair may contain no data events for a topic.",
     "Treat the topic as complete with no changes for that micro-batch.",
     "SEI Data Cloud Event Specification v1.1, section 2.3"],
    ["Rule", "Cross-topic integrity", "All subscribed topics", "No",
     "Same key across topics",
     "Confirms all data within a commit has been consumed across topics.",
     "Do not declare consistency until every subscribed topic has the "
     "matching end marker.",
     "SEI Data Cloud Event Specification v1.1, sections 2.3 and 2.4"],
]


def sheet(rows=ROWS, header=HDR, title="Micro_Batch_Markers"):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = title
    ws.append(header)
    for r in rows:
        ws.append(r)
    path = f"{TMP}/mbm.xlsx"
    wb.save(path)
    return openpyxl.load_workbook(path, data_only=True)[title]


C = Event360Connector("unused")

# ---- 1. the two kinds come apart -------------------------------------
out = C._parse_markers(sheet())
ok(len(out) == 4, "all four rows are read", len(out))
mk = [r for r in out if r["entry_kind"] == "MARKER"]
ru = [r for r in out if r["entry_kind"] == "RULE"]
ok(len(mk) == 2, "two markers", len(mk))
ok(len(ru) == 2, "two rules", len(ru))
ok([m["marker_id"] for m in mk] == [1000, 1001], "with their ids",
   [m["marker_id"] for m in mk])
ok(all(r["marker_id"] is None for r in ru), "and a rule carries no id", ru)
ok(len({r["entry_key"] for r in out}) == 4,
   "every row has a distinct key, so nothing collides on insert",
   [r["entry_key"] for r in out])
ok([r["entry_key"] for r in ru] == ["RULE:1", "RULE:2"],
   "rules are keyed by position", [r["entry_key"] for r in ru])
ok(ru[0]["marker_name"] == "Zero-event topic boundary",
   "a rule keeps its name", ru[0]["marker_name"])

# ---- 2. the sheet's own answer is preserved ---------------------------
ok(all(r["catalog_event"] == "N" for r in out),
   "every row records that it is not a catalog event")
ok(mk[0]["payload_fields"] == "eventId, key, startTime, endTime",
   "the payload list is kept verbatim", mk[0]["payload_fields"])
ok(mk[0]["published_where"] == "Every subscribed domain topic",
   "and where it publishes")
ok([r["source_row"] for r in out] == [2, 3, 4, 5],
   "each row remembers where it came from", [r["source_row"] for r in out])

# The two columns the sheet grew. Silently dropping them is the same
# failure as ignoring the sheet -- the workbook says more and the
# database holds the same.
ok(all(r["consumer_handling"] for r in out),
   "every row carries what a consumer should DO about it",
   [r["consumer_handling"] for r in out])
ok(all("v1.1" in (r["source_ref"] or "") for r in out),
   "and cites the section of the specification it came from",
   [r["source_ref"] for r in out])
ok("every subscribed topic" in mk[1]["consumer_handling"],
   "the end marker's handling states the cross-topic condition",
   mk[1]["consumer_handling"])

# blank Catalog event is N, not an invitation to assume otherwise
b = C._parse_markers(sheet([[1000, "Start", "topic", None, "f", "p", "h", "s"]]))
ok(b[0]["catalog_event"] == "N", "a blank catalog-event cell reads as No",
   b[0]["catalog_event"])
y = C._parse_markers(sheet([[1000, "Start", "topic", "Yes", "f", "p", "h", "s"]]))
ok(y[0]["catalog_event"] == "Y", "and Yes is carried through, not ignored")

# ---- 3. messy sheets --------------------------------------------------
messy = C._parse_markers(sheet(ROWS + [[None] * 8, [""] * 8]))
ok(len(messy) == 4, "blank rows are skipped", len(messy))
alt = C._parse_markers(sheet(header=["Marker", "Name", "Published",
                                     "Catalog event", "Payload", "Purpose",
                                     "Handling", "Reference"]))
ok(len(alt) == 4, "alternative header wording resolves", len(alt))
ok([m["marker_id"] for m in alt if m["entry_kind"] == "MARKER"] == [1000, 1001],
   "and lands in the right columns")

# ---- 4. the gates ------------------------------------------------------
def gates(markers, events=()):
    c = Event360Connector("unused")
    c._marker_gates(markers, events)
    return c.gate_failures


ok(gates(out) == [], "a correct sheet raises nothing", gates(out))
ok(gates([]) == [], "an absent sheet raises nothing — it is optional")

three = out + [{"entry_key": "1002", "entry_kind": "MARKER", "marker_id": 1002,
                "catalog_event": "N"}]
ok(any("marker count" in f for f in gates(three)),
   "a third marker is refused, not absorbed", gates(three))

shifted = [dict(m, marker_id=2000, entry_key="2000") if m["entry_kind"] == "MARKER"
           else m for m in out]
ok(any("marker ids" in f for f in gates(shifted)),
   "a changed id is refused", gates(shifted))

ok(any("collide" in f for f in gates(out, events=[{"event_id": 1000}])),
   "a marker id that collides with a catalog event is refused",
   gates(out, events=[{"event_id": 1000}]))

claims = [dict(m, catalog_event="Y") for m in out]
ok(any("claim to be catalog events" in f for f in gates(claims)),
   "a row that flips to Yes is refused rather than quietly reclassified",
   gates(claims))

# ---- 5. markers never enter the catalog's count ------------------------
# The reason this table exists. If a future edit routed them into
# meta_event_definition, the 105 gate would start failing — assert the
# separation directly so the intent survives the edit.
c = Event360Connector("unused")
bundle_keys = {"event_type", "event_domain", "envelope_field",
               "consumption_rule", "event_definition", "event_field",
               "micro_batch_marker"}
ok("micro_batch_marker" in bundle_keys,
   "markers travel in their own bundle key")
ok(EXPECT_MARKERS == 2 and MARKER_IDS == (1000, 1001),
   "the expected shape is stated in the module, not in this test",
   [EXPECT_MARKERS, MARKER_IDS])

# ---- 6. a marker listed in the catalog is moved, not refused ----------
# The workbook states in one sheet that these are not catalog events and
# lists them in another as if they were. The explicit statement wins, and
# the move is logged -- refusing the load until somebody deletes two rows
# by hand is how the two sheets drifted apart in the first place.
def cat(i, kind="Business"):
    return {"event_id": i, "event_type": kind, "_is_marker": kind == "Marker"}


EVENTS = [cat(1), cat(2), cat(1000, "Marker"), cat(1001, "Marker")]
FIELDS = ([{"event_id": 1, "field_category": "PAYLOAD"}] * 4
          + [{"event_id": 2, "field_category": "PAYLOAD"}] * 4
          + [{"event_id": 1000, "field_category": "PAYLOAD"}] * 4
          + [{"event_id": 1001, "field_category": "PAYLOAD"}] * 4)

c = Event360Connector("unused")
ev2, fl2 = c._demote_markers(EVENTS, FIELDS, out)
ok([e["event_id"] for e in ev2] == [1, 2],
   "the two markers leave the event count", [e["event_id"] for e in ev2])
ok(len(fl2) == 8, "and their field rows leave with them", len(fl2))
ok(not any(f["event_id"] in (1000, 1001) for f in fl2),
   "no orphan field row is left pointing at a demoted event")
ok(any("demoted" in n for n in c.notes), "and the move is recorded", c.notes)
ok(c._marker_gates(out, ev2) is None and not c.gate_failures,
   "after the move the collision gate is quiet", c.gate_failures)

# nothing to demote leaves both lists untouched, by identity
c2 = Event360Connector("unused")
ev3, fl3 = c2._demote_markers([cat(1)], FIELDS[:4], out)
ok(len(ev3) == 1 and len(fl3) == 4, "a clean catalog is unchanged",
   [len(ev3), len(fl3)])
ok(c2.notes == [], "and nothing is logged about it", c2.notes)

# only DECLARED markers are demoted -- an id the sheet does not name stays
c3 = Event360Connector("unused")
ev4, _ = c3._demote_markers([cat(1), cat(1002, "Marker")], [], out)
ok([e["event_id"] for e in ev4] == [1, 1002],
   "an undeclared marker id stays in the catalog for the gates to judge",
   [e["event_id"] for e in ev4])

# no marker sheet at all -- nothing is demoted on a guess
c4 = Event360Connector("unused")
ev5, fl5 = c4._demote_markers(EVENTS, FIELDS, [])
ok(len(ev5) == 4 and len(fl5) == 16,
   "with no marker sheet nothing is demoted", [len(ev5), len(fl5)])

print(f"\n{BAD} assertion(s) failed" if BAD else "\nmicro-batch marker assertions pass")
sys.exit(1 if BAD else 0)
