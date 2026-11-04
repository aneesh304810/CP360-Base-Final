"""Cyber Security 360: the application inventory and its scan coverage.

    GET  /cyber360/apps          every application, the change log, a summary
    GET  /cyber360/apps.xlsx     the inventory as an Excel workbook: Inventory, Not scanned, Change log
    GET  /cyber360/systems       the systems Interface 360 knows, with the owner it can derive, and whether each is in the inventory
    GET  /cyber360/whoami        what the server can tell about the caller
    POST /cyber360/apps/save     one application, created or updated; changed fields are logged
    POST /cyber360/apps/seed     the starter rows the page ships, inserted where the id is not yet there
    POST /cyber360/apps/import   Interface 360 systems as inventory rows, scan status not yet declared

THE SYSTEM LIST COMES FROM INTERFACE 360. interface360_systems names every
system an interface touches; the owner is derived as the most frequent
update_owner on that system's interfaces, else the API catalog's owner
for a system of the same name. An imported row starts with scan_status
UNKNOWN: the developer who owns it declares whether it is scanned and,
when it is not, why a scan is not required.

THE STARTER INVENTORY SHIPS WITH THE UI (ui/src/cyber360Api.js), read
from the Application Scans thread; the page shows it as unsaved until
someone saves it here, so an empty warehouse never looks like an
empty estate. After that the rows here are the inventory.

ONE APPLICATION PER WRITE. A save is a MERGE on app_id plus one log row
per field that changed, so two reviewers editing different applications
never overwrite each other, and the decision on a constraint keeps who
made it and what it replaced.

IDENTITY comes from hub_identity as everywhere else: the session or the
proxy header when there is one, else the declared name, recorded as such.
Nothing on a row is a hostname, an address or a credential; runtime is a
schedule or platform name.
"""
from __future__ import annotations

import io
import logging
import re
import time
import uuid

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel

from .db import query, execute
from .hub_identity import whoami

log = logging.getLogger("cp.api.cyber360")
router = APIRouter(prefix="/cyber360", tags=["cyber360"])

CLASSES = ("HOME_GROWN", "VENDOR_MANAGED_CODE", "VENDOR_PACKAGE", "SAAS")
SURFACES = ("WEB", "API", "BATCH", "SERVICE", "DESKTOP", "PLATFORM")
SCAN = ("UNKNOWN", "SCANNED", "SERVER_ONLY", "NOT_SCANNED")
CONSTRAINTS = ("NONE", "NO_WEB_SURFACE", "VENDOR_BINARY", "DESKTOP_EMULATOR", "SERVER_SCAN_ONLY", "LEGACY_STACK_RETIRING", "SAAS_VENDOR_HOSTED", "OTHER")
VALID = ("YES", "NO", "TBD")
LIFECYCLE = ("ACTIVE", "RETIRING", "RETIRED")
DEVSECOPS = ("NONE", "PARTIAL", "INTEGRATED", "NOT_APPLICABLE")

FIELDS = {"app_name": 200, "app_class": 24, "category": 120, "runtime": 200, "tech_stack": 200, "surface": 20, "scan_status": 20, "scan_types": 200,
          "constraint_kind": 30, "constraint_text": 2000, "constraint_valid": 10, "recommended_control": 400, "action": 400, "owner_team": 120,
          "devsecops_integration": 20, "devsecops_detail": 400, "lifecycle": 20, "notes": 2000, "source_ref": 200}
ENUMS = {"app_class": CLASSES, "surface": SURFACES, "scan_status": SCAN, "constraint_kind": CONSTRAINTS, "constraint_valid": VALID, "lifecycle": LIFECYCLE,
         "devsecops_integration": DEVSECOPS}
HELP = {"app_class": "home-grown; vendor application whose code we manage; vendor package; SaaS",
        "surface": "what a scanner would see: a web UI, an API, batch under a scheduler, a service, a desktop client, a platform",
        "scan_status": "UNKNOWN until the owner declares it; SCANNED through the application scan; SERVER_ONLY the host scan only; NOT_SCANNED",
        "constraint_kind": "why the application scan does not apply; NONE means it should be scanned",
        "constraint_valid": "the scan group's decision on the constraint: YES accepted, NO scan it, TBD to review",
        "lifecycle": "ACTIVE, RETIRING (date in notes), RETIRED",
        "devsecops_integration": "is the code in the DevSecOps pipeline: NONE, PARTIAL (some checks), INTEGRATED (SAST, SCA, secrets, DAST where it applies), NOT_APPLICABLE (vendor or SaaS)"}
# a row must never carry an address or a host: the inventory names applications, not machines
FORBIDDEN = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+|https?://|\b\d{1,3}(\.\d{1,3}){3}\b", re.I)


def _safe(sql, params=None):
    try:
        return query(sql, params or {})
    except Exception as e:  # noqa: BLE001
        log.warning("cyber360 query failed: %s", str(e)[:160])
        return []


def _write(statements):
    try:
        execute(statements)
        return True
    except Exception as e:  # noqa: BLE001
        log.warning("cyber360 write failed: %s", str(e)[:200])
        return False


def _ts(v):
    return v.isoformat(sep=" ", timespec="minutes") if hasattr(v, "isoformat") else (v or None)


def _nid(prefix):
    return f"{prefix}{int(time.time() * 1000)}{uuid.uuid4().hex[:6]}"


def _actor(request, declared):
    w = whoami(request)
    if w.get("verified") and w.get("lanId"):
        return w["lanId"][:120], w["source"]
    s = str(declared or "").strip()
    if not s:
        raise HTTPException(400, "name required: sign-in is off, so say who you are")
    return s[:120], "none"


def clean(app: dict) -> dict:
    """The row as it will be stored: every field clipped to its column,
    enumerations upper-cased and checked, no address or host anywhere."""
    out = {}
    for f, width in FIELDS.items():
        v = app.get(f)
        v = "" if v is None else str(v).strip()
        if f in ENUMS:
            v = v.upper().replace(" ", "_").replace("-", "_")
            if f in ("app_class", "scan_status") and not v:
                raise HTTPException(422, f"{f} is required")
            if v and v not in ENUMS[f]:
                raise HTTPException(422, f"{f} must be one of {', '.join(ENUMS[f])}")
            if not v:
                v = {"constraint_valid": "TBD", "lifecycle": "ACTIVE", "constraint_kind": "NONE", "devsecops_integration": "NONE"}.get(f, "")
        if FORBIDDEN.search(v):
            raise HTTPException(422, f"{f} carries an address, URL or host; the inventory names applications, not machines or people")
        out[f] = v[:width] or None
    if not out["app_name"]:
        raise HTTPException(422, "app_name is required")
    if out["scan_status"] == "SCANNED" and out["constraint_kind"] not in (None, "NONE"):
        out["constraint_kind"] = "NONE"                         # a scanned application has no constraint to review
    return out


def _app_id(v):
    s = re.sub(r"[^A-Za-z0-9_-]", "", str(v or "").strip())[:40]
    return s or _nid("cs")


def _row(r):
    d = {k: r.get(k) for k in ("app_id", *FIELDS, "updated_by", "id_source")}
    d["updated_at"] = _ts(r.get("updated_at"))
    d["created_at"] = _ts(r.get("created_at"))
    return d


def summary(apps):
    unscanned = [a for a in apps if a.get("scan_status") in ("SERVER_ONLY", "NOT_SCANNED") and a.get("lifecycle") != "RETIRED"]
    return {"apps": len(apps), "scanned": sum(1 for a in apps if a.get("scan_status") == "SCANNED"),
            "unknown": sum(1 for a in apps if (a.get("scan_status") or "UNKNOWN") == "UNKNOWN"),
            "serverOnly": sum(1 for a in apps if a.get("scan_status") == "SERVER_ONLY"),
            "notScanned": sum(1 for a in apps if a.get("scan_status") == "NOT_SCANNED"),
            "retiring": sum(1 for a in apps if a.get("lifecycle") == "RETIRING"),
            "toScan": sum(1 for a in unscanned if a.get("constraint_valid") == "NO"),
            "toReview": sum(1 for a in unscanned if (a.get("constraint_valid") or "TBD") == "TBD"),
            "accepted": sum(1 for a in unscanned if a.get("constraint_valid") == "YES"),
            "byClass": {c: sum(1 for a in apps if a.get("app_class") == c) for c in CLASSES}}


def _state():
    apps = [_row(r) for r in _safe("SELECT * FROM cyber_app ORDER BY app_class, app_name")]
    log_ = [{"id": r["log_id"], "appId": r["app_id"], "field": r["field"], "before": r.get("before_v"), "after": r.get("after_v"),
             "author": r.get("author"), "idSource": r.get("id_source"), "at": _ts(r.get("created_at"))}
            for r in _safe("SELECT log_id, app_id, field, before_v, after_v, author, id_source, created_at FROM cyber_app_log ORDER BY created_at DESC, log_id DESC FETCH FIRST 500 ROWS ONLY")]
    return {"apps": apps, "log": log_, "summary": summary(apps)}


@router.get("/whoami")
def who(request: Request):
    return whoami(request)


@router.get("/apps")
def get_apps():
    st = _state()
    return {**st, "persisted": True}


class SaveBody(BaseModel):
    app: dict
    actor: str | None = None


class SeedBody(BaseModel):
    apps: list[dict]
    actor: str | None = None


def _merge(app_id, row, actor, source):
    cols = list(FIELDS)
    sel = ", ".join(f":{c} AS {c}" for c in cols)
    upd = ", ".join(f"t.{c} = s.{c}" for c in cols)
    return (f"MERGE INTO cyber_app t USING (SELECT :app_id AS app_id, {sel} FROM dual) s ON (t.app_id = s.app_id) "
            f"WHEN MATCHED THEN UPDATE SET {upd}, t.updated_by = :updated_by, t.id_source = :id_source, t.updated_at = SYSTIMESTAMP "
            f"WHEN NOT MATCHED THEN INSERT (app_id, {', '.join(cols)}, updated_by, id_source) VALUES (s.app_id, {', '.join('s.' + c for c in cols)}, :updated_by, :id_source)",
            {"app_id": app_id, **row, "updated_by": actor, "id_source": source})


def _log_rows(app_id, before, row, actor, source):
    out = []
    for f in FIELDS:
        b = (before or {}).get(f)
        if (before is None and row.get(f)) or (before is not None and (b or None) != (row.get(f) or None)):
            out.append(("INSERT INTO cyber_app_log (log_id, app_id, field, before_v, after_v, author, id_source) VALUES (:i, :a, :f, :b, :v, :u, :o)",
                        {"i": _nid("l"), "a": app_id, "f": f, "b": (b or "")[:2000] or None, "v": (row.get(f) or "")[:2000] or None, "u": actor, "o": source}))
    return out


@router.post("/apps/save")
def save_app(body: SaveBody, request: Request):
    actor, source = _actor(request, body.actor)
    row = clean(body.app)
    app_id = _app_id(body.app.get("app_id"))
    before = _safe("SELECT * FROM cyber_app WHERE app_id = :i", {"i": app_id})
    st = [_merge(app_id, row, actor, source)] + _log_rows(app_id, before[0] if before else None, row, actor, source)
    if not _write(st):
        raise HTTPException(503, "the inventory tables are not reachable; nothing was saved")
    return {**_state(), "persisted": True, "appId": app_id}


@router.post("/apps/seed")
def seed_apps(body: SeedBody, request: Request):
    """The starter rows, inserted only where the id is not already there:
    a row someone has edited is never put back to the shipped text."""
    actor, source = _actor(request, body.actor)
    have = {r["app_id"] for r in _safe("SELECT app_id FROM cyber_app")}
    st, added = [], 0
    for a in body.apps[:200]:
        app_id = _app_id(a.get("app_id"))
        if app_id in have:
            continue
        row = clean(a)
        st.append(_merge(app_id, row, actor, source))
        st.append(("INSERT INTO cyber_app_log (log_id, app_id, field, before_v, after_v, author, id_source) VALUES (:i, :a, 'seed', NULL, :v, :u, :o)",
                   {"i": _nid("l"), "a": app_id, "v": (row.get("source_ref") or "starter inventory")[:2000], "u": actor, "o": source}))
        added += 1
    if st and not _write(st):
        raise HTTPException(503, "the inventory tables are not reachable; nothing was saved")
    return {**_state(), "persisted": True, "added": added}


# ------------------------------------------------------------ Interface 360
def _owner_strip(v):
    """An owner as the inventory keeps it: a team or a name, never an address."""
    v = str(v or "").strip()
    return "" if FORBIDDEN.search(v) else v[:120]


@router.get("/systems")
def systems():
    """Interface 360's systems, each with the owner the interfaces name most
    often (else the API catalog's owner), and whether it is already an
    application here (by name, case-insensitive)."""
    have = {(r.get("app_name") or "").strip().upper(): r.get("app_id") for r in _safe("SELECT app_id, app_name FROM cyber_app")}
    owners = {}
    for r in _safe("SELECT system_name, update_owner, COUNT(*) AS n FROM ("
                   "SELECT source_system AS system_name, update_owner FROM interface360_interfaces WHERE update_owner IS NOT NULL "
                   "UNION ALL SELECT target_system, update_owner FROM interface360_interfaces WHERE update_owner IS NOT NULL) "
                   "GROUP BY system_name, update_owner ORDER BY system_name, COUNT(*) DESC"):
        owners.setdefault((r.get("system_name") or "").upper(), _owner_strip(r.get("update_owner")))
    api_owner = {}
    for r in _safe("SELECT display_name, system_code, owner FROM api_systems WHERE owner IS NOT NULL"):
        for k in (r.get("display_name"), r.get("system_code")):
            if k:
                api_owner.setdefault(str(k).upper(), _owner_strip(r.get("owner")))
    out = []
    for r in _safe("SELECT system_name, project_id, party, inbound_count, outbound_count, total_count, carries_pii FROM interface360_systems ORDER BY total_count DESC, system_name"):
        name = (r.get("system_name") or "").strip()
        key = name.upper()
        out.append({"system": name, "projectId": r.get("project_id"), "party": r.get("party"), "interfaces": int(r.get("total_count") or 0),
                    "inbound": int(r.get("inbound_count") or 0), "outbound": int(r.get("outbound_count") or 0), "carriesPii": (r.get("carries_pii") or "N") == "Y",
                    "owner": owners.get(key) or api_owner.get(key) or "", "ownerSource": "interfaces" if owners.get(key) else ("api catalog" if api_owner.get(key) else None),
                    "appId": have.get(key)})
    return {"systems": out, "inInventory": sum(1 for x in out if x["appId"]), "total": len(out)}


class ImportBody(BaseModel):
    systems: list[str]
    actor: str | None = None


@router.post("/apps/import")
def import_systems(body: ImportBody, request: Request):
    """Interface 360 systems as inventory rows: name, derived owner, the
    project and interface counts in the notes, scan status UNKNOWN until
    the owner declares it. A system already in the inventory is skipped."""
    actor, source = _actor(request, body.actor)
    wanted = {str(x or "").strip().upper() for x in body.systems if str(x or "").strip()}
    if not wanted:
        raise HTTPException(400, "no systems named")
    known = {x["system"].upper(): x for x in systems()["systems"]}
    st, added, skipped = [], [], []
    for key in sorted(wanted):
        x = known.get(key)
        if not x:
            skipped.append({"system": key, "why": "not an Interface 360 system"})
            continue
        if x["appId"]:
            skipped.append({"system": x["system"], "why": f"already in the inventory as {x['appId']}"})
            continue
        row = clean({"app_name": x["system"], "app_class": "HOME_GROWN", "surface": "", "scan_status": "UNKNOWN", "constraint_kind": "NONE",
                     "constraint_valid": "TBD", "lifecycle": "ACTIVE", "owner_team": x["owner"],
                     "notes": f"Interface 360: {x['interfaces']} interfaces ({x['inbound']} in, {x['outbound']} out)" + (f"; project {x['projectId']}" if x.get("projectId") else "") + ("; carries PII" if x["carriesPii"] else ""),
                     "source_ref": "Interface 360 system" + (f"; owner from {x['ownerSource']}" if x.get("ownerSource") else "")})
        app_id = "IF-" + re.sub(r"[^A-Za-z0-9]", "", x["system"]).upper()[:36]
        st.append(_merge(app_id, row, actor, source))
        st.append(("INSERT INTO cyber_app_log (log_id, app_id, field, before_v, after_v, author, id_source) VALUES (:i, :a, 'import', NULL, :v, :u, :o)",
                   {"i": _nid("l"), "a": app_id, "v": "Interface 360 system", "u": actor, "o": source}))
        added.append(app_id)
    if st and not _write(st):
        raise HTTPException(503, "the inventory tables are not reachable; nothing was saved")
    return {**_state(), "persisted": True, "added": added, "skipped": skipped}


# ------------------------------------------------------------------ Excel
XLSX_COLS = [("app_id", "ID"), ("app_name", "Application"), ("app_class", "Class"), ("category", "Category"), ("runtime", "Runtime"), ("tech_stack", "Tech stack"),
             ("surface", "Surface"), ("scan_status", "Scan status"), ("scan_types", "Scan types"), ("constraint_kind", "Constraint"), ("constraint_text", "Why not scanned"),
             ("constraint_valid", "Scan group decision"), ("recommended_control", "Covering control"), ("action", "Action"), ("owner_team", "Owner"),
             ("devsecops_integration", "DevSecOps integration"), ("devsecops_detail", "DevSecOps detail"),
             ("lifecycle", "Lifecycle"), ("notes", "Notes"), ("source_ref", "Source"), ("updated_by", "Updated by"), ("updated_at", "Updated at")]


def workbook_bytes(state):
    """The inventory as a workbook: every application, the ones not scanned
    with the review columns first, and the change log."""
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter
    wb = Workbook()

    def sheet(ws, cols, rows):
        ws.append([h for _, h in cols])
        for c in ws[1]:
            c.font = Font(bold=True, color="FFFFFF")
            c.fill = PatternFill("solid", fgColor="0F4775")
            c.alignment = Alignment(vertical="top", wrap_text=True)
        for r in rows:
            ws.append([r.get(k) for k, _ in cols])
        for i, (k, _) in enumerate(cols, 1):
            width = 14 if k in ("app_id", "app_class", "surface", "scan_status", "constraint_valid", "lifecycle") else (48 if k in ("constraint_text", "recommended_control", "action", "notes") else 24)
            ws.column_dimensions[get_column_letter(i)].width = width
        for row in ws.iter_rows(min_row=2):
            for c in row:
                c.alignment = Alignment(vertical="top", wrap_text=True)
        ws.freeze_panes = "B2"
        ws.auto_filter.ref = ws.dimensions

    apps = state["apps"]
    sheet(wb.active, XLSX_COLS, apps)
    wb.active.title = "Inventory"
    un = [a for a in apps if a.get("scan_status") in ("SERVER_ONLY", "NOT_SCANNED", "UNKNOWN") and a.get("lifecycle") != "RETIRED"]
    review_cols = [("app_name", "Application"), ("app_class", "Class"), ("runtime", "Runtime"), ("scan_status", "Scan status"), ("constraint_kind", "Constraint"),
                   ("constraint_text", "Why not scanned"), ("constraint_valid", "Scan group decision"), ("recommended_control", "Covering control"), ("action", "Action"),
                   ("owner_team", "Owner"), ("devsecops_integration", "DevSecOps integration"), ("lifecycle", "Lifecycle"), ("app_id", "ID")]
    sheet(wb.create_sheet("Not scanned"), review_cols, un)
    log_cols = [("at", "When"), ("appId", "ID"), ("field", "Field"), ("before", "Before"), ("after", "After"), ("author", "By")]
    sheet(wb.create_sheet("Change log"), log_cols, state["log"])
    # the values a developer may type, so a filled-in workbook uploads clean
    vals = wb.create_sheet("Values")
    vals.append(["Column", "Allowed values", "Meaning"])
    for f, opts in ENUMS.items():
        vals.append([f, " | ".join(opts), HELP.get(f, "")])
    vals.append(["app_id", "leave blank for a new application; keep the ID to update one", ""])
    vals.append(["app_name", "required", "the application as developers and the scan group know it; no hosts, no addresses"])
    for col, w in (("A", 24), ("B", 70), ("C", 80)):
        vals.column_dimensions[col].width = w
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


@router.get("/apps.xlsx")
def apps_xlsx():
    data = workbook_bytes(_state())
    return Response(content=data, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": 'attachment; filename="cyber-security-360-inventory.xlsx"'})


# ----------------------------------------------------------------- upload
class UploadBody(BaseModel):
    filename: str | None = None
    content_b64: str
    actor: str | None = None


def _header_key(h):
    k = re.sub(r"[^a-z0-9]", "", str(h or "").lower())
    by_label = {re.sub(r"[^a-z0-9]", "", lab.lower()): f for f, lab in XLSX_COLS}
    by_field = {re.sub(r"[^a-z0-9]", "", f): f for f in ("app_id", *FIELDS)}
    return by_label.get(k) or by_field.get(k)


def parse_workbook(data: bytes):
    """Rows from the Inventory sheet (else the first sheet) of an uploaded
    workbook, keyed by field; the header row is matched by the export's
    labels or the field names, so the downloaded file round-trips."""
    import base64
    from openpyxl import load_workbook
    wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    ws = wb["Inventory"] if "Inventory" in wb.sheetnames else wb.worksheets[0]
    rows = ws.iter_rows(values_only=True)
    header = next(rows, None)
    if not header:
        return [], "the sheet is empty"
    keys = [_header_key(h) for h in header]
    if "app_name" not in keys:
        return [], "no Application column: download the inventory workbook and fill its Inventory sheet"
    out = []
    for n, r in enumerate(rows, 2):
        d = {k: ("" if v is None else str(v).strip()) for k, v in zip(keys, r) if k}
        if not any(d.values()):
            continue
        d["_row"] = n
        out.append(d)
    return out, None


@router.post("/apps/upload")
def upload_apps(body: UploadBody, request: Request):
    """A filled-in workbook: each row is created (blank ID) or updated (its
    ID); a row that fails validation is reported with its row number and
    the rest still load. Changed fields are logged as a save would."""
    import base64
    actor, source = _actor(request, body.actor)
    try:
        data = base64.b64decode(body.content_b64)
        rows, err = parse_workbook(data)
    except Exception as e:                                   # noqa: BLE001
        raise HTTPException(422, f"not a workbook this can read: {str(e)[:120]}")
    if err:
        raise HTTPException(422, err)
    have = {r["app_id"]: r for r in _safe("SELECT * FROM cyber_app")}
    by_name = {(r.get("app_name") or "").strip().upper(): r["app_id"] for r in have.values()}
    st, added, updated, errors = [], [], [], []
    for d in rows:
        try:
            row = clean(d)
            app_id = _app_id(d.get("app_id")) if d.get("app_id") else by_name.get((row["app_name"] or "").upper()) or _app_id("")
            before = have.get(app_id)
            st.append(_merge(app_id, row, actor, source))
            st.extend(_log_rows(app_id, before, row, actor, source))
            (updated if before else added).append(app_id)
            have[app_id] = {"app_id": app_id, **row}
            by_name[(row["app_name"] or "").upper()] = app_id
        except HTTPException as e:
            errors.append({"row": d.get("_row"), "app": d.get("app_name") or d.get("app_id") or "", "error": e.detail})
    if st and not _write(st):
        raise HTTPException(503, "the inventory tables are not reachable; nothing was saved")
    return {**_state(), "persisted": True, "added": added, "updated": updated, "errors": errors, "rows": len(rows)}
