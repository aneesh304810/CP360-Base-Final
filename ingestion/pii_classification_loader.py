"""PII Classification loader — writes the PII dictionary."""
from __future__ import annotations

from .loader import Loader
from .pii_classification_conn import PiiBundle


class PiiClassificationLoader:
    def __init__(self, loader: Loader):
        self.loader = loader

    def load(self, bundle: PiiBundle) -> None:
        for c in bundle.classifications:
            self.loader._merge(
                "pii_classifications", ("pii_component_normalized",), {
                    "pii_component_normalized": c.pii_component_normalized,
                    "pii_component": c.pii_component, "pii_attribute": c.pii_attribute,
                    "sensitivity_category": c.sensitivity_category,
                    "sensitivity_level": c.sensitivity_level,
                    "source_xlsx_path": c.source_xlsx_path,
                })
        self.loader.commit()
