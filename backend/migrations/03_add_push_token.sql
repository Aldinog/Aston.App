-- Migration: Add Push Token support
-- Run this in Supabase SQL Editor

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Create index for faster lookup when broadcasting
CREATE INDEX IF NOT EXISTS idx_users_push_token ON public.users(push_token);
