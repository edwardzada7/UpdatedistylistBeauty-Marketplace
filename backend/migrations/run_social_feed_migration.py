"""
Phase 4 - Social Feed migration runner.
Applies /app/backend/migrations/phase4_social_feed.sql to Supabase Postgres.
Idempotent (uses IF NOT EXISTS everywhere).
"""
import os
import psycopg2
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise SystemExit("DATABASE_URL not set in .env")

# Fallback to Supabase Session Pooler if direct host isn't reachable from this
# environment (common in containerized previews). Tenant/region are derived from
# the SUPABASE_URL project ref.
import socket
import re as _re
def _host_resolves(url):
    m = _re.match(r"postgres(?:ql)?://[^@]+@([^:/]+)", url)
    if not m:
        return False
    try:
        socket.gethostbyname(m.group(1))
        return True
    except Exception:
        return False

if not _host_resolves(DATABASE_URL):
    project_ref = "gvmomyoeokauuixsydiu"
    pw = "26ikwFo1ntGGkESp"
    DATABASE_URL = (
        f"postgresql://postgres.{project_ref}:{pw}"
        f"@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"
    )
    print("[migrate] Using Supabase Session Pooler (eu-central-1)")

SQL_PATH = Path(__file__).resolve().parent / "phase4_social_feed.sql"
SQL = SQL_PATH.read_text()

print("Connecting to Supabase Postgres ...")
conn = psycopg2.connect(DATABASE_URL)
conn.autocommit = True
try:
    with conn.cursor() as cur:
        cur.execute(SQL)
    print("OK: phase4_social_feed.sql applied (idempotent).")

    # Verify tables
    with conn.cursor() as cur:
        cur.execute("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema='public'
              AND table_name IN ('provider_posts', 'provider_post_likes')
            ORDER BY table_name
        """)
        rows = cur.fetchall()
        print("Tables present:", [r[0] for r in rows])
finally:
    conn.close()
