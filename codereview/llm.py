"""The optional model-backed reviewer: the same instructions and standards
as the Copilot pack, answered by Claude through the Anthropic SDK when an
API key is present. Nothing imports this unless CR_LLM=anthropic."""
from __future__ import annotations

import os

from .pack import INSTRUCTIONS
from .standards import digest

MODEL = os.environ.get("CR_MODEL", "claude-opus-5-5")


def available():
    try:
        import anthropic  # noqa: F401
    except ImportError:
        return False
    return bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))


def review(diff_md, rule_findings_md):
    """The answer text in the output contract, or raises."""
    import anthropic
    client = anthropic.Anthropic()
    system = [
        {"type": "text", "text": INSTRUCTIONS, "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": digest(), "cache_control": {"type": "ephemeral"}},
    ]
    user = rule_findings_md + "\n\n---\n\n" + diff_md + "\n\nReview this change as the instructions say and answer in the output contract."
    with client.beta.messages.stream(
        model=MODEL, max_tokens=32000,
        betas=["server-side-fallback-2026-07-01"], fallbacks="default",
        output_config={"effort": "high"},
        system=system, messages=[{"role": "user", "content": user}],
    ) as stream:
        msg = stream.get_final_message()
    if msg.stop_reason == "refusal":
        raise RuntimeError("the model declined to review this change")
    return "".join(b.text for b in msg.content if b.type == "text")
