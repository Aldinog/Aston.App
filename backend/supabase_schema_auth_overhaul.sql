-- 1. Add 'pro_expires_at' for Lazy Expiration
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pro_expires_at TIMESTAMP WITH TIME ZONE;

-- 2. Make 'username' UNIQUE (if not already)
-- Note: You might need to handle duplicates first if any exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_username_key') THEN 
        ALTER TABLE public.users ADD CONSTRAINT users_username_key UNIQUE (username); 
    END IF; 
END $$;

-- 3. Function to handle new user registration (Trigger)
-- Automatically copies metadata from auth.users to public.users if helpful, 
-- but our Register page will do this manually via Upsert. 
-- However, we can set default Avatar here if null.

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, username, avatar_url)
  VALUES (
    NEW.id, 
    NEW.email, 
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'username',
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://tradersaham.com/assets/default-avatar.jpg') -- Fallback URL or keep null
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    username = COALESCE(public.users.username, EXCLUDED.username); -- Don't overwrite existing username
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger for Auth (Optional, good backup)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Function to downgrade expired users (can be run via Cron)
CREATE OR REPLACE FUNCTION handle_expired_subscriptions()
RETURNS void AS $$
BEGIN
  UPDATE public.users
  SET membership_status = 'free'
  WHERE membership_status = 'pro' 
  AND pro_expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
