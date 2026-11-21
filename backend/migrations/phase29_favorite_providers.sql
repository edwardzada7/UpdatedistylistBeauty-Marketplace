-- Phase 29: saved (favourite) providers. Safe to re-run.
CREATE TABLE IF NOT EXISTS favorite_providers (
  user_auth_id UUID NOT NULL,
  provider_auth_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_auth_id, provider_auth_id)
);
CREATE INDEX IF NOT EXISTS idx_favorite_providers_provider ON favorite_providers(provider_auth_id);
ALTER TABLE favorite_providers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "favorites_select_own" ON favorite_providers;
DROP POLICY IF EXISTS "favorites_insert_own" ON favorite_providers;
DROP POLICY IF EXISTS "favorites_delete_own" ON favorite_providers;
CREATE POLICY "favorites_select_own" ON favorite_providers FOR SELECT TO authenticated USING (user_auth_id = auth.uid());
CREATE POLICY "favorites_insert_own" ON favorite_providers FOR INSERT TO authenticated WITH CHECK (user_auth_id = auth.uid());
CREATE POLICY "favorites_delete_own" ON favorite_providers FOR DELETE TO authenticated USING (user_auth_id = auth.uid());
NOTIFY pgrst, 'reload schema';
