-- Create database and user
CREATE DATABASE printkiosk;
CREATE USER printuser WITH ENCRYPTED PASSWORD 'dev_password_change_in_prod';
GRANT ALL PRIVILEGES ON DATABASE printkiosk TO printuser;

\c printkiosk

-- Users table
CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Kiosks table
CREATE TABLE kiosks (
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

-- Jobs table
CREATE TABLE jobs (
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
    FOREIGN KEY (kiosk_id) REFERENCES kiosks(id)
);

-- Indexes
CREATE INDEX idx_jobs_user ON jobs(user_id);
CREATE INDEX idx_jobs_kiosk ON jobs(kiosk_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_created ON jobs(created_at DESC);
CREATE INDEX idx_kiosks_status ON kiosks(status);
