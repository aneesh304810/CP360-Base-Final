"""routers_admin_datasources.py — Admin · Data Sources.

Secrets are write-only: accepted in POST /admin/datasources, converted to a
stored reference server-side, and never present in any response.
"""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/admin/datasources", tags=["admin-datasources"])


def _reg():
    # lazy import so a broken engine env can never block API mounting
    from ingestion import datasource_registry as reg
    return reg


class DatasourceIn(BaseModel):
    name: str
    role: str | None = None
    method: str | None = "HOST"
    host: str | None = None
    port: int | None = None
    service: str | None = None
    ldap_alias: str | None = None
    tns_entry: str | None = None
    schemas: str | None = None
    username: str | None = None
    thick_mode: str | None = "Y"
    read_only: str | None = "Y"
    password: str | None = None       # one-time; converted to secret ref
    env_ref: str | None = None        # e.g. env:CP_DS_MYSRC_PWD


@router.get("")
def list_datasources():
    try:
        return {"sources": _reg().list_sources()}
    except Exception as e:                                  # noqa: BLE001
        return {"sources": [], "error": str(e)[:200]}


@router.post("")
def save_datasource(body: DatasourceIn):
    try:
        src = _reg().save_source(body.model_dump())
        return {"ok": True, "source": src}
    except Exception as e:                                  # noqa: BLE001
        return {"ok": False, "error": str(e)[:300]}


@router.delete("/{name}")
@router.post("/{name}/delete")
def delete_datasource(name: str):
    try:
        n = _reg().delete_source(name)
        return {"ok": bool(n), "deleted": n}
    except Exception as e:                                  # noqa: BLE001
        return {"ok": False, "error": str(e)[:300]}


@router.post("/{name}/test")
def test_datasource(name: str):
    try:
        return _reg().test_source(name)
    except Exception as e:                                  # noqa: BLE001
        return {"ok": False, "steps": [f"✗ {str(e)[:300]}"]}
