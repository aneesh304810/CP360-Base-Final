# App shell + left nav wiring for Environment 360 (final)

## 1. Left nav — ALREADY DONE, no change
AppShell.jsx already carries the entry (Admin group):
    ['environment', 'Environment 360', '🖧']
navStatus.jsx: 'environment' has no MODULE_STATUS entry = live/unmarked. Correct.

## 2. App root — the ONE edit (your top-level view switch)
    import Env360Home from "./Env360Home";
    // replace the existing environment route:
    -  {route === "environment" && <Environment360 t={t} />}
    +  {route === "environment" && <Env360Home />}

## 3. Health checks / Pulse check tabs
Env360Home's tab strip includes both as placeholders (marked "existing tabs —
Environment360.jsx"). Two options, pick at integration time:
  a) QUICK  : leave Environment360.jsx mounted at a sub-route
              (e.g. route "environment-legacy") and make the two tab labels
              call onNav('environment-legacy').
  b) CLEAN  : lift the health-checks and pulse-check render functions out of
              Environment360.jsx into Env360Home's pgHealth/pgPulse containers
              (same DOM-write pattern the rest of the page uses).

## 4. Nothing else
AppShell renders {children}; GlobalSearch, NavBadge, collapsing behavior are
untouched. api.js already has its Environment 360 section for the legacy tabs;
Env360Home talks to /env-infra/* directly.
