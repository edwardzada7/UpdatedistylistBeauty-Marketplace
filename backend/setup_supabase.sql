-- Create Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    auth_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Stylists Table (linked to users via auth_id)
CREATE TABLE IF NOT EXISTS stylists (
    id UUID PRIMARY KEY,
    auth_id TEXT UNIQUE NOT NULL REFERENCES users(auth_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    specialty TEXT NOT NULL,
    bio TEXT,
    hourly_rate NUMERIC(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Wallets Table (linked to users via auth_id)
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY,
    auth_id TEXT UNIQUE NOT NULL REFERENCES users(auth_id) ON DELETE CASCADE,
    balance NUMERIC(10, 2) DEFAULT 0.0,
    currency TEXT DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_stylists_auth_id ON stylists(auth_id);
CREATE INDEX IF NOT EXISTS idx_wallets_auth_id ON wallets(auth_id);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE stylists ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies (Service role bypass RLS by default)
-- These policies are for when using anon key from frontend
CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (auth_id = auth.uid()::TEXT);

CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (auth_id = auth.uid()::TEXT);

CREATE POLICY "Stylists can view their own profile" ON stylists
    FOR SELECT USING (auth_id = auth.uid()::TEXT);

CREATE POLICY "Stylists can update their own profile" ON stylists
    FOR UPDATE USING (auth_id = auth.uid()::TEXT);

CREATE POLICY "Users can view their own wallet" ON wallets
    FOR SELECT USING (auth_id = auth.uid()::TEXT);

CREATE POLICY "Users can update their own wallet" ON wallets
    FOR UPDATE USING (auth_id = auth.uid()::TEXT);
