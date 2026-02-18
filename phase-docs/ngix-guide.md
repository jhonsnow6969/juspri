# 🚀 QR-Wifi-Printer Deployment Guide (Nginx Version)

**Target OS:** Ubuntu 22.04 / 24.04 (Oracle/AWS/DigitalOcean)
**Architecture:** Node.js Backend + Nginx Reverse Proxy (No Caddy)

## ✅ Prerequisites

1. **Cloud Firewall (Oracle/AWS Security Lists):** Ensure Inbound Ports **80**, **443**, and **22** are open.
2. **DNS:** Your domain (e.g., `justpri.duckdns.org`) must point to the VM's Public IP.

---

## Step 1: Install System Basics

Get the OS ready and install Nginx immediately so we own the ports.

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install curl git unzip nginx -y

# Install Node.js (LTS Version)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
```

## Step 2: Set Up Database (PostgreSQL)

Install Postgres and set up the user/password (matching your `.env` later).

```bash
sudo apt install postgresql postgresql-contrib -y

# Enter Postgres Shell
sudo -u postgres psql

# INSIDE PSQL (Change 'yourpassword' to your real one):
CREATE DATABASE printer_db;
CREATE USER printer_user WITH ENCRYPTED PASSWORD 'yourpassword';
GRANT ALL PRIVILEGES ON DATABASE printer_db TO printer_user;
ALTER DATABASE printer_db OWNER TO printer_user;
\q
```

## Step 3: Set Up the App

Clone your code and install dependencies.

```bash
# Go to home dir
cd ~

# Clone Repo
git clone https://github.com/YOUR_USERNAME/qr-wifi-printer.git
cd qr-wifi-printer/backend

# Install Backend Deps
npm install

# Setup Env File
cp .env.example .env
nano .env 
# (Paste your Firebase creds and DB connection string here)
```

## Step 4: Run with PM2 (Process Manager)

We use PM2 so the app restarts if it crashes or if the server reboots.

```bash
sudo npm install -g pm2

# Start the app
pm2 start server.js --name "justpri-backend"

# Freeze the process list for restarts
pm2 save
pm2 startup
# (Copy/Paste the command PM2 tells you to run after this)
```

## Step 5: Configure Nginx (The Critical Part)

This replaces Caddy. We tell Nginx to forward traffic to your Node app on Port 3002.

1. **Create Config:**

   ```bash
   sudo nano /etc/nginx/sites-available/justpri
   ```
2. **Paste This (Exact Config):**

   ```nginx
   server {
       # Replace with your actual domain
       server_name justpri.duckdns.org;

       location / {
           proxy_pass http://localhost:3002; # Your Node Port
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;

           # Forward real IP (Critical for logging)
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       }
   }
   ```
3. **Enable the Site:**

   ```bash
   # Link it
   sudo ln -s /etc/nginx/sites-available/justpri /etc/nginx/sites-enabled/

   # Test for typos
   sudo nginx -t

   # Reload Nginx
   sudo systemctl reload nginx
   ```

## Step 6: Setup SSL (HTTPS)

Use Certbot to automatically handle the SSL certificates.

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get Certificate
sudo certbot --nginx -d justpri.duckdns.org
```

* Select `2` (Redirect) if asked, to force HTTPS.

---

## 🎯 Verification

1. Go to `https://justpri.duckdns.org` -> Should see your frontend or backend response.
2. Go to `https://justpri.duckdns.org/api/user/profile` -> Should be secure (Lock icon).

## 🆘 Troubleshooting

* **"Connection Refused"**: Nginx isn't running (`sudo systemctl status nginx`).
* **"502 Bad Gateway"**: Node app isn't running (`pm2 status` / `pm2 logs`).
* **"Welcome to Nginx"**: You forgot to delete the default config (`sudo rm /etc/nginx/sites-enabled/default`).
