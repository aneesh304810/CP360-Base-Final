"""Write the SCD2 review workbook: one row per rule, three columns to fill.

Reads scd2_card / scd2_rule from the hub database (what the screen shows)
and writes an XLSX with the rule, its confidence and evidence locked as
reference, and BUSINESS_MEANING, CONFIRMED (Y/N) and REVIEWER_NOTE empty
for a named person to fill. Existing sign-offs are pre-filled so a second
round starts from the first.

    python tools/scd2_review_export.py --out local-data/scd2_review.xlsx [--table DIM_ACCOUNT]

The file is reviewed by people — Copilot may help them write — and comes
back through `python -m ingestion.run scd2_review`. Nothing in it is a
warehouse value.
"""
from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

HEAD = ["TABLE_NAME", "RULE_ID", "PATTERN", "RULE_TEXT", "CONFIDENCE", "EVIDENCE", "BUSINESS_MEANING", "CONFIRMED", "REVIEWER", "REVIEWER_NOTE"]
FILL_FROM = 6   # columns from BUSINESS_MEANING on are the reviewer's


def rows_from_hub(table: str | None = None) -> list[dict]:
    from api.app.db import query
    sql = """SELECT r.table_name, r.rule_id, c.pattern, r.rule_text, r.confidence, r.evidence,
                    v.business_meaning, v.confirmed, v.reviewer, v.reviewer_note
             FROM   scd2_rule r
             JOIN   scd2_card c ON c.table_name = r.table_name AND c.ran_at = r.ran_at
             LEFT JOIN scd2_rule_review v ON v.table_name = r.table_name AND v.rule_id = r.rule_id"""
    params = {}
    if table:
        sql += " WHERE r.table_name = :t"
        params["t"] = table.upper()
    sql += " ORDER BY r.table_name, TO_NUMBER(REGEXP_SUBSTR(r.rule_id, '[0-9]+'))"
    return query(sql, params)


def write_workbook(rows: list[dict], out: str) -> str:
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill, Protection
    from openpyxl.worksheet.datavalidation import DataValidation
    wb = Workbook()
    ws = wb.active
    ws.title = "rules"
    ws.append(HEAD)
    for i, c in enumerate(ws[1]):
        c.font = Font(name="Roboto", bold=True, color="FFFFFF", size=10)
        c.fill = PatternFill("solid", fgColor="10193B" if i < FILL_FROM else "0F4775")
    for r in rows:
        ws.append([r.get("table_name"), r.get("rule_id"), r.get("pattern"), r.get("rule_text"), r.get("confidence"), r.get("evidence"),
                   r.get("business_meaning") or "", r.get("confirmed") or "", r.get("reviewer") or "", r.get("reviewer_note") or ""])
    dv = DataValidation(type="list", formula1='"Y,N"', allow_blank=True, showErrorMessage=True, errorTitle="CONFIRMED", error="Y or N")
    ws.add_data_validation(dv)
    dv.add(f"H2:H{max(2, ws.max_row)}")
    for row in ws.iter_rows(min_row=2):
        for i, c in enumerate(row):
            c.font = Font(name="Roboto", size=10)
            c.alignment = Alignment(vertical="top", wrap_text=True)
            c.protection = Protection(locked=i < FILL_FROM)
    ws.protection.sheet = True
    ws.protection.enable()
    for col, w in zip("ABCDEFGHIJ", [24, 7, 18, 70, 18, 60, 50, 11, 18, 40]):
        ws.column_dimensions[col].width = w
    ws.freeze_panes = "C2"
    guide = wb.create_sheet("how to review")
    for line in [
        "One row per rule the tool read from the ODI export or measured in the warehouse.",
        "Columns A to F are the tool's and are locked. Fill G to J.",
        "BUSINESS_MEANING: the rule in one plain sentence a business owner would recognise.",
        "CONFIRMED: Y if the rule is right, N if it is wrong — then say why in REVIEWER_NOTE.",
        "REVIEWER: your name. A row without a reviewer is not loaded.",
        "A rule marked UNKNOWN_TRUNCATED cannot be confirmed from this sheet; ask for the untruncated export first.",
        "Never paste an account number, a client name or a hostname into this file.",
    ]:
        guide.append([line])
    guide.column_dimensions["A"].width = 110
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    wb.save(out)
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--out", required=True)
    ap.add_argument("--table")
    a = ap.parse_args(argv)
    rows = rows_from_hub(a.table)
    if not rows:
        print("no rules in scd2_rule — run `python -m ingestion.run scd2` first")
        return 1
    print(f"wrote {write_workbook(rows, a.out)} — {len(rows)} rules")
    return 0


if __name__ == "__main__":
    sys.exit(main())
