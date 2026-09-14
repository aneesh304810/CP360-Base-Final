"""
Project connector registry — the framework hook for project-extensible ingestion.

A new (non-SEI) project = a new set of Excel files with its OWN connector (because
its feed/loader structure is totally different). Register that connector here, keyed
by (project_id, source_key), and the orchestrator will use it for that project.

SEI uses the built-in connectors. To onboard a new project "acme":
  1. Write a connector class (e.g. AcmeFeedConnector) that parses acme's files and
     writes to the same catalog tables with project_id="acme".
  2. Register it:  register("acme", "inbound_feeds", AcmeFeedConnector)
  3. Add a row to project_sources (sql or MERGE) so it shows on the landing page.
  4. Set the env var its from_env() reads, and run ingestion.

Storage is unified (same tables, project_id column); only PARSING differs per project.
"""
from __future__ import annotations
import logging

log = logging.getLogger("cp.project_registry")

# (project_id, source_key) -> connector class
_REGISTRY: dict[tuple, object] = {}


def register(project_id: str, source_key: str, connector_cls):
    """Register a connector for a project's source. Later registration overrides."""
    _REGISTRY[(project_id.lower(), source_key.lower())] = connector_cls
    log.info("registered connector %s for %s/%s",
             getattr(connector_cls, "__name__", connector_cls), project_id, source_key)


def get_connector(project_id: str, source_key: str, default=None):
    """Resolve the connector for a project's source, falling back to a default
    (the SEI/built-in connector) when the project hasn't registered its own."""
    return _REGISTRY.get((project_id.lower(), source_key.lower()), default)


def registered_projects() -> set:
    return {k[0] for k in _REGISTRY}


# --- SEI built-ins (the default project) ---
def _register_sei_defaults():
    try:
        from .feed_dictionary_conn import FeedDictionaryConnector
        register("sei", "inbound_feeds", FeedDictionaryConnector)
    except Exception:
        pass
    try:
        from .loader_workbook_conn import LoaderWorkbookConnector
        register("sei", "loaders", LoaderWorkbookConnector)
    except Exception:
        pass


_register_sei_defaults()
