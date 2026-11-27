-- Guest shop checkout: orders can belong to a guest (no account), tracked with a private token.
ALTER TABLE public.shop_orders ALTER COLUMN customer_auth_id DROP NOT NULL;
ALTER TABLE public.shop_orders
  ADD COLUMN IF NOT EXISTS guest_email TEXT NULL,
  ADD COLUMN IF NOT EXISTS guest_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS guest_phone TEXT NULL,
  ADD COLUMN IF NOT EXISTS access_token TEXT NULL;
CREATE INDEX IF NOT EXISTS idx_shop_orders_guest_email ON public.shop_orders (guest_email, created_at DESC) WHERE guest_email IS NOT NULL;
