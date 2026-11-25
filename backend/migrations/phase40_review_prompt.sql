-- Review popup shows once per booking
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS review_prompt_dismissed_at TIMESTAMPTZ NULL;
