"""
One-off migration: add metadata, actor_auth_id, title columns to notifications.
Additive & idempotent (uses IF NOT EXISTS).
"""
import os
import psycopg2
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# Accept either DATABASE_URL or build from parts
DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise SystemExit("DATABASE_URL not set in .env")

SQL = """
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='notifications' AND column_name='metadata'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='notifications' AND column_name='actor_auth_id'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN actor_auth_id UUID NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='notifications' AND column_name='title'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN title TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='notifications' AND column_name='read_at'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN read_at TIMESTAMPTZ NULL;
  END IF;
END $$;

-- Index for fast JSONB lookup by booking_id (used by reminder idempotency check)
CREATE INDEX IF NOT EXISTS idx_notifications_metadata_booking
ON public.notifications ((metadata->>'booking_id'))
WHERE metadata IS NOT NULL;

-- Index for type+auth_id queries (used by reminder existence check)
CREATE INDEX IF NOT EXISTS idx_notifications_auth_type
ON public.notifications (auth_id, type);
"""

print("Connecting to Supabase Postgres ...")
conn = psycopg2.connect(DATABASE_URL)
conn.autocommit = True
try:
    with conn.cursor() as cur:
        cur.execute(SQL)
    print("OK: migration applied (idempotent).")

    # Show resulting columns
    with conn.cursor() as cur:
        cur.execute("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema='public' AND table_name='notifications'
            ORDER BY ordinal_position
        """)
        rows = cur.fetchall()
        print("Final notifications columns:")
        for r in rows:
            print(" -", r)
finally:
    conn.close()
