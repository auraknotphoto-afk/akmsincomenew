BEGIN;

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS event_details TEXT;

UPDATE jobs
SET event_details = COALESCE(
  event_details,
  CASE
    WHEN category = 'EDITING' THEN client_name
    WHEN category = 'EXPOSING' THEN studio_name
    ELSE NULL
  END
)
WHERE event_details IS NULL;

COMMIT;
