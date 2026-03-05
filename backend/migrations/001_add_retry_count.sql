-- ============================================
-- Migration 001: Add retry_count to jobs
-- ============================================

ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Ensure old jobs get value
UPDATE jobs
SET retry_count = 0
WHERE retry_count IS NULL;

-- Optional index for retry logic
CREATE INDEX IF NOT EXISTS idx_jobs_retry_count
ON jobs(retry_count);

-- Verification
SELECT column_name
FROM information_schema.columns
WHERE table_name='jobs'
AND column_name='retry_count';
