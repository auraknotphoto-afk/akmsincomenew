-- =============================================
-- FIX RLS POLICIES FOR DEMO MODE
-- =============================================
-- Run this in Supabase SQL Editor to fix access issues
-- Dashboard: https://supabase.com/dashboard/project/bnvbqlmdrpeybvpnhfoo/sql/new
-- =============================================

-- Drop old restrictive policies on users
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Allow user registration" ON users;
DROP POLICY IF EXISTS "Service role can manage users" ON users;

-- Drop old restrictive policies on jobs
DROP POLICY IF EXISTS "Users can view own jobs" ON jobs;
DROP POLICY IF EXISTS "Users can create own jobs" ON jobs;
DROP POLICY IF EXISTS "Users can update own jobs" ON jobs;
DROP POLICY IF EXISTS "Users can delete own jobs" ON jobs;
DROP POLICY IF EXISTS "Service role can manage jobs" ON jobs;

-- Create permissive policy for users table (allows all operations)
DROP POLICY IF EXISTS "Allow all users operations" ON users;
CREATE POLICY "Allow all users operations" ON users
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create permissive policy for jobs table (allows all operations)
DROP POLICY IF EXISTS "Allow all jobs operations" ON jobs;
CREATE POLICY "Allow all jobs operations" ON jobs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant permissions to anonymous users (anon role)
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON jobs TO anon;

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON jobs TO authenticated;

-- Verify: Check current policies
SELECT tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'jobs');
