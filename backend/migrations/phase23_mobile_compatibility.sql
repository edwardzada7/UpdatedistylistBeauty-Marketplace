-- Additive storage required by the mobile API compatibility pass.
-- Apply only if these tables are not already provisioned.

CREATE TABLE IF NOT EXISTS public.provider_post_comments (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL,
    author_auth_id UUID NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'provider_post_comments_post_id_fkey'
          AND conrelid = 'public.provider_post_comments'::regclass
    ) THEN
        ALTER TABLE public.provider_post_comments
            ADD CONSTRAINT provider_post_comments_post_id_fkey
            FOREIGN KEY (post_id)
            REFERENCES public.provider_posts(id)
            ON DELETE CASCADE;
    END IF;
END $$;

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

ALTER TABLE public.provider_post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.provider_post_comments FROM anon, authenticated;
REVOKE ALL ON TABLE public.notification_tokens FROM anon, authenticated;

GRANT ALL ON TABLE public.provider_post_comments TO service_role;
GRANT ALL ON TABLE public.notification_tokens TO service_role;

GRANT USAGE, SELECT ON SEQUENCE public.provider_post_comments_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.notification_tokens_id_seq TO service_role;