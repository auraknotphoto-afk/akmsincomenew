BEGIN;

UPDATE jobs SET category = 'ADDON' WHERE category = 'OTHER';
UPDATE whatsapp_templates SET category = 'ADDON' WHERE category = 'OTHER';

ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_category_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_category_check CHECK (category IN ('EDITING', 'EXPOSING', 'ADDON'));

ALTER TABLE whatsapp_templates DROP CONSTRAINT IF EXISTS whatsapp_templates_category_check;
ALTER TABLE whatsapp_templates ADD CONSTRAINT whatsapp_templates_category_check CHECK (category IN ('EDITING', 'EXPOSING', 'ADDON'));

COMMIT;
