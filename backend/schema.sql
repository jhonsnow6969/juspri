-- Phase 1 Database Schema for DirectPrint
-- Run this file after creating the database and user

-- Connect to the printkiosk database before running this
-- \c printkiosk

-- ==================== USERS TABLE ====================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE users IS 'Stores user information from Google OAuth';
COMMENT ON COLUMN users.id IS 'Firebase UID or unique user identifier';
COMMENT ON COLUMN users.email IS 'User email address from OAuth';

-- ==================== KIOSKS TABLE ====================
CREATE TABLE IF NOT EXISTS kiosks (
    id VARCHAR(255) PRIMARY KEY,
    hostname VARCHAR(255),
    printer_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'offline',
    last_seen TIMESTAMP,
    uptime FLOAT,
    socket_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE kiosks IS 'Tracks all registered Raspberry Pi kiosks';
COMMENT ON COLUMN kiosks.status IS 'online | offline';
COMMENT ON COLUMN kiosks.last_seen IS 'Last heartbeat timestamp';
COMMENT ON COLUMN kiosks.uptime IS 'System uptime in seconds';

-- ==================== JOBS TABLE ====================
CREATE TABLE IF NOT EXISTS jobs (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255),
    kiosk_id VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    pages INTEGER NOT NULL,
    price_per_page DECIMAL(10,2) NOT NULL,
    total_cost DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING',
    payment_status VARCHAR(50) DEFAULT 'pending',
    payment_id VARCHAR(255),
    print_token VARCHAR(255),
    token_timestamp BIGINT,
    error_message TEXT,
    pages_printed INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP,
    queued_at TIMESTAMP,
    print_started_at TIMESTAMP,
    print_completed_at TIMESTAMP,
    FOREIGN KEY (kiosk_id) REFERENCES kiosks(id) ON DELETE CASCADE
);

COMMENT ON TABLE jobs IS 'Stores all print job information and lifecycle';
COMMENT ON COLUMN jobs.status IS 'PENDING | PAID | QUEUED | SENT_TO_PI | PRINTING | COMPLETED | FAILED | EXPIRED';
COMMENT ON COLUMN jobs.payment_status IS 'pending | paid | failed | refunded';
COMMENT ON COLUMN jobs.print_token IS 'HMAC token for secure print authorization';

-- ==================== INDEXES ====================
-- Jobs indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_kiosk ON jobs(kiosk_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_payment_status ON jobs(payment_status);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs(created_at DESC);

-- Kiosks indexes
CREATE INDEX IF NOT EXISTS idx_kiosks_status ON kiosks(status);
CREATE INDEX IF NOT EXISTS idx_kiosks_last_seen ON kiosks(last_seen DESC);

-- ==================== CONSTRAINTS ====================
-- Ensure valid status values
ALTER TABLE jobs ADD CONSTRAINT valid_job_status 
    CHECK (status IN ('PENDING', 'PAID', 'QUEUED', 'SENT_TO_PI', 'PRINTING', 'COMPLETED', 'FAILED', 'EXPIRED'));

ALTER TABLE jobs ADD CONSTRAINT valid_payment_status 
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded'));

ALTER TABLE kiosks ADD CONSTRAINT valid_kiosk_status 
    CHECK (status IN ('online', 'offline', 'maintenance'));

-- ==================== TRIGGERS ====================
-- Auto-update updated_at timestamp on jobs
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kiosks_updated_at BEFORE UPDATE ON kiosks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==================== VIEWS ====================
-- Active jobs view (for dashboard)
CREATE OR REPLACE VIEW active_jobs AS
SELECT 
    j.id,
    j.kiosk_id,
    k.hostname as kiosk_name,
    j.filename,
    j.pages,
    j.total_cost,
    j.status,
    j.created_at,
    j.print_started_at
FROM jobs j
LEFT JOIN kiosks k ON j.kiosk_id = k.id
WHERE j.status IN ('PENDING', 'PAID', 'QUEUED', 'PRINTING')
ORDER BY j.created_at DESC;

-- Kiosk statistics view
CREATE OR REPLACE VIEW kiosk_stats AS
SELECT 
    k.id,
    k.hostname,
    k.status,
    COUNT(j.id) as total_jobs,
    COUNT(CASE WHEN j.status = 'COMPLETED' THEN 1 END) as completed_jobs,
    COUNT(CASE WHEN j.status = 'FAILED' THEN 1 END) as failed_jobs,
    COALESCE(SUM(CASE WHEN j.payment_status = 'paid' THEN j.total_cost ELSE 0 END), 0) as total_revenue
FROM kiosks k
LEFT JOIN jobs j ON k.id = j.kiosk_id
GROUP BY k.id, k.hostname, k.status;

-- ==================== VERIFY INSTALLATION ====================
-- Display table information
\echo ''
\echo '╔════════════════════════════════════════════════╗'
\echo '║  Database Schema Created Successfully          ║'
\echo '╚════════════════════════════════════════════════╝'
\echo ''
\echo 'Tables created:'
\dt

\echo ''
\echo 'Indexes created:'
\di

\echo ''
\echo 'Views created:'
\dv

\echo ''
\echo 'Schema installation complete!'
\echo 'You can now test the connection with: node test-db.js'
