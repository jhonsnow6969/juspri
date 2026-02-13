# DirectPrint - Complete Deployment Guide 🚀

## Architecture Overview

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Mobile    │──────│   Backend    │──────│ Pi Agent    │
│  (Frontend) │ HTTPS│ (Cloud Hub)  │Socket│  + CUPS     │
│  Vercel     │      │   Oracle     │  .io │ Raspberry Pi│
└─────────────┘      └──────────────┘      └─────────────┘
                            │                      │
                            │                      │
                         Payment              USB Printer
                        (Razorpay)
```

## Quick Start (Development)

### 1. Backend Setup
```bash
cd backend
npm install
node index.js
# Running on http://localhost:3001
```

### 2. Pi Agent Setup
```bash
cd pi-agent
npm install
npm run setup  # Interactive wizard
npm start
# Agent connects to backend
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
# Running on http://localhost:5173
```

### 4. Test the Flow
1. Generate QR code at https://qr.munb.me/json-qr?lang=en
   ```json
   {
     "ssid": "Test_Network",
     "ip": "localhost",
     "port": 3001
   }
   ```
2. Scan with frontend camera
3. Upload a PDF
4. See page count and pricing
5. Click mock payment
6. Watch it print!

---

## Production Deployment

### Step 1: Deploy Backend (Oracle Cloud / DigitalOcean / AWS)

#### Option A: Oracle Cloud (Free Tier)

1. **Create Instance**
   - Image: Ubuntu 22.04
   - Shape: VM.Standard.E2.1.Micro (Free)
   - Public IP: Note this down

2. **SSH into instance**
   ```bash
   ssh ubuntu@your-oracle-ip
   ```

3. **Install Node.js**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   ```

4. **Install backend**
   ```bash
   git clone https://github.com/yourusername/qr-wifi-printer.git
   cd qr-wifi-printer/backend
   npm install
   ```

5. **Setup PM2 (Process Manager)**
   ```bash
   sudo npm install -g pm2
   pm2 start index.js --name directprint-backend
   pm2 save
   pm2 startup
   ```

6. **Configure Firewall**
   ```bash
   sudo ufw allow 3001
   sudo ufw enable
   ```

7. **Setup Reverse Proxy (Caddy - Recommended)**
   ```bash
   sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
   sudo apt update
   sudo apt install caddy
   ```

   Create `/etc/caddy/Caddyfile`:
   ```
   directprint.yourdomain.com {
       reverse_proxy localhost:3001
   }
   ```

   ```bash
   sudo systemctl restart caddy
   ```

#### Option B: DigitalOcean App Platform

1. Connect GitHub repo
2. Set build command: `cd backend && npm install`
3. Set run command: `node backend/index.js`
4. Add environment variables if needed
5. Deploy!

### Step 2: Deploy Frontend (Vercel)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Production ready"
   git push origin main
   ```

2. **Import to Vercel**
   - Go to vercel.com
   - Import your GitHub repo
   - Root Directory: `frontend`
   - Framework: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`

3. **Add Environment Variable**
   - Name: `VITE_API_URL`
   - Value: `https://directprint.yourdomain.com` (your backend URL)

4. **Deploy!**

### Step 3: Setup Raspberry Pi

1. **Install Raspberry Pi OS Lite**
   - Download from raspberrypi.com/software
   - Flash to SD card
   - Enable SSH before first boot

2. **SSH into Pi**
   ```bash
   ssh pi@raspberrypi.local
   # Default password: raspberry
   ```

3. **Update System**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

4. **Install CUPS**
   ```bash
   sudo apt install cups -y
   sudo usermod -aG lpadmin pi
   sudo systemctl enable cups
   ```

5. **Connect Printer via USB**
   - Plug in printer
   - Check: `lpstat -p`

6. **Install Node.js**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   ```

7. **Clone & Setup Agent**
   ```bash
   cd ~
   git clone https://github.com/yourusername/qr-wifi-printer.git
   cd qr-wifi-printer/pi-agent
   npm install
   ```

8. **Configure Agent**
   Create `.env`:
   ```env
   CLOUD_URL=https://directprint.yourdomain.com
   PRINTER_NAME=auto
   ```

9. **Run as Service**
   ```bash
   sudo nano /etc/systemd/system/directprint-agent.service
   ```

   Paste:
   ```ini
   [Unit]
   Description=DirectPrint Agent
   After=network.target cups.service

   [Service]
   Type=simple
   User=pi
   WorkingDirectory=/home/pi/qr-wifi-printer/pi-agent
   ExecStart=/usr/bin/node index.js
   Restart=always
   RestartSec=10
   Environment=NODE_ENV=production

   [Install]
   WantedBy=multi-user.target
   ```

   ```bash
   sudo systemctl enable directprint-agent
   sudo systemctl start directprint-agent
   sudo systemctl status directprint-agent
   ```

### Step 4: Generate Production QR Code

Your printer's QR code should contain:
```json
{
  "ssid": "YourWiFiName",
  "ip": "directprint.yourdomain.com",
  "port": 443
}
```

Generate at: https://qr.munb.me/json-qr?lang=en

Print this QR code and stick it on/near your printer!

---

## Environment Variables

### Backend (.env)
```env
NODE_ENV=production
RAZORPAY_KEY_ID=rzp_live_xxxxxx     # When payment is enabled
RAZORPAY_KEY_SECRET=xxxxxxxx         # When payment is enabled
RAZORPAY_WEBHOOK_SECRET=xxxxxxxx     # Optional
```

### Frontend (.env.production)
```env
VITE_API_URL=https://directprint.yourdomain.com
```

### Pi Agent (.env)
```env
CLOUD_URL=https://directprint.yourdomain.com
PRINTER_NAME=auto
```

---

## Monitoring & Maintenance

### Backend Logs
```bash
# If using PM2
pm2 logs directprint-backend

# If using systemd
sudo journalctl -u directprint-backend -f
```

### Pi Agent Logs
```bash
sudo journalctl -u directprint-agent -f
```

### Health Checks

**Backend Status:**
```bash
curl https://directprint.yourdomain.com/api/status
```

**Expected Response:**
```json
{
  "server": "online",
  "printer": {
    "connected": true,
    "hostname": "raspberrypi",
    "lastSeen": "2025-02-14T10:30:00.000Z"
  }
}
```

---

## Security Checklist

- [ ] HTTPS enabled on backend (Caddy handles this)
- [ ] CORS restricted to your frontend domain
- [ ] Razorpay keys in environment variables (not in code)
- [ ] Pi agent only accessible on local network
- [ ] Regular OS updates on Pi and server
- [ ] Firewall rules configured
- [ ] SSH key-based auth (disable password)

---

## Backup Strategy

### Database (If you add one later)
```bash
# Daily backup cron
0 2 * * * pg_dump directprint > /backups/db_$(date +\%Y\%m\%d).sql
```

### Configuration Files
```bash
# Backup important configs
cp /etc/caddy/Caddyfile ~/backups/
cp ~/qr-wifi-printer/backend/.env ~/backups/
```

---

## Troubleshooting

### "Printer Agent Offline"
1. Check Pi agent is running: `sudo systemctl status directprint-agent`
2. Check network connectivity from Pi
3. Verify CLOUD_URL is correct in Pi's .env
4. Check backend logs for connection attempts

### "Page count failed"
1. Ensure file is actually a PDF
2. Check backend has pdf-lib installed
3. Try a different PDF file
4. Check backend disk space

### "Print failed"
1. Verify CUPS is running: `sudo systemctl status cups`
2. Check printer is online: `lpstat -p`
3. Test manual print: `echo "test" | lp`
4. Check printer USB connection
5. Review CUPS logs: `/var/log/cups/error_log`

### "Payment not working"
1. Check Razorpay keys in backend .env
2. Verify payment script loaded in frontend
3. Check browser console for errors
4. Ensure HTTPS is enabled (Razorpay requires it)

---

## Performance Optimization

### Backend
- Use Redis for session storage (if you add auth)
- Enable gzip compression
- Set up CloudFlare CDN

### Frontend
- Vercel handles optimization automatically
- Consider code splitting for large apps
- Optimize images in QR scanner

### Pi Agent
- Runs fine on Pi Zero W or higher
- ~50MB RAM usage
- Minimal CPU when idle

---

## Cost Breakdown

### Free Tier (Development/Small Scale)
- **Frontend**: Vercel (Free)
- **Backend**: Oracle Cloud (Free tier)
- **Domain**: Freenom/DuckDNS (Free) or Namecheap (~$10/year)
- **Razorpay**: Pay per transaction (2%)
- **Total**: ~₹0-800/year

### Paid Tier (Production)
- **Frontend**: Vercel Pro (~$20/month)
- **Backend**: DigitalOcean Droplet (~$6/month)
- **Domain**: ~$10/year
- **SSL**: Free (Let's Encrypt via Caddy)
- **Total**: ~$25-30/month

---

## Scaling Considerations

### Multiple Printers
Current architecture supports multiple Pi agents! Each registers separately.

### Load Balancing
If you get lots of traffic:
1. Use Nginx/HAProxy
2. Run multiple backend instances
3. Use Redis for session sharing

### Database
For payment records and analytics:
- PostgreSQL (recommended)
- MongoDB (if you prefer NoSQL)
- Supabase (managed Postgres)

---

## Next Features to Add

- [ ] User accounts & auth
- [ ] Print history dashboard
- [ ] Email receipts
- [ ] Admin panel for printer stats
- [ ] Multiple printer support UI
- [ ] Color vs B&W pricing
- [ ] Duplex printing options
- [ ] Print job queue management
- [ ] Analytics dashboard

---

## Support & Community

- **Issues**: GitHub Issues
- **Docs**: This README + individual component READMEs
- **Updates**: Star the repo for notifications

---

**Built with 💙 for makers and entrepreneurs**

Last updated: February 2025
