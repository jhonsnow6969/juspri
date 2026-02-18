-- ============================================
-- Phase 2 + 3 Migration: Admin Dashboard & Paper Tracking
-- Run this on your existing database
-- psql -U printuser -d printkiosk -f migration-phase2-3.sql
-- ============================================

-- ==================== PHASE 2: ROLES ====================

-- Add role column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';

-- Add constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS valid_user_role;
ALTER TABLE users ADD CONSTRAINT valid_user_role
CHECK (role IN ('user', 'admin', 'superadmin'));

-- Create index for fast role lookups
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ==================== PHASE 3: PAPER TRACKING ====================
-- (current_paper_count already added in Phase 1, but verify it exists)

-- Ensure column exists with default
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kiosks' AND column_name = 'current_paper_count'
  ) THEN
    ALTER TABLE kiosks ADD COLUMN current_paper_count INTEGER DEFAULT 500;
  END IF;
END $$;

-- Add constraint: paper count cannot be negative
ALTER TABLE kiosks DROP CONSTRAINT IF EXISTS paper_count_non_negative;
ALTER TABLE kiosks ADD CONSTRAINT paper_count_non_negative
CHECK (current_paper_count >= 0);

-- ==================== ADMIN AUDIT LOG ====================
-- Track admin actions (paper resets, manual interventions)

CREATE TABLE IF NOT EXISTS admin_actions (
  id SERIAL PRIMARY KEY,
  admin_id VARCHAR(255) NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  target_type VARCHAR(50),
  target_id VARCHAR(255),
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON admin_actions(created_at DESC);

-- ==================== HELPFUL VIEWS ====================

-- Daily stats per kiosk
CREATE OR REPLACE VIEW daily_kiosk_stats AS
SELECT 
  k.id AS kiosk_id,
  k.hostname AS kiosk_name,
  DATE(j.created_at) AS date,
  COUNT(j.id) AS total_jobs,
  COUNT(CASE WHEN j.status = 'COMPLETED' THEN 1 END) AS completed_jobs,
  COUNT(CASE WHEN j.status = 'FAILED' THEN 1 END) AS failed_jobs,
  COALESCE(SUM(CASE WHEN j.payment_status = 'paid' THEN j.total_cost ELSE 0 END), 0) AS revenue,
  COALESCE(SUM(CASE WHEN j.status = 'COMPLETED' THEN j.pages ELSE 0 END), 0) AS pages_printed
FROM kiosks k
LEFT JOIN jobs j ON k.id = j.kiosk_id
WHERE j.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY k.id, k.hostname, DATE(j.created_at)
ORDER BY date DESC, kiosk_id;

-- Overall system metrics
CREATE OR REPLACE VIEW system_metrics AS
SELECT 
  COUNT(DISTINCT j.id) AS total_jobs,
  COUNT(CASE WHEN j.status = 'COMPLETED' THEN 1 END) AS completed_jobs,
  COUNT(CASE WHEN j.status = 'FAILED' THEN 1 END) AS failed_jobs,
  COALESCE(SUM(CASE WHEN j.payment_status = 'paid' THEN j.total_cost ELSE 0 END), 0) AS total_revenue,
  COALESCE(SUM(CASE WHEN j.status = 'COMPLETED' THEN j.pages ELSE 0 END), 0) AS total_pages_printed,
  ROUND(
    COUNT(CASE WHEN j.status = 'COMPLETED' THEN 1 END)::NUMERIC / 
    NULLIF(COUNT(j.id), 0) * 100, 
    2
  ) AS success_rate
FROM jobs j
WHERE j.created_at >= CURRENT_DATE - INTERVAL '30 days';

-- ==================== PROMOTE YOUR ACCOUNT ====================
-- ⚠️ IMPORTANT: Replace with your actual email address!

UPDATE users SET role = 'admin' WHERE email = 'revanth2957@gmail.com';

-- Verify your account is now admin
SELECT id, email, name, role, created_at FROM users WHERE role = 'admin';

-- ==================== VERIFY ALL CHANGES ====================

-- Check users table has role column
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'role';

-- Check kiosks has paper tracking
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'kiosks' AND column_name = 'current_paper_count';

-- Check admin_actions table exists
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'admin_actions';

-- Show current kiosk paper counts
SELECT id, hostname, current_paper_count, printer_status, last_seen 
FROM kiosks 
ORDER BY id;