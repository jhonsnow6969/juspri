-- ===============================
-- Database & User Setup Script
-- Run this as postgres superuser
-- ===============================

DROP DATABASE IF EXISTS printkiosk;
DROP ROLE IF EXISTS printuser;

CREATE USER printuser WITH ENCRYPTED PASSWORD 'print';

CREATE DATABASE printkiosk OWNER printuser;

GRANT ALL PRIVILEGES ON DATABASE printkiosk TO printuser;
