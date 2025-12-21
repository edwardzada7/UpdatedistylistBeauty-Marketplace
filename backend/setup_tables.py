#!/usr/bin/env python3
"""
Script to create Supabase tables programmatically
Run this to set up the database schema
"""
import os
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables
load_dotenv('/app/backend/.env')

supabase_url = os.environ['SUPABASE_URL']
supabase_key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
supabase = create_client(supabase_url, supabase_key)

# SQL to create tables
create_tables_sql = """
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
    auth_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    specialty TEXT NOT NULL,
    bio TEXT,
    hourly_rate NUMERIC(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Wallets Table (linked to users via auth_id)
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY,
    auth_id TEXT UNIQUE NOT NULL,
    balance NUMERIC(10, 2) DEFAULT 0.0,
    currency TEXT DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_stylists_auth_id ON stylists(auth_id);
CREATE INDEX IF NOT EXISTS idx_wallets_auth_id ON wallets(auth_id);
"""

print("Setting up Supabase tables...")
print(f"Connecting to: {supabase_url}")

try:
    # Execute SQL using Supabase's RPC or direct query
    # Note: Supabase Python client doesn't have direct SQL execution
    # We need to use the REST API or execute via the dashboard
    print("\n" + "="*60)
    print("MANUAL SETUP REQUIRED")
    print("="*60)
    print("\nPlease run the following SQL in your Supabase SQL Editor:")
    print("https://supabase.com/dashboard/project/gvmomyoeokauuixsydiu/sql/new")
    print("\n" + create_tables_sql)
    print("\n" + "="*60)
    
    # Verify connection
    response = supabase.table("users").select("count", count="exact").limit(0).execute()
    print("\n✓ Connection successful!")
    print("Tables exist and are accessible.")
    
except Exception as e:
    if "relation" in str(e).lower() and "does not exist" in str(e).lower():
        print("\n✗ Tables do not exist yet.")
        print("\nPlease execute the SQL script above in your Supabase dashboard.")
    else:
        print(f"\n✗ Error: {str(e)}")

print("\nTo set up tables:")
print("1. Go to: https://supabase.com/dashboard/project/gvmomyoeokauuixsydiu/sql/new")
print("2. Copy and paste the SQL from /app/backend/setup_supabase.sql")
print("3. Click 'Run' to execute")
