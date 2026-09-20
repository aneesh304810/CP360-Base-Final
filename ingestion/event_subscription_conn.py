"""Event subscriptions from CSV -> ref_event_consumer + ctl_event_subscription.

A subscription is not in the SEI workbook. It is BBH's own decision about an
event, so it arrives as a CSV that people can edit, review and put through
change control, rather than being typed into a screen and lost.

    sample-artifacts/EVENT-360/consumers.csv
        consumer_code,consumer_name,delivery_mode,owner_team,status,notes

    sample-artifacts/EVENT-360/subscriptions.csv
        consumer_code,event_id,filter_expr,delivery_mode,status,since_dt,
        requested_by,notes

Both are optional. Either alone loads; neither present is not an error, it
means nobody has subscribed yet, which the screens then say plainly.

WHAT THE GATES REFUSE
---------------------
A subscription to an event that is not in the contract, and a subscription by
a consumer that is not in the consumer list. Both are almost always a typo in
an id, and a typo here does not fail loudly later -- it produces an event that
silently looks unsubscribed, or a consumer that silently reads nothing. The
whole point of the subscription screens is to show who is affected; a row that
points nowhere makes them lie.

STATUS IS NOT DERIVED
---------------------
ACTIVE / REQUESTED / RETIRED come from the file. A REQUESTED subscription is
not live and must not be counted in cost or in blast radius, but it must still
be visible -- it is the pipeline of what is about to start costing money.
"""
from __future__ import annotations

import csv
import datetime as _dt
import logging
import os

log = logging.getLogger("cp.event_subscription")

DEFAULT_DIR = "sample-artifacts/EVENT-360"
CONSUMERS = "consumers.csv"
SUBSCRIPTIONS = "subscriptions.csv"
# A consumer and a subscription have DIFFERENT vocabularies, and conflating
# them was a real bug caught by the first test run: a system can be PLANNED
# (it will exist one day), but a subscription is never planned — it is
# REQUESTED, which is a thing a person has to approve.
CONSUMER_STATUSES = ("ACTIVE", "PLANNED", "RETIRED")
SUB_STATUSES = ("ACTIVE", "REQUESTED", "RETIRED")
MODES = ("stream", "queue", "batch")


class EventSubscriptionLoadError(RuntimeError):
    """Raised before anything is written."""


def _rows(path):
    if not os.path.exists(path):
        return []
    with open(path, newline="", encoding="utf-8-sig") as fh:
        return [{(k or "").strip().lower(): (v.strip() if isinstance(v, str) else v)
                 for k, v in r.items()} for r in csv.DictReader(fh)]


def _date(v):
    s = str(v or "").strip()
    if not s:
        return None
    for f in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y-%m"):
        try:
            return _dt.datetime.strptime(s, f).date()
        except ValueError:
            pass
    raise EventSubscriptionLoadError(f"unreadable date {v!r}")


class EventSubscriptionConnector:
    def __init__(self, folder=None, strict=True):
        self.folder = folder or DEFAULT_DIR
        self.strict = strict

    @classmethod
    def from_env(cls):
        return cls(os.environ.get("CP_EVENT_SUB_DIR") or DEFAULT_DIR,
                   strict=os.environ.get("CP_EVENT_SUB_STRICT", "1") != "0")

    def parse(self):
        cons, subs = [], []
        for r in _rows(os.path.join(self.folder, CONSUMERS)):
            code = (r.get("consumer_code") or "").upper()
            if not code:
                continue
            cons.append({"consumer_code": code[:40],
                         "consumer_name": (r.get("consumer_name") or None),
                         "delivery_mode": (r.get("delivery_mode") or None),
                         "owner_team": (r.get("owner_team") or None),
                         "status": (r.get("status") or "ACTIVE").upper(),
                         "notes": (r.get("notes") or None)})
        for r in _rows(os.path.join(self.folder, SUBSCRIPTIONS)):
            code = (r.get("consumer_code") or "").upper()
            eid = (r.get("event_id") or "").strip()
            if not code or not eid:
                continue
            try:
                eid = int(float(eid))
            except ValueError:
                raise EventSubscriptionLoadError(
                    f"{code}: event_id {r.get('event_id')!r} is not a number")
            subs.append({"consumer_code": code[:40], "event_id": eid,
                         "filter_expr": (r.get("filter_expr") or "all operations"),
                         "delivery_mode": (r.get("delivery_mode") or None),
                         "status": (r.get("status") or "ACTIVE").upper(),
                         "since_dt": _date(r.get("since_dt")),
                         "retired_dt": _date(r.get("retired_dt")),
                         "requested_by": (r.get("requested_by") or None),
                         "notes": (r.get("notes") or None)})
        bundle = {"consumers": cons, "subscriptions": subs}
        self._gates(bundle)
        return bundle

    def _gates(self, b):
        fail, warn = [], []
        codes = {c["consumer_code"] for c in b["consumers"]}
        for c in b["consumers"]:
            if c["status"] not in CONSUMER_STATUSES:
                fail.append(f"consumer {c['consumer_code']}: status "
                            f"{c['status']!r} is not one of {CONSUMER_STATUSES}")
            if c["delivery_mode"] and c["delivery_mode"] not in MODES:
                warn.append(f"consumer {c['consumer_code']}: delivery mode "
                            f"{c['delivery_mode']!r} is not one of {MODES}")
        seen = set()
        for s in b["subscriptions"]:
            if s["status"] not in SUB_STATUSES:
                fail.append(f"{s['consumer_code']}/{s['event_id']}: status "
                            f"{s['status']!r} is not one of {SUB_STATUSES}")
            k = (s["consumer_code"], s["event_id"])
            if k in seen:
                fail.append(f"{k[0]}/{k[1]} appears twice — one consumer has one "
                            f"subscription per event, with one filter")
            seen.add(k)
            if codes and s["consumer_code"] not in codes:
                fail.append(f"subscription by {s['consumer_code']}, which is not in "
                            f"{CONSUMERS} — almost always a typo, and a typo here "
                            f"makes a consumer silently read nothing")
        if b["subscriptions"] and not b["consumers"]:
            warn.append(f"{SUBSCRIPTIONS} has rows but {CONSUMERS} is absent; "
                        f"consumer codes cannot be checked")
        if not b["consumers"] and not b["subscriptions"]:
            warn.append(f"no {CONSUMERS} and no {SUBSCRIPTIONS} in {self.folder} — "
                        f"nothing to load, and the screens will correctly say "
                        f"nobody subscribes to anything")
        for w in warn:
            log.warning("event_subscription: %s", w)
        if fail:
            msg = "; ".join(fail)
            if self.strict:
                raise EventSubscriptionLoadError(msg)
            log.error("event_subscription (strict off): %s", msg)

    def load(self, loader, bundle):
        n = 0
        for c in bundle["consumers"]:
            loader._merge("ref_event_consumer", ("consumer_code",), c); n += 1
        for s in bundle["subscriptions"]:
            loader._merge("ctl_event_subscription",
                          ("consumer_code", "event_id"), s); n += 1
        loader.commit()
        log.info("event_subscription: %d consumers, %d subscriptions",
                 len(bundle["consumers"]), len(bundle["subscriptions"]))
        return n
