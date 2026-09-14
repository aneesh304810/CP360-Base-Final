"""
resolve_ldap_dsn.py — resolve an Oracle LDAP alias (what SQL Developer's
jdbc:oracle:thin:@ldap://... URL does) into the raw connect descriptor that
python-oracledb can use directly, then optionally test-connect.

    pip install ldap3 oracledb

Usage:
    python ingestion/resolve_ldap_dsn.py
    python ingestion/resolve_ldap_dsn.py --user pbdw_user     # also test login
"""
import argparse
import getpass
import sys

LDAP_HOST = "qcoid.bbh.com"
LDAP_PORT = 3060
ALIAS     = "pbdwhdbq"
CONTEXT   = "cn=OracleContext,dc=testbbh,dc=com"


def resolve() -> str:
    from ldap3 import Server, Connection, ALL
    server = Server(LDAP_HOST, port=LDAP_PORT, get_info=ALL)
    conn = Connection(server, auto_bind=True)          # anonymous bind,
    # same as SQL Developer's default LDAP lookup
    base = f"cn={ALIAS},{CONTEXT}"
    ok = conn.search(base, "(objectclass=*)",
                     attributes=["orclNetDescString"])
    if not ok or not conn.entries:
        # some directories need a subtree search from the context instead
        conn.search(CONTEXT, f"(cn={ALIAS})",
                    attributes=["orclNetDescString"])
    if not conn.entries:
        sys.exit(f"alias {ALIAS} not found under {CONTEXT} — check spelling "
                 f"or ask the DBA for the descriptor")
    desc = str(conn.entries[0].orclNetDescString)
    return " ".join(desc.split())                      # normalize whitespace


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--user", help="also test-connect with this username")
    args = ap.parse_args()

    desc = resolve()
    print("\nResolved connect descriptor:\n")
    print(f"  {desc}\n")
    print("Put this in load-variance-env.ps1 (single quotes!):\n")
    print(f"  $env:CP_VAR_PBDW_DSN = 'YOUR_USER:YOUR_PWD@{desc}'\n")

    if args.user:
        import os
        import oracledb
        lib = os.environ.get("CP_ORACLE_CLIENT_DIR")
        if lib:
            oracledb.init_oracle_client(lib_dir=lib)
        pwd = getpass.getpass(f"Password for {args.user}: ")
        conn = oracledb.connect(user=args.user, password=pwd, dsn=desc)
        print(f"CONNECTED — Oracle {conn.version} "
              f"({conn.instance_name or 'instance n/a'})")
        cur = conn.cursor()
        cur.execute("SELECT VALIDATE_CONVERSION('1.5' AS NUMBER) FROM dual")
        print("VALIDATE_CONVERSION available:", cur.fetchone()[0] == 1)
        conn.close()


if __name__ == "__main__":
    main()
