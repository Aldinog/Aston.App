-- ENABLE RLS (Best Practice)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- DROP EXISTING POLICIES TO AVOID CONFLICTS
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.users;
DROP POLICY IF EXISTS "Users can update own profile." ON public.users;

-- CREATE NEW POLICIES

-- 1. Everyone (Auth & Anon) can READ profiles (Needed for Discussion Tab & Home)
CREATE POLICY "Public profiles are viewable by everyone." 
ON public.users FOR SELECT 
USING ( true );

-- 2. Users can INSERT their own profile (Trigger handles this mostly, but good for backup)
CREATE POLICY "Users can insert their own profile." 
ON public.users FOR INSERT 
WITH CHECK ( auth.uid() = id );

-- 3. Users can UPDATE their own profile
CREATE POLICY "Users can update own profile." 
ON public.users FOR UPDATE 
USING ( auth.uid() = id );

-- GRANT AGAIN JUST IN CASE
GRANT ALL ON TABLE public.users TO postgres;
GRANT ALL ON TABLE public.users TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users TO authenticated;
GRANT SELECT ON TABLE public.users TO anon;
