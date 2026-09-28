import sys, csv, re
sys.path.insert(0, '/tmp/claude-0/cat')
from catalog import C

# The workbook's own FUNCTIONAL_GROUP values, exactly as authored. This list
# is authoritative; anything I proposed that is not in it is a suggestion.
WORKBOOK = [
 "Intraday / API Keys & Control","Audit Trail & Change History","History","Other",
 "Account Master & Reference Data","Reference Data","IPS / Investment Policy",
 "Interested Parties & Relationships","Securities / Asset Master",
 "Reporting & Analytics","Transactions & Journals","Positions & Holdings",
 "Pricing & Valuation","Review Required","Market / Research Data",
 "Security / Access Reference",
]
# Groups the taxonomy has no value for. Named rather than swept into "Other",
# because "Other" is where a business view goes to die.
PROPOSED = {"Fees & Billing","Compliance & Oversight","Lending & Credit","Tax"}

DOMAIN = {
 "Clients & Accounts":"Account Master & Reference Data",
 "People & Relationships":"Interested Parties & Relationships",
 "Holdings & Positions":"Positions & Holdings",
 "Transactions & Cash":"Transactions & Journals",
 "Securities & Pricing":"Securities / Asset Master",
 "Investment Policy":"IPS / Investment Policy",
 "Performance & Benchmarks":"Reporting & Analytics",
 "Statements & Reporting":"Reporting & Analytics",
 "Assets Under Management":"Reporting & Analytics",
 "Market & Fund Research":"Market / Research Data",
 "Shared Reference":"Reference Data",
 "Change History":"Audit Trail & Change History",
 "Platform & Operations":"Intraday / API Keys & Control",
 "Fees & Billing":"Fees & Billing",
 "Compliance & Oversight":"Compliance & Oversight",
 "Lending & Credit":"Lending & Credit",
 "Tax":"Tax",
}
# Per-table overrides where one of my domains straddles two workbook groups.
OVER = {
 # valuation and price series are Pricing & Valuation, not the asset master
 "FACT_PRICE":"Pricing & Valuation","FACT_PRICE_FIS":"Pricing & Valuation",
 "FACT_PRICE_TR":"Pricing & Valuation","FACT_PRICE_REALTIME":"Pricing & Valuation",
 "TEMP_PRICE_CHANGE":"Pricing & Valuation",
 "TEMP_PRICE_CHANGE_YESTERDAY":"Pricing & Valuation",
 "FACT_SECURITY_MEASURES":"Pricing & Valuation",
 "FACT_SECURITY_MEASURES_HIST":"Pricing & Valuation",
 "FACT_MBS_FACTOR":"Pricing & Valuation",
 "FACT_STAR_PORTFOLIO_VALUATION":"Pricing & Valuation",
 "CFG_TR_CUSIP_LTS":"Pricing & Valuation",
 # "Security / Access Reference" is access control, not securities
 "DIM_CRM_ACCOUNT_ONLINE_ACCESS":"Security / Access Reference",
 "DIM_CRM_REQUEST_AUTHORIZER":"Security / Access Reference",
 "TWM001_USER_REF":"Security / Access Reference",
 # transaction and disbursement codes are lookups, not postings
 "REF_TRANSACTION_CODE":"Reference Data","REF_DISBURSEMENT_CODE":"Reference Data",
 # people who are staff, not parties to an account
 "DIM_EMPLOYEE":"Reference Data","DIM_OFFICE":"Reference Data",
 "REF_BRANCH":"Reference Data","DIM_CONTACT":"Reference Data",
 "DIM_CRM_EMPLOYEE_OFFICES":"Reference Data",
 "REF_IP_MAIL_LABEL_TITLE":"Reference Data",
 # the company record is a master, not an account
 "DIM_COMPANY":"Account Master & Reference Data",
}
# "History" is an axis, not a domain: a *_HIST table belongs to its subject AND
# to history. Recorded as a flag so the view can offer it as a filter instead
# of pulling ten domains' history into one meaningless bucket.
def is_hist(t):
    return bool(re.search(r"(_HIST|_HISTORY)$", t)) or t.startswith("AUDIT_TRAIL_")
def is_staging(t):
    return bool(re.search(r"(_TEMP|_TMP)$", t)) or t.startswith(("TEMP_","TMP_"))

rows = []
for tbl, dom, name, desc, grain, conf in C:
    g = OVER.get(tbl) or DOMAIN[dom]
    rows.append({
        "table_name": tbl,
        "suggested_group": g,
        "group_status": "proposed — no such value in the workbook today"
                        if g in PROPOSED else "in the workbook",
        "business_name": name,
        "business_description": desc,
        "grain": grain,
        "is_history": "Y" if is_hist(tbl) else "N",
        "is_staging": "Y" if is_staging(tbl) else "N",
        "confidence": conf,
        "review_needed": "Y" if conf == "low" else "N",
        "reviewed_by": "", "reviewed_on": "", "corrected_name": "",
        "corrected_description": "", "corrected_group": "",
    })
rows.sort(key=lambda r: (r["suggested_group"], r["table_name"]))

import os
out = "/home/user/cp360-base-final/docs/business-catalog"
os.makedirs(out, exist_ok=True)
with open(f"{out}/pbdw-business-catalog.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader(); w.writerows(rows)

from collections import Counter
byg = Counter(r["suggested_group"] for r in rows)
used = set(byg)
print("rows:", len(rows))
print("\n-- coverage against the workbook's 16 --")
for g in WORKBOOK:
    print(f"{byg.get(g,0):4d}  {g}" + ("" if g in used else "   << no table lands here"))
print("\n-- proposed additions --")
for g in sorted(PROPOSED):
    print(f"{byg.get(g,0):4d}  {g}")
print("\nhistory-flagged:", sum(1 for r in rows if r["is_history"]=="Y"),
      " staging-flagged:", sum(1 for r in rows if r["is_staging"]=="Y"),
      " needing review:", sum(1 for r in rows if r["review_needed"]=="Y"))
