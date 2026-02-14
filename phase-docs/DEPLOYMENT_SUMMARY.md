# 🚀 DirectPrint Production Deployment - Complete Guide

## 📋 Overview

This guide covers deploying your complete DirectPrint system to production:
- ✅ Frontend on Vercel
- ✅ Backend on Oracle VM with DuckDNS
- ✅ Pi Agent with universal installer

## 🎯 Deployment Order

### Phase 1: Backend (Oracle VM) - 30 minutes
1. Setup PostgreSQL database
2. Deploy Node.js backend
3. Configure DuckDNS domain
4. Get SSL certificate
5. Configure Nginx reverse proxy
6. Create systemd service

**Guide:** `ORACLE_VM_DEPLOYMENT_GUIDE.md`

### Phase 2: Frontend (Vercel) - 5 minutes
1. Push code to GitHub
2. Connect to Vercel
3. Configure environment variables
4. Auto-deploy on push

**Guide:** `VERCEL_DEPLOYMENT_GUIDE.md`

### Phase 3: Pi Agent - 10 minutes
1. Run interactive setup script
2. Install all dependencies automatically
3. Configure kiosk settings
4. Enable auto-start service

**Guide:** `setup-pi-agent.sh` (just run it!)

## 🔧 Quick Start Commands

### Oracle VM Backend
```bash
# SSH to VM
ssh ubuntu@YOUR_VM_IP

# Run these commands (see full guide for details)
sudo apt update && sudo apt upgrade -y
sudo apt install -y postgresql nginx certbot nodejs npm

# Clone repo
cd ~
git clone https://github.com/YOUR_USERNAME/qr-wifi-printer.git
cd qr-wifi-printer/backend

# Setup (follow ORACLE_VM_DEPLOYMENT_GUIDE.md)
npm install
# ... configure .env, database, SSL, etc.
```

### Vercel Frontend
```bash
# On your local machine
cd frontend

# Push to GitHub
git init
git add .
git commit -m "Initial commit"
git push

# Then go to vercel.com and import your repo
# Follow VERCEL_DEPLOYMENT_GUIDE.md for env vars
```

### Pi Agent
```bash
# On your Raspberry Pi / Arch Linux machine
cd ~
wget https://raw.githubusercontent.com/YOUR_USERNAME/qr-wifi-printer/main/setup-pi-agent.sh
chmod +x setup-pi-agent.sh
./setup-pi-agent.sh

# Follow the interactive prompts!
```

## 🌐 Your Production URLs

After deployment:
- **Frontend:** `https://your-app.vercel.app`
- **Backend:** `https://justpri.duckdns.org`
- **API Status:** `https://justpri.duckdns.org/api/status`

## ⚠️ About Phase 6 (Bluetooth)

**RECOMMENDATION: Skip Bluetooth for now.**

Why?
- Only ~30% of users can use it (Chrome/Edge only)
- iOS Safari: NOT supported (40% of mobile users)
- Complex setup for limited benefit
- WiFi upload works for 100% of users

**Your current setup is better:**
- QR code scan → WiFi upload → Works everywhere ✅

See `PHASE_6_README.md` for full explanation, but honestly, not worth it.

## ✅ Production Readiness Checklist

### Backend (Oracle VM)
- [ ] PostgreSQL database created
- [ ] Backend code deployed
- [ ] .env file configured with production values
- [ ] Firebase service account uploaded
- [ ] Database schema applied
- [ ] SSL certificate obtained (Let's Encrypt)
- [ ] Nginx configured as reverse proxy
- [ ] systemd service created and enabled
- [ ] Firewall rules configured (ports 80, 443)
- [ ] Can access https://justpri.duckdns.org/api/status
- [ ] Logs accessible via journalctl

### Frontend (Vercel)
- [ ] Code pushed to GitHub
- [ ] Vercel project created and deployed
- [ ] Environment variables configured
  - [ ] VITE_API_URL=https://justpri.duckdns.org
  - [ ] VITE_FIREBASE_* (all Firebase config)
- [ ] Custom domain configured (optional)
- [ ] Can access https://your-app.vercel.app
- [ ] Login works (Firebase Auth)
- [ ] File upload works (connects to backend)
- [ ] No console errors

### Pi Agent
- [ ] All dependencies installed (CUPS, LibreOffice, ImageMagick)
- [ ] Pi agent code deployed
- [ ] .env file configured
  - [ ] CLOUD_URL=https://justpri.duckdns.org
  - [ ] FRONTEND_URL=https://your-app.vercel.app
  - [ ] KIOSK_ID=unique-identifier
- [ ] systemd service created and enabled
- [ ] Printer detected (lpstat -p)
- [ ] Can see QR code in logs on startup
- [ ] Service auto-starts on boot
- [ ] Polling backend every 5 seconds

## 🧪 End-to-End Testing

### Test 1: Basic Connectivity
```bash
# Test backend
curl https://justpri.duckdns.org/api/status

# Should return:
# {"server":"online","database":"connected","model":"pull-based",...}
```

### Test 2: Complete Flow
1. Open frontend: `https://your-app.vercel.app`
2. Should redirect to login page
3. Click "Sign in with Google"
4. Login with your Google account
5. Scan QR code (or enter kiosk ID manually)
6. Upload a PDF file
7. Should show: "3 pages × ₹3/page = ₹9"
8. Click "Pay & Print" (mock payment)
9. Check Pi agent logs:
   ```bash
   sudo journalctl -u directprint-agent -f
   ```
10. Should see:
    ```
    [Poll] New job received: job_xxx
    🖨️ Printing Job job_xxx
    ✓ Job completed
    ```
11. Document prints!

### Test 3: Multi-Format Support
- Upload .docx file → Should convert and print
- Upload .txt file → Should convert and print
- Upload .png image → Should convert and print
- Upload .pdf file → Should print directly (no conversion)

### Test 4: Different Formats
Test from different devices:
- Chrome on Desktop ✅
- Chrome on Android ✅
- Safari on iPhone ✅
- Edge on Desktop ✅

## 🔧 Maintenance Commands

### Backend (Oracle VM)
```bash
# View logs
sudo journalctl -u directprint-backend -f

# Restart service
sudo systemctl restart directprint-backend

# Update code
cd ~/qr-wifi-printer
git pull
cd backend
npm install
sudo systemctl restart directprint-backend

# Check status
sudo systemctl status directprint-backend
```

### Frontend (Vercel)
```bash
# Local changes
git add .
git commit -m "Update feature"
git push

# Vercel auto-deploys!
# Check deployment: https://vercel.com/your-project
```

### Pi Agent
```bash
# View logs
sudo journalctl -u directprint-agent -f

# Restart service
sudo systemctl restart directprint-agent

# Update code
cd ~/qr-wifi-printer
git pull
cd pi-agent
npm install
sudo systemctl restart directprint-agent

# Check status
sudo systemctl status directprint-agent
```

## 🚨 Common Production Issues

### Issue 1: Frontend Can't Connect to Backend
```bash
# Check CORS in backend/.env
ALLOWED_ORIGINS=https://your-app.vercel.app,https://justpri.duckdns.org

# Restart backend
sudo systemctl restart directprint-backend
```

### Issue 2: Pi Can't Connect to Backend
```bash
# Check backend URL in pi-agent/.env
CLOUD_URL=https://justpri.duckdns.org

# Test connection
curl https://justpri.duckdns.org/api/status

# Check firewall
sudo ufw status
```

### Issue 3: SSL Certificate Expired
```bash
# Renew certificate
sudo certbot renew

# Restart Nginx
sudo systemctl restart nginx
```

### Issue 4: Jobs Not Printing
```bash
# Check Pi agent logs
sudo journalctl -u directprint-agent -f

# Check CUPS status
sudo systemctl status cups

# List printers
lpstat -p

# Check if printer is ready
lpstat -v
```

## 📊 Monitoring

### Backend Monitoring
```bash
# Real-time logs
sudo journalctl -u directprint-backend -f

# Resource usage
htop

# Disk space
df -h

# Database connections
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"
```

### Frontend Monitoring
- Vercel dashboard shows:
  - Build status
  - Deployment history
  - Analytics (page views)
  - Performance metrics

### Pi Agent Monitoring
```bash
# Real-time logs
sudo journalctl -u directprint-agent -f

# System resources
htop

# Network connectivity
ping -c 3 justpri.duckdns.org
```

## 🎯 Performance Optimization

### Backend
- Enable gzip in Nginx ✅ (already in config)
- Use connection pooling ✅ (already using pg.Pool)
- Set proper cache headers
- Monitor slow queries

### Frontend
- Code splitting ✅ (Vite does this)
- Lazy load routes
- Optimize images
- Use CDN (Vercel Edge Network) ✅

### Pi Agent
- Poll interval: 5 seconds (balance between speed and load)
- Cleanup old files regularly ✅ (already implemented)
- Monitor memory usage
- Restart daily if needed (cron job)

## 🔐 Security Checklist

- [ ] SSL enabled (HTTPS) on backend
- [ ] Firebase Auth configured
- [ ] Environment variables not in git
- [ ] Database password is strong
- [ ] SSH key-based auth only (disable password)
- [ ] Firewall configured (UFW/iptables)
- [ ] Regular backups of database
- [ ] Fail2ban installed (optional)
- [ ] OS auto-updates enabled

## 💾 Backup Strategy

### Database Backup
```bash
# Manual backup
pg_dump -U printuser -d printkiosk > backup_$(date +%Y%m%d).sql

# Restore
psql -U printuser -d printkiosk < backup_20240214.sql

# Automated daily backup (cron)
0 2 * * * pg_dump -U printuser -d printkiosk > /home/ubuntu/backups/db_$(date +\%Y\%m\%d).sql
```

### Files Backup
```bash
# Backend code
cd ~
tar -czf backend_backup.tar.gz qr-wifi-printer/backend/

# Uploaded files (if needed)
tar -czf uploads_backup.tar.gz qr-wifi-printer/backend/uploads/
```

## 🚀 You're Production Ready!

After completing all three deployments:
1. ✅ Backend running on Oracle VM with SSL
2. ✅ Frontend deployed on Vercel
3. ✅ Pi agent running with auto-start

**Your system is now:**
- Secure (HTTPS, Firebase Auth)
- Scalable (Vercel CDN, Oracle VM)
- Reliable (systemd auto-restart, error handling)
- Production-grade (logging, monitoring, backups)

## 📚 Documentation Files

1. **ORACLE_VM_DEPLOYMENT_GUIDE.md** - Backend deployment
2. **VERCEL_DEPLOYMENT_GUIDE.md** - Frontend deployment
3. **setup-pi-agent.sh** - Automated Pi setup
4. **PHASE_6_README.md** - Bluetooth (skip recommended)
5. **This file** - Complete overview

## 🎯 Next Steps

1. **Test thoroughly** in production
2. **Monitor for 24-48 hours** to catch any issues
3. **Phase 7** (Razorpay) only after everything works flawlessly
4. **Document any custom changes** you make

---

**Need Help?** Check the specific guides for detailed instructions!

**Ready for Production?** Follow the checklist above! 🚀
