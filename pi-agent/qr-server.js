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
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>JusPri - ${KIOSK_ID}</title>
        <style>
            /* Shadcn UI Dark Theme Variables */
            :root {
                --background: #000000;
                --card: #111111;
                --foreground: #ffffff;
                --muted: #262626;
                --muted-foreground: #a3a3a3;
                --border: #27272a;
                --success: #10b981;
                --success-bg: rgba(16, 185, 129, 0.1);
                --radius: 24px;
            }
    
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
    
            body {
                font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                background-color: var(--background);
                color: var(--foreground);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                line-height: 1.5;
                -webkit-font-smoothing: antialiased;
            }
    
            .container {
                background-color: var(--card);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                padding: 40px 32px;
                text-align: center;
                max-width: 420px;
                width: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
            }
    
            .header {
                margin-bottom: 24px;
            }
    
            .logo {
                background-color: var(--foreground);
                color: var(--background);
                width: 48px;
                height: 48px;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 16px;
                box-shadow: 0 4px 6px -1px rgba(255, 255, 255, 0.1);
            }
    
            .logo svg {
                width: 24px;
                height: 24px;
                stroke: currentColor;
            }
    
            h1 {
                font-size: 24px;
                font-weight: 600;
                letter-spacing: -0.025em;
                margin-bottom: 4px;
            }
    
            .subtitle {
                font-size: 14px;
                color: var(--muted-foreground);
            }
    
            .qr-wrapper {
                /* QR codes must remain on a white background to be scannable by all devices */
                background: #ffffff;
                padding: 16px;
                border-radius: 16px;
                margin-bottom: 24px;
                width: 100%;
                max-width: 260px;
                aspect-ratio: 1 / 1;
                display: flex;
                align-items: center;
                justify-content: center;
            }
    
            .qr-code {
                width: 100%;
                height: 100%;
                object-fit: contain;
            }
    
            .info-card {
                background-color: rgba(255, 255, 255, 0.03);
                border: 1px solid var(--border);
                border-radius: 12px;
                padding: 16px;
                width: 100%;
                margin-bottom: 24px;
            }
    
            .kiosk-id-label {
                font-size: 12px;
                color: var(--muted-foreground);
                text-transform: uppercase;
                letter-spacing: 0.05em;
                margin-bottom: 4px;
            }
    
            .kiosk-id-value {
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
                font-size: 20px;
                font-weight: 700;
                letter-spacing: 0.05em;
                margin-bottom: 12px;
            }
    
            .location-info {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                font-size: 13px;
                color: var(--muted-foreground);
            }
    
            .divider {
                color: var(--border);
            }
    
            .status-badge {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                background-color: var(--success-bg);
                color: var(--success);
                border: 1px solid rgba(16, 185, 129, 0.2);
                padding: 4px 12px;
                border-radius: 9999px;
                font-size: 12px;
                font-weight: 500;
                margin-top: 16px;
            }
    
            .status-dot {
                width: 6px;
                height: 6px;
                background-color: var(--success);
                border-radius: 50%;
                animation: pulse 2s infinite cubic-bezier(0.4, 0, 0.6, 1);
            }
    
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
    
            .instructions {
                font-size: 14px;
                color: var(--muted-foreground);
                margin-bottom: 16px;
            }
    
            .instructions strong {
                color: var(--foreground);
                display: block;
                margin-bottom: 4px;
            }
    
            .url-display {
                background-color: rgba(0, 0, 0, 0.4);
                border: 1px solid var(--border);
                border-radius: 8px;
                padding: 10px 12px;
                font-size: 11px;
                color: var(--muted-foreground);
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                word-break: break-all;
                width: 100%;
            }
    
            .footer {
                margin-top: 24px;
                padding-top: 16px;
                border-top: 1px solid var(--border);
                font-size: 12px;
                color: var(--muted-foreground);
                width: 100%;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                </div>
                <h1>JusPri Kiosk</h1>
                <p class="subtitle">Fast & Easy Document Printing</p>
            </div>
    
            <div class="qr-wrapper">
                <img src="${qrDataUrl}" alt="QR Code" class="qr-code">
            </div>
    
            <div class="info-card">
                <div class="kiosk-id-label">Kiosk ID</div>
                <div class="kiosk-id-value">${KIOSK_ID}</div>
                
                <div class="location-info">
                    <span>📍 ${LOCATION}</span>
                    <span class="divider">|</span>
                    <span>Floor ${FLOOR}</span>
                </div>
    
                <div class="status-badge">
                    <span class="status-dot"></span>
                    Online & Ready
                </div>
            </div>
    
            <div class="instructions">
                <strong>📱 Scan to Print</strong>
                Point your camera at the QR code to connect
            </div>
    
            <div class="url-display">${qrUrl}</div>
    
            <div class="footer">
                Powered by JusPri
            </div>
        </div>
    
        <script>
            // Auto-refresh every 5 minutes to ensure up-to-date status
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
