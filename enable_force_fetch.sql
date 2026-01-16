-- Enable Force Weekend Fetch for 'Upgrade Day'
-- This ensures that when the app reloads, it fetches data from Yahoo (populating the cache)
-- instead of relying on the currently empty cache.

INSERT INTO app_settings (key, value)
VALUES ('force_weekend_fetch', 'true')
ON CONFLICT (key) DO UPDATE SET value = 'true';
