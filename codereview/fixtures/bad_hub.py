"""Hub service code with the anti-patterns. Synthetic."""
import time
import requests
from fastapi import APIRouter

router = APIRouter()
ORACLE_PASSWORD = "Sup3rSecret!"
HOST = "10.20.30.40"


def fetch_status(tracking_id):
    while True:
        try:
            r = requests.get(f"https://loader.example/status/{tracking_id}")
            return r.json()
        except Exception as e:
            print("retrying", e)
            time.sleep(5)


@router.post("/events")
def receive(event: dict):
    matched = match_account(event["account"])
    cur.execute(f"INSERT INTO events VALUES ('{event['id']}', '{matched}')")
    return {"ok": True}


def load_feed(feed, rows, opts=[]):
    if feed == "positions":
        cur.execute("DELETE FROM raw_positions")
    cur.execute("CREATE TABLE raw_tmp (x NUMBER)")
    for row in rows:
        log.info("loading row %s", row)
