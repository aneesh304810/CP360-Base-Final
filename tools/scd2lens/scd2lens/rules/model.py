"""The rule card: what every report is rendered from."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

PROVEN, INFERRED, UNKNOWN_TRUNCATED = "PROVEN", "INFERRED", "UNKNOWN_TRUNCATED"


class Rule(BaseModel):
    id: str
    text: str
    confidence: str
    evidence: str


class Partition(BaseModel):
    column: str
    values: dict[str, str] = Field(default_factory=dict)   # value -> scenario


class Quality(BaseModel):
    rows: int | None = None
    dup_rows: int | None = None
    dup_pct: float | None = None
    dup_keys: int | None = None
    bad_windows: int | None = None
    gaps: int | None = None
    overlaps: int | None = None
    multiple_open: int | None = None
    none_open: int | None = None
    active_ind_open_not_flagged: int | None = None
    active_ind_closed_but_flagged: int | None = None
    freshness_alert: str | None = None
    volume_alerts: list[str] = Field(default_factory=list)
    dup_by_month: list[dict[str, Any]] = Field(default_factory=list)


class RuleCard(BaseModel):
    table: str
    pattern: str
    writers: list[str] = Field(default_factory=list)
    surrogate_key: str | None = None
    natural_key: list[str] = Field(default_factory=list)
    partition: Partition | None = None
    version_key: list[str] = Field(default_factory=list)
    rules: list[Rule] = Field(default_factory=list)
    quality: Quality = Field(default_factory=Quality)
    catalog_mapping: dict[str, str] = Field(default_factory=dict)
    open_questions: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
    scan_verdict: str | None = None
