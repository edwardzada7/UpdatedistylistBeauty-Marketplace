-- Phase 27: device push tokens (Expo push). Safe to re-run.
CREATE TABLE IF NOT EXISTS push_tokens (
  id BIGSERIAL PRIMARY KEY,
  auth_id UUID NOT NULL,
  token TEXT NOT NULL UNIQUE,
  platform TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_tokens_auth ON push_tokens(auth_id);
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
NOTIFY pgrst, 'reload schema';
