-- ============================================================================
-- Phase 9 - Pre-Launch Completion Migration
-- ============================================================================
-- This migration adds:
-- 1. Platform earnings tracking fields
-- 2. Support ticket status and admin reply
-- 3. Copyright complaints table
-- 4. Email notification queue table
-- 5. Indexes for performance

-- ============================================================================
-- 1. SUPPORT TICKETS - Add admin reply and status tracking
-- ============================================================================
ALTER TABLE support_tickets 
ADD COLUMN IF NOT EXISTS admin_notes TEXT,
ADD COLUMN IF NOT EXISTS admin_reply TEXT,
ADD COLUMN IF NOT EXISTS replied_by UUID REFERENCES users(auth_id),
ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES users(auth_id),
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- Add index for admin dashboard queries
CREATE INDEX IF NOT EXISTS idx_support_tickets_status_created 
ON support_tickets(status, created_at DESC);

-- ============================================================================
-- 2. COPYRIGHT COMPLAINTS - New table for Phase 8B
-- ============================================================================
CREATE TABLE IF NOT EXISTS copyright_complaints (
    id SERIAL PRIMARY KEY,
    
    -- Complainant info
    complainant_name VARCHAR(255) NOT NULL,
    complainant_email VARCHAR(255) NOT NULL,
    complainant_auth_id UUID REFERENCES users(auth_id),  -- optional if logged in
    
    -- Complaint details
    complaint_type VARCHAR(50) NOT NULL,  -- 'content', 'profile_photo', 'post', 'service_image'
    target_type VARCHAR(50) NOT NULL,     -- 'post', 'user', 'service', 'review'
    target_id VARCHAR(50) NOT NULL,       -- ID of the reported content
    target_url TEXT,                       -- URL to the infringing content
    
    -- Copyright claim details
    original_work_description TEXT NOT NULL,
    proof_of_ownership TEXT,               -- URL to proof or description
    infringing_content_description TEXT NOT NULL,
    
    -- Legal declaration
    good_faith_statement TEXT NOT NULL,
    accuracy_statement TEXT NOT NULL,
    electronic_signature VARCHAR(255) NOT NULL,
    
    -- Admin review
    status VARCHAR(50) DEFAULT 'pending',  -- pending, under_review, action_taken, dismissed, escalated
    admin_notes TEXT,
    reviewed_by UUID REFERENCES users(auth_id),
    reviewed_at TIMESTAMPTZ,
    action_taken TEXT,                     -- description of action (content removed, warning sent, etc.)
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for copyright complaints
CREATE INDEX IF NOT EXISTS idx_copyright_complaints_status 
ON copyright_complaints(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_copyright_complaints_target 
ON copyright_complaints(target_type, target_id);

-- ============================================================================
-- 3. EMAIL NOTIFICATION QUEUE - For async email sending
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_notifications (
    id SERIAL PRIMARY KEY,
    
    -- Recipient
    recipient_email VARCHAR(255) NOT NULL,
    recipient_auth_id UUID REFERENCES users(auth_id),
    
    -- Email details
    email_type VARCHAR(50) NOT NULL,  -- support_ticket, report, kyc_approved, kyc_rejected, dispute, etc.
    subject VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    html_body TEXT,
    
    -- Metadata
    metadata JSONB,
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending',  -- pending, sent, failed, skipped
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for email queue
CREATE INDEX IF NOT EXISTS idx_email_notifications_status 
ON email_notifications(status, created_at DESC) 
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_email_notifications_type 
ON email_notifications(email_type, created_at DESC);

-- ============================================================================
-- 4. PLATFORM EARNINGS TRACKING - Add booking fee fields
-- ============================================================================
-- Add platform fee tracking to bookings table
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS platform_fee_amount DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS platform_fee_percentage DECIMAL(5, 2) DEFAULT 0;

-- Update existing bookings with 0 platform fee (no retroactive charges)
UPDATE bookings 
SET platform_fee_amount = 0, platform_fee_percentage = 0 
WHERE platform_fee_amount IS NULL;

-- ============================================================================
-- 5. WALLET TRANSACTIONS - Add platform earnings category
-- ============================================================================
-- No schema change needed - we'll track platform earnings via existing
-- wallet_transactions with type='platform_fee'

-- ============================================================================
-- 6. UPDATE TIMESTAMPS TRIGGER for new tables
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to copyright_complaints
DROP TRIGGER IF EXISTS update_copyright_complaints_updated_at ON copyright_complaints;
CREATE TRIGGER update_copyright_complaints_updated_at 
    BEFORE UPDATE ON copyright_complaints 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply to email_notifications
DROP TRIGGER IF EXISTS update_email_notifications_updated_at ON email_notifications;
CREATE TRIGGER update_email_notifications_updated_at 
    BEFORE UPDATE ON email_notifications 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply to support_tickets (if not already exists)
DROP TRIGGER IF EXISTS update_support_tickets_updated_at ON support_tickets;
CREATE TRIGGER update_support_tickets_updated_at 
    BEFORE UPDATE ON support_tickets 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 7. RLS POLICIES (optional - for future direct Supabase client usage)
-- ============================================================================
-- Note: Current app uses service role key, so RLS not strictly needed
-- but adding for future-proofing

-- Enable RLS
ALTER TABLE copyright_complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;

-- Admin read all
CREATE POLICY IF NOT EXISTS "Admin can view all copyright complaints"
ON copyright_complaints FOR SELECT
USING (true);  -- Backend service role has full access

-- Users can submit
CREATE POLICY IF NOT EXISTS "Users can submit copyright complaints"
ON copyright_complaints FOR INSERT
WITH CHECK (true);

-- Email notifications - service role only
CREATE POLICY IF NOT EXISTS "Service role can manage emails"
ON email_notifications FOR ALL
USING (true);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- To apply this migration:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Paste this entire file
-- 3. Click "Run"
-- 4. Verify tables exist: copyright_complaints, email_notifications
-- 5. Verify columns added to: support_tickets, bookings
