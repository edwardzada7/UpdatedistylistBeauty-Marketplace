-- =====================================================
-- iStylist Phase 2.2 - Paystack Payment Integration
-- Database Migration Script
-- =====================================================

-- Run this SQL in your Supabase SQL Editor to enable
-- the full Paystack payment integration features.

-- =====================================================
-- 1. WALLET_TRANSACTIONS TABLE
-- =====================================================

-- Create wallet_transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id SERIAL PRIMARY KEY,
    user_auth_id UUID NOT NULL,
    type VARCHAR(50) NOT NULL, -- TOPUP, ESCROW_HOLD, ESCROW_RELEASE, ESCROW_REFUND, EARNINGS
    direction VARCHAR(10) NOT NULL, -- CREDIT, DEBIT
    amount DECIMAL(12, 2) NOT NULL,
    reference VARCHAR(255),
    booking_id INTEGER,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- If table exists but missing user_auth_id column, add it
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'wallet_transactions' AND column_name = 'user_auth_id'
    ) THEN
        ALTER TABLE wallet_transactions ADD COLUMN user_auth_id UUID;
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_auth_id 
ON wallet_transactions(user_auth_id);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at 
ON wallet_transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference 
ON wallet_transactions(reference);


-- =====================================================
-- 2. WALLETS TABLE - Add escrow_balance column
-- =====================================================

-- Add escrow_balance column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'wallets' AND column_name = 'escrow_balance'
    ) THEN
        ALTER TABLE wallets ADD COLUMN escrow_balance DECIMAL(12, 2) DEFAULT 0;
    END IF;
END $$;


-- =====================================================
-- 3. PAYMENTS TABLE - For tracking payment records
-- =====================================================

CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    reference VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    purpose VARCHAR(50) NOT NULL, -- wallet_topup, booking_escrow
    booking_id INTEGER,
    status VARCHAR(50) DEFAULT 'pending', -- pending, success, failed
    paystack_access_code VARCHAR(255),
    paystack_response JSONB,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verified_at TIMESTAMP WITH TIME ZONE,
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(reference);
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);


-- =====================================================
-- 4. WEBHOOK_LOGS TABLE - For auditing webhooks
-- =====================================================

CREATE TABLE IF NOT EXISTS webhook_logs (
    id SERIAL PRIMARY KEY,
    provider VARCHAR(50) NOT NULL, -- paystack
    event VARCHAR(100) NOT NULL,
    data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_provider ON webhook_logs(provider);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event ON webhook_logs(event);


-- =====================================================
-- 5. BOOKINGS TABLE - Add payment-related columns
-- =====================================================

-- Add payment_reference column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'payment_reference'
    ) THEN
        ALTER TABLE bookings ADD COLUMN payment_reference VARCHAR(255);
    END IF;
END $$;

-- Add payment_status column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'payment_status'
    ) THEN
        ALTER TABLE bookings ADD COLUMN payment_status VARCHAR(50) DEFAULT 'unpaid';
    END IF;
END $$;


-- =====================================================
-- VERIFICATION QUERY
-- Run this to verify the migration was successful
-- =====================================================

-- SELECT 
--     'wallet_transactions' as table_name,
--     COUNT(*) as column_count,
--     ARRAY_AGG(column_name) as columns
-- FROM information_schema.columns 
-- WHERE table_name = 'wallet_transactions'
-- GROUP BY table_name
-- UNION ALL
-- SELECT 
--     'wallets' as table_name,
--     COUNT(*) as column_count,
--     ARRAY_AGG(column_name) as columns
-- FROM information_schema.columns 
-- WHERE table_name = 'wallets'
-- GROUP BY table_name
-- UNION ALL
-- SELECT 
--     'payments' as table_name,
--     COUNT(*) as column_count,
--     ARRAY_AGG(column_name) as columns
-- FROM information_schema.columns 
-- WHERE table_name = 'payments'
-- GROUP BY table_name;

COMMIT;
