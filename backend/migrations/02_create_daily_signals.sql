-- Migration: Create Daily Signals Table
-- Run this in Supabase SQL Editor

-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.daily_signals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    symbol TEXT NOT NULL,
    company_name TEXT,
    action TEXT CHECK (action IN ('BUY', 'SELL', 'WAIT')),
    entry_price TEXT,
    target_price TEXT,
    stop_loss TEXT,
    ai_confidence TEXT,
    analysis_summary TEXT,
    
    -- Status Tracking
    status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'HIT_TP', 'HIT_SL', 'EXPIRED', 'WAIT')),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS (Security) but allow public read for now (Dev Mode)
ALTER TABLE public.daily_signals ENABLE ROW LEVEL SECURITY;

create policy "Public Read Access"
on public.daily_signals for select
using ( true );

-- 3. Create Index for fast sorting by date
CREATE INDEX IF NOT EXISTS idx_daily_signals_created_at ON public.daily_signals(created_at DESC);
