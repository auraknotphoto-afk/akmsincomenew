-- =============================================
-- FIX LEGACY UNIQUE CONSTRAINT FOR WHATSAPP TEMPLATES
-- =============================================

BEGIN;

-- Ensure new columns exist
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS template_type VARCHAR(20);
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS status_key VARCHAR(30);
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS template_text TEXT;
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Legacy compatibility columns may exist in old schema
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS kind VARCHAR(20);
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS content TEXT;

-- Backfill from legacy fields
UPDATE whatsapp_templates
SET
  template_type = COALESCE(template_type, kind, 'JOB_STATUS'),
  status_key = COALESCE(status_key, 'PENDING'),
  template_text = COALESCE(template_text, content, '')
WHERE
  template_type IS NULL OR status_key IS NULL OR template_text IS NULL;

-- Remove old unique constraint that blocks multiple statuses
ALTER TABLE whatsapp_templates DROP CONSTRAINT IF EXISTS uniq_whatsapp_templates_user_kind_category;

-- De-duplicate rows for new unique key
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
WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);

-- Create new unique key (per user/category/type/status)
ALTER TABLE whatsapp_templates
  ADD CONSTRAINT uniq_whatsapp_templates_user_category_type_status
  UNIQUE (user_id, category, template_type, status_key);

COMMIT;
