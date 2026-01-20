-- FORCE SYNC USERNAMES
-- Update public.users for anyone who has a NULL username
UPDATE public.users p
SET 
  username = COALESCE(a.raw_user_meta_data->>'username', SPLIT_PART(a.email, '@', 1)),
  full_name = COALESCE(a.raw_user_meta_data->>'full_name', a.raw_user_meta_data->>'username', 'Trader'),
  membership_status = 'free' -- Ensure they have valid status too
FROM auth.users a
WHERE p.id = a.id
  AND (p.username IS NULL OR p.username = '');

-- Verify the specific user 'satri' (optional check)
-- This tries to find the user with email/username matching 'satri' and ensure they are updated.
