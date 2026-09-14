"""Interface 360 model."""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Interface:
    interface_id: str
    domain: Optional[str] = None
    date_of_update: Optional[str] = None
    scope: Optional[str] = None
    update_owner: Optional[str] = None
    application: Optional[str] = None
    integration_name: Optional[str] = None
    description: Optional[str] = None
    feed_type: Optional[str] = None
    source_system: Optional[str] = None
    source_party: Optional[str] = None
    target_system: Optional[str] = None
    target_party: Optional[str] = None
    direction: Optional[str] = None
    direct_feed: str = "N"
    feed_routing: Optional[str] = None
    intraday: str = "N"
    eod_overnight: str = "N"
    frequency: Optional[str] = None
    extract_type: Optional[str] = None
    app_owner: Optional[str] = None
    migration_flag: str = "N"
    type_app_extract: Optional[str] = None
    improvement: Optional[str] = None
    notes: Optional[str] = None
    source_project_id: str = "internal"
    target_project_id: str = "internal"
    routing_hops: list[str] = field(default_factory=list)


@dataclass
class Interface360Bundle:
    interfaces: list[Interface] = field(default_factory=list)
