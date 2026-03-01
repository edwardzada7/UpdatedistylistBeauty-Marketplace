-- Phase 2B: In-App Notifications System
-- This migration creates the notifications table and sets up RLS policies
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. CREATE NOTIFICATIONS TABLE (IF NOT EXISTS)
-- ============================================

CREATE TABLE IF NOT EXISTS public.notifications (
    id BIGSERIAL PRIMARY KEY,
    recipient_auth_id UUID NOT NULL,
    actor_auth_id UUID NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    read_at TIMESTAMPTZ NULL
);

-- Add columns if they don't exist (for existing tables)
DO $$ 
BEGIN
    -- Add actor_auth_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'notifications' 
                   AND column_name = 'actor_auth_id') THEN
        ALTER TABLE public.notifications ADD COLUMN actor_auth_id UUID NULL;
    END IF;
    
    -- Add metadata if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'notifications' 
                   AND column_name = 'metadata') THEN
        ALTER TABLE public.notifications ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
    
    -- Add read_at if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'notifications' 
                   AND column_name = 'read_at') THEN
        ALTER TABLE public.notifications ADD COLUMN read_at TIMESTAMPTZ NULL;
    END IF;
    
    -- Add title if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'notifications' 
                   AND column_name = 'title') THEN
        ALTER TABLE public.notifications ADD COLUMN title TEXT NOT NULL DEFAULT 'Notification';
    END IF;
    
    -- Add message if missing (might be named 'content' in some schemas)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'notifications' 
                   AND column_name = 'message') THEN
        ALTER TABLE public.notifications ADD COLUMN message TEXT NOT NULL DEFAULT '';
    END IF;
END $$;

-- ============================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- ============================================

-- Index for fetching user's notifications ordered by date
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created 
ON public.notifications (recipient_auth_id, created_at DESC);

-- Index for fetching unread notifications
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read 
ON public.notifications (recipient_auth_id, read);

-- Index for notification type filtering
CREATE INDEX IF NOT EXISTS idx_notifications_type 
ON public.notifications (type);

-- ============================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. CREATE RLS POLICIES
-- ============================================

-- Drop existing policies if they exist (to allow re-running migration)
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Service role can do anything" ON public.notifications;

-- Policy: Users can SELECT their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (recipient_auth_id = auth.uid());

-- Policy: Users can UPDATE their own notifications (to mark as read)
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (recipient_auth_id = auth.uid())
WITH CHECK (recipient_auth_id = auth.uid());

-- Policy: Service role can do everything (for backend inserts)
CREATE POLICY "Service role can do anything"
ON public.notifications
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- 5. GRANT PERMISSIONS
-- ============================================

-- Grant usage on the sequence for the service role
GRANT USAGE, SELECT ON SEQUENCE notifications_id_seq TO service_role;

-- Grant full access to authenticated users (RLS will restrict)
GRANT SELECT, UPDATE ON public.notifications TO authenticated;

-- Grant full access to service role
GRANT ALL ON public.notifications TO service_role;

-- ============================================
-- 6. COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE public.notifications IS 'In-app notifications for users';
COMMENT ON COLUMN public.notifications.recipient_auth_id IS 'UUID of the user receiving the notification';
COMMENT ON COLUMN public.notifications.actor_auth_id IS 'UUID of the user who triggered the notification (optional)';
COMMENT ON COLUMN public.notifications.type IS 'Notification type: booking_created, booking_confirmed, booking_declined, booking_canceled, booking_completed, withdrawal_requested, withdrawal_approved, withdrawal_rejected, wallet_topup_success';
COMMENT ON COLUMN public.notifications.title IS 'Short title for the notification';
COMMENT ON COLUMN public.notifications.message IS 'Detailed notification message';
COMMENT ON COLUMN public.notifications.metadata IS 'JSON metadata (booking_id, withdrawal_id, amount, etc.)';
COMMENT ON COLUMN public.notifications.read IS 'Whether the notification has been read';
COMMENT ON COLUMN public.notifications.read_at IS 'Timestamp when the notification was read';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
