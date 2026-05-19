-- ====================================================================
-- HYBRID NO-SHOW SYSTEM - Additive migration
-- Adds columns required for the no-show flow. ALL idempotent / safe to re-run.
-- DOES NOT touch wallet, payment, or escrow tables.
-- ====================================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS no_show_reported_by    UUID NULL,
  ADD COLUMN IF NOT EXISTS no_show_reporter_role  TEXT NULL,     -- 'customer' or 'provider'
  ADD COLUMN IF NOT EXISTS no_show_reported_at    TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS no_show_reason         TEXT NULL,
  ADD COLUMN IF NOT EXISTS no_show_deadline       TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS dispute_opened         BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dispute_reason         TEXT NULL,
  ADD COLUMN IF NOT EXISTS dispute_opened_at      TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS dispute_opened_by      UUID NULL;

-- Index to make the scheduler's "find expired pending no-shows" query fast
CREATE INDEX IF NOT EXISTS idx_bookings_status_deadline
  ON public.bookings (status, no_show_deadline)
  WHERE status = 'no_show_pending';

-- Convenience index for admin "all disputed" queries
CREATE INDEX IF NOT EXISTS idx_bookings_status_disputed
  ON public.bookings (status)
  WHERE status = 'disputed';
