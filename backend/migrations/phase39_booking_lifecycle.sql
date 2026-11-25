-- Booking lifecycle: auto-cancel (no_response), end-of-session prompts, 24h auto-complete, late-cancel penalty.
-- Safe to re-run. Status is free text, so 'no_response' needs no constraint change.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS auto_cancel_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS completion_prompt_sent_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS auto_complete_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS customer_confirmed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS customer_disputed_completion_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS provider_confirmed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS completed_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS canceled_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS late_cancel_penalty NUMERIC NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_pending_created ON public.bookings (status, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_bookings_confirmed_prompt ON public.bookings (status, auto_complete_at) WHERE status = 'confirmed';
