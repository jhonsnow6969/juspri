# 🖨️ JusPri

A cloud-based print, scan, and xerox kiosk system. Users scan a QR code, upload documents, pay, and print — all from their phone.

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Reference](#-api-reference)
- [Testing](#-testing)
- [Troubleshooting](#-troubleshooting)

---

## 🎯 Overview

JusPri is a three-component kiosk system for libraries, universities, coworking spaces, and print shops:

1. **Scan a QR code** at a physical kiosk
2. **Upload documents** via a web interface on your phone
3. **Pay per page** and print instantly
4. **Scan documents** using the kiosk's eSCL-compatible scanner

### Live URLs
- **Frontend:** https://qr-wifi-printer.vercel.app
- **Backend API:** https://justpri.duckdns.org

---

## ✨ Features

### Print
- 📄 **Multi-format support** — PDF, DOCX, TXT, PNG, JPG (auto-converted to PDF)
- 💳 **Pay per page** — Razorpay integration with configurable pricing
- 🔄 **Real-time status** — Live job tracking via WebSocket
- 🔒 **Row locking** — `FOR UPDATE SKIP LOCKED` prevents duplicate dispatch
- 🔁 **Auto-retry** — Failed jobs retry up to 3 times
- 📥 **File streaming** — Download URLs instead of base64 encoding
- 🗑️ **Auto-cleanup** — Print queue files cleaned up after 30 minutes
- 💾 **Disk protection** — 500MB limit on print queue directory

### Scan
- 🔍 **eSCL scanning** — Works with any AirScan/eSCL-compatible printer
- 📤 **Cloud upload** — Scanned PDFs uploaded to backend automatically
- ⬇️ **Download link** — Users get a download URL for their scanned document

### Xerox *(planned)*
- 📋 **Scan → Print pipeline** — Scan a document and immediately print copies

### Admin
- 📊 **Dashboard** — System metrics, revenue, job counts
- 🖨️ **Kiosk health** — Real-time printer status, paper counts
- 📋 **Job management** — View and filter all jobs
- 📝 **Audit logging** — Admin action tracking

### Security
- 🔐 **Firebase Auth** — Google OAuth login
- 🔑 **JWT verification** — All API endpoints authenticated
- 👥 **Role-based access** — user, admin, superadmin roles
- 🛡️ **User isolation** — Users only see their own jobs

---

## 🏗️ Architecture

```
┌─────────────────┐
│   User Device   │
│  (Web Browser)  │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐      WebSocket      ┌──────────────────┐
│    Frontend     │◄═══════════════════►│     Backend      │
│  (React/Vite)   │      REST API       │ (Node.js/Express)│
└─────────────────┘                     └────────┬─────────┘
                                                 │
                                        ┌────────┴────────┐
                                        │   PostgreSQL    │
                                        │    Database     │
                                        └────────┬────────┘
                                                 │ Poll + WebSocket
                                                 ▼
                                        ┌─────────────────┐
                                        │    Pi Agent     │
                                        │ (Node.js/CUPS)  │
                                        └────────┬────────┘
                                                 │ CUPS / eSCL
                                                 ▼
                                        ┌─────────────────┐
                                        │  Printer/Scanner│
                                        └─────────────────┘
```

### Data Flow

**Print:** User uploads file → Backend creates job → User pays → Pi Agent polls & claims job (row-locked) → Downloads file → Converts to PDF → Prints via CUPS → Status updates via WebSocket

**Scan:** User clicks Scan → Backend creates scan job → WebSocket event to Pi → Pi scans via eSCL → Uploads PDF to backend → User gets download link

---

## 🛠️ Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, Vite, TailwindCSS, shadcn/ui, Firebase Auth, Socket.IO Client |
| **Backend** | Node.js, Express, PostgreSQL, Socket.IO, Firebase Admin SDK, Multer, Razorpay |
| **Pi Agent** | Node.js, Socket.IO Client, CUPS, LibreOffice, pdf-lib, eSCL/AirScan (xml2js, axios) |
| **Database** | PostgreSQL with views, triggers, constraints, JSONB fields |

---

## 📁 Project Structure

```
juspri/
├── backend/
│   ├── index.js               # Express server + Socket.IO setup
│   ├── db.js                  # PostgreSQL abstraction layer
│   ├── auth-middleware.js     # Firebase JWT verification
│   ├── schema.sql             # Complete database schema
│   ├── setup-db.sql           # Initial DB/user creation
│   └── modules/
│       ├── job-routes.js      # Print, scan, download endpoints
│       ├── admin-routes.js    # Admin dashboard API
│       ├── kiosk-routes.js    # Public kiosk status endpoint
│       ├── socket-manager.js  # WebSocket event handling
│       ├── tasks.js           # Scheduled cleanup tasks
│       └── utils.js           # File upload, PDF utils
│
├── frontend/
│   └── src/
│       ├── App.jsx            # Router setup
│       ├── firebase.js        # Firebase config
│       └── components/
│           ├── Print/         # Upload, print, scan UI
│           ├── Admin/         # Admin dashboard components
│           ├── Dashboard/     # User dashboard
│           ├── Login.jsx      # Google OAuth login
│           └── ui/            # Shared UI components
│
├── pi-agent/
│   ├── index.js               # Main entry, config, init
│   └── modules/
│       ├── socket-client.js   # WebSocket connection + scan handler
│       ├── job-handler.js     # Job polling, processing, printing
│       ├── scanner.js         # eSCL scanner module
│       ├── printer.js         # CUPS printing + status checks
│       ├── utils.js           # File conversion (DOCX→PDF, IMG→PDF)
│       ├── logger.js          # Console logging
│       └── errors.js          # Custom error types
│
├── TESTING.md                 # Full testing guide
└── README.md                  # This file
```

---

## 📦 Prerequisites

### Backend
- Node.js ≥ 16
- PostgreSQL ≥ 12
- Firebase project (for auth)

### Frontend
- Node.js ≥ 16
- Vercel account (for deployment)

### Pi Agent
- Raspberry Pi (any model with WiFi) or any Linux machine
- USB/network printer with CUPS support
- *(Optional)* eSCL/AirScan-compatible printer for scanning
- CUPS, LibreOffice, ImageMagick installed

---

## 🚀 Installation

### 1. Backend

```bash
cd backend
npm install

# Setup PostgreSQL
sudo -u postgres psql
CREATE DATABASE printkiosk;
CREATE USER printuser WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE printkiosk TO printuser;
\q

# Run schema
psql -U printuser -d printkiosk -f schema.sql

# Configure
cp .env.example .env
# Edit .env with your settings (see Configuration section)

# Start
npm run dev           # Development (with nodemon)
pm2 start index.js    # Production
```

### 2. Frontend

```bash
cd frontend
npm install

# Configure environment variables (see Configuration section)
# Set VITE_API_URL and Firebase config in .env or Vercel dashboard

npm run dev           # Development
vercel                # Deploy to Vercel
```

### 3. Pi Agent

```bash
cd pi-agent
npm install

# Install system dependencies
sudo apt install cups libreoffice-writer imagemagick

# Configure
cp .env.example .env
# Edit .env with your settings

# Start
node index.js

# Or install as systemd service for auto-start
```

---

## ⚙️ Configuration

### Backend `.env`

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `printkiosk` |
| `DB_USER` | Database user | `printuser` |
| `DB_PASSWORD` | Database password | *(required)* |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins | Vercel + localhost |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Path to Firebase service account JSON | `./config/firebase-service-account.json` |
| `BACKEND_URL` | Public URL of backend (for scan download links) | — |

### Frontend (Vercel / `.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API URL |
| `VITE_FIREBASE_API_KEY` | Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |

### Pi Agent `.env`

| Variable | Description | Default |
|----------|-------------|---------|
| `CLOUD_URL` | Backend URL | `https://justpri.duckdns.org` |
| `FRONTEND_URL` | Frontend URL (for QR code) | `https://qr-wifi-printer.vercel.app` |
| `KIOSK_ID` | Unique kiosk identifier | `kiosk_{hostname}` |
| `PRINTER_NAME` | CUPS printer name | `auto` (auto-detect) |
| `POLL_INTERVAL` | Job polling interval in ms | `2000` |

---

## 📖 Usage

### For Users

1. **Scan** the QR code displayed at the kiosk
2. **Login** with your Google account
3. **Upload** a document (PDF, DOCX, TXT, or image)
4. **Review** page count and price
5. **Pay** via Razorpay
6. **Collect** your printed document

### For Admins

1. Login with an admin account (set via `UPDATE users SET role = 'admin' WHERE email = '...'`)
2. Navigate to `/admin` in the frontend
3. Monitor kiosk health, job history, and system metrics
4. Manage paper counts per kiosk

---

## 🔌 API Reference

### Public Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/kiosk/status?kiosk_id=xxx` | Check kiosk/printer status |
| `POST` | `/api/connect` | Legacy kiosk connection check |

### Authenticated Endpoints (Firebase JWT required)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/jobs/create` | Upload file and create print job |
| `POST` | `/api/jobs/:id/verify-payment` | Mark job as paid |
| `POST` | `/api/jobs/scan` | Create a scan job |
| `GET` | `/api/jobs/:id/download` | Download job file |

### Pi Agent Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/jobs/poll?kiosk_id=xxx` | Poll for paid jobs (row-locked) |
| `GET` | `/api/jobs/:id/download` | Download file for printing |
| `POST` | `/api/jobs/:id/scan-upload` | Upload scanned file |

### Admin Endpoints (admin role required)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/metrics` | System-wide statistics |
| `GET` | `/api/admin/kiosks` | All kiosks with status |
| `GET` | `/api/admin/jobs` | Filterable job list |
| `GET` | `/api/admin/recent-jobs` | Recent jobs with user info |
| `POST` | `/api/admin/kiosks/:id/set-paper` | Update paper count |

### WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `register` | Pi → Backend | Kiosk registration |
| `heartbeat` | Pi → Backend | Periodic health update |
| `job_state_change` | Pi → Backend | Job status update |
| `scan_job` | Backend → Pi | Trigger scan on kiosk |
| `update_config` | Backend → Pi | Remote config update |

---

## 🧪 Testing

See [TESTING.md](TESTING.md) for the complete testing guide covering:
- Database verification
- Backend API tests (all endpoints)
- Pi Agent tests (printing, scanning, retry logic)
- Frontend tests (user flow, admin dashboard)
- WebSocket tests
- End-to-end smoke test checklist

---

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test database connection
psql -U printuser -d printkiosk -h localhost
```

### Pi Agent can't connect
```bash
# Test backend connectivity
curl https://your-backend.com/api/kiosk/status?kiosk_id=test

# Check pi-agent logs for WebSocket errors
```

### Printer not found
```bash
# List CUPS printers
lpstat -p -d

# Set default printer
lpoptions -d printer_name
```

### Scanner not working
```bash
# Test eSCL availability
curl http://PRINTER_IP/eSCL/ScannerCapabilities

# Try HTTPS if HTTP fails
curl -k https://PRINTER_IP/eSCL/ScannerCapabilities

# Verify printer and Pi are on the same network
```

### Image conversion fails
```bash
# Fix ImageMagick policy for PDF
sudo sed -i 's/rights="none" pattern="PDF"/rights="read|write" pattern="PDF"/' /etc/ImageMagick-*/policy.xml
```

### CORS errors
```bash
# Update ALLOWED_ORIGINS in backend .env
ALLOWED_ORIGINS=https://your-frontend.vercel.app,http://localhost:5173
```

---

## 📊 Database Schema

**4 tables:** `users`, `kiosks`, `jobs`, `admin_actions`

**4 views:** `active_jobs`, `kiosk_stats`, `daily_kiosk_stats`, `system_metrics`

**Job types:** `print`, `scan`, `xerox`

**Job statuses:**
- Print: `PENDING` → `PAID` → `QUEUED` → `SENT_TO_PI` → `PRINTING` → `COMPLETED`
- Scan: `QUEUED` → `DISCOVERING_SCANNER` → `SCANNING` → `PROCESSING` → `COMPLETED`
- Xerox: `SCANNING_ORIGINAL` → `PROCESSING_COPY` → `PRINTING_COPY` → `COMPLETED`
- Error: `FAILED`, `EXPIRED`, `CANCELLED`
