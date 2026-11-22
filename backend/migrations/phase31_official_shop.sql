-- Phase 31: iStylist Official posts + official shop + provider inventory ("Buy for My Shop"). Safe to re-run.
ALTER TABLE provider_posts ADD COLUMN IF NOT EXISTS is_official BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE product_listings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE product_listings ADD COLUMN IF NOT EXISTS provider_purchase_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE product_listings ADD COLUMN IF NOT EXISTS provider_purchase_price NUMERIC;

CREATE TABLE IF NOT EXISTS provider_inventory (
  id BIGSERIAL PRIMARY KEY,
  provider_auth_id UUID NOT NULL,
  product_id BIGINT NOT NULL,
  source_listing_id BIGINT,
  quantity INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  quantity_allocated_to_listings INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE provider_inventory ADD COLUMN IF NOT EXISTS source_listing_id BIGINT;
ALTER TABLE provider_inventory ADD COLUMN IF NOT EXISTS reserved_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE provider_inventory ADD COLUMN IF NOT EXISTS quantity_allocated_to_listings INTEGER NOT NULL DEFAULT 0;
ALTER TABLE provider_inventory ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_provider_inventory_provider ON provider_inventory(provider_auth_id);

CREATE TABLE IF NOT EXISTS provider_purchases (
  id BIGSERIAL PRIMARY KEY,
  reference TEXT UNIQUE NOT NULL,
  provider_auth_id UUID NOT NULL,
  listing_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE provider_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_purchases ENABLE ROW LEVEL SECURITY;
NOTIFY pgrst, 'reload schema';
