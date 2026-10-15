# scd2lens

Reverse-engineers the SCD2 business rules of the PBDW Oracle warehouse: which
columns are the keys, how START_DATE and END_DATE are set, when a version is
closed, what the current row is, which columns are overwritten in place, and
how clean the history actually is. Two kinds of evidence, combined into one
rule card per table:

* **static** — the ODI repository export (CSV, or the XLSX when the CSVs are
  absent) in `odi_dir`;
* **runtime** — read-only queries against the warehouse, optional.

Every rule carries an evidence pointer and a confidence: `PROVEN`,
`INFERRED` or `UNKNOWN_TRUNCATED`. Offline mode (no database) produces a
complete card from the static evidence alone.

```
pip install -e .[dev]          # add [ldap] if your DSN is an ldap:// directory alias
pytest -q
scd2lens odi  --repo ./odi_export --table DIM_ACCOUNT
scd2lens db   --table DIM_ACCOUNT --checks all
scd2lens key  --table DIM_ACCOUNT --key <business key value>
scd2lens card --table DIM_ACCOUNT --out ./out
scd2lens all  --out ./out
```

## Connecting

Set three environment variables; nothing about the connection is written
to disk or to the reports.

```
PBDW_DSN       an EZConnect string, a full connect descriptor, or an
               ldap://host:port/service,cn=OracleContext,dc=... alias
PBDW_USER      a READ-ONLY account
PBDW_PASSWORD
```

An `ldap://` alias is resolved to its connect descriptor through the
directory before connecting; that needs the `ldap3` extra. The session is
read-only by construction: the tool issues `SELECT` only, uses bind
variables for every value, and interpolates only validated identifiers.

### When the listener requires Native Network Encryption (DPY-3001)

python-oracledb's default thin mode cannot negotiate Oracle Native Network
Encryption. If the connection fails with `DPY-3001`, the tool switches to
thick mode and retries, which needs an Oracle Instant Client on the machine:

1. download Instant Client **Basic Light** for your platform and unzip it,
   for example to `C:\oracle\instantclient_23_8`;
2. set `ORACLE_CLIENT_LIB` to that folder (or add it to `PATH`), and
   optionally `PBDW_THICK=1` to start in thick mode without the retry;
3. run the command again.

Thick mode can also read a `tnsnames.ora` / `ldap.ora` under `TNS_ADMIN`,
so a plain alias name works as `PBDW_DSN` once Oracle Net is configured.
The alternative, if the DBA offers it, is a TCPS (TLS) listener endpoint,
which thin mode supports without a client install.

## Hard constraints the code enforces

* no DDL, no DML, no temporary tables — inline subqueries only;
* row hashes are computed in chunks of `hash_chunk_size` columns, so a
  500-column table never hits the 4000-byte expression limit;
* `code_preview` in the export is truncated; a rule that cannot be read
  from the preview is reported as `UNKNOWN_TRUNCATED`, never as absent;
* the current row is `END_DATE IS NULL`; `ACTIVE_IND` is reported but not
  trusted, because the end-date procedures do not maintain it;
* technical columns and LOBs are excluded from change detection.
