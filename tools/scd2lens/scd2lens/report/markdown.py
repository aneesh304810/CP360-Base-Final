from __future__ import annotations

from jinja2 import Template

from ..rules.model import RuleCard

_T = Template("""# {{ c.table }} — SCD2 rule card

**Pattern:** {{ c.pattern }}{% if c.scan_verdict %} · column scan said {{ c.scan_verdict }}{% endif %}
**Writers:** {{ c.writers | join(', ') or '—' }}
**Surrogate key:** {{ c.surrogate_key or '—' }} · **Natural key:** {{ c.natural_key | join(', ') or '—' }} · **Version key:** {{ c.version_key | join(', ') or '—' }}
{% if c.partition %}**Sub-populations:** {{ c.partition.column }} → {% for v, s in c.partition.values.items() %}{{ v }}: {{ s }}{{ ', ' if not loop.last }}{% endfor %}
{% endif %}
## Rules

| Id | Rule | Confidence | Evidence |
|---|---|---|---|
{% for r in c.rules %}| {{ r.id }} | {{ r.text }} | {{ r.confidence }} | {{ r.evidence }} |
{% endfor %}
## Quality
{% set q = c.quality %}
| Measure | Value |
|---|---|
| rows | {{ q.rows if q.rows is not none else 'not profiled' }} |
| duplicate versions | {{ q.dup_rows if q.dup_rows is not none else '—' }}{% if q.dup_pct is not none %} ({{ q.dup_pct }}%) over {{ q.dup_keys }} keys{% endif %} |
| windows with gaps / overlaps | {{ q.gaps if q.gaps is not none else '—' }} / {{ q.overlaps if q.overlaps is not none else '—' }} |
| keys with several open rows / none open | {{ q.multiple_open if q.multiple_open is not none else '—' }} / {{ q.none_open if q.none_open is not none else '—' }} |
| ACTIVE_IND disagreeing with END_DATE | open not flagged {{ q.active_ind_open_not_flagged if q.active_ind_open_not_flagged is not none else '—' }} · closed but flagged {{ q.active_ind_closed_but_flagged if q.active_ind_closed_but_flagged is not none else '—' }} |
| freshness | {{ q.freshness_alert or 'ok' }} |
{% if q.volume_alerts %}| volume | {{ q.volume_alerts | join('; ') }} |
{% endif %}
## Catalog mapping

| PBDW column | Data 360 attribute |
|---|---|
{% for k, v in c.catalog_mapping.items() %}| {{ k }} | {{ v }} |
{% endfor %}{% if c.open_questions %}
## Open questions
{% for o in c.open_questions %}- {{ o }}
{% endfor %}{% endif %}{% if c.notes %}
## Notes
{% for o in c.notes %}- {{ o }}
{% endfor %}{% endif %}""")


def render_markdown(card: RuleCard) -> str:
    return _T.render(c=card)
