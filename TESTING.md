# 🧪 JusPri — Testing Guide

This guide covers how to test every feature of the JusPri system end-to-end.

---

## Prerequisites

Before testing, make sure these services are running:

```bash
# 1. PostgreSQL
sudo systemctl status postgresql
# Should show: active (running)

# 2. Backend
cd ~/Documents/projects/j/juspri/backend
node index.js
# Or with PM2: pm2 start index.js --name backend

# 3. Frontend (dev mode)
cd ~/Documents/projects/j/juspri/frontend
npm run dev

# 4. Pi Agent
cd ~/Documents/projects/j/juspri/pi-agent
node index.js
```

---

## 1. Database Verification

```bash
# Connect to database
psql -U printuser -d printkiosk -h localhost

# Verify tables exist
\dt

# Expected: users, kiosks, jobs, admin_actions

# Verify jobs table has all columns
\d jobs

# Key columns to check:
#   - retry_count (INTEGER, default 0)
#   - job_type (VARCHAR, default 'print')
#   - scan_options (JSONB)
#   - output_file_url (TEXT)

# Verify constraints
# valid_job_status should include: PENDING, PAID, QUEUED, SENT_TO_PI, PRINTING,
#   COMPLETED, FAILED, EXPIRED, CANCELLED, DISCOVERING_SCANNER, SCANNING,
#   PROCESSING, SCANNING_ORIGINAL, PROCESSING_COPY, PRINTING_COPY
# valid_job_type should include: print, scan, xerox
# Should NOT include any duplex statuses (PRINTING_PASS_1, WAITING_FOR_FLIP, etc.)

# Verify views exist
SELECT table_name FROM information_schema.views WHERE table_schema = 'public';
# Expected: active_jobs, kiosk_stats, daily_kiosk_stats, system_metrics
```

---

## 2. Backend API Tests

### 2.1 Health Check

```bash
# Backend should respond
curl http://localhost:3001/api/status
```

### 2.2 Kiosk Connection

```bash
# Check kiosk status (public endpoint, no auth needed)
curl "http://localhost:3001/api/kiosk/status?kiosk_id=YOUR_KIOSK_ID"

# Expected: JSON with kiosk_online, printer_status, current_paper_count
```

### 2.3 Job Creation (Requires Auth Token)

```bash
# Get a Firebase token from the frontend (check browser DevTools > Network)
TOKEN="your_firebase_token_here"

# Create a print job
curl -X POST http://localhost:3001/api/jobs/create \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.pdf" \
  -F "kiosk_id=YOUR_KIOSK_ID"

# Expected: { job_id, pages, total_cost, currency }
```

### 2.4 Payment Verification

```bash
# After creating a job, verify payment
curl -X POST "http://localhost:3001/api/jobs/JOB_ID/verify-payment" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"payment_id":"test_payment_123"}'

# Expected: { status: "success", job_status: "PAID" }
```

### 2.5 Job Polling (Pi Agent Endpoint)

```bash
# Poll for jobs (what the Pi Agent does)
curl "http://localhost:3001/api/jobs/poll?kiosk_id=YOUR_KIOSK_ID"

# Expected: { jobs: [{ job_id, filename, pages, job_type, download_url }] }
# Or: { jobs: [] } if no paid jobs
```

### 2.6 File Download

```bash
# Download a job file
curl "http://localhost:3001/api/jobs/JOB_ID/download" -o downloaded_file.pdf
```

### 2.7 Scan Endpoints

```bash
# Create a scan job
curl -X POST http://localhost:3001/api/jobs/scan \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"kiosk_id":"YOUR_KIOSK_ID","scan_options":{"resolution":300}}'

# Expected: { job_id, status: "QUEUED" }

# Upload a scan result (simulating Pi Agent)
curl -X POST "http://localhost:3001/api/jobs/JOB_ID/scan-upload" \
  -F "file=@test_scan.pdf"

# Expected: { success: true, download_url: "..." }
```

### 2.8 Admin Endpoints

```bash
# First, promote a user to admin in the database:
# psql: UPDATE users SET role = 'admin' WHERE email = 'your@email.com';

# Get admin metrics
curl http://localhost:3001/api/admin/metrics \
  -H "Authorization: Bearer $TOKEN"

# Get all kiosks
curl http://localhost:3001/api/admin/kiosks \
  -H "Authorization: Bearer $TOKEN"

# Get recent jobs
curl http://localhost:3001/api/admin/recent-jobs \
  -H "Authorization: Bearer $TOKEN"

# Set paper count
curl -X POST http://localhost:3001/api/admin/kiosks/YOUR_KIOSK_ID/set-paper \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"paperCount": 500}'
```

---

## 3. Pi Agent Tests

### 3.1 Startup Verification

```bash
cd ~/Documents/projects/j/juspri/pi-agent
node index.js

# Expected output:
# ╔════════════════════════════════════════╗
# ║   DirectPrint Agent V6 Starting...     ║
# ╚════════════════════════════════════════╝
# 📱 Scan this QR code to connect:
# (QR code displayed)
# ✅ Connected to Cloud Hub!
# 🚀 Agent ready and listening for jobs!
```

### 3.2 Printer Detection

```bash
# List available CUPS printers
lpstat -p -d

# Pi agent auto-detects printers on startup
# Check logs for: "Printer detected: PRINTER_NAME"
```

### 3.3 Job Processing Flow

1. Upload a file through the frontend
2. Complete payment
3. Watch pi-agent logs for:
   - `Polling for jobs...`
   - `📥 Fetched job: JOB_ID`
   - `📥 Downloaded: filename.pdf`
   - `🖨️ Printing: filename.pdf`
   - Job status updates via WebSocket

### 3.4 Scanner Module Test

```bash
# Test eSCL scanner availability (requires network printer with eSCL)
curl http://YOUR_PRINTER_IP/eSCL/ScannerCapabilities

# Expected: XML response with scanner capabilities
# If this fails, try HTTPS:
curl -k https://YOUR_PRINTER_IP/eSCL/ScannerCapabilities
```

### 3.5 Job Retry Logic

```bash
# In psql, simulate a failed job:
UPDATE jobs SET status = 'FAILED', retry_count = 0
WHERE id = 'JOB_ID';

# The system should retry up to 3 times (retry_count < 3)
# Check: SELECT id, status, retry_count FROM jobs WHERE id = 'JOB_ID';
```

---

## 4. Frontend Tests

### 4.1 User Flow

1. **Open** `http://localhost:5173?kiosk_id=YOUR_KIOSK_ID`
2. **Login** with Google OAuth
3. **Upload** a PDF file
4. **Verify** page count and pricing display correctly
5. **Pay** (or simulate payment)
6. **Track** job status updates in real-time

### 4.2 Scan Flow

1. Open frontend and select **Scan** mode
2. Click **Start Scan**
3. Verify the scan request is sent to backend
4. Check pi-agent logs for scan job processing

### 4.3 Admin Dashboard

1. Login with an admin account
2. Navigate to `/admin`
3. Verify:
   - System metrics load (total jobs, revenue, pages)
   - Kiosk health grid shows connected kiosks
   - Recent jobs table populates
   - Paper count management works

### 4.4 QR Code Scanning

1. Open the app on mobile
2. Point camera at the QR code displayed by pi-agent
3. Should navigate to the upload interface with kiosk pre-selected

---

## 5. WebSocket Tests

### 5.1 Real-time Status Updates

1. Open browser DevTools → Network → WS tab
2. Upload and pay for a print job
3. Watch for WebSocket messages:
   - `job_state_change` events with status updates
   - `heartbeat` events from kiosk

### 5.2 Kiosk Registration

1. Start pi-agent
2. In backend logs, verify:
   - `[Socket] Kiosk registered: KIOSK_ID`
   - Heartbeat events received every 30 seconds

---

## 6. Production Improvements Verification

| Feature | How to Verify |
|---------|---------------|
| **Row locking** | Run two pi-agents for the same kiosk; only one should pick up each job |
| **File streaming** | In poll response, check for `download_url` (not `file_data`) |
| **2s poll interval** | Check pi-agent logs for poll frequency |
| **File cleanup** | Files in `print-queue/` older than 30 min should auto-delete |
| **Job retry** | Set a job to FAILED with retry_count < 3; it should be requeued |
| **Disk protection** | Fill `print-queue/` to > 500MB; agent should skip new downloads |

---

## 7. End-to-End Smoke Test

Complete this checklist for a full system verification:

- [ ] PostgreSQL running and schema verified
- [ ] Backend starts without errors
- [ ] Frontend loads and login works
- [ ] Pi Agent connects to backend (WebSocket)
- [ ] QR code scans and opens frontend
- [ ] File upload works (PDF, DOCX, images)
- [ ] Page count and pricing calculated correctly
- [ ] Payment flow completes
- [ ] Pi Agent picks up paid job
- [ ] File downloads to Pi Agent
- [ ] Document converts to PDF (if needed)
- [ ] Document prints successfully
- [ ] Job status updates in real-time (frontend)
- [ ] Admin dashboard shows metrics
- [ ] Kiosk health grid works
- [ ] Paper count tracking works
- [ ] Scan job creates successfully (if scanner available)
- [ ] Old files cleaned up automatically
