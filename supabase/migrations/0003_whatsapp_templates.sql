-- =============================================
-- WHATSAPP TEMPLATES (SAFE MIGRATION)
-- Run this file in Supabase SQL Editor
-- =============================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(20) NOT NULL CHECK (category IN ('EDITING', 'EXPOSING', 'OTHER')),
  template_type VARCHAR(20) NOT NULL CHECK (template_type IN ('JOB_STATUS', 'PAYMENT_STATUS')),
  status_key VARCHAR(30) NOT NULL,
  template_text TEXT NOT NULL,
  UNIQUE (user_id, category, template_type, status_key)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_user_id ON whatsapp_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_category ON whatsapp_templates(category);

ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own whatsapp templates" ON whatsapp_templates;
DROP POLICY IF EXISTS "Users can create own whatsapp templates" ON whatsapp_templates;
DROP POLICY IF EXISTS "Users can update own whatsapp templates" ON whatsapp_templates;
DROP POLICY IF EXISTS "Users can delete own whatsapp templates" ON whatsapp_templates;
DROP POLICY IF EXISTS "Allow all whatsapp templates operations" ON whatsapp_templates;

-- This app uses custom login (not Supabase Auth JWT), so allow table access by app role.
CREATE POLICY "Allow all whatsapp templates operations" ON whatsapp_templates
  FOR ALL
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON whatsapp_templates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON whatsapp_templates TO authenticated;
GRANT ALL ON whatsapp_templates TO service_role;

-- Keep updated_at fresh on updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_whatsapp_templates_updated_at ON whatsapp_templates;
CREATE TRIGGER update_whatsapp_templates_updated_at
  BEFORE UPDATE ON whatsapp_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;
