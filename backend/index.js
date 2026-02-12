const express = require('express');
const net = require('net');
const cors = require('cors');
const fs = require('fs');
const multer = require('multer');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

// --- UPDATED ENDPOINT: Connect / Ping Printer ---
app.post('/api/connect', (req, res) => {
    // 1. GET THE REAL IP FROM FRONTEND
    const { ip, port } = req.body; 
    
    // Safety check
    if (!ip) return res.status(400).json({ status: 'error', message: 'No IP provided' });

    console.log(`[Bridge] Connecting to REAL PRINTER at ${ip}:${port || 9100}...`);
    
    const socket = new net.Socket();
    socket.setTimeout(4000); // 4 second real network timeout
    
    // 2. CONNECT TO THE REAL PRINTER
    socket.connect(port || 9100, ip, () => {
        socket.destroy(); // Connection established! We just wanted to ping it.
        res.json({ status: 'connected', message: 'Printer is Online' });
    });

    socket.on('error', (err) => {
        console.error("Connection Failed:", err.message);
        res.status(500).json({ status: 'error', message: 'Unreachable' });
    });

    socket.on('timeout', () => {
        socket.destroy();
        res.status(408).json({ status: 'timeout', message: 'Printer unreachable (Check IP/Power)' });
    });
});

// --- EXISTING ENDPOINT: Print Raw Bytes ---
app.post('/api/print', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).send('No file.');
    
    const printerIP = req.body.printerIP || '127.0.0.1';
    const printerPort = req.body.port || 9100;
    const filePath = path.join(__dirname, req.file.path);
    
    console.log(`[Bridge] Streaming ${req.file.originalname} to ${printerIP}:${printerPort}...`);

    const client = new net.Socket();
    const fileStream = fs.createReadStream(filePath);

    client.connect(printerPort, printerIP, () => {
        fileStream.pipe(client);
    });

    client.on('close', () => {
        fs.unlinkSync(filePath); // Cleanup
        res.json({ status: 'completed' });
    });

    client.on('error', (err) => {
        console.error(err);
        res.status(500).json({ status: 'failed', error: err.message });
    });
});

const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend Bridge running at http://localhost:${PORT}`);
});