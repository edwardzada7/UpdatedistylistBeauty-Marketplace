-- ============================================================================
-- Phase 4 - Social Feed Lite
-- ============================================================================
-- Purpose: Allow providers to post beauty work photos. Customers can browse
--   the feed and like posts.
--
-- IMPORTANT: This migration is FULLY ADDITIVE.
--   - No existing tables are dropped, renamed, or restructured.
--   - All new tables use CREATE TABLE IF NOT EXISTS.
--   - All indexes use CREATE INDEX IF NOT EXISTS.
--
-- Run this SQL once in the Supabase SQL Editor.
-- ============================================================================

-- 1) provider_posts: a post (single image + caption) made by a provider/business
CREATE TABLE IF NOT EXISTS provider_posts (
    id              BIGSERIAL PRIMARY KEY,
    provider_id     BIGINT NOT NULL,                  -- soft ref to users.id (provider's integer id)
    provider_auth_id UUID,                            -- denormalized for fast lookup
    caption         TEXT,
    image_url       TEXT NOT NULL,
    likes_count     INTEGER NOT NULL DEFAULT 0,
    comments_count  INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_posts_provider_id ON provider_posts(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_posts_provider_auth_id ON provider_posts(provider_auth_id);
CREATE INDEX IF NOT EXISTS idx_provider_posts_created_at ON provider_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_provider_posts_active ON provider_posts(is_active);

-- 2) provider_post_likes: track which users liked which posts (unique per user/post)
CREATE TABLE IF NOT EXISTS provider_post_likes (
    id            BIGSERIAL PRIMARY KEY,
    post_id       BIGINT NOT NULL,                    -- soft ref to provider_posts.id
    user_auth_id  UUID NOT NULL,                      -- liker's auth_id
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_post_like
    ON provider_post_likes(post_id, user_auth_id);

CREATE INDEX IF NOT EXISTS idx_provider_post_likes_post_id
    ON provider_post_likes(post_id);

CREATE INDEX IF NOT EXISTS idx_provider_post_likes_user
    ON provider_post_likes(user_auth_id);

-- ============================================================================
-- Done. Roll back with:
--   DROP TABLE provider_post_likes;
--   DROP TABLE provider_posts;
-- ============================================================================
