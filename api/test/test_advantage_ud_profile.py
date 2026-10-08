"""The UD registry loader and the 360 endpoints, against a synthetic drop.

WHY THESE ASSERTIONS. The profiler's files are the only evidence the
catalogue will ever hold about the CLOB, and three of its habits would
corrupt a registry that trusted them: counts written as floats, 10-digit
account references labelled TIMESTAMP, and sample columns that carry
names. Then the families: the exact key set is unique to most rows, so a
family must come from the blocks present, and the test pins that eight
distinct key sets fold into the handful of families a reader recognises.
The endpoints are asserted on shapes, never values, because the UI's
"how the CLOB looks" must be drawable on a screen that must never show an
account.

    python api/test/test_advantage_ud_profile.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import HTTPException                             # noqa: E402
from _advantage_ud_fixture import write_drop, load_all, ROWS   # noqa: E402
from api.app import routers_advantage_ud as R                 # noqa: E402

bad = 0


def ok(cond, msg, got=None):
    global bad
    print(("ok   " if cond else "FAIL ") + msg + ("" if cond else f"  -> {got!r}"))
    if not cond:
        bad += 1


d = write_drop()
pb, cb, db = load_all(d)
reg = {r["attribute_name"]: r for r in pb["registry"]}

print("-- the registry")
ok(len(reg) == len(ROWS["attribute_profile.csv"]), "one registry row per profiled key")
ok(reg["UD_1"]["occurrence_count"] == 21500 and isinstance(reg["UD_1"]["occurrence_count"], int),
   "a float count becomes an integer", reg["UD_1"]["occurrence_count"])
ok(reg["UD_23_2"]["parent_attribute"] == "UD_23" and reg["UD_23_2"]["sequence_number"] == 2
   and reg["UD_23_2"]["key_structure"] == "MULTIPART", "the key is split into parent and sequence")
ok(reg["UD_527_1"]["value_class"] == "IDENTIFIER" and reg["UD_527_1"]["type_reclassified"] == "Y"
   and reg["UD_527_1"]["dominant_type"] == "TIMESTAMP",
   "a 10-digit account reference profiled as TIMESTAMP is read as IDENTIFIER, and the profile is kept")
ok(reg["UD_51"]["value_class"] == "DATE" and reg["UD_51"]["type_reclassified"] == "N", "a real date is left alone")
ok(reg["UD_51"]["variance_class"] == "DATE_FORMAT_OR_TEXT_VARIANCE", "type_variance joins by key")
ok(reg["UD_1"]["domain"] == "ACCOUNT_CLASSIFICATION" and reg["UD_1"]["class_source"] == "RULE",
   "the brief's hypothesis is recorded as a RULE, not as fact")
ok(reg["UD_32_19"]["domain"] == "BILLING" and reg["UD_32_19"]["is_free_text"] == "Y"
   and reg["UD_32_19"]["silver_entity"] == "ACCOUNT_BILLING", "a billing line takes its block's domain")
ok(reg["UD_23_1"]["domain"] == "HOUSEHOLD", "a household line takes its block's domain")
ok(reg["UD_613"]["domain"] == "UNKNOWN" and reg["UD_613"]["class_source"] == "INFERRED",
   "a key nobody described is UNKNOWN, inferred")
ok(reg["UD_1"]["gold_candidate"] == "Y" and reg["UD_613"]["gold_candidate"] == "N", "gold candidates flagged")
ok(all("sample" not in k for r in pb["registry"] for k in r), "no sample column reaches the registry")

print("-- parents and conflicts")
par = {p["parent_attribute"]: p for p in pb["parents"]}
ok(par["UD_32"]["structure_role"] == "BILLING_INSTRUCTION" and par["UD_23"]["structure_role"] == "HOUSEHOLD"
   and par["UD_623"]["structure_role"] == "TEXT_BLOCK", "roles from the rules, TEXT_BLOCK when unknown")
ok(par["UD_623"]["missing_sequences"] == "8,9", "a gap in sequences is kept as a fact")
con = {c["conflict_key"]: c for c in pb["conflicts"]}
ok(con["UD_32_19:ANNUAL MIN"]["conflict_class"] == "PARAMETERIZED_VALUE", "an amount with three spellings is a parameter")
ok(con["UD_32_1:FEE SCHEDULE"]["conflict_class"] == "FORMATTING_VARIATION", "case-only difference is formatting")
ok(con["UD_32_2:NOTE"]["conflict_class"] == "FREE_TEXT_FALSE_POSITIVE", "different prose is a false positive")

print("-- families")
fam = pb["families"]
ok(len(pb["schemas"]) == 8 and len(fam) == 5, "eight exact key sets fold into five families", (len(pb["schemas"]), len(fam)))
labels = {f["family_label"]: f for f in fam}
ok("singles only" in labels and labels["singles only"]["record_count"] == 5500,
   "rows with no block are one family, counts summed", labels.get("singles only"))
ok("household" in labels and labels["household"]["variant_count"] == 2, "household-only rows are one family of two key sets")
ok("household + billing instruction + authority" in labels, "blocks are named by role")
ok(fam[0]["family_label"] == "household" and fam[0]["record_count"] == 8500, "families are ordered by rows")
ok(all(s["family_id"] for s in pb["schemas"]), "every key set carries its family id")

print("-- the run")
run = {r["metric"]: r["value_num"] for r in pb["run"]}
ok(run["source_rows"] == 21672 and run["schema_variants"] == 12951, "run metrics are numbers")

print("-- load")
class _L:
    def __init__(self): self.n = {}; self.c = 0
    def _merge(self, t, pk, v): self.n[t] = self.n.get(t, 0) + 1
    def commit(self): self.c += 1
from ingestion.advantage_ud_profile_conn import AdvantageUdProfileConnector
L = _L(); n = AdvantageUdProfileConnector(d).load(L, pb)
ok(set(L.n) == {"cp_advantage_ud_registry", "cp_advantage_ud_parent", "cp_advantage_ud_family",
                "cp_advantage_ud_schema", "cp_advantage_ud_conflict", "cp_advantage_ud_run"} and L.c == 1,
   "six tables, one commit", L.n)
ok(AdvantageUdProfileConnector(os.path.join(d, "nope")).parse()["registry"] == [], "an empty folder loads nothing")

print("-- the endpoints")
R.query = db
ov = R.overview()
ok(ov["loaded"] and ov["attributes"] == 16 and ov["family_count"] == 5, "overview counts", (ov["attributes"], ov["family_count"]))
ok(ov["by_structure"] == {"SINGLE": 6, "MULTIPART": 10}, "split by structure", ov["by_structure"])
ok(ov["coded_attributes"] == 3 and ov["reclassified"] == 2 and ov["gold_candidates"] == 5,
   "coded, reclassified and gold counts", (ov["coded_attributes"], ov["reclassified"], ov["gold_candidates"]))
ok(ov["run"]["source_rows"] == 21672, "run metrics ride along")
a = R.attribute("ud_23_2")
ok(a["loaded"] and a["registry"]["attribute_name"] == "UD_23_2", "attribute detail by key, case-insensitive")
ok(a["parent"]["structure_role"] == "HOUSEHOLD" and [s["attribute_name"] for s in a["siblings"]] == ["UD_23_1", "UD_23_2", "UD_23_3"],
   "a line comes with its block and siblings", a.get("siblings"))
ok(a["siblings"][0]["shape"].startswith("000000000"), "a leading-zero identifier is drawn as zeros, never a value", a["siblings"][0]["shape"])
ok(a["shape"] == "<text ≤32 chars>", "a text line is drawn as its length", a["shape"])
a1 = R.attribute("UD_1")
ok(a1["shape"] == "1=INTERNAL/FIRM ACCOUNT" and len(a1["codes"]) == 7, "a coded field is drawn with its first code", a1["shape"])
ok("parent" not in a1 or a1["parent"] is None, "a single has no block")
ap = R.attribute("UD_23")
ok(ap["registry"] is None and ap["parent"]["structure_role"] == "HOUSEHOLD" and len(ap["siblings"]) == 3,
   "a block asked for by its own name answers with its lines")
ac = R.attribute("UD_32_19")
ok(ac["conflicts"] and ac["conflicts"][0]["conflict_class"] == "PARAMETERIZED_VALUE", "conflicts ride with the line")
try:
    R.attribute("ACCOUNT_NUMBER"); ok(False, "non-UD refused")
except HTTPException as e:
    ok(e.status_code == 400, "a non-UD name is refused")
sh = R.clob_shape()
ok(sh["loaded"] and "UD_613" in sh["example"] and sh["example"]["UD_613"] == "Y", "the example payload carries core keys with shapes")
ok(all(not v.isdigit() or set(v) == {"0"} for v in sh["example"].values()), "no example value could be a real number", sh["example"])
ok(sh["key_count_buckets"]["1-5"] == 5500 and sh["key_count_buckets"]["100+"] == 90, "payload sizes bucketed by rows", sh["key_count_buckets"])
ok(sh["top_family"]["family_label"] == "household", "the example follows the biggest family")
rg = R.registry(domain="billing")
ok([r["attribute_name"] for r in rg["attributes"]] == ["UD_32_1", "UD_32_2", "UD_32_19"], "registry filtered by domain, in key order",
   [r["attribute_name"] for r in rg["attributes"]])
ok(len(R.registry(gold=True)["attributes"]) == 5, "registry filtered to gold candidates")
print("-- type_variance.csv as its own analysis")
tv = R.type_variance()
ok(tv["loaded"] and tv["attributes"] == 5, "only keys with variance are listed", tv["attributes"])
tvr = {r["attribute_name"]: r for r in tv["rows"]}
ok(tvr["UD_80"]["minority_pct"] == 6.0 and tvr["UD_80"]["severity"] == "medium" and tvr["UD_80"]["minority"] == [["TEXT", 264]] or tvr["UD_80"]["minority"] == [("TEXT", 264)],
   "minority share and types come from the distribution, not the dominant pct", tvr["UD_80"])
ok(tvr["UD_527_1"]["type_reclassified"] == "Y" and "profiler" in tvr["UD_527_1"]["what"],
   "a reclassified key is called the profiler's variance", tvr["UD_527_1"]["what"])
ok(tvr["UD_32_19"]["is_free_text"] == "Y" and "narrative" in tvr["UD_32_19"]["do"], "a narrative line is told to stay narrative")
ok(tvr["UD_51"]["variance_class"] == "DATE_FORMAT_OR_TEXT_VARIANCE" and "never auto-convert" in tvr["UD_51"]["do"], "a date gets the date rule")
ok({c["variance_class"] for c in tv["classes"]} == {"DATE_FORMAT_OR_TEXT_VARIANCE", "CODE_VS_FREE_TEXT_VARIANCE",
    "IDENTIFIER_NUMERIC_COLLISION", "FLAG_REPRESENTATION_VARIANCE"}, "classes summarised", [c["variance_class"] for c in tv["classes"]])
ok(tv["reclassified"] == 1 and tv["free_text"] == 2 and tv["high"] == 0, "the headline counts", (tv["reclassified"], tv["free_text"], tv["high"]))

print("-- schema_variants.csv as its own analysis")
sv = R.schema_variance()
ok(sv["loaded"] and sv["key_sets"] == 8 and sv["rows"] == 19690 and sv["families"] == 5, "sets, rows and families", (sv["key_sets"], sv["rows"], sv["families"]))
ok(sv["declared_key_sets"] == 12951, "the profiler's own count is carried for comparison")
ok([b["bucket"] for b in sv["sizes"]] == ["1-5", "6-20", "21-50", "51-100", "100+"] and sv["sizes"][1]["rows"] == 12600 and sv["sizes"][1]["key_sets"] == 3,
   "sizes bucketed with both sets and rows", sv["sizes"])
ok(sv["tiers"] == {"core": 2, "common": 4, "occasional": 8, "rare": 2} and sv["core_keys"] == ["UD_613", "UD_1"], "presence tiers and the core keys", (sv["tiers"], sv["core_keys"]))
ok(sv["optional_count"] == 14 and all(1 <= (k["record_presence_pct"] or 0) < 99 for k in sv["optional_keys"]), "optional keys are those on 1% to 99% of rows", sv["optional_count"])
ok(sv["typed_drift_sets"] == 5, "sets whose keys agree but types do not are counted", sv["typed_drift_sets"])
ok(sv["singletons"] == 0, "no one-row sets in the fixture, reported as zero not omitted")
ok(sv["top"][0]["record_count"] == 6000 and sv["top"][0]["blocks"] == ["UD_23"] and sv["top"][0]["family_label"] == "household" and sv["top"][0]["singles"] == 5,
   "the most common set is described by blocks and singles, never by values", sv["top"][0])

print("-- the dictionary name reaches every list")
R.query = db
_q = R.query
def _with_terms(sql, p=None):
    if "legacy_dictionary" in sql:
        assert "ESCAPE" not in sql, "no escape character: one copy sent Oracle a two-character escape"
        return [{"field_code_norm": "UD_51", "business_term": "IPS DATE"}, {"field_code_norm": "UD_1", "business_term": "OWNED BY CODE"}]
    return _q(sql, p)
R.query = _with_terms
ok(next(r for r in R.type_variance()["rows"] if r["attribute_name"] == "UD_51")["term"] == "IPS DATE", "type variance rows carry the UD name")
ok(next(k for k in R.schema_variance()["optional_keys"] if k["attribute_name"] == "UD_51")["term"] == "IPS DATE", "optional keys carry the UD name")
ok(next(a for a in R.registry()["attributes"] if a["attribute_name"] == "UD_1")["term"] == "OWNED BY CODE", "the registry carries the UD name")
R.query = db

print("-- ingest status")
st = R.ingest_status()
ok(st["profile"]["loaded"] and st["profile"]["attributes"] == 16, "the profile is reported loaded with its key count", st["profile"])
ok(st["extract"]["loaded"] is False and st["workbook"]["loaded"] is False and st["trp"]["loaded"] is False,
   "sources without rows are reported not loaded, not as zeros that look like data", st)
ok(st["codes"] == {"OBSERVED": 11}, "code sources counted", st["codes"])

R.query = lambda sql, p=None: []
ok(R.type_variance()["loaded"] is False and R.schema_variance()["loaded"] is False, "both say not loaded on an empty warehouse")
ok(R.overview()["loaded"] is False and R.attribute("UD_1")["loaded"] is False and R.clob_shape()["loaded"] is False,
   "an unloaded warehouse says so instead of drawing nothing")

print()
print("advantage_ud_profile assertions " + ("FAIL" if bad else "pass"))
if bad:
    sys.exit(1)
