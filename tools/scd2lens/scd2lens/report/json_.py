from __future__ import annotations

import json

from ..rules.model import RuleCard


def render_json(card: RuleCard) -> str:
    return json.dumps(card.model_dump(), indent=2, default=str)
