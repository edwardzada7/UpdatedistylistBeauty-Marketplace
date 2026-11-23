-- Phase 35: home-service bookings (customer pin, distance, travel fee). Safe to re-run.
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS service_mode TEXT NOT NULL DEFAULT 'in_store';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS customer_address TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS customer_latitude DOUBLE PRECISION;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS customer_longitude DOUBLE PRECISION;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS customer_area TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS travel_distance_km NUMERIC(8,1);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS travel_fee NUMERIC(12,2) NOT NULL DEFAULT 0;
