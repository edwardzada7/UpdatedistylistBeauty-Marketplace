-- iStylist Provider Services Table Migration
-- Creates the provider_services table for storing provider service offerings

-- Drop table if exists (for clean migration)
DROP TABLE IF EXISTS provider_services CASCADE;

-- Create provider_services table
CREATE TABLE provider_services (
    id BIGSERIAL PRIMARY KEY,
    provider_id BIGINT NOT NULL REFERENCES stylists(user_id) ON DELETE CASCADE,
    sub_service_id VARCHAR(100) NOT NULL,  -- e.g., "haircut", "box-braids"
    sub_service_name VARCHAR(255) NOT NULL, -- Display name
    service_id VARCHAR(100) NOT NULL,       -- Parent service e.g., "barbers"
    category_id VARCHAR(100) NOT NULL,      -- Category e.g., "beauty-grooming"
    price NUMERIC(10, 2) DEFAULT 0,
    duration_minutes INTEGER DEFAULT 60,
    description TEXT,
    in_store BOOLEAN DEFAULT true,
    home_service BOOLEAN DEFAULT false,
    travel_service BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint on provider + sub_service combination
    CONSTRAINT unique_provider_sub_service UNIQUE (provider_id, sub_service_id)
);

-- Create indexes for common queries
CREATE INDEX idx_provider_services_provider_id ON provider_services(provider_id);
CREATE INDEX idx_provider_services_is_active ON provider_services(is_active);
CREATE INDEX idx_provider_services_category ON provider_services(category_id);
CREATE INDEX idx_provider_services_service ON provider_services(service_id);

-- Enable Row Level Security
ALTER TABLE provider_services ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Policy: Providers can SELECT their own services
CREATE POLICY "Providers can view own services"
ON provider_services
FOR SELECT
TO authenticated
USING (
    provider_id IN (
        SELECT user_id FROM stylists 
        WHERE auth_id = auth.uid()
    )
);

-- Policy: Providers can INSERT their own services
CREATE POLICY "Providers can insert own services"
ON provider_services
FOR INSERT
TO authenticated
WITH CHECK (
    provider_id IN (
        SELECT user_id FROM stylists 
        WHERE auth_id = auth.uid()
    )
);

-- Policy: Providers can UPDATE their own services
CREATE POLICY "Providers can update own services"
ON provider_services
FOR UPDATE
TO authenticated
USING (
    provider_id IN (
        SELECT user_id FROM stylists 
        WHERE auth_id = auth.uid()
    )
)
WITH CHECK (
    provider_id IN (
        SELECT user_id FROM stylists 
        WHERE auth_id = auth.uid()
    )
);

-- Policy: Public can view active services (for browsing)
CREATE POLICY "Public can view active services"
ON provider_services
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_provider_services_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_provider_services_timestamp ON provider_services;
CREATE TRIGGER trigger_update_provider_services_timestamp
    BEFORE UPDATE ON provider_services
    FOR EACH ROW
    EXECUTE FUNCTION update_provider_services_updated_at();

-- Grant permissions (service role has full access)
GRANT ALL ON provider_services TO service_role;
GRANT SELECT ON provider_services TO anon;
GRANT ALL ON provider_services TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE provider_services_id_seq TO authenticated;
