-- ============================================
-- Phase 1 Migration: Smart Printer Verification
-- Run this on your existing database
-- psql -U printuser -d printkiosk -f migration-phase1.sql
-- ============================================

-- Add printer status tracking to kiosks table
ALTER TABLE kiosks ADD COLUMN IF NOT EXISTS printer_status VARCHAR(50) DEFAULT 'unknown';
ALTER TABLE kiosks ADD COLUMN IF NOT EXISTS printer_status_detail TEXT;
ALTER TABLE kiosks ADD COLUMN IF NOT EXISTS last_status_check TIMESTAMP;

-- Phase 3 prep: paper tracking (add now, use later)
ALTER TABLE kiosks ADD COLUMN IF NOT EXISTS current_paper_count INTEGER DEFAULT 500;

-- Update kiosk status constraint to allow 'busy' state
ALTER TABLE kiosks DROP CONSTRAINT IF EXISTS valid_kiosk_status;
ALTER TABLE kiosks ADD CONSTRAINT valid_kiosk_status 
CHECK (status IN ('online', 'offline', 'maintenance', 'busy'));

-- Add printer_status constraint
ALTER TABLE kiosks DROP CONSTRAINT IF EXISTS valid_printer_status;
ALTER TABLE kiosks ADD CONSTRAINT valid_printer_status
CHECK (printer_status IN ('healthy', 'error', 'unknown'));

-- Index for fast status lookups
CREATE INDEX IF NOT EXISTS idx_kiosks_printer_status ON kiosks(printer_status);

-- Verify changes
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'kiosks'
ORDER BY ordinal_position;
