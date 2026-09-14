"""Shared normalized model for CP Catalog ingestion."""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional


def dataset_key(platform_id: str, schema: str, obj: str) -> str:
    return f"{platform_id}.{schema}.{obj}".lower()


def column_key(ds_key: str, column: str) -> str:
    return f"{ds_key}.{column}".lower()


@dataclass
class Column:
    name: str
    position_order: int = 0
    data_type: Optional[str] = None
    base_data_type: Optional[str] = None
    data_format: Optional[str] = None
    max_length: Optional[int] = None
    precision: Optional[int] = None
    scale: Optional[int] = None
    nullable: bool = True
    is_pk: bool = False
    is_reference: bool = False
    tech_desc: Optional[str] = None


@dataclass
class Dataset:
    platform_id: str
    schema: str
    object_name: str
    object_type: str = "TABLE"   # TABLE|VIEW|FEED|MODEL|DAG
    project_id: str = "internal"
    layer: Optional[str] = None
    domain: Optional[str] = None
    tech_desc: Optional[str] = None
    owner: Optional[str] = None
    tags: Optional[str] = None
    source_xlsx_path: Optional[str] = None
    position_order: Optional[int] = None
    feed_class: Optional[str] = None
    geography: Optional[str] = None
    regulatory_scope: Optional[str] = None
    columns: list[Column] = field(default_factory=list)

    @property
    def key(self) -> str:
        return dataset_key(self.platform_id, self.schema, self.object_name)
