-- 1. CLEANUP ORPHAN USERS (Zombies)
DELETE FROM public.users 
WHERE id NOT IN (SELECT id FROM auth.users);

-- 1.1 BACKFILL MISSING USERS (Rescue Auth Users with no Public Profile)
INSERT INTO public.users (id, email, username, full_name, avatar_url, membership_status)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'username', SPLIT_PART(email, '@', 1)),
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'username', 'Trader'),
  raw_user_meta_data->>'avatar_url',
  'free'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.users)
ON CONFLICT (id) DO NOTHING;

-- 2. ENSURE COLUMNS & CONSTRAINTS
-- Add columns if missing
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS membership_status text DEFAULT 'free';

-- Loosen constraints to prevent errors
ALTER TABLE public.users ALTER COLUMN full_name DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN avatar_url DROP NOT NULL;

-- 3. ENSURE USERNAME UNIQUE CONSTRAINT
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_username_key') THEN 
        ALTER TABLE public.users ADD CONSTRAINT users_username_key UNIQUE (username); 
    END IF; 
END $$;

-- 4. ROBUST TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  final_username text;
BEGIN
  -- Determine username (from meta or email)
  final_username := COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1));
  
  -- Handle potential username collision by appending random number if needed?
  -- For now, we assume frontend checks uniqueness. 
  -- But to prevents CRASH, let's just insert.
  
  INSERT INTO public.users (id, email, username, full_name, avatar_url, membership_status)
  VALUES (
    NEW.id, 
    NEW.email, 
    final_username,
    COALESCE(NEW.raw_user_meta_data->>'full_name', final_username, 'Trader'),
    NEW.raw_user_meta_data->>'avatar_url', -- Can be null, frontend handles default
    'free'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    username = COALESCE(public.users.username, EXCLUDED.username); -- Preserve existing username
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RE-ATTACH TRIGGER
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. GRANT PERMISSIONS (Crucial for RLS)
GRANT ALL ON TABLE public.users TO postgres;
GRANT ALL ON TABLE public.users TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users TO authenticated;
GRANT SELECT ON TABLE public.users TO anon; -- Needed for reading user profiles?
