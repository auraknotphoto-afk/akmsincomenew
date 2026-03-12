-- =============================================
-- FIX RLS POLICIES FOR PRODUCTION
-- =============================================
-- Run this in Supabase SQL Editor to lock access to authenticated owners only
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

DROP POLICY IF EXISTS "Allow all users operations" ON users;
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Allow all jobs operations" ON jobs;
CREATE POLICY "Users can view own jobs" ON jobs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own jobs" ON jobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own jobs" ON jobs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own jobs" ON jobs
  FOR DELETE
  USING (auth.uid() = user_id);

REVOKE ALL ON users FROM anon;
REVOKE ALL ON jobs FROM anon;

GRANT SELECT, UPDATE ON users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON jobs TO authenticated;

-- Verify: Check current policies
SELECT tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'jobs');
