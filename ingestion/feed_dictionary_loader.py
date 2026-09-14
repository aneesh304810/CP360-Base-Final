"""Feed Dictionary loader — writes FEED datasets, columns, enumerations."""
from __future__ import annotations

from .loader import Loader
from .model import column_key
from .feed_dictionary_conn import FeedDictionaryBundle


class FeedDictionaryLoader:
    def __init__(self, loader: Loader):
        self.loader = loader

    def load(self, bundle: FeedDictionaryBundle) -> None:
        for ds in bundle.datasets:
            self.loader._merge(
                "datasets", ("platform_id", "schema_name", "object_name"), {
                    "platform_id": ds.platform_id, "schema_name": ds.schema,
                    "object_name": ds.object_name, "object_type": ds.object_type,
                    "project_id": ds.project_id, "layer": ds.layer,
                    "tech_desc": ds.tech_desc, "feed_class": ds.feed_class,
                    "geography": ds.geography, "regulatory_scope": ds.regulatory_scope,
                    "source_xlsx_path": ds.source_xlsx_path,
                },
                protect=("business_desc", "owner", "tags"))
            for c in ds.columns:
                self.loader._merge(
                    "columns",
                    ("platform_id", "schema_name", "object_name", "column_name"), {
                        "platform_id": ds.platform_id, "schema_name": ds.schema,
                        "object_name": ds.object_name, "column_name": c.name,
                        "position_order": c.position_order, "data_type": c.data_type,
                        "base_data_type": c.base_data_type, "data_format": c.data_format,
                        "max_length": c.max_length, "precision": c.precision,
                        "scale": c.scale, "nullable": "Y" if c.nullable else "N",
                        "is_pk": "Y" if c.is_pk else "N", "tech_desc": c.tech_desc,
                    },
                    protect=("business_desc", "is_pii", "pii_category", "pii_attribute"))
            for enum in bundle.enumerations.get(ds.key, []):
                self.loader._merge(
                    "column_enumerations",
                    ("platform_id", "schema_name", "object_name", "column_name", "enum_value"), {
                        "platform_id": ds.platform_id, "schema_name": ds.schema,
                        "object_name": ds.object_name, "column_name": enum.column_name,
                        "enum_value": enum.enum_value, "enum_label": enum.enum_label,
                    })
        self.loader.commit()
