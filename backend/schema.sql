-- ============================================
-- DirectPrint Full Database Schema
-- Run AFTER setup-database.sql
-- ============================================

-- Connect to database before running:
-- psql -U printuser -d printkiosk -f schema.sql

-- ==================== USERS TABLE ====================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
    status_message TEXT,
    last_status_update TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP,
    queued_at TIMESTAMP,
    print_started_at TIMESTAMP,
    print_completed_at TIMESTAMP,
    FOREIGN KEY (kiosk_id) REFERENCES kiosks(id) ON DELETE CASCADE
);

-- ==================== INDEXES ====================

CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_kiosk ON jobs(kiosk_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_payment_status ON jobs(payment_status);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_last_status_update ON jobs(last_status_update);

CREATE INDEX IF NOT EXISTS idx_kiosks_status ON kiosks(status);
CREATE INDEX IF NOT EXISTS idx_kiosks_last_seen ON kiosks(last_seen DESC);

-- ==================== CONSTRAINTS ====================

ALTER TABLE jobs DROP CONSTRAINT IF EXISTS valid_job_status;
ALTER TABLE jobs ADD CONSTRAINT valid_job_status 
CHECK (status IN (
    'PENDING','PAID','QUEUED','SENT_TO_PI',
    'PRINTING','COMPLETED','FAILED','EXPIRED'
));

ALTER TABLE jobs DROP CONSTRAINT IF EXISTS valid_payment_status;
ALTER TABLE jobs ADD CONSTRAINT valid_payment_status 
CHECK (payment_status IN ('pending','paid','failed','refunded'));

ALTER TABLE kiosks DROP CONSTRAINT IF EXISTS valid_kiosk_status;
ALTER TABLE kiosks ADD CONSTRAINT valid_kiosk_status 
CHECK (status IN ('online','offline','maintenance'));

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

CREATE OR REPLACE VIEW active_jobs AS
SELECT 
    j.id,
    j.kiosk_id,
    k.hostname AS kiosk_name,
    j.filename,
    j.pages,
    j.total_cost,
    j.status,
    j.created_at,
    j.print_started_at
FROM jobs j
LEFT JOIN kiosks k ON j.kiosk_id = k.id
WHERE j.status IN ('PENDING','PAID','QUEUED','PRINTING')
ORDER BY j.created_at DESC;

CREATE OR REPLACE VIEW kiosk_stats AS
SELECT 
    k.id,
    k.hostname,
    k.status,
    COUNT(j.id) AS total_jobs,
    COUNT(CASE WHEN j.status='COMPLETED' THEN 1 END) AS completed_jobs,
    COUNT(CASE WHEN j.status='FAILED' THEN 1 END) AS failed_jobs,
    COALESCE(SUM(
        CASE WHEN j.payment_status='paid' 
        THEN j.total_cost ELSE 0 END
    ),0) AS total_revenue
FROM kiosks k
LEFT JOIN jobs j ON k.id = j.kiosk_id
GROUP BY k.id,k.hostname,k.status;
