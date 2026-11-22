-- Phase 33: boosts (paid promotion) and the provider Pro subscription. Safe to re-run.
CREATE TABLE IF NOT EXISTS public.promo_plans (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('boost', 'subscription')),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  days INTEGER NOT NULL CHECK (days > 0),
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  perks JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.promo_payments (
  id BIGSERIAL PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  auth_id TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('boost', 'subscription')),
  plan_id BIGINT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_promo_payments_auth ON public.promo_payments(auth_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.promotions (
  id BIGSERIAL PRIMARY KEY,
  provider_auth_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('profile', 'service', 'product', 'post')),
  target_id TEXT NOT NULL,
  plan_id BIGINT,
  source TEXT NOT NULL DEFAULT 'paid',          -- paid | pro_credit
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'active',        -- active | cancelled
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_promotions_live ON public.promotions(status, ends_at);
CREATE INDEX IF NOT EXISTS idx_promotions_owner ON public.promotions(provider_auth_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.provider_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  provider_auth_id TEXT NOT NULL,
  plan_id BIGINT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'active',        -- active | cancelled
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_provider_subs_owner ON public.provider_subscriptions(provider_auth_id, ends_at DESC);

-- Only the backend (service role) touches these tables.
ALTER TABLE public.promo_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_subscriptions ENABLE ROW LEVEL SECURITY;

-- Starting prices (editable later in Admin > Promotions).
INSERT INTO public.promo_plans (kind, code, name, days, price, perks, sort_order) VALUES
  ('boost', 'boost_3d',  '3-day boost',  3,  2000, '{}', 1),
  ('boost', 'boost_7d',  '7-day boost',  7,  4000, '{}', 2),
  ('boost', 'boost_14d', '14-day boost', 14, 7000, '{}', 3),
  ('subscription', 'pro_monthly', 'iStylist Pro (monthly)', 30, 5000, '{"boost_discount_pct": 10, "free_boost_days": 7}', 10)
ON CONFLICT (code) DO NOTHING;
