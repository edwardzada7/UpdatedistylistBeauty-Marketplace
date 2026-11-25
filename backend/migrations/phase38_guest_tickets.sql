-- Phase 38: guest ticket purchases (no account needed). Run after phase37. Safe to re-run.
ALTER TABLE public.event_orders ALTER COLUMN buyer_auth_id DROP NOT NULL;
ALTER TABLE public.event_orders ADD COLUMN IF NOT EXISTS guest_email TEXT;
ALTER TABLE public.event_orders ADD COLUMN IF NOT EXISTS guest_name TEXT;
ALTER TABLE public.event_orders ADD COLUMN IF NOT EXISTS guest_phone TEXT;
ALTER TABLE public.event_orders ADD COLUMN IF NOT EXISTS access_token TEXT;
CREATE INDEX IF NOT EXISTS idx_event_orders_guest_email ON public.event_orders(guest_email);

ALTER TABLE public.event_tickets ALTER COLUMN owner_auth_id DROP NOT NULL;
ALTER TABLE public.event_tickets ADD COLUMN IF NOT EXISTS owner_email TEXT;
ALTER TABLE public.event_tickets ADD COLUMN IF NOT EXISTS owner_name TEXT;
CREATE INDEX IF NOT EXISTS idx_event_tickets_owner_email ON public.event_tickets(owner_email);
