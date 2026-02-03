-- =============================================
-- AURA KNOT PHOTOGRAPHY - SUPABASE SCHEMA
-- =============================================
-- Run this SQL in your Supabase SQL Editor
-- Dashboard: https://supabase.com/dashboard/project/bnvbqlmdrpeybvpnhfoo/sql/new
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- DROP EXISTING TABLES (if recreating)
-- =============================================
-- Uncomment these lines if you need to recreate tables
-- DROP TABLE IF EXISTS jobs CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

-- =============================================
-- USERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  phone VARCHAR(15) UNIQUE NOT NULL,
  name VARCHAR(255),
  email VARCHAR(255),
  otp_code VARCHAR(6),
  otp_expires_at TIMESTAMPTZ
);

-- Insert a demo user for testing
INSERT INTO users (id, phone, name) 
VALUES ('00000000-0000-0000-0000-000000000001', '9876543210', 'Demo User')
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- JOBS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Job Category: EDITING, EXPOSING, or OTHER
  category VARCHAR(20) NOT NULL CHECK (category IN ('EDITING', 'EXPOSING', 'OTHER')),
  
  -- Common Fields
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(15),
  start_date DATE NOT NULL,
  end_date DATE,
  total_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(12, 2) NOT NULL DEFAULT 0,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PARTIAL', 'COMPLETED')),
  payment_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED')),
  notes TEXT,
  
  -- Editing Specific Fields
  event_type VARCHAR(100),
  number_of_cameras INTEGER,
  camera_type VARCHAR(100),
  duration_hours DECIMAL(6, 2),
  rate_per_hour DECIMAL(10, 2),
  client_name VARCHAR(255),
  
  -- Exposing Specific Fields
  studio_name VARCHAR(255),
  event_location VARCHAR(255),
  session_type VARCHAR(50),
  exposure_type VARCHAR(100),
  expose_type VARCHAR(100),
  
  -- Other Income Fields
  type_of_work VARCHAR(255)
);

-- =============================================
-- INDEXES FOR BETTER PERFORMANCE
-- =============================================
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_payment_status ON jobs(payment_status);
CREATE INDEX IF NOT EXISTS idx_jobs_start_date ON jobs(start_date DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- =============================================
-- FUNCTION: Auto-update updated_at timestamp
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for jobs table
DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- ROW LEVEL SECURITY (RLS) - ENABLED
-- =============================================
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES FOR USERS TABLE
-- =============================================

-- Users can view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow insert for new user registration
DROP POLICY IF EXISTS "Allow user registration" ON users;
CREATE POLICY "Allow user registration" ON users
  FOR INSERT
  WITH CHECK (true);

-- =============================================
-- RLS POLICIES FOR JOBS TABLE
-- =============================================

-- Users can view their own jobs
DROP POLICY IF EXISTS "Users can view own jobs" ON jobs;
CREATE POLICY "Users can view own jobs" ON jobs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create jobs for themselves
DROP POLICY IF EXISTS "Users can create own jobs" ON jobs;
CREATE POLICY "Users can create own jobs" ON jobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own jobs
DROP POLICY IF EXISTS "Users can update own jobs" ON jobs;
CREATE POLICY "Users can update own jobs" ON jobs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own jobs
DROP POLICY IF EXISTS "Users can delete own jobs" ON jobs;
CREATE POLICY "Users can delete own jobs" ON jobs
  FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- SERVICE ROLE POLICIES (for admin operations)
-- =============================================
-- Service role bypasses RLS by default, but we add explicit policies
-- for operations that need elevated access

-- Allow service role to manage all users (for OTP verification)
DROP POLICY IF EXISTS "Service role can manage users" ON users;
CREATE POLICY "Service role can manage users" ON users
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Allow service role to manage all jobs (for admin reports)
DROP POLICY IF EXISTS "Service role can manage jobs" ON jobs;
CREATE POLICY "Service role can manage jobs" ON jobs
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- =============================================
-- GRANT PERMISSIONS (Production - Authenticated Only)
-- =============================================
-- Revoke all from anon (no anonymous access)
REVOKE ALL ON users FROM anon;
REVOKE ALL ON jobs FROM anon;

-- Grant full access to authenticated users (RLS will filter)
GRANT SELECT, INSERT, UPDATE ON users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON jobs TO authenticated;

-- Grant to service_role for backend operations
GRANT ALL ON users TO service_role;
GRANT ALL ON jobs TO service_role;

-- =============================================
-- SECURITY FUNCTIONS
-- =============================================

-- Function to check if user owns a job
CREATE OR REPLACE FUNCTION is_job_owner(job_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM jobs 
    WHERE id = job_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user's ID safely
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
BEGIN
  RETURN auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- AUDIT LOGGING (Optional but recommended)
-- =============================================
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  table_name VARCHAR(50) NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET
);

-- Index for audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON audit_log(table_name);

-- Enable RLS on audit log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Users can only view their own audit logs
DROP POLICY IF EXISTS "Users can view own audit logs" ON audit_log;
CREATE POLICY "Users can view own audit logs" ON audit_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert audit logs
DROP POLICY IF EXISTS "Service role can insert audit logs" ON audit_log;
CREATE POLICY "Service role can insert audit logs" ON audit_log
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

GRANT SELECT ON audit_log TO authenticated;
GRANT ALL ON audit_log TO service_role;

-- =============================================
-- AUDIT TRIGGER FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (user_id, action, table_name, record_id, new_data)
    VALUES (auth.uid(), 'INSERT', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (auth.uid(), 'UPDATE', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (user_id, action, table_name, record_id, old_data)
    VALUES (auth.uid(), 'DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit triggers for jobs table
DROP TRIGGER IF EXISTS audit_jobs_trigger ON jobs;
CREATE TRIGGER audit_jobs_trigger
  AFTER INSERT OR UPDATE OR DELETE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- =============================================
-- RATE LIMITING TABLE (Prevent abuse)
-- =============================================
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identifier VARCHAR(255) NOT NULL, -- phone number or IP
  action_type VARCHAR(50) NOT NULL, -- 'otp_request', 'login_attempt'
  attempt_count INTEGER DEFAULT 1,
  first_attempt_at TIMESTAMPTZ DEFAULT NOW(),
  last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
  blocked_until TIMESTAMPTZ,
  UNIQUE(identifier, action_type)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limits_blocked ON rate_limits(blocked_until);

-- Grant service role access (for backend rate limiting)
GRANT ALL ON rate_limits TO service_role;

-- =============================================
-- HELPER FUNCTION: Check Rate Limit
-- =============================================
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier VARCHAR,
  p_action_type VARCHAR,
  p_max_attempts INTEGER DEFAULT 5,
  p_window_minutes INTEGER DEFAULT 15,
  p_block_minutes INTEGER DEFAULT 60
)
RETURNS BOOLEAN AS $$
DECLARE
  v_record rate_limits%ROWTYPE;
  v_window_start TIMESTAMPTZ;
BEGIN
  v_window_start := NOW() - (p_window_minutes || ' minutes')::INTERVAL;
  
  SELECT * INTO v_record 
  FROM rate_limits 
  WHERE identifier = p_identifier AND action_type = p_action_type;
  
  -- Check if blocked
  IF v_record.blocked_until IS NOT NULL AND v_record.blocked_until > NOW() THEN
    RETURN FALSE;
  END IF;
  
  -- Reset if outside window
  IF v_record.first_attempt_at < v_window_start THEN
    UPDATE rate_limits 
    SET attempt_count = 1, first_attempt_at = NOW(), last_attempt_at = NOW(), blocked_until = NULL
    WHERE identifier = p_identifier AND action_type = p_action_type;
    RETURN TRUE;
  END IF;
  
  -- Check attempt count
  IF v_record.attempt_count >= p_max_attempts THEN
    UPDATE rate_limits 
    SET blocked_until = NOW() + (p_block_minutes || ' minutes')::INTERVAL
    WHERE identifier = p_identifier AND action_type = p_action_type;
    RETURN FALSE;
  END IF;
  
  -- Increment attempt
  IF v_record.id IS NOT NULL THEN
    UPDATE rate_limits 
    SET attempt_count = attempt_count + 1, last_attempt_at = NOW()
    WHERE identifier = p_identifier AND action_type = p_action_type;
  ELSE
    INSERT INTO rate_limits (identifier, action_type) VALUES (p_identifier, p_action_type);
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- VERIFICATION QUERIES (run after setup)
-- =============================================
-- SELECT * FROM users;
-- SELECT * FROM jobs;
-- SELECT COUNT(*) as total, category FROM jobs GROUP BY category;
-- SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 10;
-- SELECT * FROM rate_limits;
