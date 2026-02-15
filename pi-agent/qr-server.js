// pi-agent/qr-server.js - Standalone QR Code Web Display
require('dotenv').config();
const express = require('express');
const QRCode = require('qrcode');
const os = require('os');

const app = express();
const PORT = process.env.QR_SERVER_PORT || 8000;
const KIOSK_ID = process.env.KIOSK_ID || `kiosk_${os.hostname()}`;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://qr-wifi-printer.vercel.app';
const LOCATION = process.env.LOCATION || 'Unknown Location';
const FLOOR = process.env.FLOOR || 'N/A';

// Generate QR code URL
const qrUrl = `${FRONTEND_URL}?kiosk_id=${KIOSK_ID}&location=${encodeURIComponent(LOCATION)}&floor=${encodeURIComponent(FLOOR)}`;

// Serve QR code page
app.get('/', async (req, res) => {
  try {
    // Generate QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // HTML page with QR code
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>JusPri - ${KIOSK_ID}</title>
        <style>
            :root {
                --background: #000000;
                --card: #111111;
                --foreground: #ffffff;
                --muted-foreground: #a3a3a3;
                --border: #27272a;
                --success: #10b981;
                --success-bg: rgba(16, 185, 129, 0.1);
                --radius: 2rem;
                /* Fluid font base */
                font-size: clamp(12px, 2vh, 18px);
            }
    
            * { margin: 0; padding: 0; box-sizing: border-box; }
    
            body {
                font-family: ui-sans-serif, system-ui, sans-serif;
                background-color: var(--background);
                color: var(--foreground);
                height: 100vh;
                width: 100vw;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden; /* Prevents scrollbars on kiosks */
            }
    
            .container {
                background-color: var(--card);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                padding: 5vh 5vw;
                text-align: center;
                /* Responsive Widths */
                width: 90vw;
                max-width: 600px;
                max-height: 95vh;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: space-around; /* Spreads content evenly */
                transition: all 0.3s ease;
            }
    
            .header h1 {
                font-size: 2rem;
                font-weight: 700;
                margin-bottom: 0.5rem;
            }
    
            .qr-wrapper {
                background: #ffffff;
                padding: 1.5rem;
                border-radius: 1.5rem;
                /* Scales QR based on the smaller of height or width */
                width: min(50vw, 40vh);
                height: min(50vw, 40vh);
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 1rem 0;
            }
    
            .qr-code {
                width: 100%;
                height: 100%;
                object-fit: contain;
            }
    
            .info-card {
                background-color: rgba(255, 255, 255, 0.03);
                border: 1px solid var(--border);
                border-radius: 1rem;
                padding: 1rem;
                width: 100%;
            }
    
            .kiosk-id-value {
                font-family: ui-monospace, monospace;
                font-size: 1.5rem;
                font-weight: 800;
                color: var(--foreground);
            }
    
            .status-badge {
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                background-color: var(--success-bg);
                color: var(--success);
                padding: 0.5rem 1rem;
                border-radius: 2rem;
                font-size: 0.8rem;
                margin-top: 0.5rem;
            }
    
            .status-dot {
                width: 8px;
                height: 8px;
                background-color: var(--success);
                border-radius: 50%;
                animation: pulse 2s infinite;
            }
    
            @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    
            /* Small screen adjustments (like 3.5" or 5" Pi displays) */
            @media (max-height: 500px) {
                .container { 
                    flex-direction: row; 
                    max-width: 95vw; 
                    padding: 2vh;
                    gap: 20px;
                }
                .header, .instructions, .footer { display: none; } /* Hide fluff to save space */
                .qr-wrapper { width: 40vh; height: 40vh; margin: 0; }
                .info-card { flex: 1; }
            }
    
            .url-display {
                font-size: 0.7rem;
                opacity: 0.6;
                margin-top: 1rem;
                word-break: break-all;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>JusPri</h1>
                <p style="color: var(--muted-foreground)">Fast Document Printing</p>
            </div>
    
            <div class="qr-wrapper">
                <img src="${qrDataUrl}" alt="QR Code" class="qr-code">
            </div>
    
            <div class="info-card">
                <div style="font-size: 0.7rem; color: var(--muted-foreground); text-transform: uppercase;">Kiosk ID</div>
                <div class="kiosk-id-value">${KIOSK_ID}</div>
                
                <div class="status-badge">
                    <span class="status-dot"></span>
                    Ready to Print
                </div>
            </div>
    
            <div class="instructions">
                <strong>Scan to Print</strong>
            </div>
    
            <div class="url-display">${qrUrl}</div>
        </div>
    
        <script>
            // Auto-refresh every 5 minutes
            setTimeout(() => location.reload(), 300000);
        </script>
    </body>
    </html>
    `;

    res.send(html);
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).send('Error generating QR code');
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    kiosk_id: KIOSK_ID,
    qr_url: qrUrl,
    timestamp: new Date().toISOString()
  });
});

// Get QR code as image
app.get('/qr.png', async (req, res) => {
  try {
    const buffer = await QRCode.toBuffer(qrUrl, {
      width: 400,
      margin: 2
    });
    
    res.type('image/png');
    res.send(buffer);
  } catch (error) {
    console.error('Error generating QR image:', error);
    res.status(500).send('Error generating QR image');
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════╗
║   QR Display Server Running            ║
║   Port: ${PORT}                           ║
║   Kiosk: ${KIOSK_ID.padEnd(30)}║
╚════════════════════════════════════════╝

🌐 Access QR code at:
   Local:   http://localhost:${PORT}
   Network: http://${getLocalIP()}:${PORT}

📱 QR Code URL: ${qrUrl}
  `);
});

// Get local IP address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}
