-- =============================================
-- ADD MISSING COLUMNS TO JOBS TABLE
-- =============================================
-- Run this in Supabase SQL Editor
-- Dashboard: https://supabase.com/dashboard/project/bnvbqlmdrpeybvpnhfoo/sql/new
-- =============================================

-- Add missing columns (safe - won't error if they exist)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS expose_type VARCHAR(100);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS rate_per_hour DECIMAL(10, 2);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS client_name VARCHAR(255);

-- Verify the columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'jobs' 
ORDER BY ordinal_position;
