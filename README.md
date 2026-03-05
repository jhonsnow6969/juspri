# 🖨️ JusPri 


A modern, cloud-based printing solution that enables users to print documents from any device to physical kiosk printers via QR codes and web interface.

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
  - [Backend Setup](#1-backend-cloud-server)
  - [Frontend Setup](#2-frontend-vercel)
  - [Pi Agent Setup](#3-pi-agent-raspberry-pi)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [Troubleshooting](#-troubleshooting)
- [Feature Implementation Execution Guide](phase-docs/FEATURE_IMPLEMENTATION_EXECUTION_GUIDE.md)

---

## 🎯 Overview

DirectPrint is a three-component system that allows users to:
1. Scan a QR code at a physical kiosk
2. Upload documents via web interface
3. Pay and print instantly

Perfect for libraries, universities, coworking spaces, and print shops.

### **Live Demo**
- **Frontend:** https://qr-wifi-printer.vercel.app
- **Backend API:** https://justpri.duckdns.org

---

## ✨ Features

### **User Features**
- 🔐 **Google OAuth Authentication** - Secure login
- 📱 **QR Code Discovery** - Scan to connect to nearest kiosk
- 📄 **Multi-Format Support** - PDF, DOCX, TXT, PNG, JPG
- 💳 **Payment Integration** - Pay per page (Razorpay ready)
- 📊 **Print History** - Track all your print jobs
- 🔄 **Real-time Status** - Live job status updates
- 🌐 **Responsive Design** - Works on all devices

### **Admin Features**
- 🖨️ **Multiple Kiosks** - Manage unlimited print stations
- 📈 **Usage Statistics** - Track prints, revenue, success rate
- 🔧 **Remote Configuration** - Update settings remotely
- 📡 **Live Monitoring** - See kiosk status in real-time

### **Technical Features**
- 🚀 **Pull-Based Architecture** - Reliable job polling
- 🔄 **Auto-Conversion** - Documents → PDF automatically
- 🔒 **User Isolation** - Secure multi-tenant database
- 📦 **PostgreSQL** - Persistent data storage
- ⚡ **Socket.IO** - Real-time updates
- 🐳 **Docker Ready** - Easy deployment

---

## 🏗️ Architecture

```
┌─────────────────┐
│   User Device   │
│  (Web Browser)  │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐      ┌──────────────────┐
│    Frontend     │◄────►│     Backend      │
│  (Vercel/React) │      │ (Node.js/Express)│
└─────────────────┘      └────────┬─────────┘
                                  │
                         ┌────────┴────────┐
                         │   PostgreSQL    │
                         │    Database     │
                         └────────┬────────┘
                                  │ Poll Jobs
                                  ▼
                         ┌─────────────────┐
                         │    Pi Agent     │
                         │  (Raspberry Pi) │
                         └────────┬────────┘
                                  │ CUPS
                                  ▼
                         ┌─────────────────┐
                         │     Printer     │
                         └─────────────────┘
```

### **Data Flow**

1. User scans QR code → Opens frontend with `?kiosk_id=xxx`
2. User uploads file → Backend creates job (status: PENDING)
3. User pays → Backend marks job as PAID
4. Pi agent polls → Fetches PAID jobs (status: QUEUED)
5. Pi converts & prints → Updates status (PRINTING → COMPLETED)
6. User receives notification

---

## 🛠️ Tech Stack

### **Frontend**
- React 18
- Vite
- TailwindCSS + shadcn/ui
- React Router
- Firebase Auth
- Socket.IO Client
- Axios

### **Backend**
- Node.js
- Express.js
- PostgreSQL
- Socket.IO
- Firebase Admin SDK
- Multer (file uploads)

### **Pi Agent**
- Node.js
- Socket.IO Client
- CUPS (printing)
- LibreOffice (document conversion)
- ImageMagick (image conversion)
- pdf-lib (PDF manipulation)

---

## 📦 Prerequisites

### **For Backend:**
- Node.js >= 20.x
- PostgreSQL >= 12.x
- Ubuntu/Debian server (or Oracle Cloud VM)
- Domain name (optional: DuckDNS)

### **For Frontend:**
- Node.js >= 20.x
- Vercel account (free)
- Firebase project (for OAuth)

### **For Pi Agent:**
- Raspberry Pi (any model with WiFi)
- Raspberry Pi OS / Ubuntu / Arch Linux
- USB/Network printer
- Internet connection

---

## 🚀 Installation
### **1. Backend (Cloud Server)**
#### **Step 1: Clone Repository**
```bash
git clone https://github.com/revanthlol/qr-wifi-printer.git
cd qr-wifi-printer/backend
```
#### **Step 2: Install Dependencies**
```bash
npm install
```
#### **Step 3: Setup PostgreSQL**
```bash
# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Create database
sudo -u postgres psql
CREATE DATABASE printkiosk;
CREATE USER printuser WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE printkiosk TO printuser;
\q

# Run schema
psql -U printuser -d printkiosk < schema.sql
```
#### **Step 4: Configure Environment**
```bash
# Create .env file
cp .env.example .env
nano .env
```
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=printkiosk
DB_USER=printuser
DB_PASSWORD=your_secure_password

# Server
PORT=3001
NODE_ENV=production

# Security
SECRET_KEY=your_very_long_random_secret_key

# CORS
ALLOWED_ORIGINS=https://your-frontend.vercel.app

# Firebase
FIREBASE_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json
```

#### **Step 5: Start Backend**
```bash
# Development
npm run dev

# Production (with PM2)
npm install -g pm2
pm2 start index.js --name juspri-backend
pm2 save
pm2 startup
```

**Full backend setup guide:** [ORACLE_VM_DEPLOYMENT_GUIDE.md](phase_docs/docs/ORACLE_VM_DEPLOYMENT_GUIDE.md)

---

### **2. Frontend (Vercel)**

#### **Step 1: Setup Firebase**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create new project
3. Enable Google Authentication
4. Get Firebase config

#### **Step 2: Deploy to Vercel**
```bash
cd frontend

# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
```

#### **Step 3: Configure Environment Variables**

In Vercel Dashboard → Settings → Environment Variables:

```env
VITE_API_URL=https://your-backend.com
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

**Full frontend setup guide:** [VERCEL_DEPLOYMENT_GUIDE.md](docs/VERCEL_DEPLOYMENT_GUIDE.md)

---

### **3. Pi Agent (Raspberry Pi)**

#### **Automated Setup (Recommended)**

```bash
# Download setup script
wget https://raw.githubusercontent.com/revanthlol/qr-wifi-printer/main/setup-pi-agent.sh

# Make executable
chmod +x setup-pi-agent.sh

# Run setup
./setup-pi-agent.sh
```

The script will:
- ✅ Install Node.js, CUPS, LibreOffice, ImageMagick
- ✅ Download pi-agent code (sparse checkout)
- ✅ Configure environment variables
- ✅ Create systemd service for auto-start
- ✅ Setup QR display server (optional)

#### **Manual Setup**

```bash
# Install dependencies
sudo apt update
sudo apt install -y nodejs npm cups libreoffice-writer imagemagick git

# Clone pi-agent only (sparse checkout)
mkdir ~/directprint-agent
cd ~/directprint-agent
git init
git remote add origin https://github.com/revanthlol/qr-wifi-printer.git
git config core.sparseCheckout true
echo "pi-agent/*" > .git/info/sparse-checkout
git pull origin main
mv pi-agent/* .

# Install npm packages
npm install

# Configure
cp .env.example .env
nano .env
```

**Configuration (.env):**
```env
CLOUD_URL=https://your-backend.com
FRONTEND_URL=https://your-frontend.vercel.app
KIOSK_ID=kiosk_001
PRINTER_NAME=auto
POLL_INTERVAL=5000
```

**Start Service:**
```bash
# Manual start
node index.js

# Or use systemd (created by setup script)
sudo systemctl start directprint-agent
sudo systemctl enable directprint-agent
```

---

## ⚙️ Configuration

### **Backend Configuration**

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3001 |
| `DB_HOST` | PostgreSQL host | localhost |
| `DB_NAME` | Database name | printkiosk |
| `SECRET_KEY` | JWT secret | (required) |
| `ALLOWED_ORIGINS` | CORS origins | (required) |
| `PRICE_PER_PAGE` | Default price in ₹ | 3 |

### **Frontend Configuration**

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API URL |
| `VITE_FIREBASE_*` | Firebase config |

### **Pi Agent Configuration**

| Variable | Description | Default |
|----------|-------------|---------|
| `CLOUD_URL` | Backend URL | (required) |
| `KIOSK_ID` | Unique kiosk identifier | kiosk_hostname |
| `PRINTER_NAME` | CUPS printer name | auto |
| `POLL_INTERVAL` | Job polling interval (ms) | 5000 |

---

## 📖 Usage

### **For Users:**

1. **Scan QR Code** at kiosk
2. **Login** with Google
3. **Upload** document (PDF, DOCX, images)
4. **Pay** for pages
5. **Collect** printed document

### **For Admins:**

1. **Monitor** kiosks via dashboard
2. **View** print statistics
3. **Manage** pricing per kiosk
4. **Check** job history

---

## 🔌 API Documentation

### **Authentication**
All API endpoints (except `/api/connect`) require Firebase JWT token:
```
Authorization: Bearer <firebase-id-token>
```

### **Endpoints**

#### **Jobs**
- `POST /api/jobs/create` - Create print job
- `GET /api/jobs/my-jobs` - Get user's jobs
- `GET /api/jobs/:id/status` - Get job status
- `POST /api/jobs/:id/verify-payment` - Mark as paid
- `GET /api/jobs/poll?kiosk_id=xxx` - Poll for jobs (Pi agent)

#### **Users**
- `GET /api/users/stats` - Get user statistics

#### **Kiosks**
- `POST /api/connect` - Check kiosk status (public)

**Full API docs:** [API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md)

---

## 🐛 Troubleshooting

### **Backend Issues**

**Database connection failed:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U printuser -d printkiosk -h localhost
```

**CORS errors:**
```bash
# Update ALLOWED_ORIGINS in .env
ALLOWED_ORIGINS=https://your-frontend.vercel.app,https://another-domain.com
```

### **Frontend Issues**

**API calls fail:**
- Check `VITE_API_URL` is correct
- Ensure backend CORS allows your domain
- Check browser console for errors

**Login doesn't work:**
- Verify Firebase configuration
- Check Firebase Auth is enabled
- Ensure authorized domains include your Vercel URL

### **Pi Agent Issues**

**Can't connect to backend:**
```bash
# Test connectivity
curl https://your-backend.com/api/status

# Check logs
sudo journalctl -u directprint-agent -f
```

**Image conversion fails:**
```bash
# Fix ImageMagick policy
sudo sed -i 's/rights="none" pattern="PDF"/rights="read|write" pattern="PDF"/' /etc/ImageMagick-*/policy.xml
```

**Printer not found:**
```bash
# List printers
lpstat -p -d

# Set default printer
lpoptions -d printer_name
```

**Full troubleshooting guide:** [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
---

## 🗺️ Roadmap

- [ ] Razorpay payment integration
- [ ] Multiple payment methods
- [ ] Color/B&W printing options
- [ ] Double-sided printing
- [ ] Admin dashboard
- [ ] Email receipts
- [ ] Job scheduling
- [ ] Print presets
- [ ] Mobile app (React Native)

---
