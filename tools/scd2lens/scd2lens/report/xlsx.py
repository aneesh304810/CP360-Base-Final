"""One workbook for every card: cards, rules, quality, dup_by_month, open_questions.

Styled to the CP Catalog standard: Roboto, navy header, accent on the
table names.
"""
from __future__ import annotations

from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

from ..rules.model import RuleCard

NAVY, ACCENT = "10193B", "0F4775"


def _sheet(wb: Workbook, name: str, head: list[str], rows: list[list], widths: list[int] | None = None):
    ws = wb.create_sheet(name)
    ws.append(head)
    for c in ws[1]:
        c.font = Font(name="Roboto", bold=True, color="FFFFFF", size=10)
        c.fill = PatternFill("solid", fgColor=NAVY)
        c.alignment = Alignment(vertical="center")
    for r in rows:
        ws.append(r)
    for row in ws.iter_rows(min_row=2):
        for c in row:
            c.font = Font(name="Roboto", size=10)
            c.alignment = Alignment(vertical="top", wrap_text=True)
        if row:
            row[0].font = Font(name="Roboto", size=10, bold=True, color=ACCENT)
    for i, w in enumerate(widths or [], start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = "A2"
    return ws


def write_xlsx(cards: list[RuleCard], path: str | Path) -> Path:
    wb = Workbook()
    wb.remove(wb.active)
    _sheet(wb, "cards", ["table", "pattern", "scan_verdict", "writers", "surrogate_key", "natural_key", "version_key", "partition", "rules", "open_questions"],
           [[c.table, c.pattern, c.scan_verdict or "", ", ".join(c.writers), c.surrogate_key or "", ", ".join(c.natural_key), ", ".join(c.version_key),
             f"{c.partition.column}: " + ", ".join(f"{v}→{s}" for v, s in c.partition.values.items()) if c.partition else "",
             len(c.rules), len(c.open_questions)] for c in cards],
           [26, 20, 16, 40, 18, 24, 28, 36, 8, 14])
    _sheet(wb, "rules", ["table", "id", "rule", "confidence", "evidence"],
           [[c.table, r.id, r.text, r.confidence, r.evidence] for c in cards for r in c.rules], [26, 6, 80, 18, 70])
    _sheet(wb, "quality", ["table", "rows", "dup_rows", "dup_pct", "dup_keys", "gaps", "overlaps", "multiple_open", "none_open",
                           "active_ind_open_not_flagged", "active_ind_closed_but_flagged", "freshness_alert", "volume_alerts"],
           [[c.table, c.quality.rows, c.quality.dup_rows, c.quality.dup_pct, c.quality.dup_keys, c.quality.gaps, c.quality.overlaps,
             c.quality.multiple_open, c.quality.none_open, c.quality.active_ind_open_not_flagged, c.quality.active_ind_closed_but_flagged,
             c.quality.freshness_alert or "", "; ".join(c.quality.volume_alerts)] for c in cards], [26] + [12] * 11 + [40])
    _sheet(wb, "dup_by_month", ["table", "month", "versions", "dup_rows"],
           [[c.table, m.get("month"), m.get("versions"), m.get("dup_rows")] for c in cards for m in c.quality.dup_by_month], [26, 10, 10, 10])
    _sheet(wb, "open_questions", ["table", "question"], [[c.table, o] for c in cards for o in c.open_questions], [26, 100])
    _sheet(wb, "catalog_mapping", ["table", "pbdw_column", "data360_attribute"],
           [[c.table, k, v] for c in cards for k, v in c.catalog_mapping.items()], [26, 30, 30])
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(path)
    return path
