"""The standards the review holds code to, as data.

Every rule carries the design it comes from, so a finding can say "the
Airflow fan-out design, AD-9" rather than "best practice". The ids are
stable: CP360-CR-<AREA>-<nnn>. `auto` says whether a deterministic rule in
codereview/rules enforces it; the rest are for the reviewer (Copilot or
Claude) reading the diff with this list in hand.
"""
from __future__ import annotations

AREAS = {"AF": "Airflow DAGs", "DBT": "dbt models", "PY": "Integration Hub Python", "SQL": "SQL and Liquibase", "SEC": "Secrets, hosts and data", "OPS": "Operability and evidence", "GEN": "Repository and change hygiene"}
SEVERITIES = ("blocker", "high", "medium", "low", "info")

RULES = [
    # ---------------------------------------------------------------- Airflow
    {"id": "CP360-CR-AF-001", "area": "AF", "sev": "blocker", "auto": True, "title": "Gate and ingest tasks never retry",
     "text": "retries=0 on every gate task and on ingest by default; only the TRANSIENT/E6 infrastructure class may retry, and only on non-gate tasks. Airflow's default of retrying everything turns every structural block into three attempts.",
     "ref": "18 Airflow DAG fan-out, AD-9; 13 Python ingestion framework, retry policy"},
    {"id": "CP360-CR-AF-002", "area": "AF", "sev": "high", "auto": True, "title": "catchup=False on every DAG",
     "text": "A DAG with catchup on replays every missed interval at deploy time. Backfill is the replay engine's job, with a reason and a ledger row, never a scheduler accident.",
     "ref": "18 Airflow DAG fan-out; 21 Replay / rerun engine"},
    {"id": "CP360-CR-AF-003", "area": "AF", "sev": "high", "auto": True, "title": "No work at parse time",
     "text": "Module-level code in a DAG file runs on every scheduler parse: no database connections, HTTP calls, file reads or Variable.get at the top level. Read config inside tasks, or from the registry the fan-out expands over.",
     "ref": "18 Airflow DAG fan-out, option B: generated from the registry"},
    {"id": "CP360-CR-AF-004", "area": "AF", "sev": "medium", "auto": True, "title": "Task ids derive from feed_id and domain",
     "text": "Task ids are deterministic and traceable to the feed and domain they serve, so 'which feed is index 17' is answerable at 2am. No free-text task ids, no ids that depend on list order.",
     "ref": "18 Airflow DAG fan-out, task naming"},
    {"id": "CP360-CR-AF-005", "area": "AF", "sev": "high", "auto": True, "title": "Connections and secrets from the secret store, never in code or Variables",
     "text": "No connection string, password, token or host in the DAG file, in default_args or in an Airflow Variable. Connections come from the secret-store backend.",
     "ref": "18 Airflow DAG fan-out, security; 32 Security and access control"},
    {"id": "CP360-CR-AF-006", "area": "AF", "sev": "medium", "auto": True, "title": "Every DAG declares owner, tags and a documented schedule",
     "text": "default_args has an owner that is a team, the DAG carries domain tags, and the schedule is explicit (a cron or a dataset trigger), never None on a production DAG unless it is replay-triggered and says so.",
     "ref": "18 Airflow DAG fan-out; 34 Observability"},
    {"id": "CP360-CR-AF-007", "area": "AF", "sev": "high", "auto": False, "title": "Intraday, EOD and replay never write the same target concurrently",
     "text": "A DAG that writes a target another DAG writes takes the cross-DAG lock (pool or sensor) the design names. Pools are capped to the Oracle session ceiling, never autoscaled past it.",
     "ref": "18 Airflow DAG fan-out, D6 and the pool ceiling; 55 Oracle connection pool"},
    {"id": "CP360-CR-AF-008", "area": "AF", "sev": "medium", "auto": False, "title": "Dims before facts; satellites close with their parent",
     "text": "Wave order is dimension-bearing domains first; a satellite feed completes inside its parent's wave. A new feed is added to the registry, not hand-wired into the graph.",
     "ref": "18 Airflow DAG fan-out, waves; 19 Dim-before-fact threads"},
    {"id": "CP360-CR-AF-009", "area": "AF", "sev": "medium", "auto": True, "title": "No PythonOperator doing the transformation itself",
     "text": "Business logic lives in the ingestion framework or dbt, called by the task; a DAG that contains SQL strings or pandas transformations is a second code path that diverges from the standard one.",
     "ref": "21 Replay engine: the engine owns no transformation logic; 13 Python ingestion framework"},

    # -------------------------------------------------------------------- dbt
    {"id": "CP360-CR-DBT-001", "area": "DBT", "sev": "blocker", "auto": True, "title": "No destructive merge or delete in Gold or Pre-Gold",
     "text": "AD-2: append new versions and flip current flags; never UPDATE a data column, DELETE a row or MERGE with a delete clause. An incremental model uses the append-then-flip macro, not merge.",
     "ref": "16 Gold dbt, AD-2; 17 Correction handling"},
    {"id": "CP360-CR-DBT-002", "area": "DBT", "sev": "high", "auto": True, "title": "Incremental models declare unique_key and an is_incremental() guard",
     "text": "materialized='incremental' without unique_key and without an is_incremental() block reloads the world or duplicates rows on every run.",
     "ref": "16 Gold dbt, incremental macro"},
    {"id": "CP360-CR-DBT-003", "area": "DBT", "sev": "high", "auto": True, "title": "ref() and source(), never a hard-coded table",
     "text": "A schema-qualified table name in a model bypasses lineage, environments and the contract gate. Every upstream is ref() or source().",
     "ref": "16 Gold dbt; Guardrails Gate 2 schema validation; 31 Audit lineage"},
    {"id": "CP360-CR-DBT-004", "area": "DBT", "sev": "medium", "auto": True, "title": "No SELECT * in a model",
     "text": "A model's columns are its contract. SELECT * makes an upstream column change a silent downstream change and breaks the YAML contract check.",
     "ref": "Guardrails Gate 2: contracts against the Oracle dictionary"},
    {"id": "CP360-CR-DBT-005", "area": "DBT", "sev": "high", "auto": True, "title": "Every model has a schema.yml entry with description, and tests on its key",
     "text": "A new or changed model carries a YAML entry: description, every column described, unique and not_null on the business key, accepted_values where a code list exists. Undocumented columns are what the agent and the analyst both cannot read.",
     "ref": "Guardrails Gate 3 transformation quality; 25 G3 dbt tests and business rules"},
    {"id": "CP360-CR-DBT-006", "area": "DBT", "sev": "medium", "auto": True, "title": "Model names follow the layer prefix",
     "text": "stg_ for Stage 1 views, int_ for intermediate, dim_ and fct_ for Pre-Gold, and the facade naming for consumer views. A name without a layer is a model nobody can place.",
     "ref": "16 Gold dbt; 15 Stage 2 enriched"},
    {"id": "CP360-CR-DBT-007", "area": "DBT", "sev": "medium", "auto": False, "title": "Bitemporal columns stay behind the facade",
     "text": "Consumers see is_current='Y' facade shapes for the gate-passed business date only; valid_from, valid_to and load_id never appear in a consumer view.",
     "ref": "16 Gold dbt, movement contract"},
    {"id": "CP360-CR-DBT-008", "area": "DBT", "sev": "medium", "auto": True, "title": "Config reads are as-of business date, not current",
     "text": "A model joining a config or reference table joins on effective_from/effective_to for the run's business date, never on is_current alone, or replay of last Tuesday answers with today's config.",
     "ref": "33 Metadata and config store, D3 versioned config"},

    # ----------------------------------------------------------------- Python
    {"id": "CP360-CR-PY-001", "area": "PY", "sev": "blocker", "auto": True, "title": "Errors carry a class; only TRANSIENT retries, bounded and jittered",
     "text": "Every raised error is one of TRANSIENT, STRUCTURAL, DATA, CONTRACT, SYSTEM. A bare except, a retry loop without a bound, or a retry on anything but TRANSIENT is the legacy pattern the shared error library replaces. Retries are counted, never silent.",
     "ref": "29 Error handling and quarantine, taxonomy and retry ownership"},
    {"id": "CP360-CR-PY-002", "area": "PY", "sev": "blocker", "auto": True, "title": "Acknowledge on durable write, never on processing",
     "text": "An inbound endpoint returns 202 once the envelope is written durably; parsing and matching happen downstream. A 500 because a lookup failed ties the sender's retries to our bugs.",
     "ref": "Hub architect review M2; 101 SDC event listener"},
    {"id": "CP360-CR-PY-003", "area": "PY", "sev": "high", "auto": True, "title": "Idempotency on the key the design names",
     "text": "A consumer write is keyed by the idempotency key, correlation id or load_id, and a replay yields the same row, rejected by the constraint. New write paths show the key and the constraint, not a comment saying it is safe to rerun.",
     "ref": "Hub architect review A5, M4; 13 Python ingestion, idempotency"},
    {"id": "CP360-CR-PY-004", "area": "PY", "sev": "high", "auto": True, "title": "Supersede, never delete; RAW is append-only",
     "text": "A redelivered file loads under a new LOAD_ID and the prior load is flagged SUPERSEDED. No DELETE against RAW, no in-place repair; rollback applies only to an uncommitted failed attempt.",
     "ref": "13 Python ingestion framework, AD-8"},
    {"id": "CP360-CR-PY-005", "area": "PY", "sev": "high", "auto": True, "title": "Outbound calls have a timeout and a circuit breaker",
     "text": "Every HTTP or database call names a timeout; a call to a dependency that can degrade (SEI view API, loader API) sits behind a breaker so retrying every micro-batch does not amplify load on a failing dependency.",
     "ref": "Hub architect review, SDC view poller; 29 Error handling"},
    {"id": "CP360-CR-PY-006", "area": "PY", "sev": "medium", "auto": True, "title": "Structured logging with correlation id; never print, never a payload value",
     "text": "Logs go through the logger with the correlation id, load_id or event_id in the record. No print(). Events carry keys and metrics, never a row value, an account number or a name.",
     "ref": "34 Observability, the shared classification rule; 32 Security"},
    {"id": "CP360-CR-PY-007", "area": "PY", "sev": "medium", "auto": True, "title": "Audit events on the key paths",
     "text": "A load, gate verdict, publish, replay, override, quarantine or config change emits an audit event bound to who or what did it. The emitter is fire-and-forget with a spool; it never blocks the pipeline.",
     "ref": "31 Audit lineage, emitter contract"},
    {"id": "CP360-CR-PY-008", "area": "PY", "sev": "medium", "auto": True, "title": "Config-driven, not a bespoke script per feed",
     "text": "A feed that needs its own function is a config gap, not a code exception. New per-feed branches (if feed == ...) in framework code are the thing the framework exists to prevent.",
     "ref": "13 Python ingestion framework, D1"},
    {"id": "CP360-CR-PY-009", "area": "PY", "sev": "low", "auto": True, "title": "Type hints and docstrings on public functions; no mutable default arguments",
     "text": "Production code reads as its own documentation. Public functions carry type hints and a docstring that says what it does and what it raises; a list or dict default argument is shared state.",
     "ref": "repository convention"},
    {"id": "CP360-CR-PY-010", "area": "PY", "sev": "high", "auto": True, "title": "No runtime DDL and no writes to config",
     "text": "The framework never creates tables at runtime, and no component writes to the config store; config changes are a Git commit applied by the CI job.",
     "ref": "13 Python ingestion framework, RAW DDL from 33; 33 Metadata and config store, D2"},

    # -------------------------------------------------------------------- SQL
    {"id": "CP360-CR-SQL-001", "area": "SQL", "sev": "blocker", "auto": True, "title": "Every Liquibase changeset has a rollback block and is non-destructive",
     "text": "A changeset without a rollback, or a DROP or destructive ALTER without a prior expand release, is rejected by the standards check. Expand now, contract in a later release.",
     "ref": "DevOps 360, database process steps 1 and 2"},
    {"id": "CP360-CR-SQL-002", "area": "SQL", "sev": "high", "auto": True, "title": "DDL is idempotent",
     "text": "A hand-applied SQL file guards CREATE with the ORA-955 pattern and ADD COLUMN with ORA-1430, so re-applying it is safe.",
     "ref": "repository convention, sql/ files"},
    {"id": "CP360-CR-SQL-003", "area": "SQL", "sev": "high", "auto": True, "title": "No literal in a WHERE that should be a bind",
     "text": "A query built by string formatting with a value in it is an injection surface and a plan-cache miss. Binds for values, allow-listed identifiers for names.",
     "ref": "32 Security and access control"},
    {"id": "CP360-CR-SQL-004", "area": "SQL", "sev": "medium", "auto": True, "title": "Column lists on INSERT; no SELECT * into a table",
     "text": "INSERT INTO t VALUES (...) without a column list breaks on the next ADD COLUMN; name the columns.",
     "ref": "repository convention"},
    {"id": "CP360-CR-SQL-005", "area": "SQL", "sev": "medium", "auto": False, "title": "Bitemporal tables are never updated in place",
     "text": "effective_from/effective_to and is_current are set by insert-and-flip; an UPDATE of a data column on a versioned table is AD-2 broken at the SQL layer.",
     "ref": "16 Gold dbt, AD-2; 33 Metadata and config store, D3"},

    # ---------------------------------------------------------------- Secrets
    {"id": "CP360-CR-SEC-001", "area": "SEC", "sev": "blocker", "auto": True, "title": "No secret in code, config or test data",
     "text": "No password, token, API key, private key or connection string with credentials anywhere in the repository, including tests, notebooks, YAML and the pipeline files. Secrets come from the secret store at run time.",
     "ref": "32 Security and access control; DevSecOps pipeline, credentials by reference"},
    {"id": "CP360-CR-SEC-002", "area": "SEC", "sev": "high", "auto": True, "title": "No hostnames, IP addresses or environment-specific endpoints in code",
     "text": "Hosts, ports and URLs are configuration, resolved per environment; a hostname in code ties the artefact to one environment and leaks the estate's shape into the repository.",
     "ref": "repository convention; DevOps 360 naming: an environment appears in a name only when the thing is remade per environment"},
    {"id": "CP360-CR-SEC-003", "area": "SEC", "sev": "blocker", "auto": True, "title": "No client data in the repository or in a log line",
     "text": "No account numbers, client names, sample rows or extracts, in code, tests or fixtures. Test data is synthetic and says so.",
     "ref": "32 Security, classification registry; 34 Observability, events carry keys never values"},
    {"id": "CP360-CR-SEC-004", "area": "SEC", "sev": "medium", "auto": False, "title": "PII columns are classified and masked from Stage 2 onward",
     "text": "A new column that could carry PII has a classification in the registry, and non-prod surfaces, exports and logs mask it by policy. RESTRICTED by default when unclassified.",
     "ref": "32 Security and access control, masking mechanism"},

    # ------------------------------------------------------------------- Ops
    {"id": "CP360-CR-OPS-001", "area": "OPS", "sev": "high", "auto": False, "title": "Every gate verdict and load is a stored row, not a log line",
     "text": "A new gate or load path writes its result to the control tables (dq_result, pipeline_run, load registry) with keys, so CP 360 can join it; a log grep is not evidence.",
     "ref": "34 Observability, where CP 360 reads; 31 Audit lineage"},
    {"id": "CP360-CR-OPS-002", "area": "OPS", "sev": "medium", "auto": False, "title": "Partial batch and failure behaviour is explicit",
     "text": "A change to a gate or a branch says what happens to the other domains when it fails: isolate, never cascade by default; remediation is fix-then-replay from LOAD_ID.",
     "ref": "22 Partial batch policy; 29 Error handling"},
    {"id": "CP360-CR-OPS-003", "area": "OPS", "sev": "medium", "auto": True, "title": "Tests change with the code",
     "text": "A change to a DAG, a model or a framework module comes with a test change or says why none is needed. A pull request that touches only production code is reviewed as untested.",
     "ref": "Guardrails Gate 3; DevSecOps pipeline, the 60% coverage floor"},

    # --------------------------------------------------------------- General
    {"id": "CP360-CR-GEN-001", "area": "GEN", "sev": "medium", "auto": True, "title": "No tracked build output, data files or large binaries",
     "text": "No file over 5 MB, no build directory, no extract, workbook or dump committed. Data lives in local-data, ignored.",
     "ref": "Guardrails Gate 1 repository checks"},
    {"id": "CP360-CR-GEN-002", "area": "GEN", "sev": "low", "auto": True, "title": "No TODO, FIXME or commented-out code in production files",
     "text": "A TODO in a merged file is a ticket nobody opened. Commented-out code is history Git already keeps.",
     "ref": "repository convention"},
    {"id": "CP360-CR-GEN-003", "area": "GEN", "sev": "medium", "auto": True, "title": "The branch and the change are named by ticket",
     "text": "Branches are type/ticket-slug; a pull request names the change and the design component it serves. Release and image names follow the naming standard.",
     "ref": "DevOps 360 naming standard"},
    {"id": "CP360-CR-GEN-004", "area": "GEN", "sev": "info", "auto": False, "title": "The change is traceable to a design",
     "text": "A new component, gate or table names the CP 360 design it implements (the component number) in its module docstring or the pull request. Unplaced code is the first sign of a second code path.",
     "ref": "CP 360 design catalogue"},
]

BY_ID = {r["id"]: r for r in RULES}


def rules_for(area=None, auto=None):
    out = RULES
    if area:
        out = [r for r in out if r["area"] == area]
    if auto is not None:
        out = [r for r in out if r["auto"] == auto]
    return out


def digest(areas=None):
    """The standards as Markdown for the reviewer's prompt: one line of id,
    severity and title, then the rule and its design reference."""
    areas = areas or list(AREAS)
    lines = ["# CP 360 code review standards", "", "Severity: blocker stops the merge; high must be fixed before production; medium is fixed in this change or a named follow-up; low and info are advice.", ""]
    for a in areas:
        rs = [r for r in RULES if r["area"] == a]
        if not rs:
            continue
        lines.append(f"## {AREAS[a]}")
        lines.append("")
        for r in rs:
            lines.append(f"- **{r['id']}** ({r['sev']}) **{r['title']}.** {r['text']} _Source: {r['ref']}._")
        lines.append("")
    return "\n".join(lines)
