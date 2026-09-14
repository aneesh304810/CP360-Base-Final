"""Base connector. All connectors extend this and write only via loader._merge."""
from __future__ import annotations
import logging
from abc import ABC

log = logging.getLogger("cp.ingestion")


class BaseConnector(ABC):
    """Connectors parse a source and return a dataclass bundle; the loader
    persists it. Connectors never run SQL directly."""

    name: str = "base"

    @classmethod
    def from_env(cls):  # pragma: no cover - overridden by subclasses
        raise NotImplementedError(f"{cls.__name__} must implement from_env()")
