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

print("-- the cutover: the rule's fate when STAR becomes SEI")
rs = R.rule_state
ok(rs("SUM(a)", "SUM(a)") == "SAME" and rs("SUM(Lot_Qty)", "SUM(Taxlot.QUANTITY)", "Lot Qty", "QUANTITY", "Taxlot") == "SUBSTITUTED"
   and rs("substr(lot_qty,1,2)", "substr(QUANTITY,1,2)", "Lot Quantity", "QUANTITY", None, "lot_qty") == "SUBSTITUTED",
   "same, and the same rule with the STAR input swapped for the SEI input (by field or by stage column, object-prefixed or not)")
ok(rs("x", "y") == "REWRITTEN" and rs("x", "y -- ALT: z") == "ALTERNATIVES" and rs(None, "y") == "NEW_RULE" and rs(None, None) == "PASS_THROUGH"
   and rs("x", "") == "NO_SEI_RULE" and rs("  SUM( a )", "sum(a)") == "SAME", "rewritten, alternatives, new rule, pass-through, the gap; whitespace and case ignored")
ok(R.RULE_STATE_ORDER[0] == "SAME" and R.RULE_STATE_ORDER[-1] == "NO_SEI_RULE" and len(set(R.RULE_STATE_ORDER)) == 7, "seven states, kept ones first")

STG2 = [
    {"map_row_id": "s1", "star_field": "Lot Quantity", "star_field_norm": "LOT_QUANTITY", "imds_table": "HOLDINGDBO.POSITION", "imds_column": "QUANTITY", "target_type": "NUMBER(28,12)", "target_nullable": "No",
     "uploader_column": "lot_qty", "im_logic": "SUM(lot_qty)", "sei_equiv_logic": "SUM(Taxlot.QUANTITY)", "sei_object": "Taxlot", "sei_field": "QUANTITY", "sei_join_logic": "TAXLOT_TYPE_CODE = 2",
     "comparison_id": "CMP-1", "evidence_completeness": "BOTH_LOGICS_DOCUMENTED", "business_decision": "N", "notes": None, "source_document": "pv.xlsx", "source_row": 13},
    {"map_row_id": "s2", "star_field": "Entity Number", "star_field_norm": "ENTITY_NUMBER", "imds_table": "HOLDINGDBO.POSITION", "imds_column": "ENTITY_ID", "target_type": "CHAR(8)", "target_nullable": "No",
     "uploader_column": "entity", "im_logic": "substr(entity,1,8)", "sei_equiv_logic": None, "sei_object": None, "sei_field": None, "sei_join_logic": None,
     "comparison_id": "CMP-2", "evidence_completeness": "IM_ONLY_DOCUMENTED", "business_decision": "Y", "notes": "needs a decision", "source_document": "pv.xlsx", "source_row": 14},
    {"map_row_id": "s3", "star_field": "Accounting Date", "star_field_norm": "ACCOUNTING_DATE", "imds_table": "HOLDINGDBO.POSITION", "imds_column": "EFFECTIVE_DATE", "target_type": "DATE", "target_nullable": "Yes",
     "uploader_column": "acct_dt", "im_logic": "to_date(acct_dt,'MM/DD/YYYY')", "sei_equiv_logic": "PROCESSING_DATE", "sei_object": None, "sei_field": None, "sei_join_logic": None,
     "comparison_id": "CMP-3", "evidence_completeness": "BOTH_LOGICS_DOCUMENTED", "business_decision": "N", "notes": None, "source_document": "pv.xlsx", "source_row": 15},
    {"map_row_id": "s4", "star_field": "Price", "star_field_norm": "PRICE", "imds_table": "HOLDINGDBO.POSITION", "imds_column": "PRICE", "target_type": "NUMBER", "target_nullable": "Yes",
     "uploader_column": "price", "im_logic": None, "sei_equiv_logic": None, "sei_object": "Taxlot", "sei_field": "PRICE", "sei_join_logic": None,
     "comparison_id": "CMP-4", "evidence_completeness": "NO_MAPPING", "business_decision": "N", "notes": None, "source_document": "pv.xlsx", "source_row": 16},
]
S2S2 = [
    {"star_field_norm": "LOT_QUANTITY", "star_in_layout": "Y", "business_description": "Quantity of the lot", "doc_usage_status": "Used", "sei_object": "Taxlot", "sei_field": "QUANTITY", "sei_type": "decimal", "join_logic": "TAXLOT_TYPE_CODE = 2", "map_kind": "DERIVED", "open_dependency": None, "mapping_status": "CANDIDATE", "approval_status": "DRAFT_REVIEW_REQUIRED"},
    {"star_field_norm": "ENTITY_NUMBER", "star_in_layout": "Y", "business_description": "The entity", "doc_usage_status": "Used", "sei_object": None, "sei_field": None, "sei_type": None, "join_logic": None, "map_kind": "NO_MAPPING", "open_dependency": "entity id derivation", "mapping_status": "NO_SEI_SOURCE", "approval_status": "DRAFT_REVIEW_REQUIRED"},
    {"star_field_norm": "ACCOUNTING_DATE", "star_in_layout": "N", "business_description": None, "doc_usage_status": "Unused", "sei_object": None, "sei_field": "PROCESSING_DATE", "sei_type": "date", "join_logic": None, "map_kind": "SYSTEM_DATE", "open_dependency": None, "mapping_status": "CANDIDATE", "approval_status": "DRAFT_REVIEW_REQUIRED"},
]
LAY = [{"field_norm": "LOT_QUANTITY", "ordinal": 7, "published_type": "NUM", "published_length": "18"}, {"field_norm": "ENTITY_NUMBER", "ordinal": 1, "published_type": "CHAR", "published_length": "8"}, {"field_norm": "PRICE", "ordinal": 9, "published_type": "NUM", "published_length": "18"}]
USE = [{"field_norm": "LOT_QUANTITY", "usage_status": "Used", "is_used": "Y"}, {"field_norm": "ENTITY_NUMBER", "usage_status": "Used", "is_used": "Y"}, {"field_norm": "ACCOUNTING_DATE", "usage_status": "Unused", "is_used": "N"}]
E2E2 = [{"imds_table": "HOLDINGDBO.POSITION", "imds_column": "QUANTITY", "star_field_norm": "LOT_QUANTITY", "link_status": "E2E_LINKED", "link_class": "E2E", "crosswalk_status": "CANDIDATE"},
        {"imds_table": "HOLDINGDBO.POSITION", "imds_column": "ENTITY_ID", "star_field_norm": "ENTITY_NUMBER", "link_status": "NO_SEI_SOURCE", "link_class": "NO_SEI_SOURCE", "crosswalk_status": "GAP"}]


def fake2(sql, params=None):
    params = params or {}
    s = " ".join(sql.split())
    if "FROM sei_mapping_source" in s:
        return [dict(r) for r in REG]
    if "feed_family = :f" in s and params.get("f") != "PEDDIFI1":
        return []
    if "FROM star_imds_stage_map" in s:
        return [dict(r) for r in STG2]
    if "FROM sei_star_field_map" in s:
        return [dict(r) for r in S2S2]
    if "FROM star_layout_field" in s:
        return [dict(r) for r in LAY]
    if "FROM star_field_usage" in s:
        return [dict(r) for r in USE]
    if "FROM sei_e2e_xwalk" in s:
        return [dict(r) for r in E2E2]
    return []


R._safe = fake2
c0 = R.cutover_lineage()
ok(c0["feed"] is None and c0["columns"] == [] and len(c0["feeds"]) == len(REG), "no feed asked: the feeds to pick from, no rows")
cu = R.cutover_lineage(feed="PEDDIFI1")
byc = {c["imds_column"]: c for c in cu["columns"]}
ok(list(byc) == ["EFFECTIVE_DATE", "ENTITY_ID", "PRICE", "QUANTITY"], "one row per IMDS column, in table.column order", list(byc))
q = byc["QUANTITY"]
ok(q["star"]["field"] == "Lot Quantity" and q["star"]["in_layout"] == "Y" and q["star"]["ordinal"] == 7 and q["star"]["is_used"] == "Y" and q["star"]["uploader_column"] == "lot_qty",
   "the STAR side: the field, its layout slot and whether anything reads it", q["star"])
ok(q["sei"]["source"] == "Taxlot.QUANTITY" and q["sei"]["map_kind"] == "DERIVED" and q["sei"]["join_logic"] == "TAXLOT_TYPE_CODE = 2" and q["has_sei"],
   "the SEI side: object.field, kind and join", q["sei"])
ok(q["rule"]["state"] == "SUBSTITUTED" and q["link_class"] == "E2E" and q["crosswalk_status"] == "CANDIDATE", "the rule is kept with the SEI input; the e2e link rides along", q["rule"])
e = byc["ENTITY_ID"]
ok(not e["has_sei"] and e["sei"]["source"] is None and e["sei"]["mapping_status"] == "NO_SEI_SOURCE" and e["rule"]["state"] == "NO_SEI_RULE" and e["rule"]["business_decision"] == "Y"
   and e["link_class"] == "NO_SEI_SOURCE", "no SEI source: the rule is the gap, flagged for a business decision", e)
d = byc["EFFECTIVE_DATE"]
ok(d["sei"]["source"] == "PROCESSING_DATE" and d["sei"]["map_kind"] == "SYSTEM_DATE" and d["rule"]["state"] == "REWRITTEN" and d["star"]["in_layout"] == "N" and d["star"]["is_used"] == "N",
   "a SEI source from the SEI->STAR lane when the stage row has none; a rewritten rule; a STAR field outside the layout, read by nothing", d)
pr = byc["PRICE"]
ok(pr["rule"]["state"] == "PASS_THROUGH" and pr["has_sei"] and pr["sei"]["source"] == "Taxlot.PRICE" and pr["link_class"] is None, "no rule either side: the value is copied; no e2e row is no link", pr)
T = cu["totals"]
ok(T["columns"] == 4 and T["tables"] == 1 and T["with_sei"] == 3 and T["no_sei"] == 1 and T["kept"] == 2 and T["rewritten"] == 1 and T["business_decisions"] == 1 and T["star_fields"] == 4,
   "the totals", T)
ok([x["key"] for x in T["by_state"]] == ["SUBSTITUTED", "PASS_THROUGH", "REWRITTEN", "NO_SEI_RULE"], "states counted in order", T["by_state"])
ok([c["imds_column"] for c in R.cutover_lineage(feed="PEDDIFI1", q="taxlot")["columns"]] == ["PRICE", "QUANTITY"], "search matches the SEI source too")
ok(R.cutover_lineage(feed="ODDDIFI1")["totals"]["columns"] == 0, "a feed with no stage rows: empty, no error")

print("-- v4: the lineage at its wider grain, the SEI feed files")
E2E4 = [
    {"xwalk_row_id": "IMDS:LIN-1", "lineage_id": "LIN-1", "feed_key": "PEDDIFI1", "feed_family": "PEDDIFI1", "sei_source": "Taxlot.QUANTITY_HELD", "sei_object": "Taxlot", "sei_field": "QUANTITY_HELD",
     "sei_file": "Taxlot", "sei_file_fields": "Taxlot.QUANTITY_HELD", "sei_file_status": "VERIFIED_IN_FEED_SPEC", "map_kind": "DERIVED", "star_field": "Lot Quantity", "star_field_norm": "LOT_QUANTITY",
     "star_in_layout": "Y", "imds_table": "HOLDINGDBO.POSITION", "imds_column": "QUANTITY", "link_status": "FULL_SEI_STAR_IMDS", "link_class": "E2E", "crosswalk_status": "CANDIDATE",
     "approval_status": "DRAFT_REVIEW_REQUIRED", "star_field_resolution": "DOCUMENTED", "sei_imds_logic_origin": "COMPOSED_FROM_STAR_LOGIC", "imds_type": "NUMBER", "imds_nullable": "No", "business_decision": "N", "comparison_id": "LLP-1", "source_document": "pv.xlsx"},
    {"xwalk_row_id": "IMDS:LIN-2", "lineage_id": "LIN-2", "feed_key": "PEDDIFI1", "feed_family": "PEDDIFI1", "sei_source": "Processing_Date", "sei_object": None, "sei_field": "Processing_Date",
     "sei_file": "SYSTEM (job run)", "sei_file_fields": "SYSTEM (job run).PROCESSING_DATE", "sei_file_status": "SYSTEM_OR_CONSTANT", "map_kind": "SYSTEM_DATE", "star_field": None, "star_field_norm": None,
     "star_in_layout": None, "imds_table": "HOLDINGDBO.POSITION", "imds_column": "EFFECTIVE_DATE", "link_status": "SEI_TO_IMDS_NO_STAR_FIELD", "link_class": "SEI_DIRECT", "crosswalk_status": "CANDIDATE",
     "approval_status": "DRAFT_REVIEW_REQUIRED", "star_field_resolution": "NOT_RESOLVED", "sei_imds_logic_origin": "DOCUMENTED", "imds_type": "DATE", "imds_nullable": "Yes", "business_decision": "N", "comparison_id": "LLP-2", "source_document": "pv.xlsx"},
    {"xwalk_row_id": "IMDS:LIN-3", "lineage_id": "LIN-3", "feed_key": "PEDDIFI1", "feed_family": "PEDDIFI1", "sei_source": None, "sei_object": None, "sei_field": None,
     "sei_file": None, "sei_file_fields": None, "sei_file_status": "NO_SEI_SOURCE", "map_kind": None, "star_field": "Phantom Field", "star_field_norm": "PHANTOM_FIELD",
     "star_in_layout": "N", "imds_table": "HOLDINGDBO.POSITION", "imds_column": "COST_BASIS", "link_status": "STAR_TO_IMDS_NO_SEI_SOURCE", "link_class": "NO_SEI_SOURCE", "crosswalk_status": "BUSINESS_DECISION_REQUIRED",
     "approval_status": "DRAFT_REVIEW_REQUIRED", "star_field_resolution": "PARSED_FROM_IM_LOGIC", "sei_imds_logic_origin": "MISSING", "imds_type": "NUMBER", "imds_nullable": "Yes", "business_decision": "Y", "comparison_id": "LLP-3", "source_document": "pv.xlsx"},
    {"xwalk_row_id": "IMDS:LIN-4", "lineage_id": "LIN-4", "feed_key": "PEDDIFI1", "feed_family": "PEDDIFI1", "sei_source": "Account.ACCOUNT_BASE_CURRENCY", "sei_object": "Account", "sei_field": "ACCOUNT_BASE_CURRENCY",
     "sei_file": "Account", "sei_file_fields": "Account.ACCOUNT_BASE_CURRENCY", "sei_file_status": "VERIFIED_IN_FEED_SPEC", "map_kind": "LOOKUP", "star_field": "Base Currency Code", "star_field_norm": "BASE_CURRENCY_CODE",
     "star_in_layout": "Y", "imds_table": None, "imds_column": None, "link_status": "SEI_TO_STAR_NO_IMDS_TARGET", "link_class": "STAR_ONLY", "crosswalk_status": "GAP",
     "approval_status": "DRAFT_REVIEW_REQUIRED", "star_field_resolution": "SEI_TO_STAR_FIELD_MAP", "sei_imds_logic_origin": "MISSING", "imds_type": None, "imds_nullable": None, "business_decision": "N", "comparison_id": None, "source_document": "pv.xlsx"},
    {"xwalk_row_id": "IMDS:LIN-5", "lineage_id": "LIN-5", "feed_key": "PEDDIFI1", "feed_family": "PEDDIFI1", "sei_source": None, "sei_object": None, "sei_field": None,
     "sei_file": None, "sei_file_fields": None, "sei_file_status": "NO_SEI_SOURCE", "map_kind": None, "star_field": None, "star_field_norm": None,
     "star_in_layout": None, "imds_table": "HOLDINGDBO.POSITION", "imds_column": "UPDATE_SOURCE", "link_status": "NOT_POPULATED_IN_LOAD", "link_class": "NOT_POPULATED", "crosswalk_status": "NOT_APPLICABLE",
     "approval_status": "DRAFT_REVIEW_REQUIRED", "star_field_resolution": "NOT_RESOLVED", "sei_imds_logic_origin": "MISSING", "imds_type": "VARCHAR2(50)", "imds_nullable": "Yes", "business_decision": "N", "comparison_id": "EXISTING_LLP_ROW", "source_document": "pv.xlsx"},
]
S2S4 = [dict(r, source_sheet="PVAL File Mapping") for r in S2S] + [
    {"map_row_id": "l1", "feed_key": "PEDDIFI1", "feed_family": "PEDDIFI1", "star_field": "Entity Name", "star_field_norm": "ENTITY_NAME", "star_in_layout": "Y", "sei_object": None, "sei_field": None, "sei_source": None,
     "map_kind": "NO_MAPPING", "mapping_status": "NO_SEI_SOURCE", "approval_status": "DRAFT_REVIEW_REQUIRED", "open_dependency": "N", "source_sheet": "STAR_LAYOUT_DETAIL"}]
CTL4 = [{"control_name": "PEDDIFI1 \u2192 HOLDINGDBO.POSITION", "result": "4", "status": None, "detail": "FULLSEISTARIMDS=1", "seq": 1}]
WIDE = []


def fake4(sql, params=None):
    params = params or {}
    s = " ".join(sql.split())
    if "FROM sei_e2e_xwalk" in s:
        WIDE.append("sei_file_status" in s)
        rows = E2E4
        if "imds_table = :t" in s:
            rows = [r for r in rows if r["imds_table"] == params["t"]]
        if "link_class = :l" in s:
            rows = [r for r in rows if r["link_class"] == params["l"]]
        return [dict(r) for r in rows]
    if "FROM sei_control" in s and "LINEAGE_SUMMARY" in s:
        return [dict(r) for r in CTL4]
    if "FROM sei_star_field_map" in s:
        return [dict(r) for r in S2S4]
    return fake_query(sql, params)


R._safe = fake4
cv = R.e2e_coverage()
ok(cv["total"] == 5 and cv["in_scope"] == 3 and cv["covered"] == 2 and cv["coverage_pct"] == 66.7 and cv["not_populated"] == 1 and cv["star_only"] == 1,
   "coverage is over the paths in scope: an orphan STAR field and a column STAR never loads are not paths", cv["headline"])
tb = next(x for x in cv["tables"] if x["name"] == "HOLDINGDBO.POSITION")
ok(tb["rows"] == 4 and tb["in_scope"] == 3 and tb["coverage_pct"] == 66.7 and tb["not_populated"] == 1, "per table too, with the not-loaded count", tb)
ok([x["key"] for x in cv["by_link"]] == ["E2E", "SEI_DIRECT", "NO_SEI_SOURCE", "STAR_ONLY", "NOT_POPULATED"], "the two new classes, in order", cv["by_link"])
ok(cv["has_files"] and [x["key"] for x in cv["by_file_status"]] == ["VERIFIED_IN_FEED_SPEC", "SYSTEM_OR_CONSTANT", "NO_SEI_SOURCE"]
   and next(f for f in cv["files"] if f["file"] == "Taxlot") == {"file": "Taxlot", "paths": 1, "verified": 1, "tables": ["HOLDINGDBO.POSITION"], "feeds": ["PEDDIFI1"]}
   and [f["file"] for f in cv["files"]] == ["Account", "SYSTEM (job run)", "Taxlot"],
   "the SEI feed files behind the paths, with how well each resolved", cv["files"])
ok([x["key"] for x in cv["by_origin"]] == ["DOCUMENTED", "COMPOSED_FROM_STAR_LOGIC", "MISSING"] and cv["by_resolution"][0]["key"] == "DOCUMENTED",
   "logic origin and STAR field resolution tallied, documented first", cv["by_origin"])
ok(all(WIDE[:1]), "the wide select (sql/80 columns) is tried first")
fc = R.flow_candidates()
ok(fc["total"] == 3 and fc["excluded"] == {"STAR_ONLY": 1, "NOT_POPULATED": 1} and fc["bypass"] == [{"src": "SYSTEM (job run)", "tgt": "HOLDINGDBO.POSITION", "n": 1}]
   and {l["src"] for l in fc["left"]} == {"Taxlot", "no SEI source"},
   "the ribbon draws the paths in scope, named by the resolved SEI file", fc)
ls = R.lineage_summary()
ok(len(ls["rows"]) == 2 and ls["rows"][0]["imds_table"] == "HOLDINGDBO.POSITION" and ls["rows"][0]["full"] == 1 and ls["rows"][0]["full_pct"] == 25.0
   and ls["rows"][0]["covered_pct"] == 66.7 and ls["rows"][0]["composed"] == 1 and ls["rows"][1]["star_only"] == 1,
   "the lineage summary recomputed per feed and table: the sheet's full share and the in-scope share", ls["rows"])
ok(ls["total"]["rows"] == 5 and ls["total"]["full_pct"] == 20.0 and ls["sheet"] == CTL4, "the total, and the sheet's own rows beside")
rg = R.mapping_docs()
ok(rg["totals"]["s2s_from_layout"] == 1 and rg["totals"]["s2s_rows"] == 4 and "1 from the layout" in rg["headline"]
   and next(d for d in rg["docs"] if d["feed_family"] == "PEDDIFI1")["loaded"]["s2s_rows"] == 3,
   "the register counts the document's own rows; layout-added fields are counted apart", rg["totals"])
rows4 = R.e2e_rows(table="HOLDINGDBO.POSITION")["rows"]
ok(len(rows4) == 4 and rows4[0].get("sei_file_status"), "the drill rows carry the file columns")
# a warehouse that has not run sql/80: the wide select fails, the narrow one answers


def fake_old(sql, params=None):
    s = " ".join(sql.split())
    if "FROM sei_e2e_xwalk" in s:
        if "sei_file_status" in s:
            return []
        return [{k: v for k, v in r.items() if k not in ("sei_file", "sei_file_fields", "sei_file_status", "lineage_id", "star_field_resolution",
                                                           "sei_imds_logic_origin", "imds_type", "imds_nullable", "business_decision", "comparison_id")} for r in E2E4]
    return fake4(sql, params)


R._safe = fake_old
cvo = R.e2e_coverage()
ok(cvo["total"] == 5 and cvo["in_scope"] == 3 and not cvo["has_files"] and cvo["files"] == [] and cvo["by_file_status"] == [],
   "without sql/80 the narrow select answers: coverage as before, no files", cvo["headline"])

print("-- an empty warehouse")
R._safe = lambda sql, params=None: []
ok(R.mapping_docs()["totals"]["documents"] == 0 and R.e2e_coverage()["coverage_pct"] is None and R.transformation_summary()["tables"] == [],
   "nothing loaded: empty shapes, no error")

print(("\n%d assertion(s) failed" % bad) if bad else "\nmapping-docs api assertions pass")
sys.exit(1 if bad else 0)
