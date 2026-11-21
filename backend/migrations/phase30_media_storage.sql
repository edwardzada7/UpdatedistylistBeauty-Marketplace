-- Phase 30: file storage for photos/videos + multi-photo posts. Safe to re-run.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('media', 'media', true, 52428800)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 52428800;

DROP POLICY IF EXISTS "media_public_read" ON storage.objects;
DROP POLICY IF EXISTS "media_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "media_owner_delete" ON storage.objects;
CREATE POLICY "media_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'media');
CREATE POLICY "media_owner_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "media_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);

ALTER TABLE provider_posts ADD COLUMN IF NOT EXISTS image_urls JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE provider_posts ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE provider_posts ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'photo';
ALTER TABLE provider_posts ADD COLUMN IF NOT EXISTS video_duration_seconds NUMERIC;
NOTIFY pgrst, 'reload schema';
