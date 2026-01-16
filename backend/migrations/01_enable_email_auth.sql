-- Migration: Support Email/Google Login
-- Run this in Supabase SQL Editor

-- 1. Ensure telegram_user_id is nullable (to support users without Telegram)
ALTER TABLE public.users ALTER COLUMN telegram_user_id DROP NOT NULL;

-- 2. Add Email column if it doesn't exist (and make it unique)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;

-- 3. Add Supabase Auth UUID column to link with auth.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS supabase_user_id UUID UNIQUE;

-- 4. Make password_hash and username nullable (handled by Supabase or optional)
ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN username DROP NOT NULL;

-- 5. Create index for faster lookup
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON public.users(supabase_user_id);
