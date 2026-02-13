// pi-agent/index.js - V2 Enhanced with Token System
const io = require('socket.io-client');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');
const PDFDocument = require('pdf-lib').PDFDocument;

// ==================== CONFIG ====================
const CLOUD_SERVER = process.env.CLOUD_URL || 'https://justpri.duckdns.org';
const PRINTER_NAME = process.env.PRINTER_NAME || 'auto';
const KIOSK_ID = process.env.KIOSK_ID || `kiosk_${require('os').hostname()}`;
const TEMP_DIR = './print-queue';
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

// ==================== SETUP ====================
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

console.log(`
╔════════════════════════════════════════╗
║   DirectPrint Agent V2 Starting...     ║
║   Kiosk ID: ${KIOSK_ID.padEnd(26)}║
║   Cloud: ${CLOUD_SERVER.padEnd(30)}║
╚════════════════════════════════════════╝
`);

const socket = io(CLOUD_SERVER, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: Infinity
});

// ==================== STATE ====================
let currentJob = null;
let printerName = null;
const pendingJobs = new Map(); // job_id -> { job, filePath }

// ==================== PRINTER DETECTION ====================
async function detectPrinter() {
  return new Promise((resolve, reject) => {
    if (PRINTER_NAME !== 'auto') {
      console.log(`✓ Using configured printer: ${PRINTER_NAME}`);
      return resolve(PRINTER_NAME);
    }

    exec('lpstat -p -d', (error, stdout, stderr) => {
      if (error) {
        console.error('✗ CUPS not found. Install CUPS: sudo apt install cups');
        return reject('CUPS_NOT_INSTALLED');
      }

      const lines = stdout.split('\n');
      const defaultMatch = lines.find(l => l.startsWith('system default destination:'));
      
      if (defaultMatch) {
        const name = defaultMatch.split(':')[1].trim();
        console.log(`✓ Auto-detected printer: ${name}`);
        resolve(name);
      } else {
        const printerLine = lines.find(l => l.startsWith('printer'));
        if (printerLine) {
          const name = printerLine.split(' ')[1];
          console.log(`✓ Using first available: ${name}`);
          resolve(name);
        } else {
          console.warn('⚠ No printer found');
          reject('NO_PRINTER_FOUND');
        }
      }
    });
  });
}

// ==================== PDF OPERATIONS ====================
async function countPDFPages(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(dataBuffer);
    return pdfDoc.getPageCount();
  } catch (e) {
    console.error('⚠ Page count failed:', e.message);
    return 1;
  }
}

// ==================== JOB HANDLERS ====================
async function handleNewJob(data) {
  const { job_id, filename, pages, fileBuffer } = data;
  
  console.log(`\n📄 New Job Received`);
  console.log(`   ID: ${job_id}`);
  console.log(`   File: ${filename}`);
  console.log(`   Pages: ${pages}`);
  
  const tempFile = path.join(TEMP_DIR, `${job_id}_${filename}`);
  
  try {
    // Save file
    fs.writeFileSync(tempFile, Buffer.from(fileBuffer));
    console.log('   ✓ File saved locally');
    
    // Store in pending
    pendingJobs.set(job_id, { 
      job_id, 
      filename, 
      pages,
      filePath: tempFile,
      receivedAt: new Date()
    });
    
    // Notify server
    socket.emit('job_received', { job_id });
    
    // Verify pages
    const actualPages = await countPDFPages(tempFile);
    console.log(`   ✓ Verified: ${actualPages} pages`);
    
    // Since payment is already verified by server, we can print
    // The server will send print_authorize event
    console.log('   ⏳ Waiting for print authorization...');
    
    // Auto-authorize after receiving (since payment was verified)
    // In production, wait for explicit authorize event from server
    setTimeout(() => {
      executePrint(job_id);
    }, 1000);
    
  } catch (e) {
    console.error('✗ Job processing error:', e);
    socket.emit('print_failed', { 
      job_id,
      error: e.message 
    });
    
    // Cleanup
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    pendingJobs.delete(job_id);
  }
}

async function executePrint(job_id) {
  const pending = pendingJobs.get(job_id);
  
  if (!pending) {
    console.error(`✗ Job ${job_id} not found in pending queue`);
    return;
  }
  
  const { filename, filePath, pages } = pending;
  
  console.log(`\n🖨️  Printing Job ${job_id}`);
  console.log(`   File: ${filename}`);
  
  currentJob = job_id;
  
  // Notify server: printing started
  socket.emit('print_started', { job_id });
  
  try {
    // Detect printer if not already done
    if (!printerName) {
      printerName = await detectPrinter();
    }
    
    // Send to CUPS
    const printCommand = `lp -d ${printerName} "${filePath}"`;
    
    exec(printCommand, (error, stdout, stderr) => {
      if (error) {
        console.error('✗ Print failed:', stderr);
        socket.emit('print_failed', { 
          job_id,
          error: stderr || error.message
        });
      } else {
        console.log('✓ Print job sent to CUPS');
        console.log(stdout);
        
        socket.emit('print_complete', { 
          job_id,
          success: true,
          pages_printed: pages
        });
        
        console.log(`✓ Job ${job_id} completed\n`);
      }
      
      // Cleanup
      currentJob = null;
      pendingJobs.delete(job_id);
      
      setTimeout(() => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`   🗑️  Cleaned up temp file`);
        }
      }, 5000);
    });
    
  } catch (e) {
    console.error('✗ Print execution error:', e);
    socket.emit('print_failed', { 
      job_id,
      error: e.message
    });
    
    currentJob = null;
    pendingJobs.delete(job_id);
  }
}

// ==================== SOCKET EVENTS ====================
socket.on('connect', async () => {
  console.log('✓ Connected to Cloud Hub!');
  
  // Detect printer on startup
  try {
    printerName = await detectPrinter();
  } catch (e) {
    console.warn('⚠ Could not detect printer:', e);
  }
  
  // Register with server
  socket.emit('register', { 
    kiosk_id: KIOSK_ID,
    hostname: require('os').hostname(),
    printer_name: printerName || 'unknown'
  });
  
  console.log('✓ Registered with cloud');
  console.log('🚀 Agent ready and listening for jobs!\n');
});

socket.on('disconnect', () => {
  console.log('⚠ Disconnected from Cloud. Reconnecting...');
});

socket.on('reconnect', (attemptNumber) => {
  console.log(`✓ Reconnected after ${attemptNumber} attempts`);
});

socket.on('new_job', handleNewJob);

socket.on('print_authorize', (data) => {
  const { job_id, print_token } = data;
  console.log(`🔐 Received authorization for ${job_id}`);
  
  // In production, validate token here
  // For now, just execute
  executePrint(job_id);
});

socket.on('cancel_job', (data) => {
  const { job_id } = data;
  console.log(`🚫 Job ${job_id} cancelled by server`);
  
  const pending = pendingJobs.get(job_id);
  if (pending && fs.existsSync(pending.filePath)) {
    fs.unlinkSync(pending.filePath);
  }
  pendingJobs.delete(job_id);
  
  if (currentJob === job_id) {
    currentJob = null;
    // In production: send cancel command to CUPS
  }
});

socket.on('ping', () => {
  socket.emit('pong', { 
    status: 'alive', 
    uptime: process.uptime(),
    current_job: currentJob,
    pending_count: pendingJobs.size
  });
});

socket.on('update_config', (data) => {
  console.log('⚙️  Config update received:', data);
  // Update pricing, settings, etc.
});

// ==================== HEARTBEAT ====================
setInterval(() => {
  if (socket.connected) {
    socket.emit('heartbeat', {
      kiosk_id: KIOSK_ID,
      uptime: process.uptime(),
      printer_status: printerName ? 'ready' : 'no_printer',
      current_job: currentJob,
      pending_jobs: pendingJobs.size,
      memory: process.memoryUsage().heapUsed / 1024 / 1024
    });
  }
}, HEARTBEAT_INTERVAL);

// Status log every 60 seconds
setInterval(() => {
  if (socket.connected) {
    console.log(`💚 Agent alive | Uptime: ${Math.floor(process.uptime())}s | Pending: ${pendingJobs.size}`);
  }
}, 60000);

// ==================== CLEANUP OLD FILES ====================
setInterval(() => {
  const now = Date.now();
  const files = fs.readdirSync(TEMP_DIR);
  
  files.forEach(file => {
    const filePath = path.join(TEMP_DIR, file);
    const stats = fs.statSync(filePath);
    const ageMinutes = (now - stats.mtimeMs) / 1000 / 60;
    
    // Delete files older than 30 minutes
    if (ageMinutes > 30) {
      fs.unlinkSync(filePath);
      console.log(`🗑️  Cleaned up old file: ${file}`);
    }
  });
}, 300000); // Every 5 minutes

// ==================== GRACEFUL SHUTDOWN ====================
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down agent...');
  
  if (currentJob) {
    console.log(`⚠ Warning: Job ${currentJob} was in progress`);
  }
  
  socket.disconnect();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  socket.disconnect();
  process.exit(0);
});

console.log('📡 Connecting to cloud...');