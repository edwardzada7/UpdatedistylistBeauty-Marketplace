-- Phase 42: provider-organised events, approval, payout hold, promotions. Safe to re-run.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS promoted_until TIMESTAMPTZ;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS payout_status TEXT NOT NULL DEFAULT 'pending';  -- pending | paid | void
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS payout_amount NUMERIC(12,2);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS payout_paid_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_events_organizer ON public.events(organizer_auth_id);

CREATE TABLE IF NOT EXISTS public.event_promotions (
    id BIGSERIAL PRIMARY KEY,
    reference TEXT NOT NULL UNIQUE,
    event_id BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    provider_auth_id TEXT NOT NULL,
    days INTEGER NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    announce_in_feed BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'pending',   -- pending | paid | failed
    processed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at TIMESTAMPTZ
);
ALTER TABLE public.event_promotions ENABLE ROW LEVEL SECURITY;
