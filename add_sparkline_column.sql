-- Add sparkline column to stock_price_cache table
ALTER TABLE stock_price_cache 
ADD COLUMN IF NOT EXISTS sparkline JSONB DEFAULT '[]'::jsonb;
