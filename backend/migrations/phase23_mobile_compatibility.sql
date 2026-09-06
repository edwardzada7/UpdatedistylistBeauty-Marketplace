-- Additive storage required by the mobile API compatibility pass.
-- Apply only if these tables are not already provisioned.

CREATE TABLE IF NOT EXISTS public.provider_post_comments (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL,
    author_auth_id UUID NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_post_comments_post_created
    ON public.provider_post_comments(post_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_provider_post_comments_author
    ON public.provider_post_comments(author_auth_id);

CREATE TABLE IF NOT EXISTS public.notification_tokens (
    id BIGSERIAL PRIMARY KEY,
    auth_id UUID NOT NULL,
    token TEXT NOT NULL,
    platform TEXT NULL,
    device_id TEXT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_tokens_auth_token
    ON public.notification_tokens(auth_id, token);

CREATE INDEX IF NOT EXISTS idx_notification_tokens_auth
    ON public.notification_tokens(auth_id);