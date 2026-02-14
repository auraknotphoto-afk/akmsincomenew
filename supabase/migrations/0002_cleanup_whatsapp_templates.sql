-- Migration: Remove duplicate global whatsapp_templates rows
-- Keeps only the most recent row per (kind, category) where user_id IS NULL (global templates)
-- Run this in Supabase SQL editor or via psql.

BEGIN;

-- Preview duplicates (uncomment to inspect before running):
-- SELECT * FROM (
--   SELECT id, kind, category, created_at, updated_at,
--     ROW_NUMBER() OVER (PARTITION BY kind, category ORDER BY COALESCE(updated_at, created_at) DESC, id) rn
--   FROM whatsapp_templates
--   WHERE user_id IS NULL
-- ) t WHERE rn > 1;

DELETE FROM whatsapp_templates
USING (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY kind, category ORDER BY COALESCE(updated_at, created_at) DESC, id) rn
    FROM whatsapp_templates
    WHERE user_id IS NULL
  ) x
  WHERE x.rn > 1
) dup
WHERE whatsapp_templates.id = dup.id;

COMMIT;

-- Optional: VACUUM ANALYZE whatsapp_templates; -- run separately if you have DB access
