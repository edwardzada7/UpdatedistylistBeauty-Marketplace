-- Add phone_verified column to users table
-- Run this in Supabase SQL Editor

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

-- Create index for phone_verified for faster queries
CREATE INDEX IF NOT EXISTS idx_users_phone_verified ON users(phone_verified);

-- Update existing users to have phone_verified = false by default
UPDATE users SET phone_verified = FALSE WHERE phone_verified IS NULL;

-- Add comment to column
COMMENT ON COLUMN users.phone_verified IS 'Indicates if user has verified their phone number via OTP';
