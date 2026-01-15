-- Phase 1.9: Provider Identity, Privacy & Trust Fix
-- Migration script to add new columns for privacy and identity

-- Add privacy & identity fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(50);

-- Add provider type fields to stylists table
ALTER TABLE stylists ADD COLUMN IF NOT EXISTS provider_type VARCHAR(50) DEFAULT 'individual';
ALTER TABLE stylists ADD COLUMN IF NOT EXISTS business_name VARCHAR(255);

-- Create indexes for the new columns (optional but recommended for filtering)
CREATE INDEX IF NOT EXISTS idx_users_city ON users(city);
CREATE INDEX IF NOT EXISTS idx_users_country ON users(country);
CREATE INDEX IF NOT EXISTS idx_stylists_provider_type ON stylists(provider_type);
