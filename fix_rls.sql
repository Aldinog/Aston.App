-- 1. Enable RLS on all relevant tables
ALTER TABLE stock_candles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_fundamentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitor_symbols ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_state ENABLE ROW LEVEL SECURITY;

-- 2. Add Policies (Allow Service Role and Authenticated Users)
-- Since this is an internal bot/app, we allow full access to authenticated roles
-- and the service_role (which bypasses RLS by default, but good to have explicit policies).

-- stock_candles
CREATE POLICY "Allow all for authenticated" ON stock_candles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_role" ON stock_candles FOR ALL TO service_role USING (true) WITH CHECK (true);

-- stock_fundamentals
CREATE POLICY "Allow all for authenticated" ON stock_fundamentals FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_role" ON stock_fundamentals FOR ALL TO service_role USING (true) WITH CHECK (true);

-- app_settings
CREATE POLICY "Allow all for authenticated" ON app_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_role" ON app_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- users
CREATE POLICY "Allow all for authenticated" ON users FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_role" ON users FOR ALL TO service_role USING (true) WITH CHECK (true);

-- sessions
CREATE POLICY "Allow all for authenticated" ON sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_role" ON sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- monitor_symbols
CREATE POLICY "Allow all for authenticated" ON monitor_symbols FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_role" ON monitor_symbols FOR ALL TO service_role USING (true) WITH CHECK (true);

-- scan_state
CREATE POLICY "Allow all for authenticated" ON scan_state FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_role" ON scan_state FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. (Optional) For Web Public Access if needed
-- If you want anyone to see the chart without login (not recommended if gating by PRO)
-- CREATE POLICY "Allow public read" ON stock_candles FOR SELECT TO anon USING (true);
