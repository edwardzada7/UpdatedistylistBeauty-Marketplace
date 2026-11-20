-- Phase 26: show the KYC "verified" tick on provider cards everywhere.
-- Provider cards, search and feed read stylists.is_verified, but approving a KYC submission
-- only updated kyc_submissions, so customers never saw the tick. This keeps the two in sync
-- (for every approval path) and fixes providers that are already verified.
-- Safe to run more than once.

ALTER TABLE stylists ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION sync_stylist_verified_from_kyc() RETURNS trigger AS $$
BEGIN
    UPDATE stylists
       SET is_verified = (NEW.status = 'verified')
     WHERE auth_id = NEW.user_auth_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_stylist_verified ON kyc_submissions;
CREATE TRIGGER trg_sync_stylist_verified
AFTER INSERT OR UPDATE OF status ON kyc_submissions
FOR EACH ROW EXECUTE FUNCTION sync_stylist_verified_from_kyc();

-- Backfill: providers whose KYC is already verified.
UPDATE stylists s
   SET is_verified = TRUE
  FROM kyc_submissions k
 WHERE k.user_auth_id = s.auth_id
   AND k.status = 'verified'
   AND s.is_verified IS DISTINCT FROM TRUE;

NOTIFY pgrst, 'reload schema';
