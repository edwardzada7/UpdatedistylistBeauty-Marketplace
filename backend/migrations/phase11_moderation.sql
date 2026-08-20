-- Phase 11 - User and provider moderation. Additive and safe to re-run.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (moderation_status IN ('active', 'suspended', 'deactivated')),
    ADD COLUMN IF NOT EXISTS moderation_reason TEXT,
    ADD COLUMN IF NOT EXISTS moderation_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS moderation_by TEXT;

CREATE INDEX IF NOT EXISTS idx_users_moderation_status ON users(moderation_status);

CREATE TABLE IF NOT EXISTS admin_logs (
    id BIGSERIAL PRIMARY KEY,
    admin_identifier TEXT NOT NULL,
    affected_account_type VARCHAR(20) NOT NULL,
    affected_account_auth_id TEXT NOT NULL,
    action TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_account ON admin_logs(affected_account_auth_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at DESC);