-- ============================================
-- JusPri Complete Database Schema (v2.1)
-- Includes: Phase 1, 2, 3 + Real-time Status
-- NO DUPLEX SUPPORT (removed per business requirements)
-- Run AFTER setup-database.sql
-- ============================================

-- Connect to database before running:
-- psql -U printuser -d printkiosk -h localhost -p 5433 -f schema.sql

-- ==================== USERS TABLE ====================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    role VARCHAR(20) DEFAULT 'user',  -- Phase 2: Role-based access
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== KIOSKS TABLE ====================
CREATE TABLE IF NOT EXISTS kiosks (
    id VARCHAR(255) PRIMARY KEY,
    hostname VARCHAR(255),
    printer_name VARCHAR(255),

    -- Core Status
    status VARCHAR(50) DEFAULT 'offline',
    last_seen TIMESTAMP,
    uptime FLOAT,
    socket_id VARCHAR(255),

    -- Phase 1: Printer Health Tracking
    printer_status VARCHAR(50) DEFAULT 'unknown',
    printer_status_detail TEXT,
    last_status_check TIMESTAMP,

    -- Phase 3: Paper Tracking
    current_paper_count INTEGER DEFAULT 500,
    price_per_page DECIMAL(10,2) DEFAULT 3.00,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== JOBS TABLE ====================
CREATE TABLE IF NOT EXISTS jobs (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255),
    kiosk_id VARCHAR(255) NOT NULL,

    -- File Info
    filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    pages INTEGER NOT NULL,

    -- Pricing
    price_per_page DECIMAL(10,2) NOT NULL,
    total_cost DECIMAL(10,2) NOT NULL,

    -- Status
    status VARCHAR(50) DEFAULT 'PENDING',
    payment_status VARCHAR(50) DEFAULT 'pending',
    payment_id VARCHAR(255),

    -- Job Type & Extensible Metadata (for scanning/xerox)
    job_type VARCHAR(30) DEFAULT 'print',
    metadata JSONB DEFAULT '{}'::jsonb,
    scan_options JSONB DEFAULT '{}'::jsonb,  -- For scanning: resolution, color mode, format
    output_file_url TEXT,                    -- For scanning: download URL

    -- Print Token
    print_token VARCHAR(255),
    token_timestamp BIGINT,

    -- Error Handling
    error_message TEXT,
    pages_printed INTEGER,

    -- Phase 4: Real-time Status Updates
    status_message TEXT,
    last_status_update TIMESTAMP,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP,
    queued_at TIMESTAMP,
    print_started_at TIMESTAMP,
    print_completed_at TIMESTAMP,

    -- Foreign Keys
    FOREIGN KEY (kiosk_id) REFERENCES kiosks(id) ON DELETE CASCADE
);

-- ==================== ADMIN ACTIONS TABLE ====================
-- Phase 2: Admin audit logging
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

-- ==================== INDEXES ====================

-- Users
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Jobs
CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_kiosk ON jobs(kiosk_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_payment_status ON jobs(payment_status);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_last_status_update ON jobs(last_status_update);
CREATE INDEX IF NOT EXISTS idx_jobs_kiosk_status ON jobs(kiosk_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(job_type);

-- Kiosks
CREATE INDEX IF NOT EXISTS idx_kiosks_status ON kiosks(status);
CREATE INDEX IF NOT EXISTS idx_kiosks_last_seen ON kiosks(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_kiosks_printer_status ON kiosks(printer_status);

-- Admin Actions
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON admin_actions(created_at DESC);

-- ==================== CONSTRAINTS ====================

-- Users
ALTER TABLE users DROP CONSTRAINT IF EXISTS valid_user_role;
ALTER TABLE users ADD CONSTRAINT valid_user_role
CHECK (role IN ('user', 'admin', 'superadmin'));

-- Jobs
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS valid_job_status;
ALTER TABLE jobs ADD CONSTRAINT valid_job_status
CHECK (status IN (
    -- Basic print workflow
    'PENDING','PAID','QUEUED','SENT_TO_PI','PRINTING',
    'COMPLETED','FAILED','EXPIRED','CANCELLED',
    -- Scanning workflow
    'DISCOVERING_SCANNER','SCANNING','PROCESSING',
    -- Xerox workflow
    'SCANNING_ORIGINAL','PROCESSING_COPY','PRINTING_COPY'
));

ALTER TABLE jobs DROP CONSTRAINT IF EXISTS valid_job_type;
ALTER TABLE jobs ADD CONSTRAINT valid_job_type
CHECK (job_type IN ('print','scan','xerox'));

ALTER TABLE jobs DROP CONSTRAINT IF EXISTS valid_payment_status;
ALTER TABLE jobs ADD CONSTRAINT valid_payment_status
CHECK (payment_status IN ('pending','paid','failed','refunded'));

-- Kiosks
ALTER TABLE kiosks DROP CONSTRAINT IF EXISTS valid_kiosk_status;
ALTER TABLE kiosks ADD CONSTRAINT valid_kiosk_status
CHECK (status IN ('online','offline','maintenance','busy'));

ALTER TABLE kiosks DROP CONSTRAINT IF EXISTS valid_printer_status;
ALTER TABLE kiosks ADD CONSTRAINT valid_printer_status
CHECK (printer_status IN ('healthy','error','unknown'));

ALTER TABLE kiosks DROP CONSTRAINT IF EXISTS paper_count_non_negative;
ALTER TABLE kiosks ADD CONSTRAINT paper_count_non_negative
CHECK (current_paper_count >= 0);

-- ==================== TRIGGERS ====================

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

DROP TRIGGER IF EXISTS update_kiosks_updated_at ON kiosks;
CREATE TRIGGER update_kiosks_updated_at
BEFORE UPDATE ON kiosks
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ==================== VIEWS ====================

-- Active Jobs
CREATE OR REPLACE VIEW active_jobs AS
SELECT
    j.id,
    j.kiosk_id,
    k.hostname AS kiosk_name,
    j.job_type,
    j.filename,
    j.pages,
    j.total_cost,
    j.status,
    j.status_message,
    j.created_at,
    j.print_started_at
FROM jobs j
LEFT JOIN kiosks k ON j.kiosk_id = k.id
WHERE j.status IN ('PENDING','PAID','QUEUED','PRINTING','SCANNING','SCANNING_ORIGINAL')
ORDER BY j.created_at DESC;

-- Kiosk Stats
CREATE OR REPLACE VIEW kiosk_stats AS
SELECT
    k.id,
    k.hostname,
    k.status,
    k.printer_status,
    k.current_paper_count,
    COUNT(j.id) AS total_jobs,
    COUNT(CASE WHEN j.status='COMPLETED' THEN 1 END) AS completed_jobs,
    COUNT(CASE WHEN j.status='FAILED' THEN 1 END) AS failed_jobs,
    COUNT(CASE WHEN j.job_type='print' THEN 1 END) AS print_jobs,
    COUNT(CASE WHEN j.job_type='scan' THEN 1 END) AS scan_jobs,
    COUNT(CASE WHEN j.job_type='xerox' THEN 1 END) AS xerox_jobs,
    COALESCE(SUM(
        CASE WHEN j.payment_status='paid'
        THEN j.total_cost ELSE 0 END
    ),0) AS total_revenue
FROM kiosks k
LEFT JOIN jobs j ON k.id = j.kiosk_id
GROUP BY k.id, k.hostname, k.status, k.printer_status, k.current_paper_count;

-- Daily Kiosk Stats (Phase 2)
CREATE OR REPLACE VIEW daily_kiosk_stats AS
SELECT
    k.id AS kiosk_id,
    k.hostname AS kiosk_name,
    DATE(j.created_at) AS date,
    COUNT(j.id) AS total_jobs,
    COUNT(CASE WHEN j.status = 'COMPLETED' THEN 1 END) AS completed_jobs,
    COUNT(CASE WHEN j.status = 'FAILED' THEN 1 END) AS failed_jobs,
    COUNT(CASE WHEN j.job_type = 'print' THEN 1 END) AS print_jobs,
    COUNT(CASE WHEN j.job_type = 'scan' THEN 1 END) AS scan_jobs,
    COUNT(CASE WHEN j.job_type = 'xerox' THEN 1 END) AS xerox_jobs,
    COALESCE(SUM(CASE WHEN j.payment_status = 'paid' THEN j.total_cost ELSE 0 END), 0) AS revenue,
    COALESCE(SUM(CASE WHEN j.status = 'COMPLETED' THEN j.pages ELSE 0 END), 0) AS pages_printed
FROM kiosks k
LEFT JOIN jobs j ON k.id = j.kiosk_id
WHERE j.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY k.id, k.hostname, DATE(j.created_at)
ORDER BY date DESC, kiosk_id;

-- System Metrics (Phase 2)
CREATE OR REPLACE VIEW system_metrics AS
SELECT
    COUNT(DISTINCT j.id) AS total_jobs,
    COUNT(CASE WHEN j.status = 'COMPLETED' THEN 1 END) AS completed_jobs,
    COUNT(CASE WHEN j.status = 'FAILED' THEN 1 END) AS failed_jobs,
    COUNT(CASE WHEN j.job_type = 'print' THEN 1 END) AS print_jobs,
    COUNT(CASE WHEN j.job_type = 'scan' THEN 1 END) AS scan_jobs,
    COUNT(CASE WHEN j.job_type = 'xerox' THEN 1 END) AS xerox_jobs,
    COALESCE(SUM(CASE WHEN j.payment_status = 'paid' THEN j.total_cost ELSE 0 END), 0) AS total_revenue,
    COALESCE(SUM(CASE WHEN j.status = 'COMPLETED' THEN j.pages ELSE 0 END), 0) AS total_pages_printed,
    ROUND(
        COUNT(CASE WHEN j.status = 'COMPLETED' THEN 1 END)::NUMERIC /
        NULLIF(COUNT(j.id), 0) * 100,
        2
    ) AS success_rate
FROM jobs j
WHERE j.created_at >= CURRENT_DATE - INTERVAL '30 days';

-- ==================== VERIFICATION ====================

-- Show table structures
\d users
\d kiosks
\d jobs
\d admin_actions

-- Show indexes
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Show views
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public';

-- ==================== SUCCESS MESSAGE ====================
\echo '✅ Schema created successfully!'
\echo '📊 Tables: users, kiosks, jobs, admin_actions'
\echo '📈 Views: active_jobs, kiosk_stats, daily_kiosk_stats, system_metrics'
\echo ''
\echo '✨ Features ready: Print, Scan, Xerox (NO duplex)'
\echo ''
\echo '⚠️  NEXT STEP: Promote your admin account'
\echo '   Run: UPDATE users SET role = '\''admin'\'' WHERE email = '\''your@email.com'\'';'
\echo ''
