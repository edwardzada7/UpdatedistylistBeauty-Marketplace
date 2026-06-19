-- ============================================================================
-- Phase 6 - Account Deletion (Soft Delete) + Phase 7 Settings Foundation
-- Fully additive. No existing rows touched. Bookings, wallet, withdrawals,
-- and audit history are preserved by design (we never DELETE FROM users).
-- ============================================================================

-- 1) Soft-delete columns on users
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_deleted   BOOLEAN     NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS deleted_at   TIMESTAMPTZ;

        CREATE INDEX IF NOT EXISTS idx_users_is_deleted ON users(is_deleted);

        -- 2) Phase 7 prep - admin-configurable app settings (key/value store).
        -- Withdrawal fee setting is created here but NOT applied to any calculation
        -- in Phase 6. Phase 7 will read these values when wiring fees.
        CREATE TABLE IF NOT EXISTS app_settings (
            key         VARCHAR(64) PRIMARY KEY,
                value       JSONB       NOT NULL,
                    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_by  UUID
                        );

                        -- Seed default withdrawal fee setting (disabled / zero) - storage only.
                        INSERT INTO app_settings (key, value)
                        VALUES (
                            'withdrawal_fee',
                                jsonb_build_object(
                                        'enabled',     false,
                                                'mode',        'flat',
                                                        'flat_amount', 0,
                                                                'percentage',  0,
                                                                        'currency',    'NGN',
                                                                                'notes',       'Created by phase6 migration. Not applied in Phase 6.'
                                                                                    )
                                                                                    )
                                                                                    ON CONFLICT (key) DO NOTHING;

                                                                                    -- ============================================================================
                                                                                    -- Rollback (if needed):
                                                                                    --   ALTER TABLE users DROP COLUMN IF EXISTS is_deleted;
                                                                                    --   ALTER TABLE users DROP COLUMN IF EXISTS deleted_at;
                                                                                    --   DROP TABLE IF EXISTS app_settings;
                                                                                    -- ============================================================================
                                                                                    