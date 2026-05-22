-- ============================================================================
-- Phase 4 - Multi-Staff (Salons / Business Providers)
-- ============================================================================
-- Purpose: Allow BUSINESS-type providers (e.g., salons) to add staff members
--   that customers can pick when booking. Staff are managed by the business
--   owner's existing Supabase Auth account (no second auth system).
--
-- IMPORTANT: This migration is FULLY ADDITIVE.
--   - No existing tables are dropped, renamed, or restructured.
--   - All foreign keys are ON DELETE SET NULL / CASCADE as documented below.
--   - `bookings.staff_id` is NULLABLE -> existing bookings are unaffected.
--
-- Run this SQL once in the Supabase SQL Editor.
-- ============================================================================

-- 1) staff: profile entries belonging to a business provider (salon owner)
CREATE TABLE IF NOT EXISTS staff (
    id                BIGSERIAL PRIMARY KEY,
    business_auth_id  UUID NOT NULL,                       -- owner's Supabase auth.users.id
    name              VARCHAR(255) NOT NULL,
    role              VARCHAR(100),                        -- e.g. "Senior Stylist", "Barber"
    photo_url         TEXT,
    bio               TEXT,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    display_order     INTEGER NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_business_auth_id ON staff(business_auth_id);
CREATE INDEX IF NOT EXISTS idx_staff_active           ON staff(business_auth_id, is_active);

-- 2) staff_services: which services from the owner's catalog this staff member offers
--    service_id references services.id (the existing services table).
CREATE TABLE IF NOT EXISTS staff_services (
    staff_id   BIGINT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    service_id BIGINT NOT NULL,                       -- soft ref to services.id
    PRIMARY KEY (staff_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_services_service ON staff_services(service_id);

-- 3) staff_availability: weekly schedule per staff member
CREATE TABLE IF NOT EXISTS staff_availability (
    id            BIGSERIAL PRIMARY KEY,
    staff_id      BIGINT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    day_of_week   INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Sun .. 6=Sat
    is_available  BOOLEAN NOT NULL DEFAULT FALSE,
    start_time    TIME,
    end_time      TIME,
    UNIQUE (staff_id, day_of_week)
);

-- 4) Add nullable staff_id to bookings (additive, back-compatible)
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS staff_id BIGINT;

-- FK is optional & SET NULL so a deleted staff member never breaks an existing booking.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'bookings_staff_id_fkey'
    ) THEN
        ALTER TABLE bookings
            ADD CONSTRAINT bookings_staff_id_fkey
            FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL;
    END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_bookings_staff_id ON bookings(staff_id);

-- 5) updated_at trigger on staff
CREATE OR REPLACE FUNCTION set_staff_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_staff_updated_at ON staff;
CREATE TRIGGER trg_staff_updated_at
    BEFORE UPDATE ON staff
    FOR EACH ROW EXECUTE FUNCTION set_staff_updated_at();

-- ============================================================================
-- Done. No existing data was touched. Roll back simply by:
--   DROP TABLE staff_availability, staff_services, staff CASCADE;
--   ALTER TABLE bookings DROP COLUMN IF EXISTS staff_id;
-- ============================================================================
