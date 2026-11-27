-- Phase 43: event categories + feed posts that link to their event. Safe to re-run.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS feed_announce BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS feed_post_id BIGINT;
ALTER TABLE public.provider_posts ADD COLUMN IF NOT EXISTS event_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_events_category ON public.events(category);
