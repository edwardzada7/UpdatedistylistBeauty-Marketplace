-- ============================================================================
-- Phase 5 - Account Types + KYC Foundation
-- Fully additive. No existing data touched. Safe rollback notes at the bottom.
-- ============================================================================

-- 1) Add account_type column to users
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS account_type VARCHAR(20) NOT NULL DEFAULT 'individual'
    CHECK (account_type IN ('individual', 'business'));

-- Backfill existing rows
UPDATE users SET account_type = 'individual' WHERE account_type IS NULL;

-- 2) KYC submissions table (one active submission per user; resubmit = UPDATE)
CREATE TABLE IF NOT EXISTS kyc_submissions (
    id                  BIGSERIAL PRIMARY KEY,
    user_auth_id        UUID NOT NULL UNIQUE,
    account_type        VARCHAR(20) NOT NULL CHECK (account_type IN ('individual', 'business')),
    status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'verified', 'rejected')),

    -- Individual fields
    full_name           TEXT,
    phone_number        TEXT,
    date_of_birth       DATE,
    id_type             TEXT,
    id_number           TEXT,
    selfie_url          TEXT,
    id_doc_url          TEXT,

    -- Business fields
    business_name       TEXT,
    registration_number TEXT,
    business_address    TEXT,
    contact_person      TEXT,
    contact_phone       TEXT,
    cac_doc_url         TEXT,
    logo_url            TEXT,

    -- Review metadata
    rejection_reason    TEXT,
    submitted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at         TIMESTAMPTZ,
    reviewed_by_auth_id UUID
);

CREATE INDEX IF NOT EXISTS idx_kyc_status     ON kyc_submissions(status);
CREATE INDEX IF NOT EXISTS idx_kyc_user       ON kyc_submissions(user_auth_id);
CREATE INDEX IF NOT EXISTS idx_kyc_submitted  ON kyc_submissions(submitted_at DESC);

-- 3) Supabase Storage bucket for KYC documents (private)
-- Run this if the bucket doesn't already exist:
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Rollback (if needed):
--   DROP TABLE IF EXISTS kyc_submissions;
--   ALTER TABLE users DROP COLUMN IF EXISTS account_type;
--   DELETE FROM storage.buckets WHERE id = 'kyc-documents';
-- ============================================================================
