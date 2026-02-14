# Phase 3: QR Code Display - Complete Guide

## 🎯 Goal
Display a scannable QR code on the Raspberry Pi so users can easily discover and connect to the printer.

## 📋 What We're Building

**Before Phase 3:** Users need to manually type kiosk ID  
**After Phase 3:** Users scan QR code from Pi's screen/terminal → Instant connection!

## ⚡ Quick Implementation

### Option A: Terminal Display (Simplest)

The Pi generates and displays a QR code directly in the terminal using ASCII art.

**Pros:**
- ✅ No additional hardware needed
- ✅ Works over SSH
- ✅ 5 minutes to implement

**Cons:**
- User needs to see the terminal (via monitor or SSH)

### Option B: Web Server Display (Recommended)

Pi runs a mini web server on port 3000 that displays the QR code.

**Pros:**
- ✅ Clean, professional display
- ✅ Users can access from phone: http://pi-ip:3000
- ✅ Can add printer status info

**Cons:**
- Needs port 3000 accessible

### Option C: Physical Display (Advanced)

Show QR on HDMI monitor or e-ink display connected to Pi.

**Pros:**
- ✅ Professional kiosk setup
- ✅ Always visible

**Cons:**
- Requires hardware (monitor/display)

---

## 🚀 Implementation - Option A (Terminal)

### Step 1: Install Dependencies

```bash
cd pi-agent
npm install qrcode-terminal
```

### Step 2: Update Pi Agent

The updated `pi-agent/index.js` is provided. Key changes:

1. Generates QR code on startup
2. URL format: `https://your-frontend.vercel.app?kiosk_id=YOUR_KIOSK_ID`
3. Displays in terminal as ASCII QR code

### Step 3: Configure Frontend URL

```bash
# Edit pi-agent/.env or set environment variable
echo "FRONTEND_URL=https://qr-wifi-printer.vercel.app" >> .env

# Or for local testing
echo "FRONTEND_URL=http://localhost:5173" >> .env
```

### Step 4: Test

```bash
cd pi-agent
node index.js
```

You should see:
```
╔════════════════════════════════════════╗
║   DirectPrint Agent V3 Starting...     ║
║   Kiosk ID: kiosk_raspberrypi          ║
╚════════════════════════════════════════╝

📱 Scan this QR code to connect:

█████████████████████████████████
█████████████████████████████████
████ ▄▄▄▄▄ █▀█ █▄▀▄ █ ▄▄▄▄▄ ████
████ █   █ █▀▀▀█ ▄ ██ █   █ ████
████ █▄▄▄█ █▀ █▀▀█ ██ █▄▄▄█ ████
[... QR code ASCII art ...]

🔗 Or visit: https://qr-wifi-printer.vercel.app?kiosk_id=kiosk_raspberrypi

✓ Connected to Cloud Hub!
✓ Registered with cloud
🚀 Agent ready and listening for jobs!
```

---

## 🚀 Implementation - Option B (Web Server)

This is the **recommended approach** for a clean user experience.

### Step 1: Install Dependencies

```bash
cd pi-agent
npm install qrcode express
```

### Step 2: Files Provided

- `pi-agent/index-v3-qr.js` - Updated agent with QR generation
- `pi-agent/qr-server.js` - Standalone web server for QR display

### Step 3: Configure

```bash
# Add to pi-agent/.env
FRONTEND_URL=https://qr-wifi-printer.vercel.app
QR_SERVER_PORT=3000
```

### Step 4: Start Both Services

```bash
# Terminal 1: Start the print agent
cd pi-agent
node index.js

# Terminal 2: Start the QR web server
node qr-server.js
```

### Step 5: Access QR Code

Open browser: `http://YOUR_PI_IP:3000`

You'll see a beautiful page with:
- ✅ Large, scannable QR code
- ✅ Kiosk ID displayed
- ✅ "Scan to Print" instructions
- ✅ Auto-refresh if Pi restarts

---

## 🎨 Web QR Display Features

The web interface (`qr-server.js`) provides:

```
┌─────────────────────────────────────┐
│         DirectPrint Kiosk           │
│                                     │
│      [Large QR Code Image]          │
│                                     │
│      Kiosk ID: kiosk_001            │
│      Status: ● Online               │
│                                     │
│   📱 Scan to start printing         │
└─────────────────────────────────────┘
```

---

## 📋 Frontend Integration

Your frontend already supports this! Just make sure it reads the `kiosk_id` from URL params.

### Check This Code Exists:

```javascript
// In MainApp component
useEffect(() => {
  // Check URL for kiosk_id parameter
  const params = new URLSearchParams(window.location.search);
  const kioskIdFromUrl = params.get('kiosk_id');
  
  if (kioskIdFromUrl) {
    setConfig({ kiosk_id: kioskIdFromUrl });
    setStatus('SCANNED');
    addLog(`Auto-connected to kiosk: ${kioskIdFromUrl}`);
  }
}, []);
```

### Test the Flow:

1. Pi displays QR code
2. User scans QR with phone
3. Opens: `https://your-app.vercel.app?kiosk_id=kiosk_001`
4. Frontend auto-extracts kiosk_id from URL
5. Skips scanner, goes straight to "Connect" button
6. User clicks Connect → Ready to upload!

---

## 🔧 Customization

### Change QR Code Size (Terminal)

```javascript
// In pi-agent/index.js
qrcode.generate(qrUrl, { small: true });  // Smaller QR
qrcode.generate(qrUrl, { small: false }); // Larger QR (default)
```

### Change Web Server Port

```javascript
// In pi-agent/qr-server.js or .env
QR_SERVER_PORT=8080  // Use port 8080 instead
```

### Custom URL Parameters

```javascript
// Add more info to QR code URL
const qrUrl = `${FRONTEND_URL}?kiosk_id=${KIOSK_ID}&location=library&floor=2`;

// Frontend can read these:
const location = params.get('location'); // "library"
const floor = params.get('floor');       // "2"
```

---

## 🎯 Production Setup

### Auto-Start on Boot

```bash
# Create systemd service for Pi agent
sudo nano /etc/systemd/system/print-agent.service
```

```ini
[Unit]
Description=DirectPrint Agent
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/qr-wifi-printer/pi-agent
ExecStart=/usr/bin/node index.js
Restart=always
Environment=NODE_ENV=production
Environment=FRONTEND_URL=https://qr-wifi-printer.vercel.app

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
sudo systemctl enable print-agent
sudo systemctl start print-agent
sudo systemctl status print-agent
```

### QR Web Server as Service

```bash
sudo nano /etc/systemd/system/qr-display.service
```

```ini
[Unit]
Description=QR Code Display Server
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/qr-wifi-printer/pi-agent
ExecStart=/usr/bin/node qr-server.js
Restart=always
Environment=QR_SERVER_PORT=3000

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable qr-display
sudo systemctl start qr-display
```

---

## 🧪 Testing

### Test 1: Generate QR Manually

```bash
cd pi-agent
node -e "
const qrcode = require('qrcode-terminal');
qrcode.generate('https://qr-wifi-printer.vercel.app?kiosk_id=test', {small: false});
"
```

Should display a QR code in terminal.

### Test 2: Scan QR Code

1. Use phone camera app
2. Point at terminal QR code
3. Should show notification to open URL
4. Tap notification
5. Should open your frontend with kiosk_id in URL

### Test 3: Web Server

```bash
# Start web server
node qr-server.js

# In browser, go to:
http://localhost:3000

# Or from phone on same network:
http://YOUR_PI_IP:3000
```

Should see clean QR display page.

### Test 4: Frontend Auto-Connect

```bash
# Open frontend with kiosk_id parameter
http://localhost:5173?kiosk_id=test_kiosk

# Should skip scanner and go to "Connect" view
```

---

## 🎨 Optional: Physical Display Setup

### HDMI Monitor

If Pi is connected to a monitor:

```bash
# Install chromium for kiosk mode
sudo apt install chromium-browser unclutter

# Auto-start browser in fullscreen
nano ~/.config/lxsession/LXDE-pi/autostart

# Add:
@chromium-browser --kiosk --incognito http://localhost:3000
@unclutter -idle 0
```

### E-Ink Display

For e-ink displays (like Waveshare):

```bash
npm install canvas  # For image generation

# Generate QR as image
const QRCode = require('qrcode');
await QRCode.toFile('qr.png', qrUrl, {
  width: 400,
  margin: 2
});

# Then display on e-ink using specific driver
```

---

## 📊 Monitoring

### Check if QR server is running

```bash
curl http://localhost:3000
# Should return HTML with QR code

netstat -tuln | grep 3000
# Should show port 3000 LISTENING
```

### View logs

```bash
# Pi agent logs
sudo journalctl -u print-agent -f

# QR server logs
sudo journalctl -u qr-display -f
```

---

## 🚨 Troubleshooting

### QR Code Not Displaying

```bash
# Check if qrcode-terminal is installed
npm list qrcode-terminal

# Reinstall if needed
npm install qrcode-terminal --save
```

### Web Server Not Accessible

```bash
# Check if port 3000 is open
sudo ufw allow 3000
# or
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT

# Check if service is running
sudo systemctl status qr-display

# Check if something else is using port 3000
sudo lsof -i :3000
```

### Frontend Not Reading kiosk_id from URL

Check browser console for:
```javascript
console.log('URL params:', window.location.search);
// Should show: ?kiosk_id=xxx

const params = new URLSearchParams(window.location.search);
console.log('Kiosk ID:', params.get('kiosk_id'));
// Should show the kiosk_id value
```

---

## ✅ Success Checklist

- [ ] Pi displays QR code on startup
- [ ] QR code contains correct URL with kiosk_id
- [ ] Can scan QR with phone camera
- [ ] Scanning opens frontend with kiosk_id parameter
- [ ] Frontend auto-fills kiosk_id and skips scanner
- [ ] Can click "Connect" and proceed to print
- [ ] Web server (optional) accessible from phone
- [ ] Services auto-start on boot (production)

---

## 🎯 What's Next?

After Phase 3 is complete:
- ✅ Users can discover printers via QR code
- ✅ No manual typing required
- ✅ Professional kiosk experience

**Next up:**
- **Phase 4:** Pull-based authorization model
- **Phase 5:** Document conversion (DOCX, images)
- **Phase 6:** Bluetooth file transfer (optional)
- **Phase 7:** Razorpay payment integration

---

**Ready to implement?** Start with Option A (terminal display) - it's the quickest way to get QR codes working! 🚀
