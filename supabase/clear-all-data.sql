-- =============================================
-- CLEAR ALL DATA FROM SUPABASE (FULL RESET)
-- =============================================
-- DANGER: THIS FILE DELETES ALL APP DATA.
-- It is intentionally guarded. By default this script will fail.
-- To run intentionally, execute this first in the same SQL session:
--   SELECT set_config('akm.allow_destructive', 'YES', false);
-- Then run this script.
-- Run this in Supabase SQL Editor to delete all application data
-- Dashboard: https://supabase.com/dashboard/project/bnvbqlmdrpeybvpnhfoo/sql/new
-- =============================================

DO $$
BEGIN
  IF current_setting('akm.allow_destructive', true) IS DISTINCT FROM 'YES' THEN
    RAISE EXCEPTION 'Blocked destructive script. Set akm.allow_destructive=YES in this session to continue.';
  END IF;
END $$;

BEGIN;

-- Clear dependent tables first
DELETE FROM audit_log;
DELETE FROM rate_limits;
DELETE FROM whatsapp_templates;
DELETE FROM jobs;
DELETE FROM users;

-- Keep one application user for APP_LOGIN_USER_ID (change if you use a different ID)
INSERT INTO users (id, phone, name)
VALUES ('00000000-0000-0000-0000-000000000001', '9000000000', 'App User');

COMMIT;

-- Verify tables are empty
SELECT 'Users count' as info, COUNT(*) as count FROM users
UNION ALL
SELECT 'Jobs count' as info, COUNT(*) as count FROM jobs
UNION ALL
SELECT 'WhatsApp templates count' as info, COUNT(*) as count FROM whatsapp_templates
UNION ALL
SELECT 'Audit count' as info, COUNT(*) as count FROM audit_log
UNION ALL
SELECT 'Rate limits count' as info, COUNT(*) as count FROM rate_limits;
