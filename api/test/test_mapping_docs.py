"""The mapping-document endpoints, on a fake db.

Each endpoint aggregates in Python over one slim select, so a fake that
answers by table name is enough to pin: coverage per IMDS table and the
link classes it counts, the register's declared-vs-loaded check, the
recomputed transformation summary with the sheet's figure beside it, the
reference codes' UNKNOWN as unmapped, and the usage exceptions by result.

    python api/test/test_mapping_docs.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from api.app import routers_sei_crosswalk as R                 # noqa: E402

bad = 0


def ok(cond, msg, got=None):
    global bad
    print(("ok   " if cond else "FAIL ") + msg + ("" if cond else f"  -> {got!r}"))
    if not cond:
        bad += 1


REG = [
    {"feed_family": "PEDDIFI1", "feed_key": "PEDDIFI1", "source_document": "STAR_Portfolio_Valuation.xlsx", "sei_star_rows": 3,
     "sei_star_mapped": 2, "open_dependencies": 1, "imds_targets": "HOLDINGDBO.POSITION;HOLDINGDBO.LOT_LEVEL_POSITION",
     "imds_stage_rows": 2, "new_comparison_rows": 2, "already_in_catalog": 161, "notes": None},
    {"feed_family": "ODDDIFI1", "feed_key": "ODDDIFI1", "source_document": "STAR_Open_Dividends.xlsx", "sei_star_rows": 5,
     "sei_star_mapped": 0, "open_dependencies": 0, "imds_targets": "HOLDINGDBO.BBH_OPEN_DIVIDENDS", "imds_stage_rows": 1,
     "new_comparison_rows": 1, "already_in_catalog": 0, "notes": None},
]
S2S = [
    {"feed_key": "PEDDIFI1", "sei_field": "SWP_ACCOUNT_NUMBER", "mapping_status": "CANDIDATE", "map_kind": "DIRECT", "open_dependency": "N", "star_in_layout": "Y"},
    {"feed_key": "PEDDIFI1", "sei_field": "QUANTITY", "mapping_status": "BUSINESS_DECISION_REQUIRED", "map_kind": "DERIVED", "open_dependency": "Y", "star_in_layout": "Y"},
    {"feed_key": "PEDDIFI1", "sei_field": None, "mapping_status": "NO_SEI_SOURCE", "map_kind": "NO_MAPPING", "open_dependency": "N", "star_in_layout": "N"},
    {"feed_key": "ODDDIFI1", "sei_field": None, "mapping_status": "NO_SEI_SOURCE", "map_kind": "NO_MAPPING", "open_dependency": "N", "star_in_layout": "Y"},
]
STG = [
    {"feed_key": "PEDDIFI1", "imds_table": "HOLDINGDBO.POSITION", "evidence_completeness": "BOTH_LOGICS_DOCUMENTED", "business_decision": "N"},
    {"feed_key": "PEDDIFI1", "imds_table": "HOLDINGDBO.LOT_LEVEL_POSITION", "evidence_completeness": "SEI_ONLY_DOCUMENTED", "business_decision": "N"},
    {"feed_key": "ODDDIFI1", "imds_table": "HOLDINGDBO.BBH_OPEN_DIVIDENDS", "evidence_completeness": "IM_ONLY_DOCUMENTED", "business_decision": "Y"},
]
E2E = [
    {"xwalk_row_id": "1", "feed_key": "PEDDIFI1", "feed_family": "PEDDIFI1", "imds_table": "HOLDINGDBO.POSITION", "imds_column": "QUANTITY", "link_class": "E2E", "link_status": "E2E_LINKED", "crosswalk_status": "CANDIDATE", "approval_status": "DRAFT_REVIEW_REQUIRED", "star_field": "Lot Quantity", "sei_source": "Taxlot.QUANTITY", "sei_object": "Taxlot"},
    {"xwalk_row_id": "2", "feed_key": "PEDDIFI1", "feed_family": "PEDDIFI1", "imds_table": "HOLDINGDBO.POSITION", "imds_column": "ENTITY_ID", "link_class": "SEI_DIRECT", "link_status": "DIRECT_SEI_TO_IMDS", "crosswalk_status": "CANDIDATE", "approval_status": "DRAFT_REVIEW_REQUIRED", "star_field": None, "sei_source": "Account.SWP", "sei_object": "Account"},
    {"xwalk_row_id": "3", "feed_key": "PEDDIFI1", "feed_family": "PEDDIFI1", "imds_table": "HOLDINGDBO.POSITION", "imds_column": "COST_BASIS", "link_class": "STAR_NOT_IN_FILE_MAP", "link_status": "STAR_FIELD_NOT_IN_FILE_MAP", "crosswalk_status": "GAP", "approval_status": "DRAFT_REVIEW_REQUIRED", "star_field": "Phantom", "sei_source": None},
    {"xwalk_row_id": "4", "feed_key": "PEDDIFI1", "feed_family": "PEDDIFI1", "imds_table": "HOLDINGDBO.POSITION", "imds_column": "PRICE", "link_class": "NO_SEI_SOURCE", "link_status": "NO_SEI_SOURCE", "crosswalk_status": "GAP", "approval_status": "DRAFT_REVIEW_REQUIRED", "star_field": "Price", "sei_source": None},
    {"xwalk_row_id": "5", "feed_key": "ODDDIFI1", "feed_family": "ODDDIFI1", "imds_table": "HOLDINGDBO.BBH_OPEN_DIVIDENDS", "imds_column": "ENTITY_ID", "link_class": "NO_SEI_SOURCE", "link_status": "NO_SEI_SOURCE", "crosswalk_status": "GAP", "approval_status": "DRAFT_REVIEW_REQUIRED", "star_field": "Entity Number", "sei_source": None},
]
CMP = [
    {"target_object": "HOLDINGDBO.POSITION", "evidence_completeness": "BOTH_LOGICS_DOCUMENTED", "approval_status": "DRAFT_REVIEW_REQUIRED", "equivalence": "EXACT_TEXT"},
    {"target_object": "HOLDINGDBO.POSITION", "evidence_completeness": "IM_ONLY_DOCUMENTED", "approval_status": "DRAFT_REVIEW_REQUIRED", "equivalence": "NO_SEI_SOURCE"},
    {"target_object": "HOLDINGDBO.POSITION", "evidence_completeness": "SEI_ONLY_DOCUMENTED", "approval_status": "APPROVED", "equivalence": "UNVERIFIED_COMPARISON"},
    {"target_object": "HOLDINGDBO.BBH_OPEN_DIVIDENDS", "evidence_completeness": "NO_MAPPING", "approval_status": "DRAFT_REVIEW_REQUIRED", "equivalence": "NO_SEI_SOURCE"},
]
CTL = [{"control_name": "HOLDINGDBO.POSITION", "result": "3", "status": "DRAFT_REVIEW_REQUIRED", "detail": "x"},
       {"control_name": "TOTAL", "result": "4", "status": "DRAFT_REVIEW_REQUIRED", "detail": "x"}]
CODES = [
    {"code_set_name": "BBH_TRANSACTION_CODE", "side": "STAR", "code_value": "MATURITY", "code_description": "Maturity", "maps_to_side": "SEI", "maps_to_code": "27", "maps_to_description": "Final Maturity", "is_mapped": "Y", "mapping_rule": "Direct", "source_document": "c.xlsx"},
    {"code_set_name": "COMPONENT_TYPE", "side": "SEI", "code_value": "1", "code_description": "Principal", "maps_to_side": "STAR", "maps_to_code": "UNKNOWN", "maps_to_description": "UNKNOWN", "is_mapped": "N", "mapping_rule": "MEMBERS_ONLY", "source_document": "c.xlsx"},
]
ENT = [{"feed_family": "ODDDIFI1", "seq": 1, "legacy_logic": "v := substr(e,1,4);", "logic_comment": "AOF", "sei_rule": "StarId", "approval_status": None, "source_document": "d.xlsx", "source_row": 5},
       {"feed_family": "ODDDIFI1", "seq": 2, "legacy_logic": "if x is null", "logic_comment": "", "sei_rule": None, "approval_status": None, "source_document": "d.xlsx", "source_row": 6}]
EXC = [{"result": "USED_BUT_UNMAPPED", "feed_family": "PEDDIFI1", "field_name": "Security Alias ID", "matrix_usage": "Used", "doc_usage": "NOT_STATED", "sei_source_mapped": "N", "detail": None, "source_document": "p.xlsx", "source_row": 112},
       {"result": "UNUSED_BUT_MAPPED", "feed_family": "PEDDIFI1", "field_name": "Accounting Basis", "matrix_usage": "Unused", "doc_usage": "NOT_STATED", "sei_source_mapped": "Y", "detail": None, "source_document": "p.xlsx", "source_row": 3}]


def fake_query(sql, params=None):
    params = params or {}
    s = " ".join(sql.split())
    if "FROM sei_mapping_source" in s:
        return [dict(r) for r in REG]
    if "FROM sei_star_field_map" in s:
        return [dict(r) for r in S2S]
    if "FROM star_imds_stage_map" in s:
        return [dict(r) for r in STG]
    if "FROM sei_e2e_xwalk" in s:
        rows = E2E
        if "imds_table = :t" in s:
            rows = [r for r in rows if r["imds_table"] == params["t"]]
        if "link_class = :l" in s:
            rows = [r for r in rows if r["link_class"] == params["l"]]
        return [dict(r) for r in rows]
    if "FROM sei_transformation_compare" in s:
        return [dict(r) for r in CMP]
    if "FROM sei_control" in s:
        return [dict(r) for r in CTL]
    if "FROM sei_reference_code_xwalk" in s:
        rows = CODES
        if "code_set_name = :cs" in s:
            rows = [r for r in rows if r["code_set_name"] == params["cs"]]
        return [dict(r) for r in rows]
    if "FROM sei_entity_id_derivation" in s:
        return [dict(r) for r in ENT]
    if "FROM star_usage_mapping_exception" in s:
        rows = EXC
        if "result = :r" in s:
            rows = [r for r in rows if r["result"] == params["r"]]
        return [dict(r) for r in rows]
    return []


R._safe = fake_query

print("-- the register, declared beside loaded")
md = R.mapping_docs()
docs = {d["feed_family"]: d for d in md["docs"]}
ok(md["totals"]["documents"] == 2 and md["totals"]["s2s_rows"] == 4 and md["totals"]["s2s_mapped"] == 2 and md["totals"]["e2e_rows"] == 5, "totals", md["totals"])
ok(docs["PEDDIFI1"]["agrees"] is True and docs["PEDDIFI1"]["loaded"]["s2s_rows"] == 3, "PEDDIFI1 declared 3, loaded 3: agrees")
ok(docs["ODDDIFI1"]["agrees"] is False and docs["ODDDIFI1"]["loaded"]["s2s_rows"] == 1, "ODDDIFI1 declared 5, loaded 1: a load that dropped rows is flagged", docs["ODDDIFI1"])
ok(docs["PEDDIFI1"]["loaded"]["imds_tables"] == ["HOLDINGDBO.LOT_LEVEL_POSITION", "HOLDINGDBO.POSITION"], "the IMDS tables the stage lane actually holds")
ok(md["totals"]["s2s_mapped_pct"] == 50.0 and md["totals"]["open_dependencies"] == 1 and md["totals"]["disagreements"] == 1, "mapped share, open dependencies, disagreements")
ok([x["key"] for x in md["by_map_kind"]][:1] and any(x["key"] == "NO_MAPPING" and x["n"] == 2 for x in md["by_map_kind"]), "map kinds tallied")
ok("DRAFT_REVIEW_REQUIRED" in md["headline"], "the headline says draft")

print("-- end-to-end coverage")
cov = R.e2e_coverage()
ok(cov["total"] == 5 and cov["covered"] == 2 and cov["coverage_pct"] == 40.0, "coverage counts E2E and SEI_DIRECT only", cov)
pos = next(x for x in cov["tables"] if x["name"] == "HOLDINGDBO.POSITION")
ok(pos["rows"] == 4 and pos["e2e"] == 1 and pos["sei_direct"] == 1 and pos["no_sei_source"] == 1 and pos["not_in_file_map"] == 1 and pos["coverage_pct"] == 50.0 and pos["gap"] == 2,
   "per table: the four classes and the gap count", pos)
ok([l["key"] for l in cov["by_link"]] == ["E2E", "SEI_DIRECT", "STAR_NOT_IN_FILE_MAP", "NO_SEI_SOURCE"] and all(l["label"] for l in cov["by_link"]), "link classes in screen order, labelled")
ok(cov["tables"][0]["name"] == "HOLDINGDBO.POSITION", "tables sorted by coverage, best first")
rows = R.e2e_rows(table="HOLDINGDBO.POSITION", link="no_sei_source")
ok(rows["total"] == 1 and rows["rows"][0]["imds_column"] == "PRICE", "rows filter by table and link class")

print("-- the transformation summary, recomputed")
xs = R.transformation_summary()
pos = next(x for x in xs["tables"] if x["target_object"] == "HOLDINGDBO.POSITION")
ok(pos["rows"] == 3 and pos["covered"] == 2 and pos["coverage_pct"] == 66.7 and pos["approved"] == 1, "both, IM-and-SEI and SEI-only count as covered; IM-only and no-mapping do not", pos)
ok(pos["declared_rows"] == "3" and pos["declared_status"] == "DRAFT_REVIEW_REQUIRED" and xs["declared_total"] == "4", "the sheet's own figures sit beside the computed ones")
ok([c["key"] for c in xs["by_completeness"]] == ["BOTH_LOGICS_DOCUMENTED", "SEI_ONLY_DOCUMENTED", "IM_ONLY_DOCUMENTED", "NO_MAPPING"], "completeness in order, the new IM_ONLY value included")

print("-- reference codes, entity id, usage exceptions")
rc = R.reference_codes()
ok(rc["total"] == 2 and rc["mapped"] == 1 and next(s for s in rc["by_set"] if s["code_set_name"] == "COMPONENT_TYPE")["unknown"] == 1, "UNKNOWN counts as unmapped per set", rc["by_set"])
ok(R.reference_codes(code_set="COMPONENT_TYPE")["total"] == 1, "filter by code set")
ent = R.entity_id()
ok(ent["total"] == 2 and ent["feeds"][0]["feed_family"] == "ODDDIFI1" and [s["seq"] for s in ent["feeds"][0]["steps"]] == [1, 2], "steps grouped by feed, in order")
ex = R.usage_exceptions()
ok(ex["total"] == 2 and [r["key"] for r in ex["by_result"]] == ["USED_BUT_UNMAPPED", "UNUSED_BUT_MAPPED"], "exceptions by result, in order", ex["by_result"])
ok(R.usage_exceptions(result="used_but_unmapped")["total"] == 1, "filter by result")

print("-- the candidate flow, in the ribbon's shape")
fc = R.flow_candidates()
ok(fc["total"] == 5 and len(fc["bypass"]) == 1 and fc["bypass"][0] == {"src": "Account", "tgt": "HOLDINGDBO.POSITION", "n": 1},
   "SEI straight to IMDS with no STAR field is a bypass arc", fc["bypass"])
lefts = {(l["src"], l["mid"], l["verdict"]): l["n"] for l in fc["left"]}
ok(lefts.get(("Taxlot", "PEDDIFI1", "E2E")) == 1 and lefts.get(("no SEI source", "PEDDIFI1", "NO_SEI_SOURCE")) == 1
   and lefts.get(("no SEI source", "PEDDIFI1", "STAR_NOT_IN_FILE_MAP")) == 1 and lefts.get(("no SEI source", "ODDDIFI1", "NO_SEI_SOURCE")) == 1,
   "left links: SEI object -> STAR feed, grouped by link class; no SEI source is a node", lefts)
rights = {(r["mid"], r["tgt"]): r["n"] for r in fc["right"]}
ok(rights == {("PEDDIFI1", "HOLDINGDBO.POSITION"): 3, ("ODDDIFI1", "HOLDINGDBO.BBH_OPEN_DIVIDENDS"): 1}, "right links: STAR feed -> IMDS table, distinct columns", rights)

print("-- an empty warehouse")
R._safe = lambda sql, params=None: []
ok(R.mapping_docs()["totals"]["documents"] == 0 and R.e2e_coverage()["coverage_pct"] is None and R.transformation_summary()["tables"] == [],
   "nothing loaded: empty shapes, no error")

print(("\n%d assertion(s) failed" % bad) if bad else "\nmapping-docs api assertions pass")
sys.exit(1 if bad else 0)
