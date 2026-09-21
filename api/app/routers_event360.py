"""Event 360 — the SEI event contract, what BBH decides about it, and the bill.

THREE SOURCES, KEPT APART ON PURPOSE

    51_event360.sql          the CONTRACT. What SEI says an event is.
    53_event_subscription    OUR decisions: who consumes it, how critical it is.
    52_sdc_compute           the MEASURED read-back: warehouse time per SDC view.

Every payload labels which of the three a number came from. The reason is not
tidiness: a criticality band and a cost projection are ours, and if they reach
a screen indistinguishable from the specification's own fields, somebody will
eventually quote one back to SEI as though SEI had written it.

THE ONE THING THAT SURPRISES EVERYONE

Cost attaches to the VIEW, not the event. Consumption rule 1 says an event is a
notification and the consumer must fetch the record from the SDC view named in
the payload, so the bill is warehouse time on that view. Twenty events naming
ACCOUNT_BASIC_VIEW cost about what one of them costs, because the view is read
either way. /cost therefore prices a SET of events by the DISTINCT VIEWS they
name, and never by dividing a total by the number of events.

AND THE ONE THAT CHANGES THE ADVICE

Where the agreement has a floor (ref_compute_agreement.minimum_amount) and
projected usage sits under it, the floor IS the bill. Below it the marginal
cost of one more subscription is zero and the number worth tracking is
headroom. /cost returns both and says which is binding, rather than reporting
usage as though it were spend.
"""
from __future__ import annotations

import logging
import math

from fastapi import APIRouter, Body

from .db import query

log = logging.getLogger("cp.api.event360")
router = APIRouter(prefix="/event360", tags=["event360"])

# Bands are ordered severity, not categories. The cut points are here rather
# than in the UI so the API can state them alongside every score it returns.
BANDS = ((70, "Critical"), (50, "High"), (30, "Moderate"), (0, "Low"))


def _band(score):
    for cut, name in BANDS:
        if score >= cut:
            return name
    return "Low"


def _num(v, d=0.0):
    try:
        return float(v) if v is not None else d
    except (TypeError, ValueError):
        return d


# --------------------------------------------------------------- reference --
def _agreement():
    r = query("""SELECT agreement_code, credit_price, default_wh, concurrency,
                        minimum_amount, minimum_per, target_accounts,
                        target_positions, target_transactions,
                        growth_per_quarter_pct, note
                   FROM ref_compute_agreement
                  WHERE agreement_code = 'BBH'""")
    if not r:
        return {"agreement_code": "BBH", "credit_price": None, "default_wh": "XS",
                "concurrency": 1, "minimum_amount": None, "minimum_per": None,
                "target_accounts": None, "growth_per_quarter_pct": 0,
                "note": "no row in ref_compute_agreement — run 53_event_subscription.sql"}
    return r[0]


def _weights():
    rows = query("""SELECT input_code, label, weight, what_it_is
                      FROM ref_event_criticality_weight ORDER BY weight DESC""")
    return rows or []


def _wh_credits(size):
    r = query("SELECT credits_per_hour FROM ref_warehouse_size WHERE wh_size = :s",
              {"s": (size or "XS").upper()})
    return _num(r[0]["credits_per_hour"], 1.0) if r else 1.0


# ------------------------------------------------------------- the estate ---
def _events():
    """Every event with the facts the screens need, joined once. Kept as one
    query because five screens all start from this shape and re-deriving it per
    endpoint is how two of them end up disagreeing."""
    return query("""
        SELECT d.event_id, d.event_name, d.event_type, d.domain, d.section,
               d.page, d.sdc_view, d.payload_key, d.operation_codes,
               d.trigger_column_count, d.load_flag, d.load_flag_note,
               d.detail_extraction_status, d.field_extraction_status,
               (SELECT COUNT(*) FROM meta_event_field f
                 WHERE f.event_id = d.event_id
                   AND f.field_category = 'TRIGGER_DRIVING')          AS trig_cols,
               (SELECT COUNT(*) FROM meta_event_field f
                 WHERE f.event_id = d.event_id
                   AND f.field_category = 'PAYLOAD')                  AS payload_cols,
               (SELECT COUNT(*) FROM ctl_event_subscription s
                 WHERE s.event_id = d.event_id AND s.status = 'ACTIVE') AS subs_active,
               (SELECT COUNT(*) FROM ctl_event_subscription s
                 WHERE s.event_id = d.event_id)                       AS subs_all
          FROM meta_event_definition d
         ORDER BY d.event_id""")


def _coupling():
    """event_id -> the other events sharing at least one trigger column.

    The grain is (source_table, source_column), which is why the SQL groups on
    both: two tables can carry a column of the same name and they are not the
    same column. Getting that wrong would invent coupling that does not exist.
    """
    rows = query("""
        SELECT a.event_id AS a_id, b.event_id AS b_id
          FROM meta_event_field a
          JOIN meta_event_field b
            ON b.source_table = a.source_table
           AND b.source_column = a.source_column
           AND b.event_id <> a.event_id
         WHERE a.field_category = 'TRIGGER_DRIVING'
           AND b.field_category = 'TRIGGER_DRIVING'
           AND a.source_table IS NOT NULL
           AND a.source_column IS NOT NULL
         GROUP BY a.event_id, b.event_id""")
    out = {}
    for r in rows:
        out.setdefault(int(r["a_id"]), set()).add(int(r["b_id"]))
    return out


def _view_profile():
    """object_name -> measured seconds and GB per query, from the most recent
    compute period. Returns {} when nothing has been ingested, and every caller
    treats that as 'not measured' rather than as zero cost."""
    rows = query("""
        SELECT object_name, SUM(queries) AS queries, SUM(elapsed_sec) AS sec,
               SUM(gb_scanned) AS gb, MAX(period_id) AS period_id
          FROM meta_sdc_compute_view
         WHERE period_id = (SELECT period_id FROM (
                   SELECT period_id FROM meta_sdc_compute_period
                    ORDER BY last_day DESC, loaded_at DESC)
                  WHERE ROWNUM = 1)
         GROUP BY object_name""")
    out = {}
    for r in rows:
        q = _num(r["queries"])
        if q <= 0:
            continue
        out[r["object_name"]] = {
            "object_name": r["object_name"], "queries": q,
            "sec": _num(r["sec"]), "gb": _num(r["gb"]),
            "sec_per_query": _num(r["sec"]) / q,
            "gb_per_query": _num(r["gb"]) / q,
            "period_id": r["period_id"]}
    return out


def _period():
    r = query("""SELECT * FROM (SELECT period_id, client_code, accounts, warehouse,
                        period_days, view_coverage_pct, view_days, daily_days,
                        first_day, last_day, view_elapsed_sec, sum_elapsed_sec
                   FROM meta_sdc_compute_period
                  ORDER BY last_day DESC, loaded_at DESC) WHERE ROWNUM = 1""")
    return r[0] if r else None


def _score(ev, coupling, volumes):
    """Criticality, from the weights table. Every input is normalised against
    the estate's own maximum, so a band means 'relative to this contract' and
    not against some absolute anybody would have to invent."""
    ws = {w["input_code"]: _num(w["weight"]) for w in _weights()}
    max_sub = max([_num(e["subs_active"]) for e in ev] + [1])
    max_tr = max([_num(e["trig_cols"]) for e in ev] + [1])
    max_co = max([len(coupling.get(int(e["event_id"]), ())) for e in ev] + [1])
    max_vol = max(list(volumes.values()) + [1])
    for e in ev:
        eid = int(e["event_id"])
        co = len(coupling.get(eid, ()))
        vol = volumes.get(eid, 0)
        risk = (0 if e["sdc_view"] else 0.5) + (0 if e["operation_codes"] else 0.5)
        if e["load_flag"]:
            risk = 1.0
        inputs = {
            "reach": _num(e["subs_active"]) / max_sub,
            "volume": math.log(vol + 1) / math.log(max_vol + 1) if max_vol > 1 else 0.0,
            "couple": co / max_co,
            "surface": _num(e["trig_cols"]) / max_tr,
            "risk": min(1.0, risk)}
        raw = {"reach": int(_num(e["subs_active"])), "volume": vol,
               "couple": co, "surface": int(_num(e["trig_cols"])),
               "risk": round(min(1.0, risk), 2)}
        score = round(sum(min(1.0, inputs[k]) * ws.get(k, 0) for k in inputs) * 100)
        e["criticality"] = {"score": score, "band": _band(score),
                            "inputs": {k: round(min(1.0, v), 4) for k, v in inputs.items()},
                            "raw": raw, "coupled_events": co,
                            "derived_by": "CP360 — the specification says nothing "
                                          "about criticality"}
    return ev


def _volumes():
    """Messages per event. NOT measured anywhere yet: the compute workbook
    counts view queries, not events published. Returns {} until a message
    extract exists, and criticality's volume input is then zero for everyone —
    which is honest, and visible, because the weights are on screen."""
    return {}


# ------------------------------------------------------------- endpoints ----
@router.get("/summary")
def summary():
    ev = _events()
    if not ev:
        return {"loaded": False,
                "detail": "meta_event_definition is empty — run "
                          "`python -m ingestion.run event360`"}
    ev = _score(ev, _coupling(), _volumes())
    types, domains = {}, {}
    for e in ev:
        types[e["event_type"]] = types.get(e["event_type"], 0) + 1
        domains[e["domain"]] = domains.get(e["domain"], 0) + 1
    subd = sum(1 for e in ev if _num(e["subs_active"]) > 0)
    hot = sum(1 for e in ev if e["criticality"]["band"] in ("Critical", "High"))
    fields = query("SELECT COUNT(*) n FROM meta_event_field")[0]["n"]
    trig = query("""SELECT COUNT(*) n, COUNT(DISTINCT source_table||'.'||source_column) d
                      FROM meta_event_field
                     WHERE field_category = 'TRIGGER_DRIVING'""")[0]
    per = _period()
    return {"loaded": True, "events": len(ev), "fields": fields,
            "trigger_rows": trig["n"], "trigger_columns": trig["d"],
            "types": types, "domains": domains,
            "subscribed": subd, "unsubscribed": len(ev) - subd,
            "subscriptions_active": query(
                "SELECT COUNT(*) n FROM ctl_event_subscription WHERE status='ACTIVE'"
            )[0]["n"],
            "critical_or_high": hot,
            "sdc_period": per,
            "sources": {"contract": "meta_event_definition / meta_event_field",
                        "subscriptions": "ctl_event_subscription",
                        "compute": "meta_sdc_compute_*"}}


@router.get("/events")
def events(domain: str | None = None, event_type: str | None = None,
           band: str | None = None, q: str | None = None):
    ev = _score(_events(), _coupling(), _volumes())
    out = [e for e in ev
           if (not domain or e["domain"] == domain)
           and (not event_type or e["event_type"] == event_type)
           and (not band or e["criticality"]["band"] == band)
           and (not q or q.lower() in str(e["event_name"]).lower()
                or q == str(e["event_id"]))]
    return {"events": out, "weights": _weights(), "bands": [b[1] for b in BANDS]}


@router.get("/groups")
def groups(by: str = "type"):
    """The estate grouped, with subscription coverage and measured compute per
    group. `by` is one of type, domain, cross, view, ops."""
    ev = _score(_events(), _coupling(), _volumes())
    prof = _view_profile()
    key = {"type": lambda e: e["event_type"],
           "domain": lambda e: e["domain"],
           "cross": lambda e: f"{e['domain']} · {e['event_type']}",
           "view": lambda e: e["sdc_view"] or "— none · marker",
           "ops": lambda e: e["operation_codes"] or "— not applicable · marker",
           }.get(by, lambda e: e["event_type"])
    g = {}
    for e in ev:
        k = key(e)
        b = g.setdefault(k, {"key": k, "total": 0, "Business": 0, "Technical": 0,
                             "Marker": 0, "subscribed": 0, "views": set(),
                             "event_ids": []})
        b["total"] += 1
        b[e["event_type"]] = b.get(e["event_type"], 0) + 1
        if _num(e["subs_active"]) > 0:
            b["subscribed"] += 1
        if e["sdc_view"]:
            b["views"].add(e["sdc_view"])
        b["event_ids"].append(int(e["event_id"]))
    out = []
    for b in g.values():
        # a group's compute is its DISTINCT views' compute, not a per-event sum
        sec = sum(prof[v]["sec"] for v in b["views"] if v in prof)
        b["distinct_views"] = len(b["views"])
        b["measured_views"] = sum(1 for v in b["views"] if v in prof)
        b["elapsed_sec"] = round(sec, 2)
        b.pop("views")
        out.append(b)
    out.sort(key=lambda x: -x["total"])
    return {"by": by, "groups": out,
            "note": "compute is the sum over each group's DISTINCT SDC views, "
                    "because two events naming one view are read once"}


@router.get("/event/{event_id}")
def event(event_id: int):
    ev = _score(_events(), _coupling(), _volumes())
    e = next((x for x in ev if int(x["event_id"]) == event_id), None)
    if not e:
        return {"found": False, "event_id": event_id}
    fields = query("""SELECT field_ordinal, source_page, field_category, field_name,
                             description, data_type, length_precision, nullable,
                             is_key, source_table, source_column, sample_value,
                             extraction_status
                        FROM meta_event_field WHERE event_id = :i
                       ORDER BY field_ordinal""", {"i": event_id})
    detail = query("""SELECT description, sample_payload, trigger_tables_columns,
                             trigger_condition, consumer_guidance,
                             payload_field_list, composite_key_parts,
                             source_page_reference
                        FROM meta_event_definition WHERE event_id = :i""",
                   {"i": event_id})
    coupled_ids = sorted(_coupling().get(event_id, ()))
    coupled = [{"event_id": int(x["event_id"]), "event_name": x["event_name"],
                "band": x["criticality"]["band"], "score": x["criticality"]["score"]}
               for x in ev if int(x["event_id"]) in coupled_ids]
    subs = query("""SELECT s.consumer_code, c.consumer_name,
                           NVL(s.delivery_mode, c.delivery_mode) AS delivery_mode,
                           s.filter_expr, s.status, s.since_dt, s.notes
                      FROM ctl_event_subscription s
                      LEFT JOIN ref_event_consumer c
                        ON c.consumer_code = s.consumer_code
                     WHERE s.event_id = :i
                     ORDER BY s.status, s.consumer_code""", {"i": event_id})
    # blast radius per watched column: how many OTHER events watch it too
    cols = query("""SELECT f.source_table, f.source_column,
                           (SELECT COUNT(DISTINCT g.event_id) FROM meta_event_field g
                             WHERE g.source_table = f.source_table
                               AND g.source_column = f.source_column
                               AND g.field_category = 'TRIGGER_DRIVING') AS watchers
                      FROM meta_event_field f
                     WHERE f.event_id = :i AND f.field_category = 'TRIGGER_DRIVING'
                       AND f.source_table IS NOT NULL
                     ORDER BY watchers DESC, f.source_table, f.source_column""",
                 {"i": event_id})
    prof = _view_profile()
    return {"found": True, "event": e, "detail": detail[0] if detail else {},
            "fields": fields, "trigger_columns": cols, "coupled": coupled,
            "subscriptions": subs, "weights": _weights(),
            "view_profile": prof.get(e["sdc_view"]),
            "view_profile_note":
                "measured warehouse time for this event's SDC view. Absent means "
                "the view was not in the compute extract, NOT that it is free."}


@router.get("/lanes")
def lanes(by: str = "domain"):
    """Swimlanes: the four stages of an event's life, per domain or per source
    table. Stage 4 empty is the marker case and is meant to read as an ending."""
    ev = _score(_events(), _coupling(), _volumes())
    rows = query("""SELECT event_id, source_table, COUNT(*) AS cols
                      FROM meta_event_field
                     WHERE field_category = 'TRIGGER_DRIVING' AND source_table IS NOT NULL
                     GROUP BY event_id, source_table""")
    by_event = {}
    for r in rows:
        by_event.setdefault(int(r["event_id"]), []).append(
            {"table": r["source_table"], "cols": int(_num(r["cols"]))})
    lanes_out = {}
    for e in ev:
        eid = int(e["event_id"])
        keys = ([e["domain"]] if by == "domain"
                else [t["table"] for t in by_event.get(eid, [])] or ["— no source table"])
        for k in keys:
            L = lanes_out.setdefault(k, {"lane": k, "events": [], "tables": {},
                                         "views": set(), "cols": 0})
            L["events"].append({"event_id": eid, "event_name": e["event_name"],
                                "event_type": e["event_type"],
                                "band": e["criticality"]["band"]})
            for t in by_event.get(eid, []):
                if by == "table" and t["table"] != k:
                    continue
                L["tables"][t["table"]] = L["tables"].get(t["table"], 0) + t["cols"]
                L["cols"] += t["cols"]
            if e["sdc_view"]:
                L["views"].add(e["sdc_view"])
    out = []
    for L in lanes_out.values():
        L["views"] = sorted(L["views"])
        L["tables"] = sorted(({"table": t, "cols": c} for t, c in L["tables"].items()),
                             key=lambda x: -x["cols"])
        L["event_count"] = len(L["events"])
        out.append(L)
    out.sort(key=lambda x: -x["event_count"])
    return {"by": by, "lanes": out}


@router.get("/link")
def link(domain: str | None = None):
    """Source table -> domain (or, zoomed in, each event) -> SDC view.

    The unit of flow is the event and the left stage is the event's PRIMARY
    table — the one contributing most of its watched columns — so every stage
    conserves. Events watching several tables are the Interdependence screen's
    subject; spreading them here would break conservation and make every ribbon
    a lie about how many events take that path.
    """
    ev = _score(_events(), _coupling(), _volumes())
    prim = query("""SELECT event_id, source_table, cols FROM (
                      SELECT event_id, source_table, COUNT(*) cols,
                             ROW_NUMBER() OVER (PARTITION BY event_id
                               ORDER BY COUNT(*) DESC, source_table) rn
                        FROM meta_event_field
                       WHERE field_category = 'TRIGGER_DRIVING'
                         AND source_table IS NOT NULL
                       GROUP BY event_id, source_table)
                    WHERE rn = 1""")
    primary = {int(r["event_id"]): r["source_table"] for r in prim}
    NO_T, NO_V = "— none · marker", "— none · marker"
    sel = [e for e in ev if not domain or e["domain"] == domain]
    nodes_a, nodes_b, nodes_c, ab, bc = {}, {}, {}, {}, {}
    for e in sel:
        eid = int(e["event_id"])
        a = primary.get(eid, NO_T)
        b = str(eid) if domain else e["domain"]
        c = e["sdc_view"] or NO_V
        for store, k in ((nodes_a, a), (nodes_b, b), (nodes_c, c)):
            store.setdefault(k, {"key": k, "events": [], "types": {}})
            store[k]["events"].append(eid)
            store[k]["types"][e["event_type"]] = \
                store[k]["types"].get(e["event_type"], 0) + 1
        if domain:
            nodes_b[b]["label"] = f"{eid} · {e['event_name']}"
            nodes_b[b]["event_id"] = eid
        ab[(a, b)] = ab.get((a, b), 0) + 1
        bc[(b, c)] = bc.get((b, c), 0) + 1
    shape = lambda d: sorted(
        ({"key": k, "value": len(v["events"]), "types": v["types"],
          "label": v.get("label", k), "event_id": v.get("event_id"),
          "event_ids": v["events"]} for k, v in d.items()),
        key=lambda x: (x["event_id"] if x.get("event_id") else -x["value"]))
    return {"domain": domain, "events": len(sel),
            "a": shape(nodes_a), "b": shape(nodes_b), "c": shape(nodes_c),
            "ab": [{"s": k[0], "t": k[1], "v": v} for k, v in ab.items()],
            "bc": [{"s": k[0], "t": k[1], "v": v} for k, v in bc.items()]}


@router.get("/interdependence")
def interdependence(table: str | None = None):
    """Change one column, and how many events arrive — in no guaranteed order."""
    blast = query("""SELECT source_table, source_column,
                            COUNT(DISTINCT event_id) AS events
                       FROM meta_event_field
                      WHERE field_category = 'TRIGGER_DRIVING'
                        AND source_table IS NOT NULL
                        AND (:t IS NULL OR source_table = :t)
                      GROUP BY source_table, source_column
                      ORDER BY events DESC, source_table, source_column""",
                  {"t": table})
    heat = query("""SELECT d.domain, f.source_table,
                           COUNT(DISTINCT f.event_id) AS events
                      FROM meta_event_field f
                      JOIN meta_event_definition d ON d.event_id = f.event_id
                     WHERE f.field_category = 'TRIGGER_DRIVING'
                       AND f.source_table IS NOT NULL
                     GROUP BY d.domain, f.source_table""")
    tables = query("""SELECT DISTINCT source_table FROM meta_event_field
                       WHERE field_category = 'TRIGGER_DRIVING'
                         AND source_table IS NOT NULL ORDER BY source_table""")
    return {"blast": blast, "heat": heat,
            "tables": [t["source_table"] for t in tables],
            "note": "a column watched by more than one event cannot be changed "
                    "quietly; the events arrive together and in no fixed order"}


@router.get("/column/{table}/{column}")
def column(table: str, column: str):
    ev = _score(_events(), _coupling(), _volumes())
    ids = {int(r["event_id"]) for r in query(
        """SELECT DISTINCT event_id FROM meta_event_field
            WHERE field_category='TRIGGER_DRIVING'
              AND source_table = :t AND source_column = :c""",
        {"t": table, "c": column})}
    return {"table": table, "column": column,
            "events": [e for e in ev if int(e["event_id"]) in ids]}


# ---- the swimlane's drill-downs ------------------------------------------
# Each stage of a lane is a door: a source table, a watched column, an event,
# an SDC view. Three of the four already had an endpoint; these are the two
# that did not, kept in the same shape as /column/{table}/{column} rather than
# folded into one generic handler that would need a `kind` parameter and a
# switch to read.

@router.get("/table/{table}")
def table(table: str, domain: str | None = None):
    """A source table: which of its columns are watched, how widely, and which
    events watch them. `domain` narrows to one swimlane."""
    ev = _score(_events(), _coupling(), _volumes())
    rows = query("""SELECT f.source_column,
                           COUNT(DISTINCT f.event_id) AS events,
                           (SELECT COUNT(DISTINCT g.event_id) FROM meta_event_field g
                             WHERE g.source_table = f.source_table
                               AND g.source_column = f.source_column
                               AND g.field_category = 'TRIGGER_DRIVING') AS watchers
                      FROM meta_event_field f
                     WHERE f.field_category = 'TRIGGER_DRIVING'
                       AND f.source_table = :t
                     GROUP BY f.source_table, f.source_column
                     ORDER BY watchers DESC, f.source_column""", {"t": table})
    ids = {int(r["event_id"]) for r in query(
        """SELECT DISTINCT event_id FROM meta_event_field
            WHERE field_category = 'TRIGGER_DRIVING' AND source_table = :t""",
        {"t": table})}
    hits = [e for e in ev if int(e["event_id"]) in ids
            and (not domain or e["domain"] == domain)]
    return {"table": table, "domain": domain, "columns": rows, "events": hits,
            "note": "a column watched by more than one event cannot be changed "
                    "quietly - they all arrive, in no fixed order"}


@router.get("/view/{view}")
def view(view: str, domain: str | None = None):
    """An SDC view: which events send you to it, and what reading it measured.

    This is where the cost of a swimlane actually sits. The events naming a
    view share its cost rather than each carrying one, so the panel reports the
    view's measured compute ONCE and lists the events beside it, instead of
    dividing it between them.
    """
    ev = _score(_events(), _coupling(), _volumes())
    hits = [e for e in ev if e["sdc_view"] == view
            and (not domain or e["domain"] == domain)]
    prof = _view_profile().get(view)
    ag, per = _agreement(), _period()
    money = None
    if prof and _num(ag.get("credit_price")):
        credits = _wh_credits(ag.get("default_wh"))
        conc = _num(ag.get("concurrency"), 1.0) or 1.0
        hour = credits * _num(ag["credit_price"]) / conc
        ratio = (_num(ag.get("target_accounts")) / _num(per["accounts"])
                 if per and _num(per.get("accounts")) and _num(ag.get("target_accounts"))
                 else None)
        days = _num(per.get("period_days"), 30) if per else 30
        money = {"cost_per_query": round(prof["sec_per_query"] / 3600 * hour, 6),
                 "reference_period_cost": round(prof["sec"] / 3600 * hour, 2),
                 "projected_month_cost": (round(prof["sec"] * ratio / 3600 * hour
                                                * (30 / days), 2) if ratio else None),
                 "scaled_by": ratio, "cost_per_elapsed_hour": round(hour, 4)}
    return {"view": view, "domain": domain, "events": hits, "profile": prof,
            "money": money,
            "note": ("measured on the reference client's warehouse" if prof else
                     "this view was not in the compute extract - that is not the "
                     "same as free, and nothing here should be read as zero cost")}


@router.get("/subscriptions")
def subscriptions(consumer: str | None = None):
    rows = query("""SELECT s.consumer_code, c.consumer_name, s.event_id,
                           d.event_name, d.domain, d.event_type, d.sdc_view,
                           NVL(s.delivery_mode, c.delivery_mode) AS delivery_mode,
                           s.filter_expr, s.status, s.since_dt
                      FROM ctl_event_subscription s
                      LEFT JOIN ref_event_consumer c ON c.consumer_code = s.consumer_code
                      LEFT JOIN meta_event_definition d ON d.event_id = s.event_id
                     WHERE (:c IS NULL OR s.consumer_code = :c)
                     ORDER BY s.consumer_code, s.event_id""", {"c": consumer})
    cons = query("""SELECT c.consumer_code, c.consumer_name, c.delivery_mode,
                           c.owner_team, c.status,
                           (SELECT COUNT(*) FROM ctl_event_subscription s
                             WHERE s.consumer_code = c.consumer_code
                               AND s.status='ACTIVE') AS active_subs
                      FROM ref_event_consumer c ORDER BY c.consumer_code""")
    matrix = query("""SELECT s.consumer_code, d.domain, COUNT(*) AS n
                        FROM ctl_event_subscription s
                        JOIN meta_event_definition d ON d.event_id = s.event_id
                       WHERE s.status = 'ACTIVE'
                       GROUP BY s.consumer_code, d.domain""")
    orphan = query("""SELECT d.event_id, d.event_name, d.domain, d.sdc_view
                        FROM meta_event_definition d
                       WHERE NOT EXISTS (SELECT 1 FROM ctl_event_subscription s
                                          WHERE s.event_id = d.event_id
                                            AND s.status = 'ACTIVE')
                       ORDER BY d.event_id""")
    return {"subscriptions": rows, "consumers": cons, "matrix": matrix,
            "unsubscribed": orphan,
            "note": "an event with no live subscription is still produced and "
                    "still consumes the window it is retained in"}


@router.post("/cost")
def cost(body: dict = Body(default={})):
    """Price a BASKET of events.

    The basket is priced by the DISTINCT SDC views its events name, because the
    view is read once however many events point at it. Adding an event whose
    view is already in the basket costs nothing; adding one that names an
    unmeasured or expensive view is where the money is.

    Overrides in the body (credit_price, concurrency, warehouse, minimum,
    minimum_per, target_accounts, growth_per_quarter_pct) let a screen explore
    without editing the agreement. What comes back always says which values
    were used and where each came from.
    """
    ag = dict(_agreement())
    for k in ("credit_price", "concurrency", "minimum_amount", "minimum_per",
              "target_accounts", "growth_per_quarter_pct", "default_wh"):
        if body.get(k) is not None:
            ag[k] = body[k]
    ids = [int(i) for i in (body.get("event_ids") or [])]
    ev = _events()
    if not ids:                       # default basket: everything live today
        ids = [int(e["event_id"]) for e in ev if _num(e["subs_active"]) > 0]
    chosen = [e for e in ev if int(e["event_id"]) in set(ids)]

    prof, per = _view_profile(), _period()
    credits = _wh_credits(ag.get("default_wh"))
    price = _num(ag.get("credit_price"))
    conc = _num(ag.get("concurrency"), 1.0) or 1.0
    hour_cost = credits * price / conc

    ratio = None
    if per and _num(per.get("accounts")) and _num(ag.get("target_accounts")):
        ratio = _num(ag["target_accounts"]) / _num(per["accounts"])

    views, unmeasured = {}, []
    for e in chosen:
        v = e["sdc_view"]
        if not v:
            continue
        if v in prof:
            views.setdefault(v, {"view": v, "events": [], **prof[v]})
            views[v]["events"].append(int(e["event_id"]))
        elif v not in unmeasured:
            unmeasured.append(v)
    period_days = _num(per.get("period_days"), 30) if per else 30
    rows = []
    for v in views.values():
        sec = v["sec"] * (ratio if ratio else 1)
        rows.append({"view": v["view"], "events": len(v["events"]),
                     "event_ids": v["events"], "queries": v["queries"],
                     "sec_per_query": round(v["sec_per_query"], 2),
                     "elapsed_sec_period": round(v["sec"], 2),
                     "projected_sec_period": round(sec, 2),
                     "projected_cost_period": round(sec / 3600 * hour_cost, 2),
                     "projected_cost_month": round(
                         sec / 3600 * hour_cost * (30 / period_days), 2)})
    rows.sort(key=lambda r: -r["projected_cost_month"])
    usage_month = round(sum(r["projected_cost_month"] for r in rows), 2)
    g = _num(ag.get("growth_per_quarter_pct")) / 100.0
    mg = (1 + g) ** (1 / 3) - 1 if g else 0.0
    months = [round(usage_month * (1 + mg) ** m, 2) for m in range(12)]
    usage_year = round(sum(months), 2)

    floor = None
    minimum = _num(ag.get("minimum_amount"))
    if minimum:
        per_basis = (ag.get("minimum_per") or "YEAR").upper()
        use = usage_month if per_basis == "MONTH" else usage_year
        floor = {"amount": minimum, "per": per_basis,
                 "usage_same_basis": use, "binding": use < minimum,
                 "usage_pct_of_floor": round(use / minimum * 100, 1) if minimum else None,
                 "headroom_hours": round(minimum / hour_cost -
                                         (use / hour_cost if hour_cost else 0), 1)
                                   if hour_cost else None,
                 "what_it_means":
                     "the floor is the bill; until usage reaches it one more "
                     "subscription costs nothing and headroom is the number worth "
                     "tracking" if use < minimum else
                     "usage has passed the floor; from here every extra read is "
                     "real money"}
    return {
        "basket": {"event_ids": ids, "events": len(chosen),
                   "distinct_views": len(views),
                   "views_unmeasured": unmeasured},
        "rate": {"warehouse": ag.get("default_wh"), "credits_per_hour": credits,
                 "credit_price": price, "concurrency": conc,
                 "cost_per_elapsed_hour": round(hour_cost, 4),
                 "concurrency_is_assumed": conc == 1,
                 "note": "elapsed seconds are SUMMED QUERY TIME, not measured "
                         "warehouse uptime; concurrency converts between them and "
                         "1.0 means the sum is being used as-is"},
        "scale": {"reference_accounts": per.get("accounts") if per else None,
                  "target_accounts": ag.get("target_accounts"), "ratio": ratio,
                  "note": "accounts only. Position and transaction views do not "
                          "follow account count; supply those counts to scale them "
                          "properly" if ratio else "no compute period loaded"},
        "reference_period": per,
        "usage": {"per_month": usage_month, "first_twelve_months": usage_year,
                  "monthly_series": months},
        "minimum": floor,
        "views": rows,
        "agreement_note": ag.get("note")}


@router.get("/contract")
def contract():
    return {
        "envelope": query("""SELECT field, description, data_type, length_precision,
                                    mandatory FROM ref_envelope_field ORDER BY field"""),
        "rules": query("SELECT rule_no, rule_text FROM ref_consumption_rule "
                       "ORDER BY rule_no"),
        "types": query("SELECT event_type, description, event_count "
                       "FROM ref_event_type ORDER BY event_type"),
        "domains": query("SELECT domain, coverage, event_count "
                         "FROM ref_event_domain ORDER BY domain"),
        "weights": _weights(),
        "agreement": _agreement()}
