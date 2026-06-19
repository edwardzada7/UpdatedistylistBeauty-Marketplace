-- ============================================================================
-- Phase 6 Hotfix - users.created_at column
-- The /api/admin/users/deleted endpoint SELECTs users.created_at, which is
-- missing in some environments. This migration is fully additive and safe
-- to re-run.
-- ============================================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Optional: backfill any pre-existing NULL values (DEFAULT NOW() handles
-- new rows; this is a no-op if no NULLs remain).
UPDATE users SET created_at = NOW() WHERE created_at IS NULL;

-- ============================================================================
-- Rollback (only if you need to revert):
--   ALTER TABLE users DROP COLUMN IF EXISTS created_at;
-- ============================================================================
