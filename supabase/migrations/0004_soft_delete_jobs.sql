-- =============================================
-- SOFT DELETE SUPPORT FOR JOBS
-- =============================================

BEGIN;

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_jobs_is_deleted ON jobs(is_deleted);
CREATE INDEX IF NOT EXISTS idx_jobs_deleted_at ON jobs(deleted_at DESC);

COMMIT;
