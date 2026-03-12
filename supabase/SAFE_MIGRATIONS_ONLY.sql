-- =============================================
-- SAFE MIGRATIONS ONLY (NON-DESTRUCTIVE)
-- =============================================
-- Use this file for existing projects.
-- It does NOT delete/truncate jobs/users.
-- Run in a NEW empty Supabase SQL tab.
-- =============================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------
-- JOBS: add missing optional columns safely
-- ---------------------------------------------
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS additional_work_type VARCHAR(255);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS additional_work_custom TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS additional_work_rate DECIMAL(10,2);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS estimated_due_date DATE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'NORMAL';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_jobs_is_deleted ON jobs(is_deleted);
CREATE INDEX IF NOT EXISTS idx_jobs_deleted_at ON jobs(deleted_at DESC);

-- ---------------------------------------------
-- WHATSAPP TEMPLATES: create/upgrade safely
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(20),
  kind VARCHAR(50),
  content JSONB,
  template_type VARCHAR(20),
  status_key VARCHAR(30),
  template_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS category VARCHAR(20);
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS kind VARCHAR(50);
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS content JSONB;
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS template_type VARCHAR(20);
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS status_key VARCHAR(30);
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS template_text TEXT;
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE whatsapp_templates
SET
  category      = COALESCE(category, 'EXPOSING'),
  template_type = COALESCE(template_type, kind, 'JOB_STATUS'),
  status_key    = COALESCE(status_key, 'PENDING'),
  template_text = COALESCE(template_text, content::text, '')
WHERE
  category IS NULL
  OR template_type IS NULL
  OR status_key IS NULL
  OR template_text IS NULL;

ALTER TABLE whatsapp_templates DROP CONSTRAINT IF EXISTS uniq_whatsapp_templates_user_kind_category;
ALTER TABLE whatsapp_templates DROP CONSTRAINT IF EXISTS uniq_whatsapp_templates_user_category_type_status;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, category, template_type, status_key
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM whatsapp_templates
)
DELETE FROM whatsapp_templates
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

DROP INDEX IF EXISTS idx_whatsapp_templates_unique_v2;
CREATE UNIQUE INDEX idx_whatsapp_templates_unique_v2
ON whatsapp_templates (user_id, category, template_type, status_key);

CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_user_id ON whatsapp_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_category ON whatsapp_templates(category);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_type_status ON whatsapp_templates(template_type, status_key);

ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all whatsapp templates operations" ON whatsapp_templates;
CREATE POLICY "Allow all whatsapp templates operations" ON whatsapp_templates
  FOR ALL
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON whatsapp_templates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON whatsapp_templates TO authenticated;
GRANT ALL ON whatsapp_templates TO service_role;

-- ---------------------------------------------
-- updated_at trigger helper and bindings
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_whatsapp_templates_updated_at ON whatsapp_templates;
CREATE TRIGGER update_whatsapp_templates_updated_at
  BEFORE UPDATE ON whatsapp_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- Verification
SELECT COUNT(*) AS users_count FROM users;
SELECT COUNT(*) AS jobs_count FROM jobs;
SELECT COUNT(*) AS templates_count FROM whatsapp_templates;
