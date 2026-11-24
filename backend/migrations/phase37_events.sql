-- Phase 37: Events + one-time-use tickets (QR + 6-digit PIN) + door scanners.
-- Run once in the Supabase SQL editor. Safe to re-run.
CREATE TABLE IF NOT EXISTS public.events (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    banner_url TEXT,
    venue TEXT,
    address TEXT,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ,
    organizer_type TEXT NOT NULL DEFAULT 'admin',     -- 'admin' now; 'provider' / 'user' later
    organizer_auth_id TEXT,
    status TEXT NOT NULL DEFAULT 'draft',             -- draft | published | canceled
    is_featured BOOLEAN NOT NULL DEFAULT false,
    fee_mode TEXT NOT NULL DEFAULT 'add_on',          -- add_on (buyer pays service fee on top) | absorbed (included in price)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_status_start ON public.events(status, starts_at);

CREATE TABLE IF NOT EXISTS public.event_ticket_types (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(12,2) NOT NULL DEFAULT 0,           -- 0 = free / "I'm attending"
    capacity INTEGER,                                  -- NULL = unlimited
    sold INTEGER NOT NULL DEFAULT 0,
    max_per_order INTEGER NOT NULL DEFAULT 10,
    sales_end TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_ticket_types_event ON public.event_ticket_types(event_id);

CREATE TABLE IF NOT EXISTS public.event_orders (
    id BIGSERIAL PRIMARY KEY,
    reference TEXT NOT NULL UNIQUE,
    event_id BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    ticket_type_id BIGINT NOT NULL REFERENCES public.event_ticket_types(id),
    buyer_auth_id TEXT NOT NULL,
    email TEXT,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
    service_fee NUMERIC(12,2) NOT NULL DEFAULT 0,      -- charged on top of the price (add_on mode)
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,     -- what Paystack charges
    platform_fee NUMERIC(12,2) NOT NULL DEFAULT 0,     -- platform's total take (fee + commission)
    organizer_payout NUMERIC(12,2) NOT NULL DEFAULT 0, -- owed to a provider organizer (0 for admin events)
    status TEXT NOT NULL DEFAULT 'pending',            -- pending | paid | failed | refund_due | refunded
    processed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_event_orders_buyer ON public.event_orders(buyer_auth_id);
CREATE INDEX IF NOT EXISTS idx_event_orders_event ON public.event_orders(event_id, status);

CREATE TABLE IF NOT EXISTS public.event_tickets (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES public.event_orders(id) ON DELETE CASCADE,
    event_id BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    ticket_type_id BIGINT NOT NULL REFERENCES public.event_ticket_types(id),
    owner_auth_id TEXT NOT NULL,
    code_token TEXT NOT NULL UNIQUE,                   -- random secret inside the QR code
    pin TEXT NOT NULL,                                 -- 6 digits, unique per event
    status TEXT NOT NULL DEFAULT 'valid',              -- valid | used | refund_due | canceled
    used_at TIMESTAMPTZ,
    used_via TEXT,                                     -- 'qr' | 'pin'
    scanned_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (event_id, pin)
);
CREATE INDEX IF NOT EXISTS idx_event_tickets_owner ON public.event_tickets(owner_auth_id);
CREATE INDEX IF NOT EXISTS idx_event_tickets_event ON public.event_tickets(event_id, status);

CREATE TABLE IF NOT EXISTS public.event_scanners (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    label TEXT,
    access_code TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_scanners_event ON public.event_scanners(event_id);

-- The backend uses the service role, so lock these tables away from the public API.
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_scanners ENABLE ROW LEVEL SECURITY;
