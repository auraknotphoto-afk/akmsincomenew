-- =============================================
-- CLEAR ALL DATA FROM SUPABASE
-- =============================================
-- Run this in Supabase SQL Editor to delete all data
-- Dashboard: https://supabase.com/dashboard/project/bnvbqlmdrpeybvpnhfoo/sql/new
-- =============================================

-- Delete all jobs
DELETE FROM jobs;

-- Delete all users except demo user (optional - uncomment if needed)
-- DELETE FROM users WHERE id != '00000000-0000-0000-0000-000000000001';

-- Re-insert demo user (in case it was deleted)
INSERT INTO users (id, phone, name) 
VALUES ('00000000-0000-0000-0000-000000000001', '9876543210', 'Demo User')
ON CONFLICT (id) DO NOTHING;

-- Verify tables are empty
SELECT 'Jobs count:' as info, COUNT(*) as count FROM jobs
UNION ALL
SELECT 'Users count:' as info, COUNT(*) as count FROM users;
