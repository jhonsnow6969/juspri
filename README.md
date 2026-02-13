# DirectPrint 🖨️

**Scan. Upload. Pay. Print.** The future of public printing is here.

A QR-code based cloud printing system that lets users print documents from their phones to any networked printer. Perfect for cafes, libraries, co-working spaces, and print shops.

---

## 🎯 What is DirectPrint?

DirectPrint is a complete printing solution with three components:

1. **Mobile Frontend** - Users scan QR code, upload PDF, see pricing, pay, and print
2. **Cloud Backend** - Handles connections, page counting, payment verification, job routing
3. **Pi Agent** - Runs on Raspberry Pi (or any laptop) to control the actual printer via CUPS

### How it Works

```
📱 User scans QR code on printer
    ↓
📄 Uploads PDF from phone
    ↓
💰 System counts pages (e.g., 5 pages × ₹3 = ₹15)
    ↓
💳 User pays via Razorpay
    ↓
✅ Payment verified
    ↓
🖨️ Job sent to Pi Agent
    ↓
📄 Document prints!
```

---

## ✨ Features

### For Users
- ✅ No app installation needed
- ✅ Works on any phone with camera
- ✅ See exact price before paying
- ✅ UPI/Cards/Net Banking accepted
- ✅ Instant printing
- ✅ Receipt via email (coming soon)

### For Owners
- ✅ Works with any USB printer
- ✅ Runs on cheap hardware (Pi Zero W works!)
- ✅ Cloud-based - access from anywhere
- ✅ Auto page counting
- ✅ Configurable pricing
- ✅ Payment integration built-in
- ✅ Print logs & analytics (coming soon)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ installed
- A USB printer
- CUPS installed (for Pi agent)

### 1. Clone the Repo
```bash
git clone https://github.com/yourusername/qr-wifi-printer.git
cd qr-wifi-printer
```

### 2. Start Backend
```bash
cd backend
npm install
node index.js
# Running on http://localhost:3001
```

### 3. Start Frontend
```bash
cd frontend
npm install
npm run dev
# Running on http://localhost:5173
```

### 4. Setup Pi Agent
```bash
cd pi-agent
npm install
npm run setup  # Interactive wizard
npm start
```

### 5. Test It!
1. Generate test QR code: https://qr.munb.me/json-qr?lang=en
   ```json
   {
     "ssid": "Test",
     "ip": "localhost",
     "port": 3001
   }
   ```
2. Open http://localhost:5173
3. Scan QR code with camera
4. Upload a PDF
5. See the price
6. Click "Pay & Print" (currently mocked)
7. Watch it print! 🎉

---

## 📁 Project Structure

```
qr-wifi-printer/
├── backend/              # Cloud server (Node.js + Socket.io)
│   ├── index.js         # Main server code
│   ├── package.json
│   └── uploads/         # Temp file storage
│
├── frontend/            # Mobile UI (React + Vite)
│   ├── src/
│   │   ├── App.jsx     # Main app logic
│   │   ├── components/ # UI components
│   │   └── lib/        # Utilities
│   └── package.json
│
├── pi-agent/            # Printer agent (Node.js + CUPS)
│   ├── index.js        # Agent logic
│   ├── setup-wizard.js # Interactive setup
│   ├── package.json
│   └── print-queue/    # Temp print files
│
└── docs/               # Documentation
    ├── DEPLOYMENT_GUIDE.md
    ├── RAZORPAY_INTEGRATION.md
    └── PI_AGENT_README.md
```

---

## 💰 Pricing System

Default: **₹3 per page**

### How it Works
1. User uploads PDF
2. Backend uses `pdf-lib` to count pages
3. Price calculated: `pages × ₹3`
4. Shown to user before payment
5. After payment, job is executed

### Customizing Pricing
Edit `backend/index.js`:
```javascript
// Simple pricing
const pricePerPage = 5; // ₹5 per page

// Or bulk discounts
function calculatePrice(pages) {
  if (pages <= 5) return pages * 3;
  if (pages <= 20) return pages * 2.5;
  return pages * 2;
}
```

---

## 🔐 Payment Integration

Currently using **mock payments** for development.

To enable real payments:
1. Sign up at https://razorpay.com
2. Get API keys (test mode first!)
3. Follow [RAZORPAY_INTEGRATION.md](./RAZORPAY_INTEGRATION.md)
4. Update frontend payment handler
5. Test with test cards
6. Switch to live keys for production

**Payment Flow:**
```
User clicks Pay → Create Razorpay Order → Open Checkout Modal → 
User Pays → Razorpay Returns → Verify Signature → Execute Print
```

---

## 🖨️ Supported Printers

**Any USB printer that works with CUPS!**

### Tested With
- ✅ HP LaserJet series
- ✅ Canon Pixma series
- ✅ Brother HL-L series
- ✅ Epson EcoTank
- ✅ Generic thermal printers

### To Check Compatibility
```bash
lpstat -p  # Should list your printer
```

If your printer shows up, it will work! 🎉

---

## 🔧 Configuration

### Backend (.env)
```env
NODE_ENV=production
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
```

### Frontend (.env.local)
```env
VITE_API_URL=http://localhost:3001
```

### Pi Agent (.env)
```env
CLOUD_URL=http://localhost:3001
PRINTER_NAME=auto
```

---

## 🌐 Deployment

### Free Tier Option
- **Frontend**: Vercel (Free)
- **Backend**: Oracle Cloud (Free tier)
- **Domain**: DuckDNS (Free)
- **Cost**: ₹0/month + transaction fees

### Production Option
- **Frontend**: Vercel Pro ($20/mo)
- **Backend**: DigitalOcean ($6/mo)
- **Domain**: Namecheap ($10/year)
- **Cost**: ~$27/month

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for step-by-step instructions.

---

## 🐛 Troubleshooting

### "Printer Agent Offline"
```bash
# Check if agent is running
ps aux | grep "pi-agent"

# Check logs
sudo journalctl -u directprint-agent -f

# Restart agent
sudo systemctl restart directprint-agent
```

### "Page count failed"
- Ensure file is a valid PDF
- Check backend has `pdf-lib` installed
- Try a different PDF

### "Print job failed"
```bash
# Check CUPS status
sudo systemctl status cups

# Check printer
lpstat -p

# View CUPS logs
sudo tail -f /var/log/cups/error_log
```

### Quick System Test
```bash
chmod +x test-system.sh
./test-system.sh
```

---

## 📊 Tech Stack

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **UI**: Tailwind CSS + shadcn/ui
- **QR Scanner**: @yudiel/react-qr-scanner
- **HTTP**: Axios

### Backend
- **Runtime**: Node.js
- **Framework**: Express
- **WebSockets**: Socket.io
- **File Upload**: Multer
- **PDF Processing**: pdf-lib
- **Payment**: Razorpay

### Pi Agent
- **Printing**: CUPS (lp command)
- **Communication**: Socket.io-client
- **PDF**: pdf-lib (for page counting)

---

## 🛣️ Roadmap

### Phase 1: Core Features ✅
- [x] QR code scanning
- [x] PDF upload
- [x] Page counting
- [x] Mock payment
- [x] CUPS integration
- [x] Cloud backend

### Phase 2: Payment (In Progress)
- [ ] Razorpay integration
- [ ] Payment verification
- [ ] Refund handling
- [ ] Receipt generation

### Phase 3: Enhancement
- [ ] User accounts
- [ ] Print history
- [ ] Admin dashboard
- [ ] Color vs B&W pricing
- [ ] Duplex printing options
- [ ] Multiple file formats
- [ ] Email notifications

### Phase 4: Scale
- [ ] Multi-printer support
- [ ] Load balancing
- [ ] Analytics dashboard
- [ ] Mobile apps (iOS/Android)
- [ ] Franchise management

---
