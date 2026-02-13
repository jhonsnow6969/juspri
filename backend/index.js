const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');

const app = express();
const server = http.createServer(app);
// Enable CORS for Vercel
const io = new Server(server, { cors: { origin: "*" } }); 

app.use(cors({ origin: '*' }));
app.use(express.json());
const upload = multer({ dest: 'uploads/' });

// Track connected Printers (Spokes)
let printerSocket = null;
let printerInfo = { connected: false, hostname: null, lastSeen: null };

io.on('connection', (socket) => {
    console.log('[Cloud] New Client Connected:', socket.id);
    
    // The Pi sends this event to identify itself
    socket.on('register_printer', (data) => {
        console.log('[Cloud] Printer Registered:', data.hostname);
        printerSocket = socket;
        printerInfo = {
            connected: true,
            hostname: data.hostname,
            lastSeen: new Date(),
            socketId: socket.id
        };
    });

    socket.on('print_status', (data) => {
        console.log('[Cloud] Print Status:', data);
        // Forward status to frontend if needed
        io.emit('print_update', data);
    });

    socket.on('pong', (data) => {
        printerInfo.lastSeen = new Date();
        printerInfo.uptime = data.uptime;
    });

    socket.on('disconnect', () => {
        console.log('[Cloud] Printer Disconnected');
        if (printerSocket === socket) {
            printerSocket = null;
            printerInfo.connected = false;
        }
    });
});

// Health check endpoint
app.get('/api/status', (req, res) => {
    res.json({
        server: 'online',
        printer: printerInfo
    });
});

app.post('/api/connect', (req, res) => {
    if (printerSocket && printerInfo.connected) {
        res.json({ 
            status: 'connected', 
            message: 'Printer is Online via Cloud',
            printer: printerInfo.hostname
        });
    } else {
        res.status(503).json({ status: 'error', message: 'Printer Agent Offline' });
    }
});

// NEW: Page counting endpoint
app.post('/api/count-pages', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const dataBuffer = fs.readFileSync(req.file.path);
        const pdfDoc = await PDFDocument.load(dataBuffer);
        const pageCount = pdfDoc.getPageCount();
        
        // Cleanup
        fs.unlinkSync(req.file.path);
        
        // Price calculation (₹3 per page)
        const pricePerPage = 3;
        const totalPrice = pageCount * pricePerPage;
        
        res.json({ 
            pages: pageCount,
            pricePerPage: pricePerPage,
            totalPrice: totalPrice,
            currency: 'INR'
        });
    } catch (error) {
        console.error('Page count error:', error);
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: 'Failed to process PDF' });
    }
});

app.post('/api/print', upload.single('file'), (req, res) => {
    if (!printerSocket || !req.file) {
        return res.status(500).json({ 
            error: 'Printer offline or no file',
            printerConnected: !!printerSocket
        });
    }

    console.log("[Cloud] Reading file to stream to Agent...");
    
    // Read file to buffer
    fs.readFile(req.file.path, (err, data) => {
        if (err) {
            console.error('File read error:', err);
            return res.status(500).json({ error: 'Read Error' });
        }
        
        // EMIT THE FILE TO THE PI
        printerSocket.emit('print_job', { 
            filename: req.file.originalname, 
            fileBuffer: data 
        });

        // Cleanup cloud storage
        fs.unlinkSync(req.file.path);
        
        res.json({ 
            status: 'completed', 
            message: 'Sent to Printer Agent',
            printer: printerInfo.hostname
        });
    });
});

// Periodic ping to printer
setInterval(() => {
    if (printerSocket) {
        printerSocket.emit('ping');
    }
}, 15000);

server.listen(3001, '0.0.0.0', () => console.log('Cloud Hub Running on 3001'));
