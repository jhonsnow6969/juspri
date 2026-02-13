// pi-agent/index.js - Runs on Raspberry Pi or ANY laptop with CUPS
const io = require('socket.io-client');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');
const PDFDocument = require('pdf-lib').PDFDocument;

// ==================== CONFIG ====================
const CLOUD_SERVER = process.env.CLOUD_URL || 'http://localhost:3001';
const PRINTER_NAME = process.env.PRINTER_NAME || 'auto'; // 'auto' or specific name like 'HP_LaserJet'
const TEMP_DIR = './print-queue';

// ==================== SETUP ====================
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

console.log('🖨️  DirectPrint Agent Starting...');
console.log(`📡 Connecting to Cloud: ${CLOUD_SERVER}`);

const socket = io(CLOUD_SERVER, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: Infinity
});

// ==================== PRINTER DETECTION ====================
async function detectPrinter() {
    return new Promise((resolve, reject) => {
        if (PRINTER_NAME !== 'auto') {
            console.log(`✅ Using configured printer: ${PRINTER_NAME}`);
            return resolve(PRINTER_NAME);
        }

        exec('lpstat -p -d', (error, stdout, stderr) => {
            if (error) {
                console.error('❌ CUPS not found. Install CUPS: sudo apt install cups');
                return reject('CUPS_NOT_INSTALLED');
            }

            // Parse default printer
            const lines = stdout.split('\n');
            const defaultMatch = lines.find(l => l.startsWith('system default destination:'));
            
            if (defaultMatch) {
                const printerName = defaultMatch.split(':')[1].trim();
                console.log(`🎯 Auto-detected printer: ${printerName}`);
                resolve(printerName);
            } else {
                // Fallback: Get first available printer
                const printerLine = lines.find(l => l.startsWith('printer'));
                if (printerLine) {
                    const name = printerLine.split(' ')[1];
                    console.log(`📍 Using first available: ${name}`);
                    resolve(name);
                } else {
                    reject('NO_PRINTER_FOUND');
                }
            }
        });
    });
}

// ==================== PDF PAGE COUNTER ====================
async function countPDFPages(filePath) {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        const pdfDoc = await PDFDocument.load(dataBuffer);
        return pdfDoc.getPageCount();
    } catch (e) {
        console.error('⚠️  Page count failed:', e.message);
        return 1; // Fallback
    }
}

// ==================== PRINT HANDLER ====================
async function handlePrintJob(data) {
    console.log(`📄 Received job: ${data.filename}`);
    
    const tempFile = path.join(TEMP_DIR, `${Date.now()}_${data.filename}`);
    
    try {
        // Save file
        fs.writeFileSync(tempFile, Buffer.from(data.fileBuffer));
        console.log('💾 File saved to temp');

        // Count pages for logging
        const pages = await countPDFPages(tempFile);
        console.log(`📊 Document has ${pages} page(s)`);

        // Detect printer
        const printer = await detectPrinter();

        // Send to CUPS
        const printCommand = `lp -d ${printer} "${tempFile}"`;
        
        exec(printCommand, (error, stdout, stderr) => {
            if (error) {
                console.error('❌ Print failed:', stderr);
                socket.emit('print_status', { 
                    status: 'error', 
                    message: stderr,
                    filename: data.filename 
                });
            } else {
                console.log('✅ Print job sent to CUPS!');
                console.log(stdout);
                socket.emit('print_status', { 
                    status: 'success', 
                    message: 'Printed successfully',
                    filename: data.filename,
                    pages: pages
                });
            }

            // Cleanup
            setTimeout(() => {
                if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
            }, 5000);
        });

    } catch (e) {
        console.error('💥 Job processing error:', e);
        socket.emit('print_status', { 
            status: 'error', 
            message: e.message,
            filename: data.filename 
        });
    }
}

// ==================== SOCKET EVENTS ====================
socket.on('connect', () => {
    console.log('✅ Connected to Cloud Hub!');
    socket.emit('register_printer', { 
        hostname: require('os').hostname(),
        timestamp: new Date().toISOString()
    });
});

socket.on('disconnect', () => {
    console.log('⚠️  Disconnected from Cloud. Reconnecting...');
});

socket.on('print_job', handlePrintJob);

socket.on('ping', () => {
    socket.emit('pong', { status: 'alive', uptime: process.uptime() });
});

// ==================== HEALTH CHECK ====================
setInterval(() => {
    if (socket.connected) {
        console.log(`💚 Agent alive | Uptime: ${Math.floor(process.uptime())}s`);
    }
}, 30000);

// ==================== GRACEFUL SHUTDOWN ====================
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down agent...');
    socket.disconnect();
    process.exit(0);
});

console.log('🚀 Agent ready and listening for jobs!');
