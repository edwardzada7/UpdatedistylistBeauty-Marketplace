-- Provider Services Table
-- This table stores the services offered by each provider with pricing and settings

-- Create the provider_services table if it doesn't exist
CREATE TABLE IF NOT EXISTS provider_services (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER NOT NULL REFERENCES stylists(user_id) ON DELETE CASCADE,
    service_id VARCHAR(100) NOT NULL,
    service_name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) DEFAULT 0.00,
    duration INTEGER DEFAULT 60,  -- in minutes
    enabled BOOLEAN DEFAULT true,
    consultation_required BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(provider_id, service_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_provider_services_provider_id ON provider_services(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_services_service_id ON provider_services(service_id);
CREATE INDEX IF NOT EXISTS idx_provider_services_enabled ON provider_services(enabled);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_provider_services_updated_at ON provider_services;
CREATE TRIGGER update_provider_services_updated_at
    BEFORE UPDATE ON provider_services
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE provider_services ENABLE ROW LEVEL SECURITY;

-- Policy for reading (anyone can read)
CREATE POLICY IF NOT EXISTS "Anyone can read provider services"
    ON provider_services FOR SELECT
    USING (true);

-- Policy for inserting (authenticated users only)
CREATE POLICY IF NOT EXISTS "Authenticated users can insert provider services"
    ON provider_services FOR INSERT
    WITH CHECK (true);

-- Policy for updating (providers can update their own services)
CREATE POLICY IF NOT EXISTS "Providers can update their own services"
    ON provider_services FOR UPDATE
    USING (true);

-- Policy for deleting (providers can delete their own services)
CREATE POLICY IF NOT EXISTS "Providers can delete their own services"
    ON provider_services FOR DELETE
    USING (true);
