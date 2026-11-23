-- Phase 36: reschedule bookings (propose / accept / decline). Run once in the Supabase SQL editor.
CREATE TABLE IF NOT EXISTS public.booking_reschedules (
    id BIGSERIAL PRIMARY KEY,
    booking_id BIGINT NOT NULL,
    proposed_by_auth_id TEXT NOT NULL,
    proposed_by_role TEXT NOT NULL,            -- 'customer' | 'provider'
    old_date TEXT,
    old_time TEXT,
    new_date TEXT NOT NULL,
    new_time TEXT NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending',    -- pending | accepted | declined | canceled | expired
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    responded_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_booking_reschedules_booking ON public.booking_reschedules(booking_id, status);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS reschedule_count INTEGER NOT NULL DEFAULT 0;
