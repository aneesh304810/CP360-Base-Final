"""Auto Mapper router — onboard an external schema (e.g. a Plaid / FDX
aggregator) by mapping its fields into a CP source system (PBDW / IMD).

Standalone utility: nothing is written to the catalog until /commit, and
commits are tagged source='auto_mapper' (pending review) in column_lineage
plus a full audit trail in mapper_runs / mapper_results.
"""
from __future__ import annotations

import csv
import io
import json
import logging
import time

from fastapi import APIRouter
from pydantic import BaseModel

from .db import query, get_pool
from .mapper_scoring import score_field

log = logging.getLogger("cp.api.mapper")
router = APIRouter(prefix="/mapper", tags=["mapper"])


def _safe(sql, params=None):
    try:
        return query(sql, params or {})
    except Exception as e:  # noqa: BLE001
        log.warning("mapper query failed: %s", str(e)[:160])
        return []


# ----------------------------------------------------------------- targets
@router.get("/targets")
def targets():
    """Schemas the mapper can map INTO, with column/table counts."""
    rows = _safe(
        """SELECT schema_name, COUNT(*) AS cols,
                  COUNT(DISTINCT object_name) AS tabs
             FROM columns GROUP BY schema_name ORDER BY cols DESC""")
    return {"targets": [
        {"schema": r["schema_name"], "columns": r["cols"], "tables": r["tabs"]}
        for r in rows]}


# ------------------------------------------------------------------- parse
class ParseBody(BaseModel):
    name: str                 # uploaded file name
    content: str              # raw CSV text or JSON array
    format: str = "csv"       # csv | json


@router.post("/parse")
def parse(body: ParseBody):
    """Parse an uploaded structure into fields.
    CSV columns (header required, order-free):
      field_name, type, description, sample   (extra sample columns allowed)
    JSON: [{"name": ..., "type": ..., "description": ..., "samples": [...]}]"""
    fields = []
    try:
        if body.format == "json":
            for row in json.loads(body.content):
                fields.append({
                    "name": row.get("name") or row.get("field_name"),
                    "type": row.get("type") or "STRING",
                    "description": row.get("description") or "",
                    "samples": row.get("samples")
                        or ([row["sample"]] if row.get("sample") else []),
                })
        else:
            reader = csv.DictReader(io.StringIO(body.content))
            for row in reader:
                low = {(k or "").strip().lower(): (v or "").strip()
                       for k, v in row.items()}
                name = low.get("field_name") or low.get("name") or low.get("field")
                if not name:
                    continue
                samples = [v for k, v in low.items()
                           if k.startswith("sample") and v]
                fields.append({
                    "name": name,
                    "type": low.get("type") or low.get("data_type") or "STRING",
                    "description": low.get("description") or "",
                    "samples": samples,
                })
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": f"could not parse: {str(e)[:200]}"}
    if not fields:
        return {"ok": False,
                "error": "no fields found — need a header row with "
                         "field_name/name, type, description, sample"}
    return {"ok": True, "name": body.name, "fields": fields}


# ------------------------------------------------------------------- score
class ScoreBody(BaseModel):
    target_schema: str        # e.g. PBDW
    fields: list[dict]        # output of /parse


@router.post("/score")
def score(body: ScoreBody):
    candidates = _safe(
        """SELECT schema_name, object_name, column_name, data_type,
                  max_length, precision, business_desc, is_pii
             FROM columns WHERE UPPER(schema_name) = UPPER(:s)""",
        {"s": body.target_schema})
    if not candidates:
        return {"ok": False,
                "error": f"no columns harvested for schema {body.target_schema} "
                         "— run the oracle ingestion step first"}
    results = [score_field(f, candidates) for f in body.fields]
    high = sum(1 for r in results if r["best"] and r["best"]["confidence"] >= 0.9)
    review = sum(1 for r in results
                 if r["best"] and 0.6 <= r["best"]["confidence"] < 0.9)
    unmatched = sum(1 for r in results if r["unmapped"])
    return {"ok": True, "target_schema": body.target_schema.upper(),
            "results": results,
            "summary": {"high": high, "review": review, "unmatched": unmatched,
                        "total": len(results)}}


# ------------------------------------------------------------------ commit
class CommitMapping(BaseModel):
    field_name: str
    field_type: str | None = None
    target_key: str | None = None      # None => unmatched, audit only
    confidence: float | None = None
    parts: dict | None = None
    rationale: str | None = None
    alternatives: list | None = None
    verdict: str | None = None         # ACC | REJ | None


class CommitBody(BaseModel):
    source_name: str                   # e.g. plaid_core_exchange_fields.csv
    target_schema: str
    mappings: list[CommitMapping]
    threshold_note: str | None = None
    created_by: str | None = None


@router.post("/commit")
def commit(body: CommitBody):
    run_id = f"map-{int(time.time())}"
    accepted = [m for m in body.mappings if m.verdict == "ACC" and m.target_key]
    mapped = [m for m in body.mappings if m.target_key]
    try:
        with get_pool().acquire() as conn:
            cur = conn.cursor()

            def merge(table, pk, values):
                cols = list(values.keys())
                sel = ", ".join(f":{c} AS {c}" for c in cols)
                on = " AND ".join(f"t.{k} = s.{k}" for k in pk)
                upd = ", ".join(f"t.{c} = s.{c}" for c in cols if c not in pk)
                cur.execute(
                    f"MERGE INTO {table} t USING (SELECT {sel} FROM dual) s "
                    f"ON ({on}) WHEN MATCHED THEN UPDATE SET {upd} "
                    f"WHEN NOT MATCHED THEN INSERT ({', '.join(cols)}) "
                    f"VALUES ({', '.join('s.' + c for c in cols)})", values)

            merge("mapper_runs", ("run_id",), {
                "run_id": run_id, "source_name": body.source_name,
                "target_schema": body.target_schema.upper(),
                "field_count": len(body.mappings),
                "mapped_count": len(mapped),
                "accepted_count": len(accepted),
                "threshold_note": body.threshold_note,
                "created_by": body.created_by or "cp360-ui"})

            for m in body.mappings:
                p = m.parts or {}
                merge("mapper_results", ("run_id", "field_name"), {
                    "run_id": run_id, "field_name": m.field_name,
                    "field_type": m.field_type, "target_key": m.target_key,
                    "confidence": m.confidence,
                    "part_name": p.get("name"), "part_type": p.get("type"),
                    "part_embed": p.get("embed"), "part_value": p.get("value"),
                    "rationale": m.rationale,
                    "alternatives": json.dumps(m.alternatives or []),
                    "verdict": m.verdict})

            # accepted mappings surface in lineage immediately, flagged
            # as machine-suggested + human-accepted, pending review
            src_root = body.source_name.rsplit(".", 1)[0].upper()
            for m in accepted:
                from_col = f"EXT.{src_root}.{m.field_name.upper()}"
                merge("column_lineage", ("edge_id",), {
                    "edge_id": f"{from_col}->{m.target_key}"[:1320],
                    "from_column": from_col, "to_column": m.target_key,
                    "transform_expr": f"auto_mapper run {run_id} "
                                      f"(conf {m.confidence}) — pending review",
                    "source": "auto_mapper", "model_key": run_id})
            conn.commit()
            cur.close()
        return {"ok": True, "run_id": run_id,
                "committed": len(accepted), "audited": len(body.mappings)}
    except Exception as e:  # noqa: BLE001
        log.exception("mapper commit failed")
        return {"ok": False, "error": str(e)[:200]}


@router.get("/runs")
def runs(limit: int = 20):
    rows = _safe(
        """SELECT run_id, source_name, target_schema, field_count,
                  mapped_count, accepted_count,
                  TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') AS created_at
             FROM mapper_runs ORDER BY created_at DESC
            FETCH FIRST :lim ROWS ONLY""", {"lim": max(1, min(limit, 100))})
    return {"runs": rows}
