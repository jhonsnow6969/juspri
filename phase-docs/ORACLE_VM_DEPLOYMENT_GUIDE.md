# Oracle VM Backend Deployment - Complete Guide

## 🎯 Goal
Deploy your DirectPrint backend to Oracle Cloud VM with DuckDNS domain and SSL certificate.

## 📋 What You'll Set Up

- ✅ Oracle Cloud VM (Ubuntu)
- ✅ DuckDNS domain (`justpri.duckdns.org`)
- ✅ Nginx reverse proxy
- ✅ SSL certificate (Let's Encrypt)
- ✅ PostgreSQL database
- ✅ Node.js backend
- ✅ Auto-start services

## ⚡ Quick Start (30 minutes)

### Step 1: Oracle VM Setup

You already have:
- Oracle VM running
- DuckDNS domain: `justpri.duckdns.org`
- SSH access

```bash
# SSH into your VM
ssh ubuntu@<YOUR_VM_IP>
```

### Step 2: Initial System Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essentials
sudo apt install -y git curl wget nginx certbot python3-certbot-nginx

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version  # Should be v18.x
npm --version
```

### Step 3: Install PostgreSQL

```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Start and enable
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Check status
sudo systemctl status postgresql
```

### Step 4: Configure PostgreSQL

```bash
# Switch to postgres user
sudo -u postgres psql

# Run these commands:
CREATE DATABASE printkiosk;
CREATE USER printuser WITH PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE printkiosk TO printuser;
\q
```

### Step 5: Clone and Setup Backend

```bash
# Clone your repo
cd /home/ubuntu
git clone https://github.com/YOUR_USERNAME/qr-wifi-printer.git
cd qr-wifi-printer/backend

# Install dependencies
npm install

# Create production .env
nano .env
```

### Step 6: Production .env Configuration

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=printkiosk
DB_USER=printuser
DB_PASSWORD=your_secure_password_here

# Server
PORT=3001
NODE_ENV=production

# Security
SECRET_KEY=your_very_long_random_secret_key_change_this

# CORS - Add your Vercel domain
ALLOWED_ORIGINS=https://your-app.vercel.app,https://justpri.duckdns.org

# Firebase
FIREBASE_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json
```

### Step 7: Upload Firebase Service Account

```bash
# On your local machine:
scp firebase-service-account.json ubuntu@<YOUR_VM_IP>:/home/ubuntu/qr-wifi-printer/backend/config/

# On VM, verify:
ls -la /home/ubuntu/qr-wifi-printer/backend/config/
```

### Step 8: Initialize Database

```bash
cd /home/ubuntu/qr-wifi-printer/backend

# Run schema
psql -U printuser -d printkiosk -h localhost < schema.sql
# Enter password when prompted

# Test connection
node -e "const db = require('./db'); db.testConnection();"
```

## 🌐 DuckDNS Setup

### Step 9: Update DuckDNS IP

Your VM's public IP needs to point to DuckDNS:

```bash
# Get your VM's public IP
curl ifconfig.me

# Update DuckDNS (do this from your browser)
# Go to: https://www.duckdns.org/update?domains=justpri&token=YOUR_TOKEN&ip=YOUR_VM_IP
```

Or automate it on the VM:

```bash
# Create update script
nano /home/ubuntu/duckdns-update.sh
```

```bash
#!/bin/bash
echo url="https://www.duckdns.org/update?domains=justpri&token=YOUR_DUCKDNS_TOKEN&ip=" | curl -k -o /home/ubuntu/duckdns.log -K -
```

```bash
# Make executable
chmod +x /home/ubuntu/duckdns-update.sh

# Test
./duckdns-update.sh
cat duckdns.log  # Should say "OK"

# Auto-update every 5 minutes
crontab -e
# Add this line:
*/5 * * * * /home/ubuntu/duckdns-update.sh >/dev/null 2>&1
```

## 🔒 SSL Certificate (HTTPS)

### Step 10: Get Let's Encrypt Certificate

```bash
# Stop Nginx temporarily
sudo systemctl stop nginx

# Get certificate
sudo certbot certonly --standalone -d justpri.duckdns.org

# You'll be asked for:
# - Email address
# - Agree to terms
# - Share email (optional)

# Certificate will be saved to:
# /etc/letsencrypt/live/justpri.duckdns.org/fullchain.pem
# /etc/letsencrypt/live/justpri.duckdns.org/privkey.pem
```

### Step 11: Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/directprint
```

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name justpri.duckdns.org;
    return 301 https://$server_name$request_uri;
}

# HTTPS Server
server {
    listen 443 ssl http2;
    server_name justpri.duckdns.org;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/justpri.duckdns.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/justpri.duckdns.org/privkey.pem;
    
    # SSL Security
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Proxy to Node.js backend
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        
        # WebSocket support (for Socket.IO)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Headers
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # API routes
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.IO
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/directprint /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Step 12: Auto-Renew SSL Certificate

```bash
# Certbot auto-renews via systemd timer
sudo systemctl status certbot.timer

# Test renewal
sudo certbot renew --dry-run
```

## 🚀 Backend as System Service

### Step 13: Create systemd Service

```bash
sudo nano /etc/systemd/system/directprint-backend.service
```

```ini
[Unit]
Description=DirectPrint Backend Server
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/qr-wifi-printer/backend
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10

# Environment
Environment=NODE_ENV=production

# Logging
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=directprint-backend

[Install]
WantedBy=multi-user.target
```

```bash
# Reload systemd
sudo systemctl daemon-reload

# Start service
sudo systemctl start directprint-backend

# Enable auto-start
sudo systemctl enable directprint-backend

# Check status
sudo systemctl status directprint-backend

# View logs
sudo journalctl -u directprint-backend -f
```

## 🔥 Oracle Cloud Firewall

### Step 14: Configure Ingress Rules

In Oracle Cloud Console:

1. Go to your VM instance
2. Click on Virtual Cloud Network (VCN)
3. Click on Security Lists
4. Click "Add Ingress Rules"

Add these rules:

```
# HTTP (will redirect to HTTPS)
Source: 0.0.0.0/0
Protocol: TCP
Destination Port: 80

# HTTPS
Source: 0.0.0.0/0
Protocol: TCP
Destination Port: 443

# Optional: SSH (if not already there)
Source: YOUR_IP/32
Protocol: TCP
Destination Port: 22
```

### Step 15: OS Firewall (iptables)

```bash
# Allow HTTP and HTTPS
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT

# Save rules
sudo netfilter-persistent save

# Or if using UFW:
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status
```

## ✅ Testing

### Test 1: Check Backend

```bash
# On VM
curl http://localhost:3001/api/status
# Should return JSON

# From outside
curl https://justpri.duckdns.org/api/status
# Should return JSON
```

### Test 2: Check SSL

```bash
curl -I https://justpri.duckdns.org
# Should show: HTTP/2 200
```

### Test 3: WebSocket (Socket.IO)

```bash
# Check Socket.IO endpoint
curl https://justpri.duckdns.org/socket.io/?EIO=4&transport=polling
# Should return gibberish (binary data) - that's good!
```

### Test 4: Full Flow

1. Open frontend: `https://your-app.vercel.app`
2. Login with Google
3. Upload file
4. Should work end-to-end!

## 📊 Monitoring

### View Logs

```bash
# Backend logs
sudo journalctl -u directprint-backend -f

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log

# PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

### Check Service Status

```bash
# All services
sudo systemctl status directprint-backend
sudo systemctl status nginx
sudo systemctl status postgresql

# Resource usage
htop

# Disk space
df -h

# Memory
free -h
```

## 🔄 Deployment Workflow

### Update Backend

```bash
# SSH to VM
ssh ubuntu@<YOUR_VM_IP>

# Pull latest changes
cd /home/ubuntu/qr-wifi-printer
git pull

# Install any new dependencies
cd backend
npm install

# Restart service
sudo systemctl restart directprint-backend

# Check logs
sudo journalctl -u directprint-backend -f
```

## 🚨 Troubleshooting

### Issue 1: Backend Won't Start

```bash
# Check logs
sudo journalctl -u directprint-backend -xe

# Common issues:
# - Missing .env file
# - Wrong database credentials
# - Missing Firebase service account
# - Port 3001 already in use
```

### Issue 2: Can't Connect from Frontend

```bash
# Check CORS
# Make sure backend .env has:
ALLOWED_ORIGINS=https://your-app.vercel.app

# Restart backend
sudo systemctl restart directprint-backend
```

### Issue 3: SSL Not Working

```bash
# Check certificate
sudo certbot certificates

# Renew if expired
sudo certbot renew

# Check Nginx config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Issue 4: Database Connection Failed

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U printuser -d printkiosk -h localhost

# Check credentials in .env match database
```

## 🔐 Security Hardening

### Change Default Ports (Optional)

```bash
# Change SSH port
sudo nano /etc/ssh/sshd_config
# Change Port 22 to Port 2222

sudo systemctl restart sshd

# Update firewall
sudo ufw allow 2222/tcp
sudo ufw delete allow 22/tcp
```

### Fail2Ban (Block Brute Force)

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### Auto-Updates

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

## ✅ Production Checklist

- [ ] VM accessible via SSH
- [ ] DuckDNS pointing to VM IP
- [ ] PostgreSQL installed and database created
- [ ] Backend code deployed
- [ ] .env file configured
- [ ] Firebase service account uploaded
- [ ] Database schema applied
- [ ] SSL certificate obtained
- [ ] Nginx configured
- [ ] Firewall rules configured
- [ ] Backend service running
- [ ] Can access https://justpri.duckdns.org
- [ ] Frontend can connect to backend
- [ ] Logs accessible

## 🎯 Your URLs

After completion:

- **Backend API:** `https://justpri.duckdns.org`
- **Frontend:** `https://your-app.vercel.app`
- **Status Check:** `https://justpri.duckdns.org/api/status`

## 🚀 You're Production Ready!

Your backend is now:
- ✅ Running on Oracle VM
- ✅ Accessible via DuckDNS domain
- ✅ Secured with SSL
- ✅ Auto-starts on boot
- ✅ Production-ready

Next: Setup your Pi with the universal installer! 🎯
