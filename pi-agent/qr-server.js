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
    <title>DirectPrint - ${KIOSK_ID}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .container {
            background: white;
            border-radius: 24px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            padding: 60px 40px;
            text-align: center;
            max-width: 500px;
            width: 100%;
        }

        .logo {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            width: 80px;
            height: 80px;
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 30px;
        }

        .logo svg {
            width: 40px;
            height: 40px;
            color: white;
        }

        h1 {
            font-size: 36px;
            font-weight: 700;
            color: #1a202c;
            margin-bottom: 10px;
        }

        .subtitle {
            font-size: 18px;
            color: #718096;
            margin-bottom: 40px;
        }

        .qr-container {
            background: #f7fafc;
            border-radius: 16px;
            padding: 30px;
            margin-bottom: 30px;
            border: 2px solid #e2e8f0;
        }

        .qr-code {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
        }

        .kiosk-info {
            background: #edf2f7;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 30px;
        }

        .kiosk-id {
            font-size: 14px;
            color: #718096;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 600;
        }

        .kiosk-value {
            font-size: 20px;
            font-weight: 700;
            color: #2d3748;
            font-family: 'Courier New', monospace;
        }

        .status {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: #c6f6d5;
            color: #22543d;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
            margin-top: 15px;
        }

        .status-dot {
            width: 8px;
            height: 8px;
            background: #38a169;
            border-radius: 50%;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        .instructions {
            font-size: 16px;
            color: #4a5568;
            line-height: 1.6;
            margin-bottom: 20px;
        }

        .instructions strong {
            color: #2d3748;
        }

        .url {
            background: #f7fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px;
            font-size: 12px;
            color: #718096;
            word-break: break-all;
            font-family: 'Courier New', monospace;
        }

        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            font-size: 12px;
            color: #a0aec0;
        }

        @media (max-width: 600px) {
            .container {
                padding: 40px 20px;
            }

            h1 {
                font-size: 28px;
            }

            .subtitle {
                font-size: 16px;
            }
        }
    </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
            </div>
    
            <h1>DirectPrint Kiosk</h1>
            <p class="subtitle">Fast & Easy Document Printing</p>
    
            <div class="qr-container">
                <img src="${qrDataUrl}" alt="QR Code" class="qr-code">
            </div>
    
            <div class="kiosk-info">
                <div class="kiosk-id">Kiosk ID</div>
                <div class="kiosk-value">${KIOSK_ID}</div>
                
                <div style="margin-top: 12px; font-size: 15px; color: #4a5568; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <span>📍 ${LOCATION}</span>
                    <span style="color: #cbd5e0;">|</span>
                    <span>Floor ${FLOOR}</span>
                </div>
                <div class="status">
                    <span class="status-dot"></span>
                    Online & Ready
                </div>
            </div>
    
            <div class="instructions">
                <strong>📱 Scan to Print</strong><br>
                Open your phone's camera and point it at the QR code above
            </div>
    
            <div class="url">${qrUrl}</div>
    
            <div class="footer">
                Powered by DirectPrint
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
