-- ============================================================================
-- Phase 7 - Withdrawal Fees + Admin Financial Settings
-- Fully additive. The new gross/fee/net columns are NULLABLE so existing
-- pending/approved/rejected rows continue to work unchanged.
-- ============================================================================

-- 1) Add fee breakdown columns to withdrawal_requests.
--    'amount' (existing) continues to mean the GROSS amount (what is deducted
--    from the provider's wallet on approval). 'net_amount' = what the
--    provider receives after platform fee.
ALTER TABLE withdrawal_requests
    ADD COLUMN IF NOT EXISTS gross_amount NUMERIC(14, 2),
    ADD COLUMN IF NOT EXISTS fee_amount   NUMERIC(14, 2),
    ADD COLUMN IF NOT EXISTS net_amount   NUMERIC(14, 2);

-- 2) Backfill the new columns for any pre-Phase-7 rows so reads stay sane.
--    For historical rows we assume zero fee (so gross == net == amount).
UPDATE withdrawal_requests
SET gross_amount = COALESCE(gross_amount, amount),
    fee_amount   = COALESCE(fee_amount, 0),
    net_amount   = COALESCE(net_amount, amount)
WHERE amount IS NOT NULL
  AND (gross_amount IS NULL OR fee_amount IS NULL OR net_amount IS NULL);

-- 3) Ensure app_settings exists (Phase 6 already creates it; this is a safety
--    net for environments where only Phase 7 is applied).
CREATE TABLE IF NOT EXISTS app_settings (
    key         VARCHAR(64) PRIMARY KEY,
    value       JSONB       NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by  UUID
);

-- 4) Seed/refresh the withdrawal_fee setting so the new fee fields are
--    explicit. fee_percentage = 0 means "no fee" until admin changes it.
INSERT INTO app_settings (key, value)
VALUES (
    'withdrawal_fee',
    jsonb_build_object(
        'enabled',         true,
        'fee_percentage',  0,
        'min_withdrawal',  0,
        'max_withdrawal',  null,
        'currency',        'NGN',
        'notes',           'Phase 7 - fee/percentage applies to gross withdrawal amount.'
    )
)
ON CONFLICT (key) DO UPDATE
SET value = jsonb_build_object(
        'enabled',         true,
        'fee_percentage',  COALESCE((app_settings.value->>'fee_percentage')::numeric, 0),
        'min_withdrawal',  COALESCE((app_settings.value->>'min_withdrawal')::numeric, 0),
        'max_withdrawal',  CASE
                              WHEN app_settings.value ? 'max_withdrawal'
                                   AND app_settings.value->>'max_withdrawal' IS NOT NULL
                                   AND app_settings.value->>'max_withdrawal' <> 'null'
                              THEN (app_settings.value->>'max_withdrawal')::numeric
                              ELSE NULL
                           END,
        'enabled',         true,
        'currency',        'NGN',
        'notes',           COALESCE(app_settings.value->>'notes', 'Phase 7 - fee/percentage applies to gross withdrawal amount.')
    ),
    updated_at = NOW();

-- ============================================================================
-- Rollback (if needed):
--   ALTER TABLE withdrawal_requests
--     DROP COLUMN IF EXISTS gross_amount,
--     DROP COLUMN IF EXISTS fee_amount,
--     DROP COLUMN IF EXISTS net_amount;
--   DELETE FROM app_settings WHERE key = 'withdrawal_fee';
-- ============================================================================
